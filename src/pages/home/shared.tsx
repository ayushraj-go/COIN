// Shared building blocks for the role-based homes (M1 Sourcing Home, M6 Supplier home, submitter & evaluator homes)
import React, { useMemo } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import type { Bucket, Filters, Idea, SlaRule } from '../../lib/types'
import { TRACKER_STAGES } from '../../lib/masters'
import { BUCKET_STYLE, bucketFor, ideaAnnualised } from '../../lib/calc'
import { fmtDate, fyOf, inrShort, quarterOf, QUARTER_MONTHS, sum, todayIso, workingDaysBetween } from '../../lib/format'
import { ROLE_LABEL, primaryRole } from '../../lib/nav'
import { Button, Icon, LeverChip, Modal, Skeleton, StageBadge, cn } from '../../components/ui'

// ─── Motion: staggered entrance that keeps 12-col spans on the grid items ─────
export function RevealGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
      {children}
    </motion.div>
  )
}
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={cn('min-w-0 flex flex-col', className)} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', duration: 0.55, bounce: 0.1 } } }}>
      {children}
    </motion.div>
  )
}

// ─── Chart primitives (Section 14 chart rules) ────────────────────────────────
export const AXIS_TICK = { fontSize: 11, fill: '#64748b' }
export const GRID_STROKE = '#eceef6'

