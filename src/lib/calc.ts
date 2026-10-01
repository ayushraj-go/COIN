// Section 4 — savings methodology. One rule for every buyer.
import type { Bucket, Commodity, Filters, Health, Idea, IdeaPart, LedgerEntry, Lever, RouteKey, SlaRule, User } from './types'
import { ROUTE_STAGES, STAGE_SLA_KEY, EVALUATION_STAGES, FEASIBILITY_STAGES, LAKH } from './masters'
import { daysBetween, fyEnd, fyMonths, fyStart, parse, quarterOf, sum, today, todayIso, workingDaysBetween, ymOf, iso } from './format'

/** Saving per unit = P(baseline) − P(new) */
export const savingPerUnit = (p: IdeaPart, useApproved = false) => p.baselinePrice - (useApproved && p.approvedPrice != null ? p.approvedPrice : p.newPrice)
export const savingPct = (p: IdeaPart) => (p.baselinePrice ? (savingPerUnit(p) / p.baselinePrice) * 100 : 0)
/** Annualised impact = (P(baseline) − P(new)) × Q(last FY MRN) */
export const partAnnualised = (p: IdeaPart, useApproved = false) => savingPerUnit(p, useApproved) * (p.annualVolume || 0)

export function ideaAnnualised(idea: Pick<Idea, 'parts' | 'scope' | 'openEstimateLakh'>, useApproved = false): number {
  if (idea.scope === 'Open' || !idea.parts?.length) return (idea.openEstimateLakh || 0) * LAKH
  return sum(idea.parts.map((p) => partAnnualised(p, useApproved)))
}
/** Approved annualised (uses approved revised price where available) */
export const ideaApprovedAnnualised = (idea: Idea) => ideaAnnualised(idea, true)

export function ideaSavingPct(idea: Idea): number {
  if (!idea.parts?.length) return 0
  const base = sum(idea.parts.map((p) => p.baselinePrice * p.annualVolume))
  return base ? (ideaAnnualised(idea) / base) * 100 : 0
}
/** Net saving = Annualised impact − One-time investment */
export const netSaving = (annual: number, investment: number) => annual - (investment || 0)
/** Payback (months) = One-time investment ÷ (Annualised impact ÷ 12) */
export const paybackMonths = (annual: number, investment: number) => (annual > 0 && investment > 0 ? investment / (annual / 12) : 0)

/** Months of the FY that fall on/after the go-live date (fractional by day for the first month) */
export function fyMonthsFrom(goLive: string, fy: string): number {
  const s = parse(fyStart(fy)), e = parse(fyEnd(fy)), g = parse(goLive)
  if (g > e) return 0
  if (g <= s) return 12
  const months = (e.getFullYear() - g.getFullYear()) * 12 + (e.getMonth() - g.getMonth())
  const daysInMonth = new Date(g.getFullYear(), g.getMonth() + 1, 0).getDate()
  const firstFrac = (daysInMonth - g.getDate() + 1) / daysInMonth
  return months + firstFrac
}
/** Committed saving (in-FY) = annualised × months live in FY ÷ 12. Worked example: ₹ 8.40 L live 1 Oct → ₹ 4.20 L */
export const committedInFy = (annual: number, goLive: string, fy: string) => (annual * fyMonthsFrom(goLive, fy)) / 12
/** Carry-over = annualised impact falling beyond 31 March */
export const carryOver = (annual: number, goLive: string, fy: string) => annual - committedInFy(annual, goLive, fy)

/** Quarter phasing Q1..Q4 pre-filled from go-live date and annualised impact */
export function phaseByQuarter(annual: number, goLive: string, fy: string) {
  const out = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  const g = parse(goLive)
  for (const ym of fyMonths(fy)) {
    const [y, m] = ym.split('-').map(Number)
    const monthEnd = new Date(y, m, 0)
    if (monthEnd < g) continue
    const monthStart = new Date(y, m - 1, 1)
    const frac = g > monthStart ? (monthEnd.getDate() - g.getDate() + 1) / monthEnd.getDate() : 1
    out[quarterOf(monthStart)] += (annual / 12) * frac
  }
  return out
}

