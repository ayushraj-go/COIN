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
import { STAGE_GROUPS, groupOfStage, stagesOf, ideaPerms as domainIdeaPerms, kanbanMove as domainKanbanMove, execRights as domainExecRights } from '../../domain/permissions'

export const ROUTE_ICON: Record<RouteKey, string> = { Commercial: 'Handshake', 'Supplier change': 'Users', Technical: 'Cog', Internal: 'Workflow', 'To be confirmed': 'CircleHelp' }
export const ROUTES: RouteKey[] = ['Commercial', 'Supplier change', 'Technical', 'Internal', 'To be confirmed']
export const LEVER_GROUPS: LeverGroup[] = ['Commercial', 'Supply base', 'Engineering', 'Logistics & packing', 'Operational']
export const SAVINGS_TYPES = ['Hard', 'Cost avoidance', 'One-time'] as const
export const SAVINGS_TYPE_COLOR: Record<string, string> = { Hard: 'var(--color-emerald-600)', 'Cost avoidance': 'var(--color-sky-600)', 'One-time': 'var(--color-violet-600)' }

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

// ─── Permissions: the domain rules bound to the live user list ───────────────
/** live user list (admin edits included); the seed's users before the store exists */
const usersNow = () => { const u = useStore.getState().users; return u?.length ? u : USERS_DEFAULT }
export { STAGE_GROUPS, groupOfStage, stagesOf, inScope, ownerCandidates } from '../../domain/permissions'
export type { StageGroup, IdeaPerms, MoveResult } from '../../domain/permissions'
export const ideaPerms = (me: User | null | undefined, idea: Idea) => domainIdeaPerms(me, idea, usersNow())
export const kanbanMove = (me: User | null | undefined, idea: Idea, targetKey: string) => domainKanbanMove(me, idea, targetKey, usersNow())
export const execRights = (me: User | null | undefined, idea: Idea) => domainExecRights(me, idea, usersNow())

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

// ─── Undo (5 s) on non-final actions ──────────────────────────────────────────
export function withUndo(id: string, fn: () => void, message: string, opts: { final?: boolean; type?: 'success' | 'error' | 'info' | 'warning' } = {}) {
  const st = useStore.getState()
  const known = st.ideas.some((i) => i.id === id)
  // final actions (drop, reject) are never undone; everything else can be put back for 5 seconds
  const undo = opts.final || !known ? undefined : st.beginUndo()
  fn()
  st.toast(message, opts.type ?? 'success', undo)
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
