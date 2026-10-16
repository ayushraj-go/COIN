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
/**
 * `scope` = the only record the command may change (the server verifies it after running the engine):
 * 'idea' → only the idea in args[0]; 'campaign' → only the campaign in args[0].
 */
export interface CommandPolicy { check: Check; sanitize?: (ctx: PolicyCtx) => unknown[]; scope?: 'idea' | 'campaign' }

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
/** keep only the listed keys (whitelist) */
const pick = (v: unknown, keys: readonly string[]): Obj => { const o = obj(v); return Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) }
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : undefined)

const NPD = ['Not raised', 'ECN raised', 'Sample submitted', 'Sample approved', 'Sample failed']
const PAP = ['Not raised', 'Raised', 'Price approved', 'Rejected']
const FILE_URL = /^\/api\/files\/[0-9a-f-]{36}$/
/**
 * Attachments a client may add: an embedded file (data: URL — the server stores it) or a link to a file the server
 * already stores. Anything else (javascript:, external links) is dropped; "by" is always the signed-in person.
 */
export function cleanAttachments(me: User, list: unknown): unknown[] {
  if (!Array.isArray(list)) return []
  return list.slice(0, 10).flatMap((a) => {
    const o = obj(a)
    const dataUrl = typeof o.dataUrl === 'string' && /^data:[\w.+-]+\/[\w.+-]+(;[\w=.+-]+)*(;base64)?,/.test(o.dataUrl) ? o.dataUrl : undefined
    const url = typeof o.url === 'string' && FILE_URL.test(o.url) ? o.url : undefined
    if (!dataUrl && !url) return []
    return [{ id: str(o.id, 80) ?? `att-${Math.random().toString(36).slice(2, 10)}`, name: str(o.name, 200) ?? 'file', size: Number(o.size) || 0, type: str(o.type, 100) ?? 'application/octet-stream',
      ...(dataUrl ? { dataUrl } : { url }), uploadedAt: str(o.uploadedAt, 40) ?? new Date().toISOString(), by: me.name }]
  })
}
const SETTING_RULES: Record<string, (v: unknown) => boolean> = {
  financeValidation: (v) => typeof v === 'boolean',
  xThresholdLakh: (v) => typeof v === 'number' && v > 0 && v < 1e6,
  yThresholdLakh: (v) => typeof v === 'number' && v > 0 && v < 1e6,
  fyStartMonth: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12,
  currentFy: (v) => typeof v === 'string' && /^FY\d{2}$/.test(v),
  reapprovalPct: (v) => typeof v === 'number' && v >= 0 && v <= 100,
  sessionTimeoutMin: (v) => Number.isInteger(v) && (v as number) >= 5 && (v as number) <= 240,
  mailerRecipients: (v) => Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === 'string' && /^[^\s@]+@[^\s@]+$/.test(x)),
  leaderboardVisible: (v) => typeof v === 'boolean',
  density: (v) => v === 'compact' || v === 'comfortable',
  lastRealisationMonth: (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v),
}
/** data sets a backup may restore — never per-person data (notifications, preferences, views), the outbox or accounts */
export const IMPORTABLE = ['levers', 'categories', 'commodities', 'plants', 'departments', 'suppliers', 'parts', 'dropReasons', 'slaRules', 'approvalRules', 'emailTemplates', 'settings', 'buyerTargets', 'plantTargets', 'ideas', 'campaigns', 'ledger', 'fyClosed', 'supplierTemplates', 'outreachBatches', 'supplierResponses']

