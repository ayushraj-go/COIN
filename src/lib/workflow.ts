// COIN six-stage workflow — pure rules (no store, no React), unit-tested in workflow.test.ts.
// Idea submitted → Team feasibility check → <dept> evaluation → Sourcing approval → Execution started → Verification
import type { Idea, Part, RiskItem, RiskLevel, Supplier } from './types'
import { addMonthsYm, ymOf } from './format'

/** Below this annualised saving the supplier capability check is skipped */
export const SUPPLIER_CHECK_MIN = 5_00_000
/** Departments that run their own evaluation; every other department (Sourcing, Supplier, Management…) maps to Sourcing */
export const EVAL_DEPTS = ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance'] as const

export function evalDeptOf(department?: string): string {
  return department && (EVAL_DEPTS as readonly string[]).includes(department) ? department : 'Sourcing'
}

/** Display name of a stage for one idea: "Evaluation" becomes "<dept> evaluation" */
export function stageLabel(idea: { department?: string; evaluation?: { dept?: string } }, stage: string): string {
  if (stage !== 'Evaluation') return stage
  return `${idea.evaluation?.dept ?? evalDeptOf(idea.department)} evaluation`
}

export const needsSupplierCheck = (annual: number) => annual >= SUPPLIER_CHECK_MIN

/** Team feasibility check — reasons the entered cost may not be valid */
export function costFlags(idea: Pick<Idea, 'scope' | 'parts' | 'openEstimateLakh'>, parts: Pick<Part, 'code' | 'lbp' | 'poPrice'>[]): string[] {
  const flags: string[] = []
  if (idea.scope === 'Open' || !idea.parts?.length) {
    if (!((idea.openEstimateLakh ?? 0) > 0)) flags.push('Open idea has no saving estimate')
    return flags
  }
  for (const p of idea.parts) {
    if (p.newPrice >= p.baselinePrice) flags.push(`${p.partCode}: new price is not below the baseline`)
    else if ((p.baselinePrice - p.newPrice) / p.baselinePrice > 0.4) flags.push(`${p.partCode}: saving above 40 % — check the quote`)
    const m = parts.find((x) => x.code === p.partCode)
    const ref = m?.lbp ?? m?.poPrice
    if (ref && p.baselineSource !== 'Quoted' && Math.abs(p.baselinePrice - ref) / ref > 0.05) flags.push(`${p.partCode}: baseline differs from LBP / PO by more than 5 %`)
    if (!(p.annualVolume > 0)) flags.push(`${p.partCode}: no annual volume`)
  }
  return flags
}

const RISK_RANK: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 }
export function overallRisk(risks: RiskItem[]): RiskLevel {
  return risks.reduce<RiskLevel>((a, r) => (RISK_RANK[r.level] > RISK_RANK[a] ? r.level : a), 'Low')
}
export const riskTotal = (risks: RiskItem[]) => risks.reduce((a, r) => a + (r.costAtRisk || 0), 0)

/** Saving locked for the approved timeline = annualised × months ÷ 12 */
export const lockTarget = (annual: number, months: number) => (annual * months) / 12