export function goLiveOf(idea: Idea): string {
  if (idea.execution?.effectiveDate) return idea.execution.effectiveDate
  if (idea.execution?.targetDate) return idea.execution.targetDate
  return todayIso()
}

// ─── Buckets & stages ─────────────────────────────────────────────────────────
export function bucketFor(route: RouteKey, stage: string): Bucket {
  if (stage === 'Draft') return 'Draft'
  if (stage === 'Dropped' || stage === 'Rejected') return 'Dropped'
  if (stage === 'Implemented') return 'Implemented'
  const stages = ROUTE_STAGES[route]
  const ai = stages.indexOf('Approval')
  const si = stages.indexOf(stage)
  return si > ai ? 'In Execution' : 'Pipeline'
}
export const BUCKET_STYLE: Record<Bucket, { color: string; soft: string; text: string; label: string }> = {
  Draft: { color: '#94a3b8', soft: '#f6f7fb', text: '#475569', label: 'Draft' },
  Pipeline: { color: '#4470d6', soft: '#eef3ff', text: '#2a4fcf', label: 'Pipeline' },
  'In Execution': { color: '#ec8a1c', soft: '#fff6ea', text: '#b35f0c', label: 'In Execution' },
  Implemented: { color: '#14ab92', soft: '#ecfdf9', text: '#0d6e61', label: 'Implemented' },
  Dropped: { color: '#6b7280', soft: '#f3f4f6', text: '#4b5563', label: 'Dropped' },
}

export const isHard = (idea: Idea) => idea.savingsType === 'Hard'

// ─── Realisation ──────────────────────────────────────────────────────────────
export function ideaRealised(ledger: LedgerEntry[], ideaId: string, validatedOnly = false) {
  return sum(ledger.filter((l) => l.ideaId === ideaId && (!validatedOnly || l.financeStatus === 'Validated')).map((l) => l.realised))
}
export function ideaLeakage(ledger: LedgerEntry[], ideaId: string) {
  return sum(ledger.filter((l) => l.ideaId === ideaId).map((l) => l.leakage))
}

/** FY-phased committed value of an idea (In Execution or Implemented) */
export function ideaCommitted(idea: Idea, fy: string): number {
  if (idea.bucket !== 'In Execution' && idea.bucket !== 'Implemented') return 0
  if (idea.bucket === 'In Execution' && idea.execution?.phasing) {
    const p = idea.execution.phasing
    const s = p.Q1 + p.Q2 + p.Q3 + p.Q4
    if (s > 0) return s
  }
  const annual = idea.bucket === 'Implemented' ? ideaApprovedAnnualised(idea) : ideaAnnualised(idea)
  return committedInFy(annual, goLiveOf(idea), fy)
}

/** Remaining committed for the FY after the last realised month */
export function ideaRemainingCommitted(idea: Idea, fy: string, lastRealisedMonth: string): number {
  if (idea.bucket === 'In Execution') return ideaCommitted(idea, fy)
  if (idea.bucket !== 'Implemented') return 0
  const annual = ideaApprovedAnnualised(idea)
  const eff = idea.execution?.effectiveDate || idea.implementedAt || todayIso()
  const months = fyMonths(fy).filter((m) => m > lastRealisedMonth && m >= ymOf(eff))
  return (annual / 12) * months.length
}

// ─── Health & SLA ─────────────────────────────────────────────────────────────
export function healthOf(idea: Idea): Health {
  const ex = idea.execution
  if (!ex || ex.status !== 'In Execution') return 'On track'
  const t = todayIso()
  if (ex.targetDate < t) return 'Delayed'
  if (ex.milestones.some((m) => !m.doneDate && m.dueDate < t)) return 'At risk'
  return 'On track'
}
export const HEALTH_STYLE: Record<Health, { color: string; soft: string }> = {
  'On track': { color: '#0f9f6e', soft: '#f0fdf4' },
  'At risk': { color: '#ec8a1c', soft: '#fff7ed' },
  Delayed: { color: '#e0364f', soft: '#fef2f2' },
}

