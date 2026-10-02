// Reports: summary (CO savings / IN idea portfolio), savings bridge, commodity and buyer scorecards (CO and IN views), supplier innovation scorecard, category mix
import React, { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, ComposedChart, Line, PieChart, Pie } from 'recharts'
import { Card, KpiCard, Stagger, DataTable, Badge, StageBadge, LeverChip, UserChip, Avatar, InfoTip, Icon, SavingsTypeBadge, KV, cn, type Column } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { BUCKET_STYLE, ideaAnnualised } from '../../lib/calc'
import { LEVER_GROUP_STYLE } from '../../lib/masters'
import { STRUCTURAL_NOTE, KPIS } from '../../lib/scope'
import { inrShort, pct, monthLabel, num } from '../../lib/format'
import type { Idea, LeverGroup } from '../../lib/types'
import {
  type Ctx, homeData, bridgeData, commodityRows, buyerRows, supplierRows, leverData, committedHard, realisedOf, commodityName, nameOf, NEGOTIATION_FLAG_PCT,
  realisationRate, nonDraft, isBreach, safeDiv,
} from './model'
import type { Space } from './space'
import { AX, GRID, ChartTip, moneyTick, pctTick, useDrill, useIdeaList, Legend, MeterRow, SectionNote, CURSOR } from './chartkit'

const kf = (id: string) => KPIS.find((k) => k.id === id)!

export function KpiStrip({ items }: { items: React.ComponentProps<typeof KpiCard>[] }) {
  const cls = items.length >= 6 ? 'xl:grid-cols-3 2xl:grid-cols-6' : items.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
  return <Stagger className={cn('grid grid-cols-2 md:grid-cols-3 gap-3', cls)}>{items.map((k) => <KpiCard key={k.label} {...k} />)}</Stagger>
}

function ChartBox({ height = 260, children }: { height?: number; children: React.ReactElement }) {
  return <div style={{ height }} className="w-full min-w-0"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
}

export function ideaColumns(ctx: Ctx, extra: Column<Idea>[] = []): Column<Idea>[] {
  return [
    { key: 'id', label: 'Idea ID', render: (i) => <span className="font-mono text-[11.5px] font-semibold text-brand-700">{i.id}</span> },
    { key: 'title', label: 'Title', render: (i) => <span className="block max-w-[320px] truncate font-medium text-ink" title={i.title}>{i.title}</span> },
    { key: 'commodity', label: 'Commodity', value: (i) => commodityName(ctx, i.commodity) },
    { key: 'lever', label: 'Category', value: (i) => ctx.levers.find((l) => l.id === i.leverId)?.name, render: (i) => <LeverChip leverId={i.leverId} /> },
    { key: 'stage', label: 'Stage', value: (i) => i.stage, render: (i) => <StageBadge stage={i.stage} bucket={i.bucket} /> },
    ...extra,
  ]
}

// ═══ 1. Summary: CO "Savings summary" · IN "Idea portfolio summary" ═════════
export function HomeReport({ ctx, month, space = 'CO' }: { ctx: Ctx; month?: string; space?: Space }) {
  return space === 'IN' ? <HomeIN ctx={ctx} /> : <HomeCO ctx={ctx} month={month} />
}

function HomeCO({ ctx, month }: { ctx: Ctx; month?: string }) {
  const d = useMemo(() => homeData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const openIdea = useStore((s) => s.openIdea)
  const s = ctx.sum
  const monthIdeas = (m: string) => { const ids = new Set(ctx.hardLed.filter((l) => l.month === m).map((l) => l.ideaId)); return ctx.ideas.filter((i) => ids.has(i.id)) }
  const trend = d.trend.map((m) => ({ ...m, pending: m.realised - m.validated, cumulative: m.future ? null : m.cumulative }))
  const top = useMemo(() => ctx.ideas.filter((i) => i.bucket === 'In Execution' || i.bucket === 'Implemented').sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 10), [ctx])
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: ctx.fv ? 'Realised (validated)' : 'Realised', value: s.realisedCounting, icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula, sub: `${s.counts.Implemented} ideas implemented`, onClick: () => drill({ bucket: 'Implemented' }) },
        { label: 'Committed (remaining)', value: s.remainingCommitted, icon: 'Rocket', color: '#ec8a1c', formula: 'Σ FY-phased saving still to come (In Execution + implemented months not yet realised)', sub: `${s.counts['In Execution']} ideas in execution`, onClick: () => drill({ bucket: 'In Execution' }) },
        { label: 'Implemented (annualised)', value: s.values.Implemented, icon: 'CircleCheck', color: '#0d9488', sub: `${s.counts.Implemented} ideas`, onClick: () => drill({ bucket: 'Implemented' }) },
        { label: 'Carry-over to next FY', value: s.carryOver, icon: 'CalendarArrowUp', color: '#4f46e5', formula: kf('A9').formula },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-4" title="Savings summary" icon="BadgeIndianRupee" actions={<InfoTip title="Savings summary" formula="Realised from MRN; committed = FY-phased saving still to come">Hard savings only. Cost avoidance and one-time savings are reported separately.</InfoTip>}>
          <div className="mt-1">
            <KV k={ctx.fv ? 'Realised (validated)' : 'Realised'} v={<span className="text-emerald-700">{inrShort(s.realisedCounting)}</span>} />
            {ctx.fv && <KV k="Realised (all, incl. pending)" v={inrShort(s.realised)} />}
            <KV k="Committed (remaining)" v={<span className="text-orange-700">{inrShort(s.remainingCommitted)}</span>} />
            <KV k="Carry-over to next FY" v={inrShort(s.carryOver)} />
            <KV k="Price leakage" v={<span className="text-red-600">{inrShort(s.leakage)}</span>} />
            <KV k="Cost avoidance (separate)" v={inrShort(s.avoidance)} />
            <KV k="One-time (separate)" v={inrShort(s.oneTime)} />
          </div>
        </Card>
        <Card className="lg:col-span-8" title="Monthly savings trend" icon="ChartColumn" subtitle={`Hard savings realised from MRN · ${ctx.fy} · click a month for its ideas`}>
          <Legend className="mb-1" items={[{ label: 'Validated', color: '#0f9f6e' }, { label: 'Pending validation', color: '#86efac' }, { label: 'Cumulative realised', color: '#1e3a5f' }]} />
          <ChartBox height={244}>
            <ComposedChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} />
              <YAxis yAxisId="m" {...AX} tickFormatter={moneyTick} width={58} />
              <YAxis yAxisId="c" orientation="right" {...AX} tickFormatter={moneyTick} width={58} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number) => inrShort(v)} title={(l: string, p: any[]) => monthLabel(p?.[0]?.payload?.month ?? '') || l} />} />
              <Bar yAxisId="m" dataKey="validated" name="Validated" stackId="r" fill="#0f9f6e" onClick={(x: any) => list.show(`Ideas realising saving in ${monthLabel(x.month)}`, monthIdeas(x.month))} cursor="pointer">
                {trend.map((t) => <Cell key={t.month} fillOpacity={month && month !== t.month ? 0.35 : 1} />)}
              </Bar>
              <Bar yAxisId="m" dataKey="pending" name="Pending validation" stackId="r" fill="#86efac" radius={[4, 4, 0, 0]} onClick={(x: any) => list.show(`Ideas realising saving in ${monthLabel(x.month)}`, monthIdeas(x.month))} cursor="pointer">
                {trend.map((t) => <Cell key={t.month} fillOpacity={month && month !== t.month ? 0.35 : 1} />)}
              </Bar>
              <Line yAxisId="c" type="monotone" dataKey="cumulative" name="Cumulative realised" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
            </ComposedChart>
          </ChartBox>
        </Card>
      </div>
      <Card title="Top 10 ideas by value" icon="Trophy" subtitle="Annualised impact · In Execution and Implemented">
        <DataTable rows={top} rowKey={(i) => i.id} exportName="COIN_Top10_execution" onRowClick={(i) => openIdea(i.id)}
          columns={ideaColumns(ctx, [
            { key: 'annual', label: 'Annualised', align: 'right', value: (i) => ideaAnnualised(i), render: (i) => <span className="num font-semibold">{inrShort(ideaAnnualised(i))}</span> },
            { key: 'committed', label: `Committed ${ctx.fy}`, align: 'right', value: (i) => committedHard(ctx, i), render: (i) => <span className="num">{inrShort(committedHard(ctx, i))}</span> },
            { key: 'realised', label: 'Realised', align: 'right', value: (i) => realisedOf(ctx, [i]), render: (i) => <span className="num text-emerald-700">{inrShort(realisedOf(ctx, [i]))}</span> },
          ])} />
      </Card>
      {list.el}
    </div>
  )
}

