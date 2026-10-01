// Reports 7–12 (Section 11): Execution Hub dashboard, Drop analysis, Ageing & SLA breach, Campaign effectiveness, Realisation & leakage, FY closure & carry-over
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, ComposedChart, Line } from 'recharts'
import { Card, DataTable, Badge, HealthBadge, UserChip, Avatar, Icon, ProgressBar, SlaPill, InfoTip, Button, cn, type Column } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { ideaAnnualised, HEALTH_STYLE } from '../../lib/calc'
import { KPIS, LEAKAGE_NOTE, REALISATION_CYCLE } from '../../lib/scope'
import { inrShort, inrPrice, pct, monthLabel, fmtDate, num, fyStart, fyEnd, parse, daysBetween, clamp, QUARTER_MONTHS, monthLong } from '../../lib/format'
import type { Health, Idea } from '../../lib/types'
import {
  type Ctx, executionData, dropData, ageingData, campaignRows, leakageData, closureData, commodityName, nameOf, supplierName, SLA_STATES, SLA_STATE_STYLE,
} from './model'
import { AX, GRID, ChartTip, moneyTick, pctTick, useDrill, useIdeaList, Legend, MeterRow, SectionNote, CURSOR, PALETTE } from './chartkit'
import { KpiStrip, ideaColumns } from './views1'

const kf = (id: string) => KPIS.find((k) => k.id === id)!
const rateTone = (p: number) => (p >= 100 ? '#0f9f6e' : p >= 80 ? '#ec8a1c' : '#e0364f')
function ChartBox({ height = 260, children }: { height?: number; children: React.ReactElement }) {
  return <div style={{ height }} className="w-full min-w-0"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
}

