// Shared idea helpers for the Idea Register (M2), Idea 360 page (M4) and side-panel review.
import { useMemo } from 'react'
import { useStore, hasRole } from '../../store/useStore'
import type { Bucket, Campaign, Category, Commodity, Health, Idea, IdeaPart, Lever, LeverGroup, Plant, RouteKey, SlaRule, Supplier, User } from '../../lib/types'
import { EVALUATION_STAGES, FEASIBILITY_STAGES, ROUTE_STAGES, STAGE, STAGE_SHORT, STAGE_SLA_KEY } from '../../lib/masters'
import { can } from '../../lib/nav'
import { healthOf, ideaAnnualised, leverGroupOf, partAnnualised, savingPct, savingPerUnit, slaStatus, stageAgeDays } from '../../lib/calc'
import { fmtDate, inrShort, nowIso, uid } from '../../lib/format'
import { exportExcel } from '../../lib/export'

// ─── Stage groups (Kanban columns) ────────────────────────────────────────────
export interface StageGroup { key: string; label: string; short: string; stages: string[]; bucket: Bucket; icon: string }
// One column per workflow stage — the same six stages for every idea (Idea submitted is the entry event)
export const STAGE_GROUPS: StageGroup[] = [
  { key: 'feasibility', label: STAGE.feasibility, short: STAGE.feasibility, stages: [STAGE.feasibility], bucket: 'Pipeline', icon: 'UsersRound' },
  { key: 'rnd', label: STAGE.rnd, short: STAGE.rnd, stages: [STAGE.rnd], bucket: 'Pipeline', icon: 'FlaskConical' },
  { key: 'approval', label: STAGE.approval, short: STAGE.approval, stages: [STAGE.approval], bucket: 'Pipeline', icon: 'Stamp' },
  { key: 'execution', label: STAGE.execution, short: STAGE.execution, stages: [STAGE.execution], bucket: 'In Execution', icon: 'Rocket' },
  { key: 'implemented', label: 'Implemented', short: 'Implemented', stages: ['Implemented'], bucket: 'Implemented', icon: 'CircleCheckBig' },
  { key: 'dropped', label: 'Dropped', short: 'Dropped', stages: ['Dropped', 'Rejected'], bucket: 'Dropped', icon: 'CircleX' },
]
export const groupOfStage = (stage: string) => STAGE_GROUPS.find((g) => g.stages.includes(stage))

export const ROUTE_ICON: Record<RouteKey, string> = { Commercial: 'Handshake', 'Supplier change': 'Users', Technical: 'Cog', Internal: 'Workflow', 'To be confirmed': 'CircleHelp' }
export const ROUTES: RouteKey[] = ['Commercial', 'Supplier change', 'Technical', 'Internal', 'To be confirmed']
export const LEVER_GROUPS: LeverGroup[] = ['Commercial', 'Supply base', 'Engineering', 'Logistics & packing', 'Operational']
export const SAVINGS_TYPES = ['Hard', 'Cost avoidance', 'One-time'] as const
export const SAVINGS_TYPE_COLOR: Record<string, string> = { Hard: '#0f9f6e', 'Cost avoidance': '#0284c7', 'One-time': '#7c3aed' }