function HomeIN({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => homeData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const openIdea = useStore((s) => s.openIdea)
  const s = ctx.sum
  const maxStep = Math.max(1, d.steps[0].n)
  const conv = d.steps[0].n ? (d.steps[3].n / d.steps[0].n) * 100 : 0
  const BUCKETS = ['Pipeline', 'In Execution', 'Implemented', 'Dropped'] as const
  const inflow = useMemo(() => ctx.months.map((m) => {
    const list2 = ctx.ideas.filter((i) => (i.submittedAt ?? '').slice(0, 7) === m)
    const row: Record<string, any> = { month: m, label: monthLabel(m).split(' ')[0], ideas: list2, total: list2.length }
    BUCKETS.forEach((b) => { row[b] = list2.filter((i) => i.bucket === b).length })
    return row
  }), [ctx])
  const top = useMemo(() => ctx.ideas.filter((i) => i.bucket === 'Pipeline').sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 10), [ctx])
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Ideas submitted', value: ctx.ideas.length, money: false, icon: 'Lightbulb', color: '#1e3a5f', formula: kf('B1').formula, sub: `${inrShort(ctx.ideas.reduce((a, i) => a + ideaAnnualised(i), 0))} annualised` },
        { label: 'Pipeline value', value: s.pipeline, icon: 'Filter', color: '#3b74f2', formula: kf('A3').formula, sub: `${s.counts.Pipeline} ideas in pipeline`, onClick: () => drill({ bucket: 'Pipeline' }) },
        { label: 'Conversion rate', value: conv, money: false, suffix: '%', digits: 1, icon: 'Percent', color: '#0f9f6e', formula: kf('B2').formula, sub: `${d.steps[3].n} of ${d.steps[0].n} implemented` },
        { label: 'Dropped', value: s.counts.Dropped, money: false, icon: 'CircleX', color: '#6b7280', formula: kf('B3').formula, sub: `${inrShort(s.values.Dropped)} annualised`, onClick: () => drill({ bucket: 'Dropped' }) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-5" title="Idea funnel" icon="Filter" subtitle="Count and ₹ per bucket · stage-to-stage conversion">
          <div className="grid grid-cols-2 gap-2">
            {d.buckets.map((b) => {
              const st = BUCKET_STYLE[b.bucket]
              return (
                <button key={b.bucket} onClick={() => drill({ bucket: b.bucket })} className="text-left rounded-xl border border-line bg-white px-3 py-2 hover:shadow-sm transition">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: st.text }}><span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{b.bucket}</div>
                  <div className="flex items-baseline justify-between mt-1"><span className="text-[20px] font-bold text-ink num">{b.count}</span><span className="text-[12.5px] font-semibold num text-ink-2">{inrShort(b.value)}</span></div>
                </button>
              )
            })}
          </div>
          <div className="mt-3 space-y-1.5">
            {d.steps.map((st, k) => {
              const c = k ? (st.n / Math.max(1, d.steps[k - 1].n)) * 100 : 100
              return (
                <button key={st.step} onClick={() => list.show(`${st.step} ideas`, st.ideas)} className="w-full flex items-center gap-2 group">
                  <span className="w-[78px] text-[11.5px] text-muted text-left shrink-0">{st.step}</span>
                  <span className="flex-1 flex justify-center"><span className="h-6 rounded-md grid place-items-center text-[11.5px] font-bold text-white transition group-hover:brightness-110" style={{ width: `${Math.max(14, (st.n / maxStep) * 100)}%`, background: ['#64748b', '#4470d6', '#ec8a1c', '#14ab92'][k] }}>{st.n}</span></span>
                  <span className="w-[46px] text-right text-[11px] font-semibold num text-ink-2">{k ? pct(c, 0) : ''}</span>
                </button>
              )
            })}
          </div>
        </Card>
        <Card className="lg:col-span-7" title="Monthly idea inflow" icon="ChartColumnStacked" subtitle={`Ideas submitted each month of ${ctx.fy}, by where they are now · click a month for its ideas`}>
          <Legend className="mb-1" items={BUCKETS.map((b) => ({ label: b, color: BUCKET_STYLE[b].color }))} />
          <ChartBox height={244}>
            <BarChart data={inflow} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} />
              <YAxis {...AX} allowDecimals={false} />
              <Tooltip cursor={CURSOR} content={<ChartTip title={(_l: string, p: any[]) => monthLabel(p?.[0]?.payload?.month ?? '')} />} />
              {BUCKETS.map((b, k) => (
                <Bar key={b} dataKey={b} name={b} stackId="i" fill={BUCKET_STYLE[b].color} radius={k === BUCKETS.length - 1 ? [4, 4, 0, 0] : undefined} cursor="pointer" onClick={(x: any) => list.show(`Ideas submitted in ${monthLabel(x.month)}`, x.ideas)} />
              ))}
            </BarChart>
          </ChartBox>
        </Card>
      </div>
      <Card title="Top 10 pipeline ideas by value" icon="Trophy" subtitle="Annualised impact of ideas still under review">
        <DataTable rows={top} rowKey={(i) => i.id} exportName="COIN_Top10_pipeline" onRowClick={(i) => openIdea(i.id)}
          columns={ideaColumns(ctx, [
            { key: 'buyer', label: 'Buyer', value: (i) => nameOf(ctx, i.buyerId), render: (i) => <UserChip userId={i.buyerId} size={20} /> },
            { key: 'type', label: 'Savings type', value: (i) => i.savingsType, render: (i) => <SavingsTypeBadge type={i.savingsType} /> },
            { key: 'annual', label: 'Annualised', align: 'right', value: (i) => ideaAnnualised(i), render: (i) => <span className="num font-semibold">{inrShort(ideaAnnualised(i))}</span> },
          ])} />
      </Card>
      {list.el}
    </div>
  )
}

