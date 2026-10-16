// The app store: UI state (session, filters, workspace, toasts) + the organisation's data.
// Data changes go through the workflow engine (src/domain/engine.ts):
//   local mode (VITE_DATA_MODE unset — the Vercel demo): the engine runs here and the data lives in localStorage;
//   api mode   (VITE_DATA_MODE=api): every change is a command to the COIN API server, which runs the same engine,
//              checks the role ladder and returns only what this user may see (see ./remote.ts).
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Filters, RoleKey, User } from '../lib/types'
import { LAKH } from '../lib/masters'
import { DATA_KEYS, configureSupplierPortal, domainActions, freshData, type DomainActions, type DomainData } from '../domain/engine'
import { uid } from '../lib/format'
import { API_MODE, remoteStore } from './remote'

export { commodityShort, supplierPortalLink, outreachRecipients, supplierTemplateVars, renderSupplierTemplate } from '../domain/engine'

configureSupplierPortal(import.meta.env?.VITE_SUPPLIER_PORTAL_URL as string | undefined)

export interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; undo?: () => void; at: number }

/** Default filter bar: the organisation's current FY, everything else open */
export const defaultFilters = (fy: string): Filters => ({ fy, quarter: 'All', plant: 'All', categoryId: 'All', commodity: 'All', buyerId: 'All', leverId: 'All', buyingType: 'All' })

interface UiState {
  // session
  userId: string | null
  lastActivity: number
  /** api mode: the session check on page load has finished (local mode: always true) */
  authReady: boolean
  /** api mode: the server's data version this copy reflects */
  dataVersion: number
  // ui
  filters: Filters
  navCollapsed: boolean
  /** Workspace chosen on the entry screen after login: null = chooser, 'IN' = Innovation Network (ideas), 'CO' = Cost Optimisation (implementation) */
  space: 'IN' | 'CO' | null
  /** table density chosen on this device (overrides the organisation default in settings) */
  densityPref: 'compact' | 'comfortable' | null
  drawerIdeaId: string | null
  searchOpen: boolean
  celebrate: number
  toasts: Toast[]
}

interface UiActions {
  login: (emailOrId: string, password: string) => Promise<boolean>
  loginAs: (userId: string) => Promise<void>
  logout: () => void
  touch: () => void
  setFilters: (f: Partial<Filters>) => void
  resetFilters: () => void
  toggleNav: () => void
  setSpace: (s: 'IN' | 'CO' | null) => void
  setDensity: (d: 'compact' | 'comfortable') => void
  openIdea: (id: string | null) => void
  setSearchOpen: (v: boolean) => void
  toast: (message: string, type?: Toast['type'], undo?: () => void) => void
  dismissToast: (id: string) => void
  /** Mark the start of an undoable change; the returned function puts the data back (api mode: server-side undo) */
  beginUndo: () => () => void
}

// Actions that return a value are async, so the same screens work in local and api mode
type AsyncKeys = 'saveDraft' | 'submitIdea' | 'approve' | 'sendSupplierCheck' | 'respondSupplierCheck' | 'createCampaign' | 'sendOutreach' | 'runRealisation' | 'uploadMrn' | 'saveSupplierTemplate'
export const ASYNC_ACTIONS: AsyncKeys[] = ['saveDraft', 'submitIdea', 'approve', 'sendSupplierCheck', 'respondSupplierCheck', 'createCampaign', 'sendOutreach', 'runRealisation', 'uploadMrn', 'saveSupplierTemplate']
type Asyncify<F> = F extends (...a: infer A) => infer R ? (...a: A) => Promise<R> : never
export type StoreDomainActions = Omit<DomainActions, AsyncKeys> & { [K in AsyncKeys]: Asyncify<DomainActions[K]> }

export type Store = DomainData & UiState & UiActions & StoreDomainActions

/** localStorage that never throws: on quota errors it drops the e-mail / notification logs (demo-only history) and retries */
const safeStorage: Storage = {
  get length() { try { return localStorage.length } catch { return 0 } },
  key: (i) => { try { return localStorage.key(i) } catch { return null } },
  clear: () => { try { localStorage.clear() } catch { /* ignore */ } },
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v) } catch {
      try {
        const o = JSON.parse(v)
        if (o?.state) { o.state.emails = (o.state.emails ?? []).slice(0, 50); o.state.notifications = (o.state.notifications ?? []).slice(0, 50) }
        localStorage.setItem(k, JSON.stringify(o))
      } catch { /* storage full or blocked — keep working in memory */ }
    }
  },
}
// Earlier builds stored data under older keys; clear them so the demo always starts from the current data model
try { ['coin-cost-innovation-hub-v1', 'coin-cost-innovation-hub-v2', 'coin-cost-innovation-hub-v3', 'coin-cost-innovation-hub-v4', 'coin-cost-innovation-hub-v5', 'coin-cost-innovation-hub-v6', 'coin-cost-innovation-hub-v7'].forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }

/** Empty organisation data (api mode before sign-in — nothing is shown until the server sends it) */
const emptyData = (): DomainData => {
  const f = freshData()
  return { ...f, users: [], ideas: [], campaigns: [], ledger: [], notifications: [], emails: [], savedViews: [], emailPrefs: {}, fyClosed: {}, outreachBatches: [], supplierResponses: [], suppliers: [], parts: [] }
}

const STORE_KEY = API_MODE ? 'coin-api-ui-v1' : 'coin-cost-innovation-hub-v8'

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const ui: UiState & UiActions = {
        userId: null,
        lastActivity: Date.now(),
        authReady: !API_MODE,
        dataVersion: 0,
        filters: defaultFilters(freshData().settings.currentFy),
        navCollapsed: false,
        space: null,
        densityPref: null,
        drawerIdeaId: null,
        searchOpen: false,
        celebrate: 0,
        toasts: [],

        login: async (emailOrId, password) => {
          const k = emailOrId.trim().toLowerCase()
          const u = get().users.find((x) => x.active && (x.email.toLowerCase() === k || x.employeeId.toLowerCase() === k || x.id === k))
          if (!u || u.password !== password) return false
          set({ userId: u.id, lastActivity: Date.now(), filters: defaultFilters(get().settings.currentFy), space: null })
          return true
        },
        loginAs: async (userId) => { set({ userId, lastActivity: Date.now(), filters: defaultFilters(get().settings.currentFy), drawerIdeaId: null, space: null }) },
        logout: () => set({ userId: null, drawerIdeaId: null, space: null }),
        touch: () => set({ lastActivity: Date.now() }),
        setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
        resetFilters: () => set({ filters: defaultFilters(get().settings.currentFy) }),
        toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
        setSpace: (space) => set({ space }),
        setDensity: (d) => set({ densityPref: d }),
        openIdea: (id) => set({ drawerIdeaId: id }),
        setSearchOpen: (v) => set({ searchOpen: v }),
        toast: (message, type = 'success', undo) => {
          const id = uid('t')
          set((s) => ({ toasts: [...s.toasts, { id, message, type, undo, at: Date.now() }] }))
          setTimeout(() => get().dismissToast(id), undo ? 5000 : 3800)
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        beginUndo: () => {
          // local mode: one user, one browser — putting every data set back is exact
          const snap = Object.fromEntries(DATA_KEYS.map((k) => [k, get()[k]]))
          return () => set(snap as Partial<Store>)
        },
      }

      if (API_MODE) return { ...ui, ...emptyData(), ...remoteStore(set, get) } as Store

      const engine = domainActions(set as never, get as never, {
        warn: (m) => get().toast(m, 'warning'),
        celebrate: () => set((s) => ({ celebrate: s.celebrate + 1 })),
        appUrl: () => (typeof window !== 'undefined' ? window.location.origin : ''),
      })
      const asyncified = Object.fromEntries(ASYNC_ACTIONS.map((k) => [k, (...a: unknown[]) => Promise.resolve((engine[k] as (...x: unknown[]) => unknown)(...a))]))
      return {
        ...ui,
        ...freshData(),
        ...engine,
        ...asyncified,
        resetDemo: () => { engine.resetDemo(); set({ filters: defaultFilters(get().settings.currentFy), drawerIdeaId: null }) },
      } as unknown as Store
    },
    {
      name: STORE_KEY,
      version: 7,
      storage: createJSONStorage(() => safeStorage),
      // Saved data from an older build may miss newer fields: start from the fresh seed and overlay what was saved,
      // so a demo never crashes on a missing list or setting. Anything that is not an array/object of the right shape is ignored.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        const out: Record<string, unknown> = { ...current }
        for (const [k, v] of Object.entries(p)) {
          const cur = (current as unknown as Record<string, unknown>)[k]
          if (typeof cur === 'function' || v === undefined) continue
          if (Array.isArray(cur)) { if (Array.isArray(v)) out[k] = v; continue }
          if (cur && typeof cur === 'object') { if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(cur as object), ...(v as object) }; continue }
          out[k] = v
        }
        return out as unknown as Store
      },
      partialize: (s) => {
        // api mode keeps only this device's UI preferences; the data and the session live on the server
        if (API_MODE) return { navCollapsed: s.navCollapsed, densityPref: s.densityPref, space: s.space, filters: s.filters } as never
        const { toasts, drawerIdeaId, searchOpen, celebrate, authReady, dataVersion, ...rest } = s as unknown as Record<string, unknown>
        void toasts; void drawerIdeaId; void searchOpen; void celebrate; void authReady; void dataVersion
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as never
      },
    },
  ),
)

// ─── Selectors / hooks ────────────────────────────────────────────────────────
export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.userId) ?? null)
export const hasRole = (u: User | null, ...roles: RoleKey[]) => !!u && u.roles.some((r) => roles.includes(r))
export const userName = (id?: string) => useStore.getState().users.find((u) => u.id === id)?.name ?? '—'
export const LAKH_ = LAKH

// Keep several open tabs in step (local mode): when another tab saves, reload the saved state here instead of overwriting it later
if (typeof window !== 'undefined' && !API_MODE) {
  window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) void useStore.persist.rehydrate() })
}
