// Shared helpers for Workbench (M5), Execution Hub (M8) and Savings Realisation (M9)
import React, { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/useStore'
import type { Execution, Idea, RouteKey, User } from '../../lib/types'
import { ROUTE_STAGES, STAGE_SHORT } from '../../lib/masters'
import { goLiveOf, ideaAnnualised, ideaApprovedAnnualised } from '../../lib/calc'
import { addDays, fyMonths, parse, todayIso } from '../../lib/format'
import { Avatar, Button, Field, Icon, Modal, cn } from '../../components/ui'

// ─── Responsive helper ────────────────────────────────────────────────────────
export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : true))
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    h()
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [q])
  return m
}

// ─── Undo (5 s) for non-final actions: snapshot → restore ─────────────────────
/** Captures the ideas / ledger rows an action touches plus the notification & email logs, and returns a restore function. */
export function snapshot(ideaIds: string[] = [], ledgerIds: string[] = []) {
  const s = useStore.getState()
  const ideas = new Map(s.ideas.filter((i) => ideaIds.includes(i.id)).map((i) => [i.id, i]))
  const rows = new Map(s.ledger.filter((l) => ledgerIds.includes(l.id)).map((l) => [l.id, l]))
  const nIds = new Set(s.notifications.map((n) => n.id))
  const eIds = new Set(s.emails.map((e) => e.id))
  return () =>
    useStore.setState((st) => ({
      ideas: st.ideas.map((i) => ideas.get(i.id) ?? i),
      ledger: st.ledger.map((l) => rows.get(l.id) ?? l),
      notifications: st.notifications.filter((n) => nIds.has(n.id)),
      emails: st.emails.filter((e) => eIds.has(e.id)),
    }))
}
export const toast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', undo?: () => void) => useStore.getState().toast(msg, type, undo)

// ─── Route strip (Buyer → Supplier → R&D → Approval → NPD → PAP → Implemented) ─
export function RouteStrip({ route, stage, compact }: { route: RouteKey; stage: string; compact?: boolean }) {
  const stages = ROUTE_STAGES[route] ?? ROUTE_STAGES.Commercial
  const cur = stages.indexOf(stage)
  const terminal = stage === 'Dropped' || stage === 'Rejected'
  return (
    <div className="flex flex-wrap items-center gap-1 gap-y-1.5">
      {stages.map((s, k) => {
        const done = cur > k || stage === 'Implemented'
        const active = cur === k && stage !== 'Implemented'
        return (
          <React.Fragment key={s}>
            {k > 0 && <span className={cn('h-px w-3 shrink-0', done || active ? 'bg-emerald-400' : 'bg-slate-200')} />}
            <span
              title={s}
              className={cn(
                'inline-flex items-center gap-1 rounded-full whitespace-nowrap font-semibold border shrink-0',
                compact ? 'h-[22px] px-2 text-[10.5px]' : 'h-6 px-2.5 text-[11px]',
                done && 'bg-emerald-50 border-emerald-200 text-emerald-700',
                active && !terminal && 'bg-brand-600 border-brand-600 text-white shadow-[0_4px_10px_-4px_rgb(36_89_224/.55)]',
                active && terminal && 'bg-slate-100 border-slate-300 text-slate-600',
                !done && !active && 'bg-white border-line text-muted',
              )}
            >
              {done && <Icon name="Check" size={11} strokeWidth={3} />}
              {STAGE_SHORT[s] ?? s}
            </span>
          </React.Fragment>
        )
      })}
      {terminal && (
        <>
          <span className="h-px w-3 bg-slate-200 shrink-0" />
          <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold border bg-slate-100 border-slate-300 text-slate-600 shrink-0"><Icon name="Ban" size={11} />{stage}</span>
        </>
      )}
    </div>
  )
}

// ─── Anchored popover (portal) — used for inline edits ────────────────────────
export function Popover({ open, onClose, anchor, children, width = 300, align = 'left' }: { open: boolean; onClose: () => void; anchor: HTMLElement | null; children: React.ReactNode; width?: number; align?: 'left' | 'right' }) {
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null)
  useLayoutEffect(() => {
    if (!open || !anchor) { setPos(null); return }
    const r = anchor.getBoundingClientRect()
    const up = r.bottom + 300 > window.innerHeight && r.top > 300
    let x = align === 'right' ? r.right - width : r.left
    x = Math.max(8, Math.min(x, window.innerWidth - width - 8))
    setPos({ x, y: up ? r.top - 6 : r.bottom + 6, up })
  }, [open, anchor, width, align])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    window.addEventListener('resize', onClose)
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('resize', onClose) }
  }, [open, onClose])
  if (!open || !pos) return null
  return createPortal(
    <>
      <div className="fixed inset-0 z-[125]" onClick={onClose} />
      <div className="fixed z-[126] card shadow-[0_20px_50px_-12px_rgb(15_23_42/.35)] animate-pop" style={{ left: pos.x, top: pos.y, width, transform: pos.up ? 'translateY(-100%)' : undefined }}>
        {children}
      </div>
    </>,
    document.body,
  )
}
export function MenuItem({ icon, children, onClick, disabled, danger, hint }: { icon: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; hint?: string }) {
  return (
    <button disabled={disabled} onClick={onClick} title={hint} className={cn('w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[12.5px] font-medium text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed', danger ? 'text-red-600 hover:bg-red-50' : 'text-ink-2 hover:bg-slate-50')}>
      <Icon name={icon} size={15} className={danger ? 'text-red-500' : 'text-muted'} />
      <span className="flex-1">{children}</span>
    </button>
  )
}

