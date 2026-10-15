// Idea page — one card per stage form (2 feasibility, 3 evaluation, 4 sourcing approval, 6 verification), read-only
// summaries with "Open" when the signed-in user can act on that stage.
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { STAGE, WORKFLOW_STAGES } from '../../lib/masters'
import { ideaAnnualised } from '../../lib/calc'
import { overallRisk, riskTotal, stageLabel } from '../../lib/workflow'
import { fmtDate, inrShort } from '../../lib/format'
import { Badge, Button, Icon, Money, cn } from '../../components/ui'
import { ideaPerms } from './model'
import { EvaluationModal, FeasibilityCheckModal, SourcingApprovalModal, SupplierResponseCard, VerificationModal } from './StageForms'

const reached = (idea: Idea, stage: string) => {
  const ref = idea.bucket === 'Dropped' ? idea.dropStage ?? '' : idea.stage
  return WORKFLOW_STAGES.indexOf(ref) >= WORKFLOW_STAGES.indexOf(stage)
}

function Shell({ n, title, icon, tone, status, action, children }: { n: number; title: string; icon: string; tone: string; status: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-3.5 flex flex-col min-w-0">
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tone }} />
      <div className="flex items-center gap-2 mb-2.5">
        <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 8%, transparent)`, color: tone }}><Icon name={icon} size={14} /></span>
        <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">Stage {n}</div><div className="text-[13.5px] font-semibold text-ink leading-tight truncate">{title}</div></div>
        {status}
      </div>
      <div className="flex-1 min-w-0 text-[12.5px]">{children}</div>
      {action && <div className="mt-2.5 pt-2.5 border-t border-dashed border-line">{action}</div>}
    </section>
  )
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex items-baseline justify-between gap-3 py-[3px]"><span className="text-muted shrink-0">{k}</span><span className="font-medium text-ink text-right truncate min-w-0">{v}</span></div>
const Waiting = ({ children }: { children: React.ReactNode }) => <div className="text-muted leading-relaxed">{children}</div>
const GREEN = 'var(--color-emerald-600)', ORANGE = 'var(--color-orange-400)', GREY = 'var(--color-slate-400)', RED = 'var(--color-accent-500)'

export function StagePanels({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const me = useMe()
  const nav = useNavigate()
  const p = ideaPerms(me, idea)
  const [open, setOpen] = useState<null | 'feas' | 'eval' | 'appr' | 'verify'>(null)
  const close = () => setOpen(null)
  const f = idea.feasibilityCheck
  const ev = idea.evaluation
  const lock = idea.lock
  const v = idea.verification
  const annual = ideaAnnualised(idea)
  const dropped = idea.bucket === 'Dropped'
  const at = (s: string) => idea.stage === s

  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-4')}>
      {/* Stage 2 */}
      <Shell n={2} title={STAGE.feasibility} icon="UsersRound" tone={f ? (f.decision === 'Go' ? GREEN : RED) : at(STAGE.feasibility) ? ORANGE : GREY}
        status={<Badge color={f ? (f.decision === 'Go' ? GREEN : RED) : at(STAGE.feasibility) ? ORANGE : GREY}>{f ? f.decision : at(STAGE.feasibility) ? 'In check' : 'Pending'}</Badge>}
        action={p.feasibilityCheck ? <Button size="sm" variant="primary" icon="ClipboardCheck" onClick={() => setOpen('feas')}>Open feasibility check</Button> : undefined}>
        {f ? (
          <>
            <Row k="Technically feasible" v={f.technical === 'Yes' ? 'Yes' : 'No'} />
            <Row k="Cost" v={f.cost} />
            <Row k="Duplicate / conflict" v={f.conflict === 'None' ? 'None' : `${f.conflict} · ${f.conflictWith ?? ''}`} />
            <Row k="Departments" v={f.departments.join(', ')} />
            <Row k="By" v={`${f.by} · ${fmtDate(f.at.slice(0, 10))}`} />
            {f.remarks && <div className="mt-1 text-muted italic truncate" title={f.remarks}>“{f.remarks}”</div>}
          </>
        ) : <Waiting>{dropped ? 'Not reached.' : 'The feasibility team checks technical feasibility, cost validity and duplicates, then decides Go / No-go.'}</Waiting>}
      </Shell>

      {/* Stage 3 */}
      <Shell n={3} title={stageLabel(idea, STAGE.evaluation)} icon="FlaskConical" tone={ev?.decision ? (ev.decision === 'Recommend' ? GREEN : RED) : at(STAGE.evaluation) ? ORANGE : GREY}
        status={<Badge color={ev?.decision ? (ev.decision === 'Recommend' ? GREEN : RED) : at(STAGE.evaluation) ? ORANGE : GREY}>{ev?.decision ? (ev.decision === 'Recommend' ? 'Recommended' : 'Rejected') : at(STAGE.evaluation) ? 'In evaluation' : 'Pending'}</Badge>}
        action={p.evaluate ? <div className="flex flex-wrap gap-1.5"><Button size="sm" variant="primary" icon="FlaskConical" onClick={() => setOpen('eval')}>Open evaluation</Button>{ev?.supplier && (ev.supplier.status === 'Not sent' || ev.supplier.status === 'Sent') && <Button size="sm" icon="Mail" onClick={() => nav(`/ideas/${idea.id}/supplier-check`)}>Supplier check</Button>}</div> : undefined}>
        {ev && reached(idea, STAGE.evaluation) ? (
          <>
            <Row k="Cost-benefit" v={ev.cbaVerified ? <span className="text-emerald-700">Verified</span> : 'To verify'} />
            <Row k="Risk" v={ev.risks?.length ? `${overallRisk(ev.risks)} · ${inrShort(riskTotal(ev.risks))} at risk` : 'To assess'} />
            <Row k="Supplier capability" v={ev.supplier?.status === 'Responded' ? `${ev.supplier.supplierName} — ${ev.supplier.response?.canSupply}` : ev.supplier?.status === 'Skipped' ? 'Skipped (< ₹ 5 L)' : ev.supplier?.status === 'Sent' ? `Sent to ${ev.supplier.supplierName}` : 'Not sent'} />
            {ev.by && <Row k="By" v={`${ev.by} · ${fmtDate(ev.at?.slice(0, 10))}`} />}
            {ev.remarks && <div className="mt-1 text-muted italic truncate" title={ev.remarks}>“{ev.remarks}”</div>}
          </>
        ) : <Waiting>{dropped ? 'Not reached.' : `The ${stageLabel(idea, STAGE.evaluation)} covers a detailed cost-benefit analysis, a risk assessment and a supplier capability check (skipped below ₹ 5 L).`}</Waiting>}
      </Shell>

      {/* Stage 4 */}
      <Shell n={4} title={STAGE.approval} icon="Stamp" tone={lock ? GREEN : at(STAGE.approval) ? ORANGE : GREY}
        status={<Badge color={lock ? GREEN : at(STAGE.approval) ? ORANGE : GREY}>{lock && idea.approvedAt ? 'Approved · locked' : lock ? 'Lock signed' : at(STAGE.approval) ? 'Awaiting approval' : 'Pending'}</Badge>}
        action={p.approve ? <Button size="sm" variant="primary" icon="Signature" onClick={() => setOpen('appr')}>{lock ? 'Approve' : 'Sign lock & approve'}</Button> : undefined}>
        {lock ? (
          <>
            <Row k="Locked target" v={<Money value={lock.targetSaving} />} />
            <Row k="Timeline" v={`${lock.timelineMonths} months · ${fmtDate(lock.startDate)} → ${fmtDate(lock.endDate)}`} />
            <Row k="Budget" v={inrShort(lock.budget)} />
            <Row k="Supplier alignment" v={lock.supplierAligned} />
            <Row k="Signed" v={`${lock.signedBy} · ${fmtDate(lock.signedAt.slice(0, 10))}`} />
          </>
        ) : <Waiting>{dropped ? 'Not reached.' : `Commercial assessment, supplier alignment and a signed budget + timeline lock (target = ${inrShort(annual)} × months ÷ 12) — then the idea moves to Cost Optimisation.`}</Waiting>}
      </Shell>

      {/* Stage 6 */}
      <Shell n={6} title={v?.verifiedAt ? 'Verified' : STAGE.verification} icon="ShieldCheck" tone={v?.verifiedAt ? GREEN : at(STAGE.verification) ? ORANGE : GREY}
        status={<Badge color={v?.verifiedAt ? GREEN : at(STAGE.verification) ? ORANGE : GREY}>{v?.verifiedAt ? 'Verified' : at(STAGE.verification) ? 'Awaiting verification' : v?.returnedAt ? 'Returned' : 'Pending'}</Badge>}
        action={p.verify ? <Button size="sm" variant="success" icon="ShieldCheck" onClick={() => setOpen('verify')}>Verify savings</Button> : undefined}>
        {v?.handedAt ? (
          <>
            <Row k="Handed over" v={`${v.handedBy ?? '—'} · ${fmtDate(v.handedAt.slice(0, 10))}`} />
            <Row k="First MRN at new price" v={fmtDate(idea.execution?.effectiveDate)} />
            {v.verifiedAt && <Row k="Verified" v={`${v.verifiedBy} · ${fmtDate(v.verifiedAt.slice(0, 10))}`} />}
            {v.realisedAtVerification != null && <Row k="Realised vs due" v={`${inrShort(v.realisedAtVerification)} / ${inrShort(v.targetAtVerification ?? 0)}`} />}
            {v.remarks && <div className="mt-1 text-muted italic truncate" title={v.remarks}>“{v.remarks}”</div>}
          </>
        ) : v?.returnedAt ? <Waiting>Returned to execution on {fmtDate(v.returnedAt.slice(0, 10))}: {v.returnReason}</Waiting>
          : <Waiting>{dropped ? 'Not reached.' : 'After the hand-over the business side checks MRN at the approved price, Finance validation and the locked target.'}</Waiting>}
      </Shell>

      {!compact && ev?.supplier?.status === 'Responded' && <div className="md:col-span-2 2xl:col-span-4"><SupplierResponseCard idea={idea} /></div>}

      <FeasibilityCheckModal idea={idea} open={open === 'feas'} onClose={close} />
      <EvaluationModal idea={idea} open={open === 'eval'} onClose={close} />
      <SourcingApprovalModal idea={idea} open={open === 'appr'} onClose={close} />
      <VerificationModal idea={idea} open={open === 'verify'} onClose={close} />
    </div>
  )
}
