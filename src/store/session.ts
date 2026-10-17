// Sign-in per tab, data shared: the demo data lives in localStorage (one copy for every tab of this browser), while who is
// signed in, the workspace and the filters live in this tab's sessionStorage — so two tabs can be two different people
// without one switching the other. A new tab starts as the last person signed in on this browser.
// A tab running an older build reloads itself when a newer build opens in another tab, so no tab keeps writing data in
// an older shape.

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const SESSION_KEY = 'coin-session'
export const LAST_SESSION_KEY = 'coin-last-session'
export const BUILD_KEY = 'coin-build'
/** state that belongs to one tab, never to the shared data */
export const SESSION_FIELDS = ['userId', 'space', 'filters', 'lastActivity'] as const
const UI_ONLY = ['drawerIdeaId', 'searchOpen', 'celebrate', 'toasts']

export interface TabSession { userId: string | null; space: 'IN' | 'CO' | null; filters: unknown; lastActivity: number }

const parse = (s: string | null) => { try { return s ? JSON.parse(s) : null } catch { return null } }

/** This tab's sign-in; a new tab takes the last one used on this browser */
export function readSession(tab: KV | null, shared: KV | null): TabSession {
  const own = parse(tab?.getItem(SESSION_KEY) ?? null)
  const s = own ?? parse(shared?.getItem(LAST_SESSION_KEY) ?? null) ?? {}
  return { userId: s.userId ?? null, space: s.space ?? null, filters: s.filters ?? null, lastActivity: s.lastActivity ?? Date.now() }
}

export function writeSession(tab: KV | null, shared: KV | null, s: TabSession) {
  try {
    if (!s.userId) { tab?.removeItem(SESSION_KEY); shared?.removeItem(LAST_SESSION_KEY); return }
    const v = JSON.stringify(s)
    tab?.setItem(SESSION_KEY, v)
    shared?.setItem(LAST_SESSION_KEY, v)
  } catch { /* storage blocked — the tab keeps working in memory */ }
}

/** What goes into the shared data: everything but this tab's session, UI-only state and functions */
export function persistedPart<T extends Record<string, unknown>>(s: T): Partial<T> {
  return Object.fromEntries(Object.entries(s).filter(([k, v]) => typeof v !== 'function' && !(SESSION_FIELDS as readonly string[]).includes(k) && !UI_ONLY.includes(k))) as Partial<T>
}

/** Shared data over the current state: never this tab's session; arrays replace, objects merge, wrong shapes are ignored */
export function mergePersisted<T extends object>(persisted: unknown, current: T): T {
  const p = (persisted ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = { ...(current as unknown as Record<string, unknown>) }
  for (const [k, v] of Object.entries(p)) {
    const cur = (current as unknown as Record<string, unknown>)[k]
    if ((SESSION_FIELDS as readonly string[]).includes(k) || typeof cur === 'function' || v === undefined) continue
    if (Array.isArray(cur)) { if (Array.isArray(v)) out[k] = v; continue }
    if (cur && typeof cur === 'object') { if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(cur as object), ...(v as object) }; continue }
    out[k] = v
  }
  return out as unknown as T
}

/** A tab reloads only for a strictly newer build */
export const isNewerBuild = (theirs: string | null, mine: string) => !!theirs && Number(theirs) > Number(mine)
