// Shared idea helpers for the Idea Register (M2), Idea 360 page (M4) and side-panel review.
import { useMemo } from 'react'
import { useStore, hasRole } from '../../store/useStore'
import type { Bucket, Campaign, Category, Commodity, Health, Idea, IdeaPart, Lever, LeverGroup, Plant, RouteKey, SlaRule, Supplier, User } from '../../lib/types'
import { EVALUATION_STAGES, FEASIBILITY_STAGES, ROUTE_STAGES, STAGE, STAGE_SHORT, STAGE_SLA_KEY, USERS_DEFAULT } from '../../lib/masters'
import { stageLabel, ideaDept, stageAssignee } from '../../lib/workflow'
import { can } from '../../lib/nav'
import { healthOf, ideaAnnualised, leverGroupOf, partAnnualised, savingPct, savingPerUnit, slaStatus, stageAgeDays } from '../../lib/calc'
import { fmtDate, inrShort, nowIso, uid } from '../../lib/format'
import { exportExcel } from '../../lib/export'

// ─── Stage groups (Kanban columns) ────────────────────────────────────────────
export interface StageGroup { key: string; label: string; short: string; stages: string[]; bucket: Bucket; icon: string }
// One column per workflow stage — the same six stages for every idea (Idea submitted is the entry event).
// Team feasibility check → <dept> evaluation → <dept> approval live in IN; Execution started and Verification in CO.
export const STAGE_GROUPS: StageGroup[] = [
  { key: 'feasibility', label: STAGE.feasibility, short: STAGE.feasibility, stages: [STAGE.feasibility], bucket: 'Pipeline', icon: 'UsersRound' },
  { key: 'evaluation', label: 'Evaluation', short: 'Evaluation', stages: [STAGE.evaluation], bucket: 'Pipeline', icon: 'FlaskConical' },
  { key: 'approval', label: STAGE.approval, short: STAGE.approval, stages: [STAGE.approval], bucket: 'Pipeline', icon: 'Stamp' },
  { key: 'execution', label: STAGE.execution, short: STAGE.execution, stages: [STAGE.execution], bucket: 'In Execution', icon: 'Rocket' },
  { key: 'verification', label: STAGE.verification, short: STAGE.verification, stages: [STAGE.verification, 'Implemented'], bucket: 'Implemented', icon: 'ShieldCheck' },
  { key: 'dropped', label: 'Dropped', short: 'Dropped', stages: ['Dropped', 'Rejected'], bucket: 'Dropped', icon: 'CircleX' },
]
export const groupOfStage = (stage: string) => STAGE_GROUPS.find((g) => g.stages.includes(stage))

export const ROUTE_ICON: Record<RouteKey, string> = { Commercial: 'Handshake', 'Supplier change': 'Users', Technical: 'Cog', Internal: 'Workflow', 'To be confirmed': 'CircleHelp' }
export const ROUTES: RouteKey[] = ['Commercial', 'Supplier change', 'Technical', 'Internal', 'To be confirmed']
export const LEVER_GROUPS: LeverGroup[] = ['Commercial', 'Supply base', 'Engineering', 'Logistics & packing', 'Operational']
export const SAVINGS_TYPES = ['Hard', 'Cost avoidance', 'One-time'] as const
export const SAVINGS_TYPE_COLOR: Record<string, string> = { Hard: 'var(--color-emerald-600)', 'Cost avoidance': 'var(--color-sky-600)', 'One-time': 'var(--color-violet-600)' }

export const stagesOf = (idea: Pick<Idea, 'route'>) => ROUTE_STAGES[idea.route] ?? ROUTE_STAGES.Commercial
/** Stage name as shown for this idea ("Evaluation" → "R&D evaluation") */
export const stageText = (idea: Pick<Idea, 'stage' | 'department' | 'evaluation'>) => stageLabel(idea, idea.stage)