// ═══ 2. Savings bridge ════════════════════════════════════════════════════════
export function BridgeReport({ ctx }: { ctx: Ctx }) {
  const b = useMemo(() => bridgeData(ctx), [ctx])
  const rows = useMemo(() => commodityRows(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const click = (r: (typeof b.rows)[number]) => {
    if (r.key === 'total') list.show('Hard-saving ideas tracked this FY', ctx.ideas.filter((i) => i.bucket !== 'Dropped' && i.savingsType === 'Hard').sort((x, y) => ideaAnnualised(y) - ideaAnnualised(x)), '/ideas?savingsType=Hard')
    else drill(r.drill)
  }
  const maxTotal = Math.max(1, ...rows.map((r) => r.realised + r.remaining + r.pipeline))
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: ctx.fv ? 'Realised (validated)' : 'Realised', value: b.R, icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula, onClick: () => drill({ bucket: 'Implemented' }) },
        { label: 'Committed (remaining)', value: b.C, icon: 'Rocket', color: '#ec8a1c', formula: kf('A4').formula, onClick: () => drill({ bucket: 'In Execution' }) },
        { label: 'Pipeline', value: b.P, icon: 'Filter', color: '#3b74f2', formula: kf('A3').formula, onClick: () => drill({ bucket: 'Pipeline' }) },
        { label: 'Total tracked', value: b.total, icon: 'Sigma', color: '#2459e0', formula: 'Realised + remaining committed + pipeline' },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-8" title="Savings bridge" icon="ChartColumnStacked" subtitle="Waterfall: realised → committed → pipeline → total tracked">
          <ChartBox height={330}>
            <BarChart data={b.rows} margin={{ top: 24, right: 12, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} interval={0} />
              <YAxis {...AX} tickFormatter={moneyTick} width={60} />
              <Tooltip cursor={CURSOR} content={<ChartTip hide={['base']} fmt={(v: number) => inrShort(v)} />} />
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" name="Value" stackId="w" radius={[5, 5, 0, 0]} cursor="pointer" onClick={(x: any) => click(x)}>
                {b.rows.map((r) => <Cell key={r.key} fill={r.color} />)}
                <LabelList dataKey="value" position="top" formatter={(v: number) => inrShort(v)} style={{ fontSize: 11, fontWeight: 700, fill: '#0f172a' }} />
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-4" title="Bridge steps" icon="ListOrdered" subtitle="Each step as ₹ and % of total tracked">
          <div className="divide-y divide-slate-100">
            {b.rows.map((r, k) => (
              <button key={r.key} onClick={() => click(r)} className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-slate-50 rounded-md px-1">
                <span className="h-6 w-6 rounded-md grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: r.color }}>{k + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink">{r.label}</span>
                  <span className="block text-[11px] text-muted truncate">{({ realised: ctx.fv ? 'Finance-validated MRN-based hard saving' : 'MRN-based hard saving', committed: 'Remaining FY-phased committed saving', pipeline: 'Σ annualised impact of Pipeline ideas', total: 'Realised + committed + pipeline' } as Record<string, string>)[r.key]}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] font-bold num text-ink">{inrShort(r.value)}</span>
                  <span className="block text-[11px] text-muted num">{pct((r.value / (b.total || 1)) * 100, 1)}</span>
                </span>
              </button>
            ))}
          </div>
          <SectionNote icon="Info" tone="blue">
            <b>{inrShort(b.RC)}</b> is realised or committed; a further <b>{inrShort(b.P)}</b> sits in the pipeline awaiting validation and approval.
          </SectionNote>
        </Card>
      </div>
      <Card title="Bridge by commodity" icon="Layers" subtitle="Realised · committed · pipeline per commodity — click a row for its ideas">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Commodity</th><th style={{ textAlign: 'right' }}>Realised</th><th style={{ textAlign: 'right' }}>Committed</th><th style={{ textAlign: 'right' }}>Pipeline</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ width: '28%' }}>Bridge</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const tot = r.realised + r.remaining + r.pipeline
                return (
                  <tr key={r.code} className="clickable" onClick={() => drill({ commodity: r.code })}>
                    <td><span className="font-semibold text-ink">{r.name}</span> <span className="text-muted text-[11px] font-mono">{r.code}</span></td>
                    <td className="num text-emerald-700" style={{ textAlign: 'right' }}>{inrShort(r.realised)}</td>
                    <td className="num text-orange-700" style={{ textAlign: 'right' }}>{inrShort(r.remaining)}</td>
                    <td className="num text-blue-700" style={{ textAlign: 'right' }}>{inrShort(r.pipeline)}</td>
                    <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(tot)}</td>
                    <td>
                      <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden flex">
                        <div style={{ width: `${(r.realised / maxTotal) * 100}%`, background: '#0f9f6e' }} />
                        <div style={{ width: `${(r.remaining / maxTotal) * 100}%`, background: '#ec8a1c' }} />
                        <div style={{ width: `${(r.pipeline / maxTotal) * 100}%`, background: '#3b74f2' }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Legend className="mt-2" items={[{ label: 'Realised', color: '#0f9f6e' }, { label: 'Committed (remaining)', color: '#ec8a1c' }, { label: 'Pipeline', color: '#3b74f2' }]} />
      </Card>
      {list.el}
    </div>
  )
}

// ═══ 3. Commodity scorecard: CO on realisation · IN on ideas ══════════════════
export function CommodityReport({ ctx, space = 'CO' }: { ctx: Ctx; space?: Space }) {
  return space === 'IN' ? <CommodityIN ctx={ctx} /> : <CommodityCO ctx={ctx} />
}

