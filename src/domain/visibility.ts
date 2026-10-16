// What a signed-in user may receive from the server. The API never sends a record this module filters out,
// so a role cannot read another department's ideas (or a supplier another vendor's prices) even from the raw payload.
import type { User } from '../lib/types'
import { canSeeIdea } from '../lib/calc'
import { can } from '../lib/nav'
import { DATA_KEYS, type DomainData, type DomainState } from './engine'
import { ideaPerms } from './permissions'

type Key = (typeof DATA_KEYS)[number]
type Rec = Record<string, unknown>

const hasRole = (u: User, ...roles: User['roles']) => u.roles.some((r) => roles.includes(r))
const isSupplier = (u: User) => u.roles.includes('supplier')
/** who reads the whole email log: Sourcing leadership and the commodity teams that run campaigns */
const readsAllMail = (u: User) => hasRole(u, 'head', 'admin', 'mgmt', 'lead', 'buyer')

/** a user record without the password; suppliers only learn names and roles of Amber people */
export function scrubUser(viewer: User, u: User): User {
  const { password: _pw, ...rest } = u as User & { password?: string }
  void _pw
  if (!isSupplier(viewer) || u.id === viewer.id) return rest as User
  return { id: u.id, name: u.name, roles: u.roles, department: u.department, designation: u.designation, avatarColor: u.avatarColor, active: u.active, plant: u.plant, commodities: [], employeeId: '', email: '' } as unknown as User
}

/** An idea this user may receive: the role rules, and a draft only for the person writing it */
const ideaVisible = (me: User, i: { stage?: string; submitterId?: string }) => canSeeIdea(me, i as never) && (i.stage !== 'Draft' || i.submitterId === me.id)
/** Ideas this user may see, as a set of ids (used for ledger rows and idea-related emails) */
const visibleIdeaIds = (me: User, s: DomainData) => new Set(s.ideas.filter((i) => ideaVisible(me, i)).map((i) => i.id))

/**
 * Supplier-form tokens are keys: only the side that evaluates the idea (its department lead, or override users)
 * receives them — never the submitter or other colleagues, who could otherwise answer as the supplier.
 */
function tokenRules(me: User, s: DomainData) {
  let allowed: Set<string> | null = null
  const ok = () => (allowed ??= new Set(s.ideas.filter((i) => i.evaluation?.supplier?.token && (hasRole(me, 'head', 'admin') || ideaPerms(me, i, s.users).evaluate)).map((i) => i.evaluation!.supplier!.token!)))
  return {
    idea: (i: Rec): Rec => {
      const sc = (i.evaluation as Rec | undefined)?.supplier as Rec | undefined
      if (!sc?.token || ok().has(String(sc.token))) return i
      const { token: _t, ...rest } = sc
      void _t
      return { ...i, evaluation: { ...(i.evaluation as Rec), supplier: rest } }
    },
    email: (e: Rec): Rec => {
      const body = String(e.body ?? '')
      if (!body.includes('/supplier-form/')) return e
      return { ...e, body: body.replace(/\/supplier-form\/([0-9a-z-]+)/gi, (m, t: string) => (ok().has(t) ? m : '/supplier-form/••••')) }
    },
  }
}

/** The shape of one record for this viewer (passwords, keys and competitors' details removed) */
function shape(me: User, key: Key, item: Rec, tokens: ReturnType<typeof tokenRules>): Rec {
  switch (key) {
    case 'users': return scrubUser(me, item as unknown as User) as unknown as Rec
    case 'ideas': return tokens.idea(item)
    case 'emails': return tokens.email(item)
    case 'campaigns': {
      if (!isSupplier(me)) return item
      // a supplier sees its own invitation — not who else was invited, their answers or Amber's targets
      const code = me.supplierCode ?? ''
      const att = (item.attendance as Record<string, unknown>) ?? {}
      const { targetValue: _v, targetIdeas: _n, internalInvitees: _i, ...rest } = item
      void _v; void _n; void _i
      return { ...rest, suppliers: [code], attendance: code in att ? { [code]: att[code] } : {}, internalInvitees: [] }
    }
    case 'commodities': {
      if (!isSupplier(me)) return item
      const { target: _t, addressableSpend: _a, ...rest } = item
      void _t; void _a
      return rest
    }
    default: return item
  }
}

