// How the app's data maps onto tables: loading an organisation, writing what a command changed, and restoring
// the rows a command replaced (undo). Each list keeps its full record in `data` plus a few typed columns.
import type { DomainData, DomainState } from '../../src/domain/engine'
import type { Tx } from './db'
import { hashPassword } from './passwords'

type Rec = Record<string, any>
type ListKey = 'users' | 'levers' | 'categories' | 'commodities' | 'plants' | 'suppliers' | 'parts' | 'slaRules' | 'approvalRules' | 'emailTemplates' | 'supplierTemplates'
  | 'ideas' | 'ledger' | 'campaigns' | 'notifications' | 'emails' | 'savedViews' | 'outreachBatches' | 'supplierResponses'

interface ListColl {
  key: ListKey
  table: string
  id: (x: Rec) => string
  /** typed columns stored next to `data` */
  cols?: (x: Rec) => Rec
  /** load order */
  order: string
  /** master lists keep the app's order in a sort column */
  sorted?: boolean
}

const ts = (v: unknown) => (typeof v === 'string' && v ? v : null)

export const LISTS: ListColl[] = [
  { key: 'users', table: 'users', id: (x) => x.id, order: 'created_at, id',
    cols: (u) => ({ email: u.email, employee_id: u.employeeId, name: u.name, roles: u.roles ?? [], department: u.department ?? '', supplier_code: u.supplierCode ?? null, active: u.active !== false }) },
  { key: 'levers', table: 'levers', id: (x) => x.id, order: 'sort, id', sorted: true },
  { key: 'categories', table: 'categories', id: (x) => x.id, order: 'sort, id', sorted: true },
  { key: 'commodities', table: 'commodities', id: (x) => x.code, order: 'sort, id', sorted: true },
  { key: 'plants', table: 'plants', id: (x) => x.id, order: 'sort, id', sorted: true },
  { key: 'suppliers', table: 'suppliers', id: (x) => x.code, order: 'sort, id', sorted: true },
  { key: 'parts', table: 'parts', id: (x) => x.code, order: 'sort, id', sorted: true },
  { key: 'slaRules', table: 'sla_rules', id: (x) => x.stage, order: 'sort, id', sorted: true },
  { key: 'approvalRules', table: 'approval_rules', id: (x) => x.id, order: 'sort, id', sorted: true },
  { key: 'emailTemplates', table: 'email_templates', id: (x) => x.id, order: 'sort, id', sorted: true },
  { key: 'supplierTemplates', table: 'supplier_templates', id: (x) => x.id, order: 'sort, id', sorted: true },
  { key: 'ideas', table: 'ideas', id: (x) => x.id, order: 'created_at desc, id',
    cols: (i) => ({ fy: i.fy ?? null, seq: i.seq ?? 0, title: i.title ?? '', stage: i.stage, bucket: i.bucket, route: i.route ?? null, department: i.department ?? null, commodity: i.commodity ?? null,
      submitter_id: i.submitterId ?? null, owner_id: i.ownerId ?? null, buyer_id: i.buyerId ?? null, supplier_code: i.supplierCode ?? null, campaign_id: i.campaignId ?? null,
      submitted_at: ts(i.submittedAt), created_at: ts(i.createdAt) ?? new Date().toISOString() }) },
  { key: 'ledger', table: 'ledger_entries', id: (x) => x.id, order: 'month, id', cols: (l) => ({ idea_id: l.ideaId, month: l.month, finance_status: l.financeStatus ?? 'Pending' }) },
  { key: 'campaigns', table: 'campaigns', id: (x) => x.id, order: 'id desc', cols: (c) => ({ status: c.status ?? 'Draft' }) },
  { key: 'notifications', table: 'notifications', id: (x) => x.id, order: 'at desc, id', cols: (n) => ({ user_id: n.userId, read: !!n.read, at: n.at }) },
  { key: 'emails', table: 'emails', id: (x) => x.id, order: 'at desc, id', cols: (e) => ({ at: e.at, to_addrs: e.to ?? [], subject: e.subject ?? '', template: e.template ?? null }) },
  { key: 'savedViews', table: 'saved_views', id: (x) => x.id, order: 'id', cols: (v) => ({ user_id: v.userId }) },
  { key: 'outreachBatches', table: 'outreach_batches', id: (x) => x.id, order: 'id desc' },
  { key: 'supplierResponses', table: 'supplier_responses', id: (x) => x.id, order: 'id', cols: (r) => ({ status: r.status ?? 'New' }) },
]
const BY_TABLE = new Map(LISTS.map((l) => [l.table, l]))

