// CO Advanced analytics — execution & realisation only (nothing about idea intake, review stages or campaigns).
// Realised savings by month · finance validation backlog · route mix · execution ageing · delivery discipline · price leakage · realisation leaders
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../store/useStore'
import type { Health, Idea, LedgerEntry, RouteKey } from '../../lib/types'
import { BUCKET_STYLE, HEALTH_STYLE, healthOf, ideaApprovedAnnualised, ideaRealised, isHard } from '../../lib/calc'
import { QUARTER_MONTHS, daysBetween, fmtDate, fyMonths, inrShort, monthLong, monthShort, pct, sum } from '../../lib/format'
import { Avatar, Button, Card, EmptyState, Icon, InfoTip, ProgressBar, Segmented, cn } from '../../components/ui'
import { AXIS_TICK, ChartTip, GRID_STROKE, useDrill } from '../home/shared'
import { coValue, type CoData } from './data'

const EXEC = BUCKET_STYLE['In Execution']
const IMPL = BUCKET_STYLE.Implemented
const RISK = '#e0364f'
const FIN = { validated: '#0b8a77', pending: '#7fdcc6', queried: '#f2b04c', cumulative: '#2459e0' }

/** Ledger rows of hard-saving ideas in scope (realisation is counted on hard savings only) */
function useHardLedger(c: CoData) {
  return useMemo(() => {
    const hard = new Set(c.d.ideas.filter(isHard).map((i) => i.id))
    return c.d.ledger.filter((l) => hard.has(l.ideaId))
  }, [c])
}

function Mini({ label, value, color, sub }: { label: string; value: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-line px-2.5 py-1.5 min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted truncate">{label}</div>
      <div className="text-[13.5px] font-bold num truncate" style={{ color: color ?? '#0f1b33' }}>{value}{sub && <span className="ml-1 text-[10.5px] font-medium text-muted">{sub}</span>}</div>
    </div>
  )
}
function Key({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return <span className="flex items-center gap-1"><span className={line ? 'h-0.5 w-3 rounded' : 'h-2 w-2 rounded-sm'} style={{ background: color }} />{label}</span>
}
const Th = ({ children, className }: { children?: ReactNode; className?: string }) => <span className={cn('text-[10.5px] font-semibold uppercase tracking-wide text-muted', className)}>{children}</span>

// ─── 1 · Realised savings by month (validated / pending / queried + cumulative) ─
export function RealisedMonthlyCard({ c, className }: { c: CoData; className?: string }) {
  const lrm = useStore((s) => s.settings.lastRealisationMonth)
  const ledger = useHardLedger(c)
  const data = useMemo(() => {
    let cum = 0
    return fyMonths(c.fy).map((m) => {
      const rows = ledger.filter((l) => l.month === m)
      const has = m <= lrm
      const v = sum(rows.filter((l) => l.financeStatus === 'Validated').map((l) => l.realised))
      const p = sum(rows.filter((l) => l.financeStatus === 'Pending').map((l) => l.realised))
      const q = sum(rows.filter((l) => l.financeStatus === 'Queried').map((l) => l.realised))
      cum += v + p + q
      return { month: m, label: monthShort(m), validated: has ? v : null, pending: has ? p : null, queried: has ? q : null, cumulative: has ? cum : null }
    })
  }, [ledger, c.fy, lrm])
  const total = sum(ledger.map((l) => l.realised))
  const validated = sum(ledger.filter((l) => l.financeStatus === 'Validated').map((l) => l.realised))
  const live = data.filter((d) => d.cumulative != null)
  const avg = live.length ? total / live.length : 0
  const best = [...live].sort((a, b) => (b.validated ?? 0) + (b.pending ?? 0) + (b.queried ?? 0) - ((a.validated ?? 0) + (a.pending ?? 0) + (a.queried ?? 0)))[0]
  return (
    <Card className={cn('h-full', className)} icon="ChartColumnBig" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Realised savings by month<InfoTip title="Realised savings by month" formula="Realised = (baseline − approved price) × MRN quantity after the effective date">Hard savings from actual MRN, split by Finance status. The line is the cumulative realised value for the FY (right axis).</InfoTip></span>}
      subtitle={`${c.fy} · MRN-based realisation to ${monthLong(lrm)}`}>
      <div className="grid grid-cols-4 gap-2">
        <Mini label="Realised FYTD" value={inrShort(total)} color={FIN.validated} />
        <Mini label="Finance validated" value={inrShort(validated)} sub={total ? pct((validated / total) * 100, 0) : undefined} />
        <Mini label="Avg / month" value={inrShort(avg)} />
        <Mini label="Best month" value={best ? inrShort((best.validated ?? 0) + (best.pending ?? 0) + (best.queried ?? 0)) : '—'} sub={best?.label} />
      </div>
      <div className="flex-1 min-h-[180px] -ml-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="26%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="m" tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => inrShort(v, 0)} />
            <YAxis yAxisId="c" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => inrShort(v, 0)} />
            <RTooltip cursor={{ fill: '#f1f5f9', radius: 6 } as any} content={<ChartTip colors={FIN} labelFmt={(_: any, p: any) => monthLong(p?.[0]?.payload?.month ?? '')} />} />
            <Bar yAxisId="m" dataKey="validated" name="Finance validated" stackId="r" fill={FIN.validated} maxBarSize={24} />
            <Bar yAxisId="m" dataKey="pending" name="Pending validation" stackId="r" fill={FIN.pending} maxBarSize={24} />
            <Bar yAxisId="m" dataKey="queried" name="Queried by Finance" stackId="r" fill={FIN.queried} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Line yAxisId="c" type="monotone" dataKey="cumulative" name="Cumulative realised" stroke={FIN.cumulative} strokeWidth={2} dot={{ r: 2.5, fill: FIN.cumulative }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted">
        <Key color={FIN.validated} label="Validated" /><Key color={FIN.pending} label="Pending" /><Key color={FIN.queried} label="Queried" /><Key color={FIN.cumulative} label="Cumulative (right axis)" line />
      </div>
    </Card>
  )
}

