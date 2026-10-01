// Reports & MIS (M10) — one computation layer for the 12 standard reports, the 25 KPIs (Section 10) and the monthly mailer.
// Every number here is derived live from the store for the active filter scope; group A uses the same `summarise` as useSummary.
import { useMemo } from 'react'
import { useStore, useMe } from '../../store/useStore'
import { useFilteredIdeas } from '../../lib/hooks'
import {
  summarise, ideaAnnualised, ideaApprovedAnnualised, ideaCommitted, healthOf, slaStatus, stageAgeDays, monthlyTrend, STRUCTURAL_LEVERS,
  phaseByQuarter, goLiveOf, type Summary,
} from '../../lib/calc'
import { FEASIBILITY_STAGES, EVALUATION_STAGES, ROUTE_STAGES } from '../../lib/masters'
import { daysBetween, fyMonths, fyEnd, monthLabel, parse, sum, todayIso, ymOf, workingDaysBetween, nextFy, quarterOf } from '../../lib/format'
import type {
  Campaign, Category, Commodity, Filters, Health, Idea, LedgerEntry, Lever, Plant, Settings, SlaRule, Supplier, User,
} from '../../lib/types'

export interface Ctx {
  all: Idea[] // filtered, incl. drafts
  ideas: Idea[] // submitted (non-draft)
  fy: string
  months: string[]
  lrm: string // last realisation month
  sum: Summary
  led: LedgerEntry[] // FY ledger rows of filtered ideas (all savings types)
  hardLed: LedgerEntry[] // … hard-saving ideas only
  ledgerAll: LedgerEntry[]
  today: string
  fv: boolean
  commodities: Commodity[]
  categories: Category[]
  users: User[]
  levers: Lever[]
  suppliers: Supplier[]
  campaigns: Campaign[]
  plants: Plant[]
  slaRules: SlaRule[]
  settings: Settings
  filters: Filters
  fyClosed: Record<string, boolean>
  dropReasons: string[]
  scopeCommodities: Commodity[]
  byId: Map<string, Idea>
}

const ORG_WIDE = ['head', 'finance', 'mgmt', 'admin']

function scopeCommodityList(filters: Filters, commodities: Commodity[], categories: Category[], me: User | null, withBuyer = false) {
  let list = commodities
  if (filters.commodity !== 'All') list = list.filter((c) => c.code === filters.commodity)
  else if (filters.categoryId !== 'All') list = list.filter((c) => c.categoryId === filters.categoryId)
  else if (me && !me.roles.some((r) => ORG_WIDE.includes(r)) && me.commodities.length) list = list.filter((c) => me.commodities.includes(c.code))
  if (filters.buyingType !== 'All') {
    const cats = categories.filter((c) => c.buyingType === filters.buyingType).map((c) => c.id)
    list = list.filter((c) => cats.includes(c.categoryId))
  }
  if (withBuyer && filters.buyerId !== 'All') list = list.filter((c) => c.buyerId === filters.buyerId)
  return list
}

export function useReportCtx(): Ctx {
  const all = useFilteredIdeas()
  const me = useMe()
  const ledgerAll = useStore((s) => s.ledger)
  const settings = useStore((s) => s.settings)
  const filters = useStore((s) => s.filters)
  const commodities = useStore((s) => s.commodities)
  const categories = useStore((s) => s.categories)
  const users = useStore((s) => s.users)
  const levers = useStore((s) => s.levers)
  const suppliers = useStore((s) => s.suppliers)
  const campaigns = useStore((s) => s.campaigns)
  const plants = useStore((s) => s.plants)
  const slaRules = useStore((s) => s.slaRules)
  const fyClosed = useStore((s) => s.fyClosed)
  const dropReasons = useStore((s) => s.dropReasons)
  return useMemo(() => {
    const fy = filters.fy === 'All' ? settings.currentFy : filters.fy
    const months = fyMonths(fy)
    const ids = new Set(all.map((i) => i.id))
    const hard = new Set(all.filter((i) => i.savingsType === 'Hard').map((i) => i.id))
    const led = ledgerAll.filter((l) => ids.has(l.ideaId) && months.includes(l.month))
    return {
      all, ideas: all.filter((i) => i.bucket !== 'Draft'), fy, months, lrm: settings.lastRealisationMonth,
      sum: summarise(all, ledgerAll, 0, fy, settings.financeValidation, settings.lastRealisationMonth),
      led, hardLed: led.filter((l) => hard.has(l.ideaId)), ledgerAll, today: todayIso(), fv: settings.financeValidation,
      commodities, categories, users, levers, suppliers, campaigns, plants, slaRules, settings, filters, fyClosed, dropReasons,
      scopeCommodities: scopeCommodityList(filters, commodities, categories, me, true),
      byId: new Map(all.map((i) => [i.id, i])),
    }
  }, [all, me, ledgerAll, settings, filters, commodities, categories, users, levers, suppliers, campaigns, plants, slaRules, fyClosed, dropReasons])
}

