// Idea 360 panels: meta chips, details, feasibility, technical evaluation, approvals, execution, linked NPD / PAP, key facts.
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Badge, Button, Card, HealthBadge, Icon, InfoTip, KV, LeverChip, ProgressBar, SavingsTypeBadge, SourceTag, UserChip, cn } from '../../components/ui'
import { approvalLevels, healthOf, ideaAnnualised } from '../../lib/calc'
import { FEASIBILITY_STAGES, EVALUATION_STAGES, LEVER_GROUP_STYLE } from '../../lib/masters'
import { fmtDate, inr, inrPrice, inrShort, num, todayIso } from '../../lib/format'
import { ROUTE_ICON, ideaPerms, stagesOf, supplierName, useCtx } from './model'

// ─── Meta chips (lever, route, savings type, plant, commodity, campaign) ──────
export function IdeaMetaChips({ idea, className }: { idea: Idea; className?: string }) {
  const ctx = useCtx()
  const campaign = ctx.campaigns.find((c) => c.id === idea.campaignId)
  const plant = ctx.plants.find((p) => p.id === idea.plant)
  const commodity = ctx.commodities.find((c) => c.code === idea.commodity)
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <LeverChip leverId={idea.leverId} />
      <Badge color="#334155" icon={ROUTE_ICON[idea.route]}>{idea.route} route</Badge>
      <SavingsTypeBadge type={idea.savingsType} />
      <Badge color="#0f766e" icon="Boxes">{commodity?.name ?? idea.commodity}</Badge>
      <Badge color="#475569" icon="MapPin">{plant ? `${plant.name} · ${plant.bu}` : idea.plant}</Badge>
      <Badge color="#64748b" icon={idea.buyingType === 'Direct' ? 'Package' : 'Briefcase'}>{idea.buyingType}</Badge>
      {idea.isSupplierSubmission && <Badge color="#0d9488" icon="Factory">Supplier idea · {idea.supplierCode}</Badge>}
      {campaign && (
        <Link to={`/campaigns/${campaign.id}`} onClick={() => useStore.getState().openIdea(null)} className="inline-flex">
          <Badge color="#2f5bc6" icon="Megaphone" className="hover:brightness-95">{campaign.name}</Badge>
        </Link>
      )}
    </div>
  )
}

// ─── Idea details (current state, proposed change, evidence, supplier fields) ─
export function DetailsCard({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const ctx = useCtx()
  const lever = ctx.levers.find((l) => l.id === idea.leverId)
  const g = lever ? LEVER_GROUP_STYLE[lever.group] : null
  const Block = ({ label, icon, children }: { label: string; icon: string; children: ReactNode }) => (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted mb-1"><Icon name={icon} size={12} />{label}</div>
      <div className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  )
  return (
    <Card title="Idea details" icon="FileText" subtitle={compact ? undefined : lever ? `${lever.group} lever · ${lever.name} · evaluator ${lever.evaluator} · NPD sample ${lever.npdSample}` : undefined}>
      <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
        <Block label="Current state" icon="CircleDot">{idea.currentState || <span className="text-muted">Not provided</span>}</Block>
        <Block label="Proposed change" icon="Sparkles">{idea.proposedChange || <span className="text-muted">Not provided</span>}</Block>
        <Block label="Evidence" icon="FileCheck2">
          {idea.evidence || <span className="text-muted">No evidence text</span>}
          {idea.evidenceTags.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{idea.evidenceTags.map((t) => <Badge key={t} color="#4f46e5" icon="Tag">{t}</Badge>)}</div>}
        </Block>
        <div className="min-w-0 rounded-xl bg-slate-50/70 border border-slate-100 px-3 py-1.5">
          <KV k="Proposed supplier" v={idea.proposedSupplier ? <span>{idea.proposedSupplier.name}{idea.proposedSupplier.code ? <span className="text-muted"> · {idea.proposedSupplier.code}</span> : null}{idea.proposedSupplier.isNew && <Badge color="#ec8a1c" className="ml-1.5">New supplier</Badge>}</span> : '—'} />
          <KV k="Gain-share % offered to Amber" v={idea.isSupplierSubmission ? (idea.gainSharePct != null ? `${idea.gainSharePct}%` : '—') : <span className="text-muted">Supplier submissions only</span>} />
          <KV k="Validity of offer" v={idea.isSupplierSubmission ? (idea.offerValidity ? <span className={idea.offerValidity < todayIso() ? 'text-red-600' : undefined}>{fmtDate(idea.offerValidity)}{idea.offerValidity < todayIso() ? ' · expired' : ''}</span> : '—') : <span className="text-muted">Supplier submissions only</span>} />
          <KV k="Expected implementation" v={idea.expectedQuarter || '—'} />
          <KV k="One-time investment" v={idea.oneTimeInvestment ? inr(idea.oneTimeInvestment) : '₹ 0'} />
          {g && lever && <KV k="Lever group" v={<span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: g.color }} />{lever.group}</span>} />}
        </div>
      </div>
    </Card>
  )
}

