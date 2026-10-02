// M4 — Idea 360 page: stage tracker, value card, part-wise savings, attachments, comments, audit trail, NPD / PAP links.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Idea } from '../lib/types'
import { hasRole, useMe, useStore } from '../store/useStore'
import { BUCKET_STYLE, canSeeIdea, ideaAnnualised, ideaSavingPct } from '../lib/calc'
import { Badge, BucketBadge, Button, Card, EmptyState, Icon, IconButton, InfoTip, Money, Skeleton, StageBadge, Tooltip, UserChip, useWarmup } from '../components/ui'
import { fmtDate } from '../lib/format'
import { exportIdeas, stagesOf, toRow, useCtx } from './idea/model'
import { ActionBar } from './idea/ActionBar'
import { CurrentStageSla, StageTracker } from './idea/StageTracker'
import { ValueCard } from './idea/ValueCard'
import { PartsTable } from './idea/PartsTable'
import { ApprovalsPanel, DetailsCard, ExecutionSummary, FeasibilityPanel, IdeaMetaChips, KeyFacts, LinkedRequests, TechEvalPanel } from './idea/Panels'
import { Attachments } from './idea/Attachments'
import { Comments } from './idea/Comments'
import { ActivityLog } from './idea/ActivityLog'

export function IdChip({ id }: { id: string }) {
  const toast = useStore((s) => s.toast)
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-0.5 rounded-md bg-slate-100 border border-line">
      <span className="font-mono text-[12px] font-bold text-ink tracking-tight">{id}</span>
      <button title="Copy idea ID" onClick={() => { navigator.clipboard?.writeText(id).then(() => toast(`${id} copied`, 'info'), () => toast(id, 'info')) }} className="h-5 w-5 grid place-items-center rounded text-muted hover:text-brand-700 hover:bg-white">
        <Icon name="Copy" size={11} />
      </button>
    </span>
  )
}

function HeaderCard({ idea }: { idea: Idea }) {
  const ctx = useCtx()
  const annual = ideaAnnualised(idea)
  const pct = ideaSavingPct(idea)
  const st = BUCKET_STYLE[idea.bucket]
  return (
    <section className="card relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${st.color}, ${st.color}33)` }} />
      <div className="p-4 pt-5 flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <IdChip id={idea.id} />
            <BucketBadge bucket={idea.bucket} />
            <span className="inline-flex items-center h-[22px] px-2 rounded-full border border-line bg-white"><StageBadge stage={idea.stage} bucket={idea.bucket} /></span>
            {idea.locked && (
              <Tooltip content="Data integrity: approved values are locked; changes after approval need a change reason and re-approval above the set %.">
                <Badge color="#0f172a" soft="#f1f5f9" icon="Lock">Approved values are locked</Badge>
              </Tooltip>
            )}
            {idea.infoRequested && <Badge color="#ec8a1c" icon="MessageCircleQuestion">More info requested</Badge>}
          </div>
          <h1 className="mt-2 text-[19px] md:text-[22px] font-bold tracking-tight text-ink leading-snug">{idea.title || <span className="text-muted">Untitled draft</span>}</h1>
          <IdeaMetaChips idea={idea} className="mt-2.5" />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5 min-w-0">Submitted by {idea.isSupplierSubmission ? <span className="font-semibold text-ink-2">{idea.submitterName}</span> : <UserChip userId={idea.submitterId} size={20} />}<span>· {idea.department} · {fmtDate((idea.submittedAt ?? idea.createdAt)?.slice(0, 10))}</span></span>
            <span className="inline-flex items-center gap-1.5">Buyer <UserChip userId={idea.buyerId} size={20} /></span>
            {idea.ownerId && idea.ownerId !== idea.buyerId && <span className="inline-flex items-center gap-1.5">Owner <UserChip userId={idea.ownerId} size={20} /></span>}
            <span className="inline-flex items-center gap-1"><Icon name="Route" size={12} />{stagesOf(idea).length} stages · {idea.route} route</span>
          </div>
        </div>
        <div className="lg:w-[280px] shrink-0 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-gold-50 p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">Annualised impact <InfoTip title="Annualised impact" formula="(P(baseline) − P(new)) × Q(last FY MRN)">Full-year saving at the new price and annual volume.</InfoTip></div>
          <div className={annual < 0 ? 'text-red-600' : 'text-ink'}><span className="text-[28px] font-extrabold tracking-tight leading-tight"><Money value={annual} /></span></div>
          <div className="text-[12px] text-muted">
            {idea.scope === 'Open' ? 'Estimate for open idea' : `${pct.toFixed(1)}% saving on baseline spend · ${idea.parts.length} part${idea.parts.length === 1 ? '' : 's'}`}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11.5px] text-muted">
            <Icon name="CalendarClock" size={13} className="text-gold-600" />Expected {idea.expectedQuarter || '—'}
            <span className="ml-auto">{ctx.commodities.find((c) => c.code === idea.commodity)?.code}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-4 py-2.5 bg-slate-50/60">
        <ActionBar idea={idea} />
      </div>
    </section>
  )
}

