// CO Dashboard (one screen): implementation KPIs, implementation pipeline, execution health
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../store/useStore'
import type { Health, Idea } from '../../lib/types'
import { BUCKET_STYLE, HEALTH_STYLE, ideaCommitted } from '../../lib/calc'
import { daysBetween, fmtDate, inrShort, monthLong, pct, sum } from '../../lib/format'
import { Avatar, Badge, Button, Card, Count, EmptyState, HealthBadge, Icon, InfoTip, Money, cn } from '../../components/ui'
import { AXIS_TICK, ChartTip, DrillModal, GRID_STROKE, drillUrl, useDrill } from '../home/shared'
import { HEALTHS, coValue, type CoData, type CoStage } from './data'

const EXEC = BUCKET_STYLE['In Execution']
const IMPL = BUCKET_STYLE.Implemented
const RISK = '#e0364f'

// ─── KPI tiles ────────────────────────────────────────────────────────────────
function Tile({ label, icon, color, tip, onClick, hero, children }: { label: string; icon: string; color: string; tip: React.ReactNode; onClick: () => void; hero?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn('group relative overflow-hidden text-left rounded-xl p-4 h-full w-full transition-all duration-200 focus-ring',
        hero ? 'bg-hero text-white shadow-[0_14px_32px_-18px_rgb(36_89_224/.8)] hover:shadow-[0_18px_36px_-16px_rgb(36_89_224/.85)]' : 'card hover:border-brand-200 hover:shadow-[0_10px_26px_-18px_rgb(15_27_51/.35)]')}>
      {hero && <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />}
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={hero ? { background: 'rgb(255 255 255 / .16)', color: '#fff' } : { background: `${color}14`, color }}><Icon name={icon} size={14} /></span>
          <span className={cn('text-[12.5px] font-semibold truncate', hero ? 'text-white/90' : 'text-ink-2')}>{label}</span>
          <span onClick={(e) => e.stopPropagation()} className={hero ? '[&_svg]:text-white/70' : undefined}><InfoTip title={label}>{tip}</InfoTip></span>
        </span>
        <Icon name="ArrowUpRight" size={14} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5', hero ? 'text-white/70' : 'text-muted')} />
      </div>
      <div className="relative mt-2.5">{children}</div>
    </button>
  )
}