// ─── Context (masters needed for labels / filters) ───────────────────────────
export interface Ctx { levers: Lever[]; slaRules: SlaRule[]; suppliers: Supplier[]; commodities: Commodity[]; users: User[]; campaigns: Campaign[]; categories: Category[]; plants: Plant[] }
export function useCtx(): Ctx {
  const levers = useStore((s) => s.levers)
  const slaRules = useStore((s) => s.slaRules)
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const users = useStore((s) => s.users)
  const campaigns = useStore((s) => s.campaigns)
  const categories = useStore((s) => s.categories)
  const plants = useStore((s) => s.plants)
  return useMemo(() => ({ levers, slaRules, suppliers, commodities, users, campaigns, categories, plants }), [levers, slaRules, suppliers, commodities, users, campaigns, categories, plants])
}
export const userNameOf = (ctx: Ctx, id?: string) => ctx.users.find((u) => u.id === id)?.name ?? '—'
export const commodityName = (ctx: Ctx, code: string) => ctx.commodities.find((c) => c.code === code)?.name ?? code
export const supplierName = (ctx: Ctx, code?: string) => ctx.suppliers.find((s) => s.code === code)?.name ?? code ?? '—'

// ─── Row model for tables / boards ────────────────────────────────────────────
export interface IdeaRow {
  id: string
  idea: Idea
  annual: number
  age: number
  sla: ReturnType<typeof slaStatus>
  health: Health | null
  leverName: string
  group: LeverGroup
  commodityName: string
  ownerId: string
  ownerName: string
  submitted: string
}
export function toRow(idea: Idea, ctx: Ctx): IdeaRow {
  const lever = ctx.levers.find((l) => l.id === idea.leverId)
  const ownerId = idea.ownerId ?? idea.buyerId
  return {
    id: idea.id, idea,
    annual: ideaAnnualised(idea),
    age: stageAgeDays(idea),
    sla: slaStatus(idea, ctx.slaRules),
    health: idea.execution?.status === 'In Execution' ? healthOf(idea) : null,
    leverName: lever?.name ?? idea.leverId,
    group: leverGroupOf(ctx.levers, idea.leverId) as LeverGroup,
    commodityName: commodityName(ctx, idea.commodity),
    ownerId, ownerName: userNameOf(ctx, ownerId),
    submitted: (idea.submittedAt ?? idea.createdAt ?? '').slice(0, 10),
  }
}

// ─── URL query contract (drill-down) ─────────────────────────────────────────
export const FILTER_KEYS = ['bucket', 'stage', 'commodity', 'category', 'lever', 'group', 'route', 'buyer', 'owner', 'submitter', 'supplier', 'dept', 'campaign', 'savingsType', 'dropReason', 'health', 'sla', 'plant', 'q', 'minValue', 'maxValue', 'supplierOnly', 'fy']
export const PARAM_LABEL: Record<string, string> = {
  bucket: 'Bucket', stage: 'Stage', commodity: 'Commodity', category: 'Category', lever: 'Lever', group: 'Lever group', route: 'Route', buyer: 'Buyer',
  owner: 'Owner', submitter: 'Submitter', supplier: 'Supplier', dept: 'Department', campaign: 'Campaign', savingsType: 'Savings type', dropReason: 'Drop reason',
  health: 'Health', sla: 'SLA', plant: 'Plant', q: 'Search', minValue: 'Annualised ≥', maxValue: 'Annualised ≤', supplierOnly: 'Supplier ideas', fy: 'FY',
}
const splitVals = (raw: string) => raw.split(',').map((v) => v.trim()).filter(Boolean)