/** Context for a fixed scope (monthly mailer: org-wide or a Commodity Lead's commodity cut) — independent of the filter bar */
export function deriveCtx(base: Ctx, all: Idea[], comms: Commodity[], fy: string): Ctx {
  const months = fyMonths(fy)
  const ids = new Set(all.map((i) => i.id))
  const hard = new Set(all.filter((i) => i.savingsType === 'Hard').map((i) => i.id))
  const led = base.ledgerAll.filter((l) => ids.has(l.ideaId) && months.includes(l.month))
  return {
    ...base, all, ideas: all.filter((i) => i.bucket !== 'Draft'), fy, months,
    sum: summarise(all, base.ledgerAll, 0, fy, base.fv, base.lrm), led, hardLed: led.filter((l) => hard.has(l.ideaId)),
    scopeCommodities: comms, byId: new Map(all.map((i) => [i.id, i])),
    filters: { fy, quarter: 'All', plant: 'All', categoryId: 'All', commodity: 'All', buyerId: 'All', leverId: 'All', buyingType: 'All' },
  }
}

// ─── small helpers ────────────────────────────────────────────────────────────
export const nonDraft = (i: Idea) => i.bucket !== 'Draft'
export const isHardIdea = (i: Idea) => i.savingsType === 'Hard'
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN)
export const safeDiv = (a: number, b: number) => (b ? a / b : 0)
export const nameOf = (ctx: Ctx, userId?: string) => ctx.users.find((u) => u.id === userId)?.name ?? '—'
export const commodityOf = (ctx: Ctx, code: string) => ctx.commodities.find((c) => c.code === code)
export const commodityName = (ctx: Ctx, code: string) => commodityOf(ctx, code)?.name ?? code
export const supplierName = (ctx: Ctx, code?: string) => ctx.suppliers.find((s) => s.code === code)?.name ?? code ?? '—'
export const leverOf = (ctx: Ctx, id: string) => ctx.levers.find((l) => l.id === id)
export const groupSum = (ctx: Ctx, ideas: Idea[]) => summarise(ideas, ctx.ledgerAll, 0, ctx.fy, ctx.fv, ctx.lrm)
export const committedHard = (ctx: Ctx, i: Idea) => (isHardIdea(i) ? ideaCommitted(i, ctx.fy) : 0)
export const isOverdue = (ctx: Ctx, i: Idea) => i.bucket === 'In Execution' && i.execution?.status === 'In Execution' && i.execution.targetDate < ctx.today
export const doneDate = (i: Idea) => i.execution?.effectiveDate ?? i.implementedAt?.slice(0, 10)
export const isOnTime = (i: Idea) => !!i.execution && (doneDate(i) ?? '9999') <= i.execution.originalTargetDate
export const isBreach = (ctx: Ctx, i: Idea) => i.bucket === 'Pipeline' && ['breach', 'escalated'].includes(slaStatus(i, ctx.slaRules).state)

export function realisedOf(ctx: Ctx, ideas: Idea[], opts: { validatedOnly?: boolean; counting?: boolean } = {}) {
  const ids = new Set(ideas.filter(isHardIdea).map((i) => i.id))
  const vOnly = opts.validatedOnly || (opts.counting && ctx.fv)
  return sum(ctx.hardLed.filter((l) => ids.has(l.ideaId) && (!vOnly || l.financeStatus === 'Validated')).map((l) => l.realised))
}
export const leakageOf = (ctx: Ctx, ideas: Idea[]) => { const ids = new Set(ideas.map((i) => i.id)); return sum(ctx.led.filter((l) => ids.has(l.ideaId)).map((l) => l.leakage)) }

