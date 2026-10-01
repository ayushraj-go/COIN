// Sourcing Home charts — every segment drills down to the ideas behind it (Section 14)
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, Cell, ComposedChart, CartesianGrid, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../store/useStore'
import type { Bucket, Idea, LeverGroup } from '../../lib/types'
import { EVALUATION_STAGES, FEASIBILITY_STAGES, LEVER_GROUP_STYLE } from '../../lib/masters'
import { BUCKET_STYLE, STRUCTURAL_LEVERS, ideaAnnualised, leverGroupOf, summarise } from '../../lib/calc'
import { STRUCTURAL_NOTE, KPIS } from '../../lib/scope'
import { fyMonths, inrShort, monthLong, monthShort, pct, sum } from '../../lib/format'
import { Badge, Button, Card, DataTable, Icon, InfoTip, ProgressBar, Segmented, UserChip, cn, type Column } from '../../components/ui'
import type { HomeData } from './data'
import { useScopedCommodities } from './data'
import { AXIS_TICK, BucketFilterChip, ChartTip, DrillModal, GRID_STROKE, drillUrl, useDrill } from './shared'

const kpiTip = (id: string) => { const k = KPIS.find((x) => x.id === id)!; return <InfoTip title={`${k.id} · ${k.kpi}`} formula={k.formula}>Cut by: {k.cut}</InfoTip> }

// ─── Savings trend by month ───────────────────────────────────────────────────
const TREND_COLORS = { realised: '#4ade80', validated: '#0b7a55', cumulative: '#2f5bc6' }