// ─── 2 · Finance validation backlog ──────────────────────────────────────────
const AGE_BANDS = [
  { key: '≤15 d', max: 15, color: '#9be3d3' },
  { key: '16–30 d', max: 30, color: '#3fbfa5' },
  { key: '31–60 d', max: 60, color: '#f2b04c' },
  { key: '>60 d', max: Infinity, color: RISK },
]

export function ValidationBacklogCard({ c, className }: { c: CoData; className?: string }) {
  const fv = useStore((s) => s.settings.financeValidation)
  const openIdea = useStore((s) => s.openIdea)
  const ledger = useHardLedger(c)
  const open = ledger.filter((l) => l.financeStatus !== 'Validated' && l.realised > 0)
  const pend = open.filter((l) => l.financeStatus === 'Pending')
  const qry = open.filter((l) => l.financeStatus === 'Queried')
  const ageOf = (l: LedgerEntry) => Math.max(0, daysBetween(l.postedAt, c.t))
  const bands = AGE_BANDS.map((b, k) => {
    const rows = open.filter((l) => { const a = ageOf(l); return a <= b.max && (k === 0 || a > AGE_BANDS[k - 1].max) })
    return { ...b, n: rows.length, value: sum(rows.map((l) => l.realised)) }
  })
  const totalV = sum(open.map((l) => l.realised)) || 0
  // ideas carrying the most un-validated value
  const byIdea = Object.values(open.reduce<Record<string, { id: string; value: number; months: number; oldest: number; queried: boolean }>>((a, l) => {
    const r = (a[l.ideaId] ??= { id: l.ideaId, value: 0, months: 0, oldest: 0, queried: false })
    r.value += l.realised; r.months += 1; r.oldest = Math.max(r.oldest, ageOf(l)); r.queried ||= l.financeStatus === 'Queried'
    return a
  }, {})).sort((a, b) => b.value - a.value).slice(0, 3)
  const titleOf = (id: string) => c.d.ideas.find((i) => i.id === id)?.title ?? id
  return (
    <Card className={cn('h-full', className)} icon="ShieldCheck" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Finance validation backlog<InfoTip title="Finance validation backlog">MRN realisation rows not yet accepted by Finance — Pending (not reviewed) and Queried (sent back with remarks). Age = days since the month's realisation was posted.</InfoTip></span>}
      subtitle={fv ? 'Realised value awaiting Finance sign-off' : 'Finance validation is switched off in settings'}>
      <div className="grid grid-cols-2 gap-2">
        <Mini label={`Pending · ${pend.length}`} value={inrShort(sum(pend.map((l) => l.realised)))} color="#0d6e61" />
        <Mini label={`Queried · ${qry.length}`} value={inrShort(sum(qry.map((l) => l.realised)))} color={qry.length ? '#b35f0c' : undefined} />
      </div>
      <div className="mt-3 text-[11px] font-semibold text-muted flex items-center justify-between"><span>Age of open rows</span><span className="num">{open.length} rows · {inrShort(totalV)}</span></div>
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 gap-px mt-1">
        {bands.map((b) => b.value > 0 && <div key={b.key} style={{ width: `${(b.value / (totalV || 1)) * 100}%`, background: b.color }} title={`${b.key} · ${inrShort(b.value)}`} />)}
      </div>
      <div className="grid grid-cols-4 gap-1 mt-1.5">
        {bands.map((b) => (
          <div key={b.key} className="min-w-0">
            <div className="flex items-center gap-1 text-[10.5px] text-muted"><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: b.color }} />{b.key}</div>
            <div className="text-[12px] font-semibold text-ink num truncate">{b.n ? inrShort(b.value) : '—'}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-line flex-1 flex flex-col">
        <Th>Largest open items</Th>
        {byIdea.length ? byIdea.map((r) => (
          <button key={r.id} onClick={() => openIdea(r.id)} className="group flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-ink truncate group-hover:text-brand-700">{titleOf(r.id)}</span>
              <span className="block text-[10.5px] text-muted truncate"><span className="font-mono">{r.id}</span> · {r.months} month{r.months === 1 ? '' : 's'} · oldest {r.oldest} d{r.queried && <b className="text-[#b35f0c] font-semibold"> · queried</b>}</span>
            </span>
            <span className="text-[12.5px] font-bold text-ink num shrink-0">{inrShort(r.value)}</span>
          </button>
        )) : <div className="text-[12px] text-muted py-3 flex items-center gap-1.5"><Icon name="CircleCheck" size={14} className="text-accent-600" />Everything realised is validated.</div>}
      </div>
    </Card>
  )
}

// ─── 3 · Committed vs realised by quarter ────────────────────────────────────
const PH = { implemented: IMPL.color, inExec: EXEC.color, realised: FIN.cumulative }
export function PhasingCard({ c, className }: { c: CoData; className?: string }) {
  const lrm = useStore((s) => s.settings.lastRealisationMonth)
  const qStart = (k: number) => fyMonths(c.fy)[k * 3]
  const data = c.phasing.map((p, k) => ({ ...p, realised: qStart(k) <= lrm ? p.realised : null, label: `${p.q} · ${QUARTER_MONTHS[p.q]}${p.current ? ' · current' : ''}`, short: p.q }))
  const impl = sum(data.map((x) => x.implemented))
  const exec = sum(data.map((x) => x.inExec))
  const realised = sum(data.map((x) => x.realised ?? 0))
  return (
    <Card className={cn('h-full', className)} icon="CalendarRange" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Committed vs realised by quarter<InfoTip title="Quarter phasing" formula="Committed = annualised × months live in FY ÷ 12 (or the execution's Q1–Q4 phasing)">Hard savings only. Implemented ideas phase from their effective date at the approved price; ideas in execution use the phasing set in the Execution Hub. The line is MRN-based realised savings.</InfoTip></span>}
      subtitle={`${c.fy} · committed hard savings vs MRN realised`}>
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Implemented" value={inrShort(impl)} color={IMPL.text} />
        <Mini label="In execution" value={inrShort(exec)} color={EXEC.text} />
        <Mini label="Realised" value={inrShort(realised)} color="#1d47c0" />
      </div>
      <div className="flex-1 min-h-[160px] -ml-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="short" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => inrShort(v, 0)} />
            <RTooltip cursor={{ fill: '#f1f5f9', radius: 6 } as any} content={<ChartTip colors={PH} labelFmt={(_: any, p: any) => p?.[0]?.payload?.label ?? ''} />} />
            <Bar dataKey="implemented" name="Implemented" stackId="c" fill={IMPL.color} maxBarSize={30} />
            <Bar dataKey="inExec" name="In execution" stackId="c" fill={EXEC.color} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Line type="monotone" dataKey="realised" name="Realised" stroke={PH.realised} strokeWidth={2} dot={{ r: 3, fill: PH.realised }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted">
        <Key color={IMPL.color} label="Implemented" /><Key color={EXEC.color} label="In execution" /><Key color={PH.realised} label="Realised" line />
      </div>
    </Card>
  )
}

// ─── 4 · Execution route mix (NPD → PAP / PAP only / internal) ───────────────
type RouteMix = 'npd' | 'pap' | 'internal'
const ROUTE_MIX: { key: RouteMix; label: string; icon: string; hint: string; routes: RouteKey[] }[] = [
  { key: 'npd', label: 'NPD → PAP', icon: 'TestTubes', hint: 'ECN / sample trial, then price or source change in PAP', routes: ['Technical', 'Supplier change'] },
  { key: 'pap', label: 'PAP price revision', icon: 'FileBadge', hint: 'Commercial price revision released in PAP', routes: ['Commercial', 'To be confirmed'] },
  { key: 'internal', label: 'Internal execution', icon: 'Wrench', hint: 'Executed by the owning department', routes: ['Internal'] },
]

export function RouteMixCard({ c, className }: { c: CoData; className?: string }) {
  const ledger = useHardLedger(c)
  const rows = ROUTE_MIX.map((r) => {
    const exec = c.inExec.filter((i) => r.routes.includes(i.route))
    const impl = c.implemented.filter((i) => r.routes.includes(i.route))
    const ids = new Set(impl.map((i) => i.id))
    return { ...r, nExec: exec.length, nImpl: impl.length, exec: sum(exec.map(coValue)), impl: sum(impl.map(coValue)), realised: sum(ledger.filter((l) => ids.has(l.ideaId)).map((l) => l.realised)) }
  })
  const total = sum(rows.map((r) => r.exec + r.impl)) || 1
  const max = Math.max(1, ...rows.map((r) => r.exec + r.impl))
  const n = sum(rows.map((r) => r.nExec + r.nImpl))
  return (
    <Card className={cn('h-full', className)} icon="Split" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Execution route mix<InfoTip title="Execution route mix">How approved ideas are being implemented. NPD → PAP needs an ECN / sample approval before the PAP change; PAP is a straight price revision; internal changes are executed by the owning department. ₹ = annualised impact (approved price once implemented).</InfoTip></span>}
      subtitle={`${n} ideas after approval · ${inrShort(total)} annualised`}>
      <div className="flex flex-col gap-2 flex-1">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-line px-2.5 py-2" title={r.hint}>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-md grid place-items-center shrink-0 bg-slate-100 text-slate-600"><Icon name={r.icon} size={13} /></span>
              <span className="text-[12.5px] font-semibold text-ink truncate flex-1">{r.label}</span>
              <span className="text-[12.5px] font-bold text-ink num">{inrShort(r.exec + r.impl)}</span>
              <span className="text-[10.5px] text-muted num w-9 text-right">{pct(((r.exec + r.impl) / total) * 100, 0)}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 mt-1.5">
              <span style={{ width: `${(r.impl / max) * 100}%`, background: IMPL.color }} />
              <span style={{ width: `${(r.exec / max) * 100}%`, background: EXEC.color }} />
            </div>
            <div className="flex items-center justify-between gap-2 mt-1 text-[10.5px] text-muted num">
              <span><b className="text-ink-2">{r.nImpl}</b> implemented · <b className="text-ink-2">{r.nExec}</b> in execution</span>
              <span className="text-accent-700 font-semibold">{inrShort(r.realised)} realised</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted"><Key color={IMPL.color} label="Implemented" /><Key color={EXEC.color} label="In execution" /></div>
    </Card>
  )
}

