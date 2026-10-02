// "My actions" queue — role-aware (Section 8 M1 / M5), sorted by SLA urgency
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import type { Idea, User } from '../../lib/types'
import { EVALUATION_STAGES, STAGE } from '../../lib/masters'
import { ideaAnnualised, slaStatus } from '../../lib/calc'
import { daysBetween, fmtDate, inrShort, monthLabel, sum, todayIso } from '../../lib/format'
import { navFor } from '../../lib/nav'
import { useFilteredIdeas } from '../../lib/hooks'
import { Badge, Card, Chip, EmptyState, Icon, InfoTip, SlaPill, cn } from '../../components/ui'
import { SLA_RANK, drillUrl, slaFrom } from './shared'
import { STAGE_SLA_KEY } from '../../lib/masters'

const stagesOf = (key: string) => Object.keys(STAGE_SLA_KEY).filter((s) => STAGE_SLA_KEY[s] === key)

export type ActionKind = 'validate' | 'feasibility' | 'evaluate' | 'approve' | 'savings' | 'overdue' | 'info' | 'draft' | 'sla'
export const ACTION_META: Record<ActionKind, { label: string; icon: string; color: string }> = {
  validate: { label: 'Feasibility check', icon: 'UsersRound', color: '#4470d6' },
  feasibility: { label: 'Feasibility', icon: 'Factory', color: '#0d9488' },
  evaluate: { label: 'R&D approval', icon: 'FlaskConical', color: '#4f46e5' },
  approve: { label: 'Sourcing approval', icon: 'Stamp', color: '#2f5bc6' },
  savings: { label: 'Savings to validate', icon: 'BadgeIndianRupee', color: '#0f9f6e' },
  overdue: { label: 'Overdue executions', icon: 'CalendarX2', color: '#e0364f' },
  info: { label: 'Info requested', icon: 'MessageCircleQuestion', color: '#ec8a1c' },
  draft: { label: 'Drafts', icon: 'FilePen', color: '#64748b' },
  sla: { label: 'SLA breaches', icon: 'Siren', color: '#a3143a' },
}

export interface ActionItem {
  key: string
  kind: ActionKind
  ideaId?: string
  title: string
  sub: string
  value?: number
  sla?: { state: string; left: number; working: number }
  overdueDays?: number
  route?: string
  urgency: number
}

const firstPending = (i: Idea) => i.approvals.find((a) => !a.decision)