export function TrendCard({ d, className, height = 262 }: { d: HomeData; className?: string; height?: number }) {
  const fv = useStore((s) => s.settings.financeValidation)
  const lrm = useStore((s) => s.settings.lastRealisationMonth)
  const ledger = useStore((s) => s.ledger)
  const filters = useStore((s) => s.filters)
  const [month, setMonth] = useState<string | null>(null)
  const s = d.summary
  const avgSoFar = (() => { const pts = d.trend.filter((t) => t.realised != null); return pts.length ? sum(pts.map((t) => (fv ? t.validated ?? 0 : t.realised ?? 0))) / pts.length : 0 })()
  const monthIdeas = useMemo(() => {
    if (!month) return [] as Idea[]
    const ids = new Set(ledger.filter((l) => l.month === month).map((l) => l.ideaId))
    return d.ideas.filter((i) => ids.has(i.id) && i.savingsType === 'Hard')
  }, [month, ledger, d.ideas])
  const realisedIn = (i: Idea) => sum(ledger.filter((l) => l.month === month && l.ideaId === i.id).map((l) => l.realised))
  const lrmLabel = monthShort(lrm)
  const showRef = d.trend.some((t) => t.month === lrm)
  return (
    <Card className={cn('h-full', className)} icon="ChartColumnBig"
      title={<span className="flex items-center gap-1.5">Savings trend by month<InfoTip title="Savings trend" formula="Realised = (P(baseline) − P(approved)) × Q(MRN after effective date)">Bars: monthly realised hard savings (left axis). Line: cumulative {fv ? 'validated' : 'realised'} savings (right axis). Click a month to see the ideas behind it.</InfoTip></span>}
      subtitle={`${d.fy} · MRN-based realisation to ${monthLong(lrm)} · hard savings only`}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-lg bg-slate-50 border border-line px-2.5 py-1.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Realised FY to date</div><div className="text-[14px] font-bold text-green-700 num">{inrShort(s.realised)}</div></div>
        <div className="rounded-lg bg-slate-50 border border-line px-2.5 py-1.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Avg {fv ? 'validated' : 'realised'} / month</div><div className="text-[14px] font-bold text-ink num">{inrShort(avgSoFar)}</div></div>
      </div>
      <div style={{ height }} className="-ml-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d.trend} margin={{ top: 10, right: 2, left: 0, bottom: 0 }} barGap={2}
            onClick={(e: any) => { const m = e?.activePayload?.[0]?.payload?.month; if (m && m <= lrm) setMonth(m) }}>
            <defs>
              <linearGradient id="homeTrRealised" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={0.95} /><stop offset="100%" stopColor="#bbf7d0" stopOpacity={0.7} /></linearGradient>
              <linearGradient id="homeTrValidated" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f9f6e" /><stop offset="100%" stopColor="#0b7a55" /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="m" tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => inrShort(v, 0)} />
            <YAxis yAxisId="c" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={62} tickFormatter={(v) => inrShort(v, 0)} />
            <RTooltip cursor={{ fill: '#f1f5f9', radius: 6 } as any} content={<ChartTip colors={TREND_COLORS} labelFmt={(_: any, p: any) => monthLong(p?.[0]?.payload?.month ?? '')} />} />
            {showRef && <ReferenceLine yAxisId="c" x={lrmLabel} stroke="#cbd5e1" strokeDasharray="2 3" label={{ value: 'Last realisation run', position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }} />}
            <Bar yAxisId="m" dataKey="realised" name="Realised (month)" fill="url(#homeTrRealised)" radius={[4, 4, 0, 0]} maxBarSize={16} className="cursor-pointer" />
            <Bar yAxisId="m" dataKey="validated" name="Finance validated (month)" fill="url(#homeTrValidated)" radius={[4, 4, 0, 0]} maxBarSize={16} className="cursor-pointer" />
            <Line yAxisId="c" type="monotone" dataKey="cumulative" name={fv ? 'Cumulative validated' : 'Cumulative realised'} stroke={TREND_COLORS.cumulative} strokeWidth={2.2} dot={{ r: 2.5, fill: '#2f5bc6' }} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#86efac' }} />Realised (month)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-700" />Finance validated (month)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: TREND_COLORS.cumulative }} />Cumulative {fv ? 'validated' : 'realised'}</span>
      </div>
      <DrillModal open={!!month} onClose={() => setMonth(null)} title={month ? `Realised in ${monthLong(month)}` : ''} ideas={monthIdeas} valueFn={realisedIn} valueLabel={month ? `Realised in ${monthShort(month)}` : 'Realised'}
        links={[{ label: 'Open Implemented ideas', url: drillUrl({ bucket: 'Implemented' }, filters) }]} />
    </Card>
  )
}

// ─── Funnel by stage (count + ₹) ──────────────────────────────────────────────
interface Step { key: string; label: string; stages: string[]; bucket: Exclude<Bucket, 'Draft'>; icon: string }
const STEPS: Step[] = [
  { key: 'validation', label: 'Buyer validation', stages: ['Buyer validation'], bucket: 'Pipeline', icon: 'ClipboardCheck' },
  { key: 'feasibility', label: 'Supplier feasibility', stages: FEASIBILITY_STAGES, bucket: 'Pipeline', icon: 'Factory' },
  { key: 'evaluation', label: 'Technical evaluation', stages: EVALUATION_STAGES, bucket: 'Pipeline', icon: 'FlaskConical' },
  { key: 'approval', label: 'Approval', stages: ['Approval'], bucket: 'Pipeline', icon: 'Stamp' },
  { key: 'npd', label: 'NPD sample', stages: ['NPD sample', 'NPD ECN up to sample approval'], bucket: 'In Execution', icon: 'TestTubes' },
  { key: 'pap', label: 'PAP price / source', stages: ['Price revision in PAP', 'Price / source change in PAP'], bucket: 'In Execution', icon: 'FileBadge' },
  { key: 'execution', label: 'Execution (internal)', stages: ['Execution'], bucket: 'In Execution', icon: 'Wrench' },
  { key: 'implemented', label: 'Implemented', stages: ['Implemented'], bucket: 'Implemented', icon: 'CircleCheckBig' },
  { key: 'dropped', label: 'Dropped / rejected', stages: ['Dropped', 'Rejected'], bucket: 'Dropped', icon: 'CircleSlash' },
]