/** Monthly committed (planned) saving of an implemented idea — annualised at the approved price ÷ 12, pro-rated in the go-live month */
export function plannedByMonth(i: Idea, months: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  const eff = doneDate(i)
  if (i.bucket !== 'Implemented' || !eff) return out
  const annual = ideaApprovedAnnualised(i)
  const g = parse(eff)
  for (const m of months) {
    const [y, mo] = m.split('-').map(Number)
    const monthStart = new Date(y, mo - 1, 1), monthEnd = new Date(y, mo, 0)
    if (monthEnd < g) { out[m] = 0; continue }
    const frac = g > monthStart ? (monthEnd.getDate() - g.getDate() + 1) / monthEnd.getDate() : 1
    out[m] = (annual / 12) * frac
  }
  return out
}
/** Committed for the period = planned saving of implemented hard ideas up to the last realisation month */
export function committedToDate(ctx: Ctx, ideas: Idea[]) {
  const ms = ctx.months.filter((m) => m <= ctx.lrm)
  return sum(ideas.filter((i) => isHardIdea(i) && i.bucket === 'Implemented').map((i) => sum(Object.values(plannedByMonth(i, ms)))))
}
export const realisationRate = (ctx: Ctx, ideas: Idea[]) => safeDiv(realisedOf(ctx, ideas), committedToDate(ctx, ideas)) * 100

