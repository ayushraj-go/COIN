// api mode — the store talks to the COIN API server instead of running the engine in the browser.
//   • sign-in: /api/auth/* (httpOnly session cookie); the persona picker only when the server allows demo sign-in
//   • data: /api/bootstrap holds exactly what this user may see; /api/version is polled to pick up other people's work
//   • every data-changing action is a command (/api/commands/<name>), sent in order, answered with the changes
//   • undo: /api/undo for the commands issued since beginUndo()
import type { StoreApi } from 'zustand'
import { DATA_KEYS, type DomainData } from '../domain/engine'
import { COMMAND_NAMES } from '../domain/policies'
import { recordId } from '../domain/visibility'
import { uid } from '../lib/format'
import type { User } from '../lib/types'

export const API_MODE = (import.meta.env?.VITE_DATA_MODE as string | undefined) === 'api'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function call<T = Record<string, unknown>>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(url, { method, credentials: 'same-origin', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, 'Cannot reach the COIN server — check your connection')
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new ApiError(r.status, String(j.error ?? r.statusText))
  return j as T
}

// errors from commands are shown as toasts here; the rejected promise then stops the screen's own flow
// (no success toast, no navigation) — the browser must not report it as an uncaught error
if (API_MODE && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => { if (e.reason instanceof ApiError) e.preventDefault() })
}

type Get = () => Record<string, any>
type Set = (p: Record<string, unknown> | ((s: Record<string, any>) => Record<string, unknown>)) => void
type Changes = Record<string, { upsert?: Record<string, unknown>[]; remove?: string[]; value?: unknown }>

export interface PublicConfig { demoLogin: boolean; orgName: string; emailDriver: string; stats?: { implemented: number; inNetwork: number; suppliers: number } }