// ─── 5 · Ageing of live executions (days since approval × health) ────────────
const AGEING = [
  { key: '0–30', max: 30 }, { key: '31–60', max: 60 }, { key: '61–90', max: 90 }, { key: '91–180', max: 180 }, { key: '180+', max: Infinity },
]
export function AgeingCard({ c, className }: { c: CoData; className?: string }) {
  const drill = useDrill()
  const ageOf = (i: Idea) => Math.max(0, daysBetween(i.approvedAt ?? i.execution!.startDate, c.t))
  const data = AGEING.map((b, k) => {
    const ideas = c.live.filter((i) => { const a = ageOf(i); return a <= b.max && (k === 0 || a > AGEING[k - 1].max) })
    const by = (h: Health) => ideas.filter((i) => healthOf(i) === h).length
    return { label: b.key, 'On track': by('On track'), 'At risk': by('At risk'), Delayed: by('Delayed'), value: sum(ideas.map(coValue)) }
  })
  const ages = c.live.map(ageOf).sort((a, b) => a - b)
  const median = ages.length ? ages[Math.floor(ages.length / 2)] : 0
  const cycles = c.implemented.filter((i) => i.approvedAt && i.execution?.effectiveDate).map((i) => Math.max(0, daysBetween(i.approvedAt!, i.execution!.effectiveDate!)))
  const cycle = cycles.length ? Math.round(sum(cycles) / cycles.length) : 0
  const old = c.live.filter((i) => ageOf(i) > 90)
  const colors = { 'On track': HEALTH_STYLE['On track'].color, 'At risk': HEALTH_STYLE['At risk'].color, Delayed: HEALTH_STYLE.Delayed.color }
  return (
    <Card className={cn('h-full', className)} icon="Hourglass" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Execution ageing<InfoTip title="Execution ageing">Live executions grouped by days since approval, coloured by health. Cycle time = approval to effective date for implemented ideas.</InfoTip></span>}
      subtitle={`${c.live.length} live executions by days since approval`}
      actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => drill({}, '/execution')}>Hub</Button>}>
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Median age" value={`${median} d`} />
        <Mini label="Older than 90 d" value={old.length} color={old.length ? '#b35f0c' : undefined} sub={old.length ? inrShort(sum(old.map(coValue))) : undefined} />
        <Mini label="Avg cycle" value={cycles.length ? `${cycle} d` : '—'} color={IMPL.text} />
      </div>
      <div className="flex-1 min-h-[160px] -ml-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
            <RTooltip cursor={{ fill: '#f1f5f9', radius: 6 } as any} content={<ChartTip colors={colors} fmt={(v: number) => `${v}`} labelFmt={(l: string, p: any) => `${l} days · ${inrShort(p?.[0]?.payload?.value ?? 0)}`} />} />
            <Bar dataKey="On track" stackId="h" fill={colors['On track']} maxBarSize={30} />
            <Bar dataKey="At risk" stackId="h" fill={colors['At risk']} maxBarSize={30} />
            <Bar dataKey="Delayed" stackId="h" fill={colors.Delayed} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted">
        <Key color={colors['On track']} label="On track" /><Key color={colors['At risk']} label="At risk" /><Key color={colors.Delayed} label="Delayed" />
      </div>
    </Card>
  )
}