// ─── Reassign with mandatory remarks ──────────────────────────────────────────
export function ReassignModal({ open, onClose, title, subtitle, candidates, currentId, defaultTo, onConfirm }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; candidates: User[]; currentId?: string; defaultTo?: string; onConfirm: (userId: string, remarks: string) => void
}) {
  const [to, setTo] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) { setTo(defaultTo ?? ''); setRemarks('') } }, [open, defaultTo])
  const list = candidates.filter((u) => u.id !== currentId && u.active)
  const cur = useStore((s) => s.users.find((u) => u.id === currentId))
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} icon="UserRoundCog" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="UserRoundCog" disabled={!to || !remarks.trim()} onClick={() => { onConfirm(to, remarks.trim()); onClose() }}>Reassign</Button></>}>
      <div className="grid gap-3">
        {cur && (
          <div className="flex items-center gap-2 text-[12.5px] text-muted">Currently with <Avatar name={cur.name} color={cur.avatarColor} size={20} /><span className="font-semibold text-ink">{cur.name}</span></div>
        )}
        <Field label="Reassign to" required>
          <div className="grid gap-1">
            {list.map((u) => (
              <button key={u.id} type="button" onClick={() => setTo(u.id)} className={cn('flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border text-left transition-colors', to === u.id ? 'border-brand-300 bg-brand-50' : 'border-line hover:bg-slate-50')}>
                <Avatar name={u.name} color={u.avatarColor} size={26} />
                <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold truncate">{u.name}</span><span className="block text-[11px] text-muted truncate">{u.designation}</span></span>
                {to === u.id && <Icon name="CircleCheck" size={16} className="text-brand-600" />}
              </button>
            ))}
            {!list.length && <div className="text-[12.5px] text-muted py-3 text-center">No eligible users in the user–role mapping.</div>}
          </div>
        </Field>
        <Field label="Remarks" required hint="Logged in the activity trail and sent with the notification.">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why is this being reassigned?" />
        </Field>
      </div>
    </Modal>
  )
}

// ─── Execution helpers ────────────────────────────────────────────────────────
/** Implementation reminder (Section 12): every 15 days; weekly in the last 30 days before due date; after due date passes, day after then weekly. */
export function nextReminder(ex: Execution): { date: string; cadence: 'Every 15 days' | 'Weekly' | 'Due date passed' } {
  const t = todayIso()
  if (ex.targetDate < t) {
    let d = addDays(ex.targetDate, 1)
    while (d < t) d = addDays(d, 7)
    return { date: d, cadence: 'Due date passed' }
  }
  const weeklyFrom = addDays(ex.targetDate, -30)
  const schedule: string[] = []
  let d = addDays(ex.startDate, 15)
  while (d < weeklyFrom) { schedule.push(d); d = addDays(d, 15) }
  let w = weeklyFrom > ex.startDate ? weeklyFrom : addDays(ex.startDate, 7)
  while (w <= ex.targetDate) { schedule.push(w); w = addDays(w, 7) }
  const next = schedule.find((x) => x >= t) ?? ex.targetDate
  return { date: next, cadence: next >= weeklyFrom ? 'Weekly' : 'Every 15 days' }
}

/** FY-phased committed value spread by month (sums exactly to calc.ideaCommitted). */
export function monthlyCommitted(idea: Idea, fy: string): Record<string, number> {
  const months = fyMonths(fy)
  const out: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]))
  if (idea.bucket !== 'In Execution' && idea.bucket !== 'Implemented') return out
  const annual = idea.bucket === 'Implemented' ? ideaApprovedAnnualised(idea) : ideaAnnualised(idea)
  const g = parse(goLiveOf(idea))
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number)
    const monthEnd = new Date(y, m, 0)
    if (monthEnd < g) continue
    const monthStart = new Date(y, m - 1, 1)
    const frac = g > monthStart ? (monthEnd.getDate() - g.getDate() + 1) / monthEnd.getDate() : 1
    out[ym] = (annual / 12) * frac
  }
  const p = idea.execution?.phasing
  if (idea.bucket === 'In Execution' && p && p.Q1 + p.Q2 + p.Q3 + p.Q4 > 0) {
    ;(['Q1', 'Q2', 'Q3', 'Q4'] as const).forEach((q, qi) => {
      const ms = months.slice(qi * 3, qi * 3 + 3)
      const base = ms.reduce((a, m) => a + out[m], 0)
      if (base > 0) ms.forEach((m) => (out[m] = (out[m] / base) * p[q]))
      else ms.forEach((m) => (out[m] = p[q] / 3))
    })
  }
  return out
}

export const SLA_COLOR: Record<string, string> = { none: '#94a3b8', ok: '#0f9f6e', due: '#ec8a1c', breach: '#e0364f', escalated: '#a3143a' }

/** Section header inside a card */
export function MiniHead({ icon, children, right }: { icon?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted">{icon && <Icon name={icon} size={13} className="text-brand-600" />}{children}</div>
      {right}
    </div>
  )
}
