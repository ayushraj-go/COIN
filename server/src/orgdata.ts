// The organisation's data on the server: snapshots (cached by version), commands and undo.
//
// A command runs the shared workflow engine (src/domain/engine.ts) on a snapshot of the organisation, as the
// signed-in user, after the shared policy (src/domain/policies.ts) has allowed it. Commands of one organisation are
// serialised with an advisory lock, so two people approving at the same moment never overwrite each other.
import { randomUUID } from 'node:crypto'
import { createStore } from 'zustand/vanilla'
import { DATA_KEYS, domainActions, type DomainActions, type DomainData, type DomainState } from '../../src/domain/engine'
import { POLICIES, authorise } from '../../src/domain/policies'
import { visibleDelta, type Delta } from '../../src/domain/visibility'
import type { Attachment, User } from '../../src/lib/types'
import type { Config } from './config'
import { tx, type Db, type Tx } from './db'
import { loadOrg, persistDiff, restoreRows, rowsTouchedSince, type BeforeRow } from './collections'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

interface Snapshot { version: number; data: DomainData }
export interface CommandOutcome { result: unknown; version: number; changes: Delta; duplicate?: boolean; insertedEmails: string[] }

const pickData = (s: Record<string, unknown>) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as DomainData
const UNDO_WINDOW_MS = 10 * 60_000
const MAX_FILE_BYTES = 10 * 1024 * 1024

/** keep the audit log readable: long strings (embedded files, signatures) are cut */
function trimArgs(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return v.length > 500 ? `${v.slice(0, 120)}… (${v.length} chars)` : v
  if (Array.isArray(v)) return depth > 6 ? '[…]' : v.slice(0, 200).map((x) => trimArgs(x, depth + 1))
  // passwords (set by Admin) never reach the audit log
  if (v && typeof v === 'object') return depth > 6 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /password/i.test(k) ? '•••' : trimArgs(x, depth + 1)]))
  return v
}
const withoutPasswords = <T,>(users: T[]): T[] => (users.some((u) => (u as { password?: string }).password) ? users.map((u) => { if (!(u as { password?: string }).password) return u; const { password: _p, ...rest } = u as T & { password?: string }; void _p; return rest as T }) : users)

/** the records a scoped command changed, added or removed (by id) */
function changedIds<T extends { id: string }>(before: T[], after: T[]): Set<string> {
  const prev = new Map(before.map((x) => [x.id, x]))
  const out = new Set<string>()
  for (const x of after) if (prev.get(x.id) !== x) out.add(x.id)
  const now = new Set(after.map((x) => x.id))
  for (const id of prev.keys()) if (!now.has(id)) out.add(id)
  return out
}

export class OrgData {
  private cache = new Map<string, Snapshot>()
  constructor(private db: Db, private config: Config, private log: { warn: (o: object, m: string) => void }) {}

  /** The current data of an organisation (from cache when nothing changed) */
  async snapshot(orgId: string): Promise<Snapshot> {
    const v = (await this.db.query<{ version: number }>('select version from organisations where id = $1', [orgId])).rows[0]
    if (!v) throw new HttpError(503, 'The organisation is not set up yet — run "npm run db:seed"')
    const hit = this.cache.get(orgId)
    if (hit && hit.version === v.version) return hit
    const c = await this.db.connect()
    try {
      // one consistent picture: the version and every table read in the same snapshot
      await c.query('begin isolation level repeatable read read only')
      const version = (await c.query<{ version: number }>('select version from organisations where id = $1', [orgId])).rows[0].version
      const data = await loadOrg(c, orgId)
      await c.query('commit')
      const snap = { version, data }
      this.cache.set(orgId, snap)
      return snap
    } catch (e) {
      await c.query('rollback').catch(() => undefined)
      throw e
    } finally { c.release() }
  }

  invalidate(orgId: string) { this.cache.delete(orgId) }