function PanelShell({ title, icon, status, children, tone = '#64748b' }: { title: string; icon: string; status?: ReactNode; children: ReactNode; tone?: string }) {
  return (
    <section className="card p-3.5 min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={{ background: `${tone}14`, color: tone }}><Icon name={icon} size={14} /></span>
          <h3 className="text-[13px] font-semibold text-ink truncate">{title}</h3>
        </div>
        {status}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </section>
  )
}
const NA = ({ children }: { children: ReactNode }) => <div className="text-[12px] text-muted leading-relaxed">{children}</div>

// ─── Feasibility ──────────────────────────────────────────────────────────────
export function FeasibilityPanel({ idea }: { idea: Idea }) {
  const ctx = useCtx()
  const stages = stagesOf(idea)
  const fStage = stages.find((s) => FEASIBILITY_STAGES.includes(s))
  const f = idea.feasibility
  if (!fStage) return <PanelShell title="Feasibility" icon="ClipboardCheck"><NA>Not applicable — the {idea.route} route has no supplier feasibility stage.</NA></PanelShell>
  if (!f) return <PanelShell title="Feasibility" icon="ClipboardCheck" status={<Badge color="#94a3b8">Not requested</Badge>}><NA>Requested automatically from the supplier (secure link, valid 7 days) when the idea reaches {fStage}.</NA></PanelShell>
  const responded = !!f.respondedAt
  const tone = !responded ? '#ec8a1c' : f.feasible ? '#0f9f6e' : '#e0364f'
  return (
    <PanelShell title="Feasibility" icon="ClipboardCheck" tone={tone} status={<Badge color={tone}>{!responded ? 'Awaiting response' : f.feasible ? 'Feasible' : 'Not feasible'}</Badge>}>
      <KV k="Supplier" v={<span className="truncate">{supplierName(ctx, f.supplierCode)} <span className="text-muted">· {f.supplierCode}</span></span>} />
      <KV k="Requested" v={fmtDate(f.requestedAt?.slice(0, 10))} />
      {responded ? (
        <>
          <KV k="Offered price" v={f.offeredPrice != null ? <span className="num">{inrPrice(f.offeredPrice)}{idea.parts[0] ? <span className="text-muted"> / {idea.parts[0].uom}</span> : null}</span> : '—'} />
          <KV k="Lead time" v={f.leadTimeDays != null ? `${f.leadTimeDays} days` : '—'} />
          <KV k="MOQ" v={f.moq != null ? num(f.moq) : '—'} />
          <KV k="Responded" v={<span>{fmtDate(f.respondedAt?.slice(0, 10))}{f.onBehalf && <SourceTag color="#ec8a1c">on behalf</SourceTag>}</span>} />
          {f.respondedBy && <KV k="By" v={f.respondedBy} />}
          {f.remarks && <div className="text-[11.5px] text-muted italic mt-1.5">“{f.remarks}”</div>}
        </>
      ) : (
        <NA>Supplier to confirm feasibility with offered price, lead time and MOQ. The buyer can respond on behalf.</NA>
      )}
    </PanelShell>
  )
}