// ─── 6 · Delivery discipline: milestones on time & due-date slippage ─────────
interface DelRow { key: string; name: string; color?: string; live: number; msDue: number; msOnTime: number; changes: number; days: number; delayed: number }

export function DeliveryCard({ c, className }: { c: CoData; className?: string }) {
  const [by, setBy] = useState<'owner' | 'commodity'>('owner')
  const commodities = useStore((s) => s.commodities)
  const drill = useDrill()
  const rows = useMemo(() => {
    const m = new Map<string, DelRow>()
    for (const i of c.post) {
      const ex = i.execution
      if (!ex) continue
      const key = by === 'owner' ? ex.ownerId : i.commodity
      let r = m.get(key)
      if (!r) {
        const u = by === 'owner' ? c.userOf(key) : undefined
        r = { key, name: by === 'owner' ? (u?.name ?? 'Unassigned') : (commodities.find((x) => x.code === key)?.name ?? key), color: u?.avatarColor, live: 0, msDue: 0, msOnTime: 0, changes: 0, days: 0, delayed: 0 }
        m.set(key, r)
      }
      if (ex.status === 'In Execution') r.live += 1
      if (healthOf(i) === 'Delayed') r.delayed += 1
      for (const ms of ex.milestones) {
        if (ms.dueDate > c.t) continue
        r.msDue += 1
        if (ms.doneDate && ms.doneDate <= ms.dueDate) r.msOnTime += 1
      }
      r.changes += ex.slippage.length
      r.days += Math.max(0, daysBetween(ex.originalTargetDate, ex.targetDate))
    }
    return [...m.values()].filter((r) => r.live || r.msDue).sort((a, b) => b.days - a.days || b.changes - a.changes || b.delayed - a.delayed || b.live - a.live)
  }, [c, by, commodities])
  const tDue = sum(rows.map((r) => r.msDue)), tOn = sum(rows.map((r) => r.msOnTime))
  const tChanges = sum(rows.map((r) => r.changes)), tDays = sum(rows.map((r) => r.days))
  const shown = rows.slice(0, 5)
  const onColor = (p: number) => (p >= 85 ? '#0f9f6e' : p >= 65 ? '#b35f0c' : RISK)
  const cols = 'grid grid-cols-[minmax(0,1fr)_38px_62px_54px_50px] gap-2 items-center'
  return (
    <Card className={cn('h-full', className)} icon="CalendarClock" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Delivery discipline<InfoTip title="Delivery discipline">Milestones on time = milestones due to date that were completed on or before their due date. Due-date changes = revisions logged in the Execution Hub; days slipped = current due date minus the original due date.</InfoTip></span>}
      subtitle="On-time milestones & slippage"
      actions={<Segmented size="sm" value={by} onChange={(k) => setBy(k as 'owner' | 'commodity')} options={[{ key: 'owner', label: 'Owner' }, { key: 'commodity', label: 'Commodity' }]} />}>
      <div className={cn(cols, 'px-1 pb-1 border-b border-line')}>
        <Th>{by === 'owner' ? 'Owner' : 'Commodity'}</Th><Th className="text-right">Live</Th><Th className="text-right">On time</Th><Th className="text-right">Changes</Th><Th className="text-right">Slip</Th>
      </div>
      {shown.length ? shown.map((r) => {
        const p = r.msDue ? (r.msOnTime / r.msDue) * 100 : 100
        return (
          <button key={r.key} onClick={() => (by === 'commodity' ? drill({ commodity: r.key, bucket: 'In Execution' }) : drill({}, '/execution'))}
            className={cn(cols, 'px-1 py-[7px] rounded-md hover:bg-slate-50 text-left border-b border-slate-100 last:border-0')}>
            <span className="flex items-center gap-2 min-w-0">
              {by === 'owner' ? <Avatar name={r.name} color={r.color} size={22} /> : <span className="h-[22px] w-[22px] rounded-md grid place-items-center bg-slate-100 text-slate-500 shrink-0"><Icon name="Boxes" size={12} /></span>}
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-ink truncate">{r.name}</span>
                {r.delayed > 0 && <span className="block text-[10.5px] font-semibold num" style={{ color: RISK }}>{r.delayed} past due date</span>}
              </span>
            </span>
            <span className="text-right text-[12px] text-ink num">{r.live}</span>
            <span className="text-right text-[12px] font-semibold num" style={{ color: r.msDue ? onColor(p) : '#94a3b8' }}>{r.msDue ? pct(p, 0) : '—'}</span>
            <span className="text-right text-[12px] num" style={{ color: r.changes ? '#b35f0c' : '#94a3b8' }}>{r.changes || '—'}</span>
            <span className="text-right text-[12px] font-semibold num" style={{ color: r.days ? RISK : '#94a3b8' }}>{r.days ? `${r.days} d` : '—'}</span>
          </button>
        )
      }) : <EmptyState icon="CalendarClock" title="No executions" desc="Approved ideas appear once an execution plan is set." className="py-6" />}
      <div className="text-[10.5px] text-muted mt-auto pt-1.5 num">Overall <b className="text-ink-2">{pct(tDue ? (tOn / tDue) * 100 : 0, 0)}</b> on time · <b className="text-ink-2">{tChanges}</b> due-date change{tChanges === 1 ? '' : 's'} · <b className="text-ink-2">{tDays} d</b> slipped{rows.length > shown.length ? ` · top ${shown.length} of ${rows.length}` : ''}</div>
    </Card>
  )
}