/** Quarter phasing of FY-committed saving (A4 cut by quarter) */
export function quarterPhasing(ctx: Ctx, i: Idea) {
  if (!isHardIdea(i)) return { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  if (i.bucket === 'In Execution') {
    const p = i.execution?.phasing
    if (p && p.Q1 + p.Q2 + p.Q3 + p.Q4 > 0) return p
    return phaseByQuarter(ideaAnnualised(i), goLiveOf(i), ctx.fy)
  }
  if (i.bucket === 'Implemented') return phaseByQuarter(ideaApprovedAnnualised(i), doneDate(i) ?? goLiveOf(i), ctx.fy)
  return { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
}

/** Who owns the idea's current stage (for ageing by owner) */
export function stageOwner(ctx: Ctx, i: Idea): { key: string; label: string } {
  const st = i.stage
  if (st === 'Buyer validation') return { key: i.buyerId, label: nameOf(ctx, i.buyerId) }
  if (FEASIBILITY_STAGES.includes(st)) {
    const code = i.feasibility?.supplierCode ?? i.proposedSupplier?.code ?? i.supplierCode
    return { key: `sup:${code}`, label: `${supplierName(ctx, code)} (supplier)` }
  }
  if (EVALUATION_STAGES.includes(st)) {
    const d = i.techEval?.evaluatorDept ?? 'R&D'
    return { key: `dept:${d}`, label: `${d} (evaluator)` }
  }
  if (st === 'Approval') {
    const a = i.approvals.find((x) => !x.decision)
    return { key: a?.approverId ?? 'approver', label: a?.approverId ? `${nameOf(ctx, a.approverId)} (${a.level})` : a?.level ?? 'Approver' }
  }
  const o = i.execution?.ownerId ?? i.ownerId ?? i.buyerId
  return { key: o, label: nameOf(ctx, o) }
}

/** Highest route stage index the idea reached (for stage-to-stage conversion) */
export function reachedIdx(i: Idea) {
  const stages = ROUTE_STAGES[i.route] ?? []
  return Math.max(-1, ...i.stageHistory.map((h) => stages.indexOf(h.stage)))
}
export function funnelSteps(ideas: Idea[]) {
  const sub = ideas.filter(nonDraft)
  const validated = sub.filter((i) => reachedIdx(i) >= 1)
  const approved = sub.filter((i) => !!i.approvedAt || i.bucket === 'In Execution' || i.bucket === 'Implemented')
  const impl = sub.filter((i) => i.bucket === 'Implemented')
  return [
    { step: 'Submitted', ideas: sub, n: sub.length },
    { step: 'Validated', ideas: validated, n: validated.length },
    { step: 'Approved', ideas: approved, n: approved.length },
    { step: 'Implemented', ideas: impl, n: impl.length },
  ]
}

// ─── Report 1 — Sourcing Home ────────────────────────────────────────────────
export function homeData(ctx: Ctx) {
  const trend = monthlyTrend(ctx.all, ctx.ledgerAll, ctx.fy)
  const t = trend.map((m) => ({ ...m, label: monthLabel(m.month).split(' ')[0], future: m.month > ctx.lrm }))
  const buckets = (['Pipeline', 'In Execution', 'Implemented', 'Dropped'] as const).map((b) => ({ bucket: b, count: ctx.sum.counts[b], value: ctx.sum.values[b] }))
  const top = [...ctx.ideas].filter((i) => i.bucket !== 'Dropped').sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 10)
  return { trend: t, buckets, top, steps: funnelSteps(ctx.all) }
}

// ─── Report 2 — Savings bridge: realised → committed → pipeline → total tracked ─
export function bridgeData(ctx: Ctx) {
  const s = ctx.sum
  const R = s.realisedCounting, C = s.remainingCommitted, P = s.pipeline
  const RC = R + C
  const total = RC + P
  const rows = [
    { key: 'realised', label: ctx.fv ? 'Realised (validated)' : 'Realised', base: 0, value: R, color: '#0f9f6e', drill: { bucket: 'Implemented' } as Record<string, string> },
    { key: 'committed', label: 'Committed (remaining)', base: R, value: C, color: '#ec8a1c', drill: { bucket: 'In Execution' } as Record<string, string> },
    { key: 'pipeline', label: 'Pipeline', base: RC, value: P, color: '#3b74f2', drill: { bucket: 'Pipeline' } as Record<string, string> },
    { key: 'total', label: 'Total tracked', base: 0, value: total, color: '#2459e0', drill: {} as Record<string, string> },
  ]
  return { rows, R, C, P, RC, total }
}

// ─── Report 3 — Commodity scorecard ──────────────────────────────────────────
export function commodityRows(ctx: Ctx) {
  return ctx.scopeCommodities.map((c) => {
    const ideas = ctx.all.filter((i) => i.commodity === c.code)
    const sm = groupSum(ctx, ideas)
    const sub = ideas.filter(nonDraft)
    const impl = sub.filter((i) => i.bucket === 'Implemented').length
    const structural = realisedOf(ctx, ideas.filter((i) => STRUCTURAL_LEVERS.includes(i.leverId)))
    return {
      code: c.code, name: c.name, categoryId: c.categoryId, buyerId: c.buyerId, leadId: c.leadId, spend: c.addressableSpend,
      realised: sm.realisedCounting, realisedAll: sm.realised, remaining: sm.remainingCommitted, committed: sm.committed,
      pipeline: sm.pipeline, carryOver: sm.carryOver, leakage: sm.leakage,
      submitted: sub.length, implemented: impl, dropped: sub.filter((i) => i.bucket === 'Dropped').length, conversion: safeDiv(impl, sub.length) * 100,
      spendPct: safeDiv(sm.realised, c.addressableSpend) * 100, structuralPct: safeDiv(structural, sm.realised) * 100, ideas,
    }
  })
}

// ─── Report 4 — Buyer scorecard ──────────────────────────────────────────────
export function buyerRows(ctx: Ctx) {
  const buyers = ctx.users.filter((u) => u.roles.includes('buyer') && (ctx.filters.buyerId === 'All' || u.id === ctx.filters.buyerId))
  const scopeCodes = new Set(ctx.scopeCommodities.map((c) => c.code))
  return buyers
    .filter((b) => ctx.all.some((i) => i.buyerId === b.id) || ctx.commodities.some((c) => c.buyerId === b.id && scopeCodes.has(c.code)))
    .map((b) => {
      const ideas = ctx.all.filter((i) => i.buyerId === b.id)
      const sm = groupSum(ctx, ideas)
      const done = ideas.filter((i) => i.bucket === 'Implemented' && i.execution)
      const onTime = done.filter(isOnTime)
      const overdueIdeas = ideas.filter((i) => isOverdue(ctx, i))
      const open = ideas.filter((i) => i.bucket === 'Pipeline' || i.bucket === 'In Execution')
      const breaches = ideas.filter((i) => isBreach(ctx, i))
      return {
        id: b.id, name: b.name, color: b.avatarColor, commodities: ctx.commodities.filter((c) => c.buyerId === b.id).map((c) => c.code),
        realised: sm.realisedCounting, committed: sm.remainingCommitted, pipeline: sm.pipeline,
        done: done.length, onTime: onTime.length, onTimePct: done.length ? (onTime.length / done.length) * 100 : NaN,
        overdueValue: sum(overdueIdeas.map((i) => committedHard(ctx, i))), overdueCount: overdueIdeas.length, overdueIdeas,
        avgAge: mean(open.map(stageAgeDays)), openCount: open.length, breaches: breaches.length, breachIdeas: breaches, ideas,
        realisationRate: realisationRate(ctx, ideas),
      }
    })
}

// ─── Report 5 — Supplier innovation scorecard ────────────────────────────────
export function supplierRows(ctx: Ctx) {
  const codes = new Set<string>()
  ctx.ideas.forEach((i) => i.supplierCode && codes.add(i.supplierCode))
  ctx.led.forEach((l) => codes.add(l.supplierCode))
  return [...codes]
    .map((code) => {
      const sup = ctx.suppliers.find((s) => s.code === code)
      const ideas = ctx.ideas.filter((i) => i.supplierCode === code)
      const own = ideas.filter((i) => i.isSupplierSubmission)
      const impl = ideas.filter((i) => i.bucket === 'Implemented').length
      const gs = own.filter((i) => i.gainSharePct != null).map((i) => i.gainSharePct!)
      const rows = ctx.led.filter((l) => l.supplierCode === code)
      const feas = ctx.ideas.filter((i) => i.feasibility?.supplierCode === code)
      const responded = feas.filter((i) => i.feasibility?.respondedAt)
      return {
        code, name: sup?.name ?? code, city: sup?.city ?? '—', commodities: sup?.commodities ?? [], spend: sup?.spend ?? 0,
        ideas: ideas.length, supplierSubmitted: own.length, value: sum(ideas.map((i) => ideaAnnualised(i))), implemented: impl,
        conversion: safeDiv(impl, ideas.length) * 100, gainShare: gs.length ? mean(gs) : NaN,
        realised: sum(rows.filter((l) => ctx.byId.get(l.ideaId)?.savingsType === 'Hard').map((l) => l.realised)),
        leakage: sum(rows.map((l) => l.leakage)), leakEntries: rows.filter((l) => l.leakage > 0).length,
        feasRequests: feas.length, feasResponded: responded.length,
        feasDays: mean(responded.map((i) => daysBetween(i.feasibility!.requestedAt, i.feasibility!.respondedAt!))),
        ideaList: ideas,
      }
    })
    .sort((a, b) => b.value - a.value)
}

// ─── Report 6 — Lever mix ────────────────────────────────────────────────────
export const NEGOTIATION_FLAG_PCT = 40
export function leverData(ctx: Ctx) {
  const total = sum(ctx.hardLed.map((l) => l.realised))
  const rows = ctx.levers
    .map((lv) => {
      const ideas = ctx.ideas.filter((i) => i.leverId === lv.id)
      const realised = realisedOf(ctx, ideas)
      return {
        id: lv.id, name: lv.name, group: lv.group, icon: lv.icon, structural: STRUCTURAL_LEVERS.includes(lv.id), realised, share: safeDiv(realised, total) * 100,
        pipeline: sum(ideas.filter((i) => i.bucket === 'Pipeline' && isHardIdea(i)).map((i) => ideaAnnualised(i))), count: ideas.length,
        implemented: ideas.filter((i) => i.bucket === 'Implemented').length, ideas,
      }
    })
    .filter((r) => r.count > 0 || r.realised > 0)
    .sort((a, b) => b.realised - a.realised)
  const byGroup = new Map<string, number>()
  rows.forEach((r) => byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + r.realised))
  const groups = [...byGroup.entries()].map(([group, realised]) => ({ group, realised, share: safeDiv(realised, total) * 100 })).sort((a, b) => b.realised - a.realised)
  const negotiated = groups.find((g) => g.group === 'Commercial')?.share ?? 0
  const negotiationLever = rows.find((r) => r.id === 'L01')?.share ?? 0
  const structuralTotal = sum(rows.filter((r) => r.structural).map((r) => r.realised))
  let cumS = 0, cumT = 0
  const trend = ctx.months.filter((m) => m <= ctx.lrm).map((m) => {
    const monthRows = ctx.hardLed.filter((l) => l.month === m)
    const t = sum(monthRows.map((l) => l.realised))
    const s = sum(monthRows.filter((l) => STRUCTURAL_LEVERS.includes(ctx.byId.get(l.ideaId)?.leverId ?? '')).map((l) => l.realised))
    cumS += s; cumT += t
    return { month: m, label: monthLabel(m), structural: s, other: t - s, share: safeDiv(s, t) * 100, cumShare: safeDiv(cumS, cumT) * 100 }
  })
  return { rows, groups, total, negotiated, negotiationLever, structuralShare: safeDiv(structuralTotal, total) * 100, structuralTotal, trend, flag: negotiated > NEGOTIATION_FLAG_PCT }
}