export function FunnelCard({ d, sel, onClear, className }: { d: HomeData; sel: Bucket | null; onClear: () => void; className?: string }) {
  const drill = useDrill()
  const filters = useStore((s) => s.filters)
  const [open, setOpen] = useState<Step | null>(null)
  const rows = STEPS.map((st) => {
    const ideas = d.active.filter((i) => st.stages.includes(i.stage))
    return { st, ideas, count: ideas.length, value: sum(ideas.map((x) => ideaAnnualised(x))), present: st.stages.filter((x) => ideas.some((i) => i.stage === x)) }
  })
  const max = Math.max(1, ...rows.map((r) => r.count))
  const dropRate = d.submitted ? (d.summary.counts.Dropped / d.submitted) * 100 : 0
  const click = (r: (typeof rows)[number]) => {
    if (r.st.key === 'dropped') return drill({ bucket: 'Dropped' })
    if (r.present.length > 1) return setOpen(r.st)
    drill({ stage: r.present[0] ?? r.st.stages[0] })
  }
  const openRow = rows.find((r) => r.st.key === open?.key)
  return (
    <Card className={cn('h-full', className)} icon="Filter"
      title={<span className="flex items-center gap-2">Funnel by stage{kpiTip('B1')}<BucketFilterChip bucket={sel} onClear={onClear} /></span>}
      subtitle={`${d.submitted} submitted ideas · count and ₹ per stage · click to drill down`}>
      <div className="flex flex-col gap-[5px]">
        {rows.map((r) => {
          const st = BUCKET_STYLE[r.st.bucket]
          const dim = sel && sel !== r.st.bucket
          const w = r.count ? Math.max(8, (r.count / max) * 100) : 0
          return (
            <button key={r.st.key} onClick={() => click(r)} className={cn('group grid grid-cols-[minmax(0,128px)_1fr_auto] items-center gap-2 h-[27px] rounded-md px-1 -mx-1 text-left transition-opacity hover:bg-slate-50', dim && 'opacity-30')}>
              <span className="flex items-center gap-1.5 min-w-0 text-[12px] text-ink-2 group-hover:text-ink">
                <Icon name={r.st.icon} size={13} style={{ color: st.color }} className="shrink-0" /><span className="truncate">{r.st.label}</span>
              </span>
              <span className="relative h-[20px] flex justify-center">
                <span className="absolute inset-y-[9px] inset-x-0 rounded-full bg-slate-100" />
                {r.count > 0 && <span className="relative h-full rounded-md grid place-items-center text-[10.5px] font-bold text-white transition-all duration-700" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${st.color}cc, ${st.color})`, boxShadow: sel === r.st.bucket ? `0 0 0 2px ${st.color}44` : undefined }}>{r.count}</span>}
              </span>
              <span className="w-[74px] text-right text-[12px] font-semibold text-ink num">{r.count ? inrShort(r.value) : '—'}</span>
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-line">
        <div><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">Conversion{kpiTip('B2')}</div><div className="text-[14px] font-bold text-green-700 num">{pct(d.conversion)} <span className="text-[11px] font-medium text-muted">{d.implemented} of {d.submitted}</span></div></div>
        <div><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">Drop rate{kpiTip('B3')}</div><div className="text-[14px] font-bold text-slate-600 num">{pct(dropRate)} <span className="text-[11px] font-medium text-muted">{d.summary.counts.Dropped} dropped</span></div></div>
      </div>
      <DrillModal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.label} — stage drill-down` : ''} ideas={openRow?.ideas ?? []}
        links={openRow?.present.map((p) => ({ label: p, url: drillUrl({ stage: p }, filters) }))} />
    </Card>
  )
}

// ─── Lever group mix donut ────────────────────────────────────────────────────
export function LeverMixCard({ d, sel, onClear, className }: { d: HomeData; sel: Bucket | null; onClear: () => void; className?: string }) {
  const levers = useStore((s) => s.levers)
  const drill = useDrill()
  const [hover, setHover] = useState<number | null>(null)
  const groups = Object.keys(LEVER_GROUP_STYLE) as LeverGroup[]
  const base = sel ? d.active.filter((i) => i.bucket === sel) : d.active.filter((i) => i.bucket !== 'Dropped')
  const data = groups.map((g) => {
    const list = base.filter((i) => leverGroupOf(levers, i.leverId) === g)
    return { name: g, value: sum(list.map((x) => ideaAnnualised(x))), count: list.length, color: LEVER_GROUP_STYLE[g].color }
  })
  const total = sum(data.map((x) => x.value)) || 1
  // E1 / E2 on realised savings
  const realisedBy = (pred: (leverId: string) => boolean) => sum(d.ledger.filter((l) => { const i = d.ideas.find((x) => x.id === l.ideaId); return i && i.savingsType === 'Hard' && pred(i.leverId) }).map((l) => l.realised))
  const realisedAll = realisedBy(() => true)
  const structural = realisedAll ? (realisedBy((id) => STRUCTURAL_LEVERS.includes(id)) / realisedAll) * 100 : 0
  const negotiation = realisedAll ? (realisedBy((id) => id === 'L01') / realisedAll) * 100 : 0
  const h = hover != null ? data[hover] : null
  return (
    <Card className={cn('h-full', className)} icon="ChartPie"
      title={<span className="flex items-center gap-2">Category mix<InfoTip title="Category mix">Share of annualised impact by category group. All categories roll up to Total Productivity in reports. Click a slice to see its ideas.</InfoTip><BucketFilterChip bucket={sel} onClear={onClear} /></span>}
      subtitle={`${sel ?? 'Active ideas'} · annualised impact by group`}>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative h-[176px] w-[176px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2} cornerRadius={4} stroke="none" isAnimationActive
                onMouseEnter={(_, k) => setHover(k)} onMouseLeave={() => setHover(null)} onClick={(p: any) => drill({ group: p.name, bucket: sel ?? undefined })} className="cursor-pointer">
                {data.map((x, k) => <Cell key={x.name} fill={x.color} opacity={hover == null || hover === k ? 1 : 0.35} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{h ? h.name : 'Total'}</div>
              <div className="text-[16px] font-extrabold text-ink num">{inrShort(h ? h.value : total)}</div>
              <div className="text-[10.5px] text-muted">{h ? `${pct((h.value / total) * 100)} · ${h.count} ideas` : `${base.length} ideas`}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 w-full flex flex-col gap-1">
          {data.map((x, k) => {
            const g = LEVER_GROUP_STYLE[x.name as LeverGroup]
            return (
              <button key={x.name} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onClick={() => drill({ group: x.name, bucket: sel ?? undefined })} className={cn('flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50 transition-opacity', hover != null && hover !== k && 'opacity-50')}>
                <span className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ background: g.soft, color: g.color }}><Icon name={g.icon} size={13} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[12px]"><span className="font-semibold text-ink truncate">{x.name}</span><span className="font-bold text-ink num">{inrShort(x.value)}</span></span>
                  <span className="flex items-center gap-2 mt-0.5"><ProgressBar value={(x.value / total) * 100} height={4} color={g.color} className="flex-1" /><span className="text-[10.5px] text-muted num w-[64px] text-right">{pct((x.value / total) * 100, 0)} · {x.count}</span></span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-line">
        <div><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">Structural share<InfoTip title="E2 · Structural savings share" formula="(VA/VE + material + localisation) ÷ total realised">{STRUCTURAL_NOTE}</InfoTip></div><div className="text-[14px] font-bold text-indigo-700 num">{pct(structural)} <span className="text-[11px] font-medium text-muted">of realised</span></div></div>
        <div><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">Negotiation share{kpiTip('E1')}</div><div className="text-[14px] font-bold num" style={{ color: negotiation > 50 ? '#e0364f' : '#6d28d9' }}>{pct(negotiation)} <span className="text-[11px] font-medium text-muted">of realised</span></div></div>
      </div>
    </Card>
  )
}

// ─── Commodity heat table ─────────────────────────────────────────────────────
interface ComRow { code: string; name: string; category: string; buyerId: string; realised: number; pipeline: number; conversion: number; ideas: number; implemented: number; leakage: number }

export function CommodityHeatCard({ d, className, limit }: { d: HomeData; className?: string; limit?: number }) {
  const comms = useScopedCommodities()
  const categories = useStore((s) => s.categories)
  const settings = useStore((s) => s.settings)
  const ledger = useStore((s) => s.ledger)
  const drill = useDrill()
  const nav = useNavigate()
  const rows: ComRow[] = useMemo(() => comms.map((c) => {
    const ideas = d.ideas.filter((i) => i.commodity === c.code)
    const sm = summarise(ideas, ledger, 0, d.fy, settings.financeValidation, settings.lastRealisationMonth)
    const submitted = ideas.filter((i) => i.bucket !== 'Draft').length
    return {
      code: c.code, name: c.name, category: categories.find((x) => x.id === c.categoryId)?.name ?? c.categoryId, buyerId: c.buyerId,
      realised: sm.realisedCounting, pipeline: sm.pipeline,
      conversion: submitted ? (sm.counts.Implemented / submitted) * 100 : 0, ideas: submitted, implemented: sm.counts.Implemented, leakage: sm.leakage,
    }
  }).sort((a, b) => b.realised + b.pipeline - (a.realised + a.pipeline)).slice(0, limit ?? 999), [comms, d.ideas, d.fy, ledger, settings, categories, limit])
  const cols: Column<ComRow>[] = [
    { key: 'name', label: 'Commodity', value: (r) => r.name, render: (r) => <span className="flex flex-col leading-tight"><span className="font-semibold text-ink text-[12.5px]">{r.name}</span><span className="text-[11px] text-muted">{r.code} · {r.category}</span></span> },
    { key: 'buyer', label: 'Buyer', value: (r) => useStore.getState().users.find((u) => u.id === r.buyerId)?.name, render: (r) => <UserChip userId={r.buyerId} size={20} /> },
    { key: 'ideas', label: 'Ideas', align: 'right', value: (r) => r.ideas, render: (r) => <span className="num font-semibold text-ink">{r.ideas}</span> },
    { key: 'realised', label: settings.financeValidation ? 'Realised (validated)' : 'Realised', align: 'right', value: (r) => r.realised, render: (r) => <span className="num text-green-700 font-semibold">{inrShort(r.realised)}</span> },
    { key: 'pipeline', label: 'Pipeline', align: 'right', value: (r) => r.pipeline, render: (r) => <span className="num text-blue-700">{inrShort(r.pipeline)}</span> },
    { key: 'conversion', label: 'Conversion', align: 'right', value: (r) => +r.conversion.toFixed(1), render: (r) => <span className="num"><b className="text-ink">{pct(r.conversion, 0)}</b> <span className="text-muted text-[11px]">{r.implemented}/{r.ideas}</span></span> },
    { key: 'leakage', label: 'Leakage', align: 'right', value: (r) => r.leakage, render: (r) => r.leakage > 0 ? <span className="num font-semibold text-red-600">{inrShort(r.leakage)}</span> : <span className="text-muted">—</span> },
  ]
  return (
    <Card className={cn('h-full', className)} icon="Grid3x3"
      title={<span className="flex items-center gap-1.5">Commodity overview<InfoTip title="Commodity overview">Ideas, pipeline value, realised savings, conversion and price leakage per commodity. Click a row for its ideas.</InfoTip></span>}
      subtitle={`${limit ? `Top ${rows.length}` : rows.length} commodit${rows.length === 1 ? 'y' : 'ies'} · pipeline, realised, conversion`}
      actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => nav('/reports/commodity')}>Scorecard</Button>}>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.code} onRowClick={(r) => drill({ commodity: r.code })} exportName={`COIN_Commodity_heat_${d.fy}`} maxHeight={452} />
    </Card>
  )
}

// ─── Idea portfolio: the four statuses as one picture (value or count) ────────
export function PortfolioCard({ d, className }: { d: HomeData; className?: string }) {
  const drill = useDrill()
  const [mode, setMode] = useState<'value' | 'count'>('value')
  const [hover, setHover] = useState<number | null>(null)
  const BK: Exclude<Bucket, 'Draft'>[] = ['Pipeline', 'In Execution', 'Implemented', 'Dropped']
  const data = BK.map((b) => ({ name: b, count: d.summary.counts[b], value: d.summary.values[b], color: BUCKET_STYLE[b].color }))
  const total = sum(data.map((x) => (mode === 'value' ? x.value : x.count))) || 1
  const totalIdeas = sum(data.map((x) => x.count))
  const totalValue = sum(data.map((x) => x.value))
  const fmt = (x: { count: number; value: number }) => (mode === 'value' ? inrShort(x.value) : `${x.count}`)
  return (
    <Card className={cn('h-full', className)} icon="ChartPie" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Idea portfolio<InfoTip title="Idea portfolio">Every submitted idea sits in exactly one of four statuses. Switch between annualised value and number of ideas. Click a status to open its ideas.</InfoTip></span>}
      subtitle={`${totalIdeas} ideas · ${inrShort(totalValue)} annualised impact`}
      actions={<Segmented size="sm" value={mode} onChange={(k) => setMode(k as 'value' | 'count')} options={[{ key: 'value', label: 'Value' }, { key: 'count', label: 'Ideas' }]} />}>
      <div className="flex-1 flex flex-col sm:flex-row items-center gap-8 min-h-0">
        <div className="relative h-[230px] w-[230px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={mode} nameKey="name" innerRadius={78} outerRadius={108} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}
                onMouseLeave={() => setHover(null)} onMouseEnter={(_: any, k: number) => setHover(k)} onClick={(p: any) => drill({ bucket: p?.name })} className="cursor-pointer">
                {data.map((x, k) => <Cell key={x.name} fill={x.color} opacity={hover == null || hover === k ? 1 : 0.35} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
            <div>
              <div className="text-[12px] text-muted">{hover != null ? data[hover].name : 'Total'}</div>
              <div className="text-[24px] font-bold text-ink num leading-tight">{hover != null ? fmt(data[hover]) : mode === 'value' ? inrShort(totalValue) : totalIdeas}</div>
              <div className="text-[12px] text-muted">{hover != null ? pct(((mode === 'value' ? data[hover].value : data[hover].count) / total) * 100, 0) : mode === 'value' ? 'annualised' : 'ideas'}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 w-full flex flex-col gap-1">
          {data.map((x, k) => {
            const share = ((mode === 'value' ? x.value : x.count) / total) * 100
            return (
              <button key={x.name} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onClick={() => drill({ bucket: x.name })}
                className={cn('w-full text-left rounded-lg px-3 py-2.5 transition-colors', hover === k ? 'bg-[#f9fafb]' : 'hover:bg-[#f9fafb]')}>
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.name}</span>
                  <span className="text-[14px] font-semibold text-ink num">{fmt(x)}</span>
                </span>
                <span className="flex items-center gap-3 mt-1.5">
                  <ProgressBar value={share} height={6} color={x.color} bg="#f2f4f7" className="flex-1" />
                  <span className="text-[12px] text-muted num w-[92px] text-right">{pct(share, 0)} · {mode === 'value' ? `${x.count} ideas` : inrShort(x.value)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
