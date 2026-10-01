// M8 — quarter timeline: each idea as a bar from start to due date, milestones as dots (Section 9)
import type { ReactNode } from 'react'
import { useStore } from '../../store/useStore'
import type { Idea } from '../../lib/types'
import { HEALTH_STYLE, healthOf } from '../../lib/calc'
import { addDays, clamp, daysBetween, fmtDate, fmtDateShort, fyEnd, fyMonths, fyStart, monthShort, parse, todayIso, QUARTER_MONTHS } from '../../lib/format'
import { Icon, Tooltip, cn } from '../../components/ui'

const LABEL_W = 280

export function ExecTimeline({ ideas, fy }: { ideas: Idea[]; fy: string }) {
  const users = useStore((s) => s.users)
  const openIdea = useStore((s) => s.openIdea)
  const s0 = +parse(fyStart(fy))
  const s1 = +parse(addDays(fyEnd(fy), 1))
  const pos = (d: string) => clamp((+parse(d.slice(0, 10)) - s0) / (s1 - s0), 0, 1) * 100
  const inFy = (d: string) => d >= fyStart(fy) && d <= fyEnd(fy)
  const months = fyMonths(fy)
  const t = todayIso()
  const qStarts = [0, 3, 6, 9].map((k) => months[k] + '-01')
  const rows = [...ideas].filter((i) => i.execution).sort((a, b) => (a.execution!.targetDate < b.execution!.targetDate ? -1 : 1))

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LABEL_W + 760 }}>
        {/* Quarter bands + month header */}
        <div className="flex border-b border-line bg-slate-50/80 sticky top-0 z-20">
          <div className="shrink-0 px-3 flex items-end pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted sticky left-0 bg-slate-50 z-10" style={{ width: LABEL_W }}>Idea · owner</div>
          <div className="flex-1 relative h-[46px]">
            {qStarts.map((qs, k) => {
              const left = pos(qs)
              const right = k < 3 ? pos(qStarts[k + 1]) : 100
              const q = `Q${k + 1}`
              return (
                <div key={q} className={cn('absolute top-0 h-[22px] flex items-center justify-center text-[11px] font-bold border-l border-line', k % 2 ? 'bg-white/60' : 'bg-slate-100/70')} style={{ left: `${left}%`, width: `${right - left}%` }}>
                  <span className="text-ink-2">{q}</span><span className="ml-1 font-medium text-muted">{QUARTER_MONTHS[q]}</span>
                </div>
              )
            })}
            {months.map((m) => (
              <div key={m} className="absolute top-[22px] h-6 flex items-center pl-1.5 text-[10.5px] font-semibold text-muted border-l border-slate-200" style={{ left: `${pos(m + '-01')}%` }}>{monthShort(m)}</div>
            ))}
            {inFy(t) && (
              <div className="absolute top-[24px] -translate-x-1/2 px-1.5 h-[18px] rounded bg-red-600 text-white text-[10px] font-bold whitespace-nowrap grid place-items-center shadow z-10" style={{ left: `${pos(t)}%` }}>Today · {fmtDateShort(t)}</div>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {/* background quarter tint + month lines */}
          <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ left: LABEL_W }}>
            {qStarts.map((qs, k) => {
              const left = pos(qs), right = k < 3 ? pos(qStarts[k + 1]) : 100
              return <div key={qs} className={cn('absolute inset-y-0', k % 2 ? '' : 'bg-slate-50/70')} style={{ left: `${left}%`, width: `${right - left}%` }} />
            })}
            {months.map((m) => <div key={m} className="absolute inset-y-0 border-l border-dashed border-slate-100" style={{ left: `${pos(m + '-01')}%` }} />)}
            {inFy(t) && <div className="absolute inset-y-0 w-px bg-red-500/80 z-10" style={{ left: `${pos(t)}%` }} />}
          </div>

          {rows.map((i) => {
            const ex = i.execution!
            const done = ex.status === 'Done'
            const dropped = ex.status === 'Dropped'
            const health = healthOf(i)
            const color = done ? '#0f9f6e' : dropped ? '#6b7280' : HEALTH_STYLE[health].color
            const end = done ? ex.effectiveDate ?? ex.targetDate : dropped ? (i.droppedAt ?? ex.targetDate).slice(0, 10) : ex.targetDate
            const l = pos(ex.startDate), r = pos(end)
            const w = Math.max(0.9, r - l)
            const slipped = ex.originalTargetDate && ex.originalTargetDate !== ex.targetDate
            const owner = users.find((u) => u.id === ex.ownerId)
            return (
              <div key={i.id} className="flex items-stretch border-b border-slate-100 hover:bg-brand-50/30 transition-colors group">
                <button onClick={() => openIdea(i.id)} className="shrink-0 px-3 py-1.5 text-left sticky left-0 bg-white group-hover:bg-brand-50/40 z-10 border-r border-slate-100" style={{ width: LABEL_W }}>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} /><span className="font-mono text-[10.5px] font-semibold text-muted">{i.id}</span></div>
                  <div className="text-[12px] font-semibold text-ink truncate">{i.title}</div>
                  <div className="text-[10.5px] text-muted truncate">{owner?.name ?? '—'} · {done ? `done ${fmtDate(ex.effectiveDate)}` : dropped ? 'dropped' : `due ${fmtDate(ex.targetDate)}`}</div>
                </button>
                <div className="flex-1 relative h-[52px]">
                  {/* slip span (original → current due date) */}
                  {slipped && !done && !dropped && (
                    <>
                      <div className="absolute top-[9px] h-0 border-t-2 border-dashed border-red-300" style={{ left: `${Math.min(pos(ex.originalTargetDate), r)}%`, width: `${Math.abs(r - pos(ex.originalTargetDate))}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-[3]" style={{ left: `${pos(ex.originalTargetDate)}%` }}>
                        <Tooltip content={<div><b>Original due date {fmtDate(ex.originalTargetDate)}</b><div>Slipped {daysBetween(ex.originalTargetDate, ex.targetDate)} days · {ex.slippage.length} change{ex.slippage.length === 1 ? '' : 's'} logged</div>{ex.slippage.length > 0 && <div className="text-slate-300 mt-0.5">Latest reason: {ex.slippage[ex.slippage.length - 1].reason}</div>}</div>}>
                          <span className="block h-[22px] w-[10px] rounded-sm border-2 border-dashed border-red-400 bg-white/70" />
                        </Tooltip>
                      </div>
                    </>
                  )}
                  {/* bar */}
                  <div className="absolute top-1/2 -translate-y-1/2 z-[2]" style={{ left: `${l}%`, width: `${w}%` }}>
                    <Tooltip className="w-full" content={<div><b>{i.id}</b><div>{fmtDate(ex.startDate)} → {fmtDate(end)}</div><div>{done ? 'Done — Implemented' : dropped ? `Dropped — ${i.dropReason}` : `${health} · ${ex.progress}% complete`}</div></div>}>
                      <button onClick={() => openIdea(i.id)} className="relative w-full h-[18px] rounded-full overflow-hidden border shadow-sm transition-transform hover:scale-y-110" style={{ background: `${color}22`, borderColor: `${color}66` }}>
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${done ? 100 : ex.progress}%`, background: `linear-gradient(90deg, ${color}bb, ${color})` }} />
                        {ex.startDate < fyStart(fy) && <Icon name="ChevronsLeft" size={12} className="absolute left-0.5 top-1/2 -translate-y-1/2 text-white" />}
                        {end > fyEnd(fy) && <Icon name="ChevronsRight" size={12} className="absolute right-0.5 top-1/2 -translate-y-1/2" style={{ color }} />}
                      </button>
                    </Tooltip>
                  </div>
                  {/* milestones */}
                  {ex.milestones.map((m) => {
                    const overdue = !m.doneDate && m.dueDate < t
                    return (
                      <div key={m.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-[4]" style={{ left: `${pos(m.doneDate ?? m.dueDate)}%` }}>
                        <Tooltip content={<div><b>{m.name}</b><div>Due {fmtDate(m.dueDate)}</div><div>{m.doneDate ? `Done ${fmtDate(m.doneDate)}` : overdue ? 'Overdue' : 'Open'}</div>{m.note && <div className="text-slate-300 mt-0.5">{m.note}</div>}</div>}>
                          <span className={cn('block h-[11px] w-[11px] rounded-full border-2 shadow-sm', m.doneDate ? 'border-white' : overdue ? 'border-red-600 bg-white' : 'bg-white')} style={m.doneDate ? { background: color, boxShadow: `0 0 0 1px ${color}` } : overdue ? undefined : { borderColor: color }} />
                        </Tooltip>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {!rows.length && <div className="py-10 text-center text-[13px] text-muted">No ideas match this view.</div>}
        </div>
      </div>
    </div>
  )
}

export function TimelineLegend() {
  const items: [ReactNode, string][] = [
    [<span className="h-2.5 w-5 rounded-full" style={{ background: HEALTH_STYLE['On track'].color }} />, 'On track'],
    [<span className="h-2.5 w-5 rounded-full" style={{ background: HEALTH_STYLE['At risk'].color }} />, 'At risk (milestone overdue)'],
    [<span className="h-2.5 w-5 rounded-full" style={{ background: HEALTH_STYLE.Delayed.color }} />, 'Delayed (due date passed)'],
    [<span className="h-2.5 w-2.5 rounded-full bg-slate-700" />, 'Milestone done'],
    [<span className="h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-white" />, 'Milestone open'],
    [<span className="h-3 w-2 rounded-sm border-2 border-dashed border-red-400" />, 'Original due date (slipped)'],
    [<span className="h-3 w-px bg-red-500" />, 'Today'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted">
      {items.map(([sw, l]) => <span key={l} className="inline-flex items-center gap-1.5">{sw}{l}</span>)}
    </div>
  )
}