// ─── Report 7 — Execution Hub dashboard ──────────────────────────────────────
export function executionData(ctx: Ctx) {
  const ym = ymOf(ctx.today)
  const inExec = ctx.ideas.filter((i) => i.bucket === 'In Execution' && i.execution)
  const withHealth = inExec.map((i) => ({ idea: i, health: healthOf(i) as Health, committed: committedHard(ctx, i) }))
  const due = withHealth.filter((x) => ymOf(x.idea.execution!.targetDate) === ym && x.idea.execution!.targetDate >= ctx.today)
  const overdue = withHealth.filter((x) => isOverdue(ctx, x.idea))
  const atRisk = withHealth.filter((x) => x.health === 'At risk')
  const doneMonth = ctx.ideas.filter((i) => i.bucket === 'Implemented' && (i.implementedAt ?? '').slice(0, 7) === ym)
  const droppedMonth = ctx.ideas.filter((i) => i.bucket === 'Dropped' && (i.droppedAt ?? '').slice(0, 7) === ym)
  const health = (['On track', 'At risk', 'Delayed'] as Health[]).map((h) => ({ health: h, items: withHealth.filter((x) => x.health === h) }))
  return { ym, inExec: withHealth, due, overdue, atRisk, doneMonth, droppedMonth, health, committed: sum(withHealth.map((x) => x.committed)) }
}