// ═══ 7. Execution Hub dashboard ═══════════════════════════════════════════════
export function ExecutionReport({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => executionData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const openIdea = useStore((s) => s.openIdea)
  const s0 = +parse(fyStart(ctx.fy)), s1 = +parse(fyEnd(ctx.fy))
  const pos = (iso: string) => clamp(((+parse(iso.slice(0, 10)) - s0) / (s1 - s0)) * 100, 0, 100)
  const todayPos = pos(ctx.today)
  const rows = [...d.inExec].sort((a, b) => a.idea.execution!.targetDate.localeCompare(b.idea.execution!.targetDate))
  const dueOver = [...d.overdue, ...d.due]
  const cols: Column<(typeof dueOver)[number]>[] = [
    { key: 'id', label: 'Idea ID', value: (x) => x.idea.id, render: (x) => <span className="font-mono text-[11.5px] font-semibold text-brand-700">{x.idea.id}</span> },
    { key: 'title', label: 'Title', value: (x) => x.idea.title, render: (x) => <span className="block max-w-[300px] truncate font-medium">{x.idea.title}</span> },
    { key: 'owner', label: 'Owner', value: (x) => nameOf(ctx, x.idea.execution!.ownerId), render: (x) => <UserChip userId={x.idea.execution!.ownerId} size={20} /> },
    { key: 'due', label: 'Due date', value: (x) => x.idea.execution!.targetDate, render: (x) => fmtDate(x.idea.execution!.targetDate) },
    { key: 'days', label: 'Days', align: 'right', value: (x) => daysBetween(ctx.today, x.idea.execution!.targetDate), render: (x) => { const n = daysBetween(ctx.today, x.idea.execution!.targetDate); return <span className="num font-semibold" style={{ color: n < 0 ? '#e0364f' : '#ec8a1c' }}>{n < 0 ? `${-n} d overdue` : `${n} d left`}</span> } },
    { key: 'health', label: 'Health', value: (x) => x.health, render: (x) => <HealthBadge health={x.health} /> },
    { key: 'progress', label: 'Progress', value: (x) => x.idea.execution!.progress, render: (x) => <div className="w-24 flex items-center gap-2"><ProgressBar value={x.idea.execution!.progress} color="#ec8a1c" /><span className="text-[11px] num">{x.idea.execution!.progress}%</span></div> },
    { key: 'committed', label: 'Committed', align: 'right', value: (x) => x.committed, render: (x) => <span className="num font-semibold">{inrShort(x.committed)}</span> },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'In execution', value: d.inExec.length, money: false, icon: 'Rocket', color: '#ec8a1c', sub: `${inrShort(d.committed)} committed`, onClick: () => drill({ bucket: 'In Execution' }) },
        { label: 'Due this month', value: d.due.length, money: false, icon: 'CalendarClock', color: '#3b74f2', sub: inrShort(d.due.reduce((a, x) => a + x.committed, 0)), onClick: () => list.show(`Due in ${monthLong(d.ym)}`, d.due.map((x) => x.idea)) },
        { label: 'Overdue', value: d.overdue.length, money: false, icon: 'Clock3', color: '#e0364f', sub: inrShort(d.overdue.reduce((a, x) => a + x.committed, 0)), formula: kf('D2').formula, onClick: () => drill({ health: 'Delayed' }) },
        { label: 'At risk', value: d.atRisk.length, money: false, icon: 'TriangleAlert', color: '#ec8a1c', sub: 'milestone overdue', onClick: () => drill({ health: 'At risk' }) },
        { label: 'Done this month', value: d.doneMonth.length, money: false, icon: 'CircleCheck', color: '#0f9f6e', sub: inrShort(d.doneMonth.reduce((a, i) => a + ideaAnnualised(i), 0)), onClick: () => list.show(`Implemented in ${monthLong(d.ym)}`, d.doneMonth) },
        { label: 'Dropped this month', value: d.droppedMonth.length, money: false, icon: 'CircleX', color: '#6b7280', sub: inrShort(d.droppedMonth.reduce((a, i) => a + ideaAnnualised(i), 0)), onClick: () => list.show(`Dropped in ${monthLong(d.ym)}`, d.droppedMonth) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-3" title="Health" icon="HeartPulse" subtitle="On track / At risk (milestone overdue) / Delayed (due date passed)">
          <div className="space-y-2">
            {d.health.map((h) => {
              const st = HEALTH_STYLE[h.health]
              const v = h.items.reduce((a, x) => a + x.committed, 0)
              return (
                <button key={h.health} onClick={() => drill({ health: h.health })} className="w-full text-left rounded-xl border px-3 py-2.5 hover:shadow-sm transition" style={{ background: st.soft, borderColor: `${st.color}33` }}>
                  <div className="flex items-center justify-between"><HealthBadge health={h.health} /><span className="text-[20px] font-bold num text-ink">{h.items.length}</span></div>
                  <div className="flex items-center justify-between mt-1 text-[11.5px]"><span className="text-muted">Committed</span><span className="num font-semibold" style={{ color: st.color }}>{inrShort(v)}</span></div>
                  <div className="mt-1.5"><ProgressBar value={(h.items.length / Math.max(1, d.inExec.length)) * 100} color={st.color} height={4} /></div>
                </button>
              )
            })}
          </div>
        </Card>
        <Card className="lg:col-span-9" title="Execution timeline" icon="GanttChart" subtitle={`Each idea as a bar from start to due date · milestones as dots · ${ctx.fy}`} actions={<Legend items={[{ label: 'On track', color: '#0f9f6e' }, { label: 'At risk', color: '#ec8a1c' }, { label: 'Delayed', color: '#e0364f' }, { label: 'Today', color: '#2459e0', dashed: true }]} />}>
          <div className="flex text-[10.5px] font-bold uppercase tracking-wide text-muted pl-[232px] mb-1">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => <div key={q} className="flex-1 border-l border-slate-200 pl-1.5">{q} · {QUARTER_MONTHS[q]}</div>)}
          </div>
          <div className="">
            {rows.map((x) => {
              const ex = x.idea.execution!
              const a = pos(ex.startDate), b = pos(ex.targetDate)
              const c = HEALTH_STYLE[x.health].color
              return (
                <button key={x.idea.id} onClick={() => openIdea(x.idea.id)} className="w-full flex items-center h-8 group hover:bg-slate-50 rounded-md">
                  <div className="w-[232px] shrink-0 flex items-center gap-2 pr-2 min-w-0">
                    <Avatar name={nameOf(ctx, ex.ownerId)} color={ctx.users.find((u) => u.id === ex.ownerId)?.avatarColor} size={20} />
                    <div className="min-w-0 text-left leading-tight"><div className="font-mono text-[10.5px] text-brand-700 font-semibold">{x.idea.id}</div><div className="text-[11.5px] text-ink truncate">{x.idea.title}</div></div>
                  </div>
                  <div className="relative flex-1 h-full">
                    {[25, 50, 75].map((p) => <div key={p} className="absolute top-0 bottom-0 border-l border-dashed border-slate-100" style={{ left: `${p}%` }} />)}
                    <div className="absolute top-1/2 -translate-y-1/2 h-[10px] rounded-full opacity-90 group-hover:opacity-100" style={{ left: `${a}%`, width: `${Math.max(0.8, b - a)}%`, background: `linear-gradient(90deg, ${c}55, ${c})` }} />
                    {ex.originalTargetDate !== ex.targetDate && <div title={`Original due date ${fmtDate(ex.originalTargetDate)}`} className="absolute top-1/2 -translate-y-1/2 h-3.5 w-[2px] bg-slate-500" style={{ left: `${pos(ex.originalTargetDate)}%` }} />}
                    {ex.milestones.map((m) => {
                      const late = !m.doneDate && m.dueDate < ctx.today
                      return <span key={m.id} title={`${m.name} · due ${fmtDate(m.dueDate)}${m.doneDate ? ' · done ' + fmtDate(m.doneDate) : ''}`} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2" style={{ left: `${pos(m.dueDate)}%`, background: m.doneDate ? '#0f9f6e' : late ? '#e0364f' : '#fff', borderColor: m.doneDate ? '#0f9f6e' : late ? '#e0364f' : '#94a3b8' }} />
                    })}
                    <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-brand-600/60" style={{ left: `${todayPos}%` }} />
                  </div>
                </button>
              )
            })}
            {!rows.length && <SectionNote>No ideas in execution for the active filters.</SectionNote>}
          </div>
        </Card>
      </div>
      <Card title="Due & overdue" icon="AlarmClock" subtitle="Overdue first, then due this month">
        <DataTable rows={dueOver} rowKey={(x) => x.idea.id} columns={cols} exportName="COIN_Due_overdue" onRowClick={(x) => openIdea(x.idea.id)} maxHeight={420} />
      </Card>
      {list.el}
    </div>
  )
}