function matchOne(r: IdeaRow, key: string, v: string): boolean {
  const i = r.idea
  switch (key) {
    case 'bucket': return i.bucket === v
    case 'stage': {
      const g = groupOfStage(i.stage)
      return i.stage === v || g?.key === v || g?.label === v || STAGE_SLA_KEY[i.stage] === v || STAGE_SHORT[i.stage] === v
    }
    case 'commodity': return i.commodity === v
    case 'category': return i.categoryId === v
    case 'lever': return i.leverId === v || r.leverName === v
    case 'group': return r.group === v
    case 'route': return i.route === v
    case 'buyer': return i.buyerId === v || i.ownerId === v
    case 'owner': return r.ownerId === v
    case 'submitter': return i.submitterId === v
    case 'supplier': return i.supplierCode === v || i.feasibility?.supplierCode === v || i.proposedSupplier?.code === v || i.parts.some((p) => p.currentSupplier.split(' · ')[0] === v)
    case 'dept': return i.department === v
    case 'campaign': return i.campaignId === v
    case 'savingsType': return i.savingsType === v
    case 'dropReason': return i.dropReason === v
    case 'health': return r.health === v
    case 'sla': return v === 'breach' ? r.sla.state === 'breach' || r.sla.state === 'escalated' : r.sla.state === v
    case 'plant': return i.plant === v
    case 'fy': return i.fy === v
    default: return true
  }
}
export function matchParam(r: IdeaRow, key: string, raw: string, ctx: Ctx): boolean {
  const i = r.idea
  if (key === 'q') {
    const k = raw.trim().toLowerCase()
    if (!k) return true
    const hay = [
      i.id, i.title, i.submitterName, i.commodity, r.commodityName, r.leverName, i.stage, i.plant, i.department, i.supplierCode, i.proposedSupplier?.name, r.ownerName,
      supplierName(ctx, i.supplierCode), ...i.parts.flatMap((p) => [p.partCode, p.description, p.currentSupplier]),
    ]
    return hay.some((h) => !!h && String(h).toLowerCase().includes(k))
  }
  if (key === 'minValue') return r.annual >= Number(raw)
  if (key === 'maxValue') return r.annual <= Number(raw)
  if (key === 'supplierOnly') return raw === 'false' ? !i.isSupplierSubmission : i.isSupplierSubmission
  if (!FILTER_KEYS.includes(key)) return true
  return splitVals(raw).some((v) => matchOne(r, key, v))
}
export function filterRows(rows: IdeaRow[], params: Record<string, string>, ctx: Ctx, exclude: string[] = []) {
  const entries = Object.entries(params).filter(([k, v]) => FILTER_KEYS.includes(k) && v !== '' && v != null && !exclude.includes(k))
  if (!entries.length) return rows
  return rows.filter((r) => entries.every(([k, v]) => matchParam(r, k, v, ctx)))
}
export function paramsToObject(sp: URLSearchParams): Record<string, string> {
  const o: Record<string, string> = {}
  sp.forEach((v, k) => { if (FILTER_KEYS.includes(k) && v !== '') o[k] = v })
  return o
}
export function valueLabel(key: string, raw: string, ctx: Ctx): string {
  const each = (fn: (v: string) => string) => splitVals(raw).map(fn).join(', ')
  switch (key) {
    case 'commodity': return each((v) => commodityName(ctx, v))
    case 'category': return each((v) => ctx.categories.find((c) => c.id === v)?.name ?? v)
    case 'lever': return each((v) => ctx.levers.find((l) => l.id === v)?.name ?? v)
    case 'buyer': case 'owner': case 'submitter': return each((v) => userNameOf(ctx, v) === '—' ? v : userNameOf(ctx, v))
    case 'supplier': return each((v) => `${supplierName(ctx, v)} (${v})`)
    case 'campaign': return each((v) => ctx.campaigns.find((c) => c.id === v)?.name ?? v)
    case 'plant': return each((v) => ctx.plants.find((p) => p.id === v)?.name ?? v)
    case 'stage': return each((v) => STAGE_GROUPS.find((g) => g.key === v)?.label ?? v)
    case 'sla': return raw === 'breach' ? 'Breached / escalated' : raw === 'due' ? 'Reminder due' : raw === 'ok' ? 'Within SLA' : raw
    case 'minValue': case 'maxValue': return inrShort(Number(raw))
    case 'supplierOnly': return raw === 'false' ? 'Excluded' : 'Only supplier submissions'
    case 'q': return `“${raw}”`
    default: return raw
  }
}