// ─── Technical evaluation ─────────────────────────────────────────────────────
export function TechEvalPanel({ idea }: { idea: Idea }) {
  const stages = stagesOf(idea)
  const eStage = stages.find((s) => EVALUATION_STAGES.includes(s))
  const te = idea.techEval
  if (!eStage) return <PanelShell title="Technical evaluation" icon="FlaskConical"><NA>Not applicable — {idea.route} ideas skip R&D evaluation and sampling.</NA></PanelShell>
  const reached = stages.indexOf(idea.stage) >= stages.indexOf(eStage) || idea.bucket === 'Implemented' || (!!idea.dropStage && stages.indexOf(idea.dropStage) >= stages.indexOf(eStage))
  if (!te?.decision) {
    const waiting = idea.stage === eStage
    return (
      <PanelShell title="Technical evaluation" icon="FlaskConical" tone={waiting ? '#ec8a1c' : '#64748b'} status={<Badge color={waiting ? '#ec8a1c' : '#94a3b8'}>{waiting ? 'In evaluation' : reached ? 'No decision' : 'Not started'}</Badge>}>
        <KV k="Evaluator" v={te?.evaluatorDept ?? '—'} />
        <KV k="Stage" v={eStage} />
        <NA>{waiting ? 'Go / no-go with a validation plan is awaited from the evaluator.' : `Starts when the idea reaches ${eStage}.`}</NA>
      </PanelShell>
    )
  }
  const go = te.decision === 'Go'
  return (
    <PanelShell title="Technical evaluation" icon="FlaskConical" tone={go ? '#0f9f6e' : '#e0364f'} status={<Badge color={go ? '#0f9f6e' : '#e0364f'} icon={go ? 'CircleCheck' : 'CircleX'}>{te.decision}</Badge>}>
      <KV k="Evaluator" v={te.evaluatorDept} />
      <KV k="Decided by" v={te.by ?? '—'} />
      <KV k="On" v={fmtDate(te.at?.slice(0, 10))} />
      {te.validationPlan && (
        <div className="mt-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Validation plan</div>
          <div className="text-[12px] text-ink-2 leading-relaxed">{te.validationPlan}</div>
        </div>
      )}
    </PanelShell>
  )
}

// ─── Approvals (levels per approval matrix) ──────────────────────────────────
export function ApprovalsPanel({ idea }: { idea: Idea }) {
  const ctx = useCtx()
  const settings = useStore((s) => s.settings)
  const annual = ideaAnnualised(idea)
  const expected = approvalLevels(annual, idea.oneTimeInvestment, settings.xThresholdLakh, settings.yThresholdLakh)
  const lead = ctx.commodities.find((c) => c.code === idea.commodity)?.leadId
  const levels = idea.approvals.length ? idea.approvals : expected.map((l) => ({ level: l, approverId: l === 'Commodity Lead' ? lead : 'u-head' } as Idea['approvals'][0]))
  const planned = !idea.approvals.length
  const done = idea.approvals.length > 0 && idea.approvals.every((a) => a.decision === 'Approved')
  const rejected = idea.approvals.some((a) => a.decision === 'Rejected')
  const why = annual > settings.xThresholdLakh * 1e5 ? `Annualised ${inrShort(annual)} above ₹ ${settings.xThresholdLakh} lakh` : idea.oneTimeInvestment > settings.yThresholdLakh * 1e5 ? `Investment above ₹ ${settings.yThresholdLakh} lakh` : `Up to ₹ ${settings.xThresholdLakh} lakh`
  const tone = rejected ? '#e0364f' : done ? '#0f9f6e' : idea.stage === 'Approval' ? '#ec8a1c' : '#64748b'
  return (
    <PanelShell title="Approvals" icon="Stamp" tone={tone}
      status={<span className="flex items-center gap-1"><Badge color={tone}>{rejected ? 'Rejected' : done ? 'Approved' : idea.stage === 'Approval' ? 'Pending' : planned ? 'Planned' : 'Pending'}</Badge><InfoTip title="Approval matrix" formula={`≤ ₹ ${settings.xThresholdLakh} L: Commodity Lead · > ₹ ${settings.xThresholdLakh} L: Lead → Sourcing Head · investment > ₹ ${settings.yThresholdLakh} L: + Sourcing Head`}>{why}.</InfoTip></span>}>
      <div className="space-y-1.5">
        {levels.map((a, k) => {
          const c = a.decision === 'Approved' ? '#0f9f6e' : a.decision === 'Rejected' ? '#e0364f' : '#94a3b8'
          return (
            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-semibold text-ink-2">L{k + 1} · {a.level}</span>
                <Badge color={c} icon={a.decision === 'Approved' ? 'Check' : a.decision === 'Rejected' ? 'X' : 'Clock3'}>{a.decision ?? (planned ? 'Planned' : 'Pending')}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <UserChip userId={a.approverId} size={18} />
                {a.at && <span className="text-[11px] text-muted shrink-0">{fmtDate(a.at.slice(0, 10))}</span>}
              </div>
              {a.remarks && <div className="text-[11px] text-muted italic mt-0.5">“{a.remarks}”</div>}
            </div>
          )
        })}
      </div>
    </PanelShell>
  )
}