export function stageAgeDays(idea: Idea) {
  return Math.max(0, daysBetween(idea.stageEnteredAt.slice(0, 10), today()))
}
export function slaStatus(idea: Idea, rules: SlaRule[]) {
  const key = STAGE_SLA_KEY[idea.stage]
  const rule = rules.find((r) => r.stage === key)
  const wd = workingDaysBetween(idea.stageEnteredAt.slice(0, 10), today())
  if (!rule) return { key: null as string | null, working: wd, sla: 0, left: 0, state: 'none' as 'none' | 'ok' | 'due' | 'breach' | 'escalated', rule: null as SlaRule | null }
  const left = rule.slaDays - wd
  const state = wd >= rule.escalateDay ? 'escalated' : wd > rule.slaDays ? 'breach' : wd >= rule.reminderDay ? 'due' : 'ok'
  return { key, working: wd, sla: rule.slaDays, left, state, rule }
}

// ─── Visibility (Section 3) ───────────────────────────────────────────────────
export function canSeeIdea(user: User, idea: Idea): boolean {
  const r = user.roles
  if (r.some((x) => x === 'head' || x === 'finance' || x === 'mgmt' || x === 'admin')) return true
  if (idea.submitterId === user.id) return true
  if (r.includes('supplier')) return idea.supplierCode === user.supplierCode || idea.feasibility?.supplierCode === user.supplierCode
  if ((r.includes('buyer') || r.includes('lead')) && user.commodities.includes(idea.commodity)) return true
  if (r.includes('techeval') && idea.techEval && idea.techEval.evaluatorDept.includes(user.department)) return true
  return false
}
export const visibleIdeas = (user: User, ideas: Idea[]) => (user ? ideas.filter((i) => canSeeIdea(user, i)) : [])

export function applyFilters(ideas: Idea[], f: Filters, commodities: Commodity[]): Idea[] {
  return ideas.filter((i) => {
    if (f.fy && f.fy !== 'All' && i.fy !== f.fy) return false
    if (f.quarter && f.quarter !== 'All') {
      const d = i.submittedAt || i.createdAt
      if (quarterOf(d.slice(0, 10)) !== f.quarter) return false
    }
    if (f.plant && f.plant !== 'All' && i.plant !== f.plant) return false
    if (f.categoryId && f.categoryId !== 'All' && i.categoryId !== f.categoryId) return false
    if (f.commodity && f.commodity !== 'All' && i.commodity !== f.commodity) return false
    if (f.buyerId && f.buyerId !== 'All' && i.buyerId !== f.buyerId) return false
    if (f.leverId && f.leverId !== 'All' && i.leverId !== f.leverId) return false
    if (f.buyingType && f.buyingType !== 'All' && i.buyingType !== f.buyingType) return false
    return true
  })
}

// ─── Portfolio summary (KPI group A) ──────────────────────────────────────────
export interface Summary {
  target: number
  realised: number
  realisedValidated: number
  realisedCounting: number
  committed: number
  remainingCommitted: number
  landing: number
  gap: number
  pipeline: number
  coverage: number
  carryOver: number
  achievementPct: number
  landingPct: number
  leakage: number
  counts: Record<Bucket, number>
  values: Record<Bucket, number>
  avoidance: number
  oneTime: number
}

