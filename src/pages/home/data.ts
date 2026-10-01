// Data hooks for the Sourcing Home (KPI group A, Section 10) — all numbers derive from lib/calc
import { useMemo } from 'react'
import { useStore, useMe } from '../../store/useStore'
import { useFilteredIdeas, useScopedTarget, useSummary } from '../../lib/hooks'
import { ideaAnnualised, ideaApprovedAnnualised, ideaCommitted, isHard, monthlyTrend } from '../../lib/calc'
import { fyMonths, monthShort, parse, sum, todayIso, ymOf } from '../../lib/format'
import type { Bucket, Idea, LedgerEntry } from '../../lib/types'
import { useFy } from './shared'

export const BUCKETS: Exclude<Bucket, 'Draft'>[] = ['Pipeline', 'In Execution', 'Implemented', 'Dropped']

/** Commodities in the scope of the active filters and the user's commodity mapping (Section 3) */
export function useScopedCommodities() {
  const { commodities, categories, filters } = useStore()
  const me = useMe()
  return useMemo(() => {
    let list = commodities
    if (filters.commodity !== 'All') list = list.filter((c) => c.code === filters.commodity)
    else if (filters.categoryId !== 'All') list = list.filter((c) => c.categoryId === filters.categoryId)
    if (me && !me.roles.some((r) => ['head', 'finance', 'mgmt', 'admin'].includes(r)) && me.commodities.length) list = list.filter((c) => me.commodities.includes(c.code))
    if (filters.buyerId !== 'All') list = list.filter((c) => c.buyerId === filters.buyerId)
    if (filters.buyingType !== 'All') {
      const cats = categories.filter((c) => c.buyingType === filters.buyingType).map((c) => c.id)
      list = list.filter((c) => cats.includes(c.categoryId))
    }
    return list
  }, [commodities, categories, filters, me])
}

/** Addressable spend in the scope of the active filters (A2 denominator) */
export function useScopedSpend(): number {
  const { commodities, filters, plantTargets } = useStore()
  const list = useScopedCommodities()
  return useMemo(() => {
    const spend = list.reduce((a, c) => a + c.addressableSpend, 0)
    if (filters.plant !== 'All') {
      // spend is held at commodity level; a plant cut uses the plant's share of the FY target
      const totalTarget = commodities.reduce((a, c) => a + c.target, 0)
      return totalTarget ? spend * ((plantTargets[filters.plant] ?? 0) / totalTarget) : 0
    }
    return spend
  }, [list, commodities, filters.plant, plantTargets])
}

/** Ledger rows of the scoped ideas inside the FY */
export function useScopedLedger(ideas: Idea[], fy: string): LedgerEntry[] {
  const ledger = useStore((s) => s.ledger)
  return useMemo(() => {
    const ids = new Set(ideas.map((i) => i.id))
    const months = new Set(fyMonths(fy))
    return ledger.filter((l) => ids.has(l.ideaId) && months.has(l.month))
  }, [ledger, ideas, fy])
}

const FLOW_DATE: Record<Exclude<Bucket, 'Draft'>, (i: Idea) => string | undefined> = {
  Pipeline: (i) => i.submittedAt,
  'In Execution': (i) => i.approvedAt,
  Implemented: (i) => i.implementedAt ?? i.execution?.effectiveDate,
  Dropped: (i) => i.droppedAt,
}