/** White rounded recharts tooltip */
export function ChartTip({ active, payload, label, fmt = (v: number) => inrShort(v), labelFmt, colors }: any) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p: any) => p.value != null && p.dataKey !== 'base')
  if (!rows.length) return null
  return (
    <div className="rounded-xl bg-white border border-line shadow-[0_12px_32px_-12px_rgb(15_23_42/.35)] px-3 py-2 text-[12px] min-w-[180px]">
      <div className="font-semibold text-ink mb-1">{labelFmt ? labelFmt(label, payload) : label}</div>
      {rows.map((p: any) => (
        <div key={p.dataKey + p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: colors?.[p.dataKey] ?? p.payload?.color ?? p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-ink num">{fmt(p.value, p)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Drill-down URL contract (Idea Register honours these) ────────────────────
export function drillUrl(params: Record<string, string | undefined | null>, filters?: Filters, base = '/ideas') {
  const out: [string, string][] = []
  if (filters) {
    if (filters.commodity !== 'All') out.push(['commodity', filters.commodity])
    if (filters.categoryId !== 'All') out.push(['category', filters.categoryId])
    if (filters.leverId !== 'All') out.push(['lever', filters.leverId])
    if (filters.buyerId !== 'All') out.push(['buyer', filters.buyerId])
    if (filters.plant !== 'All') out.push(['plant', filters.plant])
  }
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue
    const i = out.findIndex(([kk]) => kk === k)
    if (i >= 0) out[i] = [k, v]
    else out.push([k, v])
  }
  const q = out.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return base + (q ? `?${q}` : '')
}
export function useDrill() {
  const nav = useNavigate()
  const filters = useStore((s) => s.filters)
  return (params: Record<string, string | undefined | null>, base = '/ideas', withFilters = true) => nav(drillUrl(params, withFilters ? filters : undefined, base))
}

/** Active FY from the global filter bar */
export function useFy() {
  const f = useStore((s) => s.filters.fy)
  const cur = useStore((s) => s.settings.currentFy)
  return f === 'All' ? cur : f
}

// ─── Greeting header ──────────────────────────────────────────────────────────
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
export function todayLine() {
  const t = todayIso()
  const q = quarterOf(t)
  return `${WEEKDAYS[new Date().getDay()]}, ${fmtDate(t)} · ${fyOf(t)} ${q} (${QUARTER_MONTHS[q]})`
}
/** Light page header: greeting + context line on the left, view pills / actions on the right. No coloured band. */
export function HomeHeader({ title, subtitle, actions, badge }: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; badge?: React.ReactNode }) {
  const me = useMe()
  if (!me) return null
  const first = me.name.replace(/^Dr\.\s*/, '').split(' ')[0]
  return (
    <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[20px] leading-tight font-bold tracking-[-0.02em] text-ink truncate">{title ?? <>{greeting()}, <span className="text-brand-grad">{first}</span></>}</h1>
          {badge}
        </div>
        <p className="text-[12.5px] text-muted mt-0.5 truncate">
          {subtitle ?? <>{ROLE_LABEL[primaryRole(me)]} · {todayLine()}</>}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Dashboard / Advanced analytics switch — gradient pill on a white track */
export function ViewPills({ value, onChange }: { value: 'dashboard' | 'advanced'; onChange: (v: 'dashboard' | 'advanced') => void }) {
  const opts = [{ key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' }, { key: 'advanced', label: 'Advanced analytics', icon: 'ChartColumnBig' }] as const
  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-white border border-brand-100 shadow-[0_4px_14px_-8px_rgb(36_89_224/.35)]">
      {opts.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={cn('relative h-8 px-3.5 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 transition-colors', value === o.key ? 'text-white' : 'text-ink-2 hover:text-brand-700')}>
          {value === o.key && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-brand-grad shadow-[0_6px_14px_-6px_rgb(36_89_224/.7)]" transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }} />}
          <span className="relative flex items-center gap-1.5"><Icon name={o.icon} size={14} />{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Mini stage tracker (the six workflow stages as segments) ────────────────
export function StageTrackerMini({ idea, className }: { idea: Idea; className?: string }) {
  const stages = TRACKER_STAGES
  const dropped = idea.bucket === 'Dropped'
  const ref = dropped ? idea.dropStage ?? stages[1] : idea.stage
  const cur = idea.stage === 'Draft' ? -1 : stages.indexOf(ref)
  const label = idea.stage === 'Draft' ? 'Draft — not yet submitted' : dropped ? `${idea.stage} at ${ref}` : `${idea.stage} · step ${cur + 1} of ${stages.length}`
  return (
    <div className={cn('flex items-center gap-[3px]', className)} title={label}>
      {stages.map((s, k) => {
        const implemented = idea.bucket === 'Implemented'
        const done = implemented || k < cur
        const isCur = !implemented && k === cur
        const c = BUCKET_STYLE[bucketFor(idea.route, s)].color
        const bg = dropped && isCur ? '#e0364f' : done || isCur ? c : '#e2e8f0'
        return <span key={s} className="h-1.5 rounded-full transition-all" style={{ width: isCur ? 16 : 9, background: bg, opacity: dropped && k < cur ? 0.45 : 1, boxShadow: isCur ? `0 0 0 2px ${bg}33` : undefined }} />
      })}
    </div>
  )
}

// ─── SLA from an arbitrary start date (used for Finance validation SLA) ───────
export function slaFrom(startIso: string, rule?: SlaRule | null) {
  const wd = workingDaysBetween(startIso.slice(0, 10), todayIso())
  if (!rule) return { key: null as string | null, working: wd, sla: 0, left: 0, state: 'none' as 'none' | 'ok' | 'due' | 'breach' | 'escalated', rule: null as SlaRule | null }
  const left = rule.slaDays - wd
  const state = wd >= rule.escalateDay ? 'escalated' : wd > rule.slaDays ? 'breach' : wd >= rule.reminderDay ? 'due' : 'ok'
  return { key: rule.stage as string | null, working: wd, sla: rule.slaDays, left, state: state as 'none' | 'ok' | 'due' | 'breach' | 'escalated', rule }
}
export const SLA_RANK: Record<string, number> = { escalated: 4, breach: 3, due: 2, ok: 1, none: 0 }

// ─── Drill modal: list the ideas behind a chart segment ───────────────────────
export function DrillModal({ open, onClose, title, subtitle, ideas, valueFn, valueLabel = 'Annualised', links }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; ideas: Idea[]; valueFn?: (i: Idea) => number; valueLabel?: string; links?: { label: string; url: string }[]
}) {
  const openIdea = useStore((s) => s.openIdea)
  const nav = useNavigate()
  const val = (i: Idea) => (valueFn ? valueFn(i) : ideaAnnualised(i))
  const rows = useMemo(() => [...ideas].sort((a, b) => val(b) - val(a)), [ideas, valueFn]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = sum(rows.map((x) => val(x)))
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle ?? `${rows.length} ideas · ${inrShort(total)} ${valueLabel.toLowerCase()}`} icon="ListTree" size="lg"
      footer={links?.length ? <>{links.map((l, k) => <Button key={l.url} variant={k === links.length - 1 ? 'primary' : 'secondary'} size="sm" icon="Table2" onClick={() => { onClose(); nav(l.url) }}>{l.label}</Button>)}</> : undefined}>
      <div className="-mx-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted border-b border-line">
          <span>Idea</span><span className="text-right">{valueLabel}</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto">
          {rows.map((i) => (
            <button key={i.id} onClick={() => { onClose(); setTimeout(() => openIdea(i.id), 120) }} className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 py-2 border-b border-slate-100 hover:bg-slate-50 text-left rounded-md">
              <span className="min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-muted shrink-0">{i.id}</span>
                  <span className="text-[12.5px] font-semibold text-ink truncate">{i.title}</span>
                </span>
                <span className="flex items-center gap-2 mt-1 flex-wrap"><StageBadge stage={i.stage} bucket={i.bucket} /><LeverChip leverId={i.leverId} compact /></span>
              </span>
              <span className="text-[13px] font-bold text-ink num text-right">{inrShort(val(i))}</span>
            </button>
          ))}
          {!rows.length && <div className="py-10 text-center text-[13px] text-muted">No ideas behind this segment for the active filters.</div>}
        </div>
      </div>
    </Modal>
  )
}

// ─── Section header chip showing the active bucket filter ─────────────────────
export function BucketFilterChip({ bucket, onClear }: { bucket: Bucket | null; onClear: () => void }) {
  if (!bucket) return null
  const s = BUCKET_STYLE[bucket]
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-[11px] font-semibold border" style={{ color: s.text, background: s.soft, borderColor: `${s.color}33` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{bucket}
      <button onClick={onClear} className="h-4 w-4 grid place-items-center rounded-full hover:bg-white/80" title="Clear bucket filter"><Icon name="X" size={10} /></button>
    </span>
  )
}

// ─── Skeleton for the dense home ──────────────────────────────────────────────
export function HomeSkeleton({ variant = 'dashboard' }: { variant?: 'dashboard' | 'people' }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="space-y-2"><Skeleton className="h-5 w-64" /><Skeleton className="h-3.5 w-96 max-w-[70vw]" /></div></div>
      {variant === 'dashboard' && <Skeleton className="h-8 w-full max-w-[900px]" />}
      <div className="grid grid-cols-12 gap-3">
        <Skeleton className="col-span-12 xl:col-span-5 h-[300px] rounded-xl" />
        <div className="col-span-12 xl:col-span-4 grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[144px] rounded-xl" />)}</div>
        <Skeleton className="col-span-12 xl:col-span-3 h-[300px] rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-xl" />)}</div>
      <div className="grid grid-cols-12 gap-3"><Skeleton className="col-span-12 xl:col-span-8 h-[340px] rounded-xl" /><Skeleton className="col-span-12 xl:col-span-4 h-[340px] rounded-xl" /></div>
    </div>
  )
}

/** Compact KPI tile for people homes */
export function MiniStat({ label, value, sub, icon, color = '#2f5bc6', onClick, tip }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: string; color?: string; onClick?: () => void; tip?: React.ReactNode }) {
  return (
    <div onClick={onClick} className={cn('card p-4 relative overflow-hidden min-w-0 transition-colors', onClick && 'cursor-pointer hover:border-[#d0d5dd]')}>
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={14} className="shrink-0" style={{ color }} />
        <span className="text-[12px] font-medium text-muted truncate">{label}</span>
        {tip}
      </div>
      <div className="text-[22px] leading-none font-bold tracking-tight text-ink mt-3">{value}</div>
      {sub && <div className="text-[11.5px] text-muted mt-1.5 truncate">{sub}</div>}
    </div>
  )
}