// ─── Report 8 — Drop analysis ────────────────────────────────────────────────
export function dropData(ctx: Ctx) {
  const dropped = ctx.ideas.filter((i) => i.bucket === 'Dropped')
  const reasonsCount = new Map<string, number>()
  dropped.forEach((i) => reasonsCount.set(i.dropReason ?? 'Not specified', (reasonsCount.get(i.dropReason ?? 'Not specified') ?? 0) + 1))
  const reasons = [...reasonsCount.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r)
  const months = ctx.months.map((m) => {
    const row: Record<string, any> = { month: m, label: monthLabel(m).split(' ')[0] }
    const list = dropped.filter((i) => (i.droppedAt ?? '').slice(0, 7) === m)
    reasons.forEach((r) => (row[r] = list.filter((i) => (i.dropReason ?? 'Not specified') === r).length))
    row.total = list.length
    row.value = sum(list.map((i) => ideaAnnualised(i)))
    return row
  })
  const stageMap = new Map<string, Idea[]>()
  dropped.forEach((i) => { const k = i.dropStage ?? 'Unknown'; stageMap.set(k, [...(stageMap.get(k) ?? []), i]) })
  const stages = [...stageMap.entries()].map(([stage, list]) => ({ stage, count: list.length, value: sum(list.map((i) => ideaAnnualised(i))), ideas: list })).sort((a, b) => b.count - a.count)
  const byReason = reasons.map((r) => { const list = dropped.filter((i) => (i.dropReason ?? 'Not specified') === r); return { reason: r, count: list.length, value: sum(list.map((i) => ideaAnnualised(i))), ideas: list } })
  return { dropped, reasons, months, stages, byReason, rate: safeDiv(dropped.length, ctx.ideas.length) * 100, value: sum(dropped.map((i) => ideaAnnualised(i))) }
}

// ─── Report 9 — Ageing & SLA breach ──────────────────────────────────────────
export const SLA_STATES = ['ok', 'due', 'breach', 'escalated'] as const
export const SLA_STATE_STYLE: Record<string, { label: string; color: string }> = {
  ok: { label: 'Within SLA', color: '#0f9f6e' },
  due: { label: 'Reminder due', color: '#ec8a1c' },
  breach: { label: 'SLA breached', color: '#e0364f' },
  escalated: { label: 'Escalated', color: '#a3143a' },
}
export function ageingData(ctx: Ctx) {
  const rows = ctx.ideas
    .filter((i) => i.bucket === 'Pipeline')
    .map((i) => ({ idea: i, sla: slaStatus(i, ctx.slaRules), owner: stageOwner(ctx, i), age: stageAgeDays(i) }))
    .filter((r) => r.sla.state !== 'none')
  const stageKeys = ctx.slaRules.map((r) => r.stage).filter((k) => k !== 'Finance validation')
  const byStage = stageKeys.map((k) => {
    const list = rows.filter((r) => r.sla.key === k)
    const o: Record<string, any> = { stage: k, total: list.length, list }
    SLA_STATES.forEach((s) => (o[s] = list.filter((r) => r.sla.state === s).length))
    return o
  })
  const ownerMap = new Map<string, { key: string; label: string; list: typeof rows }>()
  rows.forEach((r) => { const e = ownerMap.get(r.owner.key) ?? { key: r.owner.key, label: r.owner.label, list: [] }; e.list.push(r); ownerMap.set(r.owner.key, e) })
  const byOwner = [...ownerMap.values()]
    .map((o) => ({ ...o, breach: o.list.filter((r) => r.sla.state === 'breach' || r.sla.state === 'escalated').length, escalated: o.list.filter((r) => r.sla.state === 'escalated').length, avgAge: mean(o.list.map((r) => r.age)) }))
    .sort((a, b) => b.breach - a.breach || b.list.length - a.list.length)
  const breached = rows.filter((r) => r.sla.state === 'breach' || r.sla.state === 'escalated').sort((a, b) => a.sla.left - b.sla.left)
  // Finance validation SLA on ledger months awaiting validation
  const finRule = ctx.slaRules.find((r) => r.stage === 'Finance validation')
  const pending = ctx.led.filter((l) => l.financeStatus === 'Pending')
  const finGroups = new Map<string, { ideaId: string; month: string; wd: number; value: number }>()
  pending.forEach((l) => {
    const k = `${l.ideaId}|${l.month}`
    const wd = workingDaysBetween(l.postedAt.slice(0, 10), ctx.today)
    const e = finGroups.get(k) ?? { ideaId: l.ideaId, month: l.month, wd, value: 0 }
    e.value += l.realised
    finGroups.set(k, e)
  })
  const fin = [...finGroups.values()].map((f) => ({ ...f, breach: finRule ? f.wd > finRule.slaDays : false }))
  return { rows, byStage, byOwner, breached, fin, finRule, avgAge: mean(rows.map((r) => r.age)) }
}