// ─── Permissions (Section 3 matrix, applied per idea + stage) ────────────────
/** live user list (admin edits included); the seed's users before the store exists */
const usersNow = () => useStore.getState().users ?? USERS_DEFAULT
export function inScope(me: User | null | undefined, idea: Idea) {
  if (!me) return false
  if (hasRole(me, 'head')) return true
  return me.commodities.includes(idea.commodity)
}
export interface IdeaPerms {
  feasibilityCheck: boolean; evaluate: boolean; approve: boolean
  sendBack: boolean; requestInfo: boolean; reassign: boolean; drop: boolean; handOver: boolean; verify: boolean
  override: boolean; sync: boolean; continueDraft: boolean; comment: boolean; upload: boolean
}
export function ideaPerms(me: User | null | undefined, idea: Idea): IdeaPerms {
  const none: IdeaPerms = { feasibilityCheck: false, evaluate: false, approve: false, sendBack: false, requestInfo: false, reassign: false, drop: false, handOver: false, verify: false, override: false, sync: false, continueDraft: false, comment: false, upload: false }
  if (!me) return none
  const stage = idea.stage
  const pipeline = idea.bucket === 'Pipeline'
  const exec = idea.bucket === 'In Execution'
  // Sourcing Head and Admin can act at every stage; everyone else only at their own stage, for their own department
  const head = hasRole(me, 'head', 'admin')
  const scope = inScope(me, idea)
  const validator = can(me, 'validate') && scope
  const evalStage = EVALUATION_STAGES.includes(stage)
  const dept = ideaDept(idea)
  const inDept = me.department === dept
  // stage 2 — the team lead of the submitter's department, never on their own idea (then the department lead steps in)
  const feasibilityCheck = pipeline && FEASIBILITY_STAGES.includes(stage) &&
    (head || (hasRole(me, 'teamlead') && inDept && idea.submitterId !== me.id) || stageAssignee(idea, stage, usersNow()) === me.id)
  // stage 3 — the department lead; stage 4 — the department head
  const evaluate = pipeline && evalStage && (head || (hasRole(me, 'deptlead') && inDept))
  const approve = pipeline && stage === STAGE.approval && idea.approvals.some((a) => !a.decision) && (head || (hasRole(me, 'depthead') && inDept))
  const actor = feasibilityCheck || evaluate || approve
  // stage 5 — the department's execution owner, or whoever the execution was reassigned to
  const executor = head || idea.ownerId === me.id || (hasRole(me, 'execowner') && inDept)
  return {
    feasibilityCheck, evaluate, approve,
    sendBack: pipeline && actor,
    requestInfo: pipeline && actor,
    // pipeline stages are assigned by the ladder — only override users re-point the commodity buyer;
    // in execution the department head (or override) hands the execution to another owner
    reassign: (pipeline && head) || (exec && (head || (hasRole(me, 'depthead') && inDept))),
    drop: (pipeline && (actor || head)) || (exec && executor),
    handOver: exec && executor && idea.execution?.status === 'In Execution',
    // stage 6 — Finance verifies the locked target
    verify: stage === STAGE.verification && !idea.verification?.verifiedAt && (head || hasRole(me, 'finance')),
    override: pipeline && validator && !idea.locked,
    sync: executor && idea.bucket !== 'Dropped',
    continueDraft: stage === 'Draft' && idea.submitterId === me.id,
    comment: idea.stage !== 'Draft' || idea.submitterId === me.id,
    upload: idea.bucket !== 'Dropped' && (idea.submitterId === me.id || scope || evalStage || hasRole(me, 'supplier')),
  }
}

