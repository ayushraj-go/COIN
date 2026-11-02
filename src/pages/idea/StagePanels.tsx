// Idea page — one card per stage form (2 workshop event, technical feasibility and commercial evaluation, 3 management
// approval, 5 verification), read-only summaries with "Open" when the signed-in ID can act on that stage.
import React, { useState } from 'react'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { STAGE, WORKFLOW_STAGES } from '../../lib/masters'
import { ideaAnnualised } from '../../lib/calc'
import { overallRisk, riskTotal, workshopSteps, type WorkshopStepKey } from '../../lib/workflow'
import { fmtDate, inrShort, todayIso } from '../../lib/format'
import { Badge, Button, Icon, Money, cn } from '../../components/ui'
import { ideaPerms } from './model'
import { FeasibilityCheckModal, SupplierResponseCard, VerificationModal } from './StageForms'
import { EvaluationModal } from './EvaluationModal'
import { SourcingApprovalModal } from './ApprovalModal'
import { CloseEventModal, WorkshopEventModal } from './WorkshopModal'

const reached = (idea: Idea, stage: string) => {
  const ref = idea.bucket === 'Dropped' ? idea.dropStage ?? '' : idea.stage
  return WORKFLOW_STAGES.indexOf(ref) >= WORKFLOW_STAGES.indexOf(stage)
}