// ─── 7 · Price leakage by supplier / part ────────────────────────────────────
export function LeakageCard({ c, className }: { c: CoData; className?: string }) {
  const [by, setBy] = useState<'supplier' | 'part'>('supplier')
  const suppliers = useStore((s) => s.suppliers)
  const nav = useNavigate()
  const ledger = useHardLedger(c)
  const leak = ledger.filter((l) => l.leakage > 0)
  const total = sum(leak.map((l) => l.leakage))
  const realised = sum(ledger.map((l) => l.realised))
  const rows = useMemo(() => {
    const m = new Map<string, { key: string; name: string; sub: string; value: number; months: Set<string>; ideas: Set<string> }>()
    for (const l of leak) {
      const key = by === 'supplier' ? l.supplierCode : l.partCode
      let r = m.get(key)
      if (!r) {
        const part = c.d.ideas.find((i) => i.id === l.ideaId)?.parts.find((p) => p.partCode === l.partCode)
        r = by === 'supplier'
          ? { key, name: suppliers.find((s) => s.code === key)?.name ?? key, sub: key, value: 0, months: new Set(), ideas: new Set() }
          : { key, name: part?.description ?? key, sub: key, value: 0, months: new Set(), ideas: new Set() }
        m.set(key, r)
      }
      r.value += l.leakage; r.months.add(l.month); r.ideas.add(l.ideaId)
    }
    return [...m.values()].sort((a, b) => b.value - a.value)
  }, [leak, by, suppliers, c.d.ideas])
  const shown = rows.slice(0, 5)
  const max = Math.max(1, ...shown.map((r) => r.value))
  return (
    <Card className={cn('h-full', className)} icon="Droplets" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Price leakage<InfoTip title="Price leakage" formula="Leakage = (MRN price − approved price) × MRN quantity, where positive">Savings lost because suppliers billed above the approved new price after the effective date.</InfoTip></span>}
      subtitle={`${inrShort(total)} leaked · ${realised ? pct((total / realised) * 100, 1) : '0%'} of realised`}
      actions={<Segmented size="sm" value={by} onChange={(k) => setBy(k as 'supplier' | 'part')} options={[{ key: 'supplier', label: 'Supplier' }, { key: 'part', label: 'Part' }]} />}>
      {shown.length ? (
        <div className="flex flex-col">
          {shown.map((r) => (
            <button key={r.key} onClick={() => nav('/reports/leakage')} className="group flex items-center gap-2.5 py-[7px] px-1 -mx-1 rounded-md hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-ink truncate">{r.name}</span>
                <span className="block text-[10.5px] text-muted truncate"><span className="font-mono">{r.sub}</span> · {r.months.size} month{r.months.size === 1 ? '' : 's'} · {r.ideas.size} idea{r.ideas.size === 1 ? '' : 's'}</span>
              </span>
              <span className="w-[96px] shrink-0 text-right">
                <span className="block text-[12.5px] font-bold num" style={{ color: RISK }}>{inrShort(r.value)}</span>
                <ProgressBar value={(r.value / max) * 100} height={3} color="#f08a99" className="mt-1" />
              </span>
            </button>
          ))}
        </div>
      ) : <EmptyState icon="CircleCheck" title="No price leakage" desc="All MRN prices are at or below the approved price." className="py-6" />}
      <div className="text-[10.5px] text-muted mt-auto pt-1.5">{rows.length} {by === 'supplier' ? 'supplier' : 'part'}{rows.length === 1 ? '' : 's'} with MRN price above approved{rows.length > shown.length ? ` · top ${shown.length}` : ''}</div>
    </Card>
  )
}

