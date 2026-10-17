// My queue — every idea waiting for my action (assigned by the department ladder), how long it has waited and its SLA.
// Ideas assigned to a colleague with my role in my department (e.g. another Sourcing commodity lead) are listed after mine:
// I may act on them too. Sourcing Head and Admin get a second tab with every open item across departments.
import { useState } from 'react'
import { useMe, useStore } from '../store/useStore'
import { ROLE_LABEL, primaryRole } from '../lib/nav'
import { ideaAnnualised } from '../lib/calc'
import { stageLabel, ideaDept } from '../lib/workflow'
import { inrShort } from '../lib/format'
import { Badge, Button, Card, DataTable, EmptyState, Icon, InfoTip, PageHeader, Segmented, cn, type Column } from '../components/ui'
import { ACTION_META, waitingText, type QueueRow } from './queue/model'
import { useMyQueue } from './queue/useQueue'

const SLA_STYLE = {
  breach: { label: 'Beyond SLA', color: 'var(--color-red-600)' },
  due: { label: 'Due soon', color: 'var(--color-amber-600)' },
  ok: { label: 'On time', color: 'var(--color-emerald-600)' },
} as const

export default function Queue() {
  const me = useMe()
  const q = useMyQueue()
  const users = useStore((s) => s.users)
  const commodities = useStore((s) => s.commodities)
  const openIdea = useStore((s) => s.openIdea)
  const override = !!me && (me.roles.includes('head') || me.roles.includes('admin'))
  // everyone else sees their own items and then their team's; the Sourcing Head and Admin see everything pending
  // when nothing is assigned to them
  const [picked, setTab] = useState<'mine' | 'all' | null>(null)
  const tab = picked ?? (override ? (q.mine.length ? 'mine' : 'all') : 'all')
  if (!me) return null
  const rows = tab === 'all' ? q.all : q.mine
  const userOf = (id?: string) => users.find((u) => u.id === id)
  const nameOf = (id?: string) => userOf(id)?.name ?? '—'
  const teamInView = tab === 'all' ? rows.filter((r) => r.team).length : 0
  const showAssignee = tab === 'all' && rows.some((r) => !r.assignedToMe)
  // the department column only matters when the rows are not all from my own department
  const showDept = rows.some((r) => ideaDept(r.idea) !== me.department)
  // a Sourcing commodity lead / buyer gets the ideas of their commodities; others of the same role get the rest
  const myCommodities = me.department === 'Sourcing' ? me.commodities.map((c) => commodities.find((x) => x.code === c)?.name ?? c) : []
  const counts = (Object.keys(ACTION_META) as (keyof typeof ACTION_META)[]).map((a) => ({ a, n: rows.filter((r) => r.action === a).length })).filter((x) => x.n)
  const breached = rows.filter((r) => r.sla === 'breach').length

  const cols: Column<QueueRow>[] = [
    { key: 'sla', label: 'SLA', value: (r) => r.sla, width: 110, render: (r) => <Badge color={SLA_STYLE[r.sla].color} dot>{SLA_STYLE[r.sla].label}</Badge> },
    { key: 'idea', label: 'Idea', value: (r) => r.idea.id, render: (r) => (
      <div className="min-w-[200px] max-w-[min(380px,22vw)]">
        <div className="text-[11.5px] truncate"><span className="font-mono font-semibold text-brand-700">{r.idea.id}</span><span className="text-muted"> · raised by {r.idea.submitterName}</span></div>
        <div className="text-[12.5px] text-ink truncate">{r.idea.title}</div>
      </div>) },
    { key: 'stage', label: 'Waiting for', value: (r) => stageLabel(r.idea, r.idea.stage), render: (r) => (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 min-w-[120px] max-w-[150px]"><Icon name={ACTION_META[r.action].icon} size={14} className="text-brand-600 shrink-0" />{stageLabel(r.idea, r.idea.stage)}</span>) },
    ...(showDept ? [{ key: 'dept', label: 'Department', value: (r: QueueRow) => ideaDept(r.idea), render: (r: QueueRow) => <span className="text-[12.5px] text-ink-2">{ideaDept(r.idea)}</span> } as Column<QueueRow>] : []),
    // shown inside the Idea cell; kept as a column for sorting and the Excel export
    { key: 'submitter', label: 'Raised by', hidden: true, value: (r) => r.idea.submitterName, render: (r) => <span className="text-[12.5px] text-ink-2 whitespace-nowrap">{r.idea.submitterName}</span> },
    ...(showAssignee ? [{ key: 'assignee', label: 'Assigned to', value: (r: QueueRow) => (r.assignedToMe ? 'You' : nameOf(r.assignee)), render: (r: QueueRow) => (r.assignedToMe
      ? <span className="text-[12.5px] font-semibold text-brand-700">You</span>
      : <div className="min-w-[150px]"><div className="text-[12.5px] text-ink-2 whitespace-nowrap">{nameOf(r.assignee)}</div><div className="text-[11px] text-muted truncate max-w-[160px]">{userOf(r.assignee)?.designation}</div></div>) } as Column<QueueRow>] : []),
    { key: 'value', label: 'Forecast', align: 'right', value: (r) => Math.round(ideaAnnualised(r.idea)), render: (r) => <span className="num font-semibold text-ink">{inrShort(ideaAnnualised(r.idea))}</span> },
    { key: 'waiting', label: 'Waiting', align: 'right', value: (r) => r.waitingHours, render: (r) => <div className="whitespace-nowrap"><div className={cn('num', r.sla === 'breach' ? 'text-red-700 font-semibold' : 'text-ink-2')}>{waitingText(r.waitingHours)}</div>{r.slaDays ? <div className="text-[11px] text-muted">of {r.slaDays} d SLA</div> : null}</div> },
    { key: 'go', label: '', align: 'right', render: (r) => <Button size="xs" variant={r.assignedToMe ? 'primary' : 'secondary'} iconRight="ArrowRight" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openIdea(r.idea.id) }}>{ACTION_META[r.action].verb}</Button> },
  ]

  return (
    <div className="pb-8">
      <PageHeader icon="Inbox" title="My queue" fit
        subtitle={`Ideas waiting for your action · ${ROLE_LABEL[primaryRole(me)]}${me.department && me.department !== 'Supplier' ? ` · ${me.department}` : ''}${myCommodities.length ? ` · your commodities: ${myCommodities.join(', ')}` : ''}`}
        actions={override
          ? <Segmented size="sm" value={tab} onChange={(k) => setTab(k as 'mine' | 'all')} options={[{ key: 'mine', label: `Assigned to me · ${q.mine.length}` }, { key: 'all', label: `All pending · ${q.all.length}` }]} />
          : q.team.length ? <Segmented size="sm" value={tab} onChange={(k) => setTab(k as 'mine' | 'all')} options={[{ key: 'all', label: `Me + my team · ${q.all.length}` }, { key: 'mine', label: `Assigned to me · ${q.mine.length}` }]} /> : undefined} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-line text-[12.5px]"><b className="text-ink num">{rows.length}</b><span className="text-muted">waiting</span></span>
        {!override && teamInView > 0 && <>
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-line text-[12.5px]"><b className="text-brand-700 num">{rows.length - teamInView}</b><span className="text-muted">assigned to you</span></span>
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-50 border border-line text-[12.5px] text-ink-2"><Icon name="UsersRound" size={14} /><b className="num">{teamInView}</b> with your team
            <InfoTip title="With your team">Each idea is routed to one person: in {me.department === 'Sourcing' ? 'Sourcing, the commodity lead or buyer of the idea’s commodity' : `${me.department}, the holder of that role`}. Colleagues with the same role in {me.department} may act on it too, so it is listed here after your own.</InfoTip></span>
        </>}
        {breached > 0 && <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-50 border border-red-100 text-[12.5px] text-red-700"><Icon name="Siren" size={14} /><b className="num">{breached}</b> beyond SLA</span>}
        {counts.map((c) => <span key={c.a} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-50 border border-brand-100 text-[12.5px] text-brand-800"><Icon name={ACTION_META[c.a].icon} size={14} />{ACTION_META[c.a].label}<b className="num">{c.n}</b></span>)}
      </div>
      <Card pad={false}>
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.idea.id} onRowClick={(r) => openIdea(r.idea.id)} exportName="COIN_My_queue" maxHeight={680}
          empty={<EmptyState icon="CircleCheckBig" title="Nothing waiting for you" desc="Ideas land here when they reach your stage of the workflow." />} />
      </Card>
    </div>
  )
}