/** org_settings columns ↔ data keys */
const SETTINGS: [keyof DomainData, string][] = [
  ['settings', 'settings'], ['buyerTargets', 'buyer_targets'], ['plantTargets', 'plant_targets'], ['departments', 'departments'],
  ['dropReasons', 'drop_reasons'], ['fyClosed', 'fy_closed'], ['supplierPortalSyncAt', 'supplier_portal_sync_at'],
]

/** Load everything one organisation owns, in the shape the engine works on */
export async function loadOrg(c: Tx, orgId: string): Promise<DomainData> {
  const out: Rec = {}
  for (const l of LISTS) {
    const { rows } = await c.query(`select data from ${l.table} where org_id = $1 order by ${l.order}`, [orgId])
    out[l.key] = rows.map((r) => r.data)
  }
  const s = (await c.query('select * from org_settings where org_id = $1', [orgId])).rows[0]
  if (!s) throw new Error(`Organisation ${orgId} has no settings — run "npm run db:seed"`)
  for (const [key, col] of SETTINGS) out[key] = col === 'supplier_portal_sync_at' ? (s[col] ? new Date(s[col]).toISOString() : '') : s[col]
  const prefs = (await c.query('select id, data from email_prefs where org_id = $1', [orgId])).rows
  out.emailPrefs = Object.fromEntries(prefs.map((r) => [r.id, r.data]))
  return out as DomainData
}

export interface BeforeRow { table: string; id: string; data: Rec | null }

async function upsertRow(c: Tx, orgId: string, l: ListColl, item: Rec, sort: number, commandId: string | null) {
  let data = item
  const extra: Rec = l.cols ? l.cols(item) : {}
  if (l.sorted) extra.sort = sort
  if (l.key === 'users') {
    // the password never goes into `data`; a new one (admin set / seed) is stored as a scrypt hash
    const { password, ...rest } = item
    data = rest
    if (typeof password === 'string' && password) extra.password_hash = await hashPassword(password)
  }
  const cols = ['org_id', 'id', 'data', ...Object.keys(extra), 'updated_by_command']
  const vals = [orgId, l.id(item), JSON.stringify(data), ...Object.values(extra), commandId]
  const sets = cols.filter((k) => k !== 'org_id' && k !== 'id' && k !== 'created_at').map((k) => `${k} = excluded.${k}`)
  sets.push('updated_at = now()')
  await c.query(
    `insert into ${l.table} (${cols.join(', ')}) values (${cols.map((_, k) => `$${k + 1}`).join(', ')}) on conflict (org_id, id) do update set ${sets.join(', ')}`,
    vals,
  )
}

async function writeSettings(c: Tx, orgId: string, s: Rec, commandId: string | null) {
  const vals = SETTINGS.map(([key, col]) => (col === 'supplier_portal_sync_at' ? (s[key] || null) : JSON.stringify(s[key] ?? (col === 'departments' || col === 'drop_reasons' ? [] : {}))))
  await c.query(
    `insert into org_settings (org_id, ${SETTINGS.map(([, c2]) => c2).join(', ')}, updated_by_command) values ($1, ${SETTINGS.map((_, k) => `$${k + 2}`).join(', ')}, $${SETTINGS.length + 2})
     on conflict (org_id) do update set ${SETTINGS.map(([, c2]) => `${c2} = excluded.${c2}`).join(', ')}, updated_by_command = excluded.updated_by_command, updated_at = now()`,
    [orgId, ...vals, commandId],
  )
}

const settingsOf = (d: Rec) => Object.fromEntries(SETTINGS.map(([k]) => [k, d[k]]))

