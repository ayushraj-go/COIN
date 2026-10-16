// Execution Hub tabs beside the execution table:
// · Monthly MRN tracking — every live execution, month by month: the locked target's monthly forecast against the saving
//   actually found in MRN transactions (no MRN, no saving). The feed posts each completed month automatically.
// · Verification — ideas COIN moved to verification when their locked timeline ended: locked target vs MRN actual.
// · Upcoming deadlines — executions whose locked timeline ends soon (they move to verification by themselves).
import React, { useMemo, useState } from 'react'
import type { Idea, LedgerEntry } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { inLockWindow, planVsActual } from '../../lib/workflow'
import { addDays, addMonthsYm, daysBetween, fmtDate, inrShort, monthLong, num, pct, sum, todayIso } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Icon, InfoTip, ProgressBar, Segmented, UserChip, cn } from '../../components/ui'
import { VerificationModal } from '../idea/StageForms'
import { ideaPerms } from '../idea/model'

type Track = ReturnType<typeof track>
/** MRN actual ÷ forecast to date at or above this is "On plan" */
export const ON_PLAN = 0.9
/** Plan vs MRN actual for one locked execution */
export function track(i: Idea, ledger: LedgerEntry[], last: string) {
  const lock = i.lock!
  const rows = ledger.filter((l) => l.ideaId === i.id && inLockWindow(lock, l.month))
  const p = planVsActual({ target: lock.targetSaving, months: lock.timelineMonths, startDate: lock.startDate, ledger: rows, lastActualMonth: last })
  const achievement = p.planToDate ? (p.actualToDate / p.planToDate) * 100 : null
  const started = lock.startDate <= todayIso()
  // on plan = MRN actual at least 90 % of the monthly forecast to date
  const status: 'Not started' | 'No MRN yet' | 'On plan' | 'Behind plan' = !started || p.elapsed === 0 ? 'Not started' : p.actualToDate <= 0 ? 'No MRN yet' : p.actualToDate >= p.planToDate * ON_PLAN ? 'On plan' : 'Behind plan'
  return { i, lock, rows, p, achievement, status, daysLeft: daysBetween(todayIso(), lock.endDate) }
}
const STATUS_COLOR: Record<Track['status'], string> = { 'Not started': 'var(--color-slate-500)', 'No MRN yet': 'var(--color-rose-600)', 'On plan': 'var(--color-emerald-600)', 'Behind plan': 'var(--color-orange-400)' }

/** MRN feed status line — the portal reads MRN from the ERP every month; savings count only from MRN transactions */
export function MrnFeedBanner({ className }: { className?: string }) {
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const next = addDays(`${addMonthsYm(last, 2)}-01`, 4)
  return (
    <div className={cn('rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white px-4 py-3 flex flex-wrap items-center gap-3', className)}>
      <span className="h-10 w-10 rounded-xl grid place-items-center bg-co-grad text-white shrink-0"><Icon name="DatabaseZap" size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-ink">MRN feed from the ERP · posted up to {monthLong(last)}</div>
        <div className="text-[12px] text-muted">Each completed month is read automatically (next: {monthLong(addMonthsYm(last, 1))}, on {fmtDate(next)}). Saving = (baseline − approved price) × MRN quantity — only MRN transactions count; no MRN, no saving.</div>
      </div>
      <Badge color="var(--color-teal-700)" icon="RefreshCw">Automatic, monthly</Badge>
    </div>
  )
}

