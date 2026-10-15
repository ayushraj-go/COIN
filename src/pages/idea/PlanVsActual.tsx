// Plan vs actual for a locked budget + timeline: plan = locked target spread evenly over the timeline,
// actual = MRN-based savings by month, projection = actual run-rate over the whole timeline.
import { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import type { Idea, LedgerEntry } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { addMonthsYm, inrShort, monthLabel, sum } from '../../lib/format'
import { planVsActual } from '../../lib/workflow'
import { Icon, cn } from '../../components/ui'
import { AXIS_TICK, ChartTip, GRID_STROKE } from '../home/shared'

export const PLAN_COLOR = '#1b316f'
export const ACTUAL_COLOR = '#0f9f6e'
export const BEHIND_COLOR = '#d7192d'

/** Plan vs actual numbers for one idea (null until a lock is signed) */
export function useIdeaPlan(idea: Idea) {
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  return useMemo(() => (idea.lock ? planVsActual({ target: idea.lock.targetSaving, months: idea.lock.timelineMonths, startDate: idea.lock.startDate, ledger: ledger.filter((l) => l.ideaId === idea.id), lastActualMonth: last }) : null), [idea.lock, idea.id, ledger, last])
}

/** Portfolio plan vs actual — Σ of every locked plan vs Σ MRN savings, by month */
export function portfolioPlan(ideas: Idea[], ledger: LedgerEntry[], lastActualMonth: string) {
  const locked = ideas.filter((i) => i.lock && (i.bucket === 'In Execution' || i.bucket === 'Implemented'))
  const per = locked.map((i) => planVsActual({ target: i.lock!.targetSaving, months: i.lock!.timelineMonths, startDate: i.lock!.startDate, ledger: ledger.filter((l) => l.ideaId === i.id), lastActualMonth }))
  const months = [...new Set(per.flatMap((p) => p.rows.map((r) => r.month)))].sort()
  if (!months.length) return { rows: [], target: 0, actualToDate: 0, planToDate: 0, projected: 0, onTrack: true, ideas: 0 }
  const all: string[] = []
  for (let m = months[0]; m <= months[months.length - 1]; m = addMonthsYm(m, 1)) all.push(m)
  let planCum = 0, actualCum = 0
  const rows = all.map((m) => {
    const plan = sum(per.map((p) => p.rows.find((r) => r.month === m)?.plan ?? 0))
    const known = m <= lastActualMonth
    const actual = known ? sum(per.map((p) => p.rows.find((r) => r.month === m)?.actual ?? 0)) : null
    planCum += plan
    if (actual != null) actualCum += actual
    return { month: m, plan, planCum, actual, actualCum: known ? actualCum : null }
  })
  const actualToDate = sum(per.map((p) => p.actualToDate)), planToDate = sum(per.map((p) => p.planToDate))
  return { rows, target: sum(per.map((p) => p.target)), actualToDate, planToDate, projected: sum(per.map((p) => p.projected)), onTrack: actualToDate >= planToDate * 0.95, ideas: locked.length }
}

type Row = { month: string; plan: number; planCum: number; actual: number | null; actualCum: number | null }
export function PlanChart({ rows, projected, target, height = 190 }: { rows: Row[]; projected: number; target: number; height?: number }) {
  const lastKnown = [...rows].reverse().find((r) => r.actualCum != null)
  const n = rows.length
  // projection line from the last known cumulative actual to the run-rate projection at the end of the timeline
  const data = rows.map((r, k) => {
    const lk = lastKnown ? rows.indexOf(lastKnown) : -1
    const proj = lastKnown && k >= lk && n > 1 ? lastKnown.actualCum! + ((projected - lastKnown.actualCum!) * (k - lk)) / Math.max(1, n - 1 - lk) : null
    return { ...r, label: monthLabel(r.month), projection: proj }
  })
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => inrShort(v, 0)} width={58} domain={[0, Math.max(target, projected) * 1.08 || 1]} />
          <RTooltip content={<ChartTip />} cursor={{ fill: 'rgb(27 49 111 / .05)' }} />
          <Bar dataKey="actual" name="Actual (month)" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} opacity={0.35} />
          <Line dataKey="planCum" name="Plan (cumulative)" stroke={PLAN_COLOR} strokeDasharray="5 4" strokeWidth={2} dot={false} />
          <Line dataKey="actualCum" name="Actual (cumulative)" stroke={ACTUAL_COLOR} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          <Line dataKey="projection" name="Projection at run-rate" stroke={BEHIND_COLOR} strokeDasharray="2 4" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Headline numbers + chart; `sentence` spells out the run-rate projection */
export function PlanVsActualBlock({ p, compact }: { p: ReturnType<typeof planVsActual> | ReturnType<typeof portfolioPlan>; compact?: boolean }) {
  const behind = !p.onTrack
  const elapsed = p.rows.filter((r) => r.actual != null).length
  const sentence = !elapsed
    ? 'Savings start with the first MRN at the new price — no MRN month posted yet.'
    : `${elapsed === 1 ? 'Month 1' : `${elapsed} months`}: ${inrShort(p.actualToDate)} vs ${inrShort(p.planToDate)} planned · at this run-rate ${inrShort(p.projected)} of ${inrShort(p.target)}`
  return (
    <div className="min-w-0">
      <div className={cn('grid gap-2 mb-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        <Stat label="Locked target" value={inrShort(p.target)} />
        <Stat label="Plan to date" value={inrShort(p.planToDate)} />
        <Stat label="Actual to date (MRN)" value={inrShort(p.actualToDate)} tone={elapsed ? (behind ? 'bad' : 'good') : undefined} />
        <Stat label="Projected at run-rate" value={elapsed ? inrShort(p.projected) : '—'} tone={elapsed ? (p.projected >= p.target * 0.95 ? 'good' : 'bad') : undefined} />
      </div>
      <PlanChart rows={p.rows} projected={p.projected} target={p.target} height={compact ? 150 : 190} />
      <div className={cn('mt-1.5 flex items-start gap-1.5 text-[12px]', !elapsed ? 'text-muted' : behind ? 'text-red-700' : 'text-emerald-700')}>
        <Icon name={!elapsed ? 'Clock3' : behind ? 'TrendingDown' : 'TrendingUp'} size={14} className="shrink-0 mt-px" />
        <span>{sentence}{elapsed ? (behind ? ' — behind plan.' : ' — on plan.') : ''}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border border-line bg-white px-2.5 py-1.5 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted truncate">{label}</div>
      <div className={cn('text-[14px] font-bold num truncate', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>
    </div>
  )
}