const hasRole = (u: User, ...roles: User['roles']) => u.roles.some((r) => roles.includes(r))
/** master lists Admin may edit through upsert / remove */
const MASTER_KEYS = ['levers', 'categories', 'commodities', 'plants', 'users', 'suppliers', 'parts', 'emailTemplates', 'approvalRules', 'slaRules']
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
  if (out.attachments !== undefined) out.attachments = cleanAttachments(me, out.attachments)
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
  recordFeasibility: {
    scope: 'idea',
    check: (ctx) => perm('feasibilityCheck', 'record the team feasibility check')(ctx) ?? (['Go', 'No-go'].includes(String(obj(ctx.args[1]).decision)) ? null : 'Decide Go or No-go'),
    sanitize: (ctx) => [ctx.args[0], pick(ctx.args[1], ['technical', 'technicalNote', 'cost', 'costNote', 'conflict', 'conflictWith', 'conflictNote', 'decision', 'departments', 'remarks'])],
  },
  saveEvaluation: { scope: 'idea', check: perm('evaluate', 'edit the evaluation'), sanitize: (ctx) => [ctx.args[0], pick(ctx.args[1], ['cbaVerified', 'cbaNote', 'risks', 'riskRemarks'])] },
  sendSupplierCheck: {
    scope: 'idea',
    check: perm('evaluate', 'send a supplier capability request'),
    sanitize: (ctx) => [ctx.args[0], Object.fromEntries(['supplierCode', 'supplierName', 'contactName', 'email', 'item', 'spec', 'requiredBy', 'subject', 'body'].map((k) => [k, str(obj(ctx.args[1])[k], 5000)]).filter(([, v]) => v !== undefined))],
  },
  skipSupplierCheck: { scope: 'idea', check: perm('evaluate', 'skip the supplier check') },
  recordEvaluation: { scope: 'idea', check: (ctx) => perm('evaluate', 'decide the evaluation')(ctx) ?? (['Recommend', 'Reject'].includes(String(ctx.args[1])) ? null : 'Recommend or reject') },
  signLock: {
    scope: 'idea',
    check: perm('approve', 'sign the budget & timeline lock'),
    sanitize: (ctx) => {
      const l = pick(ctx.args[1], ['commercialOk', 'supplierAligned', 'budget', 'timelineMonths', 'startDate', 'endDate', 'targetSaving', 'signatureName', 'signatureData'])
      if (typeof l.signatureData === 'string' && !/^data:image\/(png|jpeg|webp);base64,/.test(l.signatureData)) delete l.signatureData
      return [ctx.args[0], l]
    },
  },
  approve: { scope: 'idea', check: perm('approve', 'approve') },
  reject: { scope: 'idea', check: onIdea((ctx, i) => { const p = ideaPerms(ctx.me, i, ctx.state.users); return p.approve || p.evaluate || p.feasibilityCheck ? null : `You cannot reject ${i.id}` }) },
  sendBack: { scope: 'idea', check: perm('sendBack', 'send back') },
  requestInfo: { scope: 'idea', check: perm('requestInfo', 'request more information') },
  reassign: {
    scope: 'idea',
    check: onIdea((ctx, i) => {
      if (!ideaPerms(ctx.me, i, ctx.state.users).reassign) return `You cannot reassign ${i.id}`
      const to = ctx.state.users.find((u) => u.id === ctx.args[1] && u.active !== false)
      if (!to) return 'Choose an active person'
      const ok = i.bucket === 'Pipeline' ? to.roles.includes('buyer') && to.commodities.includes(i.commodity) : ownerCandidates(i, ctx.state.users).some((u) => u.id === to.id)
      return ok ? null : `${to.name} cannot take over ${i.id}`
    }),
  },
  moveToStage: {
    scope: 'idea',
    check: onIdea((ctx, i) => {
      const g = groupOfStage(String(ctx.args[1]))
      if (!g) return 'Unknown stage'
      const r = kanbanMove(ctx.me, i, g.key, ctx.state.users)
      return r.ok ? null : (r as { reason?: string }).reason || 'Not allowed'
    }),
    // the engine gets the stage the board rules resolved, never the raw string the client sent
    sanitize: (ctx) => {
      const i = ideaArg(ctx)!
      const r = kanbanMove(ctx.me, i, groupOfStage(String(ctx.args[1]))!.key, ctx.state.users) as { stage: string }
      return [ctx.args[0], r.stage, str(ctx.args[2])]
    },
  },
  dropIdea: { scope: 'idea', check: perm('drop', 'drop the idea'), sanitize: (ctx) => [ctx.args[0], str(ctx.args[1], 200) ?? 'Other', str(ctx.args[2]) ?? ''] },
  overrideBaseline: {
    scope: 'idea',
    check: (ctx) => perm('override', 'override the baseline')(ctx) ?? (['baselinePrice', 'annualVolume'].includes(String(ctx.args[2])) && Number.isFinite(Number(ctx.args[3])) && Number(ctx.args[3]) >= 0 ? null : 'Override the baseline price or the volume with a number'),
    sanitize: (ctx) => [ctx.args[0], str(ctx.args[1], 80), ctx.args[2], Number(ctx.args[3]), str(ctx.args[4]) ?? ''],
  },
  addComment: { scope: 'idea', check: perm('comment', 'comment'), sanitize: (ctx) => [ctx.args[0], str(ctx.args[1], 4000) ?? ''] },
  addAttachments: { scope: 'idea', check: perm('upload', 'add attachments'), sanitize: (ctx) => [ctx.args[0], cleanAttachments(ctx.me, ctx.args[1])] },
  // only one field is edited this way from the app: the change-over (CO) date in the Execution Hub
  updateIdea: {
    scope: 'idea',
    sanitize: (ctx) => [ctx.args[0], pick(ctx.args[1], ['coDate']), str(ctx.args[2], 200), str(ctx.args[3])],
    check: onIdea((ctx, i) => {
      const patch = (ctx.args[1] ?? {}) as Record<string, unknown>
      if (Object.keys(patch).some((k) => k !== 'coDate')) return 'Only the change-over date can be edited here'
      return execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot edit ${i.id}`
    }),
  },

  // ─── stage 5–6 (CO) ───
  updateExecution: {
    scope: 'idea',
    // what the Execution Hub edits; slippage, status and the first-MRN date are written only by their own actions
    sanitize: (ctx) => [ctx.args[0], pick(ctx.args[1], ['progress', 'targetDate', 'phasing', 'ownerId']), str(ctx.args[2])],
    check: onIdea((ctx, i) => {
      const r = execRights(ctx.me, i, ctx.state.users)
      if (!r.editable) return `You cannot edit the execution of ${i.id}`
      const patch = (ctx.args[1] ?? {}) as { ownerId?: string }
      if (patch.ownerId && patch.ownerId !== i.execution?.ownerId && !(r.canReassign && ownerCandidates(i, ctx.state.users).some((u) => u.id === patch.ownerId))) return 'Only the department head can hand the execution to someone else'
      return null
    }),
  },
  toggleMilestone: { scope: 'idea', check: onIdea((ctx, i) => (execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot update milestones of ${i.id}`)) },
  addExecutionNote: { scope: 'idea', check: onIdea((ctx, i) => (execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot add notes to ${i.id}`)) },
  setMilestoneNote: { scope: 'idea', check: onIdea((ctx, i) => (execRights(ctx.me, i, ctx.state.users).editable ? null : `You cannot edit notes of ${i.id}`)) },
  handOverForVerification: {
    scope: 'idea',
    check: (ctx) => perm('handOver', 'hand over for verification')(ctx) ?? (/^\d{4}-\d{2}-\d{2}$/.test(String(ctx.args[1])) ? null : 'Give the date of the first MRN at the new price'),
    sanitize: (ctx) => [ctx.args[0], ctx.args[1], Object.fromEntries(Object.entries(obj(ctx.args[2])).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0).map(([k, v]) => [k.slice(0, 80), Number(v)]))],
  },
  verifyIdea: {
    scope: 'idea',
    check: perm('verify', 'verify'),
    sanitize: (ctx) => { const v = obj(ctx.args[1]); return [ctx.args[0], { mrnAtApproved: !!v.mrnAtApproved, financeValidated: !!v.financeValidated, targetAchieved: !!v.targetAchieved, remarks: str(v.remarks), targetAtVerification: Number(v.targetAtVerification) || 0 }] },
  },
  returnToExecution: { scope: 'idea', check: perm('verify', 'return the idea to execution'), sanitize: (ctx) => [ctx.args[0], str(ctx.args[1]) ?? ''] },
  syncNpdPap: {
    scope: 'idea',
    check: (ctx) => {
      const r = perm('sync', 'update NPD / PAP status')(ctx)
      if (r) return r
      const p = obj(ctx.args[1])
      if (p.npdStatus !== undefined && !NPD.includes(String(p.npdStatus))) return 'Unknown NPD status'
      if (p.papStatus !== undefined && !PAP.includes(String(p.papStatus))) return 'Unknown PAP status'
      return null
    },
    // only the two statuses — never any other field of the idea
    sanitize: (ctx) => [ctx.args[0], pick(ctx.args[1], ['npdStatus', 'papStatus'])],
  },

  // ─── savings realisation & reports ───
  runRealisation: { check: roles(['finance', 'head', 'admin'], 'Finance, the Sourcing Head or Admin') },
  uploadMrn: { check: roles(['finance', 'head', 'admin'], 'Finance, the Sourcing Head or Admin') },
  financeValidate: { check: roles(['finance', 'head', 'admin'], 'Finance') },
  financeQuery: { check: roles(['finance', 'head', 'admin'], 'Finance') },
  sendMonthlyReport: { check: roles(['head', 'admin', 'mgmt', 'finance'], 'the Sourcing Head, Finance, Management or Admin') },
  bookFyClosure: { check: roles(['head', 'admin', 'finance'], 'the Sourcing Head, Finance or Admin') },

  // ─── campaigns & supplier outreach ───
  createCampaign: { check: (ctx) => (can(ctx.me, 'campaign') ? null : 'Only Sourcing can run campaigns') },
  updateCampaign: {
    scope: 'campaign',
    check: (ctx) => {
      if (!can(ctx.me, 'campaign')) return 'Only Sourcing can run campaigns'
      const c = ctx.state.campaigns.find((x) => x.id === ctx.args[0])
      if (!c) return 'Campaign not found'
      const st = obj(ctx.args[1]).status
      // a draft goes live only through Launch (that sends the invitations); live ↔ closed is an edit
      if (st !== undefined && !(st !== 'Draft' && c.status !== 'Draft' && (st === 'Live' || st === 'Closed'))) return 'Launch the campaign to make it live'
      return null
    },
    sanitize: (ctx) => [ctx.args[0], pick(ctx.args[1], ['name', 'type', 'categoryId', 'commodity', 'startDate', 'endDate', 'workshopDate', 'venue', 'suppliers', 'internalInvitees', 'description', 'targetIdeas', 'targetValue', 'summary', 'status'])],
  },
  launchCampaign: { scope: 'campaign', check: (ctx) => (can(ctx.me, 'campaign') ? (ctx.state.campaigns.some((c) => c.id === ctx.args[0]) ? null : 'Campaign not found') : 'Only Sourcing can run campaigns') },
  inviteCampaignSuppliers: { scope: 'campaign', check: (ctx) => (can(ctx.me, 'campaign') ? (ctx.state.campaigns.some((c) => c.id === ctx.args[0]) ? null : 'Campaign not found') : 'Only Sourcing can invite suppliers') },
  setAttendance: {
    scope: 'campaign',
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
  upsert: {
    check: (ctx) => {
      if (!ctx.me.roles.includes('admin')) return 'Only Admin can do this'
      const [key, item, idKey = 'id'] = ctx.args as [string, Record<string, unknown> | undefined, string | undefined]
      if (!MASTER_KEYS.includes(key)) return `Unknown master ${key}`
      if (!item || typeof item !== 'object' || !String(item[idKey] ?? '').trim()) return `The record needs a ${idKey}`
      if (key === 'users') {
        const existing = ctx.state.users.find((u) => u.id === item.id)
        const merged = { ...(existing ?? {}), ...item } as Record<string, unknown>
        for (const f of ['name', 'email', 'employeeId', 'department']) if (!String(merged[f] ?? '').trim()) return `A user needs ${f === 'employeeId' ? 'an employee ID' : `a ${f}`}`
        if (!Array.isArray(merged.roles) || !merged.roles.length) return 'A user needs at least one role'
        const clash = ctx.state.users.find((u) => u.id !== item.id && (u.email.toLowerCase() === String(merged.email).toLowerCase() || u.employeeId.toLowerCase() === String(merged.employeeId).toLowerCase()))
        if (clash) return `Email or employee ID already used by ${clash.name}`
        if (!existing && !item.password) return 'A new user needs a password'
      }
      return null
    },
  },
  remove: { check: (ctx) => (!ctx.me.roles.includes('admin') ? 'Only Admin can do this' : MASTER_KEYS.includes(String(ctx.args[0])) ? null : `Unknown master ${ctx.args[0]}`) },
  setList: { check: (ctx) => roles(['admin'], 'Admin')(ctx) ?? (['dropReasons', 'departments'].includes(String(ctx.args[0])) && Array.isArray(ctx.args[1]) && (ctx.args[1] as unknown[]).every((x) => typeof x === 'string') ? null : 'Not a list Admin can edit') },
  updateSettings: {
    check: (ctx) => {
      const r = roles(['admin'], 'Admin')(ctx)
      if (r) return r
      for (const [k, v] of Object.entries(obj(ctx.args[0]))) if (SETTING_RULES[k] && !SETTING_RULES[k](v)) return `Setting ${k} is not valid`
      return null
    },
    sanitize: (ctx) => [Object.fromEntries(Object.entries(obj(ctx.args[0])).filter(([k]) => SETTING_RULES[k]))],
  },
  setBuyerTarget: { check: roles(['admin', 'head'], 'Admin or the Sourcing Head') },
  setPlantTarget: { check: roles(['admin', 'head'], 'Admin or the Sourcing Head') },
  importData: { check: roles(['admin'], 'Admin'), sanitize: (ctx) => [pick(ctx.args[0], IMPORTABLE)] },
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
