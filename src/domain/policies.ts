// Command policies — the server's answer to "may this user run this action with these arguments?".
// Every engine action that a client may call is listed here; anything not listed is refused.
// A policy returns null to allow, or the reason it refuses. `sanitize` rewrites arguments a client could abuse
// (e.g. a draft that tries to set its own stage) before the engine sees them.
import type { Idea, User } from '../lib/types'
import { can } from '../lib/nav'
import { canSeeIdea } from '../lib/calc'
import type { DomainState } from './engine'
import { execRights, groupOfStage, ideaPerms, kanbanMove, ownerCandidates } from './permissions'

export interface PolicyCtx { me: User; state: DomainState; args: unknown[] }
type Check = (ctx: PolicyCtx) => string | null
export interface CommandPolicy { check: Check; sanitize?: (ctx: PolicyCtx) => unknown[] }

const hasRole = (u: User, ...roles: User['roles']) => u.roles.some((r) => roles.includes(r))
const OVERRIDE = (u: User) => hasRole(u, 'head', 'admin')

const ideaArg = (ctx: PolicyCtx): Idea | undefined => ctx.state.ideas.find((i) => i.id === ctx.args[0])
/** an idea command: the idea must exist and be visible to the caller, then `rule` decides */
const onIdea = (rule: (ctx: PolicyCtx, idea: Idea) => string | null): Check => (ctx) => {
  const idea = ideaArg(ctx)
  if (!idea || !canSeeIdea(ctx.me, idea)) return 'Idea not found'
  return rule(ctx, idea)
}
const perm = (key: keyof ReturnType<typeof ideaPerms>, what: string): Check =>
  onIdea((ctx, idea) => (ideaPerms(ctx.me, idea, ctx.state.users)[key] ? null : `You cannot ${what} on ${idea.id} at ${idea.stage}`))
const roles = (list: User['roles'], what: string): Check => (ctx) => (hasRole(ctx.me, ...list) ? null : `Only ${what} can do this`)
const never: Check = () => 'Not available from the app'

// fields a submitter may set on their own draft / submission — everything else is decided by the workflow
const DRAFT_FIELDS = ['plant', 'buyingType', 'categoryId', 'commodity', 'leverId', 'route', 'scope', 'scopeSupplierCode', 'campaignId', 'title', 'currentState',
  'proposedChange', 'evidence', 'evidenceTags', 'attachments', 'parts', 'proposedSupplier', 'savingsType', 'oneTimeInvestment', 'expectedQuarter', 'openEstimateLakh',
  'gainSharePct', 'offerValidity', 'supplierCode', 'buyerId', 'draftUnset'] as const
const cleanDraft = (me: User, state: DomainState, draft: unknown): Partial<Idea> => {
  const d = (draft && typeof draft === 'object' ? draft : {}) as Record<string, unknown>
  const out: Record<string, unknown> = Object.fromEntries(DRAFT_FIELDS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]))
  const supplier = me.roles.includes('supplier')
  out.isSupplierSubmission = supplier
  if (supplier) out.supplierCode = me.supplierCode
  // the buyer always follows the commodity master
  const com = state.commodities.find((c) => c.code === out.commodity)
  if (com) out.buyerId = com.buyerId; else delete out.buyerId
  if (typeof out.title === 'string') out.title = out.title.slice(0, 100)
  return out as Partial<Idea>
}
const ownDraft = (ctx: PolicyCtx, id: unknown) => {
  if (id == null) return null
  const i = ctx.state.ideas.find((x) => x.id === id)
  return !i || i.stage !== 'Draft' || i.submitterId !== ctx.me.id ? 'Draft not found' : null
}

