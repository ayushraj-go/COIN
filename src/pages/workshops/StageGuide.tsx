// Who does what — the five stages with the ID that works each one. Each row opens that stage signed in as that ID.
import { useNavigate } from 'react-router-dom'
import { Button, Icon, Modal } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { STAGE_GUIDE, busiestId, type StageGuideRow } from './model'

export function StageGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const ideas = useStore((s) => s.ideas)
  const users = useStore((s) => s.users)
  const idFor = (g: StageGuideRow) => g.fixedId ?? busiestId(ideas, g.stage, users) ?? users.find((u) => u.active !== false)?.id
  const nameOf = (id?: string) => users.find((u) => u.id === id)?.name ?? ''
  const openStage = (g: StageGuideRow) => {
    const id = idFor(g)
    if (!id) return
    const { loginAs, setSpace, toast } = useStore.getState()
    loginAs(id)
    setSpace(g.space)
    onClose()
    nav(g.path, { replace: true })
    toast(`Signed in as ${nameOf(id)}`)
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" icon="Route" title="Who does what" subtitle="One ID works each stage. Open a stage to see it as that ID.">
      <div className="grid gap-2">
        {STAGE_GUIDE.map((g, i) => (
          <div key={g.stage} className="rounded-xl border border-line px-3 py-2.5 grid sm:grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 gap-y-2 items-center">
            <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 grid place-items-center text-[12.5px] font-bold num">{i + 1}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">{g.stage}</div>
              <div className="text-[12px]"><span className="font-semibold text-brand-700">{g.role}</span><span className="text-muted"> · {g.who}</span></div>
              <div className="text-[12px] text-ink-2">{g.does}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted mt-0.5"><Icon name="MapPin" size={11} />{g.space === 'IN' ? 'Innovation Network' : 'Cost Optimisation'} · {g.where}</div>
            </div>
            <Button size="sm" variant="secondary" iconRight="ArrowRight" onClick={() => openStage(g)}>Open as {nameOf(idFor(g))}</Button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