// ─── 8 · Realisation leaders: ideas / commodities by realised value ──────────
export function RealisationLeadersCard({ c, className }: { c: CoData; className?: string }) {
  const [by, setBy] = useState<'idea' | 'commodity'>('idea')
  const openIdea = useStore((s) => s.openIdea)
  const commodities = useStore((s) => s.commodities)
  const drill = useDrill()
  const ledger = useHardLedger(c)
  const rows = useMemo(() => {
    if (by === 'idea') {
      return c.implemented.map((i) => ({ key: i.id, name: i.title, sub: `${i.id} · live ${fmtDate(i.execution?.effectiveDate ?? i.implementedAt)}`, realised: ideaRealised(ledger, i.id), validated: ideaRealised(ledger, i.id, true), annual: ideaApprovedAnnualised(i) }))
        .filter((r) => r.realised > 0).sort((a, b) => b.realised - a.realised)
    }
    const m = new Map<string, { key: string; name: string; sub: string; realised: number; validated: number; annual: number; n: Set<string> }>()
    for (const l of ledger) {
      const idea = c.d.ideas.find((i) => i.id === l.ideaId)
      if (!idea) continue
      let r = m.get(idea.commodity)
      if (!r) { r = { key: idea.commodity, name: commodities.find((x) => x.code === idea.commodity)?.name ?? idea.commodity, sub: idea.commodity, realised: 0, validated: 0, annual: 0, n: new Set() }; m.set(idea.commodity, r) }
      r.realised += l.realised; if (l.financeStatus === 'Validated') r.validated += l.realised; r.n.add(l.ideaId)
    }
    return [...m.values()].map((r) => ({ ...r, sub: `${r.sub} · ${r.n.size} idea${r.n.size === 1 ? '' : 's'} realising` })).sort((a, b) => b.realised - a.realised)
  }, [by, c, ledger, commodities])
  const shown = rows.slice(0, 5)
  const max = Math.max(1, ...shown.map((r) => r.realised))
  return (
    <Card className={cn('h-full', className)} icon="Trophy" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Realisation leaders<InfoTip title="Realisation leaders">Largest MRN-based realised savings in the FY to date. The darker part of each bar is Finance validated.</InfoTip></span>}
      subtitle={`${c.fy} to date · by realised value`}
      actions={<Segmented size="sm" value={by} onChange={(k) => setBy(k as 'idea' | 'commodity')} options={[{ key: 'idea', label: 'Ideas' }, { key: 'commodity', label: 'Commodity' }]} />}>
      {shown.length ? (
        <div className="flex flex-col">
          {shown.map((r, k) => (
            <button key={r.key} onClick={() => (by === 'idea' ? openIdea(r.key) : drill({ commodity: r.key, bucket: 'Implemented' }))}
              className="group flex items-center gap-2.5 py-[7px] px-1 -mx-1 rounded-md hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
              <span className="h-5 w-5 rounded-md grid place-items-center text-[10.5px] font-bold shrink-0 num bg-slate-100 text-slate-600">{k + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-ink truncate group-hover:text-brand-700">{r.name}</span>
                <span className="block text-[10.5px] text-muted truncate">{r.sub}</span>
              </span>
              <span className="w-[96px] shrink-0 text-right">
                <span className="block text-[12.5px] font-bold text-accent-700 num">{inrShort(r.realised)}</span>
                <span className="flex h-[3px] rounded-full overflow-hidden bg-slate-100 mt-1">
                  <span style={{ width: `${(r.validated / max) * 100}%`, background: FIN.validated }} />
                  <span style={{ width: `${((r.realised - r.validated) / max) * 100}%`, background: FIN.pending }} />
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : <EmptyState icon="BadgeIndianRupee" title="Nothing realised yet" desc="Realisation flows from MRN after the effective date." className="py-6" />}
      {rows.length > shown.length && <div className="text-[10.5px] text-muted mt-auto pt-1.5">Top {shown.length} of {rows.length}</div>}
    </Card>
  )
}
