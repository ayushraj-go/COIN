// Idea 360 panels: meta chips, details, feasibility, technical evaluation, approvals, execution, linked NPD / PAP, key facts.
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Badge, Button, Card, HealthBadge, Icon, InfoTip, KV, LeverChip, ProgressBar, SavingsTypeBadge, SourceTag, UserChip, cn } from '../../components/ui'
import { approvalLevels, healthOf, ideaAnnualised } from '../../lib/calc'
import { EVALUATION_STAGES, LEVER_GROUP_STYLE, STAGE } from '../../lib/masters'
import { PlanVsActualBlock, useIdeaPlan } from './PlanVsActual'
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
          <Badge color="#223c86" icon="Megaphone" className="hover:brightness-95">{campaign.name}</Badge>
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

function PlanBlock({ idea }: { idea: Idea }) {
  const p = useIdeaPlan(idea)
  return p ? <PlanVsActualBlock p={p} compact /> : null
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
      {idea.lock && <div className="mt-3 rounded-xl border border-line p-3"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center justify-between gap-2"><span>Plan vs actual · locked {idea.lock.timelineMonths}-month target</span><span className="normal-case tracking-normal font-medium">CO date {fmtDate(idea.coDate ?? idea.lock.startDate)} · MRN link: ERP feed (future)</span></div><PlanBlock idea={idea} /></div>}
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
const NPD_COLOR: Record<string, string> = { 'Not raised': '#94a3b8', 'ECN raised': '#2f4a9a', 'Sample submitted': '#ec8a1c', 'Sample approved': '#0f9f6e', 'Sample failed': '#e0364f' }
const PAP_COLOR: Record<string, string> = { 'Not raised': '#94a3b8', Raised: '#2f4a9a', 'Price approved': '#0f9f6e', Rejected: '#e0364f' }
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