const commodityCols = (ctx: Ctx): Column<CRow>[] => [
  { key: 'name', label: 'Commodity', value: (r) => r.name, render: (r) => <span><span className="font-semibold text-ink">{r.name}</span> <span className="font-mono text-[11px] text-muted">{r.code}</span></span> },
  { key: 'category', label: 'Commodity group', value: (r) => ctx.categories.find((c) => c.id === r.categoryId)?.name },
  { key: 'lead', label: 'Commodity Lead', value: (r) => nameOf(ctx, r.leadId), render: (r) => <UserChip userId={r.leadId} size={20} /> },
  { key: 'buyer', label: 'Buyer', value: (r) => nameOf(ctx, r.buyerId), render: (r) => <UserChip userId={r.buyerId} size={20} /> },
]
type CRow = ReturnType<typeof commodityRows>[number]

function CommodityCO({ ctx }: { ctx: Ctx }) {
  const rows = useMemo(() => commodityRows(ctx).map((r) => ({ ...r, rate: realisationRate(ctx, r.ideas) })), [ctx])
  const drill = useDrill()
  const s = ctx.sum
  const spend = [...rows].sort((a, b) => b.spendPct - a.spendPct)
  const maxSpend = Math.max(0.01, ...rows.map((r) => r.spendPct))
  const rated = [...rows].filter((r) => r.rate > 0).sort((a, b) => b.rate - a.rate)
  const rate = realisationRate(ctx, ctx.all)
  const cols: Column<(typeof rows)[number]>[] = [
    ...(commodityCols(ctx) as Column<(typeof rows)[number]>[]),
    { key: 'realised', label: 'Realised', align: 'right', value: (r) => r.realised, render: (r) => <span className="num text-emerald-700">{inrShort(r.realised)}</span> },
    { key: 'remaining', label: 'Committed (remaining)', align: 'right', value: (r) => r.remaining, render: (r) => <span className="num text-orange-700">{inrShort(r.remaining)}</span> },
    { key: 'implemented', label: 'Implemented', align: 'right', value: (r) => r.implemented },
    { key: 'rate', label: 'Realisation rate', align: 'right', value: (r) => r.rate, render: (r) => <span className="num">{r.rate ? pct(r.rate, 0) : '—'}</span> },
    { key: 'leakage', label: 'Price leakage', align: 'right', value: (r) => r.leakage, render: (r) => <span className="num" style={{ color: r.leakage > 0 ? '#e0364f' : undefined }}>{inrShort(r.leakage)}</span> },
    { key: 'spendPct', label: 'Savings % of spend', align: 'right', value: (r) => r.spendPct, render: (r) => <span className="num">{pct(r.spendPct, 2)}</span> },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Commodities', value: rows.length, money: false, icon: 'Boxes', color: '#1e3a5f', sub: `${rows.filter((r) => r.realised > 0).length} with realised saving` },
        { label: ctx.fv ? 'Realised (validated)' : 'Realised', value: s.realisedCounting, icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula },
        { label: 'Committed (remaining)', value: s.remainingCommitted, icon: 'Rocket', color: '#ec8a1c', formula: kf('A4').formula },
        { label: 'Realisation rate', value: rate, money: false, suffix: '%', digits: 1, icon: 'Gauge', color: '#0d9488', formula: kf('D3').formula },
        { label: 'Price leakage', value: rows.reduce((a, r) => a + r.leakage, 0), icon: 'Droplets', color: '#e0364f', formula: kf('D4').formula },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-8" title="Realised & committed by commodity" icon="ChartColumn" actions={<Legend items={[{ label: 'Realised', color: '#0f9f6e' }, { label: 'Committed (remaining)', color: '#ec8a1c' }]} />}>
          <ChartBox height={300}>
            <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="code" {...AX} interval={0} />
              <YAxis {...AX} tickFormatter={moneyTick} width={58} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number) => inrShort(v)} title={(l: string) => commodityName(ctx, l)} />} />
              <Bar dataKey="realised" name="Realised" fill="#0f9f6e" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ commodity: x.code, bucket: 'Implemented' })} />
              <Bar dataKey="remaining" name="Committed (remaining)" fill="#ec8a1c" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ commodity: x.code, bucket: 'In Execution' })} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-4" title="Savings % of spend & realisation rate" icon="Percent" subtitle="Per commodity · click for its ideas">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Savings % of spend</div>
              {spend.map((r) => <MeterRow key={r.code} label={r.code} value={r.spendPct} max={maxSpend} color="#7c3aed" display={pct(r.spendPct, 2)} onClick={() => drill({ commodity: r.code })} />)}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Realisation rate</div>
              {rated.map((r) => <MeterRow key={r.code} label={r.code} value={Math.min(120, r.rate)} max={120} marker={100} color={r.rate >= 100 ? '#0f9f6e' : r.rate >= 80 ? '#ec8a1c' : '#e0364f'} display={pct(r.rate, 0)} onClick={() => drill({ commodity: r.code, bucket: 'Implemented' })} />)}
              {!rated.length && <div className="text-[11.5px] text-muted">No realisation yet</div>}
            </div>
          </div>
        </Card>
      </div>
      <Card title="Commodity scorecard" icon="Table2" subtitle="Execution and realisation per commodity · click a commodity to open its ideas">
        <DataTable rows={rows} rowKey={(r) => r.code} columns={cols} exportName="COIN_Commodity_scorecard_CO" onRowClick={(r) => drill({ commodity: r.code })} />
      </Card>
    </div>
  )
}