/** Monthly ₹ inflow into each bucket (completed FY months) → sparkline + 3-month trend */
export function bucketFlows(ideas: Idea[], fy: string) {
  const cur = ymOf(todayIso())
  let months = fyMonths(fy).filter((m) => m < cur)
  if (!months.length) months = fyMonths(fy).slice(0, 1)
  const out = {} as Record<Exclude<Bucket, 'Draft'>, { months: string[]; values: number[]; counts: number[]; delta: number | null }>
  for (const b of BUCKETS) {
    const values = months.map((m) => sum(ideas.filter((i) => { const d = FLOW_DATE[b](i); return !!d && ymOf(d) === m }).map((i) => ideaAnnualised(i))))
    const counts = months.map((m) => ideas.filter((i) => { const d = FLOW_DATE[b](i); return !!d && ymOf(d) === m }).length)
    let delta: number | null = null
    if (values.length >= 6) {
      const last = sum(values.slice(-3)), prev = sum(values.slice(-6, -3))
      delta = prev > 0 ? ((last - prev) / prev) * 100 : null
    }
    out[b] = { months, values, counts, delta }
  }
  return out
}

/** Realisation plan for the period: approved annualised ÷ 12 for every month live up to the last realisation month */
export function committedForPeriod(ideas: Idea[], fy: string, lastMonth: string) {
  let total = 0
  for (const i of ideas) {
    if (i.bucket !== 'Implemented' || !isHard(i) || !i.execution?.effectiveDate) continue
    const eff = i.execution.effectiveDate
    const annual = ideaApprovedAnnualised(i)
    for (const m of fyMonths(fy)) {
      if (m > lastMonth || m < ymOf(eff)) continue
      let frac = 1
      if (m === ymOf(eff)) { const d = parse(eff); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); frac = (dim - d.getDate() + 1) / dim }
      total += (annual / 12) * frac
    }
  }
  return total
}

export interface TrendPoint { month: string; label: string; realised: number | null; validated: number | null; cumulative: number | null; runRate: number; forecast: number | null }

/** Everything the Sourcing Home needs, derived once */
export function useHomeData() {
  const ideas = useFilteredIdeas()
  const summary = useSummary()
  const target = useScopedTarget()
  const spend = useScopedSpend()
  const fy = useFy()
  const settings = useStore((s) => s.settings)
  const ledgerAll = useStore((s) => s.ledger)
  const ledger = useScopedLedger(ideas, fy)

  return useMemo(() => {
    const active = ideas.filter((i) => i.bucket !== 'Draft')
    const hard = active.filter(isHard)
    const committedExec = sum(hard.filter((i) => i.bucket === 'In Execution').map((i) => ideaCommitted(i, fy)))
    const pipelineCount = hard.filter((i) => i.bucket === 'Pipeline').length

    // savings trend — realised bars, validated, cumulative (counts toward target), target run-rate, landing path
    const t = monthlyTrend(ideas, ledgerAll, fy)
    const lrm = settings.lastRealisationMonth
    let cum = 0
    const trend: TrendPoint[] = t.map((m, k) => {
      const has = m.month <= lrm
      cum += settings.financeValidation ? m.validated : m.realised
      return { month: m.month, label: monthShort(m.month), realised: has ? m.realised : null, validated: has ? m.validated : null, cumulative: has ? cum : null, runRate: (target * (k + 1)) / 12, forecast: null }
    })
    const li = trend.findIndex((d) => d.month === lrm)
    if (li >= 0 && li < trend.length - 1) {
      const start = trend[li].cumulative ?? 0
      for (let k = li; k < trend.length; k++) trend[k].forecast = start + ((summary.landing - start) * (k - li)) / (trend.length - 1 - li)
    }

    const flows = bucketFlows(ideas, fy)
    const leakRows = ledger.filter((l) => l.leakage > 0)
    const submitted = active.length
    const implemented = active.filter((i) => i.bucket === 'Implemented').length
    return {
      ideas, active, summary, target, spend, fy, ledger, trend, flows, committedExec, pipelineCount,
      leakRows, conversion: submitted ? (implemented / submitted) * 100 : 0, submitted, implemented,
      periodCommitted: committedForPeriod(ideas, fy, lrm),
    }
  }, [ideas, summary, target, spend, fy, ledgerAll, ledger, settings.lastRealisationMonth, settings.financeValidation])
}
export type HomeData = ReturnType<typeof useHomeData>
