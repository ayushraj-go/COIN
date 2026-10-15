// Contextual action bar — the stage form for the signed-in user's role, plus send back / request info / reassign / drop.
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Button, Icon, RemarksModal, cn } from '../../components/ui'
import { STAGE } from '../../lib/masters'
import { stageLabel } from '../../lib/workflow'
import { ideaPerms, useCtx, waitingOn, withUndo } from './model'
import { DropModal, MarkDoneModal, ReassignModal } from './Modals'
import { EvaluationModal, FeasibilityCheckModal, SourcingApprovalModal, VerificationModal } from './StageForms'

type ModalKey = null | 'feas' | 'eval' | 'appr' | 'verify' | 'sendBack' | 'requestInfo' | 'reassign' | 'drop' | 'done'

export function ActionBar({ idea, compact, className }: { idea: Idea; compact?: boolean; className?: string }) {
  const me = useMe()
  const ctx = useCtx()
  const nav = useNavigate()
  const sendBack = useStore((s) => s.sendBack)
  const requestInfo = useStore((s) => s.requestInfo)
  const [modal, setModal] = useState<ModalKey>(null)
  const p = ideaPerms(me, idea)
  const close = () => setModal(null)
  const size = compact ? 'sm' : 'md'
  const atStart = idea.stage === STAGE.feasibility

  const primary: ReactNode[] = []
  const secondary: ReactNode[] = []
  if (p.continueDraft) primary.push(<Button key="draft" size={size} variant="primary" icon="PencilLine" onClick={() => nav(`/submit?draft=${idea.id}`)}>Continue editing</Button>)
  if (p.feasibilityCheck) primary.push(<Button key="feas" size={size} variant="primary" icon="ClipboardCheck" onClick={() => setModal('feas')}>Team feasibility check</Button>)
  if (p.evaluate) primary.push(<Button key="eval" size={size} variant="primary" icon="FlaskConical" onClick={() => setModal('eval')}>{stageLabel(idea, STAGE.evaluation)}</Button>)
  if (p.approve) primary.push(<Button key="appr" size={size} variant="success" icon="Signature" onClick={() => setModal('appr')}>{idea.lock ? stageLabel(idea, STAGE.approval) : 'Sign lock & approve'}</Button>)
  if (p.handOver) primary.push(<Button key="done" size={size} variant="success" icon="PackageCheck" onClick={() => setModal('done')}>Hand over for verification</Button>)
  if (p.verify) primary.push(<Button key="verify" size={size} variant="success" icon="ShieldCheck" onClick={() => setModal('verify')}>Verify savings</Button>)
  if (p.sendBack && !atStart) secondary.push(<Button key="sb" size={size} variant="secondary" icon="Undo2" onClick={() => setModal('sendBack')}>Send back</Button>)
  if (p.requestInfo) secondary.push(<Button key="ri" size={size} variant="secondary" icon="MessageCircleQuestion" onClick={() => setModal('requestInfo')}>Request info</Button>)
  if (p.reassign) secondary.push(<Button key="ra" size={size} variant="secondary" icon="UserRoundCog" onClick={() => setModal('reassign')}>Reassign</Button>)
  if (p.drop) secondary.push(<Button key="dr" size={size} variant="danger" icon="Ban" onClick={() => setModal('drop')}>Drop</Button>)

  const hasActions = primary.length + secondary.length > 0
  return (
    <div className={cn('flex flex-col gap-2 min-w-0', !compact && 'lg:flex-row lg:items-center lg:justify-between', className)}>
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
        <div className="text-[11.5px] text-muted flex items-center gap-1.5"><Icon name="Eye" size={13} />View only for your role at this stage</div>
      )}

      {/* ── dialogs ── */}
      <FeasibilityCheckModal idea={idea} open={modal === 'feas'} onClose={close} />
      <EvaluationModal idea={idea} open={modal === 'eval'} onClose={close} />
      <SourcingApprovalModal idea={idea} open={modal === 'appr'} onClose={close} />
      <VerificationModal idea={idea} open={modal === 'verify'} onClose={close} />
      <RemarksModal open={modal === 'sendBack'} onClose={close} variant="danger" icon="Undo2" confirmLabel="Send back" title="Send back to the Team feasibility check"
        subtitle={`${idea.id} returns to the Team feasibility check for rework; the evaluation restarts after it is cleared again.`}
        onConfirm={(r) => withUndo(idea.id, () => sendBack(idea.id, r), `${idea.id} sent back to the Team feasibility check`, { type: 'warning' })} />
      <RemarksModal open={modal === 'requestInfo'} onClose={close} icon="MessageCircleQuestion" confirmLabel="Request info" title="Request more information"
        subtitle={`${idea.submitterName} is notified and @mentioned in the comments.`} placeholder="What do you need from the submitter?"
        onConfirm={(r) => withUndo(idea.id, () => requestInfo(idea.id, r), `More information requested from ${idea.submitterName}`, { type: 'info' })} />
      <ReassignModal idea={idea} open={modal === 'reassign'} onClose={close} />
      <DropModal idea={idea} open={modal === 'drop'} onClose={close} />
      <MarkDoneModal idea={idea} open={modal === 'done'} onClose={close} />
    </div>
  )
}