// ─── Report 10 — Campaign effectiveness ──────────────────────────────────────
export function campaignRows(ctx: Ctx) {
  const scopeCodes = new Set(ctx.scopeCommodities.map((c) => c.code))
  return ctx.campaigns
    .filter((c) => scopeCodes.has(c.commodity) || ctx.ideas.some((i) => i.campaignId === c.id))
    .map((c) => {
      const ideas = ctx.ideas.filter((i) => i.campaignId === c.id)
      const impl = ideas.filter((i) => i.bucket === 'Implemented').length
      const approved = ideas.filter((i) => i.bucket === 'In Execution' || i.bucket === 'Implemented').length
      const value = sum(ideas.map((i) => ideaAnnualised(i)))
      const att = Object.values(c.attendance ?? {})
      return {
        id: c.id, name: c.name, type: c.type, status: c.status, commodity: c.commodity, startDate: c.startDate, endDate: c.endDate, workshopDate: c.workshopDate,
        suppliers: c.suppliers.length, attended: att.filter((a) => a === 'Attended').length, accepted: att.filter((a) => a === 'Accepted' || a === 'Attended').length,
        ideas: ideas.length, value, approved, implemented: impl, conversion: safeDiv(impl, ideas.length) * 100,
        supplierIdeas: ideas.filter((i) => i.isSupplierSubmission).length, realised: realisedOf(ctx, ideas), ideaList: ideas,
      }
    })
}

// ─── Report 11 — Realisation & leakage ───────────────────────────────────────
export function leakageData(ctx: Ctx) {
  const ms = ctx.months.filter((m) => m <= ctx.lrm)
  const implHard = ctx.ideas.filter((i) => isHardIdea(i) && i.bucket === 'Implemented')
  const plans = implHard.map((i) => plannedByMonth(i, ms))
  const monthly = ms.map((m) => {
    const rows = ctx.hardLed.filter((l) => l.month === m)
    return {
      month: m, label: monthLabel(m), committed: sum(plans.map((p) => p[m] ?? 0)), realised: sum(rows.map((l) => l.realised)),
      validated: sum(rows.filter((l) => l.financeStatus === 'Validated').map((l) => l.realised)), leakage: sum(ctx.led.filter((l) => l.month === m).map((l) => l.leakage)),
    }
  })
  const supMap = new Map<string, LedgerEntry[]>()
  ctx.led.filter((l) => l.leakage > 0).forEach((l) => supMap.set(l.supplierCode, [...(supMap.get(l.supplierCode) ?? []), l]))
  const bySupplier = [...supMap.entries()]
    .map(([code, rows]) => ({ code, name: supplierName(ctx, code), leakage: sum(rows.map((l) => l.leakage)), entries: rows.length, parts: new Set(rows.map((l) => l.partCode)).size, ideas: [...new Set(rows.map((l) => l.ideaId))], rows }))
    .sort((a, b) => b.leakage - a.leakage)
  const byCommodity = ctx.scopeCommodities
    .map((c) => {
      const ideas = ctx.ideas.filter((i) => i.commodity === c.code)
      const committedTD = committedToDate(ctx, ideas)
      const realised = realisedOf(ctx, ideas)
      return { code: c.code, name: c.name, committedFy: sum(ideas.map((i) => committedHard(ctx, i))), committedTD, realised, rate: safeDiv(realised, committedTD) * 100, leakage: leakageOf(ctx, ideas), ideas }
    })
    .filter((r) => r.committedFy > 0 || r.realised > 0)
  const exceptions = (['Price leakage', 'No MRN received', 'Volume below 50% of plan'] as const).map((e) => ({ exception: e, rows: ctx.led.filter((l) => l.exceptions.includes(e)) }))
  const committedTD = sum(monthly.map((m) => m.committed))
  const realised = sum(monthly.map((m) => m.realised))
  return { monthly, bySupplier, byCommodity, exceptions, committedTD, realised, rate: safeDiv(realised, committedTD) * 100, leakage: sum(ctx.led.map((l) => l.leakage)), leakRows: ctx.led.filter((l) => l.leakage > 0) }
}