/** Who the idea is waiting on — shown next to the contextual action bar */
export function waitingOn(idea: Idea, ctx: Ctx): string {
  const s = idea.stage
  if (s === 'Draft') return 'Draft — not yet submitted'
  if (s === 'Dropped' || s === 'Rejected') return `${s} at ${idea.dropStage ? stageLabel(idea, idea.dropStage) : '—'} · ${idea.dropReason ?? ''} — closed for good`
  const who = (st: string) => userNameOf(ctx, stageAssignee(idea, st, usersNow()))
  if (FEASIBILITY_STAGES.includes(s)) return `Awaiting team feasibility check · ${who(s)}${idea.infoRequested ? ' · more info requested from submitter' : ''}`
  if (EVALUATION_STAGES.includes(s)) {
    const sc = idea.evaluation?.supplier?.status
    return `Awaiting ${stageLabel(idea, s)} · ${who(s)} · cost-benefit, risk${sc === 'Skipped' ? ' (supplier check skipped < ₹ 5 L)' : sc === 'Sent' ? ' · supplier form sent' : sc === 'Responded' ? ' · supplier responded' : ', supplier check'}`
  }
  if (s === STAGE.approval) {
    return `Awaiting ${stageLabel(idea, s)} · ${who(s)}${idea.lock ? ' · lock signed' : ' · budget & timeline lock to sign'}`
  }
  if (s === STAGE.verification || s === 'Implemented') {
    const v = idea.verification
    return v?.verifiedAt ? `Verified ${fmtDate(v.verifiedAt.slice(0, 10))} by ${v.verifiedBy}` : `Handed for verification${v?.handedAt ? ` ${fmtDate(v.handedAt.slice(0, 10))}` : ''} · awaiting Finance verification · ${who(STAGE.verification)}`
  }
  const nextMs = idea.execution?.milestones.find((m) => !m.doneDate)
  return `Execution started · owner ${who(STAGE.execution)}${nextMs ? ` · next: ${nextMs.name}` : ''}`
}

// ─── Kanban move rules (permission-checked) ──────────────────────────────────
export type MoveResult =
  | { ok: true; kind: 'move' | 'drop' | 'done'; stage: string; backward: boolean }
  | { ok: false; reason: string; same?: boolean }