/** Is one record of a collection visible to the user? */
function recordVisible(me: User, key: Key, item: Rec, s: DomainData, ideaIds: () => Set<string>): boolean {
  switch (key) {
    case 'ideas': return ideaVisible(me, item)
    case 'ledger': return ideaIds().has(String(item.ideaId))
    case 'notifications': return item.userId === me.id
    case 'emails': {
      if (readsAllMail(me)) return true
      const to = (item.to as string[]) ?? []
      if (to.some((a) => a.toLowerCase() === me.email.toLowerCase())) return true
      if (isSupplier(me)) { const sup = s.suppliers.find((x) => x.code === me.supplierCode); return !!sup && to.includes(sup.contactEmail) }
      const text = `${item.subject ?? ''} ${item.body ?? ''}`
      for (const id of ideaIds()) if (text.includes(id)) return true
      return false
    }
    case 'savedViews': return item.userId === me.id || item.userId === '*'
    case 'suppliers': return !isSupplier(me) || item.code === me.supplierCode
    case 'parts': return !isSupplier(me) || item.supplierCode === me.supplierCode
    case 'campaigns': return !isSupplier(me) || ((item.suppliers as string[]) ?? []).includes(me.supplierCode ?? '')
    case 'outreachBatches': case 'supplierResponses': case 'supplierTemplates': return can(me, 'campaign')
    case 'emailTemplates': return !isSupplier(me)
    default: return true
  }
}

/** Non-list data (settings, targets, preferences) as this user may see it */
function scopedValue(me: User, key: Key, value: unknown): unknown {
  switch (key) {
    case 'emailPrefs': { const v = value as Record<string, unknown>; return me.id in (v ?? {}) ? { [me.id]: v[me.id] } : {} }
    case 'buyerTargets': case 'plantTargets': return isSupplier(me) ? {} : value
    case 'settings': return isSupplier(me) ? { ...(value as Rec), mailerRecipients: [] } : value
    default: return value
  }
}

/** The key of a record in its collection (masters use code / stage) */
export const recordId = (key: string, item: Rec) => String(key === 'suppliers' || key === 'commodities' || key === 'parts' ? item.code : key === 'slaRules' ? item.stage : item.id)
const idOf = recordId

/** The whole organisation as one user may see it — the /api/bootstrap payload */
export function visibleData(me: User, s: DomainData): DomainData {
  let ids: Set<string> | null = null
  const ideaIds = () => (ids ??= visibleIdeaIds(me, s))
  const tokens = tokenRules(me, s)
  const out: Record<string, unknown> = {}
  for (const key of DATA_KEYS) {
    const v = s[key] as unknown
    if (Array.isArray(v)) {
      const list = (v as Rec[]).filter((x) => typeof x !== 'object' || recordVisible(me, key, x, s, ideaIds))
      out[key] = list.map((x) => (typeof x === 'object' ? shape(me, key, x, tokens) : x))
    } else out[key] = scopedValue(me, key, v)
  }
  return out as unknown as DomainData
}

export type Delta = Partial<Record<Key, { upsert: Rec[]; remove: string[] } | { value: unknown }>> & Record<string, unknown>

/** What changed between two states, limited to what the user may see (the command response) */
export function visibleDelta(me: User, before: DomainState, after: DomainState): Delta {
  let idsAfter: Set<string> | null = null
  const ideaIds = () => (idsAfter ??= visibleIdeaIds(me, after))
  const tokens = tokenRules(me, after)
  const out: Delta = {}
  for (const key of DATA_KEYS) {
    const a = after[key] as unknown, b = before[key] as unknown
    if (a === b) continue
    if (Array.isArray(a) && Array.isArray(b)) {
      if (b.length && typeof b[0] !== 'object') { out[key] = { value: a }; continue } // string lists (departments, drop reasons)
      const prev = new Map((b as Rec[]).map((x) => [idOf(key, x), x]))
      const now = new Set<string>()
      const upsert: Rec[] = [], remove: string[] = []
      for (const x of a as Rec[]) {
        const id = idOf(key, x)
        now.add(id)
        if (prev.get(id) === x) continue
        if (recordVisible(me, key, x, after, ideaIds)) upsert.push(shape(me, key, x, tokens))
        else if (prev.has(id)) remove.push(id)
      }
      for (const id of prev.keys()) if (!now.has(id)) remove.push(id)
      if (upsert.length || remove.length) out[key] = { upsert, remove }
    } else out[key] = { value: scopedValue(me, key, a) }
  }
  return out
}