/** Build the role-aware action list for a user */
export function buildActions(me: User, ideas: Idea[], s: ReturnType<typeof useStore.getState>): ActionItem[] {
  const out: ActionItem[] = []
  const r = me.roles
  const isBuyer = r.includes('buyer'), isLead = r.includes('lead'), isHead = r.includes('head')
  const t = todayIso()
  const push = (kind: ActionKind, i: Idea, sub: string, extra: Partial<ActionItem> = {}) => {
    const sla = slaStatus(i, s.slaRules)
    out.push({ key: `${kind}-${i.id}`, kind, ideaId: i.id, title: i.title, sub, value: ideaAnnualised(i), sla: sla.state === 'none' ? undefined : sla, urgency: SLA_RANK[sla.state] ?? 0, ...extra })
  }
  for (const i of ideas) {
    if (i.stage === 'Draft') {
      if (i.submitterId === me.id) out.push({ key: `draft-${i.id}`, kind: 'draft', ideaId: i.id, title: i.title || 'Untitled draft', sub: `${i.id} · saved ${daysBetween(i.createdAt.slice(0, 10), t)}d ago`, value: ideaAnnualised(i), urgency: 0.5 })
      continue
    }
    if (i.submitterId === me.id && i.infoRequested && i.bucket === 'Pipeline') push('info', i, `${i.id} · ${i.stage} · reply to the team's query`, { urgency: 3.5 })
    if (i.stage === STAGE.feasibility && ((isBuyer && (i.buyerId === me.id || me.commodities.includes(i.commodity))) || (isLead && me.commodities.includes(i.commodity)))) push('validate', i, `${i.id} · ${i.submitterName} · team feasibility check`)
    if (r.includes('techeval') && EVALUATION_STAGES.includes(i.stage) && i.techEval && !i.techEval.decision && i.techEval.evaluatorDept.includes(me.department)) push('evaluate', i, `${i.id} · R&D approval · approve or reject + validation plan`)
    if ((isLead || isHead) && i.stage === STAGE.approval && firstPending(i)?.approverId === me.id) push('approve', i, `${i.id} · ${firstPending(i)!.level} · ${i.commodity}`)
    if ((isBuyer || isLead || isHead) && i.bucket === 'In Execution' && i.execution?.status === 'In Execution' && i.execution.targetDate < t) {
      const mineExec = isHead || (isLead && me.commodities.includes(i.commodity)) || (i.ownerId ?? i.buyerId) === me.id
      if (mineExec) {
        const d = daysBetween(i.execution.targetDate, t)
        out.push({ key: `overdue-${i.id}`, kind: 'overdue', ideaId: i.id, title: i.title, sub: `${i.id} · due ${fmtDate(i.execution.targetDate)} · ${i.stage}`, value: ideaAnnualised(i), overdueDays: d, urgency: 3 + Math.min(0.9, d / 200) })
      }
    }
    if (r.includes('admin')) {
      const sla = slaStatus(i, s.slaRules)
      if (sla.state === 'breach' || sla.state === 'escalated') push('sla', i, `${i.id} · ${i.stage} · ${sla.working} working days in stage`)
    }
  }
  if (r.includes('finance')) {
    const rule = s.slaRules.find((x) => x.stage === 'Finance validation')
    const groups = new Map<string, typeof s.ledger>()
    for (const l of s.ledger) if (l.financeStatus === 'Pending') { const k = `${l.ideaId}|${l.month}`; groups.set(k, [...(groups.get(k) ?? []), l]) }
    for (const [k, rows] of groups) {
      const [ideaId, month] = k.split('|')
      const idea = s.ideas.find((i) => i.id === ideaId)
      const oldest = rows.map((x) => x.postedAt).sort()[0]
      const sla = slaFrom(oldest, rule)
      const leak = rows.some((x) => x.leakage > 0)
      out.push({ key: `savings-${k}`, kind: 'savings', ideaId, title: idea?.title ?? ideaId, sub: `${ideaId} · ${monthLabel(month)} · ${rows.length} part line${rows.length > 1 ? 's' : ''}${leak ? ' · price leakage' : ''}`, value: sum(rows.map((x) => x.realised)), sla, route: '/reports/leakage', urgency: SLA_RANK[sla.state] ?? 0 })
    }
  }
  return out.sort((a, b) => b.urgency - a.urgency || (b.value ?? 0) - (a.value ?? 0))
}

export function useMyActions(): ActionItem[] {
  const me = useMe()
  const ideas = useStore((s) => s.ideas)
  const ledger = useStore((s) => s.ledger)
  const slaRules = useStore((s) => s.slaRules)
  return useMemo(() => (me ? buildActions(me, ideas, useStore.getState()) : []), [me, ideas, ledger, slaRules])
}

/** Stage SLA counts (Section 12) across the ideas in my scope */
function useSlaRows() {
  const ideas = useFilteredIdeas()
  const rules = useStore((s) => s.slaRules)
  const ledger = useStore((s) => s.ledger)
  return rules.map((r) => {
    const c = { due: 0, breach: 0, escalated: 0, open: 0 }
    if (r.stage === 'Finance validation') {
      const ids = new Set(ideas.map((i) => i.id))
      const groups = new Map<string, string>()
      for (const l of ledger) if (l.financeStatus === 'Pending' && ids.has(l.ideaId)) { const k = `${l.ideaId}|${l.month}`; const cur = groups.get(k); if (!cur || l.postedAt < cur) groups.set(k, l.postedAt) }
      for (const at of groups.values()) { const s = slaFrom(at, r); c.open++; if (s.state in c) (c as any)[s.state]++ }
    } else {
      for (const i of ideas) { const s = slaStatus(i, rules); if (s.key !== r.stage) continue; c.open++; if (s.state in c) (c as any)[s.state]++ }
    }
    return { r, ...c }
  })
}