export function kanbanMove(me: User | null | undefined, idea: Idea, targetKey: string): MoveResult {
  const from = groupOfStage(idea.stage)
  const target = STAGE_GROUPS.find((g) => g.key === targetKey)!
  if (!from) return { ok: false, reason: 'Drafts are not on the board — submit the idea first' }
  if (from.key === targetKey) return { ok: false, reason: '', same: true }
  if (!me) return { ok: false, reason: 'Sign in to move ideas' }
  if (idea.bucket === 'Implemented' || idea.bucket === 'Dropped') return { ok: false, reason: `${idea.id} is ${idea.stage === 'Dropped' || idea.stage === 'Rejected' ? 'dropped for good' : 'in verification'} — it cannot be moved on the board` }
  // every move is decided by the department ladder: the role for the stage being left, or Sourcing Head / Admin
  const p = ideaPerms(me, idea)
  const who = `the ${stageLabel(idea, idea.stage)} role of ${ideaDept(idea)} (or the Sourcing Head / Admin)`
  if (targetKey === 'dropped') {
    if (!p.drop) return { ok: false, reason: `Dropping ${idea.id} needs ${who}` }
    return { ok: true, kind: 'drop', stage: 'Dropped', backward: false }
  }
  if (targetKey === 'verification') {
    if (!p.handOver) return { ok: false, reason: `Handing ${idea.id} over for verification needs the ${ideaDept(idea)} execution owner (or the Sourcing Head / Admin)` }
    if (idea.bucket !== 'In Execution') return { ok: false, reason: 'Only ideas in Execution started can be handed for verification' }
    if (!idea.execution?.effectiveDate) return { ok: false, reason: 'Record the first MRN at the new price in the Execution Hub before handing over for verification' }
    return { ok: true, kind: 'done', stage: STAGE.verification, backward: false }
  }
  const stages = stagesOf(idea)
  const stage = stages.find((s) => target.stages.includes(s))
  if (!stage) return { ok: false, reason: `There is no “${target.label}” stage` }
  const ai = stages.indexOf(STAGE.approval), ci = stages.indexOf(idea.stage), ti = stages.indexOf(stage)
  if (ci > ai && ti <= ai) return { ok: false, reason: 'Approved values are locked — an idea in execution cannot return to IN' }
  // forward moves need the stage form of every stage being left
  if (ti > ci) {
    if (ci <= stages.indexOf(STAGE.feasibility) && ti > stages.indexOf(STAGE.feasibility) && idea.feasibilityCheck?.decision !== 'Go') return { ok: false, reason: 'Open the idea and complete the Team feasibility check (Go / No-go) first' }
    if (ci <= stages.indexOf(STAGE.evaluation) && ti > stages.indexOf(STAGE.evaluation) && idea.evaluation?.decision !== 'Recommend') return { ok: false, reason: `Open the idea and complete the ${stageLabel(idea, STAGE.evaluation)} (cost-benefit, risk, supplier check) first` }
    if (ti > ai && (!idea.lock || idea.approvals.some((a) => a.decision !== 'Approved'))) return { ok: false, reason: 'Sign the budget & timeline lock and approve in department approval before execution can start' }
  }
  if (ti > ai && ci <= ai) {
    if (!ideaPerms(me, idea).approve && !hasRole(me, 'head', 'admin')) return { ok: false, reason: `Moving past ${stageLabel(idea, STAGE.approval)} needs the department head (or the Sourcing Head / Admin)` }
  } else if (ti <= ai) {
    if (!(p.feasibilityCheck || p.evaluate || p.approve)) return { ok: false, reason: `Moving ${idea.id} needs ${who}` }
  } else if (!p.handOver) return { ok: false, reason: `Execution moves need the ${ideaDept(idea)} execution owner (or the Sourcing Head / Admin)` }
  return { ok: true, kind: 'move', stage, backward: ti < ci }
}

/** Execution Hub rights for one execution — straight from the ladder */
export function execRights(me: User | null | undefined, idea: Idea) {
  const p = ideaPerms(me, idea)
  return { editable: p.handOver, canReassign: p.reassign && idea.bucket === 'In Execution' }
}
/** Who an execution can be handed to: the idea's department execution owners (Sourcing: the commodity buyers) */
export function ownerCandidates(idea: Idea, users: User[]): User[] {
  const dept = ideaDept(idea)
  const list = users.filter((u) => u.active !== false && u.department === dept && u.roles.includes('execowner'))
  const cur = users.find((u) => u.id === idea.ownerId)
  return cur && !list.includes(cur) ? [cur, ...list] : list
}

// ─── Undo (5 s) on non-final actions ──────────────────────────────────────────
export function restoreIdea(snap: Idea, label: string) {
  const s = useStore.getState()
  const me = s.users.find((u) => u.id === s.userId)
  const cur = s.ideas.find((i) => i.id === snap.id)
  // a dropped or rejected idea stays dropped — nothing brings it back; start a new idea instead
  if (cur && (cur.stage === 'Dropped' || cur.stage === 'Rejected')) { s.toast(`${snap.id} is ${cur.stage.toLowerCase()} and cannot be restored — submit a new idea instead`, 'warning'); return }
  const entry = {
    id: uid('a'), at: nowIso(), userId: me?.id ?? 'system', userName: me?.name ?? 'System', action: `Undone: ${label}`,
    ...(cur && cur.stage !== snap.stage ? { field: 'stage', oldValue: cur.stage, newValue: snap.stage } : {}),
  }
  useStore.setState((st) => ({ ideas: st.ideas.map((i) => (i.id === snap.id ? { ...snap, activity: [...snap.activity, entry] } : i)) }))
  s.toast(`${snap.id} restored`, 'info')
}
export function withUndo(id: string, fn: () => void, message: string, opts: { final?: boolean; type?: 'success' | 'error' | 'info' | 'warning' } = {}) {
  const st = useStore.getState()
  const snap = st.ideas.find((i) => i.id === id)
  fn()
  if (opts.final || !snap) st.toast(message, opts.type ?? 'success')
  else st.toast(message, opts.type ?? 'success', () => restoreIdea(snap, message))
}