function Idea360Skeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-[190px] rounded-2xl" />
      <Skeleton className="h-[130px] rounded-2xl" />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 space-y-3"><Skeleton className="h-[220px] rounded-2xl" /><Skeleton className="h-[200px] rounded-2xl" /></div>
        <div className="xl:col-span-4 space-y-3"><Skeleton className="h-[260px] rounded-2xl" /><Skeleton className="h-[160px] rounded-2xl" /></div>
      </div>
    </div>
  )
}

export default function Idea360() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const ctx = useCtx()
  const idea = useStore((s) => s.ideas.find((i) => i.id === id))
  const drawerId = useStore((s) => s.drawerIdeaId)
  const openIdea = useStore((s) => s.openIdea)
  const ready = useWarmup(280)
  const { hash } = useLocation()
  useEffect(() => { if (drawerId && drawerId === id) openIdea(null) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 360)
    return () => clearTimeout(t)
  }, [ready, hash, id])

  const listPath = hasRole(me, 'buyer', 'lead', 'head', 'admin') ? '/ideas' : '/my-ideas'
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav(listPath))

  if (!ready) return <Idea360Skeleton />
  if (!idea) {
    return (
      <Card>
        <EmptyState icon="SearchX" title={`Idea ${id} not found`} desc="The link may be incorrect, or a draft was converted to a submitted idea with a new ID."
          action={<div className="flex gap-2 justify-center"><Button variant="primary" icon="Table2" onClick={() => nav(listPath)}>Go to ideas</Button><Button icon="Search" onClick={() => useStore.getState().setSearchOpen(true)}>Search</Button></div>} />
      </Card>
    )
  }
  if (!me || !canSeeIdea(me, idea)) {
    return (
      <Card>
        <EmptyState icon="ShieldX" title="You don't have access to this idea" desc="Visibility follows your role and commodity mapping: submitters see their own ideas, buyers and leads their mapped commodities, suppliers their own ideas and feasibility requests."
          action={<Button variant="primary" onClick={() => nav(listPath)}>Back to ideas</Button>} />
      </Card>
    )
  }
  const exportOne = () => exportIdeas([toRow(idea, ctx)], ctx, `COIN_${idea.id}`)

  return (
    <div className="space-y-3 pb-8 min-w-0">
      {/* breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <nav className="flex items-center gap-1.5 text-[12.5px] text-muted min-w-0">
          <button onClick={back} className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-lg hover:bg-white hover:text-ink font-medium"><Icon name="ChevronLeft" size={15} />Back</button>
          <span className="hidden sm:inline text-slate-300">/</span>
          <Link to={listPath} className="hidden sm:inline hover:text-ink whitespace-nowrap">{listPath === '/ideas' ? 'Idea Register' : 'My Ideas'}</Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono text-ink font-semibold truncate">{idea.id}</span>
          <span className="hidden sm:inline text-[10px] font-bold text-muted border border-line rounded px-1.5 py-px ml-1">M4 · Idea 360</span>
        </nav>
        <div className="flex items-center gap-1">
          <IconButton icon="Link2" title="Copy link" onClick={() => { navigator.clipboard?.writeText(window.location.href); useStore.getState().toast('Link to this idea copied', 'info') }} />
          <IconButton icon="FileSpreadsheet" title="Export idea to Excel" onClick={exportOne} />
          <IconButton icon="Printer" title="Print" onClick={() => window.print()} />
        </div>
      </div>

      {idea.stage === 'Draft' && (
        <div className="card border-gold-200 bg-gold-50/70 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="h-9 w-9 rounded-xl grid place-items-center bg-white text-gold-600 border border-gold-200"><Icon name="PencilLine" size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-ink">This idea is a draft</div>
            <div className="text-[12px] text-muted">Saved {fmtDate(idea.createdAt.slice(0, 10))} · not yet visible to the team. Complete it and submit it to get an idea ID.</div>
          </div>
          {idea.submitterId === me.id && <Button variant="primary" icon="PencilLine" onClick={() => nav(`/submit?draft=${idea.id}`)}>Continue editing</Button>}
        </div>
      )}

      <HeaderCard idea={idea} />

      <Card title="Stage tracker" icon="Route" subtitle={`${idea.route} route · ${stagesOf(idea).join(' → ')}`} actions={<CurrentStageSla idea={idea} />}>
        <StageTracker idea={idea} />
      </Card>

      <PartsTable idea={idea} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        <div className="xl:col-span-8 space-y-3 min-w-0">
          <DetailsCard idea={idea} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FeasibilityPanel idea={idea} />
            <TechEvalPanel idea={idea} />
            <ApprovalsPanel idea={idea} />
          </div>
          {idea.execution && <ExecutionSummary idea={idea} />}
          <Attachments idea={idea} />
        </div>
        <div className="xl:col-span-4 space-y-3 min-w-0">
          <ValueCard idea={idea} />
          <LinkedRequests idea={idea} />
          <Comments idea={idea} />
          <KeyFacts idea={idea} />
        </div>
      </div>

      <div id="audit-trail"><ActivityLog idea={idea} /></div>
    </div>
  )
}
