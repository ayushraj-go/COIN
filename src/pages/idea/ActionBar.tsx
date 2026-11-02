// Contextual action bar — the stage form for the signed-in ID, plus send back (to the stage chosen) / request info / drop.
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Button, Icon, RemarksModal, cn } from '../../components/ui'
import { STAGE } from '../../lib/masters'
import { ideaAnnualised } from '../../lib/calc'
import { workshopSteps } from '../../lib/workflow'
import { ideaPerms, useCtx, waitingOn, withUndo } from './model'
import { DropModal, SendBackModal } from './Modals'
import { FeasibilityCheckModal, VerificationModal } from './StageForms'
import { EvaluationModal } from './EvaluationModal'
import { SourcingApprovalModal } from './ApprovalModal'
import { CloseEventModal, WorkshopEventModal } from './WorkshopModal'
import { WorkshopStepper } from './WorkshopSteps'

type ModalKey = null | 'event' | 'close' | 'feas' | 'eval' | 'appr' | 'verify' | 'sendBack' | 'requestInfo' | 'drop' | 'done'

export function ActionBar({ idea, compact, className }: { idea: Idea; compact?: boolean; className?: string }) {
  const me = useMe()
  const ctx = useCtx()
  const nav = useNavigate()
  const requestInfo = useStore((s) => s.requestInfo)
  const [modal, setModal] = useState<ModalKey>(null)
  const p = ideaPerms(me, idea)
  const close = () => setModal(null)
  const size = compact ? 'sm' : 'md'
  const atStart = idea.stage === STAGE.feasibility
  const openEvent = idea.workshop?.events.find((e) => e.status === 'Scheduled')

  const primary: ReactNode[] = []
  const secondary: ReactNode[] = []
  if (p.continueDraft) primary.push(<Button key="draft" size={size} variant="primary" icon="PencilLine" onClick={() => nav(`/submit?draft=${idea.id}`)}>Continue editing</Button>)
  // the workshop is a set of numbered steps under this row, the current one highlighted
  const steps = p.workshop ? workshopSteps(idea, ideaAnnualised(idea)) : []
  if (p.approve) primary.push(<Button key="appr" size={size} variant="success" icon="Signature" onClick={() => setModal('appr')}>{idea.lock ? 'Approve' : 'Allocate KPI & approve'}</Button>)
  if (p.verify) primary.push(<Button key="verify" size={size} variant="success" icon="ShieldCheck" onClick={() => setModal('verify')}>Verify savings</Button>)
  if (p.sendBack && !atStart) secondary.push(<Button key="sb" size={size} variant="secondary" icon="Undo2" onClick={() => setModal('sendBack')}>Send back…</Button>)
  if (p.requestInfo) secondary.push(<Button key="ri" size={size} variant="secondary" icon="MessageCircleQuestion" onClick={() => setModal('requestInfo')}>Request info</Button>)
  if (p.drop) secondary.push(<Button key="dr" size={size} variant="danger" icon="Ban" onClick={() => setModal('drop')}>Drop</Button>)

  const hasActions = primary.length + secondary.length > 0
  return (
    <div className={cn('grid gap-2.5 min-w-0', className)}>
      <div className={cn('flex flex-col gap-2 min-w-0', !compact && 'lg:flex-row lg:items-center lg:justify-between')}>
      <div className="flex items-center gap-2 min-w-0 text-[12px]">
        <span className={cn('h-2 w-2 rounded-full shrink-0', hasActions ? 'bg-brand-600 animate-pulse' : 'bg-slate-300')} />
        <span className="text-muted truncate">
          {hasActions ? <><span className="font-semibold text-ink-2">Your action</span> · </> : null}
          {waitingOn(idea, ctx)}
        </span>
      </div>
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {primary}
          {primary.length > 0 && secondary.length > 0 && <span className="hidden sm:block w-px h-5 bg-line mx-0.5" />}
          {secondary}
        </div>
      ) : (
        <div className="text-[11.5px] text-muted flex items-center gap-1.5"><Icon name="Eye" size={13} />View only for this ID at this stage</div>
      )}
      </div>
      {steps.length > 0 && <WorkshopStepper steps={steps} compact={compact} canClose={!!openEvent} onOpen={setModal} />}

      {/* ── dialogs ── */}
      <WorkshopEventModal idea={idea} open={modal === 'event'} onClose={close} />
      <CloseEventModal idea={idea} event={openEvent} open={modal === 'close'} onClose={close} />
      <FeasibilityCheckModal idea={idea} open={modal === 'feas'} onClose={close} />
      <EvaluationModal idea={idea} open={modal === 'eval'} onClose={close} />
      <SourcingApprovalModal idea={idea} open={modal === 'appr'} onClose={close} />
      <VerificationModal idea={idea} open={modal === 'verify'} onClose={close} />
      <SendBackModal idea={idea} open={modal === 'sendBack'} onClose={close} />
      <RemarksModal open={modal === 'requestInfo'} onClose={close} icon="MessageCircleQuestion" confirmLabel="Request info" title="Request more information"
        subtitle={`${idea.submitterName} is notified and @mentioned in the comments.`} placeholder="What do you need from the submitter?"
        onConfirm={(r) => withUndo(idea.id, () => requestInfo(idea.id, r), `More information requested from ${idea.submitterName}`, { type: 'info' })} />
      <DropModal idea={idea} open={modal === 'drop'} onClose={close} />
    </div>
  )
}