/** SLA watch — compact strip used inside the My actions card */
function SlaWatch() {
  const nav = useNavigate()
  const filters = useStore((s) => s.filters)
  const rows = useSlaRows()
  const cellCls = (n: number, color: string) => (n ? { color, background: `${color}12` } : { color: '#cbd5e1' })
  return (
    <div className="mt-2 pt-2 border-t border-line shrink-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1"><Icon name="Timer" size={12} />SLA watch · my scope<InfoTip title="Stage SLAs">Working days in stage against the stage SLA; reminder and escalation days per Section 12. Click a stage to open the breaches.</InfoTip></span>
        <span className="grid grid-cols-4 gap-1 text-[10px] font-semibold uppercase text-muted w-[176px] text-center"><span>Open</span><span>Due</span><span>Breach</span><span>Escal.</span></span>
      </div>
      {rows.map((x) => (
        <button key={x.r.stage} onClick={() => (x.r.stage === 'Finance validation' ? nav('/reports/leakage') : nav(drillUrl({ sla: 'breach', stage: stagesOf(x.r.stage).length === 1 ? stagesOf(x.r.stage)[0] : undefined }, filters)))} className="w-full flex items-center justify-between gap-2 h-[22px] rounded hover:bg-slate-50 px-1 -mx-1">
          <span className="text-[11.5px] text-ink-2 truncate">{x.r.stage} <span className="text-muted">· {x.r.slaDays}d</span></span>
          <span className="grid grid-cols-4 gap-1 w-[176px] text-center text-[11px] font-bold num">
            <span className="text-ink-2">{x.open}</span>
            <span className="rounded" style={cellCls(x.due, '#ec8a1c')}>{x.due}</span>
            <span className="rounded" style={cellCls(x.breach, '#e0364f')}>{x.breach}</span>
            <span className="rounded" style={cellCls(x.escalated, '#a3143a')}>{x.escalated}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** SLA watch — full dashboard card: every review stage with open, due, breached and escalated counts */
export function SlaWatchCard({ className }: { className?: string }) {
  const nav = useNavigate()
  const filters = useStore((s) => s.filters)
  const rows = useSlaRows()
  const tot = rows.reduce((a, x) => ({ open: a.open + x.open, due: a.due + x.due, breach: a.breach + x.breach, escalated: a.escalated + x.escalated }), { open: 0, due: 0, breach: 0, escalated: 0 })
  const go = (stage: string) => (stage === 'Finance validation' ? nav('/reports/leakage') : nav(drillUrl({ sla: 'breach', stage: stagesOf(stage).length === 1 ? stagesOf(stage)[0] : undefined }, filters)))
  const num = (n: number, color: string) => <span className="inline-flex justify-center min-w-[34px] h-7 px-2 items-center rounded-md text-[13px] font-semibold num" style={n ? { color, background: `${color}14` } : { color: '#d0d5dd' }}>{n}</span>
  return (
    <Card className={cn('h-full', className)} icon="Timer" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">SLA watch<InfoTip title="Stage SLAs">Working days each idea has spent in its current stage against the stage SLA. Reminder and escalation days follow Section 12. Click a stage to open the ideas behind it.</InfoTip></span>}
      subtitle="Ideas in my scope, by review stage"
      actions={tot.breach + tot.escalated > 0 ? <Badge color="#e0364f" dot>{tot.breach + tot.escalated} beyond SLA</Badge> : <Badge color="#0f9f6e" icon="CircleCheck">All within SLA</Badge>}>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] items-center gap-x-2 pb-2 border-b border-line text-[12px] font-medium text-muted">
        <span>Stage</span><span className="text-center">Open</span><span className="text-center">Due</span><span className="text-center">Breach</span><span className="text-center">Escalated</span>
      </div>
      <div className="flex flex-col">
        {rows.map((x) => (
          <button key={x.r.stage} onClick={() => go(x.r.stage)} className="h-10 grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] items-center gap-x-2 border-b border-[#eef2f8] last:border-0 hover:bg-brand-50/60 -mx-2 px-2 rounded-md text-left">
            <span className="min-w-0 truncate text-[13px] font-medium text-ink">{x.r.stage} <span className="text-muted font-normal">· {x.r.slaDays}d</span></span>
            <span className="text-center text-[14px] font-semibold text-ink num">{x.open}</span>
            <span className="text-center">{num(x.due, '#ec8a1c')}</span>
            <span className="text-center">{num(x.breach, '#e0364f')}</span>
            <span className="text-center">{num(x.escalated, '#a3143a')}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] items-center gap-x-2 pt-2.5 mt-1 border-t border-line text-[13px] font-semibold">
        <span className="text-ink">Total</span>
        <span className="text-center num text-ink">{tot.open}</span><span className="text-center num" style={{ color: '#b35f0c' }}>{tot.due}</span><span className="text-center num" style={{ color: '#d92d20' }}>{tot.breach}</span><span className="text-center num" style={{ color: '#a3143a' }}>{tot.escalated}</span>
      </div>
    </Card>
  )
}

/** The queue card */
export function MyActionsCard({ className, title = 'My actions', only, slaWatch }: { className?: string; title?: string; only?: ActionKind[]; slaWatch?: boolean }) {
  const me = useMe()
  const all = useMyActions()
  const items = only ? all.filter((a) => only.includes(a.kind)) : all
  const openIdea = useStore((s) => s.openIdea)
  const nav = useNavigate()
  const [kind, setKind] = useState<ActionKind | 'all'>('all')
  const kinds = (Object.keys(ACTION_META) as ActionKind[]).filter((k) => items.some((a) => a.kind === k))
  const list = kind === 'all' ? items : items.filter((a) => a.kind === kind)
  const breached = items.filter((a) => a.sla && (a.sla.state === 'breach' || a.sla.state === 'escalated')).length + items.filter((a) => a.kind === 'overdue').length
  const hasRegister = navFor(me).some((n) => n.key === 'register')
  const footer = me?.roles.includes('finance') ? { label: 'Open Reports', path: '/reports' } : hasRegister ? { label: 'Open Idea Register', path: '/ideas' } : { label: 'Open My Ideas', path: '/my-ideas' }
  return (
    <Card className={cn('h-full', className)} bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">{title}<InfoTip title="My actions">Everything waiting on you, sorted by SLA urgency (escalated → breached → due). Click an item to review it in the side panel without leaving the page.</InfoTip></span>}
      subtitle={items.length ? `${items.length} open${breached ? ` · ${breached} beyond SLA / overdue` : ''}` : 'Nothing pending'}
      icon="Inbox"
      actions={items.length ? <Badge color={breached ? '#e0364f' : '#4470d6'} dot>{items.length}</Badge> : undefined}>
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pb-2 shrink-0">
          <Chip active={kind === 'all'} onClick={() => setKind('all')}>All {items.length}</Chip>
          {kinds.map((k) => <Chip key={k} active={kind === k} color={ACTION_META[k].color} onClick={() => setKind(k)}>{ACTION_META[k].label} {items.filter((a) => a.kind === k).length}</Chip>)}
        </div>
      )}
      <div className="flex-1 -mx-1 px-1">
        <div>
          {list.slice(0, slaWatch ? 3 : 6).map((a) => {
            const m = ACTION_META[a.kind]
            return (
              <button key={a.key} onClick={() => (a.route && a.kind === 'savings' ? nav(a.route) : a.ideaId ? openIdea(a.ideaId) : a.route && nav(a.route))}
                className="group w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
                <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${m.color}12`, color: m.color }}><Icon name={m.icon} size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{a.title}</span>
                  <span className="block text-[11px] text-muted truncate">{m.label} · {a.sub}</span>
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  {a.kind === 'overdue' ? <Badge color="#e0364f" icon="CalendarX2">{a.overdueDays}d overdue</Badge> : a.sla ? <SlaPill state={a.sla.state} left={a.sla.left} working={a.sla.working} /> : <span className="h-[22px]" />}
                  {a.value != null && a.value > 0 && <span className="text-[11px] font-semibold text-ink-2 num">{inrShort(a.value)}</span>}
                </span>
              </button>
            )
          })}
          {list.length > (slaWatch ? 3 : 6) && <button onClick={() => nav(footer.path)} className="w-full text-left px-2 py-1.5 text-[11.5px] font-semibold text-muted hover:text-brand-700">+ {list.length - (slaWatch ? 3 : 6)} more waiting on you</button>}
          {!list.length && <EmptyState icon="CheckCheck" title="You're all caught up" desc="No items need your action right now. New hand-offs appear here the moment they reach you." className="py-6" />}
        </div>
      </div>
      {slaWatch && <SlaWatch />}
      <button onClick={() => nav(footer.path)} className="mt-2 pt-2 border-t border-line text-[12px] font-semibold text-brand-700 hover:text-brand-800 flex items-center justify-between shrink-0">
        {footer.label}<Icon name="ArrowRight" size={14} />
      </button>
    </Card>
  )
}