export const POLICIES: Record<string, CommandPolicy> = {
  // ─── submission ───
  saveDraft: { check: (ctx) => (can(ctx.me, 'submit') ? ownDraft(ctx, ctx.args[1]) : 'Your role cannot submit ideas'), sanitize: (ctx) => [cleanDraft(ctx.me, ctx.state, ctx.args[0]), ctx.args[1] ?? undefined] },
  submitIdea: {
    check: (ctx) => {
      if (!can(ctx.me, 'submit')) return 'Your role cannot submit ideas'
      const d = (ctx.args[0] ?? {}) as Partial<Idea>
      if (!ctx.state.commodities.some((c) => c.code === d.commodity)) return 'Choose a commodity'
      if (!ctx.state.levers.some((l) => l.id === d.leverId && l.active !== false)) return 'Choose a cost-reduction lever'
      if (!String(d.title ?? '').trim()) return 'Give the idea a title'
      return ownDraft(ctx, ctx.args[1])
    },
    sanitize: (ctx) => [cleanDraft(ctx.me, ctx.state, ctx.args[0]), ctx.args[1] ?? undefined],
  },
  deleteDraft: { check: (ctx) => ownDraft(ctx, ctx.args[0]) ?? (ctx.args[0] == null ? 'Draft not found' : null) },

  // ─── stage 2–4 (IN) ───
  recordFeasibility: { check: perm('feasibilityCheck', 'record the team feasibility check') },
  saveEvaluation: { check: perm('evaluate', 'edit the evaluation') },
  sendSupplierCheck: { check: perm('evaluate', 'send a supplier capability request') },
  skipSupplierCheck: { check: perm('evaluate', 'skip the supplier check') },
  recordEvaluation: { check: perm('evaluate', 'decide the evaluation') },
  signLock: { check: perm('approve', 'sign the budget & timeline lock') },
  approve: { check: perm('approve', 'approve') },
  reject: { check: onIdea((ctx, i) => { const p = ideaPerms(ctx.me, i, ctx.state.users); return p.approve || p.evaluate || p.feasibilityCheck ? null : `You cannot reject ${i.id}` }) },
  sendBack: { check: perm('sendBack', 'send back') },
  requestInfo: { check: perm('requestInfo', 'request more information') },
  reassign: {
    check: onIdea((ctx, i) => {
      if (!ideaPerms(ctx.me, i, ctx.state.users).reassign) return `You cannot reassign ${i.id}`
      const to = ctx.state.users.find((u) => u.id === ctx.args[1] && u.active !== false)
      if (!to) return 'Choose an active person'
      const ok = i.bucket === 'Pipeline' ? to.roles.includes('buyer') && to.commodities.includes(i.commodity) : ownerCandidates(i, ctx.state.users).some((u) => u.id === to.id)
      return ok ? null : `${to.name} cannot take over ${i.id}`
    }),
  },
  moveToStage: {
    check: onIdea((ctx, i) => {
      const g = groupOfStage(String(ctx.args[1]))
      if (!g) return 'Unknown stage'
      const r = kanbanMove(ctx.me, i, g.key, ctx.state.users)
      return r.ok ? null : r.reason || 'Not allowed'
    }),
  },
  dropIdea: { check: perm('drop', 'drop the idea') },
  overrideBaseline: { check: perm('override', 'override the baseline') },
  addComment: { check: perm('comment', 'comment') },
  addAttachments: { check: perm('upload', 'add attachments') },
  // only one field is edited this way from the app: the change-over (CO) date in the Execution Hub
  updateIdea: {
    check: onIdea((ctx, i) => {
      const patch = (ctx.args[1] ?? {}) as Record<string, unknown>
      if (Object.keys(patch).some((k) => k !== 'coDate')) return 'Only the change-over date can be edited here'
      return execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot edit ${i.id}`
    }),
  },

  // ─── stage 5–6 (CO) ───
  updateExecution: {
    check: onIdea((ctx, i) => {
      const r = execRights(ctx.me, i, ctx.state.users)
      if (!r.editable) return `You cannot edit the execution of ${i.id}`
      const patch = (ctx.args[1] ?? {}) as { ownerId?: string }
      if (patch.ownerId && patch.ownerId !== i.execution?.ownerId && !(r.canReassign && ownerCandidates(i, ctx.state.users).some((u) => u.id === patch.ownerId))) return 'Only the department head can hand the execution to someone else'
      return null
    }),
  },
  toggleMilestone: { check: onIdea((ctx, i) => (execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot update milestones of ${i.id}`)) },
  addExecutionNote: { check: onIdea((ctx, i) => (execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot add notes to ${i.id}`)) },
  setMilestoneNote: { check: onIdea((ctx, i) => (execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot edit notes of ${i.id}`)) },
  handOverForVerification: { check: perm('handOver', 'hand over for verification') },
  verifyIdea: { check: perm('verify', 'verify') },
  returnToExecution: { check: perm('verify', 'return the idea to execution') },
  syncNpdPap: { check: perm('sync', 'update NPD / PAP status') },

  // ─── savings realisation & reports ───
  runRealisation: { check: roles(['finance', 'head', 'admin'], 'Finance, the Sourcing Head or Admin') },
  uploadMrn: { check: roles(['finance', 'head', 'admin'], 'Finance, the Sourcing Head or Admin') },
  financeValidate: { check: roles(['finance', 'head', 'admin'], 'Finance') },
  financeQuery: { check: roles(['finance', 'head', 'admin'], 'Finance') },
  sendMonthlyReport: { check: roles(['head', 'admin', 'mgmt', 'finance'], 'the Sourcing Head, Finance, Management or Admin') },
  bookFyClosure: { check: roles(['head', 'admin', 'finance'], 'the Sourcing Head, Finance or Admin') },

  // ─── campaigns & supplier outreach ───
  createCampaign: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can run campaigns') },
  updateCampaign: { check: (ctx) => (can(ctx.me, 'campaign') ? (ctx.state.campaigns.some((c) => c.id === ctx.args[0]) ? null : 'Campaign not found') : 'Only Sourcing can run campaigns') },
  launchCampaign: { check: (ctx) => (can(ctx.me, 'campaign') ? (ctx.state.campaigns.some((c) => c.id === ctx.args[0]) ? null : 'Campaign not found') : 'Only Sourcing can run campaigns') },
  inviteCampaignSuppliers: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can invite suppliers') },
  setAttendance: {
    check: (ctx) => {
      const c = ctx.state.campaigns.find((x) => x.id === ctx.args[0])
      if (!c) return 'Campaign not found'
      if (can(ctx.me, 'campaign')) return null
      return ctx.me.roles.includes('supplier') && ctx.me.supplierCode === ctx.args[1] && c.suppliers.includes(String(ctx.args[1])) ? null : 'You can only answer your own invitation'
    },
  },
  saveSupplierTemplate: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can edit supplier templates') },
  sendOutreach: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can email suppliers') },
  setSupplierResponseStatus: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can triage supplier responses') },
  syncSupplierPortal: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can sync the supplier portal') },

  // ─── personal ───
  markRead: { check: (ctx) => (ctx.state.notifications.some((n) => n.id === ctx.args[0] && n.userId === ctx.me.id) ? null : 'Notification not found') },
  markAllRead: { check: () => null },
  setEmailPrefs: { check: (ctx) => (ctx.args[0] === ctx.me.id || ctx.me.roles.includes('admin') ? null : 'You can only change your own email settings') },
  saveView: {
    check: () => null,
    // a shared view ('*') is for the Sourcing Head / Admin; everyone else saves their own
    sanitize: (ctx) => { const v = { ...(ctx.args[0] as Record<string, unknown>) }; if (!(v.userId === '*' && OVERRIDE(ctx.me))) v.userId = ctx.me.id; return [v] },
  },
  deleteView: { check: (ctx) => { const v = ctx.state.savedViews.find((x) => x.id === ctx.args[0]); return !v ? 'View not found' : v.userId === ctx.me.id || OVERRIDE(ctx.me) ? null : 'You can only delete your own views' } },

  // ─── administration ───
  upsert: { check: roles(['admin'], 'Admin') },
  remove: { check: roles(['admin'], 'Admin') },
  setList: { check: roles(['admin'], 'Admin') },
  updateSettings: { check: roles(['admin'], 'Admin') },
  setBuyerTarget: { check: roles(['admin', 'head'], 'Admin or the Sourcing Head') },
  setPlantTarget: { check: roles(['admin', 'head'], 'Admin or the Sourcing Head') },
  importData: { check: roles(['admin'], 'Admin') },
  resetDemo: { check: roles(['admin'], 'Admin') },

  // internal steps — the engine calls them itself; clients use the stage forms instead
  advance: { check: never },
  notify: { check: never },
  respondSupplierCheck: { check: () => 'Suppliers answer through the emailed form link' },
}

export const COMMAND_NAMES = Object.keys(POLICIES)

/** Run the policy for a command: { ok, reason } with the arguments the engine should receive */
export function authorise(name: string, ctx: PolicyCtx): { ok: true; args: unknown[] } | { ok: false; reason: string } {
  const p = POLICIES[name]
  if (!p) return { ok: false, reason: `Unknown action ${name}` }
  const reason = p.check(ctx)
  if (reason) return { ok: false, reason }
  return { ok: true, args: p.sanitize ? p.sanitize(ctx) : ctx.args }
}