export function CoKpis({ c }: { c: CoData }) {
  const drill = useDrill()
  const nav = useNavigate()
  const filters = useStore((s) => s.filters)
  const [watchOpen, setWatchOpen] = useState(false)
  const k = c.kpi
  const vShare = k.realised ? (k.validated / k.realised) * 100 : 0
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <Tile label="In Execution" icon="Rocket" color={EXEC.color} onClick={() => drill({ bucket: 'In Execution' })}
        tip="Approved ideas being implemented — NPD sample, PAP price / source revision or internal execution. ₹ = FY-phased committed hard savings.">
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] leading-none font-bold tracking-tight text-ink"><Money value={k.execCommitted} /></span>
          <span className="text-[11.5px] text-muted">committed</span>
        </div>
        <div className="text-[11.5px] text-muted mt-1.5 truncate"><b className="text-ink-2 num"><Count value={k.execCount} /></b> ideas · {inrShort(k.execAnnualised)} annualised</div>
      </Tile>

      <Tile label="Implemented" icon="CircleCheckBig" color={IMPL.color} onClick={() => drill({ bucket: 'Implemented' })}
        tip="Marked Done with an effective date and approved price. ₹ = annualised impact at approved price; realisation flows from actual MRN.">
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] leading-none font-bold tracking-tight text-ink"><Money value={k.implAnnualised} /></span>
          <span className="text-[11.5px] text-muted">annualised</span>
        </div>
        <div className="text-[11.5px] text-muted mt-1.5 truncate"><b className="text-ink-2 num"><Count value={k.implCount} /></b> ideas · {inrShort(k.implCommitted)} live in {c.fy}</div>
      </Tile>

      <Tile hero label={`Realised savings · ${c.fy} to date`} icon="BadgeIndianRupee" color="#fff" onClick={() => nav('/reports/leakage')}
        tip="MRN-based realised hard savings = (baseline − approved price) × MRN quantity after the effective date. Validated = accepted by Finance.">
        <div className="text-[24px] leading-none font-bold tracking-tight"><Money value={k.realised} /></div>
        <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-white/20">
          <motion.div initial={{ width: 0 }} animate={{ width: `${vShare}%` }} transition={{ duration: 0.9 }} className="bg-white" />
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5 text-[11.5px] text-white/85">
          <span className="truncate"><b className="text-white num">{inrShort(k.validated)}</b> validated</span>
          <span className="truncate"><b className="text-white num">{inrShort(k.pending)}</b> pending</span>
        </div>
      </Tile>

      <Tile label="Overdue / at risk" icon="Siren" color={RISK} onClick={() => setWatchOpen(true)}
        tip="Live executions past their due date (Delayed) or with an overdue milestone (At risk). ₹ = committed hard savings exposed.">
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] leading-none font-bold tracking-tight num" style={{ color: k.watchCount ? RISK : undefined }}><Count value={k.watchCount} /></span>
          <span className="text-[11.5px] text-muted">executions · <b className="text-ink-2 num">{inrShort(k.watchCommitted)}</b> exposed</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full px-2 h-5 font-semibold" style={{ color: HEALTH_STYLE.Delayed.color, background: HEALTH_STYLE.Delayed.soft }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH_STYLE.Delayed.color }} />{c.overdue.length} overdue</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 h-5 font-semibold" style={{ color: '#b35f0c', background: HEALTH_STYLE['At risk'].soft }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH_STYLE['At risk'].color }} />{c.atRisk.length} at risk</span>
        </div>
      </Tile>

      <DrillModal open={watchOpen} onClose={() => setWatchOpen(false)} title="Overdue and at-risk executions" ideas={c.watch}
        valueFn={(i) => ideaCommitted(i, c.fy)} valueLabel="Committed"
        links={[
          { label: 'Delayed', url: drillUrl({ bucket: 'In Execution', health: 'Delayed' }, filters) },
          { label: 'At risk', url: drillUrl({ bucket: 'In Execution', health: 'At risk' }, filters) },
        ]} />
    </div>
  )
}

// ─── Implementation pipeline: post-approval stages + realised by month ────────
const RM_COLORS = { validated: '#0b8a77', pendingPart: '#7fdcc6' }

