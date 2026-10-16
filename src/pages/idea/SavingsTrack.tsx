// Month-by-month savings track for one locked execution: each month's MRN saving against that month's share of the
// locked target (₹ 12 L over 6 months = ₹ 2 L a month). Green = target met, amber = within 10 %, red = short or no MRN.
// The verdict says whether the idea is still working towards its target and what the remaining months now need.
import { useMemo, useState } from 'react'
import { Area, Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import type { Idea, LedgerEntry } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { savingsTrack, type MonthVerdict, type SavingsTrack, type TrackVerdict } from '../../lib/workflow'
import { addDays, addMonthsYm, fmtDate, inrShort, monthLabel, monthLong } from '../../lib/format'
import { ideaPlan } from '../../lib/mrn'
import { MrnReceiptsModal } from '../exec/MrnPanels'
import { Icon, Segmented, cn } from '../../components/ui'
import { AXIS_TICK, GRID_STROKE } from '../home/shared'

export const MONTH_COLOR: Record<MonthVerdict, string> = {
  met: 'var(--color-emerald-600)', near: 'var(--color-amber-500)', short: 'var(--color-red-500)', 'no-mrn': 'var(--color-red-800)', pending: 'var(--color-slate-300)',
}
export const MONTH_LABEL: Record<MonthVerdict, string> = { met: 'Target met', near: 'Within 10 % of target', short: 'Short of target', 'no-mrn': 'No MRN — nothing counted', pending: 'Not posted yet' }
const TARGET_COLOR = 'var(--color-brand-700)'
const NEEDED_COLOR = 'var(--color-orange-500)'

export const VERDICT_STYLE: Record<TrackVerdict, { label: string; color: string; icon: string; bg: string }> = {
  'Not started': { label: 'Not started', color: 'var(--color-slate-500)', icon: 'Clock3', bg: 'bg-slate-50 border-slate-200' },
  'No MRN': { label: 'No MRN — nothing counted', color: 'var(--color-red-700)', icon: 'OctagonAlert', bg: 'bg-red-50 border-red-200' },
  'On track': { label: 'On track', color: 'var(--color-emerald-700)', icon: 'TrendingUp', bg: 'bg-emerald-50 border-emerald-200' },
  Behind: { label: 'Behind plan', color: 'var(--color-amber-700)', icon: 'TrendingDown', bg: 'bg-amber-50 border-amber-200' },
  'Off track': { label: 'Off track', color: 'var(--color-red-700)', icon: 'TriangleAlert', bg: 'bg-red-50 border-red-200' },
  'Target met': { label: 'Target met', color: 'var(--color-emerald-700)', icon: 'CircleCheck', bg: 'bg-emerald-50 border-emerald-200' },
  Shortfall: { label: 'Closed with shortfall', color: 'var(--color-red-700)', icon: 'CircleX', bg: 'bg-red-50 border-red-200' },
}

const pctOf = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)} %`)
/** the remaining months need more than the plan — shown as its own line */
const needsMore = (t: SavingsTrack) => !t.closed && t.elapsed > 0 && t.remaining > 0 && t.neededVsPlan > 1.02
/** 0 to a round top in four even steps, so ticks read ₹ 10 L, ₹ 20 L … rather than rounded odd values */
function niceAxis(top: number) {
  if (!(top > 0)) return { max: 1, ticks: [0, 1] }
  const raw = top / 4, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
  const n = Math.ceil(top / step - 1e-9)
  return { max: step * n, ticks: Array.from({ length: n + 1 }, (_, k) => k * step) }
}
const axisMoney = (v: number) => inrShort(v, 1).replace(/\.0 (L|Cr)$/, ' $1')
/** the monthly plan varies by month (AC season) */
const seasonal = (t: SavingsTrack) => t.rows.some((r) => Math.abs(r.plan - t.planPerMonth) > t.planPerMonth * 0.01)
const shortMonth = (ym: string) => monthLabel(ym).replace(/ 20(\d\d)$/, " '$1")

/** Savings track of one idea from the store's MRN ledger (null until a lock is signed) */
export function savingsTrackOf(i: Idea, ledger: LedgerEntry[], lastActualMonth: string): SavingsTrack | null {
  const lock = i.lock
  if (!lock) return null
  return savingsTrack(ideaPlan(i, ledger, lastActualMonth))
}
export function useSavingsTrack(idea: Idea) {
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  return useMemo(() => savingsTrackOf(idea, ledger, last), [idea, ledger, last])
}

/** One sentence: where the idea stands against its target and what the remaining months need */
export function verdictSentence(t: SavingsTrack, lock: { startDate: string }) {
  const lastPosted = [...t.rows].reverse().find((r) => r.actual != null)?.month
  const due = lastPosted ? `due by the end of ${monthLong(lastPosted)}` : ''
  const need = t.remaining > 0 ? ` The remaining ${t.remaining} month${t.remaining === 1 ? '' : 's'} need ${inrShort(t.neededPerMonth)} a month (${t.neededVsPlan.toFixed(1)}× the plan) to still reach ${inrShort(t.target)}${t.neededVsPlan > 2 ? ' — out of reach at the current run-rate' : ''}.` : ''
  switch (t.verdict) {
    case 'Not started': return `Savings start on ${fmtDate(lock.startDate)} — ${inrShort(t.rows[0].plan)} is expected from MRN in the first month (about ${inrShort(t.planPerMonth)} a month); the first month is read from the ERP in early ${monthLong(addMonthsYm(t.rows[0].month, 1))}.`
    case 'No MRN': return `No MRN at the new price in ${t.elapsed} posted month${t.elapsed === 1 ? '' : 's'}, so nothing is counted — ${inrShort(t.planToDate)} was ${due}.${need}`
    case 'On track': return `${inrShort(t.actualToDate)} from MRN against ${inrShort(t.planToDate)} ${due} (${pctOf(t.achievement)}) — ${t.monthsMet} of ${t.elapsed} months met the monthly target. At this run-rate: ${inrShort(t.projected)} of ${inrShort(t.target)}.`
    case 'Behind': return `${inrShort(t.actualToDate)} from MRN against ${inrShort(t.planToDate)} ${due} (${pctOf(t.achievement)}) — below plan.${need}`
    case 'Off track': return `Only ${inrShort(t.actualToDate)} from MRN against ${inrShort(t.planToDate)} ${due} (${pctOf(t.achievement)}); ${t.monthsShort} of ${t.elapsed} months short.${need}`
    case 'Target met': return `Timeline closed: ${inrShort(t.actualToDate)} from MRN against the locked ${inrShort(t.target)} (${pctOf(t.achievement)}) — ${t.monthsMet} of ${t.months} months met the monthly target.`
    case 'Shortfall': return `Timeline closed short: ${inrShort(t.actualToDate)} of the locked ${inrShort(t.target)} (${pctOf(t.achievement)}) — ${inrShort(t.target - t.actualToDate)} not realised; ${t.monthsShort} of ${t.months} months short.`
  }
}

/** Small month bars for a table row: each month's MRN as a share of its target (dashed line = monthly target) */
export function MonthBars({ t, className }: { t: SavingsTrack | null; className?: string }) {
  if (!t) return <span className="text-[12px] text-muted">—</span>
  const H = 24
  const top = Math.max(1.3, ...t.rows.map((r) => Math.min(r.ratio ?? 0, 1.6)))
  const y = (ratio: number) => (Math.min(ratio, top) / top) * H
  const st = VERDICT_STYLE[t.verdict]
  return (
    <div className={cn('flex items-center gap-2', className)} data-month-bars={t.verdict}>
      <div className="relative flex items-end gap-[2px] shrink-0" style={{ height: H }}>
        <span className="absolute -inset-x-0.5 border-t border-dashed border-slate-400/80 pointer-events-none" style={{ bottom: y(1) }} />
        {t.rows.map((r) => (
          <span key={r.month} title={`${monthLong(r.month)} · ${r.actual == null ? `target ${inrShort(r.plan)} — not posted yet` : `MRN ${inrShort(r.actual)} of ${inrShort(r.plan)} (${pctOf(r.ratio)}) — ${MONTH_LABEL[r.verdict]}`}`}
            className={cn('w-[7px] rounded-[2px] block', r.verdict === 'pending' && 'border border-dashed border-slate-300 bg-white')}
            style={{ height: r.verdict === 'pending' ? y(1) : Math.max(2, y(r.ratio ?? 0)), background: r.verdict === 'pending' ? undefined : MONTH_COLOR[r.verdict] }} />
        ))}
      </div>
      <div className="leading-tight min-w-0">
        <div className="text-[12px] font-bold num whitespace-nowrap" style={{ color: st.color }}>{t.elapsed ? pctOf(t.achievement) : '—'}</div>
        <div className="text-[10px] text-muted whitespace-nowrap">{t.elapsed ? `${t.monthsMet}/${t.elapsed} met${t.monthsNear ? ` · ${t.monthsNear} near` : ''}${t.monthsShort ? ` · ${t.monthsShort} short` : ''}` : `from ${shortMonth(t.rows[0].month)}`}</div>
      </div>
    </div>
  )
}

function TrackTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl bg-white border border-line shadow-[0_12px_32px_-12px_rgb(15_23_42/.35)] px-3 py-2 text-[12px] min-w-[210px]">
      <div className="font-semibold text-ink mb-1">{monthLong(d.month)}</div>
      <Row label="Monthly target" value={inrShort(d.plan)} />
      <Row label="MRN actual" value={d.actual == null ? 'not posted yet' : inrShort(d.actual)} color={d.actual == null ? undefined : MONTH_COLOR[d.verdict as MonthVerdict]} />
      {d.actual != null && Math.abs(d.actual - d.plan) > 1 && <>
        <Row label="· volume / timing" value={`${d.actual - d.plan + (d.leak ?? 0) >= 0 ? '+' : ''}${inrShort(d.actual - d.plan + (d.leak ?? 0))}`} />
        {(d.leak ?? 0) > 0 && <Row label="· price billed above approved" value={inrShort(-d.leak)} color="var(--color-red-600)" />}
      </>}
      {d.needed != null && <Row label="Needed from now" value={inrShort(d.needed)} color={NEEDED_COLOR} />}
      <div className="h-px bg-line my-1" />
      <Row label="Target to date" value={inrShort(d.planCum)} />
      <Row label="MRN to date" value={d.actualCum == null ? '—' : inrShort(d.actualCum)} />
      <div className="mt-1 text-[11px] font-semibold" style={{ color: MONTH_COLOR[d.verdict as MonthVerdict] }}>{d.ratio != null ? `${Math.round(d.ratio * 100)} % · ` : ''}{MONTH_LABEL[d.verdict as MonthVerdict]}</div>
    </div>
  )
}
const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="flex items-center justify-between gap-4 py-0.5"><span className="text-muted">{label}</span><span className="font-semibold num" style={{ color: color ?? 'var(--color-ink)' }}>{value}</span></div>
)

/** % label above each posted month's bar */
const PctLabel = (rows: SavingsTrack['rows']) => (props: any) => {
  const r = rows[props.index]
  if (!r || r.actual == null || props.width == null) return null
  return <text x={props.x + props.width / 2} y={props.y - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={MONTH_COLOR[r.verdict]}>{r.verdict === 'no-mrn' ? 'No MRN' : `${Math.round((r.ratio ?? 0) * 100)}%`}</text>
}

export function SavingsTrackChart({ t, view, height = 220, leak, onMonth }: { t: SavingsTrack; view: 'monthly' | 'cumulative'; height?: number; leak?: Record<string, number>; onMonth?: (month: string) => void }) {
  const lastKnown = [...t.rows].reverse().findIndex((r) => r.actualCum != null)
  const lk = lastKnown < 0 ? -1 : t.rows.length - 1 - lastKnown
  const n = t.rows.length
  const needLine = needsMore(t)
  const data = t.rows.map((r, k) => ({
    ...r, label: shortMonth(r.month),
    ghost: r.actual == null ? r.plan : null,
    // what each remaining month needs: its share (by the season) of what is still to come
    needed: needLine && r.actual == null ? r.needed ?? t.neededPerMonth : null,
    leak: leak?.[r.month] ?? 0,
    // straight line from the last posted cumulative to the run-rate projection at the end of the timeline
    projection: lk >= 0 && k >= lk && n - 1 > lk ? t.rows[lk].actualCum! + ((t.projected - t.rows[lk].actualCum!) * (k - lk)) / (n - 1 - lk) : null,
  }))
  const cumColor = t.verdict === 'On track' || t.verdict === 'Target met' ? MONTH_COLOR.met : t.verdict === 'Behind' ? MONTH_COLOR.near : MONTH_COLOR.short
  const yMonthly = niceAxis(Math.max(t.planPerMonth, needLine ? t.neededPerMonth : 0, ...t.rows.map((r) => r.actual ?? 0)) * 1.12)
  const yCum = niceAxis(Math.max(t.target, t.actualToDate, t.elapsed ? t.projected : 0) * 1.05)
  return (
    <div style={{ height }} data-testid="savings-track-chart">
      <ResponsiveContainer width="100%" height="100%">
        {view === 'monthly' ? (
          <ComposedChart data={data} margin={{ top: 18, right: 22, left: -6, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={axisMoney} width={62} domain={[0, yMonthly.max]} ticks={yMonthly.ticks} />
            <RTooltip content={<TrackTip />} cursor={{ fill: 'rgb(27 49 111 / .05)' }} />
            <Bar dataKey="ghost" name="Monthly target (not posted yet)" stackId="m" fill="var(--color-slate-100)" stroke="var(--color-slate-300)" strokeDasharray="3 3" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
            <Bar dataKey="actual" name="MRN actual" stackId="m" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.month} fill={MONTH_COLOR[d.verdict]} />)}
              <LabelList content={PctLabel(t.rows)} />
            </Bar>
            <Line dataKey="plan" name="Monthly target" stroke={TARGET_COLOR} strokeDasharray="6 4" strokeWidth={1.75} dot={{ r: 2.5, fill: TARGET_COLOR }} isAnimationActive={false} />
            {needLine && <Line dataKey="needed" name="Needed from now" stroke={NEEDED_COLOR} strokeDasharray="4 3" strokeWidth={2} dot={{ r: 3, fill: NEEDED_COLOR }} isAnimationActive={false} connectNulls />}
          </ComposedChart>
        ) : (
          <ComposedChart data={data} margin={{ top: 18, right: 22, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={axisMoney} width={62} domain={[0, yCum.max]} ticks={yCum.ticks} />
            <RTooltip content={<TrackTip />} cursor={{ stroke: 'var(--color-slate-300)' }} />
            <ReferenceLine y={t.target} stroke={TARGET_COLOR} strokeDasharray="2 3" label={{ value: `Locked target ${inrShort(t.target)}`, position: 'insideTopLeft', fill: TARGET_COLOR, fontSize: 11, fontWeight: 600, dy: -14 }} />
            <Line dataKey="planCum" name="Target path" stroke={TARGET_COLOR} strokeDasharray="6 4" strokeWidth={2} dot={{ r: 2.5, fill: TARGET_COLOR }} isAnimationActive={false} />
            <Area dataKey="actualCum" name="MRN actual (cumulative)" stroke={cumColor} strokeWidth={2.5} fill={cumColor} fillOpacity={0.12} dot={{ r: 3.5, fill: cumColor }} connectNulls={false} isAnimationActive={false} />
            {t.elapsed > 0 && !t.closed && <Line dataKey="projection" name="At this run-rate" stroke={cumColor} strokeDasharray="2 4" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />}
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function Legend({ view, t }: { view: 'monthly' | 'cumulative'; t: SavingsTrack }) {
  const item = (color: string, label: string, dashed?: boolean) => (
    <span className="inline-flex items-center gap-1.5"><span className={cn('inline-block', dashed ? 'w-4 border-t-2 border-dashed' : 'h-2.5 w-2.5 rounded-[3px]')} style={dashed ? { borderColor: color } : { background: color }} />{label}</span>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted">
      {view === 'monthly' ? <>
        {item(MONTH_COLOR.met, 'Met')}{item(MONTH_COLOR.near, 'Within 10 %')}{item(MONTH_COLOR.short, 'Short')}{item(MONTH_COLOR['no-mrn'], 'No MRN')}
        {t.remaining > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-slate-400 bg-slate-100" />Not posted yet</span>}
        {item(TARGET_COLOR, `Monthly target (${seasonal(t) ? 'by season' : inrShort(t.planPerMonth)})`, true)}{needsMore(t) && item(NEEDED_COLOR, `Needed from now (avg ${inrShort(t.neededPerMonth)})`, true)}
      </> : <>
        {item(TARGET_COLOR, 'Target path', true)}{item(t.verdict === 'On track' || t.verdict === 'Target met' ? MONTH_COLOR.met : MONTH_COLOR.short, 'MRN actual (cumulative)')}
        {!t.closed && t.elapsed > 0 && item('var(--color-slate-400)', 'At this run-rate', true)}
      </>}
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted truncate">{label}</div>
      <div className={cn('text-[16px] font-bold num leading-tight truncate', tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>
      {sub && <div className="text-[10.5px] text-muted truncate">{sub}</div>}
    </div>
  )
}

/** Verdict, tiles, the month-by-month (or cumulative) graph and the month strip for one locked execution */
export function SavingsTrackPanel({ idea, t, compact, tiles = true }: { idea: Idea; t: SavingsTrack; compact?: boolean; tiles?: boolean }) {
  const [view, setView] = useState<'monthly' | 'cumulative'>('monthly')
  const [month, setMonth] = useState<string | null>(null)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const ledger = useStore((s) => s.ledger)
  const leak = useMemo(() => { const m: Record<string, number> = {}; ledger.filter((l) => l.ideaId === idea.id).forEach((l) => { m[l.month] = (m[l.month] ?? 0) + l.leakage }); return m }, [ledger, idea.id])
  const lock = idea.lock!
  const st = VERDICT_STYLE[t.verdict]
  const tone = (v: TrackVerdict) => (v === 'On track' || v === 'Target met' ? 'good' : v === 'Behind' ? 'warn' : v === 'Not started' ? undefined : 'bad')
  const nextRead = addDays(`${addMonthsYm(last, 2)}-01`, 4)
  return (
    <div className="grid gap-3 min-w-0" data-testid="savings-track" data-verdict={t.verdict}>
      <div className={cn('rounded-xl border px-3.5 py-2.5 flex items-start gap-3', st.bg)}>
        <span className="h-8 w-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: st.color }}><Icon name={st.icon} size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold" style={{ color: st.color }}>{st.label}{t.elapsed > 0 && !t.closed && <span className="font-semibold"> · {pctOf(t.achievement)} of the target to date</span>}</div>
          <div className="text-[12.5px] text-ink-2 leading-snug">{verdictSentence(t, lock)}</div>
        </div>
      </div>
      {tiles && <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6')}>
        <Tile label="Locked target" value={inrShort(t.target)} sub={`${t.months} month${t.months === 1 ? '' : 's'} · ${seasonal(t) ? `${inrShort(Math.min(...t.rows.map((r) => r.plan)))}–${inrShort(Math.max(...t.rows.map((r) => r.plan)))} a month` : `${inrShort(t.planPerMonth)} a month`}`} />
        {!compact && <Tile label={t.closed ? 'Target for the period' : 'Target to date'} value={inrShort(t.planToDate)} sub={t.elapsed ? `${t.elapsed} of ${t.months} months posted` : 'no month posted yet'} />}
        <Tile label="MRN actual" value={inrShort(t.actualToDate)} sub="from MRN transactions only" tone={t.elapsed ? tone(t.verdict) : undefined} />
        <Tile label={t.closed ? 'Achieved' : 'Achievement'} value={t.elapsed ? pctOf(t.achievement) : '—'} sub={t.closed ? 'MRN ÷ locked target' : 'MRN ÷ target to date'} tone={t.elapsed ? tone(t.verdict) : undefined} />
        {!compact && <Tile label="Months met" value={t.elapsed ? `${t.monthsMet} / ${t.elapsed}` : '—'} sub={t.elapsed ? `${t.monthsNear} within 10 % · ${t.monthsShort} short` : 'graded once posted'} tone={t.elapsed ? (t.monthsShort > t.monthsMet ? 'bad' : t.monthsMet === t.elapsed ? 'good' : 'warn') : undefined} />}
        {t.closed
          ? <Tile label="Variance" value={`${t.actualToDate - t.target >= 0 ? '+' : ''}${inrShort(t.actualToDate - t.target)}`} sub="MRN actual − locked target" tone={t.actualToDate >= t.target ? 'good' : 'bad'} />
          : <Tile label="Needed per month" value={t.remaining ? inrShort(t.neededPerMonth) : '—'} sub={t.remaining ? `${t.remaining} month${t.remaining === 1 ? '' : 's'} left · ${t.neededVsPlan.toFixed(1)}× plan` : 'timeline complete'} tone={t.elapsed && t.remaining ? (t.neededVsPlan <= 1.001 ? 'good' : t.neededVsPlan <= 1.25 ? 'warn' : 'bad') : undefined} />}
      </div>}
      <div className="rounded-xl border border-line bg-white p-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <Legend view={view} t={t} />
          <Segmented size="sm" value={view} onChange={(k) => setView(k as typeof view)} options={[{ key: 'monthly', label: 'Month by month', icon: 'ChartColumnBig' }, { key: 'cumulative', label: 'Cumulative to target', icon: 'ChartLine' }]} />
        </div>
        <SavingsTrackChart t={t} view={view} height={compact ? 190 : 240} leak={leak} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.rows.map((r) => (
            <button type="button" key={r.month} disabled={r.verdict === 'pending'} onClick={() => setMonth(r.month)} title={r.verdict === 'pending' ? MONTH_LABEL[r.verdict] : `${MONTH_LABEL[r.verdict]} — open the MRN receipts`} className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold border', r.verdict === 'pending' ? 'border-dashed border-slate-300 text-muted bg-white' : 'text-white border-transparent hover:brightness-110 cursor-pointer')}
              style={r.verdict === 'pending' ? undefined : { background: MONTH_COLOR[r.verdict] }}>
              <Icon name={r.verdict === 'met' ? 'Check' : r.verdict === 'near' ? 'Minus' : r.verdict === 'pending' ? 'Clock3' : 'X'} size={11} strokeWidth={3} />
              {shortMonth(r.month)}{r.ratio != null && <span className="num">· {r.verdict === 'no-mrn' ? 'no MRN' : `${Math.round(r.ratio * 100)}%`}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[11.5px] text-muted flex items-start gap-1.5">
        <Icon name="DatabaseZap" size={13} className="shrink-0 mt-px text-teal-700" />
        <span>Only MRN receipts count — from the approved supplier, on or after the savings start, below the baseline: saving = (baseline − price billed) × quantity received. A month without MRN at the new price counts as zero. Click a month for its receipts. MRN is posted up to {monthLong(last)}; {monthLong(addMonthsYm(last, 1))} is read on {fmtDate(nextRead)}.{!t.closed && ` On ${fmtDate(lock.endDate)} COIN moves the idea to verification with this track.`}</span>
      </div>
      <MrnReceiptsModal idea={idea} month={month} open={!!month} onClose={() => setMonth(null)} />
    </div>
  )
}

/** Full-width card on the idea page for every idea with a signed lock in execution or verification */
export function SavingsTrackCard({ idea }: { idea: Idea }) {
  const t = useSavingsTrack(idea)
  if (!t || !idea.lock) return null
  return (
    <section className="card p-4 min-w-0" id="savings-track">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 rounded-xl grid place-items-center bg-co-grad text-white shrink-0"><Icon name="ChartColumnBig" size={17} /></span>
          <div className="min-w-0">
            <h3 className="text-[14.5px] font-bold text-ink">Monthly savings vs target (MRN)</h3>
            <div className="text-[12px] text-muted">{inrShort(t.target)} locked over {t.months} month{t.months === 1 ? '' : 's'}{seasonal(t) ? ' — each month’s target follows the AC season (last-FY MRN pattern)' : ` = ${inrShort(t.planPerMonth)} a month`} · {fmtDate(idea.lock.startDate)} → {fmtDate(idea.lock.endDate)} · signed at department approval</div>
          </div>
        </div>
      </div>
      <SavingsTrackPanel idea={idea} t={t} />
    </section>
  )
}