function Shell({ n, title, icon, tone, status, action, now, children }: { n: number | string; title: string; icon: string; tone: string; status: React.ReactNode; action?: React.ReactNode; now?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn('card relative overflow-hidden p-3.5 flex flex-col min-w-0', now && '!border-brand-500 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand-500)_16%,transparent)]')}>
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
  const p = ideaPerms(me, idea)
  const [open, setOpen] = useState<null | 'event' | 'close' | 'feas' | 'eval' | 'evalSupplier' | 'appr' | 'verify'>(null)
  const close = () => setOpen(null)
  const f = idea.feasibilityCheck
  const ev = idea.evaluation
  const lock = idea.lock
  const v = idea.verification
  const annual = ideaAnnualised(idea)
  const dropped = idea.bucket === 'Dropped'
  const at = (s: string) => idea.stage === s
  const events = idea.workshop?.events ?? []
  const openEvent = events.find((e) => e.status === 'Scheduled')
  const goAhead = !!idea.workshop?.goAheadAt
  // only the step to do now stands out
  const stepNow = p.workshop ? workshopSteps(idea, annual).find((s) => s.now)?.key : undefined
  const stepVariant = (k: WorkshopStepKey) => (stepNow === k ? 'primary' : 'secondary')

  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3')}>
      {/* Stage 2 — the event */}
      <Shell n="2 · Event" title="Workshop event" icon="Presentation" now={stepNow === 'event' || stepNow === 'close'} tone={goAhead ? GREEN : at(STAGE.feasibility) ? ORANGE : GREY}
        status={<Badge color={goAhead ? GREEN : openEvent ? ORANGE : GREY}>{goAhead ? 'Go ahead' : openEvent ? `Event ${openEvent.no} scheduled` : events.length ? 'New event needed' : 'Not created'}</Badge>}
        action={p.workshop ? (openEvent ? <Button size="sm" variant={stepVariant('close')} icon="ClipboardList" onClick={() => setOpen('close')}>Close event {openEvent.no}</Button> : <Button size="sm" variant={stepVariant('event')} icon="CalendarPlus" onClick={() => setOpen('event')}>Create event</Button>) : undefined}>
        {events.length ? events.map((e) => (
          <div key={e.id} className="mb-2 last:mb-0">
            <Row k={`Event ${e.no}`} v={`${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ''}`} />
            <Row k="Venue" v={e.venue} />
            <Row k="SPOC" v={<span title={e.spoc.email}>{e.spoc.name}</span>} />
            <ul className="mt-0.5 list-disc pl-4 text-muted">{e.points.map((x) => <li key={x} className="truncate" title={x}>{x}</li>)}</ul>
            {e.status === 'Held' && <div className="mt-1 text-muted italic truncate" title={e.notes}>{e.outcome ?? 'Closed'} · {e.closedBy}{e.notes ? ` — “${e.notes}”` : ''}</div>}
          </div>
        )) : <Waiting>{dropped ? 'Not reached.' : 'Every idea gets a workshop. The event lists the points to discuss; afterwards schedule a follow-up, or go ahead to management approval.'}</Waiting>}
      </Shell>

      {/* Stage 2 — technical feasibility */}
      <Shell n="2 · Technical" title="Technical feasibility check" icon="ClipboardCheck" now={stepNow === 'feas'} tone={f ? (f.decision === 'Go' ? GREEN : RED) : at(STAGE.feasibility) ? ORANGE : GREY}
        status={<Badge color={f ? (f.decision === 'Go' ? GREEN : RED) : at(STAGE.feasibility) ? ORANGE : GREY}>{f ? f.decision : at(STAGE.feasibility) ? 'To do' : 'Pending'}</Badge>}
        action={p.feasibilityCheck ? <Button size="sm" variant={stepVariant('feas')} icon="ClipboardCheck" onClick={() => setOpen('feas')}>{f ? 'Edit' : 'Open'} feasibility check</Button> : undefined}>
        {f ? (
          <>
            <Row k="Technically feasible" v={f.technical === 'Yes' ? 'Yes' : 'No'} />
            <Row k="Cost" v={f.cost} />
            <Row k="Duplicate / conflict" v={f.conflict === 'None' ? 'None' : `${f.conflict} · ${f.conflictWith ?? ''}`} />
            <Row k="Departments" v={f.departments.join(', ')} />
            <Row k="By" v={`${f.by} · ${fmtDate(f.at.slice(0, 10))}`} />
            {f.remarks && <div className="mt-1 text-muted italic truncate" title={f.remarks}>“{f.remarks}”</div>}
          </>
        ) : <Waiting>{dropped ? 'Not reached.' : 'Technical feasibility, cost validity and duplicates, then Go / No-go.'}</Waiting>}
      </Shell>

      {/* Stage 2 — commercial feasibility */}
      <Shell n="2 · Commercial" title="Commercial evaluation" icon="FlaskConical" now={stepNow === 'eval'} tone={ev?.skipped ? GREY : ev?.decision ? (ev.decision === 'Recommend' ? GREEN : RED) : at(STAGE.feasibility) ? ORANGE : GREY}
        status={<Badge color={ev?.skipped ? GREY : ev?.decision ? (ev.decision === 'Recommend' ? GREEN : RED) : at(STAGE.feasibility) ? ORANGE : GREY}>{ev?.skipped ? 'Not needed · below ₹ 5 L' : ev?.decision ? (ev.decision === 'Recommend' ? 'Recommended' : 'Rejected') : at(STAGE.feasibility) ? 'To do' : 'Pending'}</Badge>}
        action={p.evaluate ? <div className="flex flex-wrap gap-1.5"><Button size="sm" variant={stepVariant('eval')} icon="FlaskConical" onClick={() => setOpen('eval')}>Open evaluation</Button>{ev?.supplier && (ev.supplier.status === 'Not sent' || ev.supplier.status === 'Sent') && <Button size="sm" icon="Mail" onClick={() => setOpen('evalSupplier')}>{ev.supplier.status === 'Sent' ? 'Supplier form' : 'Check supplier'}</Button>}</div> : undefined}>
        {ev?.skipped ? (
          <Waiting>{ev.skippedReason ?? 'Opportunity cost below ₹ 5 L'} — the workshop goes ahead on the feasibility form.</Waiting>
        ) : ev && reached(idea, STAGE.feasibility) ? (
          <>
            <Row k="Cost-benefit" v={ev.cbaVerified ? <span className="text-emerald-700">Verified</span> : 'To verify'} />
            <Row k="Risk" v={ev.risks?.length ? `${overallRisk(ev.risks)} · ${inrShort(riskTotal(ev.risks))} at risk` : 'To assess'} />
            <Row k="Supplier capability" v={ev.supplier?.status === 'Responded' ? `${ev.supplier.supplierName} — ${ev.supplier.response?.canSupply}` : ev.supplier?.status === 'Skipped' ? 'Skipped (< ₹ 5 L)' : ev.supplier?.status === 'Sent' ? `Sent to ${ev.supplier.supplierName}` : 'Not sent'} />
            {ev.by && <Row k="By" v={`${ev.by} · ${fmtDate(ev.at?.slice(0, 10))}`} />}
            {ev.remarks && <div className="mt-1 text-muted italic truncate" title={ev.remarks}>“{ev.remarks}”</div>}
          </>
        ) : <Waiting>{dropped ? 'Not reached.' : 'A detailed cost-benefit analysis, a risk assessment and a supplier capability check (not needed below ₹ 5 L).'}</Waiting>}
      </Shell>

      {/* Stage 3 */}
      <Shell n={3} title={STAGE.approval} icon="Stamp" tone={lock ? GREEN : at(STAGE.approval) ? ORANGE : GREY}
        status={<Badge color={lock ? GREEN : at(STAGE.approval) ? ORANGE : GREY}>{lock && idea.approvedAt ? 'Approved · KPI signed' : lock ? 'KPI signed' : at(STAGE.approval) ? 'Awaiting approval' : 'Pending'}</Badge>}
        action={p.approve ? <Button size="sm" variant="primary" icon="Signature" onClick={() => setOpen('appr')}>{lock ? 'Approve' : 'Allocate KPI & approve'}</Button> : undefined}>
        {lock ? (
          <>
            {lock.kpi && <Row k="KPI owner" v={lock.kpi.owner} />}
            <Row k="KPI target" v={<Money value={lock.targetSaving} />} />
            <Row k="Timeline" v={`${lock.timelineMonths} months · ${fmtDate(lock.startDate)} → ${fmtDate(lock.endDate)}`} />
            <Row k="Budget" v={`${inrShort(lock.budget)}${lock.parts?.length && lock.parts.length > 1 ? ` · ${lock.parts.length} parts` : ''}`} />
            {lock.milestones?.length ? <Row k="Plan" v={`${lock.milestones.length} milestones · next ${fmtDate(lock.milestones.find((m) => m.dueDate >= todayIso())?.dueDate ?? lock.endDate)}`} /> : null}
            <Row k="Supplier alignment" v={lock.supplierAligned} />
            <Row k="Signed" v={`${lock.signatureName} · ${fmtDate(lock.signedAt.slice(0, 10))}`} />
          </>
        ) : <Waiting>{dropped ? 'Not reached.' : `Commercial assessment, supplier alignment, the KPI (target = ${inrShort(annual)} × months ÷ 12) and its sign-off — then the idea moves to Cost Optimisation.`}</Waiting>}
      </Shell>

      {/* Stage 5 */}
      <Shell n={5} title={v?.verifiedAt ? 'Verified' : STAGE.verification} icon="ShieldCheck" tone={v?.verifiedAt ? GREEN : at(STAGE.verification) ? ORANGE : GREY}
        status={<Badge color={v?.verifiedAt ? GREEN : at(STAGE.verification) ? ORANGE : GREY}>{v?.verifiedAt ? 'Verified' : at(STAGE.verification) ? 'Awaiting verification' : v?.returnedAt ? 'Returned' : 'Pending'}</Badge>}
        action={p.verify ? <Button size="sm" variant="success" icon="ShieldCheck" onClick={() => setOpen('verify')}>Verify savings</Button> : undefined}>
        {v?.handedAt ? (
          <>
            <Row k="In verification since" v={`${fmtDate(v.handedAt.slice(0, 10))} · locked timeline ended`} />
            <Row k="First MRN at new price" v={fmtDate(idea.execution?.effectiveDate)} />
            {v.forecastAtClose != null && <Row k="Locked target vs MRN actual" v={`${inrShort(v.forecastAtClose)} / ${inrShort(v.actualAtClose ?? 0)}`} />}
            {v.verifiedAt && <Row k="Verified" v={`${v.verifiedBy} · ${fmtDate(v.verifiedAt.slice(0, 10))}`} />}
            {v.realisedAtVerification != null && <Row k="Realised vs due" v={`${inrShort(v.realisedAtVerification)} / ${inrShort(v.targetAtVerification ?? 0)}`} />}
            {v.remarks && <div className="mt-1 text-muted italic truncate" title={v.remarks}>“{v.remarks}”</div>}
          </>
        ) : v?.returnedAt ? <Waiting>Returned to execution on {fmtDate(v.returnedAt.slice(0, 10))}: {v.returnReason}</Waiting>
          : <Waiting>{dropped ? 'Not reached.' : 'When the locked timeline ends COIN moves the idea here by itself; Finance compares the locked target with the saving found in MRN.'}</Waiting>}
      </Shell>

      {!compact && ev?.supplier?.status === 'Responded' && <div className="md:col-span-2 2xl:col-span-3"><SupplierResponseCard idea={idea} /></div>}

      <WorkshopEventModal idea={idea} open={open === 'event'} onClose={close} />
      <CloseEventModal idea={idea} event={openEvent} open={open === 'close'} onClose={close} />
      <FeasibilityCheckModal idea={idea} open={open === 'feas'} onClose={close} />
      <EvaluationModal idea={idea} open={open === 'eval' || open === 'evalSupplier'} tab={open === 'evalSupplier' ? 'supplier' : 'cba'} onClose={close} />
      <SourcingApprovalModal idea={idea} open={open === 'appr'} onClose={close} />
      <VerificationModal idea={idea} open={open === 'verify'} onClose={close} />
    </div>
  )
}