export function PipelineCard({ c, className }: { c: CoData; className?: string }) {
  const drill = useDrill()
  const filters = useStore((s) => s.filters)
  const lrm = useStore((s) => s.settings.lastRealisationMonth)
  const [open, setOpen] = useState<CoStage | null>(null)
  const max = Math.max(1, ...c.stages.map((r) => r.value))
  const totalCount = sum(c.stages.map((r) => r.count))
  const totalValue = sum(c.stages.map((r) => r.value))
  const click = (r: CoData['stages'][number]) => {
    if (r.st.key === 'impl') return drill({ bucket: 'Implemented' })
    setOpen(r.st)
  }
  const openRow = c.stages.find((r) => r.st.key === open?.key)
  const months = c.d.trend.map((t) => ({ label: t.label, month: t.month, validated: t.validated, pendingPart: t.realised == null ? null : Math.max(0, t.realised - (t.validated ?? 0)) }))
  const live = c.d.trend.filter((t) => t.realised != null)
  const avg = live.length ? sum(live.map((t) => t.realised ?? 0)) / live.length : 0

  return (
    <Card className={cn('h-full', className)} icon="Workflow" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Implementation pipeline<InfoTip title="Implementation pipeline">After Sourcing approval every idea is in Execution started, where its checklist runs NPD sample (if a new part / source needs trial), PAP price or source revision, then go-live, until it is Implemented. ₹ = annualised impact (approved price once implemented). Click a stage for its ideas.</InfoTip></span>}
      subtitle={`${totalCount} ideas after approval · ${inrShort(totalValue)} annualised`}
      actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => drill({}, '/execution')}>Execution Hub</Button>}>
      <div className="grid grid-cols-4 gap-2.5">
        {c.stages.map((r, k) => {
          const st = r.st.key === 'impl' ? IMPL : EXEC
          const w = r.value ? Math.max(6, (r.value / max) * 100) : 0
          return (
            <div key={r.st.key} className="relative min-w-0">
              <button onClick={() => click(r)} title={r.st.hint}
                className="group w-full text-left rounded-xl border px-3 py-2.5 transition-colors hover:shadow-[0_8px_20px_-16px_rgb(15_27_51/.45)]"
                style={{ background: r.st.key === 'impl' ? IMPL.soft : '#fffaf3', borderColor: `${st.color}33` }}>
                <span className="flex items-center gap-1.5 min-w-0">
                  <Icon name={r.st.icon} size={13} style={{ color: st.color }} className="shrink-0" />
                  <span className="text-[11.5px] font-semibold truncate" style={{ color: st.text }}>{r.st.label}</span>
                </span>
                <span className="flex items-baseline justify-between gap-1 mt-1.5">
                  <span className="text-[22px] leading-none font-bold text-ink num"><Count value={r.count} /></span>
                  <span className="text-[12.5px] font-semibold text-ink-2 num">{r.count ? inrShort(r.value) : '—'}</span>
                </span>
                <span className="block mt-2 h-1.5 rounded-full bg-white/80 overflow-hidden">
                  <motion.span className="block h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.8, delay: k * 0.06 }} style={{ background: `linear-gradient(90deg, ${st.color}aa, ${st.color})` }} />
                </span>
                <span className="block text-[10.5px] text-muted mt-1 num">{totalValue ? pct((r.value / totalValue) * 100, 0) : '0%'} of value</span>
              </button>
              {k < c.stages.length - 1 && (
                <span className="absolute -right-[11px] top-1/2 -translate-y-1/2 z-10 h-[18px] w-[18px] rounded-full bg-white border border-line grid place-items-center text-muted"><Icon name="ChevronRight" size={11} /></span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3.5 pt-3 border-t border-line flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted"><Icon name="ChartColumnBig" size={13} className="text-accent-600" />Realised savings by month</div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: RM_COLORS.validated }} />Validated</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: RM_COLORS.pendingPart }} />Pending validation</span>
            <span className="hidden 2xl:inline">Avg <b className="text-ink-2 num">{inrShort(avg)}</b> / month</span>
          </div>
        </div>
        <div className="flex-1 min-h-[120px] -ml-1 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => inrShort(v, 0)} />
              <RTooltip cursor={{ fill: '#f1f5f9', radius: 6 } as any} content={<ChartTip colors={RM_COLORS} labelFmt={(_: any, p: any) => monthLong(p?.[0]?.payload?.month ?? '')} />} />
              <Bar dataKey="validated" name="Finance validated" stackId="r" fill={RM_COLORS.validated} maxBarSize={22} />
              <Bar dataKey="pendingPart" name="Pending validation" stackId="r" fill={RM_COLORS.pendingPart} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10.5px] text-muted mt-1">Hard savings · MRN-based realisation to {monthLong(lrm)}</div>
      </div>

      <DrillModal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.label} — stage drill-down` : ''} ideas={openRow?.ideas ?? []} valueFn={coValue}
        links={[{ label: 'Open in the Execution Hub', url: drillUrl({}, filters, '/execution') }]} />
    </Card>
  )
}

// ─── Execution health + next due / overdue ────────────────────────────────────
function dueText(target: string, today: string) {
  const d = daysBetween(today, target)
  if (d < 0) return { text: `${-d} d overdue`, color: RISK }
  if (d === 0) return { text: 'Due today', color: '#b35f0c' }
  return { text: `in ${d} d`, color: '#66758f' }
}

export function HealthCard({ c, className }: { c: CoData; className?: string }) {
  const drill = useDrill()
  const openIdea = useStore((s) => s.openIdea)
  const total = c.live.length
  const rows = HEALTHS.map((h) => ({ h, ideas: c.health[h], count: c.health[h].length, value: c.committedOf(c.health[h]) }))
  const list: Idea[] = c.due.slice(0, typeof window !== 'undefined' && window.innerHeight >= 880 ? 6 : 3)
  const onTimePct = total ? (c.health['On track'].length / total) * 100 : 0
  return (
    <Card className={cn('h-full', className)} icon="HeartPulse" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Execution health<InfoTip title="Execution health">Delayed = due date passed. At risk = a milestone is overdue. On track = otherwise. Owners and Commodity Leads get reminders every 15 days, weekly in the last 30 days, and weekly after the due date.</InfoTip></span>}
      subtitle={`${total} live executions · ${pct(onTimePct, 0)} on track`}
      actions={c.overdue.length ? <Badge color={RISK} dot>{c.overdue.length} overdue</Badge> : <Badge color="#0f9f6e" icon="CircleCheck">None overdue</Badge>}>
      {total ? (
        <>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-px">
            {rows.map((r) => <motion.div key={r.h} initial={{ width: 0 }} animate={{ width: `${(r.count / total) * 100}%` }} transition={{ duration: 0.9 }} style={{ background: HEALTH_STYLE[r.h].color }} title={`${r.h} · ${r.count}`} />)}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2.5">
            {rows.map((r) => (
              <button key={r.h} onClick={() => drill({ bucket: 'In Execution', health: r.h })} className="text-left rounded-lg border border-line px-2.5 py-2 hover:bg-slate-50 transition-colors min-w-0">
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: HEALTH_STYLE[r.h].color }} />{r.h}</span>
                <span className="flex items-baseline justify-between gap-1 mt-1">
                  <span className="text-[18px] leading-none font-bold num" style={{ color: r.h === 'On track' ? '#0f1b33' : HEALTH_STYLE[r.h].color }}>{r.count}</span>
                  <span className="text-[11.5px] font-semibold text-ink-2 num truncate">{inrShort(r.value)}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3.5 pt-3 border-t border-line flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted"><Icon name="CalendarClock" size={13} className="text-brand-600" />Next due &amp; overdue</div>
              <button onClick={() => drill({}, '/execution')} className="text-[11.5px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5">All {total}<Icon name="ChevronRight" size={12} /></button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_88px_84px] gap-2 px-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
              <span>Idea · owner</span><span className="text-right">Due date</span><span className="text-right">Health</span>
            </div>
            <div className="flex flex-col">
              {list.map((i) => {
                const ex = i.execution!
                const owner = c.userOf(ex.ownerId)
                const h = dueText(ex.targetDate, c.t)
                const health = c.health.Delayed.includes(i) ? 'Delayed' : c.health['At risk'].includes(i) ? 'At risk' : 'On track'
                return (
                  <button key={i.id} onClick={() => openIdea(i.id)} className="group grid grid-cols-[minmax(0,1fr)_88px_84px] items-center gap-2 px-1.5 py-[7px] rounded-lg hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
                    <span className="flex items-center gap-2 min-w-0">
                      {owner ? <Avatar name={owner.name} color={owner.avatarColor} size={26} /> : <span className="h-[26px] w-[26px] rounded-full bg-slate-100 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title}</span>
                        <span className="block text-[11px] text-muted truncate"><span className="font-mono">{i.id}</span> · {owner?.name ?? 'Unassigned'} · {inrShort(ideaCommitted(i, c.fy))}</span>
                      </span>
                    </span>
                    <span className="text-right leading-tight">
                      <span className="block text-[12px] font-semibold text-ink num">{fmtDate(ex.targetDate)}</span>
                      <span className="block text-[10.5px] font-semibold num" style={{ color: h.color }}>{h.text}</span>
                    </span>
                    <span className="flex justify-end"><HealthBadge health={health as Health} /></span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon="Rocket" title="No live executions" desc="Approved ideas appear here once an execution plan is set in the Execution Hub." className="py-8" />
      )}
    </Card>
  )
}