export function summarise(ideas: Idea[], ledger: LedgerEntry[], target: number, fy: string, financeValidation: boolean, lastRealisedMonth: string): Summary {
  const ids = new Set(ideas.map((i) => i.id))
  const led = ledger.filter((l) => ids.has(l.ideaId) && fyMonths(fy).includes(l.month))
  const hardIds = new Set(ideas.filter(isHard).map((i) => i.id))
  const realised = sum(led.filter((l) => hardIds.has(l.ideaId)).map((l) => l.realised))
  const realisedValidated = sum(led.filter((l) => hardIds.has(l.ideaId) && l.financeStatus === 'Validated').map((l) => l.realised))
  const realisedCounting = financeValidation ? realisedValidated : realised
  const counts = { Draft: 0, Pipeline: 0, 'In Execution': 0, Implemented: 0, Dropped: 0 } as Record<Bucket, number>
  const values = { Draft: 0, Pipeline: 0, 'In Execution': 0, Implemented: 0, Dropped: 0 } as Record<Bucket, number>
  let committed = 0, remaining = 0, pipeline = 0, carry = 0, avoidance = 0, oneTime = 0
  for (const i of ideas) {
    const a = ideaAnnualised(i)
    counts[i.bucket]++
    values[i.bucket] += a
    if (i.savingsType === 'Cost avoidance') { avoidance += a; continue }
    if (i.savingsType === 'One-time') { oneTime += a; continue }
    if (i.bucket === 'Pipeline') pipeline += a
    if (i.bucket === 'In Execution' || i.bucket === 'Implemented') {
      const c = ideaCommitted(i, fy)
      committed += c
      remaining += ideaRemainingCommitted(i, fy, lastRealisedMonth)
      carry += Math.max(0, (i.bucket === 'Implemented' ? ideaApprovedAnnualised(i) : a) - c)
    }
  }
  const landing = realisedCounting + remaining
  const gap = target - landing
  const remainingTarget = Math.max(1, target - realisedCounting)
  return {
    target, realised, realisedValidated, realisedCounting, committed, remainingCommitted: remaining, landing, gap, pipeline,
    coverage: (pipeline + remaining) / remainingTarget, carryOver: carry,
    achievementPct: target ? (realisedCounting / target) * 100 : 0, landingPct: target ? (landing / target) * 100 : 0,
    leakage: sum(led.map((l) => l.leakage)), counts, values, avoidance, oneTime,
  }
}

/** Monthly realised trend for FY (hard savings) */
export function monthlyTrend(ideas: Idea[], ledger: LedgerEntry[], fy: string) {
  const hard = new Set(ideas.filter(isHard).map((i) => i.id))
  let cum = 0
  return fyMonths(fy).map((m) => {
    const rows = ledger.filter((l) => l.month === m && hard.has(l.ideaId))
    const v = sum(rows.map((l) => l.realised))
    const validated = sum(rows.filter((l) => l.financeStatus === 'Validated').map((l) => l.realised))
    cum += v
    return { month: m, realised: v, validated, cumulative: cum, hasData: rows.length > 0 }
  })
}

export function leverGroupOf(levers: Lever[], id: string) {
  return levers.find((l) => l.id === id)?.group ?? 'Commercial'
}
export const STRUCTURAL_LEVERS = ['L06', 'L09', 'L10', 'L11', 'L12', 'L13'] // VA/VE + material + localisation

export function duplicateCandidates(ideas: Idea[], title: string, commodity: string, excludeId?: string) {
  const words = title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  if (words.length < 1) return []
  return ideas
    .filter((i) => i.id !== excludeId && i.stage !== 'Draft')
    .map((i) => {
      const t = i.title.toLowerCase()
      const hits = words.filter((w) => t.includes(w)).length
      const score = hits / words.length + (i.commodity === commodity ? 0.25 : 0)
      return { idea: i, score }
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

export function approvalLevels(annual: number, investment: number, xLakh: number, yLakh: number): string[] {
  const lv = ['Commodity Lead']
  if (annual > xLakh * LAKH || investment > yLakh * LAKH) lv.push('Sourcing Head')
  return lv
}

export const isFeasibilityStage = (s: string) => FEASIBILITY_STAGES.includes(s)
export const isEvaluationStage = (s: string) => EVALUATION_STAGES.includes(s)
export const isoToday = () => iso(today())
