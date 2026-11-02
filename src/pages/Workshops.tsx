// Workshops — every idea at stage 2: its next event, the step to do now and which department ID runs it.
// A department ID sees the workshops it runs; the Management ID sees them all.
import { useMemo, useState } from 'react'
import { useMe, useStore } from '../store/useStore'
import { ideaAnnualised } from '../lib/calc'
import { ideaDept } from '../lib/workflow'
import { fmtDate, inrShort } from '../lib/format'
import { Badge, Button, Card, DataTable, EmptyState, Icon, PageHeader, type Column } from '../components/ui'
import { workshopRows, type WorkshopRow, type WorkshopStatus } from './workshops/model'
import { StageGuideModal } from './workshops/StageGuide'
import { NextStep } from './idea/WorkshopSteps'

const STATUS_STYLE: Record<WorkshopStatus, { color: string; icon: string }> = {
  'To schedule': { color: 'var(--color-amber-600)', icon: 'CalendarPlus' },
  Scheduled: { color: 'var(--color-brand-600)', icon: 'CalendarClock' },
  'Ready for Go ahead': { color: 'var(--color-emerald-600)', icon: 'CircleCheck' },
}

export default function Workshops() {
  const me = useMe()
  const ideas = useStore((s) => s.ideas)
  const users = useStore((s) => s.users)
  const openIdea = useStore((s) => s.openIdea)
  const [guide, setGuide] = useState(false)
  const rows = useMemo(() => (me ? workshopRows(ideas, me, users) : []), [ideas, me, users])
  if (!me) return null
  const all = me.roles.includes('admin')
  const counts = (Object.keys(STATUS_STYLE) as WorkshopStatus[]).map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((x) => x.n)

  const cols: Column<WorkshopRow>[] = [
    { key: 'status', label: 'Status', value: (r) => r.status, width: 160, render: (r) => <Badge color={STATUS_STYLE[r.status].color} icon={STATUS_STYLE[r.status].icon}>{r.status}</Badge> },
    { key: 'idea', label: 'Idea', value: (r) => r.idea.id, render: (r) => (
      <div className="min-w-[200px] max-w-[min(360px,22vw)]">
        <div className="text-[11.5px] truncate"><span className="font-mono font-semibold text-brand-700">{r.idea.id}</span><span className="text-muted"> · raised by {r.idea.submitterName}</span></div>
        <div className="text-[12.5px] text-ink truncate">{r.idea.title}</div>
      </div>) },
    ...(all ? [{ key: 'dept', label: 'Run by', value: (r: WorkshopRow) => ideaDept(r.idea), render: (r: WorkshopRow) => <span className="text-[12.5px] text-ink-2 whitespace-nowrap">{ideaDept(r.idea)} ID</span> } as Column<WorkshopRow>] : []),
    { key: 'event', label: 'Next event', value: (r) => r.event?.date ?? '', render: (r) => (r.event
      ? <div className="min-w-[170px]"><div className="text-[12.5px] text-ink whitespace-nowrap">Event {r.event.no} · {fmtDate(r.event.date)}{r.event.time ? `, ${r.event.time}` : ''}</div><div className="text-[11px] text-muted truncate max-w-[220px]">{r.event.venue} · SPOC {r.event.spoc.name}</div></div>
      : <span className="text-[12px] text-muted whitespace-nowrap">{r.held ? `${r.held} held, next one not set` : 'No event yet'}</span>) },
    { key: 'next', label: 'Next step', value: (r) => r.steps.find((s) => s.now)?.label ?? '', render: (r) => <NextStep steps={r.steps} /> },
    { key: 'value', label: 'Opportunity cost', align: 'right', value: (r) => Math.round(ideaAnnualised(r.idea)), render: (r) => <span className="num font-semibold text-ink">{inrShort(ideaAnnualised(r.idea))}</span> },
    { key: 'go', label: '', align: 'right', render: (r) => <Button size="xs" variant="secondary" iconRight="ArrowRight" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openIdea(r.idea.id) }}>Open</Button> },
  ]

  return (
    <div className="pb-8">
      <PageHeader icon="CalendarCheck" title="Workshops" fit
        subtitle={`Stage 2 · ${all ? 'every department' : `the workshops the ${me.department} ID runs`}`}
        actions={<Button size="sm" variant="secondary" icon="Route" onClick={() => setGuide(true)}>Who does what</Button>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-line text-[12.5px]"><b className="text-ink num">{rows.length}</b><span className="text-muted">at the workshop stage</span></span>
        {counts.map((c) => <span key={c.s} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-line text-[12.5px] text-ink-2"><Icon name={STATUS_STYLE[c.s].icon} size={14} style={{ color: STATUS_STYLE[c.s].color }} /><b className="num text-ink">{c.n}</b>{c.s}</span>)}
      </div>
      <Card pad={false}>
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.idea.id} onRowClick={(r) => openIdea(r.idea.id)} exportName="COIN_Workshops" maxHeight={680}
          empty={<EmptyState icon="CalendarCheck" title="No workshop to run" desc="An idea lands here as soon as it is submitted for this department." />} />
      </Card>
      <StageGuideModal open={guide} onClose={() => setGuide(false)} />
    </div>
  )
}