// ═══ 8. Drop analysis ═════════════════════════════════════════════════════════
export function DropsReport({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => dropData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const openIdea = useStore((s) => s.openIdea)
  const color = (r: string) => PALETTE[d.reasons.indexOf(r) % PALETTE.length]
  const monthDrops = (m: string) => d.dropped.filter((i) => (i.droppedAt ?? '').slice(0, 7) === m)
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Dropped ideas', value: d.dropped.length, money: false, icon: 'CircleX', color: '#6b7280', onClick: () => drill({ bucket: 'Dropped' }) },
        { label: 'Drop rate', value: d.rate, money: false, suffix: '%', digits: 1, icon: 'Percent', color: '#e0364f', formula: kf('B3').formula, sub: `${d.dropped.length} of ${ctx.ideas.length} submitted` },
        { label: 'Value dropped', value: d.value, icon: 'BadgeIndianRupee', color: '#6b7280', tip: 'Σ annualised impact of dropped ideas; the committed value is removed from committed savings' },
        { label: 'Top reason', value: d.byReason[0]?.count ?? 0, money: false, icon: 'ListOrdered', color: '#2459e0', sub: d.byReason[0]?.reason ?? '—', onClick: () => d.byReason[0] && drill({ bucket: 'Dropped', dropReason: d.byReason[0].reason }) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-8" title="Month-wise drops by reason" icon="ChartColumnStacked" subtitle={`Counted in the month of the drop · ${ctx.fy}`}>
          <ChartBox height={290}>
            <BarChart data={d.months} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} />
              <YAxis {...AX} allowDecimals={false} />
              <Tooltip cursor={CURSOR} content={<ChartTip title={(_l: string, p: any[]) => monthLabel(p?.[0]?.payload?.month ?? '')} hide={d.reasons.filter(() => false)} />} />
              {d.reasons.map((r, k) => (
                <Bar key={r} dataKey={r} name={r} stackId="d" fill={color(r)} radius={k === d.reasons.length - 1 ? [4, 4, 0, 0] : undefined} cursor="pointer" onClick={(x: any) => list.show(`Drops in ${monthLabel(x.month)}`, monthDrops(x.month))} />
              ))}
            </BarChart>
          </ChartBox>
          <Legend className="mt-1" items={d.reasons.map((r) => ({ label: r, color: color(r) }))} />
        </Card>
        <Card className="lg:col-span-4" title="Top reasons" icon="ListOrdered" subtitle="Click a reason for its ideas">
          <div className="space-y-1.5">
            {d.byReason.map((r) => <MeterRow key={r.reason} label={r.reason} value={r.count} max={d.byReason[0].count} color={color(r.reason)} display={`${r.count} · ${pct((r.count / Math.max(1, d.dropped.length)) * 100, 0)}`} sub={inrShort(r.value)} onClick={() => drill({ bucket: 'Dropped', dropReason: r.reason })} />)}
            {!d.byReason.length && <SectionNote icon="CircleCheck" tone="green">No drops in the active scope.</SectionNote>}
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-12" title="Drops by stage" icon="Milestone" subtitle="Stage at which the idea was dropped">
          <ChartBox height={Math.max(200, d.stages.length * 30)}>
            <BarChart data={d.stages} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="stage" {...AX} width={170} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number, p: any) => `${v} · ${inrShort(p.payload.value)}`} />} />
              <Bar dataKey="count" name="Drops" fill="#6b7280" radius={[0, 4, 4, 0]} barSize={14} cursor="pointer" onClick={(x: any) => list.show(`Dropped at ${x.stage}`, x.ideas, '/ideas?bucket=Dropped')}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} />
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-12" title="Dropped ideas" icon="Table2" subtitle="Mandatory reason and remarks">
          <DataTable rows={d.dropped} rowKey={(i) => i.id} exportName="COIN_Drop_analysis" onRowClick={(i) => openIdea(i.id)} maxHeight={360}
            columns={[
              { key: 'id', label: 'Idea ID', render: (i: Idea) => <span className="font-mono text-[11.5px] font-semibold text-brand-700">{i.id}</span> },
              { key: 'title', label: 'Title', render: (i: Idea) => <span className="block max-w-[260px] truncate">{i.title}</span> },
              { key: 'reason', label: 'Reason', value: (i: Idea) => i.dropReason, render: (i: Idea) => <Badge color={color(i.dropReason ?? '')}>{i.dropReason}</Badge> },
              { key: 'dropStage', label: 'Stage', value: (i: Idea) => i.dropStage },
              { key: 'droppedAt', label: 'Dropped on', value: (i: Idea) => i.droppedAt, render: (i: Idea) => fmtDate(i.droppedAt?.slice(0, 10)) },
              { key: 'value', label: 'Value', align: 'right', value: (i: Idea) => ideaAnnualised(i), render: (i: Idea) => <span className="num">{inrShort(ideaAnnualised(i))}</span> },
              { key: 'remarks', label: 'Remarks', value: (i: Idea) => i.dropRemarks, render: (i: Idea) => <span className="block max-w-[260px] truncate text-muted" title={i.dropRemarks}>{i.dropRemarks}</span> },
            ]} />
        </Card>
      </div>
      {list.el}
    </div>
  )
}

