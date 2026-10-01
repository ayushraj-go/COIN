// M8 — Execution Hub (Section 9): every approved idea with an owner, dates, quarter phasing, milestones, reminders,
// Done / Drop and a slippage log. Table ↔ quarter timeline.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore, useMe, hasRole } from '../store/useStore'
import { useFilteredIdeas } from '../lib/hooks'
import { can } from '../lib/nav'
import type { Idea } from '../lib/types'
import { EXECUTION_INTRO, EXECUTION_RECORD, LEAKAGE_NOTE } from '../lib/scope'
import { HEALTH_STYLE, committedInFy, healthOf, ideaAnnualised, ideaApprovedAnnualised, ideaCommitted, isHard } from '../lib/calc'
import { daysBetween, fmtDate, fmtDateShort, fmtDateTime, fyMonths, inrShort, monthLabel, monthLong, sum, todayIso, ymOf } from '../lib/format'
import { exportExcel } from '../lib/export'
import {
  Badge, Button, Card, EmptyState, HealthBadge, Icon, InfoTip, KpiCard, PageHeader, ProgressBar, SavingsTypeBadge, Segmented, Skeleton, Stagger, Tooltip, UserChip, cn, useWarmup,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { MenuItem, MiniHead, Popover, ReassignModal, nextReminder, snapshot, toast } from './exec/shared'
import { DropModal, LinkedEditor, MarkDoneModal, MilestoneNoteModal, PhasingEditor, ProgressModal, TargetDateModal, npdColor, papColor } from './exec/ExecModals'
import { ExecTimeline, TimelineLegend } from './exec/Timeline'

type Kpi = 'all' | 'due' | 'overdue' | 'risk' | 'done' | 'dropped'
type ModalState = { kind: 'progress' | 'note' | 'done' | 'drop' | 'reassign' | 'target'; id: string; date?: string; to?: string; milestoneId?: string } | null
type PopState = { kind: 'phasing' | 'linked' | 'menu'; id: string; el: HTMLElement } | null
const QS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
/** The execution "target date" is a deadline — shown as the due date. COIN has no savings target / landing. */
const dueWording = (s: string) => s.replace(/\btarget date\b/g, 'due date').replace(/\bTarget date\b/g, 'Due date').replace(/removed from landing/g, 'removed from committed savings')

const removedCommitted = (i: Idea, fy: string) => {
  const p = i.execution?.phasing
  const s = p ? p.Q1 + p.Q2 + p.Q3 + p.Q4 : 0
  return s > 0 ? s : i.execution ? committedInFy(ideaAnnualised(i), i.execution.targetDate, fy) : 0
}

export default function ExecutionHub() {
  const me = useMe()
  const nav = useNavigate()
  const ideas = useFilteredIdeas()
  const ledger = useStore((s) => s.ledger)
  const users = useStore((s) => s.users)
  const commodities = useStore((s) => s.commodities)
  const settings = useStore((s) => s.settings)
  const fyF = useStore((s) => s.filters.fy)
  const openIdea = useStore((s) => s.openIdea)
  const fy = fyF === 'All' ? settings.currentFy : fyF
  const ready = useWarmup(320)

  const [kpi, setKpi] = useState<Kpi>('all')
  const [view, setView] = useState<'table' | 'timeline'>('table')
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [owner, setOwner] = useState('All')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState>(null)
  const [pop, setPop] = useState<PopState>(null)
  const [editTarget, setEditTarget] = useState<{ id: string; draft: string } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(0)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, ready])

  const t = todayIso()
  const ym = ymOf(t)
  const hub = useMemo(() => ideas.filter((i) => i.execution), [ideas])
  const active = useMemo(() => hub.filter((i) => i.execution!.status === 'In Execution' && i.bucket === 'In Execution'), [hub])
  const sets = useMemo(() => ({
    all: active,
    due: active.filter((i) => ymOf(i.execution!.targetDate) === ym && i.execution!.targetDate >= t),
    overdue: active.filter((i) => i.execution!.targetDate < t),
    risk: active.filter((i) => healthOf(i) === 'At risk'),
    done: hub.filter((i) => i.execution!.status === 'Done' && ymOf(i.implementedAt ?? i.execution!.effectiveDate ?? '') === ym),
    dropped: hub.filter((i) => i.execution!.status === 'Dropped' && ymOf(i.droppedAt ?? '') === ym),
  }), [active, hub, ym, t])
  const cm = (list: Idea[]) => sum(list.map((i) => ideaCommitted(i, fy)))
  const committedHard = sum(active.filter(isHard).map((i) => ideaCommitted(i, fy)))

  const ownerOptions = useMemo(() => users.filter((u) => u.active && (u.roles.includes('buyer') || u.roles.includes('lead'))), [users])
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return sets[kpi].filter((i) => (owner === 'All' || i.execution!.ownerId === owner) && (!k || i.id.toLowerCase().includes(k) || i.title.toLowerCase().includes(k) || i.parts.some((p) => p.partCode.includes(k))))
      .sort((a, b) => (a.execution!.targetDate < b.execution!.targetDate ? -1 : a.execution!.targetDate > b.execution!.targetDate ? 1 : 0))
  }, [sets, kpi, owner, q])

  // price leakage for these ideas (Section 9)
  const hubIds = useMemo(() => new Set(hub.map((i) => i.id)), [hub])
  const leak = useMemo(() => {
    const rows = ledger.filter((l) => hubIds.has(l.ideaId) && l.leakage > 0 && fyMonths(fy).includes(l.month))
    const byIdea = new Map<string, number>()
    rows.forEach((r) => byIdea.set(r.ideaId, (byIdea.get(r.ideaId) ?? 0) + r.leakage))
    return { total: sum(rows.map((r) => r.leakage)), lines: rows.length, ideas: byIdea.size, top: [...byIdea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), months: [...new Set(rows.map((r) => r.month))].sort() }
  }, [ledger, hubIds, fy])

  const canExec = can(me, 'execute')
  const canReassign = hasRole(me, 'lead', 'head')
  const editable = (i: Idea) => canExec && i.execution?.status === 'In Execution' && (hasRole(me, 'lead', 'head') || !!me?.commodities.includes(i.commodity) || i.execution?.ownerId === me?.id)
  const byId = (id?: string) => ideas.find((i) => i.id === id) ?? null
  const mIdea = byId(modal?.id)
  const pIdea = byId(pop?.id)

  const toggleMs = (i: Idea, mid: string) => {
    const m = i.execution!.milestones.find((x) => x.id === mid)!
    const undo = snapshot([i.id])
    useStore.getState().toggleMilestone(i.id, mid)
    toast(m.doneDate ? `Milestone reopened: ${m.name}` : `Milestone done: ${m.name}`, 'success', undo)
  }
  const commitTarget = (i: Idea) => {
    const d = editTarget?.draft
    setEditTarget(null)
    if (!d || d === i.execution!.targetDate || !/^20[2-4]\d-\d{2}-\d{2}$/.test(d)) return
    setModal({ kind: 'target', id: i.id, date: d })
  }
  const doExport = () => exportExcel(`COIN_Execution_Hub_${fy}`, [{
    name: 'Execution Hub',
    rows: list.map((i) => {
      const ex = i.execution!
      const nr = nextReminder(ex)
      return {
        'Idea ID': i.id, Title: i.title, Commodity: i.commodity, Owner: users.find((u) => u.id === ex.ownerId)?.name ?? '', 'Start date': ex.startDate, 'Due date': ex.targetDate, 'Original due date': ex.originalTargetDate,
        'Q1 ₹': Math.round(ex.phasing.Q1), 'Q2 ₹': Math.round(ex.phasing.Q2), 'Q3 ₹': Math.round(ex.phasing.Q3), 'Q4 ₹': Math.round(ex.phasing.Q4), 'Progress %': ex.progress, Health: ex.status === 'In Execution' ? healthOf(i) : ex.status,
        'Next reminder': ex.status === 'In Execution' ? nr.date : '', 'NPD request': i.npdRequestId ?? '', 'NPD status': i.npdStatus ?? '', 'PAP request': i.papRequestId ?? '', 'PAP status': i.papStatus ?? '', [`Committed ${fy} ₹`]: Math.round(ideaCommitted(i, fy)), 'Slippage changes': ex.slippage.length,
      }
    }),
  }])

  const kpiCards: { k: Kpi; label: string; value: number; sub: React.ReactNode; icon: string; color: string; tip: string; formula?: string }[] = [
    { k: 'all', label: 'In execution', value: active.length, sub: <>{inrShort(committedHard)} committed</>, icon: 'Rocket', color: '#ec8a1c', tip: 'Approved ideas with an owner and dates, until marked Done or Dropped. ₹ committed counts hard savings only; cost avoidance and one-time savings are reported separately.', formula: 'Σ FY-phased saving of ideas In Execution' },
    { k: 'due', label: 'Due this month', value: sets.due.length, sub: <>{inrShort(cm(sets.due))} · {monthLabel(ym)}</>, icon: 'CalendarClock', color: '#4470d6', tip: 'Due date falls later this month.' },
    { k: 'overdue', label: 'Overdue', value: sets.overdue.length, sub: <>{inrShort(cm(sets.overdue))} overdue</>, icon: 'Clock3', color: '#e0364f', tip: 'Due date passed — health Delayed. Owner and Commodity Lead are emailed the day after, then weekly.', formula: 'Overdue value = ₹ committed on ideas past due date' },
    { k: 'risk', label: 'At risk', value: sets.risk.length, sub: <>{inrShort(cm(sets.risk))} at risk</>, icon: 'TriangleAlert', color: '#ec8a1c', tip: 'At least one milestone is past its due date while the due date is still ahead.' },
    { k: 'done', label: 'Done this month', value: sets.done.length, sub: <>{inrShort(sum(sets.done.map(ideaApprovedAnnualised)))} annualised</>, icon: 'CircleCheck', color: '#0f9f6e', tip: 'Marked Done — Implemented this month with an effective date and approved price.' },
    { k: 'dropped', label: 'Dropped this month', value: sets.dropped.length, sub: <>{inrShort(sum(sets.dropped.map((i) => removedCommitted(i, fy))))} removed</>, icon: 'Ban', color: '#6b7280', tip: 'Drop needs a reason code and remarks; the committed value is removed from committed savings and the drop is counted in its month.' },
  ]

  return (
    <div>
      <PageHeader icon="Rocket" title="Execution Hub" badge={<Badge color="#2f5bc6">M8</Badge>}
        subtitle="Approved ideas with owner, dates, quarter phasing, milestones, reminders, Done / Drop and slippage log"
        actions={<>
          <Tooltip content={<div className="grid gap-1"><div>{dueWording(EXECUTION_INTRO)}</div>{EXECUTION_RECORD.map(([k, v]) => <div key={k}><b>{dueWording(k)}:</b> {dueWording(v)}</div>)}</div>}><span className="inline-flex items-center gap-1 text-[12px] text-muted cursor-help"><Icon name="Info" size={13} />Execution record rules</span></Tooltip>
          <Button icon="FileSpreadsheet" onClick={doExport}>Export</Button>
        </>} />
      <FilterBar compact className="mb-5" />

      {!ready ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}</div>
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
      ) : (
        <>
          <Stagger className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
            {kpiCards.map((c) => (
              <KpiCard key={c.k} label={c.label} value={c.value} money={false} sub={c.sub} icon={c.icon} color={c.color} className="[&_.uppercase]:tracking-normal [&_.truncate]:whitespace-normal [&_span.uppercase]:leading-tight" tip={c.tip} formula={c.formula} active={kpi === c.k && c.k !== 'all'} onClick={() => setKpi((v) => (v === c.k ? 'all' : c.k))} />
            ))}
          </Stagger>

          {/* Price leakage callout */}
          <div className={cn('rounded-2xl border px-4 py-3 mb-4 flex flex-col lg:flex-row lg:items-center gap-3 shadow-[0_1px_3px_rgb(15_23_42/.04)]', leak.total > 0 ? 'border-red-200 bg-gradient-to-r from-red-50 to-white' : 'border-emerald-200 bg-emerald-50/60')}>
            <div className="flex items-center gap-3 min-w-0 lg:w-[42%]">
              <span className={cn('h-10 w-10 rounded-xl grid place-items-center shrink-0', leak.total > 0 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white')}><Icon name={leak.total > 0 ? 'Droplets' : 'ShieldCheck'} size={19} /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">Price leakage {fy}: <span className={cn('num', leak.total > 0 ? 'text-red-600' : 'text-emerald-700')}>{inrShort(leak.total)}</span>
                  <InfoTip title="Price leakage" formula="Σ (MRN price − approved new price) × MRN qty, where MRN price > approved">{LEAKAGE_NOTE}</InfoTip></div>
                <div className="text-[12px] text-muted">{leak.total > 0 ? `${leak.lines} part line${leak.lines > 1 ? 's' : ''} across ${leak.ideas} idea${leak.ideas > 1 ? 's' : ''} paid above the approved new price${leak.months.length ? ` (${leak.months.map((m) => monthLong(m).split(' ')[0].slice(0, 3)).join(', ')})` : ''}` : 'Every MRN in the ledger was paid at or below the approved new price.'}</div>
              </div>
            </div>
            {leak.total > 0 && (
              <div className="flex-1 flex flex-wrap items-center gap-1.5">
                {leak.top.map(([id, v]) => (
                  <button key={id} onClick={() => openIdea(id)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white border border-red-200 text-[12px] hover:border-red-300 hover:shadow-sm transition">
                    <span className="font-mono text-[11px] text-muted">{id}</span><b className="text-red-600 num">{inrShort(v)}</b>
                  </button>
                ))}
                <Button size="sm" variant="ghost" iconRight="ArrowRight" className="ml-auto" onClick={() => nav('/reports/leakage')}>Leakage report</Button>
              </div>
            )}
          </div>

          {/* Main view */}
          <Card pad={false} className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-3 border-b border-line">
              <div className="flex items-center gap-2 flex-wrap">
                <Segmented value={view} onChange={(k) => setView(k as any)} options={[{ key: 'table', label: 'Table', icon: 'Table2' }, { key: 'timeline', label: 'Quarter timeline', icon: 'ChartGantt' }]} />
                {kpi !== 'all' && (
                  <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-brand-50 border border-brand-200 text-[12px] font-semibold text-brand-700">
                    {kpiCards.find((c) => c.k === kpi)?.label}<button onClick={() => setKpi('all')} className="h-5 w-5 grid place-items-center rounded-full hover:bg-brand-100"><Icon name="X" size={12} /></button>
                  </span>
                )}
                <span className="text-[12px] text-muted num">{list.length} idea{list.length === 1 ? '' : 's'} · {inrShort(cm(list))} committed</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative"><Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 !pl-8 !w-56 text-[12.5px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, title, part code…" /></div>
                <select className="input !h-8 !w-44 text-[12.5px]" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="All">All owners</option>
                  {me && ownerOptions.some((u) => u.id === me.id) && <option value={me.id}>Owned by me</option>}
                  {ownerOptions.filter((u) => u.id !== me?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            {view === 'timeline' ? (
              <div>
                <div className="px-4 py-2 border-b border-line bg-white"><TimelineLegend /></div>
                <div className="overflow-x-auto"><ExecTimeline ideas={list} fy={fy} /></div>
              </div>
            ) : (
              <div ref={boxRef} className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }} />
                      <th>ID</th><th>Title</th><th className="max-[1700px]:hidden">Commodity</th><th>Owner</th><th className="max-[1700px]:hidden">Start date</th><th>Due date</th>
                      <th><span className="inline-flex items-center gap-1">Quarter phasing Q1–Q4<InfoTip title="Quarter phasing" formula="Σ Q1..Q4 vs committedInFy(annualised, due date)">Pre-filled from due date and annualised impact; click to edit. Green dot = matches the system pre-fill.</InfoTip></span></th>
                      <th>Progress</th><th>Health</th>
                      <th className="max-[1700px]:hidden"><span className="inline-flex items-center gap-1">Next reminder<InfoTip title="Implementation reminder">Every 15 days; weekly in the last 30 days before the due date. After the due date passes: the day after, then weekly.</InfoTip></span></th>
                      <th>NPD / PAP</th><th style={{ textAlign: 'right' }}>Committed {fy}</th><th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => {
                      const ex = i.execution!
                      const ed = editable(i)
                      const open = expanded.has(i.id)
                      const status = ex.status
                      const health = healthOf(i)
                      const hcol = status === 'Done' ? '#0f9f6e' : status === 'Dropped' ? '#6b7280' : HEALTH_STYLE[health].color
                      const p = ex.phasing
                      const psum = p.Q1 + p.Q2 + p.Q3 + p.Q4
                      const sys = committedInFy(ideaAnnualised(i), ex.targetDate, fy)
                      const match = Math.abs(psum - sys) < Math.max(1000, sys * 0.005)
                      const pmax = Math.max(p.Q1, p.Q2, p.Q3, p.Q4)
                      const slip = ex.originalTargetDate && ex.originalTargetDate !== ex.targetDate ? daysBetween(ex.originalTargetDate, ex.targetDate) : 0
                      const nr = nextReminder(ex)
                      const commodity = commodities.find((c) => c.code === i.commodity)
                      return (
                        <React.Fragment key={i.id}>
                          <tr className={cn(open && 'bg-slate-50/80')}>
                            <td className="!px-1.5"><button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(i.id) ? n.delete(i.id) : n.add(i.id); return n })} className="h-6 w-6 grid place-items-center rounded hover:bg-slate-200/70" title={open ? 'Collapse' : 'Milestones, notes and slippage'}><Icon name="ChevronRight" size={14} className={cn('transition-transform duration-200', open && 'rotate-90')} /></button></td>
                            <td><button onClick={() => openIdea(i.id)} className="font-mono text-[11.5px] font-semibold text-brand-700 hover:underline">{i.id}</button></td>
                            <td>
                              <div className="line-clamp-2 min-w-[180px] max-w-[260px] font-medium text-ink text-[12.5px]" title={i.title}>{i.title}</div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted">{i.route} route{!isHard(i) && <SavingsTypeBadge type={i.savingsType} />}</div>
                            </td>
                            <td className="max-[1700px]:hidden"><Tooltip content={commodity?.name ?? i.commodity}><span className="inline-flex items-center h-[22px] px-2 rounded-md bg-slate-100 text-[11.5px] font-bold text-ink-2">{i.commodity}</span></Tooltip></td>
                            <td>
                              {canReassign && ed ? (
                                <select className="h-8 max-w-[170px] rounded-lg border border-line bg-white px-2 text-[12.5px] font-medium hover:border-slate-300 focus:outline-none focus:border-brand-400" value={ex.ownerId} onChange={(e) => setModal({ kind: 'reassign', id: i.id, to: e.target.value })}>
                                  {ownerOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              ) : <UserChip userId={ex.ownerId} />}
                            </td>
                            <td className="max-[1700px]:hidden num text-[12.5px]">{fmtDate(ex.startDate)}</td>
                            <td>
                              {editTarget?.id === i.id ? (
                                <div className="flex items-center gap-1">
                                  <input type="date" autoFocus className="input !h-8 !w-[140px] text-[12.5px]" value={editTarget.draft} onChange={(e) => setEditTarget({ id: i.id, draft: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') commitTarget(i); if (e.key === 'Escape') setEditTarget(null) }} />
                                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => commitTarget(i)} className="h-7 w-7 grid place-items-center rounded-md bg-brand-grad text-white"><Icon name="Check" size={13} /></button>
                                  <button onClick={() => setEditTarget(null)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-slate-100"><Icon name="X" size={13} /></button>
                                </div>
                              ) : (
                                <button disabled={!ed} onClick={() => setEditTarget({ id: i.id, draft: ex.targetDate })} className={cn('group inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-h-8 max-w-[104px] py-1 px-1.5 -mx-1.5 rounded-md text-[12.5px] num', ed && 'hover:bg-slate-100', ex.targetDate < t && status === 'In Execution' && 'text-red-600 font-semibold')}>
                                  {fmtDate(ex.targetDate)}
                                  {slip !== 0 && <Tooltip content={`Original due date ${fmtDate(ex.originalTargetDate)} · ${ex.slippage.length} change${ex.slippage.length === 1 ? '' : 's'} logged`}><span className="text-[10.5px] font-bold text-red-600 bg-red-50 rounded px-1">{slip > 0 ? '+' : ''}{slip}d</span></Tooltip>}
                                  {ed && <Icon name="Pencil" size={11} className="opacity-0 group-hover:opacity-60" />}
                                </button>
                              )}
                            </td>
                            <td>
                              <button onClick={(e) => setPop({ kind: 'phasing', id: i.id, el: e.currentTarget })} className="flex items-center gap-2 h-9 px-1.5 -mx-1.5 rounded-md hover:bg-slate-100">
                                <span className="flex items-end gap-[3px] h-[22px]">
                                  {QS.map((qq) => <span key={qq} className="w-[8px] rounded-[2px]" style={{ height: `${pmax ? Math.max(10, (p[qq] / pmax) * 100) : 10}%`, background: p[qq] > 0 ? '#ec8a1c' : '#e2e8f0' }} />)}
                                </span>
                                <span className="text-left leading-tight"><span className="block text-[12px] font-semibold num">{inrShort(psum)}</span><span className="block text-[10px] text-muted whitespace-nowrap">Q1 Q2 Q3 Q4</span></span>
                                <Tooltip content={match ? 'Sum matches the system pre-fill (committedInFy)' : `Differs from system ${inrShort(sys)}`}><span className="h-2 w-2 rounded-full" style={{ background: match ? '#0f9f6e' : '#ec8a1c' }} /></Tooltip>
                              </button>
                            </td>
                            <td>
                              <button disabled={!ed} onClick={() => setModal({ kind: 'progress', id: i.id })} className={cn('w-[112px] text-left rounded-md p-1 -m-1', ed && 'hover:bg-slate-100')}>
                                <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-muted">{ex.milestones.filter((m) => m.doneDate).length}/{ex.milestones.length} milestones</span><b className="num">{ex.progress}%</b></div>
                                <ProgressBar value={ex.progress} color={hcol} height={5} />
                              </button>
                            </td>
                            <td>{status === 'In Execution' ? <HealthBadge health={health} /> : status === 'Done' ? <Badge color="#0f9f6e" icon="CircleCheck">Done</Badge> : <Badge color="#6b7280" icon="Ban">Dropped</Badge>}</td>
                            <td className="max-[1700px]:hidden">
                              {status === 'In Execution' ? (
                                <div className="leading-tight"><div className={cn('text-[12.5px] font-semibold num', nr.cadence === 'Due date passed' && 'text-red-600')}>{fmtDateShort(nr.date)}</div><div className="text-[10.5px] text-muted">{nr.cadence}</div></div>
                              ) : <span className="text-muted text-[12px]">—</span>}
                            </td>
                            <td>
                              <button onClick={(e) => setPop({ kind: 'linked', id: i.id, el: e.currentTarget })} className="flex flex-col gap-0.5 items-start rounded-md p-1 -m-1 hover:bg-slate-100">
                                <LinkChip label="NPD" status={i.npdRequestId ? i.npdStatus : undefined} color={npdColor(i.npdRequestId ? i.npdStatus : undefined)} />
                                <LinkChip label="PAP" status={i.papStatus} color={papColor(i.papStatus)} />
                              </button>
                            </td>
                            <td style={{ textAlign: 'right' }} className="num">
                              {status === 'Dropped' ? <span className="text-muted line-through">{inrShort(removedCommitted(i, fy))}</span> : <b className="text-[13px]">{inrShort(ideaCommitted(i, fy))}</b>}
                            </td>
                            <td><button onClick={(e) => setPop({ kind: 'menu', id: i.id, el: e.currentTarget })} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-slate-100"><Icon name="Ellipsis" size={16} /></button></td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={14} className="!h-auto !p-0 bg-slate-50/80 !whitespace-normal">
                                <div className="sticky left-0" style={{ width: boxW || undefined }}>
                                  <Expanded idea={i} editable={ed} onToggle={(mid) => toggleMs(i, mid)} onNote={(mid) => setModal({ kind: 'note', id: i.id, milestoneId: mid })} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  {list.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td /><td colSpan={2} className="text-[12px] text-muted">Total · {list.length} idea{list.length === 1 ? '' : 's'}</td><td className="max-[1700px]:hidden" /><td /><td className="max-[1700px]:hidden" /><td />
                        <td className="num text-[12.5px]">{inrShort(sum(list.map((i) => { const p = i.execution!.phasing; return p.Q1 + p.Q2 + p.Q3 + p.Q4 })))}</td>
                        <td /><td /><td className="max-[1700px]:hidden" /><td />
                        <td style={{ textAlign: 'right' }} className="num text-[13px]">{inrShort(cm(list))}</td><td />
                      </tr>
                    </tfoot>
                  )}
                </table>
                {!list.length && (
                  <EmptyState icon={kpi === 'done' ? 'PartyPopper' : 'Rocket'}
                    title={kpi === 'all' ? 'No approved ideas in execution yet' : kpi === 'done' ? `Nothing marked Done in ${monthLong(ym)} yet` : kpi === 'dropped' ? `No drops in ${monthLong(ym)}` : 'No ideas in this view'}
                    desc={kpi === 'all' ? 'Every approved idea enters the Execution Hub with an owner, a start date and a due date of 31 March.' : 'Clear the KPI filter to see every idea in execution.'}
                    action={kpi === 'all' ? <Button size="sm" icon="Table2" onClick={() => nav('/ideas?stage=Approval')}>Open ideas in approval</Button> : <Button size="sm" onClick={() => setKpi('all')}>Show all in execution</Button>} />
                )}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <RecentClosures hub={hub} fy={fy} className="xl:col-span-7" />
            <SlippageLog hub={hub} className="xl:col-span-5" />
          </div>
        </>
      )}

      {/* Popovers */}
      <Popover open={pop?.kind === 'phasing' && !!pIdea} onClose={() => setPop(null)} anchor={pop?.el ?? null} width={320}>
        {pIdea && pop?.kind === 'phasing' && <PhasingEditor idea={pIdea} fy={fy} canEdit={editable(pIdea)} onClose={() => setPop(null)} />}
      </Popover>
      <Popover open={pop?.kind === 'linked' && !!pIdea} onClose={() => setPop(null)} anchor={pop?.el ?? null} width={300}>
        {pIdea && pop?.kind === 'linked' && <LinkedEditor idea={pIdea} canEdit={editable(pIdea)} onClose={() => setPop(null)} />}
      </Popover>
      <Popover open={pop?.kind === 'menu' && !!pIdea} onClose={() => setPop(null)} anchor={pop?.el ?? null} width={230} align="right">
        {pIdea && pop?.kind === 'menu' && (
          <div className="p-1.5">
            <div className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted truncate">{pIdea.id}</div>
            <MenuItem icon="Activity" disabled={!editable(pIdea)} onClick={() => { setPop(null); setModal({ kind: 'progress', id: pIdea.id }) }}>Update progress</MenuItem>
            <MenuItem icon="StickyNote" disabled={!editable(pIdea)} onClick={() => { setPop(null); setModal({ kind: 'note', id: pIdea.id }) }}>Add milestone note</MenuItem>
            <MenuItem icon="CircleCheck" disabled={!editable(pIdea)} onClick={() => { setPop(null); setModal({ kind: 'done', id: pIdea.id }) }}>Mark Done</MenuItem>
            <MenuItem icon="UserRoundCog" disabled={!editable(pIdea) || !canReassign} hint={!canReassign ? 'Reassignable by Commodity Lead' : undefined} onClick={() => { setPop(null); setModal({ kind: 'reassign', id: pIdea.id }) }}>Reassign{!canReassign && <span className="text-[10.5px] text-muted ml-1">(Lead)</span>}</MenuItem>
            <div className="h-px bg-line my-1" />
            <MenuItem icon="Ban" danger disabled={!editable(pIdea)} onClick={() => { setPop(null); setModal({ kind: 'drop', id: pIdea.id }) }}>Drop</MenuItem>
            <div className="h-px bg-line my-1" />
            <MenuItem icon="ExternalLink" onClick={() => { setPop(null); nav('/ideas/' + pIdea.id) }}>Open idea page</MenuItem>
          </div>
        )}
      </Popover>

      {/* Modals */}
      <ProgressModal idea={mIdea} open={modal?.kind === 'progress'} onClose={() => setModal(null)} />
      <MilestoneNoteModal idea={mIdea} open={modal?.kind === 'note'} milestoneId={modal?.milestoneId} onClose={() => setModal(null)} />
      <MarkDoneModal idea={mIdea} open={modal?.kind === 'done'} fy={fy} onClose={() => setModal(null)} />
      <DropModal idea={mIdea} open={modal?.kind === 'drop'} fy={fy} onClose={() => setModal(null)} />
      <TargetDateModal idea={mIdea} newDate={modal?.date ?? ''} open={modal?.kind === 'target'} fy={fy} onClose={() => setModal(null)} />
      <ReassignModal open={modal?.kind === 'reassign'} onClose={() => setModal(null)} title={`Reassign ${mIdea?.id ?? ''}`} subtitle="Idea owner — Commodity Buyer by default; reassignable by Commodity Lead"
        candidates={ownerOptions} currentId={mIdea?.execution?.ownerId} defaultTo={modal?.to}
        onConfirm={(uid, r) => { if (!mIdea) return; const undo = snapshot([mIdea.id]); useStore.getState().reassign(mIdea.id, uid, r); toast(`${mIdea.id} reassigned to ${users.find((u) => u.id === uid)?.name}`, 'info', undo) }} />
    </div>
  )
}

function LinkChip({ label, status, color }: { label: string; status?: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[10.5px] font-semibold whitespace-nowrap" style={{ color, background: `${color}14` }}>
      <span className="font-bold">{label}</span><span className="opacity-90">{status && status !== 'Not raised' ? status : label === 'NPD' && !status ? 'n/a' : 'Not raised'}</span>
    </span>
  )
}

function Expanded({ idea, editable, onToggle, onNote }: { idea: Idea; editable: boolean; onToggle: (mid: string) => void; onNote: (mid: string) => void }) {
  const ex = idea.execution!
  const [text, setText] = useState('')
  const t = todayIso()
  const add = () => { if (!text.trim()) return; const undo = snapshot([idea.id]); useStore.getState().addExecutionNote(idea.id, text.trim()); setText(''); toast('Note added', 'success', undo) }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
      <div className="card p-3">
        <MiniHead icon="ListChecks" right={<span className="text-[11px] text-muted">generated from the {idea.route} route</span>}>Milestones</MiniHead>
        <div className="grid grid-cols-1 gap-1">
          {ex.milestones.map((m) => {
            const overdue = !m.doneDate && m.dueDate < t
            return (
              <div key={m.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 group">
                <button disabled={!editable} onClick={() => onToggle(m.id)} className={cn('mt-0.5 h-[18px] w-[18px] rounded-md border-2 grid place-items-center shrink-0 transition-colors', m.doneDate ? 'bg-emerald-600 border-emerald-600 text-white' : overdue ? 'border-red-400' : 'border-slate-300', editable && !m.doneDate && 'hover:border-emerald-500')} title={editable ? (m.doneDate ? 'Reopen milestone' : 'Mark milestone done') : undefined}>
                  {m.doneDate && <Icon name="Check" size={11} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-[12.5px] font-medium', m.doneDate ? 'text-muted line-through decoration-slate-300' : 'text-ink')}>{m.name}</div>
                  <div className={cn('text-[11px] num', overdue ? 'text-red-600 font-semibold' : 'text-muted')}>{m.doneDate ? `Done ${fmtDate(m.doneDate)} · due ${fmtDate(m.dueDate)}` : `${overdue ? 'Overdue · ' : ''}Due ${fmtDate(m.dueDate)}`}</div>
                  {m.note && <div className="text-[11.5px] text-ink-2 mt-0.5">“{m.note}”</div>}
                </div>
                {editable && <button onClick={() => onNote(m.id)} className="opacity-0 group-hover:opacity-100 h-6 px-1.5 rounded text-[11px] font-semibold text-brand-700 hover:bg-brand-50 transition-opacity">Note</button>}
              </div>
            )
          })}
        </div>
      </div>
      <div className="card p-3 flex flex-col">
        <MiniHead icon="StickyNote" right={<span className="text-[11px] text-muted">{ex.notes.length}</span>}>Notes</MiniHead>
        <div className="grid gap-1.5 flex-1 content-start">
          {[...ex.notes].reverse().map((n, k) => (
            <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5"><div className="text-[12.5px] text-ink-2">{n.text}</div><div className="text-[10.5px] text-muted mt-0.5">{n.by} · {fmtDateTime(n.at)}</div></div>
          ))}
          {!ex.notes.length && <div className="text-[12px] text-muted">No notes yet — add the first update for this idea.</div>}
        </div>
        {editable && (
          <div className="flex gap-1.5 mt-2">
            <input className="input !h-8 text-[12.5px]" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a note…" />
            <Button size="sm" icon="Plus" disabled={!text.trim()} onClick={add}>Add</Button>
          </div>
        )}
      </div>
      <div className="card p-3">
        <MiniHead icon="CalendarX2" right={<span className="text-[11px] text-muted">{ex.slippage.length} change{ex.slippage.length === 1 ? '' : 's'}</span>}>Slippage log</MiniHead>
        <div className="grid gap-1.5">
          {[...ex.slippage].reverse().map((s, k) => (
            <div key={k} className="rounded-lg border border-red-100 bg-red-50/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[12px] num"><span><b>{fmtDate(s.oldDate)}</b> → <b>{fmtDate(s.newDate)}</b></span><span className="text-red-600 font-bold">+{daysBetween(s.oldDate, s.newDate)}d</span></div>
              <div className="text-[11.5px] text-ink-2">{s.reason}</div>
              <div className="text-[10.5px] text-muted">{s.by}{s.at <= new Date().toISOString() ? ` · ${fmtDateTime(s.at)}` : ''}</div>
            </div>
          ))}
          {!ex.slippage.length && <div className="text-[12px] text-muted">On the original due date — no slippage logged.</div>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
          <span className="text-muted">Original due date</span><b className="text-right num">{fmtDate(ex.originalTargetDate)}</b>
          <span className="text-muted">Annualised</span><b className="text-right num">{inrShort(ideaAnnualised(idea))}</b>
          <span className="text-muted">Approved on</span><b className="text-right num">{fmtDate(idea.approvedAt?.slice(0, 10))}</b>
          <span className="text-muted">Owner</span><span className="text-right"><UserChip userId={ex.ownerId} size={16} /></span>
        </div>
      </div>
    </div>
  )
}

function RecentClosures({ hub, fy, className }: { hub: Idea[]; fy: string; className?: string }) {
  const openIdea = useStore((s) => s.openIdea)
  const rows = hub.filter((i) => i.execution!.status !== 'In Execution')
    .map((i) => ({ i, at: (i.execution!.status === 'Done' ? i.implementedAt ?? i.execution!.effectiveDate : i.droppedAt) ?? '' }))
    .sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8)
  const done = hub.filter((i) => i.execution!.status === 'Done')
  const dropped = hub.filter((i) => i.execution!.status === 'Dropped')
  return (
    <Card title="Recently done / dropped" icon="History" className={className}
      subtitle={`${done.length} implemented · ${dropped.length} dropped from execution in ${fy}`}>
      <div className="grid grid-cols-1 gap-1">
        {rows.map(({ i, at }) => {
          const isDone = i.execution!.status === 'Done'
          return (
            <button key={i.id} onClick={() => openIdea(i.id)} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
              <span className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0', isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}><Icon name={isDone ? 'CircleCheck' : 'Ban'} size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-muted">{i.id}</span><span className="text-[11px] text-muted">· {fmtDate(at.slice(0, 10))}</span></div>
                <div className="text-[12.5px] font-semibold text-ink truncate">{i.title}</div>
                <div className="text-[11.5px] text-muted truncate">{isDone ? `Effective ${fmtDate(i.execution!.effectiveDate)} · approved price locked` : `${i.dropReason} · at ${i.dropStage ?? '—'} · counted in ${monthLong(ymOf(at))}`}</div>
              </div>
              <div className="text-right shrink-0">
                {isDone ? <><div className="text-[13px] font-bold num text-emerald-700">{inrShort(ideaApprovedAnnualised(i))}</div><div className="text-[10.5px] text-muted">annualised</div></>
                  : <><div className="text-[13px] font-bold num text-slate-500 line-through">{inrShort(removedCommitted(i, fy))}</div><div className="text-[10.5px] text-muted">committed removed</div></>}
              </div>
            </button>
          )
        })}
        {!rows.length && <EmptyState icon="History" title="No closures yet" desc="Ideas marked Done or Dropped from execution will appear here." className="py-6" />}
      </div>
    </Card>
  )
}

function SlippageLog({ hub, className }: { hub: Idea[]; className?: string }) {
  const openIdea = useStore((s) => s.openIdea)
  const rows = hub.flatMap((i) => i.execution!.slippage.map((s) => ({ i, ...s }))).sort((a, b) => (a.at < b.at ? 1 : -1))
  const slipped = new Set(rows.map((r) => r.i.id)).size
  const avg = rows.length ? Math.round(sum(rows.map((r) => daysBetween(r.oldDate, r.newDate))) / rows.length) : 0
  return (
    <Card title="Slippage log" icon="CalendarX2" className={className} subtitle={`${rows.length} due-date change${rows.length === 1 ? '' : 's'} · ${slipped} idea${slipped === 1 ? '' : 's'} · avg +${avg} days`}
      actions={<InfoTip title="Slippage">Due date — default 31 March of current FY; editable, each change needs a reason and is logged as slippage.</InfoTip>}>
      <div className="grid grid-cols-1 gap-1">
        {rows.slice(0, 30).map((r, k) => (
          <button key={k} onClick={() => openIdea(r.i.id)} className="text-left rounded-lg px-2 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted">{r.i.id}</span>
              <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded px-1.5 num">+{daysBetween(r.oldDate, r.newDate)} days</span>
            </div>
            <div className="text-[12px] text-ink num"><b>{fmtDate(r.oldDate)}</b> → <b>{fmtDate(r.newDate)}</b></div>
            <div className="text-[11.5px] text-ink-2 truncate">“{r.reason}”</div>
            <div className="text-[10.5px] text-muted">{r.by}{r.at <= new Date().toISOString() ? ` · ${fmtDateTime(r.at)}` : ''}</div>
          </button>
        ))}
        {!rows.length && <EmptyState icon="CalendarCheck" title="No slippage" desc="Every idea in execution is on its original due date." className="py-6" />}
      </div>
    </Card>
  )
}