/** Write what changed between two states (object identity = unchanged). Returns the before-images for undo. */
export async function persistDiff(c: Tx, orgId: string, before: DomainState | DomainData, after: DomainState | DomainData, commandId: string | null): Promise<{ beforeRows: BeforeRow[]; inserted: Record<string, string[]> }> {
  const b = before as Rec, a = after as Rec
  const beforeRows: BeforeRow[] = []
  const inserted: Record<string, string[]> = {}
  for (const l of LISTS) {
    const prev: Rec[] = b[l.key] ?? [], next: Rec[] = a[l.key] ?? []
    if (prev === next) continue
    const prevById = new Map(prev.map((x) => [l.id(x), x]))
    const nextIds = new Set<string>()
    for (let k = 0; k < next.length; k++) {
      const x = next[k]
      const id = l.id(x)
      nextIds.add(id)
      const old = prevById.get(id)
      // sorted masters re-write their position when the list order changed
      if (old === x && !(l.sorted && prev[k] !== x)) continue
      await upsertRow(c, orgId, l, x, k, commandId)
      beforeRows.push({ table: l.table, id, data: old ?? null })
      if (!old) (inserted[l.key] ??= []).push(id)
    }
    for (const [id, old] of prevById) {
      if (nextIds.has(id)) continue
      await c.query(`delete from ${l.table} where org_id = $1 and id = $2`, [orgId, id])
      beforeRows.push({ table: l.table, id, data: old })
    }
  }
  if (SETTINGS.some(([k]) => b[k] !== a[k])) {
    await writeSettings(c, orgId, settingsOf(a), commandId)
    beforeRows.push({ table: 'org_settings', id: orgId, data: settingsOf(b) })
  }
  if (b.emailPrefs !== a.emailPrefs) {
    const pb = (b.emailPrefs ?? {}) as Rec, pa = (a.emailPrefs ?? {}) as Rec
    for (const id of new Set([...Object.keys(pb), ...Object.keys(pa)])) {
      if (pb[id] === pa[id]) continue
      if (pa[id] === undefined) await c.query('delete from email_prefs where org_id = $1 and id = $2', [orgId, id])
      else await c.query('insert into email_prefs (org_id, id, data, updated_by_command) values ($1, $2, $3, $4) on conflict (org_id, id) do update set data = excluded.data, updated_by_command = excluded.updated_by_command, updated_at = now()', [orgId, id, JSON.stringify(pa[id]), commandId])
      beforeRows.push({ table: 'email_prefs', id, data: pb[id] ?? null })
    }
  }
  return { beforeRows, inserted }
}

/** Has any of these rows been written by a later command? (undo is refused then) */
export async function rowsTouchedSince(c: Tx, orgId: string, rows: BeforeRow[], allowed: Set<string>): Promise<string | null> {
  for (const r of rows) {
    const table = r.table
    const q = table === 'org_settings'
      ? await c.query('select updated_by_command from org_settings where org_id = $1', [orgId])
      : await c.query(`select updated_by_command from ${table} where org_id = $1 and id = $2`, [orgId, r.id])
    const cur = q.rows[0]
    if (!cur) continue // gone (deleted by this command, or since): restoring re-creates it
    if (!allowed.has(cur.updated_by_command)) return `${table === 'org_settings' ? 'settings' : r.id} changed again after this action`
  }
  return null
}

/** Put back the rows a command replaced */
export async function restoreRows(c: Tx, orgId: string, rows: BeforeRow[], commandId: string) {
  for (const r of [...rows].reverse()) {
    if (r.table === 'org_settings') { await writeSettings(c, orgId, r.data ?? {}, commandId); continue }
    if (r.table === 'email_prefs') {
      if (r.data === null) await c.query('delete from email_prefs where org_id = $1 and id = $2', [orgId, r.id])
      else await c.query('insert into email_prefs (org_id, id, data, updated_by_command) values ($1, $2, $3, $4) on conflict (org_id, id) do update set data = excluded.data, updated_by_command = excluded.updated_by_command, updated_at = now()', [orgId, r.id, JSON.stringify(r.data), commandId])
      continue
    }
    const l = BY_TABLE.get(r.table)
    if (!l) continue
    if (r.data === null) await c.query(`delete from ${l.table} where org_id = $1 and id = $2`, [orgId, r.id])
    else {
      let sort = 0
      if (l.sorted) sort = (await c.query(`select sort from ${l.table} where org_id = $1 and id = $2`, [orgId, r.id])).rows[0]?.sort ?? 0
      await upsertRow(c, orgId, l, r.data, sort, commandId)
    }
  }
}