function CommodityIN({ ctx }: { ctx: Ctx }) {
  const rows = useMemo(() => commodityRows(ctx).map((r) => {
    const sub = r.ideas.filter(nonDraft)
    const by = (b: string) => sub.filter((i) => i.bucket === b).length
    return { ...r, nPipeline: by('Pipeline'), nExec: by('In Execution'), nImpl: by('Implemented'), nDropped: by('Dropped'), breaches: sub.filter((i) => isBreach(ctx, i)).length, dropRate: safeDiv(by('Dropped'), sub.length) * 100 }
  }), [ctx])
  const drill = useDrill()
  const totalSub = rows.reduce((a, r) => a + r.submitted, 0), totalImpl = rows.reduce((a, r) => a + r.implemented, 0)
  const conv = [...rows].filter((r) => r.submitted).sort((a, b) => b.conversion - a.conversion)
  const drops = [...rows].filter((r) => r.submitted).sort((a, b) => b.dropRate - a.dropRate)
  const cols: Column<(typeof rows)[number]>[] = [
    ...(commodityCols(ctx) as Column<(typeof rows)[number]>[]),
    { key: 'submitted', label: 'Ideas', align: 'right', value: (r) => r.submitted, render: (r) => <span className="num font-semibold">{r.submitted}</span> },
    { key: 'nPipeline', label: 'In pipeline', align: 'right', value: (r) => r.nPipeline },
    { key: 'pipeline', label: 'Pipeline value', align: 'right', value: (r) => r.pipeline, render: (r) => <span className="num">{inrShort(r.pipeline)}</span> },
    { key: 'implemented', label: 'Implemented', align: 'right', value: (r) => r.implemented },
    { key: 'conversion', label: 'Conversion', align: 'right', value: (r) => r.conversion, render: (r) => <span className="num">{pct(r.conversion, 0)}</span> },
    { key: 'dropped', label: 'Dropped', align: 'right', value: (r) => r.nDropped },
    { key: 'breaches', label: 'Beyond SLA', align: 'right', value: (r) => r.breaches, render: (r) => <span className="num" style={{ color: r.breaches ? '#e0364f' : undefined }}>{r.breaches}</span> },
  ]
  const BK = [['nPipeline', 'Pipeline'], ['nExec', 'In Execution'], ['nImpl', 'Implemented'], ['nDropped', 'Dropped']] as const
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Commodities', value: rows.length, money: false, icon: 'Boxes', color: '#1e3a5f', sub: `${rows.filter((r) => r.submitted > 0).length} with ideas` },
        { label: 'Ideas submitted', value: totalSub, money: false, icon: 'Lightbulb', color: '#1e3a5f', formula: kf('B1').formula },
        { label: 'Pipeline value', value: ctx.sum.pipeline, icon: 'Filter', color: '#3b74f2', formula: kf('A3').formula, onClick: () => drill({ bucket: 'Pipeline' }) },
        { label: 'Conversion rate', value: totalSub ? (totalImpl / totalSub) * 100 : 0, money: false, suffix: '%', digits: 1, icon: 'Percent', color: '#0f9f6e', formula: kf('B2').formula, sub: `${totalImpl} of ${totalSub} ideas` },
        { label: 'Ideas beyond SLA', value: rows.reduce((a, r) => a + r.breaches, 0), money: false, icon: 'Siren', color: '#e0364f', formula: kf('B4').formula, onClick: () => drill({ sla: 'breach' }) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-8" title="Ideas by commodity" icon="ChartColumnStacked" subtitle="Submitted ideas by where they are now" actions={<Legend items={BK.map(([, b]) => ({ label: b, color: BUCKET_STYLE[b].color }))} />}>
          <ChartBox height={300}>
            <BarChart data={rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="code" {...AX} interval={0} />
              <YAxis {...AX} allowDecimals={false} />
              <Tooltip cursor={CURSOR} content={<ChartTip title={(l: string) => commodityName(ctx, l)} />} />
              {BK.map(([k, b], n) => <Bar key={k} dataKey={k} name={b} stackId="b" fill={BUCKET_STYLE[b].color} radius={n === BK.length - 1 ? [4, 4, 0, 0] : undefined} cursor="pointer" onClick={(x: any) => drill({ commodity: x.code, bucket: b })} />)}
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-4" title="Conversion & drop rate" icon="Percent" subtitle="Per commodity · click for its ideas">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Conversion</div>
              {conv.map((r) => <MeterRow key={r.code} label={r.code} value={r.conversion} max={100} color="#0f9f6e" display={pct(r.conversion, 0)} onClick={() => drill({ commodity: r.code, bucket: 'Implemented' })} />)}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Drop rate</div>
              {drops.map((r) => <MeterRow key={r.code} label={r.code} value={r.dropRate} max={100} color="#6b7280" display={pct(r.dropRate, 0)} onClick={() => drill({ commodity: r.code, bucket: 'Dropped' })} />)}
            </div>
          </div>
        </Card>
      </div>
      <Card title="Commodity scorecard" icon="Table2" subtitle="Ideas, pipeline, conversion and SLA per commodity · click a commodity to open its ideas">
        <DataTable rows={rows} rowKey={(r) => r.code} columns={cols} exportName="COIN_Commodity_scorecard_IN" onRowClick={(r) => drill({ commodity: r.code })} />
      </Card>
    </div>
  )
}

// ═══ 4. Buyer scorecard: CO on delivery · IN on ideas ═════════════════════════
export function BuyerReport({ ctx, space = 'CO' }: { ctx: Ctx; space?: Space }) {
  const rows = useMemo(() => buyerRows(ctx).map((r) => {
    const sub = r.ideas.filter(nonDraft)
    const impl = sub.filter((i) => i.bucket === 'Implemented').length
    return { ...r, submitted: sub.length, nPipeline: sub.filter((i) => i.bucket === 'Pipeline').length, implemented: impl, conversion: safeDiv(impl, sub.length) * 100 }
  }), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const co = space === 'CO'
  const totDone = rows.reduce((a, r) => a + r.done, 0), totOnTime = rows.reduce((a, r) => a + r.onTime, 0)
  const totSub = rows.reduce((a, r) => a + r.submitted, 0), totImpl = rows.reduce((a, r) => a + r.implemented, 0)
  const ages = rows.filter((r) => !isNaN(r.avgAge))
  type R = (typeof rows)[number]
  const base: Column<R>[] = [
    { key: 'name', label: 'Buyer', value: (r) => r.name, render: (r) => <UserChip userId={r.id} size={22} /> },
    { key: 'commodities', label: 'Commodities', value: (r) => r.commodities.join(', ') },
  ]
  const cols: Column<R>[] = co ? [
    ...base,
    { key: 'realised', label: 'Realised', align: 'right', value: (r) => r.realised, render: (r) => <span className="num text-emerald-700">{inrShort(r.realised)}</span> },
    { key: 'committed', label: 'Committed (remaining)', align: 'right', value: (r) => r.committed, render: (r) => <span className="num text-orange-700">{inrShort(r.committed)}</span> },
    { key: 'onTime', label: 'On-time %', align: 'right', value: (r) => r.onTimePct, render: (r) => <span className="num">{isNaN(r.onTimePct) ? '—' : `${pct(r.onTimePct, 0)} (${r.onTime}/${r.done})`}</span> },
    { key: 'overdue', label: 'Overdue ₹', align: 'right', value: (r) => r.overdueValue, render: (r) => <span className="num font-semibold" style={{ color: r.overdueValue > 0 ? '#e0364f' : undefined }}>{inrShort(r.overdueValue)} {r.overdueCount ? `(${r.overdueCount})` : ''}</span> },
    { key: 'rate', label: 'Realisation rate', align: 'right', value: (r) => r.realisationRate, render: (r) => <span className="num">{pct(r.realisationRate, 0)}</span> },
  ] : [
    ...base,
    { key: 'submitted', label: 'Ideas', align: 'right', value: (r) => r.submitted, render: (r) => <span className="num font-semibold">{r.submitted}</span> },
    { key: 'pipeline', label: 'Pipeline value', align: 'right', value: (r) => r.pipeline, render: (r) => <span className="num">{inrShort(r.pipeline)}</span> },
    { key: 'implemented', label: 'Implemented', align: 'right', value: (r) => r.implemented },
    { key: 'conversion', label: 'Conversion', align: 'right', value: (r) => r.conversion, render: (r) => <span className="num">{pct(r.conversion, 0)}</span> },
    { key: 'age', label: 'Avg ageing (days)', align: 'right', value: (r) => r.avgAge, render: (r) => <span className="num">{isNaN(r.avgAge) ? '—' : num(r.avgAge, 1)}</span> },
    { key: 'breaches', label: 'Beyond SLA', align: 'right', value: (r) => r.breaches, render: (r) => <span className="num" style={{ color: r.breaches ? '#e0364f' : undefined }}>{r.breaches}</span> },
  ]
  const bars = co
    ? [{ k: 'realised', label: 'Realised', color: '#0f9f6e' }, { k: 'committed', label: 'Committed', color: '#ec8a1c' }]
    : [{ k: 'pipeline', label: 'Pipeline value', color: '#4470d6' }]
  const maxBar = Math.max(1, ...rows.map((r) => bars.reduce((a, b) => a + (r as any)[b.k], 0)))
  const tiles = (r: R): [string, string, string, (() => void)?][] => co ? [
    ['Realised', inrShort(r.realised), '#0b7a55'],
    ['On-time', isNaN(r.onTimePct) ? '—' : pct(r.onTimePct, 0), '#1e3a5f'],
    ['Overdue', inrShort(r.overdueValue), r.overdueValue > 0 ? '#e0364f' : '#1e3a5f', () => list.show(`${r.name} · overdue ideas`, r.overdueIdeas)],
    ['Rate', pct(r.realisationRate, 0), '#1e3a5f'],
  ] : [
    ['Ideas', String(r.submitted), '#1e3a5f'],
    ['Conv.', pct(r.conversion, 0), '#0b7a55'],
    ['Ageing', isNaN(r.avgAge) ? '—' : `${num(r.avgAge, 0)} d`, r.avgAge > 10 ? '#ec8a1c' : '#1e3a5f'],
    ['Over SLA', String(r.breaches), r.breaches ? '#e0364f' : '#1e3a5f', () => list.show(`${r.name} · ideas beyond SLA`, r.breachIdeas)],
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={co ? [
        { label: 'Buyers', value: rows.length, money: false, icon: 'Users', color: '#1e3a5f' },
        { label: ctx.fv ? 'Realised (validated)' : 'Realised', value: rows.reduce((a, r) => a + r.realised, 0), icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula },
        { label: 'On-time implementation', value: totDone ? (totOnTime / totDone) * 100 : 0, money: false, suffix: '%', digits: 1, icon: 'CalendarCheck', color: '#0f9f6e', formula: kf('D1').formula, sub: `${totOnTime} of ${totDone} done on time` },
        { label: 'Overdue value', value: rows.reduce((a, r) => a + r.overdueValue, 0), icon: 'Clock3', color: '#e0364f', formula: kf('D2').formula, onClick: () => drill({ health: 'Delayed' }) },
        { label: 'Realisation rate', value: realisationRate(ctx, ctx.all), money: false, suffix: '%', digits: 1, icon: 'Gauge', color: '#0d9488', formula: kf('D3').formula },
      ] : [
        { label: 'Buyers', value: rows.length, money: false, icon: 'Users', color: '#1e3a5f' },
        { label: 'Ideas', value: totSub, money: false, icon: 'Lightbulb', color: '#1e3a5f', formula: kf('B1').formula },
        { label: 'Conversion rate', value: totSub ? (totImpl / totSub) * 100 : 0, money: false, suffix: '%', digits: 1, icon: 'Percent', color: '#0f9f6e', formula: kf('B2').formula, sub: `${totImpl} of ${totSub} implemented` },
        { label: 'Avg ageing', value: ages.length ? ages.reduce((a, r) => a + r.avgAge, 0) / ages.length : 0, money: false, suffix: ' d', digits: 1, icon: 'Hourglass', color: '#ec8a1c', formula: kf('B4').formula },
        { label: 'Ideas beyond SLA', value: rows.reduce((a, r) => a + r.breaches, 0), money: false, icon: 'Siren', color: '#e0364f', formula: kf('B4').formula, onClick: () => drill({ sla: 'breach' }) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-5" title={co ? 'Savings per buyer' : 'Pipeline value per buyer'} icon="ChartBarBig" actions={<Legend items={bars.map((b) => ({ label: b.label, color: b.color }))} />}>
          <ChartBox height={Math.max(240, rows.length * 44)}>
            <BarChart data={rows.map((r) => ({ ...r, short: r.name.split(' ')[0] }))} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={1}>
              <CartesianGrid horizontal={false} stroke="#eceef6" />
              <XAxis type="number" {...AX} tickFormatter={moneyTick} />
              <YAxis type="category" dataKey="short" {...AX} width={64} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number) => inrShort(v)} title={(_l: string, p: any[]) => p?.[0]?.payload?.name} />} />
              {bars.map((b) => <Bar key={b.k} dataKey={b.k} name={b.label} fill={b.color} radius={[0, 4, 4, 0]} barSize={co ? 9 : 12} cursor="pointer" onClick={(x: any) => drill({ buyer: x.id })} />)}
            </BarChart>
          </ChartBox>
        </Card>
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          {rows.map((r) => (
            <div key={r.id} className="card p-3 hover:shadow-md transition cursor-pointer" onClick={() => drill({ buyer: r.id })}>
              <div className="flex items-center gap-2.5">
                <Avatar name={r.name} color={r.color} size={32} />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink truncate">{r.name}</div><div className="text-[11px] text-muted truncate">{r.commodities.map((c) => commodityName(ctx, c)).join(' · ')}</div></div>
                <span className="text-[15px] font-bold num" style={{ color: co ? '#0b7a55' : '#1e3a5f' }}>{co ? inrShort(r.realised) : inrShort(r.pipeline)}</span>
              </div>
              <div className="mt-2 relative h-2 rounded-full bg-slate-100 overflow-hidden flex">
                {bars.map((b) => <div key={b.k} style={{ width: `${((r as any)[b.k] / maxBar) * 100}%`, background: b.color }} />)}
              </div>
              <div className="grid grid-cols-4 gap-1 mt-2 text-center">
                {tiles(r).map(([k, v, c, fn]) => (
                  <button key={k} onClick={(e) => { if (fn) { e.stopPropagation(); fn() } }} className="rounded-md bg-slate-50 py-1 hover:bg-slate-100">
                    <div className="text-[9.5px] font-bold uppercase tracking-wide text-muted">{k}</div>
                    <div className="text-[11.5px] font-bold num truncate" style={{ color: c }}>{v}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Card title="Buyer scorecard" icon="Table2" subtitle={co ? 'Realised and committed ₹, on-time %, overdue ₹ and realisation rate per buyer' : 'Ideas, pipeline value, conversion, ageing and SLA breaches per buyer'}>
        <DataTable rows={rows} rowKey={(r) => r.id} columns={cols} exportName={`COIN_Buyer_scorecard_${space}`} onRowClick={(r) => drill({ buyer: r.id })} />
      </Card>
      {list.el}
    </div>
  )
}

// ═══ 5. Supplier innovation scorecard ═════════════════════════════════════════
export function SupplierReport({ ctx }: { ctx: Ctx }) {
  const rows = useMemo(() => supplierRows(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const top = rows.slice(0, 12)
  // no supplier step in the workflow — show how far each supplier's ideas get instead
  const conv = [...rows].filter((r) => r.ideas > 0).sort((a, b) => b.implemented - a.implemented || b.ideas - a.ideas).slice(0, 8)
  const own = rows.reduce((a, r) => a + r.supplierSubmitted, 0)
  const gs = rows.filter((r) => !isNaN(r.gainShare))
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'name', label: 'Supplier', value: (r) => r.name, render: (r) => <span><span className="font-semibold text-ink">{r.name}</span> <span className="font-mono text-[11px] text-muted">{r.code}</span></span> },
    { key: 'commodities', label: 'Commodities', value: (r) => r.commodities.join(', ') },
    { key: 'ideas', label: 'Ideas', align: 'right', value: (r) => r.ideas },
    { key: 'own', label: 'Supplier-submitted', align: 'right', value: (r) => r.supplierSubmitted },
    { key: 'value', label: 'Value (annualised)', align: 'right', value: (r) => r.value, render: (r) => <span className="num font-semibold">{inrShort(r.value)}</span> },
    { key: 'implemented', label: 'Implemented', align: 'right', value: (r) => r.implemented },
    { key: 'conversion', label: 'Conversion', align: 'right', value: (r) => r.conversion, render: (r) => <span className="num">{pct(r.conversion, 0)}</span> },
    { key: 'gainShare', label: 'Gain-share %', align: 'right', value: (r) => r.gainShare, render: (r) => <span className="num">{isNaN(r.gainShare) ? '—' : pct(r.gainShare, 0)}</span> },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Suppliers with ideas', value: rows.filter((r) => r.ideas > 0).length, money: false, icon: 'Factory', color: '#0d9488' },
        { label: 'Supplier-submitted ideas', value: own, money: false, icon: 'Lightbulb', color: '#7c3aed', onClick: () => list.show('Supplier-submitted ideas', ctx.ideas.filter((i) => i.isSupplierSubmission)), tip: 'Ideas submitted by suppliers through the Supplier Workspace' },
        { label: 'Idea value', value: rows.reduce((a, r) => a + r.value, 0), icon: 'BadgeIndianRupee', color: '#3b74f2', tip: 'Σ annualised impact of ideas linked to each supplier' },
        { label: 'Avg gain-share offered', value: gs.length ? gs.reduce((a, r) => a + r.gainShare, 0) / gs.length : 0, money: false, suffix: '%', digits: 1, icon: 'Handshake', color: '#ec8a1c', tip: 'Gain-share % offered to Amber on supplier submissions (captured as a field only)' },
        { label: 'Supplier participation', value: rows.filter((r) => r.supplierSubmitted > 0).length, money: false, icon: 'Users', color: '#0d9488', tip: 'Suppliers who submitted at least one idea through the Supplier Workspace', sub: 'submitted ≥ 1 idea' },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-8" title="Idea value by supplier" icon="ChartColumn" subtitle="Top 12 by annualised value · bar colour = conversion" actions={<Legend items={[{ label: '≥ 40% conversion', color: '#0f9f6e' }, { label: '20–40%', color: '#0d9488' }, { label: '< 20%', color: '#94a3b8' }]} />}>
          <ChartBox height={290}>
            <BarChart data={top} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="code" {...AX} interval={0} />
              <YAxis {...AX} tickFormatter={moneyTick} width={58} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number, p: any) => (p.dataKey === 'value' ? inrShort(v) : v)} title={(_l: string, p: any[]) => p?.[0]?.payload?.name} />} />
              <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ supplier: x.code })}>
                {top.map((r) => <Cell key={r.code} fill={r.conversion >= 40 ? '#0f9f6e' : r.conversion >= 20 ? '#0d9488' : '#94a3b8'} />)}
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-4" title="Idea conversion" icon="CircleCheckBig" subtitle="Ideas implemented of all ideas per supplier">
          {conv.length ? (
            <div className="space-y-1.5">
              {conv.map((r) => <MeterRow key={r.code} label={`${r.name}`} sub={`${r.ideas} idea${r.ideas === 1 ? '' : 's'} · ${pct(r.conversion, 0)} implemented`} value={r.implemented} max={Math.max(1, r.ideas)} color="#0d9488" display={`${r.implemented}/${r.ideas}`} onClick={() => drill({ supplier: r.code })} />)}
            </div>
          ) : <SectionNote icon="Info">No supplier ideas in the active scope.</SectionNote>}
        </Card>
      </div>
      <Card title="Supplier innovation scorecard" icon="Table2" subtitle="Ideas, value, conversion and gain-share per supplier">
        <DataTable rows={rows} rowKey={(r) => r.code} columns={cols} exportName="COIN_Supplier_scorecard" onRowClick={(r) => drill({ supplier: r.code })} />
      </Card>
      {list.el}
    </div>
  )
}

// ═══ 6. Category mix ═════════════════════════════════════════════════════════════
export function LeverReport({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => leverData(ctx), [ctx])
  const comm = useMemo(() => commodityRows(ctx).filter((r) => r.realisedAll > 0).sort((a, b) => b.structuralPct - a.structuralPct), [ctx])
  const drill = useDrill()
  const bars = d.rows.filter((r) => r.realised > 0)
  const cols: Column<(typeof d.rows)[number]>[] = [
    { key: 'name', label: 'Category', value: (r) => r.name, render: (r) => <LeverChip leverId={r.id} /> },
    { key: 'group', label: 'Category group', value: (r) => r.group },
    { key: 'route', label: 'Route', value: (r) => ctx.levers.find((l) => l.id === r.id)?.route },
    { key: 'count', label: 'Ideas', align: 'right', value: (r) => r.count },
    { key: 'implemented', label: 'Implemented', align: 'right', value: (r) => r.implemented },
    { key: 'realised', label: 'Realised', align: 'right', value: (r) => r.realised, render: (r) => <span className="num font-semibold text-emerald-700">{inrShort(r.realised)}</span> },
    { key: 'share', label: 'Share of realised', align: 'right', value: (r) => r.share, render: (r) => <span className="num font-semibold">{pct(r.share)}</span> },
    { key: 'pipeline', label: 'Pipeline', align: 'right', value: (r) => r.pipeline, render: (r) => <span className="num text-blue-700">{inrShort(r.pipeline)}</span> },
    { key: 'structural', label: 'Structural', value: (r) => (r.structural ? 'Yes' : 'No'), render: (r) => (r.structural ? <Badge color="#4f46e5" icon="Cog">Structural</Badge> : <span className="text-muted">—</span>) },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Realised (all categories)', value: d.total, icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula },
        { label: 'Negotiated share', value: d.negotiated, money: false, suffix: '%', digits: 1, icon: 'Handshake', color: d.flag ? '#e0364f' : '#7c3aed', formula: kf('E1').formula, sub: `Negotiation category alone ${pct(d.negotiationLever)}`, onClick: () => drill({ group: 'Commercial' }) },
        { label: 'Structural savings share', value: d.structuralShare, money: false, suffix: '%', digits: 1, icon: 'Cog', color: '#4f46e5', formula: kf('E2').formula, sub: inrShort(d.structuralTotal) },
        { label: 'Categories contributing', value: bars.length, money: false, icon: 'Layers', color: '#1e3a5f', sub: `of ${ctx.levers.filter((l) => l.active).length} active categories` },
      ]} />
      {d.flag
        ? <SectionNote icon="TriangleAlert" tone="red"><b>Heavy dependence on negotiation:</b> commercial / negotiated categories deliver {pct(d.negotiated)} of realised saving (flag above {NEGOTIATION_FLAG_PCT}%). Negotiated savings rarely repeat next year — push VA/VE, material and localisation ideas.</SectionNote>
        : <SectionNote icon="CircleCheck" tone="green">Commercial / negotiated categories deliver {pct(d.negotiated)} of realised saving — within the {NEGOTIATION_FLAG_PCT}% flag threshold.</SectionNote>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7" title="Realised savings by category" icon="ChartBarBig" subtitle="Bar colour = category group">
          <ChartBox height={Math.max(260, bars.length * 26)}>
            <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#eceef6" />
              <XAxis type="number" {...AX} tickFormatter={moneyTick} />
              <YAxis type="category" dataKey="name" {...AX} width={190} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number, p: any) => `${inrShort(v)} · ${pct(p.payload.share)}`} />} />
              <Bar dataKey="realised" name="Realised" radius={[0, 4, 4, 0]} barSize={14} cursor="pointer" onClick={(x: any) => drill({ lever: x.id })}>
                {bars.map((r) => <Cell key={r.id} fill={LEVER_GROUP_STYLE[r.group as LeverGroup]?.color ?? '#64748b'} />)}
                <LabelList dataKey="share" position="right" formatter={(v: number) => pct(v)} style={{ fontSize: 10.5, fill: '#475569', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-5" title="Share by category group" icon="PieChart">
          <div className="flex items-center gap-3">
            <div className="w-[190px] h-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.groups} dataKey="realised" nameKey="group" innerRadius={52} outerRadius={86} paddingAngle={2} stroke="none" cursor="pointer" onClick={(x: any) => drill({ group: x.group ?? x.payload?.group })}>
                    {d.groups.map((g) => <Cell key={g.group} fill={LEVER_GROUP_STYLE[g.group as LeverGroup]?.color ?? '#64748b'} />)}
                  </Pie>
                  <Tooltip content={<ChartTip fmt={(v: number) => inrShort(v)} title={(_l: string, p: any[]) => p?.[0]?.name} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {d.groups.map((g) => {
                const st = LEVER_GROUP_STYLE[g.group as LeverGroup]
                return (
                  <button key={g.group} onClick={() => drill({ group: g.group })} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 text-left">
                    <span className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ background: st?.soft, color: st?.color }}><Icon name={st?.icon ?? 'Circle'} size={13} /></span>
                    <span className="flex-1 min-w-0 text-[12.5px] font-medium text-ink truncate">{g.group}</span>
                    <span className="text-[12px] num text-muted">{inrShort(g.realised)}</span>
                    <span className="w-12 text-right text-[12.5px] font-bold num" style={{ color: st?.text }}>{pct(g.share, 0)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7" title="Structural share trend" icon="TrendingUp" subtitle="(VA/VE + material + localisation) ÷ total realised, month by month" actions={<Legend items={[{ label: 'Structural', color: '#4f46e5' }, { label: 'Other categories', color: '#cbd5e1' }, { label: 'Cumulative share', color: '#bf8f3f' }]} />}>
          <ChartBox height={250}>
            <ComposedChart data={d.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} />
              <YAxis yAxisId="v" {...AX} tickFormatter={moneyTick} width={58} />
              <YAxis yAxisId="p" orientation="right" {...AX} tickFormatter={pctTick} domain={[0, 100]} width={40} />
              <Tooltip cursor={CURSOR} content={<ChartTip hint="" fmt={(v: number, p: any) => (p.dataKey === 'share' || p.dataKey === 'cumShare' ? pct(v) : inrShort(v))} />} />
              <Bar yAxisId="v" dataKey="structural" name="Structural" stackId="s" fill="#4f46e5" />
              <Bar yAxisId="v" dataKey="other" name="Other categories" stackId="s" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" dataKey="share" name="Month share" stroke="#4f46e5" strokeDasharray="4 3" dot={{ r: 2.5 }} />
              <Line yAxisId="p" dataKey="cumShare" name="Cumulative share" stroke="#bf8f3f" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ChartBox>
          <SectionNote icon="Lightbulb" tone="blue">{STRUCTURAL_NOTE}</SectionNote>
        </Card>
        <Card className="lg:col-span-5" title="Structural share by commodity" icon="Cog" subtitle="E2 cut by commodity">
          <div className="space-y-1.5">
            {comm.map((r) => <MeterRow key={r.code} label={r.name} value={r.structuralPct} max={100} color="#4f46e5" display={pct(r.structuralPct)} sub={`Realised ${inrShort(r.realisedAll)}`} onClick={() => drill({ commodity: r.code, group: 'Engineering' })} />)}
            {!comm.length && <SectionNote>No realised saving in the active scope yet.</SectionNote>}
          </div>
        </Card>
      </div>
      <Card title="Category mix" icon="Table2" subtitle="All categories roll up to Total Productivity">
        <DataTable rows={d.rows} rowKey={(r) => r.id} columns={cols} exportName="COIN_Category_mix" onRowClick={(r) => drill({ lever: r.id })} />
      </Card>
    </div>
  )
}