// ─── Report 12 — FY closure & carry-over ─────────────────────────────────────
export function closureData(ctx: Ctx) {
  const rows = commodityRows(ctx)
  const q = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  ctx.ideas.forEach((i) => { const p = quarterPhasing(ctx, i); q.Q1 += p.Q1; q.Q2 += p.Q2; q.Q3 += p.Q3; q.Q4 += p.Q4 })
  const realisedQ = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  ctx.hardLed.forEach((l) => { realisedQ[quarterOf(l.month + '-01')] += l.realised })
  const open = ctx.ideas.filter((i) => i.bucket === 'Pipeline' || i.bucket === 'In Execution')
  const rollIn = open.filter((i) => i.bucket === 'Pipeline' || (i.execution && i.execution.targetDate > fyEnd(ctx.fy)))
  return {
    rows, quarters: (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((k) => ({ q: k, committed: q[k], realised: realisedQ[k] })),
    open, rollIn, closed: !!ctx.fyClosed[ctx.fy], next: nextFy(ctx.fy), fyEnd: fyEnd(ctx.fy),
    carry: ctx.sum.carryOver, inFy: ctx.sum.committed,
  }
}

// ─── Monthly mailer (mirrors store.sendMonthlyReport so the preview equals what is sent) ─────
export function mailerNumbers(ideasAll: Idea[], ledger: LedgerEntry[], commodities: Commodity[], settings: Settings, month: string, fy: string, commodityCodes?: string[]) {
  const comms = commodityCodes ? commodities.filter((c) => commodityCodes.includes(c.code)) : commodities
  const codes = new Set(comms.map((c) => c.code))
  const ideas = ideasAll.filter((i) => i.fy === fy && (!commodityCodes || codes.has(i.commodity)))
  const sm = summarise(ideas, ledger, 0, fy, settings.financeValidation, settings.lastRealisationMonth)
  const ids = new Set(ideas.map((i) => i.id))
  const monthRealised = ledger.filter((l) => l.month === month && (!commodityCodes || ids.has(l.ideaId))).reduce((a, l) => a + l.realised, 0)
  return { realised: sm.realisedCounting, committed: sm.remainingCommitted, pipeline: sm.pipeline, monthRealised, sum: sm, ideas }
}

export const ALL_STAGES_ORDER = ['Buyer validation', 'Supplier confirmation', 'Supplier feasibility', 'New supplier feasibility', 'DQA qualification', 'R&D evaluation (+DQA/Quality)', 'Owning department evaluation', 'Approval', 'NPD sample', 'NPD ECN up to sample approval', 'Execution', 'Price revision in PAP', 'Price / source change in PAP', 'Implemented', 'Dropped', 'Rejected']

/** Avg days per stage from stage history (C3) */
export function stageDurations(ctx: Ctx, ideas: Idea[]) {
  const now = ctx.today
  const map = new Map<string, number[]>()
  ideas.forEach((i) => i.stageHistory.forEach((h) => {
    if (['Draft', 'Implemented', 'Dropped', 'Rejected'].includes(h.stage)) return
    const d = daysBetween(h.enteredAt.slice(0, 10), (h.exitedAt ?? now).slice(0, 10))
    map.set(h.stage, [...(map.get(h.stage) ?? []), Math.max(0, d)])
  }))
  return [...map.entries()]
    .map(([stage, arr]) => ({ stage, avg: mean(arr), n: arr.length }))
    .sort((a, b) => ALL_STAGES_ORDER.indexOf(a.stage) - ALL_STAGES_ORDER.indexOf(b.stage))
}