export function remoteStore(setRaw: StoreApi<unknown>['setState'], getRaw: StoreApi<unknown>['getState']): Record<string, unknown> {
  const set = setRaw as unknown as Set
  const get = getRaw as unknown as Get
  let queue: Promise<unknown> = Promise.resolve()
  let pending = 0
  /** command ids sent from this tab, in order (undo takes the ones after a mark) */
  const issued: string[] = []

  const emptyLists = () => Object.fromEntries(DATA_KEYS.filter((k) => Array.isArray(get()[k])).map((k) => [k, []]))

  const applyChanges = (changes: Changes, version: number) => set((s) => {
    const out: Record<string, unknown> = { dataVersion: Math.max(s.dataVersion ?? 0, version) }
    for (const [key, ch] of Object.entries(changes ?? {})) {
      if ('value' in ch) { out[key] = ch.value; continue }
      const list = (s[key] ?? []) as Record<string, unknown>[]
      const drop = new Set(ch.remove ?? [])
      const up = new Map((ch.upsert ?? []).map((x) => [recordId(key, x), x]))
      const kept = list.filter((x) => !drop.has(recordId(key, x))).map((x) => { const id = recordId(key, x); const n = up.get(id); if (n) up.delete(id); return n ?? x })
      out[key] = [...up.values(), ...kept]
    }
    return out
  })

  const refresh = async () => {
    const b = await call<{ version: number; userId: string; data: DomainData }>('GET', '/api/bootstrap')
    set({ ...b.data, userId: b.userId, dataVersion: b.version })
  }

  const fail = (e: unknown) => {
    const err = e instanceof ApiError ? e : new ApiError(0, (e as Error)?.message ?? 'Something went wrong')
    if (err.status === 401) { set({ userId: null, ...emptyLists() }); get().toast('Your session has ended — please sign in again', 'warning') }
    else get().toast(err.message, err.status === 409 || err.status === 403 ? 'warning' : 'error')
    return err
  }

  /** commands are sent one after another, so the server sees them in the order the screens issued them */
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    pending++
    const p = queue.then(fn)
    queue = p.catch(() => undefined).finally(() => { pending-- })
    return p
  }

  const command = (name: string) => (...args: unknown[]) => {
    const commandId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : uid('cmd') + uid('x')
    issued.push(commandId)
    return enqueue(() => call<{ result: unknown; version: number; changes: Changes }>('POST', `/api/commands/${name}`, { args, commandId }))
      .then((r) => { applyChanges(r.changes, r.version); return r.result })
      .catch((e) => { throw fail(e) })
  }

  // other people's work: poll the version; reload when it moved and nothing of ours is in flight
  if (typeof window !== 'undefined') {
    const poll = async () => {
      if (!get().userId || pending || document.visibilityState !== 'visible') return
      try {
        const { version } = await call<{ version: number }>('GET', '/api/version')
        if (version > (get().dataVersion ?? 0) && !pending) await refresh()
      } catch (e) { if (e instanceof ApiError && e.status === 401) fail(e) }
    }
    window.setInterval(poll, 5000)
    window.addEventListener('focus', () => void poll())
  }

  const afterSignIn = async () => {
    await refresh()
    const fy = get().settings?.currentFy
    set({ lastActivity: Date.now(), drawerIdeaId: null, space: null, ...(fy ? { filters: { ...get().filters, fy } } : {}) })
  }

  // session check and public config on start-up
  const init = async () => {
    try {
      const cfg = await call<PublicConfig>('GET', '/api/config')
      set({ publicConfig: cfg })
      if (cfg.demoLogin) {
        const { accounts } = await call<{ accounts: Partial<User>[] }>('GET', '/api/auth/demo-accounts')
        // the persona picker reads the user list before sign-in; nothing else is loaded until then
        if (!get().userId) set({ users: accounts.map((a) => ({ commodities: [], employeeId: '', email: '', plant: '', active: true, ...a })) })
      }
    } catch { /* server unreachable — the login page says so */ }
    try {
      await call('GET', '/api/auth/me')
      await refresh()
    } catch { set({ userId: null }) }
    set({ authReady: true })
  }
  if (typeof window !== 'undefined') queueMicrotask(() => void init())

  const commands = Object.fromEntries(COMMAND_NAMES.map((n) => [n, command(n)]))

  return {
    ...commands,
    publicConfig: null,
    login: async (login: string, password: string) => {
      try {
        await call('POST', '/api/auth/login', { login, password })
        await afterSignIn()
        return true
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 400)) return false
        fail(e)
        return false
      }
    },
    loginAs: async (userId: string) => {
      try { await call('POST', '/api/auth/demo-login', { userId }); await afterSignIn() } catch (e) { fail(e) }
    },
    logout: () => {
      void call('POST', '/api/auth/logout').catch(() => undefined)
      set({ userId: null, drawerIdeaId: null, space: null, ...emptyLists() })
      void init()
    },
    respondSupplierCheck: async (token: string, r: Record<string, unknown>) => {
      try { const out = await call<{ ok: boolean }>('POST', `/api/public/supplier-check/${encodeURIComponent(token)}`, r); return out.ok } catch { return false }
    },
    resetDemo: () => { void command('resetDemo')().then(refresh).catch(() => undefined) },
    importData: (patch: unknown) => { void command('importData')(patch).then(refresh).catch(() => undefined) },
    beginUndo: () => {
      const mark = issued.length
      return () => {
        const ids = issued.slice(mark)
        if (!ids.length) return
        void enqueue(() => call('POST', '/api/undo', { commandIds: ids }))
          .then(refresh)
          .then(() => get().toast('Undone', 'info'))
          .catch(fail)
      }
    },
    refreshData: refresh,
  }
}

/** Change the signed-in person's own password */
export const changeOwnPassword = (current: string, next: string) => call('POST', '/api/auth/password', { current, next })

/** Public endpoints for the supplier capability form (no session) */
export const publicSupplierCheck = (token: string) => call<{ supplierName: string; contactName: string; item: string; spec: string; requiredBy: string; status: string; response?: { contactName: string; respondedAt: string } }>('GET', `/api/public/supplier-check/${encodeURIComponent(token)}`)