export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const first = new Date(y, m - 1 + months, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const day = Math.min(d, last)
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const longDate = (isoDate: string) => {
  const d = new Date(isoDate.slice(0, 10) + 'T00:00:00')
  return isNaN(+d) ? isoDate : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Supplier capability request — asks "can you supply this?" and carries no Amber data */
export function supplierCapabilityEmail(i: { supplierName: string; contactName: string; item: string; spec: string; requiredBy: string; link: string; sender: string }) {
  const subject = `Capability request — ${i.item}`
  const body = [
    `Dear ${i.contactName || 'Sir / Madam'},`,
    '',
    `We are evaluating suppliers for the item below and would like to know whether ${i.supplierName} can supply it.`,
    '',
    `Item: ${i.item}`,
    `Specification: ${i.spec}`,
    `Required by: ${longDate(i.requiredBy)}`,
    '',
    'Please confirm your capability (can supply, meets specification, monthly capacity, lead time) using the secure form below. It takes about two minutes and needs no login.',
    '',
    i.link,
    '',
    'This request carries no commitment. Kindly respond within 7 days.',
    '',
    'Regards,',
    i.sender,
  ].join('\n')
  return { subject, body }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const groupIn = (n: number) => Math.round(n).toLocaleString('en-IN')
const groupUs = (n: number) => Math.round(n).toLocaleString('en-US')

/** Amber data that must not leave in a supplier email: part codes, prices, volumes, current suppliers, ₹ amounts */
export function amberDataLeaks(text: string, idea: Pick<Idea, 'parts'> & { supplierCode?: string }, suppliers: Pick<Supplier, 'code' | 'name'>[]): string[] {
  const leaks = new Set<string>()
  const lower = text.toLowerCase()
  const supplierHit = (code?: string, name?: string) => {
    if (code && text.includes(code)) leaks.add(`Supplier code ${code}`)
    if (name && name.length > 3 && lower.includes(name.toLowerCase())) leaks.add(`Current supplier ${name}`)
  }
  for (const p of idea.parts ?? []) {
    if (p.partCode && text.includes(p.partCode)) leaks.add(`Part code ${p.partCode}`)
    for (const price of [p.baselinePrice, p.newPrice, p.approvedPrice]) {
      if (!(price > 0)) continue
      const s = String(+price.toFixed(4))
      if (new RegExp(`(?<![\\d.,])${escapeRe(s)}0*(?![\\d])`).test(text)) leaks.add(`Price ${s}`)
    }
    if (p.annualVolume > 0 && [String(Math.round(p.annualVolume)), groupIn(p.annualVolume), groupUs(p.annualVolume)].some((v) => text.includes(v))) leaks.add(`Volume ${groupIn(p.annualVolume)}`)
    const [code, ...rest] = (p.currentSupplier ?? '').split(' · ')
    supplierHit(code?.trim(), rest.join(' · ').trim())
  }
  if (idea.supplierCode) supplierHit(idea.supplierCode, suppliers.find((s) => s.code === idea.supplierCode)?.name)
  if (/₹\s?\d/.test(text)) leaks.add('Rupee amount')
  return [...leaks]
}

export interface PlanRow { month: string; plan: number; planCum: number; actual: number | null; actualCum: number | null }
/** Plan vs actual for a locked target: plan = target spread evenly, actual = MRN savings by month, projection at the current run-rate */
export function planVsActual(a: { target: number; months: number; startDate: string; ledger: { month: string; realised: number }[]; lastActualMonth: string }) {
  const n = Math.max(1, Math.round(a.months || 1))
  const perMonth = (a.target || 0) / n
  const start = ymOf(a.startDate)
  let planCum = 0, actualCum = 0
  const rows: PlanRow[] = Array.from({ length: n }, (_, k) => {
    const month = addMonthsYm(start, k)
    planCum += perMonth
    const known = month <= a.lastActualMonth
    const actual = known ? a.ledger.filter((l) => l.month === month).reduce((s, l) => s + l.realised, 0) : null
    if (actual != null) actualCum += actual
    return { month, plan: perMonth, planCum, actual, actualCum: known ? actualCum : null }
  })
  const elapsed = rows.filter((r) => r.actual != null).length
  const planToDate = perMonth * elapsed
  const runRate = elapsed ? actualCum / elapsed : 0
  const projected = elapsed ? runRate * n : 0
  return { rows, actualToDate: actualCum, planToDate, runRate, projected, onTrack: !a.target || actualCum >= planToDate * 0.95, elapsed, months: n, target: a.target || 0 }
}

export interface Seg { key: string; label: string; count: number; value: number; ids: string[] }
const group = (list: Idea[], key: (i: Idea) => string, label: (i: Idea) => string, value: (i: Idea) => number): Seg[] => {
  const m = new Map<string, Seg>()
  for (const i of list) {
    const k = key(i) || '—'
    const s = m.get(k) ?? { key: k, label: label(i) || k, count: 0, value: 0, ids: [] }
    s.count++; s.value += value(i); s.ids.push(i.id)
    m.set(k, s)
  }
  return [...m.values()].sort((x, y) => y.value - x.value || y.count - x.count)
}
const total = (key: string, label: string, list: Idea[], value: (i: Idea) => number): Seg =>
  ({ key, label, count: list.length, value: list.reduce((a, i) => a + value(i), 0), ids: list.map((i) => i.id) })

/** Where ideas come from: internal (by commodity, department, individual) vs external supplier ideas (Tier 1 / Tier 2 / via campaigns) */
export function sourceBreakdown(ideas: Idea[], suppliers: Pick<Supplier, 'code' | 'tier'>[], value: (i: Idea) => number) {
  const internal = ideas.filter((i) => !i.isSupplierSubmission)
  const external = ideas.filter((i) => i.isSupplierSubmission)
  const tierOf = (i: Idea) => suppliers.find((s) => s.code === i.supplierCode)?.tier ?? 'Tier 2'
  return {
    internal: {
      count: internal.length, value: internal.reduce((a, i) => a + value(i), 0),
      byCommodity: group(internal, (i) => i.commodity, (i) => i.commodity, value),
      byDepartment: group(internal, (i) => i.department, (i) => i.department, value),
      byIndividual: group(internal, (i) => i.submitterId, (i) => i.submitterName, value),
    },
    external: {
      count: external.length, value: external.reduce((a, i) => a + value(i), 0),
      tier1: total('Tier 1', 'Tier 1 suppliers', external.filter((i) => tierOf(i) === 'Tier 1'), value),
      tier2: total('Tier 2', 'Tier 2 suppliers', external.filter((i) => tierOf(i) === 'Tier 2'), value),
      viaCampaign: total('campaign', 'Via campaigns & workshops', external.filter((i) => !!i.campaignId), value),
    },
  }
}