// ═══ 9. Ageing & SLA breach ═══════════════════════════════════════════════════
export function AgeingReport({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => ageingData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const openIdea = useStore((s) => s.openIdea)
  const cnt = (s: string) => d.rows.filter((r) => r.sla.state === s).length
  const cols: Column<(typeof d.breached)[number]>[] = [
    { key: 'id', label: 'Idea ID', value: (r) => r.idea.id, render: (r) => <span className="font-mono text-[11.5px] font-semibold text-brand-700">{r.idea.id}</span> },
    { key: 'title', label: 'Title', value: (r) => r.idea.title, render: (r) => <span className="block max-w-[260px] truncate">{r.idea.title}</span> },
    { key: 'stage', label: 'Stage', value: (r) => r.idea.stage },
    { key: 'owner', label: 'Owner', value: (r) => r.owner.label },
    { key: 'wd', label: 'Working days', align: 'right', value: (r) => r.sla.working },
    { key: 'sla', label: 'SLA', align: 'right', value: (r) => r.sla.sla, render: (r) => `${r.sla.sla} d` },
    { key: 'state', label: 'Status', value: (r) => r.sla.state, render: (r) => <SlaPill state={r.sla.state} left={r.sla.left} working={r.sla.working} /> },
    { key: 'esc', label: 'Escalated to', value: (r) => (r.sla.state === 'escalated' ? r.sla.rule?.escalateTo : ''), render: (r) => (r.sla.state === 'escalated' ? <span className="text-red-700 font-medium">{r.sla.rule?.escalateTo}</span> : <span className="text-muted">Day {r.sla.rule?.escalateDay}</span>) },
    { key: 'value', label: 'Value', align: 'right', value: (r) => ideaAnnualised(r.idea), render: (r) => <span className="num">{inrShort(ideaAnnualised(r.idea))}</span> },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Open ideas with an SLA', value: d.rows.length, money: false, icon: 'Timer', color: '#3b74f2' },
        { label: 'Within SLA', value: cnt('ok'), money: false, icon: 'CircleCheck', color: '#0f9f6e' },
        { label: 'Reminder due', value: cnt('due'), money: false, icon: 'AlarmClock', color: '#ec8a1c' },
        { label: 'Beyond SLA', value: cnt('breach') + cnt('escalated'), money: false, icon: 'Siren', color: '#e0364f', formula: kf('B4').formula, onClick: () => drill({ sla: 'breach' }) },
        { label: 'Escalated', value: cnt('escalated'), money: false, icon: 'ShieldAlert', color: '#a3143a' },
        { label: 'Avg days in stage', value: isNaN(d.avgAge) ? 0 : d.avgAge, money: false, digits: 1, suffix: ' d', icon: 'Hourglass', color: '#1e3a5f', formula: 'Days in current stage (calendar)' },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7" title="SLA status by stage" icon="ChartColumnStacked" subtitle="Working days in stage vs stage SLA (Section 12)" actions={<Legend items={SLA_STATES.map((s) => ({ label: SLA_STATE_STYLE[s].label, color: SLA_STATE_STYLE[s].color }))} />}>
          <ChartBox height={270}>
            <BarChart data={d.byStage} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="stage" {...AX} interval={0} />
              <YAxis {...AX} allowDecimals={false} />
              <Tooltip cursor={CURSOR} content={<ChartTip />} />
              {SLA_STATES.map((s, k) => (
                <Bar key={s} dataKey={s} name={SLA_STATE_STYLE[s].label} stackId="a" fill={SLA_STATE_STYLE[s].color} radius={k === SLA_STATES.length - 1 ? [4, 4, 0, 0] : undefined} cursor="pointer"
                  onClick={(x: any) => list.show(`${x.stage} · ${SLA_STATE_STYLE[s].label}`, x.list.filter((r: any) => r.sla.state === s).map((r: any) => r.idea), s === 'breach' || s === 'escalated' ? '/ideas?sla=breach' : undefined)} />
              ))}
            </BarChart>
          </ChartBox>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-2 mt-2">
            {ctx.slaRules.map((r) => (
              <div key={r.stage} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                <div className="text-[11px] font-semibold text-ink truncate">{r.stage}</div>
                <div className="text-[10.5px] text-muted leading-4">SLA {r.slaDays} d · reminder day {r.reminderDay}<br />escalate day {r.escalateDay} → {r.escalateTo}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-5" title="Beyond SLA by owner" icon="UserRoundX" subtitle="Who holds the idea in its current stage">
          <div className="space-y-1.5">
            {d.byOwner.map((o) => <MeterRow key={o.key} label={o.label} value={o.breach} max={Math.max(1, d.byOwner[0]?.breach ?? 1)} color="#e0364f" display={`${o.breach} / ${o.list.length}`} sub={`${o.escalated} escalated · avg ${isNaN(o.avgAge) ? '—' : num(o.avgAge, 0)} days in stage`} onClick={() => list.show(`${o.label} · ideas in stage`, o.list.map((r) => r.idea))} />)}
            {!d.byOwner.length && <SectionNote icon="CircleCheck" tone="green">No open ideas with an SLA in the active scope.</SectionNote>}
          </div>
        </Card>
      </div>
      <Card title="Ideas beyond SLA" icon="Siren" subtitle="Sorted by days over SLA">
        <DataTable rows={d.breached} rowKey={(r) => r.idea.id} columns={cols} exportName="COIN_SLA_breach" onRowClick={(r) => openIdea(r.idea.id)} />
      </Card>
      {list.el}
    </div>
  )
}

// Finance validation SLA on realised savings: a CO concern, shown in Realisation & leakage
function FinanceSlaCard({ ctx, className }: { ctx: Ctx; className?: string }) {
  const d = useMemo(() => ageingData(ctx), [ctx])
  const openIdea = useStore((s) => s.openIdea)
  const finBreach = d.fin.filter((f) => f.breach)
  return (
    <Card className={className} title="Finance validation SLA" icon="ShieldCheck" subtitle={d.finRule ? `SLA ${d.finRule.slaDays} working days · escalate to ${d.finRule.escalateTo}` : 'No rule'}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-[10.5px] font-bold uppercase text-muted">Pending</div><div className="text-[20px] font-bold num">{d.fin.length}</div><div className="text-[11px] text-muted">idea-months</div></div>
        <div className="rounded-lg bg-red-50 p-2.5"><div className="text-[10.5px] font-bold uppercase text-red-700">Breached</div><div className="text-[20px] font-bold num text-red-700">{finBreach.length}</div><div className="text-[11px] text-red-700/80">{inrShort(finBreach.reduce((a, f) => a + f.value, 0))}</div></div>
      </div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        {d.fin.slice(0, 12).map((f) => (
          <button key={`${f.ideaId}${f.month}`} onClick={() => openIdea(f.ideaId)} className="w-full flex items-center justify-between gap-2 text-[11.5px] py-1 px-1 rounded hover:bg-slate-50">
            <span className="font-mono text-brand-700 truncate">{f.ideaId}</span>
            <span className="text-muted">{monthLabel(f.month)}</span>
            <span className="num font-semibold" style={{ color: f.breach ? '#e0364f' : '#0f9f6e' }}>{f.wd} wd</span>
          </button>
        ))}
      </div>
      {d.fin.length > 12 && <div className="text-[11px] text-muted mt-1">+{d.fin.length - 12} more idea-months pending validation</div>}
      {!d.fin.length && <div className="mt-2"><SectionNote icon="CircleCheck" tone="green">Nothing pending Finance validation.</SectionNote></div>}
    </Card>
  )
}

// ═══ 10. Campaign effectiveness ═══════════════════════════════════════════════
export function CampaignReport({ ctx }: { ctx: Ctx }) {
  const rows = useMemo(() => campaignRows(ctx), [ctx])
  const drill = useDrill()
  const nav = useNavigate()
  const ideas = rows.reduce((a, r) => a + r.ideas, 0), impl = rows.reduce((a, r) => a + r.implemented, 0)
  const statusColor = { Live: '#0f9f6e', Closed: '#64748b', Draft: '#ec8a1c' } as Record<string, string>
  const maxIdeas = Math.max(1, ...rows.map((r) => r.ideas)), maxValue = Math.max(1, ...rows.map((r) => r.value))
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'name', label: 'Campaign / workshop', value: (r) => r.name, render: (r) => <span className="font-semibold text-ink">{r.name}</span> },
    { key: 'type', label: 'Type', value: (r) => r.type },
    { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge color={statusColor[r.status]} dot>{r.status}</Badge> },
    { key: 'commodity', label: 'Commodity', value: (r) => commodityName(ctx, r.commodity) },
    { key: 'period', label: 'Period', value: (r) => r.startDate, render: (r) => `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}` },
    { key: 'suppliers', label: 'Suppliers invited', align: 'right', value: (r) => r.suppliers },
    { key: 'attended', label: 'Attended', align: 'right', value: (r) => r.attended },
    { key: 'ideas', label: 'Ideas', align: 'right', value: (r) => r.ideas, render: (r) => <span className="num font-semibold">{r.ideas}</span> },
    { key: 'supplierIdeas', label: 'From suppliers', align: 'right', value: (r) => r.supplierIdeas },
    { key: 'value', label: 'Value', align: 'right', value: (r) => r.value, render: (r) => <span className="num font-semibold">{inrShort(r.value)}</span> },
    { key: 'approved', label: 'Approved', align: 'right', value: (r) => r.approved },
    { key: 'conversion', label: 'Conversion', align: 'right', value: (r) => r.conversion, render: (r) => <span className="num">{pct(r.conversion, 0)}</span> },
    { key: 'realised', label: 'Realised', align: 'right', value: (r) => r.realised, render: (r) => <span className="num text-emerald-700">{inrShort(r.realised)}</span> },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Campaigns & workshops', value: rows.length, money: false, icon: 'Megaphone', color: '#db2777', sub: `${rows.filter((r) => r.status === 'Live').length} live` },
        { label: 'Ideas from campaigns', value: ideas, money: false, icon: 'Lightbulb', color: '#3b74f2', formula: kf('F2').formula },
        { label: 'Idea yield per campaign', value: rows.length ? ideas / rows.length : 0, money: false, digits: 1, icon: 'Sprout', color: '#0d9488' },
        { label: 'Campaign value', value: rows.reduce((a, r) => a + r.value, 0), icon: 'BadgeIndianRupee', color: '#7c3aed' },
        { label: 'Conversion', value: ideas ? (impl / ideas) * 100 : 0, money: false, suffix: '%', digits: 1, icon: 'Percent', color: '#0f9f6e', sub: `${impl} implemented` },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-6" title="Idea yield" icon="ChartColumn" subtitle="Ideas raised, approved and implemented per campaign" actions={<Legend items={[{ label: 'Ideas', color: '#db2777' }, { label: 'Approved', color: '#ec8a1c' }, { label: 'Implemented', color: '#0f9f6e' }]} />}>
          <ChartBox height={270}>
            <BarChart data={rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="id" {...AX} />
              <YAxis {...AX} allowDecimals={false} />
              <Tooltip cursor={CURSOR} content={<ChartTip title={(_l: string, p: any[]) => p?.[0]?.payload?.name} />} />
              <Bar dataKey="ideas" name="Ideas" fill="#db2777" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ campaign: x.id })} />
              <Bar dataKey="approved" name="Approved" fill="#ec8a1c" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ campaign: x.id })} />
              <Bar dataKey="implemented" name="Implemented" fill="#0f9f6e" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ campaign: x.id, bucket: 'Implemented' })} />
            </BarChart>
          </ChartBox>
        </Card>
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          {rows.map((r) => (
            <div key={r.id} className="card p-3 hover:shadow-md transition cursor-pointer" onClick={() => nav(`/campaigns/${r.id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="text-[12.5px] font-semibold text-ink truncate">{r.name}</div><div className="text-[11px] text-muted">{r.id} · {r.type} · {commodityName(ctx, r.commodity)}</div></div>
                <Badge color={statusColor[r.status]} dot>{r.status}</Badge>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px]"><span className="w-12 text-muted">Ideas</span><ProgressBar value={(r.ideas / maxIdeas) * 100} color="#db2777" height={5} /><span className="w-16 shrink-0 whitespace-nowrap text-right num font-semibold">{r.ideas}</span></div>
                <div className="flex items-center gap-2 text-[11px]"><span className="w-12 text-muted">Value</span><ProgressBar value={(r.value / maxValue) * 100} color="#7c3aed" height={5} /><span className="w-16 shrink-0 whitespace-nowrap text-right num font-semibold">{inrShort(r.value)}</span></div>
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
                <span>{r.attended}/{r.suppliers} suppliers attended</span>
                <span>Conversion <b className="text-ink num">{pct(r.conversion, 0)}</b></span>
                <button className="text-brand-700 font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); drill({ campaign: r.id }) }}>Ideas →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Card title="Campaign effectiveness" icon="Table2" subtitle="Yield, value and conversion per campaign / workshop">
        <DataTable rows={rows} rowKey={(r) => r.id} columns={cols} exportName="COIN_Campaign_effectiveness" onRowClick={(r) => drill({ campaign: r.id })} />
      </Card>
    </div>
  )
}

// ═══ 11. Realisation & leakage ════════════════════════════════════════════════
export function LeakageReport({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => leakageData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const monthIdeas = (m: string) => { const ids = new Set(ctx.led.filter((l) => l.month === m).map((l) => l.ideaId)); return ctx.ideas.filter((i) => ids.has(i.id)) }
  const validated = d.monthly.reduce((a, m) => a + m.validated, 0)
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: 'Committed to date', value: d.committedTD, icon: 'Rocket', color: '#ec8a1c', tip: `Planned saving of implemented ideas up to ${monthLabel(ctx.lrm)} (approved annualised ÷ 12, pro-rated in the go-live month)` },
        { label: 'Realised', value: d.realised, icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula },
        { label: 'Realisation rate', value: d.rate, money: false, suffix: '%', digits: 1, icon: 'Gauge', color: rateTone(d.rate), formula: kf('D3').formula },
        { label: 'Finance validated', value: validated, icon: 'ShieldCheck', color: '#0d9488', sub: `${pct((validated / Math.max(1, d.realised)) * 100, 0)} of realised` },
        { label: 'Price leakage', value: d.leakage, icon: 'Droplets', color: '#e0364f', formula: kf('D4').formula, sub: `${d.leakRows.length} ledger entries` },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-8" title="Committed vs realised" icon="ChartColumn" subtitle={`Month by month to the last realisation run (${monthLabel(ctx.lrm)})`} actions={<Legend items={[{ label: 'Committed', color: '#fdba74' }, { label: 'Realised', color: '#0f9f6e' }, { label: 'Leakage', color: '#e0364f' }]} />}>
          <ChartBox height={280}>
            <ComposedChart data={d.monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} />
              <YAxis yAxisId="v" {...AX} tickFormatter={moneyTick} width={58} />
              <YAxis yAxisId="l" orientation="right" {...AX} tickFormatter={moneyTick} width={56} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number) => inrShort(v)} />} />
              <Bar yAxisId="v" dataKey="committed" name="Committed" fill="#fdba74" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => list.show(`Ledger ideas · ${x.label}`, monthIdeas(x.month))} />
              <Bar yAxisId="v" dataKey="realised" name="Realised" fill="#0f9f6e" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => list.show(`Ledger ideas · ${x.label}`, monthIdeas(x.month))} />
              <Line yAxisId="l" dataKey="leakage" name="Leakage" stroke="#e0364f" strokeWidth={2} dot={{ r: 3, fill: '#e0364f' }} />
            </ComposedChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-4" title="Price leakage by supplier" icon="Droplets" subtitle="Paying above the agreed new price">
          <div className="space-y-1.5">
            {d.bySupplier.map((r) => <MeterRow key={r.code} label={r.name} value={r.leakage} max={d.bySupplier[0].leakage} color="#e0364f" display={inrShort(r.leakage)} sub={`${r.entries} entries · ${r.parts} part(s)`} onClick={() => drill({ supplier: r.code })} />)}
            {!d.bySupplier.length && <SectionNote icon="CircleCheck" tone="green">No price leakage in the active scope.</SectionNote>}
          </div>
        </Card>
      </div>
      <SectionNote icon="TriangleAlert" tone="amber">{LEAKAGE_NOTE}</SectionNote>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7" title="Realisation by commodity" icon="Boxes" subtitle="Realisation rate = realised ÷ committed for the period">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Commodity</th><th style={{ textAlign: 'right' }}>Committed {ctx.fy}</th><th style={{ textAlign: 'right' }}>Committed to date</th><th style={{ textAlign: 'right' }}>Realised</th><th style={{ width: 150 }}>Rate</th><th style={{ textAlign: 'right' }}>Leakage</th></tr></thead>
              <tbody>
                {d.byCommodity.map((r) => (
                  <tr key={r.code} className="clickable" onClick={() => drill({ commodity: r.code, bucket: 'Implemented' })}>
                    <td className="font-medium">{r.name}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrShort(r.committedFy)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrShort(r.committedTD)}</td>
                    <td className="num text-emerald-700" style={{ textAlign: 'right' }}>{inrShort(r.realised)}</td>
                    <td><div className="flex items-center gap-2"><ProgressBar value={Math.min(100, r.rate)} color={rateTone(r.rate)} height={5} /><span className="num text-[11.5px] font-semibold w-11 text-right">{r.committedTD ? pct(r.rate, 0) : '—'}</span></div></td>
                    <td className="num" style={{ textAlign: 'right', color: r.leakage > 0 ? '#e0364f' : undefined }}>{inrShort(r.leakage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="lg:col-span-5" title="Realisation-run exceptions" icon="FileWarning" subtitle="Flagged on the 3rd working day of each month">
          <div className="grid grid-cols-3 gap-2">
            {d.exceptions.map((e) => (
              <button key={e.exception} onClick={() => list.show(`Exception · ${e.exception}`, ctx.ideas.filter((i) => e.rows.some((l) => l.ideaId === i.id)))} className="rounded-xl border border-line p-2.5 text-left hover:shadow-sm hover:border-red-200 transition">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted leading-tight h-7">{e.exception}</div>
                <div className="text-[22px] font-bold num" style={{ color: e.rows.length ? '#e0364f' : '#0f9f6e' }}>{e.rows.length}</div>
                <div className="text-[10.5px] text-muted">ledger entries</div>
              </button>
            ))}
          </div>
          <div className="mt-2">
            <table className="tbl">
              <thead><tr><th>Month</th><th>Part</th><th style={{ textAlign: 'right' }}>Approved</th><th style={{ textAlign: 'right' }}>MRN price</th><th style={{ textAlign: 'right' }}>Leakage</th></tr></thead>
              <tbody>
                {d.leakRows.slice(0, 40).map((l) => (
                  <tr key={l.id} className="clickable" onClick={() => useStore.getState().openIdea(l.ideaId)}>
                    <td>{monthLabel(l.month)}</td>
                    <td className="font-mono text-[11px]" title={supplierName(ctx, l.supplierCode)}>{l.partCode}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrPrice(l.approvedPrice)}</td>
                    <td className="num text-red-600" style={{ textAlign: 'right' }}>{inrPrice(l.mrnPrice)}</td>
                    <td className="num font-semibold text-red-600" style={{ textAlign: 'right' }}>{inrShort(l.leakage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <FinanceSlaCard ctx={ctx} />
      {list.el}
    </div>
  )
}

// ═══ 12. FY closure & carry-over ══════════════════════════════════════════════
export function ClosureReport({ ctx }: { ctx: Ctx }) {
  const d = useMemo(() => closureData(ctx), [ctx])
  const drill = useDrill()
  const list = useIdeaList()
  const nav = useNavigate()
  const s = ctx.sum
  const chart = d.rows.map((r) => ({ code: r.code, name: r.name, inFy: r.committed, carry: r.carryOver }))
  const cols: Column<(typeof d.rows)[number]>[] = [
    { key: 'name', label: 'Commodity', value: (r) => r.name, render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: 'realised', label: 'Realised', align: 'right', value: (r) => r.realised, render: (r) => <span className="num text-emerald-700">{inrShort(r.realised)}</span> },
    { key: 'remaining', label: 'Committed (remaining)', align: 'right', value: (r) => r.remaining, render: (r) => <span className="num text-orange-700">{inrShort(r.remaining)}</span> },
    { key: 'committed', label: `Committed in ${ctx.fy}`, align: 'right', value: (r) => r.committed, render: (r) => <span className="num">{inrShort(r.committed)}</span> },
    { key: 'carry', label: `Carry-over to ${d.next}`, align: 'right', value: (r) => r.carryOver, render: (r) => <span className="num font-semibold text-indigo-700">{inrShort(r.carryOver)}</span> },
  ]
  return (
    <div className="grid gap-3">
      <KpiStrip items={[
        { label: ctx.fv ? 'Realised (validated)' : 'Realised', value: s.realisedCounting, icon: 'BadgeIndianRupee', color: '#0f9f6e', formula: kf('A5').formula },
        { label: `Committed in ${ctx.fy}`, value: d.inFy, icon: 'Rocket', color: '#ec8a1c', formula: kf('A4').formula },
        { label: 'Implemented ideas', value: s.counts.Implemented, money: false, icon: 'CircleCheck', color: '#0f9f6e', onClick: () => drill({ bucket: 'Implemented' }) },
        { label: `Carry-over into ${d.next}`, value: d.carry, icon: 'CalendarArrowUp', color: '#4f46e5', formula: kf('A9').formula },
        { label: `Open ideas rolling to ${d.next}`, value: d.rollIn.length, money: false, icon: 'Repeat', color: '#3b74f2', sub: 'Pipeline + due date beyond 31 March', onClick: () => list.show(`Open ideas rolling into ${d.next}`, d.rollIn) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7" title="In-FY committed vs carry-over by commodity" icon="ChartColumnStacked" subtitle={`Carry-over = annualised impact falling beyond ${fmtDate(d.fyEnd)}`} actions={<Legend items={[{ label: `Committed in ${ctx.fy}`, color: '#ec8a1c' }, { label: `Carry-over to ${d.next}`, color: '#4f46e5' }]} />}>
          <ChartBox height={290}>
            <BarChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="code" {...AX} interval={0} />
              <YAxis {...AX} tickFormatter={moneyTick} width={58} />
              <Tooltip cursor={CURSOR} content={<ChartTip fmt={(v: number) => inrShort(v)} title={(l: string) => commodityName(ctx, l)} />} />
              <Bar dataKey="inFy" name={`Committed in ${ctx.fy}`} stackId="c" fill="#ec8a1c" cursor="pointer" onClick={(x: any) => drill({ commodity: x.code })} />
              <Bar dataKey="carry" name={`Carry-over to ${d.next}`} stackId="c" fill="#4f46e5" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(x: any) => drill({ commodity: x.code })} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card className="lg:col-span-5" title="Quarter phasing" icon="CalendarRange" subtitle="FY-phased committed vs realised by quarter" actions={<Legend items={[{ label: 'Committed', color: '#fdba74' }, { label: 'Realised', color: '#0f9f6e' }]} />}>
          <ChartBox height={200}>
            <BarChart data={d.quarters.map((q) => ({ ...q, label: `${q.q} ${QUARTER_MONTHS[q.q]}` }))} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AX} />
              <YAxis {...AX} tickFormatter={moneyTick} width={58} />
              <Tooltip cursor={CURSOR} content={<ChartTip hint="" fmt={(v: number) => inrShort(v)} />} />
              <Bar dataKey="committed" name="Committed" fill="#fdba74" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realised" name="Realised" fill="#0f9f6e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
          <div className={cn('mt-2 rounded-xl border p-3 flex items-start gap-3', d.closed ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200')}>
            <span className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0', d.closed ? 'bg-emerald-600 text-white' : 'bg-white border border-line text-muted')}><Icon name={d.closed ? 'LockKeyhole' : 'CalendarClock'} size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ink">{d.closed ? `${ctx.fy} closure booked` : `${ctx.fy} closes on ${fmtDate(d.fyEnd)}`}</div>
              <div className="text-[11.5px] text-muted leading-snug">{REALISATION_CYCLE[5]}</div>
            </div>
          </div>
        </Card>
      </div>
      <Card title="FY savings & carry-over by commodity" icon="Table2">
        <DataTable rows={d.rows} rowKey={(r) => r.code} columns={cols} exportName="COIN_FY_closure" onRowClick={(r) => drill({ commodity: r.code })} />
      </Card>
      {list.el}
    </div>
  )
}

export const _unusedV2 = { InfoTip, UserChip, pctTick, ideaColumns, supplierName }