export function MrnTracking({ ideas }: { ideas: Idea[] }) {
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const openIdea = useStore((s) => s.openIdea)
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Track['status']>('all')
  const all = useMemo(() => ideas.filter((i) => i.stage === 'Execution started' && i.lock).map((i) => track(i, ledger, last)).sort((a, b) => a.lock.endDate.localeCompare(b.lock.endDate)), [ideas, ledger, last])
  const list = filter === 'all' ? all : all.filter((t) => t.status === filter)
  const plan = sum(all.map((t) => t.p.planToDate)), actual = sum(all.map((t) => t.p.actualToDate))
  const count = (s: Track['status']) => all.filter((t) => t.status === s).length
  return (
    <div className="grid gap-3">
      <MrnFeedBanner />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Executions tracked" value={String(all.length)} sub="with a signed timeline" />
        <Stat label="Forecast to date" value={inrShort(plan)} sub="locked target spread by month" />
        <Stat label="MRN actual to date" value={inrShort(actual)} sub="from MRN transactions only" tone={actual >= plan * ON_PLAN ? 'good' : 'bad'} />
        <Stat label="Achievement" value={plan ? pct((actual / plan) * 100, 0) : '—'} sub="MRN actual ÷ forecast to date" tone={actual >= plan * ON_PLAN ? 'good' : 'bad'} />
        <Stat label="Behind plan" value={String(count('Behind plan'))} sub="below 90 % of the forecast to date" tone={count('Behind plan') ? 'bad' : undefined} />
        <Stat label="No MRN yet" value={String(count('No MRN yet'))} sub="savings start passed, no MRN at the new price" tone={count('No MRN yet') ? 'bad' : undefined} />
      </div>
      <Card pad={false} title="Monthly forecast vs MRN actual" icon="ChartColumnBig" subtitle="Open a row for the month-by-month view · the idea moves to verification by itself when its timeline ends"
        actions={<Segmented size="sm" value={filter} onChange={(k) => setFilter(k as typeof filter)} options={[{ key: 'all', label: `All (${all.length})` }, { key: 'On plan', label: `On plan (${count('On plan')})` }, { key: 'Behind plan', label: `Behind (${count('Behind plan')})` }, { key: 'No MRN yet', label: `No MRN (${count('No MRN yet')})` }, { key: 'Not started', label: `Not started (${count('Not started')})` }]} />}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 34 }} /><th>Idea</th><th>Owner</th><th>Locked timeline</th><th style={{ textAlign: 'right' }}>Locked target</th><th>Months</th>
              <th style={{ textAlign: 'right' }}>Forecast to date</th><th style={{ textAlign: 'right' }}>MRN actual</th><th style={{ textAlign: 'right' }}>Variance</th><th>Achievement</th><th>Status</th><th>Moves to verification</th>
            </tr></thead>
            <tbody>
              {list.map((t) => {
                const isOpen = open === t.i.id
                const v = t.p.actualToDate - t.p.planToDate
                return (
                  <React.Fragment key={t.i.id}>
                    <tr className={cn('clickable', isOpen && 'bg-slate-50/80')} onClick={() => setOpen(isOpen ? null : t.i.id)}>
                      <td className="!px-1.5"><Icon name="ChevronRight" size={14} className={cn('transition-transform', isOpen && 'rotate-90')} /></td>
                      <td><button onClick={(e) => { e.stopPropagation(); openIdea(t.i.id) }} className="font-mono text-[11.5px] font-semibold text-brand-700 hover:underline">{t.i.id}</button><div className="text-[12px] text-ink truncate max-w-[240px]" title={t.i.title}>{t.i.title}</div></td>
                      <td><UserChip userId={t.i.execution?.ownerId} /></td>
                      <td className="num text-[12.5px] whitespace-nowrap">{fmtDate(t.lock.startDate)} → {fmtDate(t.lock.endDate)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{inrShort(t.lock.targetSaving)}</td>
                      <td className="num text-[12.5px]">{t.p.elapsed} / {t.p.months}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{inrShort(t.p.planToDate)}</td>
                      <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(t.p.actualToDate)}</td>
                      <td className={cn('num font-semibold', v < 0 ? 'text-red-600' : 'text-emerald-700')} style={{ textAlign: 'right' }}>{t.p.elapsed ? `${v >= 0 ? '+' : ''}${inrShort(v)}` : '—'}</td>
                      <td style={{ minWidth: 120 }}>{t.achievement != null ? <div><div className="text-[12px] font-semibold num">{pct(t.achievement, 0)}</div><ProgressBar value={Math.min(100, t.achievement)} color={STATUS_COLOR[t.status]} height={5} /></div> : <span className="text-muted text-[12px]">—</span>}</td>
                      <td><Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge></td>
                      <td className="num text-[12.5px] whitespace-nowrap">{fmtDate(t.lock.endDate)}<div className="text-[11px] text-muted">{t.daysLeft > 0 ? `in ${t.daysLeft} days` : 'today'}</div></td>
                    </tr>
                    {isOpen && <tr><td colSpan={12} className="!h-auto !p-0 bg-slate-50/80 !whitespace-normal"><Months t={t} last={last} /></td></tr>}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {!list.length && <EmptyState icon="ChartColumnBig" title="No executions in this view" desc="Approved ideas appear here from the savings start signed in their lock." />}
        </div>
      </Card>
    </div>
  )
}

/** Month-by-month: forecast (locked target ÷ months) vs MRN actual, with the MRN quantity behind it */
function Months({ t, last }: { t: Track; last: string }) {
  const qty = (m: string) => sum(t.rows.filter((r) => r.month === m).map((r) => r.mrnQty))
  const lines = (m: string) => t.rows.filter((r) => r.month === m).length
  return (
    <div className="p-3">
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Forecast</th><th style={{ textAlign: 'right' }}>MRN quantity</th><th style={{ textAlign: 'right' }}>MRN actual saving</th><th style={{ textAlign: 'right' }}>Variance</th><th style={{ textAlign: 'right' }}>Cumulative forecast</th><th style={{ textAlign: 'right' }}>Cumulative actual</th><th>MRN</th></tr></thead>
          <tbody>
            {t.p.rows.map((r) => {
              const posted = r.month <= last
              const v = r.actual != null ? r.actual - r.plan : null
              return (
                <tr key={r.month}>
                  <td className="font-semibold">{monthLong(r.month)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{inrShort(r.plan)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{posted ? num(qty(r.month)) : '—'}</td>
                  <td className="num font-semibold" style={{ textAlign: 'right' }}>{r.actual != null ? inrShort(r.actual) : '—'}</td>
                  <td className={cn('num', v != null && (v < 0 ? 'text-red-600' : 'text-emerald-700'))} style={{ textAlign: 'right' }}>{v != null ? `${v >= 0 ? '+' : ''}${inrShort(v)}` : '—'}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{inrShort(r.planCum)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{r.actualCum != null ? inrShort(r.actualCum) : '—'}</td>
                  <td>{posted ? (lines(r.month) ? <Badge color="var(--color-emerald-600)" icon="Check">{lines(r.month)} MRN line{lines(r.month) === 1 ? '' : 's'}</Badge> : <Badge color="var(--color-rose-600)">No MRN — nothing claimed</Badge>) : <Badge color="var(--color-slate-500)">{r.month === addMonthsYm(last, 1) ? 'Read next month' : 'Future'}</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function VerificationList({ ideas }: { ideas: Idea[] }) {
  const me = useMe()
  const ledger = useStore((s) => s.ledger)
  const users = useStore((s) => s.users)
  const openIdea = useStore((s) => s.openIdea)
  const [view, setView] = useState<'awaiting' | 'verified'>('awaiting')
  const [modalId, setModalId] = useState<string | null>(null)
  const inVer = useMemo(() => ideas.filter((i) => i.stage === 'Verification' || i.stage === 'Implemented' || !!i.verification?.verifiedAt), [ideas])
  const awaiting = inVer.filter((i) => !i.verification?.verifiedAt)
  const verified = inVer.filter((i) => !!i.verification?.verifiedAt)
  const list = (view === 'awaiting' ? awaiting : verified).sort((a, b) => (b.verification?.handedAt ?? '').localeCompare(a.verification?.handedAt ?? ''))
  const actualOf = (i: Idea) => (i.lock ? sum(ledger.filter((l) => l.ideaId === i.id && inLockWindow(i.lock!, l.month)).map((l) => l.realised)) : 0)
  const modalIdea = inVer.find((i) => i.id === modalId)
  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-line bg-white px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="h-10 w-10 rounded-xl grid place-items-center bg-brand-grad text-white shrink-0"><Icon name="ShieldCheck" size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink">Verification — locked target vs MRN actual</div>
          <div className="text-[12px] text-muted">Nobody hands over by hand: when the locked timeline signed at department approval ends, COIN moves the idea here with the forecast for the period and the saving actually found in MRN. Finance verifies.</div>
        </div>
        <Segmented value={view} onChange={(k) => setView(k as typeof view)} options={[{ key: 'awaiting', label: `Awaiting verification (${awaiting.length})`, icon: 'ShieldQuestion' }, { key: 'verified', label: `Verified (${verified.length})`, icon: 'ShieldCheck' }]} />
      </div>
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr>
              <th>Idea</th><th>Owner</th><th>Locked timeline</th><th style={{ textAlign: 'right' }}>Forecast (locked target)</th><th style={{ textAlign: 'right' }}>MRN actual</th><th style={{ textAlign: 'right' }}>Variance</th><th>Achieved</th><th>In verification since</th><th>{view === 'awaiting' ? 'Action' : 'Verified'}</th>
            </tr></thead>
            <tbody>
              {list.map((i) => {
                const target = i.lock?.targetSaving ?? 0
                const actual = actualOf(i)
                const ach = target ? (actual / target) * 100 : 0
                const ok = ach >= 95
                return (
                  <tr key={i.id}>
                    <td><button onClick={() => openIdea(i.id)} className="font-mono text-[11.5px] font-semibold text-brand-700 hover:underline">{i.id}</button><div className="text-[12px] text-ink truncate max-w-[240px]" title={i.title}>{i.title}</div></td>
                    <td><UserChip userId={i.execution?.ownerId ?? i.ownerId} /></td>
                    <td className="num text-[12.5px] whitespace-nowrap">{i.lock ? `${fmtDate(i.lock.startDate)} → ${fmtDate(i.lock.endDate)}` : '—'}<div className="text-[11px] text-muted">{i.lock ? `${i.lock.timelineMonths} month${i.lock.timelineMonths === 1 ? '' : 's'}` : ''}</div></td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrShort(target)}</td>
                    <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(actual)}</td>
                    <td className={cn('num font-semibold', actual - target < 0 ? 'text-red-600' : 'text-emerald-700')} style={{ textAlign: 'right' }}>{actual - target >= 0 ? '+' : ''}{inrShort(actual - target)}</td>
                    <td style={{ minWidth: 120 }}><div className="text-[12px] font-semibold num">{pct(ach, 0)}</div><ProgressBar value={Math.min(100, ach)} color={ok ? 'var(--color-emerald-600)' : 'var(--color-orange-400)'} height={5} /></td>
                    <td className="num text-[12.5px] whitespace-nowrap">{fmtDate(i.verification?.handedAt?.slice(0, 10))}<div className="text-[11px] text-muted truncate max-w-[160px]">{i.verification?.handedBy ?? ''}</div></td>
                    <td>{view === 'awaiting'
                      ? (ideaPerms(me, i).verify ? <Button size="sm" variant="primary" icon="ShieldCheck" onClick={() => setModalId(i.id)}>Verify</Button> : <Badge color="var(--color-orange-400)" icon="ShieldQuestion">With Finance</Badge>)
                      : <div className="text-[12px]"><Badge color={i.verification?.targetAchieved ? 'var(--color-emerald-600)' : 'var(--color-orange-400)'} icon="ShieldCheck">{i.verification?.targetAchieved ? 'Target achieved' : 'With shortfall'}</Badge><div className="text-[11px] text-muted mt-0.5">{users.find((u) => u.name === i.verification?.verifiedBy)?.name ?? i.verification?.verifiedBy} · {fmtDate(i.verification?.verifiedAt?.slice(0, 10))}</div></div>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length && <EmptyState icon="ShieldCheck" title={view === 'awaiting' ? 'Nothing awaiting verification' : 'No verified ideas yet'} desc="Ideas arrive here by themselves when their locked timeline ends." />}
        </div>
      </Card>
      {modalIdea && <VerificationModal idea={modalIdea} open={!!modalId} onClose={() => setModalId(null)} />}
    </div>
  )
}

/** Executions whose locked timeline ends within the next 60 days — they move to verification by themselves */
export function UpcomingDeadlines({ hub, className }: { hub: Idea[]; className?: string }) {
  const openIdea = useStore((s) => s.openIdea)
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const t = todayIso()
  const rows = hub.filter((i) => i.execution?.status === 'In Execution' && i.lock && i.lock.endDate > t && daysBetween(t, i.lock.endDate) <= 60)
    .map((i) => track(i, ledger, last)).sort((a, b) => a.lock.endDate.localeCompare(b.lock.endDate))
  return (
    <Card title="Locked deadlines in the next 60 days" icon="CalendarClock" className={className} subtitle={`${rows.length} execution${rows.length === 1 ? '' : 's'} move to verification by themselves on the deadline signed at department approval`}
      actions={<InfoTip title="Deadline">The deadline is the savings end in the budget + timeline lock signed at stage 4. It is not changed during execution; on that date COIN moves the idea to verification.</InfoTip>}>
      <div className="grid grid-cols-1 gap-1">
        {rows.map((r) => (
          <button key={r.i.id} onClick={() => openIdea(r.i.id)} className="text-left rounded-lg px-2 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-muted">{r.i.id}</span><Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge></div>
              <div className="text-[12.5px] font-semibold text-ink truncate">{r.i.title}</div>
              <div className="text-[11.5px] text-muted num">MRN {inrShort(r.p.actualToDate)} of {inrShort(r.p.planToDate)} forecast to date · target {inrShort(r.lock.targetSaving)}</div>
            </div>
            <div className="text-right shrink-0"><div className="text-[12.5px] font-bold num">{fmtDate(r.lock.endDate)}</div><div className="text-[11px] text-muted">in {daysBetween(t, r.lock.endDate)} days</div></div>
          </button>
        ))}
        {!rows.length && <EmptyState icon="CalendarCheck" title="No deadline in the next 60 days" desc="Executions further out keep reporting MRN month by month." className="py-6" />}
      </div>
    </Card>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card px-3.5 py-3 min-w-0">
      <div className="text-[11.5px] font-medium text-muted truncate">{label}</div>
      <div className={cn('text-[20px] font-bold num leading-tight', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>
      <div className="text-[11px] text-muted leading-snug truncate">{sub}</div>
    </div>
  )
}