export const stagesOf = (idea: Pick<Idea, 'route'>) => ROUTE_STAGES[idea.route] ?? ROUTE_STAGES.Commercial

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
export function inScope(me: User | null | undefined, idea: Idea) {
  if (!me) return false
  if (hasRole(me, 'head')) return true
  return me.commodities.includes(idea.commodity)
}
export interface IdeaPerms {
  validate: boolean; feasibility: boolean; feasibilityOnBehalf: boolean; techeval: boolean; approve: boolean
  sendBack: boolean; requestInfo: boolean; reassign: boolean; drop: boolean; markDone: boolean; advance: string | null
  override: boolean; sync: boolean; continueDraft: boolean; comment: boolean; upload: boolean
}
export function ideaPerms(me: User | null | undefined, idea: Idea): IdeaPerms {
  const none: IdeaPerms = { validate: false, feasibility: false, feasibilityOnBehalf: false, techeval: false, approve: false, sendBack: false, requestInfo: false, reassign: false, drop: false, markDone: false, advance: null, override: false, sync: false, continueDraft: false, comment: false, upload: false }
  if (!me) return none
  const stage = idea.stage
  const pipeline = idea.bucket === 'Pipeline'
  const exec = idea.bucket === 'In Execution'
  const scope = inScope(me, idea)
  const validator = can(me, 'validate') && scope
  const feasStage = FEASIBILITY_STAGES.includes(stage)
  const responded = !!idea.feasibility?.respondedAt
  const supCode = idea.feasibility?.supplierCode ?? idea.proposedSupplier?.code ?? idea.supplierCode
  const evalStage = EVALUATION_STAGES.includes(stage)
  const pending = idea.approvals.find((a) => !a.decision)
  const validate = pipeline && stage === STAGE.feasibility && validator
  // no supplier step in the workflow: the team runs the feasibility check itself
  const feasibilityOnBehalf = false
  const feasibility = false
  void feasStage; void responded; void supCode
  const techeval = pipeline && evalStage && can(me, 'techeval') && (!idea.techEval?.evaluatorDept || idea.techEval.evaluatorDept.includes(me.department))
  const approve = pipeline && stage === STAGE.approval && can(me, 'approve') && !!pending &&
    (hasRole(me, 'head') || pending.approverId === me.id || (pending.level === 'Commodity Lead' && hasRole(me, 'lead') && scope))
  const actor = validate || techeval || approve || (pipeline && validator)
  const stages = stagesOf(idea)
  const idx = stages.indexOf(stage)
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null
  const executor = can(me, 'execute') && scope
  return {
    validate, feasibility, feasibilityOnBehalf, techeval, approve,
    sendBack: pipeline && actor,
    requestInfo: pipeline && actor,
    reassign: (pipeline && validator) || (exec && can(me, 'approve') && scope),
    drop: (pipeline || exec) && executor,
    markDone: exec && executor,
    advance: exec && executor && next && next !== 'Implemented' ? next : null,
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
  if (s === 'Draft') return 'Draft — not yet submitted for validation'
  if (s === 'Implemented') return `Implemented${idea.execution?.effectiveDate ? ` · effective ${fmtDate(idea.execution.effectiveDate)}` : ''}`
  if (s === 'Dropped' || s === 'Rejected') return `${s} at ${idea.dropStage ?? '—'} · ${idea.dropReason ?? ''}`
  if (FEASIBILITY_STAGES.includes(s)) return `Awaiting team feasibility check · ${userNameOf(ctx, idea.buyerId)}${idea.infoRequested ? ' · more info requested from submitter' : ''}`
  if (EVALUATION_STAGES.includes(s)) return `Awaiting R&D approval${idea.techEval?.evaluatorDept && idea.techEval.evaluatorDept !== 'R&D' ? ` (${idea.techEval.evaluatorDept})` : ''}`
  if (s === STAGE.approval) {
    const p = idea.approvals.find((a) => !a.decision)
    return p ? `Awaiting sourcing approval — ${p.level} · ${userNameOf(ctx, p.approverId)}` : 'Awaiting sourcing approval'
  }
  return `Execution started · owner ${userNameOf(ctx, idea.ownerId ?? idea.buyerId)}`
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
  if (idea.bucket === 'Implemented' || idea.bucket === 'Dropped') return { ok: false, reason: `${idea.id} is ${idea.stage.toLowerCase()} — final stages cannot be moved` }
  if (!inScope(me, idea)) return { ok: false, reason: `${idea.id} is outside your commodity mapping` }
  if (targetKey === 'dropped') {
    if (!can(me, 'execute')) return { ok: false, reason: 'Dropping an idea needs Buyer, Commodity Lead or Sourcing Head rights' }
    return { ok: true, kind: 'drop', stage: 'Dropped', backward: false }
  }
  if (targetKey === 'implemented') {
    if (idea.bucket !== 'In Execution') return { ok: false, reason: 'Only approved ideas in execution can be marked Implemented' }
    if (!can(me, 'execute')) return { ok: false, reason: 'Mark Done needs Buyer, Commodity Lead or Sourcing Head rights' }
    return { ok: true, kind: 'done', stage: 'Implemented', backward: false }
  }
  const stages = stagesOf(idea)
  const stage = stages.find((s) => target.stages.includes(s))
  if (!stage) return { ok: false, reason: `There is no “${target.label}” stage` }
  const ai = stages.indexOf(STAGE.approval), ci = stages.indexOf(idea.stage), ti = stages.indexOf(stage)
  if (ci > ai && ti <= ai) return { ok: false, reason: 'Approved values are locked — an idea in execution cannot return to the pipeline' }
  if (ti > ai && ci <= ai) {
    if (!can(me, 'approve')) return { ok: false, reason: 'Moving past Sourcing approval needs Commodity Lead or Sourcing Head approval rights' }
  } else if (ti <= ai) {
    if (!can(me, 'validate')) return { ok: false, reason: 'Pipeline moves need team feasibility rights (Commodity Lead, Sourcing Head or the commodity team)' }
  } else if (!can(me, 'execute')) return { ok: false, reason: 'Execution moves need Buyer, Commodity Lead or Sourcing Head rights' }
  return { ok: true, kind: 'move', stage, backward: ti < ci }
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
  LBP: { label: 'from LBP', color: '#0284c7' },
  'PO price': { label: 'PO price', color: '#4f46e5' },
  Quoted: { label: 'Quoted', color: '#7c3aed' },
  Override: { label: 'Override', color: '#ec8a1c' },
}
export const VOLUME_TAG: Record<IdeaPart['volumeSource'], { label: string; color: string }> = {
  'MRN FY26': { label: 'from MRN FY26', color: '#0d9488' },
  Forecast: { label: 'Forecast', color: '#ec8a1c' },
  Override: { label: 'Override', color: '#ec8a1c' },
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