// ─── Source tags & part maths ────────────────────────────────────────────────
export const BASELINE_TAG: Record<IdeaPart['baselineSource'], { label: string; color: string }> = {
  LBP: { label: 'from LBP', color: 'var(--color-sky-600)' },
  'PO price': { label: 'PO price', color: 'var(--color-indigo-600)' },
  Quoted: { label: 'Quoted', color: 'var(--color-violet-600)' },
  Override: { label: 'Override', color: 'var(--color-orange-400)' },
}
export const VOLUME_TAG: Record<IdeaPart['volumeSource'], { label: string; color: string }> = {
  'MRN FY26': { label: 'from MRN FY26', color: 'var(--color-teal-600)' },
  Forecast: { label: 'Forecast', color: 'var(--color-orange-400)' },
  Override: { label: 'Override', color: 'var(--color-orange-400)' },
}

// ─── Excel export (ideas + part-wise savings) ────────────────────────────────
export function exportIdeas(rows: IdeaRow[], ctx: Ctx, filename: string) {
  const ideas = rows.map((r) => {
    const i = r.idea
    return {
      'Idea ID': i.id, Title: i.title, FY: i.fy, 'Buying type': i.buyingType,
      Category: ctx.categories.find((c) => c.id === i.categoryId)?.name ?? i.categoryId, Commodity: r.commodityName,
      Lever: r.leverName, 'Lever group': r.group, Route: i.route, Stage: i.stage, Bucket: i.bucket,
      'Annualised impact (₹)': Math.round(r.annual), 'Savings type': i.savingsType, 'One-time investment (₹)': i.oneTimeInvestment || 0,
      Scope: i.scope, Submitter: i.submitterName, 'Employee / vendor ID': i.employeeId, Department: i.department,
      'Supplier submission': i.isSupplierSubmission ? `Yes — ${i.supplierCode ?? ''}` : 'No',
      'Buyer / owner': r.ownerName, Plant: i.plant, 'Submitted on': fmtDate(r.submitted),
      'Days in current stage': i.bucket === 'Pipeline' || i.bucket === 'In Execution' ? r.age : '',
      SLA: r.sla.state === 'none' ? '' : r.sla.state === 'breach' || r.sla.state === 'escalated' ? `${-r.sla.left} working days over (${r.sla.state})` : `${r.sla.left} working days left`,
      Health: r.health ?? '', Campaign: i.campaignId ?? '', 'Expected quarter': i.expectedQuarter,
      'Drop reason': i.dropReason ?? '', 'Drop remarks': i.dropRemarks ?? '',
    }
  })
  const parts = rows.flatMap((r) => r.idea.parts.map((p) => ({
    'Idea ID': r.id, 'Part code': p.partCode, Description: p.description, UoM: p.uom, 'Current supplier': p.currentSupplier,
    'Baseline (₹ / unit)': p.baselinePrice, 'Baseline source': p.baselineSource, 'New price (₹ / unit)': p.newPrice,
    'Approved price (₹ / unit)': p.approvedPrice ?? '', 'Annual volume': p.annualVolume, 'Volume source': p.volumeSource,
    'Saving / unit (₹)': +savingPerUnit(p).toFixed(4), 'Saving %': +savingPct(p).toFixed(2), 'Annualised (₹)': Math.round(partAnnualised(p)),
  })))
  exportExcel(filename, [{ name: 'Ideas', rows: ideas }, { name: 'Part-wise savings', rows: parts }])
}

export const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
