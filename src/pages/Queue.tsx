// My queue — every idea waiting for my action (assigned by the department ladder), how long it has waited and its SLA.
// Sourcing Head and Admin get a second tab with every open item across departments.
import { useState } from 'react'
import { useMe, useStore } from '../store/useStore'
import { ROLE_LABEL, primaryRole } from '../lib/nav'
import { ideaAnnualised } from '../lib/calc'
import { stageLabel, ideaDept } from '../lib/workflow'
import { inrShort } from '../lib/format'
import { Badge, Button, Card, DataTable, EmptyState, Icon, PageHeader, Segmented, cn, type Column } from '../components/ui'
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
  const openIdea = useStore((s) => s.openIdea)
  const override = !!me && (me.roles.includes('head') || me.roles.includes('admin'))
  const [tab, setTab] = useState<'mine' | 'all'>('mine')
  if (!me) return null
  const rows = tab === 'all' ? q.all : q.mine
  const nameOf = (id?: string) => users.find((u) => u.id === id)?.name ?? '—'
  const counts = (Object.keys(ACTION_META) as (keyof typeof ACTION_META)[]).map((a) => ({ a, n: rows.filter((r) => r.action === a).length })).filter((x) => x.n)
  const breached = rows.filter((r) => r.sla === 'breach').length

  const cols: Column<QueueRow>[] = [
    { key: 'sla', label: 'SLA', value: (r) => r.sla, width: 110, render: (r) => <Badge color={SLA_STYLE[r.sla].color} dot>{SLA_STYLE[r.sla].label}</Badge> },
    { key: 'idea', label: 'Idea', value: (r) => r.idea.id, render: (r) => (
      <div className="min-w-[220px] max-w-[420px]">
        <div className="font-mono text-[11.5px] font-semibold text-brand-700">{r.idea.id}</div>
        <div className="text-[12.5px] text-ink truncate">{r.idea.title}</div>
      </div>) },
    { key: 'stage', label: 'Waiting for', value: (r) => stageLabel(r.idea, r.idea.stage), render: (r) => (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2"><Icon name={ACTION_META[r.action].icon} size={14} className="text-brand-600" />{stageLabel(r.idea, r.idea.stage)}</span>) },
    { key: 'dept', label: 'Department', value: (r) => ideaDept(r.idea), render: (r) => <span className="text-[12.5px] text-ink-2">{ideaDept(r.idea)}</span> },
    { key: 'submitter', label: 'Raised by', value: (r) => r.idea.submitterName, render: (r) => <span className="text-[12.5px] text-ink-2 whitespace-nowrap">{r.idea.submitterName}</span> },
    ...(tab === 'all' ? [{ key: 'assignee', label: 'Assigned to', value: (r: QueueRow) => nameOf(r.assignee), render: (r: QueueRow) => <span className="text-[12.5px] text-ink-2 whitespace-nowrap">{nameOf(r.assignee)}</span> } as Column<QueueRow>] : []),
    { key: 'value', label: 'Forecast', align: 'right', value: (r) => Math.round(ideaAnnualised(r.idea)), render: (r) => <span className="num font-semibold text-ink">{inrShort(ideaAnnualised(r.idea))}</span> },
    { key: 'waiting', label: 'Waiting', align: 'right', value: (r) => r.waitingHours, render: (r) => <span className={cn('num', r.sla === 'breach' ? 'text-red-700 font-semibold' : 'text-ink-2')}>{waitingText(r.waitingHours)}{r.slaDays ? <span className="text-muted font-normal"> / {r.slaDays} d SLA</span> : null}</span> },
    { key: 'go', label: '', align: 'right', render: (r) => <Button size="xs" variant={r.assignedToMe ? 'primary' : 'secondary'} iconRight="ArrowRight" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openIdea(r.idea.id) }}>{ACTION_META[r.action].verb}</Button> },
  ]

  return (
    <div className="pb-8">
      <PageHeader icon="Inbox" title="My queue" fit
        subtitle={`Ideas waiting for your action · ${ROLE_LABEL[primaryRole(me)]}${me.department && me.department !== 'Supplier' ? ` · ${me.department}` : ''}`}
        actions={override ? <Segmented size="sm" value={tab} onChange={(k) => setTab(k as 'mine' | 'all')} options={[{ key: 'mine', label: `Assigned to me · ${q.mine.length}` }, { key: 'all', label: `All pending · ${q.all.length}` }]} /> : undefined} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-line text-[12.5px]"><b className="text-ink num">{rows.length}</b><span className="text-muted">waiting</span></span>
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
