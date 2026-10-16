// Stage 3 — supplier capability check as its own page (the evaluation sheet shows the same panel in step 3).
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMe, useStore } from '../store/useStore'
import { canSeeIdea, ideaAnnualised } from '../lib/calc'
import { inrShort } from '../lib/format'
import { stageLabel } from '../lib/workflow'
import { STAGE } from '../lib/masters'
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from '../components/ui'
import { SupplierCheckPanel } from './idea/SupplierCheckPanel'

export default function SupplierCheck() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const idea = useStore((s) => s.ideas.find((i) => i.id === id))
  // the page takes the whole screen — close the idea side panel it may have been opened from
  useEffect(() => { useStore.getState().openIdea(null) }, [])

  if (!idea) return <Card><EmptyState icon="SearchX" title={`Idea ${id} not found`} action={<Button onClick={() => nav('/ideas')}>Go to ideas</Button>} /></Card>
  if (!me || !canSeeIdea(me, idea)) return <Card><EmptyState icon="ShieldX" title="You don't have access to this idea" desc="Visibility follows your role and commodity mapping." action={<Button onClick={() => nav('/')}>Go home</Button>} /></Card>
  const sc = idea.evaluation?.supplier

  return (
    <div className="pb-8">
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted mb-2">
        <button onClick={() => nav(`/ideas/${idea.id}`)} className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-lg hover:bg-white hover:text-ink font-medium"><Icon name="ChevronLeft" size={15} />{idea.id}</button>
        <span className="text-slate-300">/</span><span className="text-ink font-semibold">Supplier capability check</span>
      </div>
      <PageHeader icon="Factory" title="Supplier capability check" fit
        badge={<Badge color={sc?.status === 'Responded' ? 'var(--color-emerald-600)' : sc?.status === 'Sent' ? 'var(--color-orange-400)' : 'var(--color-slate-500)'}>{sc?.status ?? 'Not sent'}</Badge>}
        subtitle={`${stageLabel(idea, STAGE.evaluation)} · ${idea.title} · forecast ${inrShort(ideaAnnualised(idea))}`}
        actions={<Button size="sm" icon="FlaskConical" onClick={() => nav(`/ideas/${idea.id}`)}>Back to the idea</Button>} />
      <SupplierCheckPanel idea={idea} />
    </div>
  )
}
