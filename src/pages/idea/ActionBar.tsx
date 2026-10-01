// Contextual action bar — actions by role & stage, negative actions need remarks (Section 8, M5).
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Button, Icon, RemarksModal, cn } from '../../components/ui'
import { STAGE_SHORT } from '../../lib/masters'
import { ideaPerms, stagesOf, useCtx, waitingOn, withUndo } from './model'
import { DropModal, FeasibilityModal, MarkDoneModal, ReassignModal, TechEvalModal } from './Modals'

type ModalKey = null | 'validate' | 'feasibility' | 'feasibilityBehalf' | 'go' | 'nogo' | 'approve' | 'reject' | 'sendBack' | 'requestInfo' | 'reassign' | 'drop' | 'done' | 'advance'

export function ActionBar({ idea, compact, className }: { idea: Idea; compact?: boolean; className?: string }) {
  const me = useMe()
  const ctx = useCtx()
  const nav = useNavigate()
  const advance = useStore((s) => s.advance)
  const approve = useStore((s) => s.approve)
  const reject = useStore((s) => s.reject)
  const sendBack = useStore((s) => s.sendBack)
  const requestInfo = useStore((s) => s.requestInfo)
  const toast = useStore((s) => s.toast)
  const [modal, setModal] = useState<ModalKey>(null)
  const p = ideaPerms(me, idea)
  const close = () => setModal(null)
  const size = compact ? 'sm' : 'md'
  const stages = stagesOf(idea)
  const idx = stages.indexOf(idea.stage)
  const next = idx >= 0 ? stages[idx + 1] : undefined
  const prev = idx > 0 ? stages[idx - 1] : null
  const pending = idea.approvals.filter((a) => !a.decision)

  const primary: ReactNode[] = []
  const secondary: ReactNode[] = []
  if (p.continueDraft) primary.push(<Button key="draft" size={size} variant="primary" icon="PencilLine" onClick={() => nav(`/submit?draft=${idea.id}`)}>Continue editing</Button>)
  if (p.validate) primary.push(<Button key="val" size={size} variant="primary" icon="BadgeCheck" onClick={() => setModal('validate')}>Validate</Button>)
  if (p.feasibility) primary.push(<Button key="feas" size={size} variant="primary" icon="ClipboardCheck" onClick={() => setModal('feasibility')}>Respond to feasibility</Button>)
  if (p.feasibilityOnBehalf) primary.push(<Button key="feasb" size={size} variant="outline" icon="ClipboardCheck" onClick={() => setModal('feasibilityBehalf')}>Respond feasibility on behalf</Button>)
  if (p.techeval) {
    primary.push(<Button key="go" size={size} variant="success" icon="CircleCheck" onClick={() => setModal('go')}>Technical Go</Button>)
    primary.push(<Button key="nogo" size={size} variant="danger" icon="CircleX" onClick={() => setModal('nogo')}>No-go</Button>)
  }
  if (p.approve) {
    primary.push(<Button key="appr" size={size} variant="success" icon="Stamp" onClick={() => setModal('approve')}>Approve{pending.length > 1 ? ` (${pending[0].level})` : ''}</Button>)
    primary.push(<Button key="rej" size={size} variant="danger" icon="CircleX" onClick={() => setModal('reject')}>Reject</Button>)
  }
  if (p.advance) primary.push(<Button key="adv" size={size} variant="primary" icon="ArrowRight" onClick={() => setModal('advance')}>Move to {STAGE_SHORT[p.advance] ?? p.advance}</Button>)
  if (p.markDone) primary.push(<Button key="done" size={size} variant="success" icon="CircleCheckBig" onClick={() => setModal('done')}>Mark Done</Button>)
  if (p.sendBack) secondary.push(<Button key="sb" size={size} variant="secondary" icon="Undo2" onClick={() => setModal('sendBack')}>Send back</Button>)
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
      <RemarksModal open={modal === 'validate'} onClose={close} required={false} icon="BadgeCheck" confirmLabel="Validate"
        title="Validate idea" subtitle={`Confirms baseline (LBP) and volume (MRN FY26), then moves ${idea.id} to ${next ?? 'the next stage'}.`} placeholder="Optional remarks for the submitter"
        onConfirm={(r) => withUndo(idea.id, () => advance(idea.id, 'Validated by buyer — baseline confirmed', r || undefined), `${idea.id} validated — moved to ${next}`)} />
      <RemarksModal open={modal === 'approve'} onClose={close} required={false} icon="Stamp" variant="success" confirmLabel="Approve"
        title={`Approve — ${pending[0]?.level ?? 'Approver'}`} subtitle={pending.length > 1 ? `After your approval the idea goes to ${pending[1].level} (approval matrix).` : 'Final approval — the idea enters the Execution Hub with an owner and a 31 March due date.'}
        onConfirm={(r) => withUndo(idea.id, () => approve(idea.id, r || undefined), pending.length > 1 ? `Approved at ${pending[0].level} level — pending ${pending[1].level}` : `${idea.id} approved — entered the Execution Hub`)} />
      <RemarksModal open={modal === 'reject'} onClose={close} variant="danger" icon="CircleX" confirmLabel="Reject" title="Reject idea" subtitle="Remarks are mandatory on negative actions and are shared with the submitter and buyer."
        onConfirm={(r) => { reject(idea.id, r); toast(`${idea.id} rejected`, 'warning') }} />
      <RemarksModal open={modal === 'sendBack'} onClose={close} variant="danger" icon="Undo2" confirmLabel="Send back" title="Send back"
        subtitle={prev ? `Returns ${idea.id} to ${prev}.` : `Returns ${idea.id} to the submitter for rework.`}
        onConfirm={(r) => withUndo(idea.id, () => sendBack(idea.id, r), prev ? `${idea.id} sent back to ${prev}` : `${idea.id} returned to ${idea.submitterName}`, { type: 'warning' })} />
      <RemarksModal open={modal === 'requestInfo'} onClose={close} icon="MessageCircleQuestion" confirmLabel="Request info" title="Request more information"
        subtitle={`${idea.submitterName} is notified and @mentioned in the comments.`} placeholder="What do you need from the submitter?"
        onConfirm={(r) => withUndo(idea.id, () => requestInfo(idea.id, r), `More information requested from ${idea.submitterName}`, { type: 'info' })} />
      <RemarksModal open={modal === 'advance'} onClose={close} required={false} icon="ArrowRight" confirmLabel={`Move to ${p.advance ? STAGE_SHORT[p.advance] ?? p.advance : ''}`}
        title={`Move to ${p.advance ?? ''}`} subtitle={`${idea.id} leaves ${idea.stage}.`}
        onConfirm={(r) => p.advance && withUndo(idea.id, () => advance(idea.id, `Moved to ${p.advance}`, r || undefined), `${idea.id} moved to ${p.advance}`)} />
      <FeasibilityModal idea={idea} open={modal === 'feasibility' || modal === 'feasibilityBehalf'} onBehalf={modal === 'feasibilityBehalf'} onClose={close} />
      <TechEvalModal idea={idea} open={modal === 'go' || modal === 'nogo'} initial={modal === 'nogo' ? 'No-go' : 'Go'} onClose={close} />
      <ReassignModal idea={idea} open={modal === 'reassign'} onClose={close} />
      <DropModal idea={idea} open={modal === 'drop'} onClose={close} />
      <MarkDoneModal idea={idea} open={modal === 'done'} onClose={close} />
    </div>
  )
}