  /** Move embedded files (data: URLs) into the files table; ideas keep name, size, type and a /api/files link */
  private async storeFiles(c: Tx, orgId: string, name: string, args: unknown[], me: User | null): Promise<unknown[]> {
    const fix = async (list: Attachment[] | undefined) => {
      if (!Array.isArray(list)) return list
      const out: Attachment[] = []
      for (const a of list) {
        const m = typeof a?.dataUrl === 'string' ? /^data:([^;,]*)(;base64)?,(.*)$/s.exec(a.dataUrl) : null
        if (!m) {
          // a link to a stored file is accepted only for files this person uploaded — nobody can "borrow" someone else's
          const id = typeof a?.url === 'string' ? a.url.replace('/api/files/', '') : ''
          const own = id && (await c.query('select 1 from files where org_id = $1 and id = $2 and created_by = $3', [orgId, id, me?.id ?? null])).rowCount
          if (own) out.push({ ...a, dataUrl: undefined } as Attachment)
          continue
        }
        const bytes = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8')
        if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, `${a.name} is larger than 10 MB`)
        const id = randomUUID()
        await c.query('insert into files (org_id, id, name, type, size, bytes, created_by) values ($1, $2, $3, $4, $5, $6, $7)', [orgId, id, a.name ?? 'file', a.type || m[1] || 'application/octet-stream', bytes.length, bytes, me?.id ?? null])
        const { dataUrl: _d, ...rest } = a
        void _d
        out.push({ ...rest, url: `/api/files/${id}` } as Attachment)
      }
      return out
    }
    if (name === 'addAttachments') return [args[0], await fix(args[1] as Attachment[])]
    if ((name === 'saveDraft' || name === 'submitIdea') && args[0] && typeof args[0] === 'object') {
      const d = args[0] as { attachments?: Attachment[] }
      return [{ ...d, attachments: await fix(d.attachments) }, ...args.slice(1)]
    }
    return args
  }

  /**
   * Run one engine action for a user (or as the system for public endpoints) and persist what it changed.
   * Re-sending the same commandId returns the first outcome instead of running twice.
   */
  async run(orgId: string, actorId: string | null, name: string, args: unknown[], commandId: string, opts: { system?: boolean } = {}): Promise<CommandOutcome> {
    let me: User | null = null
    try {
      const out = await tx(this.db, async (c) => {
        await c.query('select pg_advisory_xact_lock(hashtext($1))', [orgId])
        const dup = (await c.query('select ok, version, actor_id from command_log where id = $1', [commandId])).rows[0]
        if (dup) {
          if (dup.actor_id !== (actorId ?? 'system')) throw new HttpError(409, 'Command id already used')
          return { duplicate: true as const, version: dup.version as number }
        }
        const version = (await c.query<{ version: number }>('select version from organisations where id = $1 for update', [orgId])).rows[0]?.version
        if (version == null) throw new HttpError(503, 'The organisation is not set up yet')
        const hit = this.cache.get(orgId)
        const data = hit && hit.version === version ? hit.data : await loadOrg(c, orgId)
        if (actorId) {
          me = data.users.find((u) => u.id === actorId) ?? null
          if (!me || me.active === false) throw new HttpError(401, 'Your account is not active')
        }
        const before: DomainState = { ...data, userId: me?.id ?? null }
        let callArgs = args
        if (!opts.system) {
          const a = authorise(name, { me: me!, state: before, args })
          if (a.ok === false) throw new HttpError(403, (a as { reason: string }).reason)
          callArgs = a.args
        }
        callArgs = await this.storeFiles(c, orgId, name, callArgs, me)

        const warnings: string[] = []
        const store = createStore<DomainState & DomainActions>()((set, get) => ({
          ...before,
          ...domainActions(set as never, get as never, { warn: (m) => warnings.push(m), appUrl: () => this.config.APP_URL }),
        }))
        const fn = (store.getState() as unknown as Record<string, unknown>)[name]
        if (typeof fn !== 'function') throw new HttpError(400, `Unknown action ${name}`)
        const result = (fn as (...x: unknown[]) => unknown)(...callArgs)
        if (warnings.length) throw new HttpError(409, warnings[0])
        const after: DomainState = { ...pickData(store.getState() as unknown as Record<string, unknown>), userId: before.userId }
        // only Admin setting a password writes one; anything else (e.g. the demo seed inside resetDemo) never touches hashes
        const settingPassword = name === 'upsert' && callArgs[0] === 'users'
        if (!settingPassword) after.users = withoutPasswords(after.users)
        // defence in depth: a command scoped to one idea / campaign may change only that record
        const scope = POLICIES[name]?.scope
        if (scope === 'idea' || scope === 'campaign') {
          const key = scope === 'idea' ? 'ideas' : 'campaigns'
          const touched = changedIds(before[key] as { id: string }[], after[key] as { id: string }[])
          for (const id of touched) if (id !== callArgs[0]) throw new HttpError(403, `This action may only change ${String(callArgs[0])}`)
        }

        const { beforeRows, inserted } = await persistDiff(c, orgId, before, after, commandId)
        // the hash is written; the plain password must not stay in the cached snapshot
        after.users = withoutPasswords(after.users)
        const next = version + 1
        await c.query('update organisations set version = $2 where id = $1', [orgId, next])
        await c.query('insert into command_log (id, org_id, actor_id, command, args, ok, before_rows, version) values ($1, $2, $3, $4, $5, true, $6, $7)',
          [commandId, orgId, me?.id ?? 'system', name, JSON.stringify(trimArgs(callArgs)), JSON.stringify(beforeRows), next])
        return { duplicate: false as const, result, version: next, before, after, insertedEmails: inserted.emails ?? [] }
      })
      if (out.duplicate) return { result: null, version: out.version, changes: {}, duplicate: true, insertedEmails: [] }
      this.cache.set(orgId, { version: out.version, data: pickData(out.after as unknown as Record<string, unknown>) })
      return { result: out.result, version: out.version, changes: me ? visibleDelta(me, out.before, out.after) : {}, insertedEmails: out.insertedEmails }
    } catch (e) {
      this.cache.delete(orgId)
      const status = e instanceof HttpError ? e.status : 500
      // refused and failed commands are audited too (outside the rolled-back transaction)
      await this.db.query('insert into command_log (id, org_id, actor_id, command, args, ok, error) values ($1, $2, $3, $4, $5, false, $6) on conflict (id) do nothing',
        [`${commandId}:failed:${randomUUID().slice(0, 8)}`, orgId, actorId ?? 'system', name, JSON.stringify(trimArgs(args)), `${status} ${(e as Error).message}`.slice(0, 500)]).catch(() => undefined)
      if (!(e instanceof HttpError)) this.log.warn({ err: e, command: name }, 'command failed')
      throw e
    }
  }

  /** Undo the user's own recent commands (newest first) — refused when someone changed the same rows since */
  async undo(orgId: string, actorId: string, commandIds: string[]): Promise<{ version: number; undone: number }> {
    try {
      const out = await tx(this.db, async (c) => {
        await c.query('select pg_advisory_xact_lock(hashtext($1))', [orgId])
        const rows = (await c.query('select id, actor_id, at, undone_at, before_rows from command_log where org_id = $1 and id = any($2) and ok order by at desc', [orgId, commandIds])).rows
        if (!rows.length) throw new HttpError(404, 'Nothing to undo')
        const undoId = randomUUID()
        const allowed = new Set<string>([undoId])
        let undone = 0
        for (const r of rows) {
          if (r.actor_id !== actorId) throw new HttpError(403, 'You can only undo your own actions')
          if (r.undone_at) continue
          if (Date.now() - new Date(r.at).getTime() > UNDO_WINDOW_MS) throw new HttpError(409, 'Too late to undo — make the change again instead')
          const before = (r.before_rows ?? []) as BeforeRow[]
          allowed.add(r.id)
          const touched = await rowsTouchedSince(c, orgId, before, allowed)
          if (touched) throw new HttpError(409, `Cannot undo — ${touched}`)
          await restoreRows(c, orgId, before, undoId)
          await c.query('update command_log set undone_at = now(), undone_by = $2 where id = $1', [r.id, undoId])
          undone++
        }
        const version = (await c.query<{ version: number }>('update organisations set version = version + 1 where id = $1 returning version', [orgId])).rows[0].version
        await c.query('insert into command_log (id, org_id, actor_id, command, args, ok, version) values ($1, $2, $3, $4, $5, true, $6)', [undoId, orgId, actorId, 'undo', JSON.stringify({ commandIds }), version])
        return { version, undone }
      })
      return out
    } finally {
      this.cache.delete(orgId)
    }
  }
}
