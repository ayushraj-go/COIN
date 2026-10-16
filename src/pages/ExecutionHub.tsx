// M8 — Execution Hub · TRACE (stages 5–6 in Cost Optimisation), in four tabs:
// Execution (owner, locked deadline, milestones, plan vs actual, NPD / PAP, drop) · Monthly MRN tracking (forecast vs MRN
// actual, month by month) · Savings proof (PROOF, part-wise) · Verification (locked target vs MRN actual).
// Nobody hands over by hand: on the deadline signed at department approval COIN moves the idea to verification.
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
import { DropModal, LinkedEditor, MilestoneNoteModal, PhasingEditor, ProgressModal, npdColor, papColor } from './exec/ExecModals'
import { ExecTimeline, TimelineLegend } from './exec/Timeline'
import { PlanVsActualBlock, useIdeaPlan } from './idea/PlanVsActual'
import { execRights, ownerCandidates } from './idea/model'
import { MrnFeedBanner, MrnTracking, UpcomingDeadlines, VerificationList, track } from './exec/Tabs'
import Proof from './Proof'

type Kpi = 'all' | 'due' | 'nomrn' | 'risk' | 'done' | 'dropped'
type ModalState = { kind: 'progress' | 'note' | 'drop' | 'reassign'; id: string; date?: string; to?: string; milestoneId?: string } | null
type Tab = 'execution' | 'mrn' | 'proof' | 'verification'
/** set by the MRN feed — never ticked by hand */
const AUTO_MILESTONES = ['First MRN at new price', 'Handed for verification']
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
  const [params, setParams] = useSearchParams()
  const tab = (['mrn', 'proof', 'verification'].includes(params.get('tab') ?? '') ? params.get('tab') : 'execution') as Tab
  const setTab = (k: Tab) => setParams((p) => { const n = new URLSearchParams(p); if (k === 'execution') n.delete('tab'); else n.set('tab', k); return n }, { replace: true })
  const [q, setQ] = useState(params.get('q') ?? '')
  const [owner, setOwner] = useState('All')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState>(null)
  const [pop, setPop] = useState<PopState>(null)
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
  const lastMrn = settings.lastRealisationMonth
  const tracks = useMemo(() => new Map(active.filter((i) => i.lock).map((i) => [i.id, track(i, ledger, lastMrn)])), [active, ledger, lastMrn])
  const sets = useMemo(() => ({
    all: active,
    // the locked deadline falls this month — COIN moves these to verification on that date
    due: active.filter((i) => ymOf(i.execution!.targetDate) === ym && i.execution!.targetDate >= t),
    nomrn: active.filter((i) => tracks.get(i.id)?.status === 'No MRN yet'),
    risk: active.filter((i) => tracks.get(i.id)?.status === 'Behind plan' || healthOf(i) === 'At risk'),
    done: hub.filter((i) => i.execution!.status === 'Done' && ymOf(i.verification?.handedAt ?? i.implementedAt ?? '') === ym),
    dropped: hub.filter((i) => i.execution!.status === 'Dropped' && ymOf(i.droppedAt ?? '') === ym),
  }), [active, hub, ym, t, tracks])
  const cm = (list: Idea[]) => sum(list.map((i) => ideaCommitted(i, fy)))
  const committedHard = sum(active.filter(isHard).map((i) => ideaCommitted(i, fy)))

  // owner filter: everyone who owns an execution here (department execution owners, Sourcing buyers, reassigned owners)
  const ownerOptions = useMemo(() => { const ids = new Set(hub.map((i) => i.execution?.ownerId).filter(Boolean)); return users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name)) }, [users, hub])
  const awaiting = useMemo(() => hub.filter((i) => i.stage === 'Verification' && !i.verification?.verifiedAt), [hub])
  const verified = useMemo(() => hub.filter((i) => !!i.verification?.verifiedAt), [hub])
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
  // rights come from the department ladder: the execution owner edits, the department head reassigns, Sourcing Head / Admin override
  const canReassignIdea = (i: Idea) => execRights(me, i).canReassign
  const editable = (i: Idea) => i.execution?.status === 'In Execution' && execRights(me, i).editable
  const byId = (id?: string) => ideas.find((i) => i.id === id) ?? null
  const mIdea = byId(modal?.id)
  const pIdea = byId(pop?.id)

  const toggleMs = (i: Idea, mid: string) => {
    const m = i.execution!.milestones.find((x) => x.id === mid)!
    // the first MRN and the move to verification come from the MRN feed and the locked deadline
    if (AUTO_MILESTONES.includes(m.name)) return
    const undo = snapshot([i.id])
    useStore.getState().toggleMilestone(i.id, mid)
    toast(m.doneDate ? `Milestone reopened: ${m.name}` : `Milestone done: ${m.name}`, 'success', undo)
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
    { k: 'all', label: 'In execution', value: active.length, sub: <>{inrShort(committedHard)} committed</>, icon: 'Rocket', color: 'var(--color-orange-400)', tip: 'Approved ideas with an owner and dates, until marked Done or Dropped. ₹ committed counts hard savings only; cost avoidance and one-time savings are reported separately.', formula: 'Σ FY-phased saving of ideas In Execution' },
    { k: 'due', label: 'Deadline this month', value: sets.due.length, sub: <>{inrShort(cm(sets.due))} · {monthLabel(ym)}</>, icon: 'CalendarClock', color: 'var(--color-brand-500)', tip: 'The locked timeline ends this month — on that date COIN moves the idea to verification.' },
    { k: 'nomrn', label: 'No MRN yet', value: sets.nomrn.length, sub: <>{inrShort(cm(sets.nomrn))} committed</>, icon: 'PackageX', color: 'var(--color-rose-600)', tip: 'The savings start in the lock has passed but no MRN at the new price has been received — nothing is claimed until MRN arrives.' },
    { k: 'risk', label: 'Behind plan / at risk', value: sets.risk.length, sub: <>{inrShort(cm(sets.risk))} at risk</>, icon: 'TriangleAlert', color: 'var(--color-orange-400)', tip: 'MRN actual below 90 % of the monthly forecast to date, or a milestone past its due date.' },
    { k: 'done', label: 'Moved to verification', value: sets.done.length, sub: <>this month · {awaiting.length} awaiting verification</>, icon: 'ShieldQuestion', color: 'var(--color-emerald-600)', tip: 'Ideas whose locked timeline ended this month — COIN moved them to verification with the forecast and the MRN actual.' },
    { k: 'dropped', label: 'Dropped this month', value: sets.dropped.length, sub: <>{inrShort(sum(sets.dropped.map((i) => removedCommitted(i, fy))))} removed</>, icon: 'Ban', color: 'var(--color-gray-500)', tip: 'Drop needs a reason code and remarks; the committed value is removed from committed savings and the drop is counted in its month.' },
  ]

  return (
    <div>
      <PageHeader icon="Rocket" title="Execution Hub" badge={<Badge color="var(--color-brand-700)">TRACE</Badge>}
        subtitle="Transition-linked Realisation of Actual CI Evidence — Execution started → Verification, with plan vs actual from MRN"
        actions={<>
          <Tooltip content={<div className="grid gap-1"><div>{dueWording(EXECUTION_INTRO)}</div>{EXECUTION_RECORD.map(([k, v]) => <div key={k}><b>{dueWording(k)}:</b> {dueWording(v)}</div>)}</div>}><span className="inline-flex items-center gap-1 text-[12px] text-muted cursor-help"><Icon name="Info" size={13} />Execution record rules</span></Tooltip>
          <Button icon="FileSpreadsheet" onClick={doExport}>Export</Button>
        </>} />
      <FilterBar compact className="mb-4" />
      <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Execution Hub">
        {([
          ['execution', 'Execution', 'Rocket', active.length],
          ['mrn', 'Monthly MRN tracking', 'ChartColumnBig', tracks.size],
          ['proof', 'Savings proof', 'BadgeIndianRupee', null],
          ['verification', 'Verification', 'ShieldCheck', awaiting.length],
        ] as [Tab, string, string, number | null][]).map(([k, label, icon, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('h-10 pl-3 pr-3.5 rounded-xl border text-[13px] font-semibold inline-flex items-center gap-2 transition-colors', tab === k ? 'bg-brand-600 border-brand-600 text-white shadow-[0_8px_18px_-10px_color-mix(in_srgb,var(--color-brand-700)_80%,transparent)]' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>
            <Icon name={icon} size={15} />{label}{n != null && <span className={cn('min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center num', tab === k ? 'bg-white/20' : 'bg-slate-100 text-ink-2')}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'mrn' ? <MrnTracking ideas={hub} />
        : tab === 'proof' ? <Proof embedded />
          : tab === 'verification' ? <VerificationList ideas={hub} />
            : !ready ? (
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

          <MrnFeedBanner className="mb-3" />
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
                      <th>ID</th><th>Title</th><th className="max-[1700px]:hidden">Commodity</th><th>Owner</th><th className="max-[1700px]:hidden">Start date</th><th><span className="inline-flex items-center gap-1">Deadline<InfoTip title="Deadline">The savings end signed in the budget + timeline lock at department approval. It does not move during execution; on that date COIN moves the idea to verification.</InfoTip></span></th>
                      <th><span className="inline-flex items-center gap-1">Quarter phasing Q1–Q4<InfoTip title="Quarter phasing" formula="Σ Q1..Q4 vs committedInFy(forecast, due date)">Pre-filled from due date and forecast impact; click to edit. Green dot = matches the system pre-fill.</InfoTip></span></th>
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
                      const hcol = status === 'Done' ? 'var(--color-emerald-600)' : status === 'Dropped' ? 'var(--color-gray-500)' : HEALTH_STYLE[health].color
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
                              {canReassignIdea(i) && ed ? (
                                <select className="h-8 max-w-[170px] rounded-lg border border-line bg-white px-2 text-[12.5px] font-medium hover:border-slate-300 focus:outline-none focus:border-brand-400" value={ex.ownerId} onChange={(e) => setModal({ kind: 'reassign', id: i.id, to: e.target.value })}>
                                  {ownerCandidates(i, users).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              ) : <UserChip userId={ex.ownerId} />}
                            </td>
                            <td className="max-[1700px]:hidden num text-[12.5px]">{fmtDate(ex.startDate)}</td>
                            <td>
                              <Tooltip content={`Locked at department approval · moves to verification on ${fmtDate(ex.targetDate)}`}>
                                <span className="inline-flex items-center gap-1 text-[12.5px] num whitespace-nowrap"><Icon name="Lock" size={11} className="text-muted" />{fmtDate(ex.targetDate)}</span>
                              </Tooltip>
                              <div className="text-[10.5px] text-muted">{daysBetween(t, ex.targetDate) > 0 ? `in ${daysBetween(t, ex.targetDate)} days` : 'today'}</div>
                            </td>
                            <td>
                              <button onClick={(e) => setPop({ kind: 'phasing', id: i.id, el: e.currentTarget })} className="flex items-center gap-2 h-9 px-1.5 -mx-1.5 rounded-md hover:bg-slate-100">
                                <span className="flex items-end gap-[3px] h-[22px]">
                                  {QS.map((qq) => <span key={qq} className="w-[8px] rounded-[2px]" style={{ height: `${pmax ? Math.max(10, (p[qq] / pmax) * 100) : 10}%`, background: p[qq] > 0 ? 'var(--color-orange-400)' : 'var(--color-slate-200)' }} />)}
                                </span>
                                <span className="text-left leading-tight"><span className="block text-[12px] font-semibold num">{inrShort(psum)}</span><span className="block text-[10px] text-muted whitespace-nowrap">Q1 Q2 Q3 Q4</span></span>
                                <Tooltip content={match ? 'Sum matches the system pre-fill (committedInFy)' : `Differs from system ${inrShort(sys)}`}><span className="h-2 w-2 rounded-full" style={{ background: match ? 'var(--color-emerald-600)' : 'var(--color-orange-400)' }} /></Tooltip>
                              </button>
                            </td>
                            <td>
                              <button disabled={!ed} onClick={() => setModal({ kind: 'progress', id: i.id })} className={cn('w-[112px] text-left rounded-md p-1 -m-1', ed && 'hover:bg-slate-100')}>
                                <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-muted">{ex.milestones.filter((m) => m.doneDate).length}/{ex.milestones.length} milestones</span><b className="num">{ex.progress}%</b></div>
                                <ProgressBar value={ex.progress} color={hcol} height={5} />
                              </button>
                            </td>
                            <td>{status === 'In Execution' ? (tracks.get(i.id) && tracks.get(i.id)!.status !== 'On plan' && tracks.get(i.id)!.status !== 'Not started' ? <Badge color={tracks.get(i.id)!.status === 'No MRN yet' ? 'var(--color-rose-600)' : 'var(--color-orange-400)'}>{tracks.get(i.id)!.status}</Badge> : <HealthBadge health={health} />) : status === 'Done' ? <Badge color="var(--color-emerald-600)" icon="ShieldCheck">In verification</Badge> : <Badge color="var(--color-gray-500)" icon="Ban">Dropped</Badge>}</td>
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
                    title={kpi === 'all' ? 'No approved ideas in execution yet' : kpi === 'done' ? `Nothing moved to verification in ${monthLong(ym)} yet` : kpi === 'dropped' ? `No drops in ${monthLong(ym)}` : 'No ideas in this view'}
                    desc={kpi === 'all' ? 'Every approved idea enters the Execution Hub with an owner and the deadline signed in its lock.' : 'Clear the KPI filter to see every idea in execution.'}
                    action={kpi === 'all' ? <Button size="sm" icon="Table2" onClick={() => nav('/ideas?stage=approval')}>Open ideas in sourcing approval</Button> : <Button size="sm" onClick={() => setKpi('all')}>Show all in execution</Button>} />
                )}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <RecentClosures hub={hub} fy={fy} className="xl:col-span-7" />
            <UpcomingDeadlines hub={hub} className="xl:col-span-5" />
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
            <MenuItem icon="UserRoundCog" disabled={!canReassignIdea(pIdea)} hint={!canReassignIdea(pIdea) ? 'Reassignable by the department head' : undefined} onClick={() => { setPop(null); setModal({ kind: 'reassign', id: pIdea.id }) }}>Reassign{!canReassignIdea(pIdea) && <span className="text-[10.5px] text-muted ml-1">(Dept head)</span>}</MenuItem>
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
      <DropModal idea={mIdea} open={modal?.kind === 'drop'} fy={fy} onClose={() => setModal(null)} />
      <ReassignModal open={modal?.kind === 'reassign'} onClose={() => setModal(null)} title={`Reassign ${mIdea?.id ?? ''}`} subtitle="Idea owner — Commodity Buyer by default; reassignable by Commodity Lead"
        candidates={mIdea ? ownerCandidates(mIdea, users) : []} currentId={mIdea?.execution?.ownerId} defaultTo={modal?.to}
        onConfirm={(uid, r) => { if (!mIdea) return; const undo = snapshot([mIdea.id]); useStore.getState().reassign(mIdea.id, uid, r); toast(`${mIdea.id} reassigned to ${users.find((u) => u.id === uid)?.name}`, 'info', undo) }} />
    </div>
  )
}

function LinkChip({ label, status, color }: { label: string; status?: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[10.5px] font-semibold whitespace-nowrap" style={{ color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
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
      <PlanCard idea={idea} />
      <CoCard idea={idea} editable={editable} />
      <div className="card p-3">
        <MiniHead icon="ListChecks" right={<span className="text-[11px] text-muted">generated from the {idea.route} route</span>}>Milestones</MiniHead>
        <div className="grid grid-cols-1 gap-1">
          {ex.milestones.map((m) => {
            const overdue = !m.doneDate && m.dueDate < t
            return (
              <div key={m.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 group">
                <button disabled={!editable || AUTO_MILESTONES.includes(m.name)} onClick={() => onToggle(m.id)} className={cn('mt-0.5 h-[18px] w-[18px] rounded-md border-2 grid place-items-center shrink-0 transition-colors', m.doneDate ? 'bg-emerald-600 border-emerald-600 text-white' : overdue ? 'border-red-400' : 'border-slate-300', editable && !m.doneDate && 'hover:border-emerald-500')} title={editable ? (m.doneDate ? 'Reopen milestone' : 'Mark milestone done') : undefined}>
                  {m.doneDate && <Icon name="Check" size={11} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-[12.5px] font-medium', m.doneDate ? 'text-muted line-through decoration-slate-300' : 'text-ink')}>{m.name}{AUTO_MILESTONES.includes(m.name) && <span className="ml-1.5 text-[10px] font-semibold text-teal-700 bg-teal-50 rounded px-1 no-underline inline-block">{m.name === 'Handed for verification' ? 'on the deadline' : 'from MRN'}</span>}</div>
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
          <span className="text-muted">Forecast</span><b className="text-right num">{inrShort(ideaAnnualised(idea))}</b>
          <span className="text-muted">Approved on</span><b className="text-right num">{fmtDate(idea.approvedAt?.slice(0, 10))}</b>
          <span className="text-muted">Owner</span><span className="text-right"><UserChip userId={ex.ownerId} size={16} /></span>
        </div>
      </div>
    </div>
  )
}

/** Plan vs actual for the locked target (stage 4 lock) — MRN-based actuals */
function PlanCard({ idea }: { idea: Idea }) {
  const p = useIdeaPlan(idea)
  return (
    <div className="card p-3 lg:col-span-2">
      <MiniHead icon="ChartLine" right={<span className="text-[11px] text-muted">{idea.lock ? `${idea.lock.timelineMonths} months from ${fmtDate(idea.lock.startDate)}` : 'No lock'}</span>}>Plan vs actual</MiniHead>
      {p ? <PlanVsActualBlock p={p} compact /> : <div className="text-[12px] text-muted">The budget + timeline lock is signed at the department approval.</div>}
    </div>
  )
}

/** CO date, MRN link and NPD / PAP status */
function CoCard({ idea, editable }: { idea: Idea; editable: boolean }) {
  const [co, setCo] = useState(idea.coDate ?? '')
  useEffect(() => setCo(idea.coDate ?? ''), [idea.coDate])
  const save = (v: string) => { if (!v || v === idea.coDate) return; const undo = snapshot([idea.id]); useStore.getState().updateIdea(idea.id, { coDate: v }, 'Change-over (CO) date set', `CO date ${v}`); toast(`CO date set to ${fmtDate(v)}`, 'success', undo) }
  const first = idea.execution?.milestones.find((m) => m.name === 'First MRN at new price')
  return (
    <div className="card p-3 flex flex-col gap-2">
      <MiniHead icon="Workflow">Change-over & MRN</MiniHead>
      <label className="grid gap-1 text-[12px]"><span className="text-muted">CO date (new price / part cuts in)</span>
        <input type="date" disabled={!editable} className="input !h-8 text-[12.5px]" value={co} onChange={(e) => setCo(e.target.value)} onBlur={(e) => save(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <span className="text-muted">First MRN at new price</span><b className="text-right num">{first?.doneDate ? fmtDate(first.doneDate) : 'awaiting MRN'}</b>
        <span className="text-muted">NPD</span><b className="text-right">{idea.npdRequestId ? `${idea.npdRequestId} · ${idea.npdStatus}` : 'n/a'}</b>
        <span className="text-muted">PAP</span><b className="text-right">{idea.papRequestId ? `${idea.papRequestId} · ${idea.papStatus}` : 'n/a'}</b>
      </div>
      <div className="mt-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[11.5px] text-muted flex items-start gap-1.5">
        <Icon name="Link2" size={13} className="shrink-0 mt-px" /><span><b className="text-ink-2">MRN feed</b> — read from the ERP every month; the first MRN at the new price and every saving come from MRN transactions only.</span>
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
    <Card title="Recently moved to verification / dropped" icon="History" className={className}
      subtitle={`${done.length} moved to verification on their locked deadline · ${dropped.length} dropped from execution in ${fy}`}>
      <div className="grid grid-cols-1 gap-1">
        {rows.map(({ i, at }) => {
          const isDone = i.execution!.status === 'Done'
          return (
            <button key={i.id} onClick={() => openIdea(i.id)} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
              <span className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0', isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}><Icon name={isDone ? 'CircleCheck' : 'Ban'} size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-muted">{i.id}</span><span className="text-[11px] text-muted">· {fmtDate(at.slice(0, 10))}</span></div>
                <div className="text-[12.5px] font-semibold text-ink truncate">{i.title}</div>
                <div className="text-[11.5px] text-muted truncate">{isDone ? `Target ${inrShort(i.lock?.targetSaving ?? 0)} · MRN actual ${inrShort(i.verification?.actualAtClose ?? 0)} · ${i.verification?.verifiedAt ? `verified ${fmtDate(i.verification.verifiedAt.slice(0, 10))}` : 'awaiting verification'}` : `${i.dropReason} · at ${i.dropStage ?? '—'} · counted in ${monthLong(ymOf(at))}`}</div>
              </div>
              <div className="text-right shrink-0">
                {isDone ? <><div className="text-[13px] font-bold num text-emerald-700">{inrShort(ideaApprovedAnnualised(i))}</div><div className="text-[10.5px] text-muted">forecast</div></>
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