// ─── Execution summary ────────────────────────────────────────────────────────
export function ExecutionSummary({ idea }: { idea: Idea }) {
  const nav = useNavigate()
  const ex = idea.execution
  if (!ex) return null
  const health = ex.status === 'In Execution' ? healthOf(idea) : null
  const t = todayIso()
  const done = ex.milestones.filter((m) => m.doneDate).length
  return (
    <Card title="Execution" icon="Rocket" subtitle={`${ex.status} · ${done}/${ex.milestones.length} milestones`}
      actions={<>{health && <HealthBadge health={health} />}<Button size="sm" variant="ghost" iconRight="ArrowUpRight" onClick={() => { useStore.getState().openIdea(null); nav(`/execution?q=${encodeURIComponent(idea.id)}`) }}>Execution Hub</Button></>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="min-w-0"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Owner</div><div className="mt-1"><UserChip userId={ex.ownerId} size={20} /></div></div>
        <div className="min-w-0"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Start</div><div className="text-[13px] font-semibold mt-1">{fmtDate(ex.startDate)}</div></div>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Due date</div>
          <div className={cn('text-[13px] font-semibold mt-1', ex.status === 'In Execution' && ex.targetDate < t && 'text-red-600')}>{fmtDate(ex.targetDate)}</div>
          {ex.originalTargetDate !== ex.targetDate && <div className="text-[10.5px] text-muted">orig. {fmtDate(ex.originalTargetDate)} · {ex.slippage.length} slip{ex.slippage.length === 1 ? '' : 's'}</div>}
        </div>
        <div className="min-w-0"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{ex.effectiveDate ? 'Effective' : 'Progress'}</div>
          {ex.effectiveDate ? <div className="text-[13px] font-semibold mt-1 text-emerald-700">{fmtDate(ex.effectiveDate)}</div> : <div className="mt-2 flex items-center gap-2"><ProgressBar value={ex.progress} color="#ec8a1c" className="flex-1" /><span className="text-[12px] font-semibold num">{ex.progress}%</span></div>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-1.5">Milestones</div>
          <ol className="space-y-1">
            {ex.milestones.map((m) => {
              const overdue = !m.doneDate && m.dueDate < t
              return (
                <li key={m.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className={cn('h-4 w-4 rounded-full grid place-items-center shrink-0', m.doneDate ? 'bg-emerald-600 text-white' : overdue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400')}>
                    <Icon name={m.doneDate ? 'Check' : overdue ? 'TriangleAlert' : 'Circle'} size={9} strokeWidth={3} />
                  </span>
                  <span className={cn('flex-1 truncate', m.doneDate ? 'text-ink-2' : overdue ? 'text-red-700 font-medium' : 'text-ink-2')}>{m.name}</span>
                  <span className={cn('text-[11px] num shrink-0', overdue ? 'text-red-600 font-semibold' : 'text-muted')}>{m.doneDate ? `Done ${fmtDate(m.doneDate)}` : `Due ${fmtDate(m.dueDate)}`}</span>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="md:col-span-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center gap-1">Quarter phasing <InfoTip title="Quarter phasing" formula="Pre-filled from due date × annualised impact">Owner enters expected saving per quarter (Q1–Q4).</InfoTip></div>
          <div className="grid grid-cols-4 gap-1.5">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
              <div key={q} className="rounded-lg bg-amber-50/70 border border-amber-100 px-1.5 py-1.5 text-center">
                <div className="text-[10.5px] font-semibold text-amber-800">{q}</div>
                <div className="text-[11.5px] font-bold num text-ink truncate">{inrShort(ex.phasing[q] || 0, 1)}</div>
              </div>
            ))}
          </div>
          {ex.slippage.length > 0 && (
            <div className="mt-2 text-[11px] text-muted">
              <span className="font-semibold text-amber-700">Slippage:</span> {ex.slippage[ex.slippage.length - 1].reason} ({fmtDate(ex.slippage[ex.slippage.length - 1].oldDate)} → {fmtDate(ex.slippage[ex.slippage.length - 1].newDate)})
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Linked NPD / PAP requests (status synced) ───────────────────────────────
const NPD_COLOR: Record<string, string> = { 'Not raised': '#94a3b8', 'ECN raised': '#4470d6', 'Sample submitted': '#ec8a1c', 'Sample approved': '#0f9f6e', 'Sample failed': '#e0364f' }
const PAP_COLOR: Record<string, string> = { 'Not raised': '#94a3b8', Raised: '#4470d6', 'Price approved': '#0f9f6e', Rejected: '#e0364f' }
export function LinkedRequests({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const me = useMe()
  const syncNpdPap = useStore((s) => s.syncNpdPap)
  const toast = useStore((s) => s.toast)
  const perms = ideaPerms(me, idea)
  const [spin, setSpin] = useState<string | null>(null)
  const [choose, setChoose] = useState(false)
  const needsNpd = idea.route === 'Technical' || idea.route === 'Supplier change'
  const npd = idea.npdStatus ?? 'Not raised'
  const pap = idea.papStatus ?? 'Not raised'
  const run = (key: string, fn: () => void) => { setSpin(key); setTimeout(() => { fn(); setSpin(null) }, 650) }
  const syncNpd = () => {
    if (npd === 'Sample submitted') { setChoose(true); return }
    const next = npd === 'ECN raised' ? 'Sample submitted' : npd === 'Sample failed' ? 'Sample submitted' : null
    if (!next) { toast(`${idea.npdRequestId} is up to date — ${npd}`, 'info'); return }
    run('npd', () => { syncNpdPap(idea.id, { npdStatus: next as Idea['npdStatus'] }); toast(`NPD synced — ${next}`, 'info') })
  }
  const setNpd = (s: 'Sample approved' | 'Sample failed') => {
    setChoose(false)
    run('npd', () => { syncNpdPap(idea.id, { npdStatus: s }); toast(`NPD synced — ${s}`, s === 'Sample failed' ? 'warning' : 'success') })
  }
  const syncPap = () => {
    if (pap !== 'Raised') { toast(`${idea.papRequestId} is up to date — ${pap}`, 'info'); return }
    run('pap', () => { syncNpdPap(idea.id, { papStatus: 'Price approved' }); toast('PAP price approved — Mark Done with the approved price to close the idea', 'success') })
  }
  const Row = ({ sys, id, status, color, onSync, syncKey, na, icon }: { sys: string; id?: string; status: string; color: string; onSync: () => void; syncKey: string; na?: string; icon: string }) => (
    <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-slate-200 last:border-0">
      <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${color}14`, color }}><Icon name={icon} size={15} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{sys}</div>
        {na ? <div className="text-[12px] text-muted truncate">{na}</div> : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[12px] font-semibold text-ink truncate">{id ?? '—'}</span>
            <Badge color={color} dot>{status}</Badge>
          </div>
        )}
      </div>
      {!na && id && perms.sync && (
        <Button size="xs" variant="secondary" icon="RefreshCw" onClick={onSync} className={spin === syncKey ? '[&_svg]:animate-spin' : undefined} disabled={!!spin}>Sync</Button>
      )}
    </div>
  )
  return (
    <Card title="Linked requests" icon="Link2" subtitle={compact ? undefined : 'NPD platform and Price Approval Portal, status synced'}>
      <Row sys="NPD request (ECN)" id={idea.npdRequestId} status={npd} color={NPD_COLOR[npd] ?? '#64748b'} onSync={syncNpd} syncKey="npd" icon="TestTubeDiagonal"
        na={!needsNpd ? `Not applicable — ${idea.route} route has no NPD sample` : !idea.npdRequestId ? 'Raised automatically at the NPD sample stage' : undefined} />
      {choose && (
        <div className="my-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <div className="text-[12px] text-amber-900 font-medium mb-2">NPD platform reports the sample result for {idea.npdRequestId}:</div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="success" icon="CircleCheck" onClick={() => setNpd('Sample approved')}>Sample approved</Button>
            <Button size="xs" variant="danger" icon="CircleX" onClick={() => setNpd('Sample failed')}>Sample failed</Button>
            <Button size="xs" variant="ghost" onClick={() => setChoose(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <Row sys="PAP price revision" id={idea.papRequestId} status={pap} color={PAP_COLOR[pap] ?? '#64748b'} onSync={syncPap} syncKey="pap" icon="BadgeIndianRupee"
        na={!idea.papRequestId ? 'Raised automatically at the PAP stage after approval' : undefined} />
    </Card>
  )
}

// ─── Key facts ────────────────────────────────────────────────────────────────
export function KeyFacts({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const ctx = useCtx()
  const cat = ctx.categories.find((c) => c.id === idea.categoryId)
  const com = ctx.commodities.find((c) => c.code === idea.commodity)
  const plant = ctx.plants.find((p) => p.id === idea.plant)
  const camp = ctx.campaigns.find((c) => c.id === idea.campaignId)
  const rows: [string, ReactNode][] = [
    ['Idea ID', <span className="font-mono">{idea.id}</span>],
    ['Financial year', idea.fy],
    ['Scope', idea.scope === 'Open' ? 'Open idea' : 'Part-specific'],
    ['Buying type · category', `${idea.buyingType} · ${cat?.name ?? idea.categoryId}`],
    ['Commodity', `${com?.name ?? idea.commodity} (${idea.commodity})`],
    ['Plant / BU', plant ? `${plant.name} · ${plant.bu}` : idea.plant],
    ['Submitter', <span>{idea.submitterName} <span className="text-muted">· {idea.employeeId}</span></span>],
    ['Department', idea.department],
    ['Commodity buyer', <UserChip userId={idea.buyerId} size={18} />],
    ...(idea.ownerId && idea.ownerId !== idea.buyerId ? [['Idea owner', <UserChip userId={idea.ownerId} size={18} />] as [string, ReactNode]] : []),
    ['Submitted', fmtDate((idea.submittedAt ?? idea.createdAt)?.slice(0, 10))],
    ...(idea.approvedAt ? [['Approved', fmtDate(idea.approvedAt.slice(0, 10))] as [string, ReactNode]] : []),
    ...(idea.implementedAt ? [['Implemented', fmtDate(idea.implementedAt.slice(0, 10))] as [string, ReactNode]] : []),
    ...(idea.droppedAt ? [[idea.stage === 'Rejected' ? 'Rejected' : 'Dropped', <span className="text-red-600">{fmtDate(idea.droppedAt.slice(0, 10))} · {idea.dropReason}</span>] as [string, ReactNode]] : []),
    ['Campaign / workshop', camp ? <Link className="text-brand-700 hover:underline" to={`/campaigns/${camp.id}`} onClick={() => useStore.getState().openIdea(null)}>{camp.name}</Link> : '—'],
  ]
  return (
    <Card title="Key facts" icon="ListChecks">
      <div className={cn(compact && 'grid grid-cols-1 sm:grid-cols-2 gap-x-6')}>
        {rows.map(([k, v]) => <KV key={k} k={k} v={v} />)}
      </div>
      {idea.dropRemarks && !compact && <div className="mt-2 text-[11.5px] text-muted italic">“{idea.dropRemarks}”</div>}
    </Card>
  )
}

