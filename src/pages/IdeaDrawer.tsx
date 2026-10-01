// Side-panel review — open an idea from any list without losing your place (Section 14, M5).
import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe, useStore } from '../store/useStore'
import { BUCKET_STYLE, canSeeIdea, ideaAnnualised, ideaSavingPct } from '../lib/calc'
import { BucketBadge, Button, Card, Drawer, EmptyState, Icon, Money, StageBadge, UserChip } from '../components/ui'
import { fmtDate } from '../lib/format'
import { stagesOf } from './idea/model'
import { ActionBar } from './idea/ActionBar'
import { CurrentStageSla, StageTracker } from './idea/StageTracker'
import { ValueCard } from './idea/ValueCard'
import { PartsTable } from './idea/PartsTable'
import { IdeaMetaChips, KeyFacts, LinkedRequests } from './idea/Panels'
import { ActivityLog } from './idea/ActivityLog'

export default function IdeaDrawer() {
  const id = useStore((s) => s.drawerIdeaId)
  const openIdea = useStore((s) => s.openIdea)
  const me = useMe()
  const nav = useNavigate()
  const last = useRef<string | null>(null)
  if (id) last.current = id
  const shownId = id ?? last.current
  const idea = useStore((s) => (shownId ? s.ideas.find((i) => i.id === shownId) : undefined))
  const close = useCallback(() => openIdea(null), [openIdea])
  const openFull = (hash = '') => {
    if (!idea) return
    openIdea(null)
    nav(`/ideas/${idea.id}${hash}`)
  }
  const allowed = !!idea && !!me && canSeeIdea(me, idea)
  const annual = idea ? ideaAnnualised(idea) : 0

  return (
    <Drawer open={!!id && !!idea} onClose={close} width={720}
      title={idea ? <span className="flex items-center gap-2 min-w-0"><span className="font-mono text-[13.5px] tracking-tight">{idea.id}</span><BucketBadge bucket={idea.bucket} /></span> : ''}
      subtitle={idea ? `${idea.stage} · ${idea.route} route` : ''}
      actions={idea && allowed ? <Button size="sm" variant="outline" icon="Maximize2" onClick={() => openFull()}>Open full page</Button> : undefined}>
      {idea && !allowed && (
        <EmptyState icon="ShieldX" title="You don't have access to this idea" desc="Visibility follows your role and commodity mapping." />
      )}
      {idea && allowed && (
        <div className="flex flex-col min-h-full">
          <div className="p-4 space-y-3 flex-1">
            {/* header */}
            <section className="card relative overflow-hidden p-3.5">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${BUCKET_STYLE[idea.bucket].color}, ${BUCKET_STYLE[idea.bucket].color}33)` }} />
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StageBadge stage={idea.stage} bucket={idea.bucket} />
                    {idea.locked && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded px-1.5 h-5"><Icon name="Lock" size={11} />Approved values are locked</span>}
                    {idea.infoRequested && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 h-5"><Icon name="MessageCircleQuestion" size={11} />More info requested</span>}
                  </div>
                  <h2 className="mt-1.5 text-[16px] font-bold text-ink leading-snug">{idea.title || 'Untitled draft'}</h2>
                  <IdeaMetaChips idea={idea} className="mt-2" />
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
                    <span className="inline-flex items-center gap-1.5">By {idea.isSupplierSubmission ? <span className="font-semibold text-ink-2">{idea.submitterName}</span> : <UserChip userId={idea.submitterId} size={18} />}</span>
                    <span className="inline-flex items-center gap-1.5">Buyer <UserChip userId={idea.buyerId} size={18} /></span>
                    <span>{fmtDate((idea.submittedAt ?? idea.createdAt)?.slice(0, 10))}</span>
                  </div>
                </div>
                <div className="sm:w-[170px] shrink-0 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white px-3 py-2.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Annualised impact</div>
                  <div className={annual < 0 ? 'text-red-600' : 'text-ink'}><span className="text-[21px] font-extrabold tracking-tight"><Money value={annual} /></span></div>
                  <div className="text-[11px] text-muted">{idea.scope === 'Open' ? 'Estimate' : `${ideaSavingPct(idea).toFixed(1)}% on baseline`}</div>
                </div>
              </div>
            </section>

            {idea.stage === 'Draft' && idea.submitterId === me?.id && (
              <div className="rounded-xl border border-gold-200 bg-gold-50/70 px-3 py-2.5 flex items-center gap-3">
                <Icon name="PencilLine" size={16} className="text-gold-600" />
                <span className="text-[12.5px] text-ink-2 flex-1">Draft — not yet submitted for validation.</span>
                <Button size="sm" variant="primary" onClick={() => { openIdea(null); nav(`/submit?draft=${idea.id}`) }}>Continue editing</Button>
              </div>
            )}

            <Card title="Stage tracker" icon="Route" subtitle={`${stagesOf(idea).length} stages`} actions={<CurrentStageSla idea={idea} />}>
              <StageTracker idea={idea} compact />
            </Card>
            <ValueCard idea={idea} compact />
            <PartsTable idea={idea} compact />
            <Card title="Key details" icon="FileText">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-0.5">Current state</div>
                  <div className="text-[12.5px] text-ink-2 leading-relaxed line-clamp-4">{idea.currentState || '—'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-0.5">Proposed change</div>
                  <div className="text-[12.5px] text-ink-2 leading-relaxed line-clamp-4">{idea.proposedChange || '—'}</div>
                </div>
              </div>
              {idea.evidence && (
                <div className="mt-2.5 text-[12px] text-muted flex items-start gap-1.5">
                  <Icon name="FileCheck2" size={13} className="shrink-0 mt-0.5" />
                  <span className="min-w-0">{idea.evidence}{idea.evidenceTags.length > 0 && <span className="ml-1 font-semibold text-brand-700">[{idea.evidenceTags.join(', ')}]</span>}</span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-muted">
                <button onClick={() => openFull()} className="inline-flex items-center gap-1 hover:text-brand-700"><Icon name="Paperclip" size={12} />{idea.attachments.length} attachment{idea.attachments.length === 1 ? '' : 's'}</button>
                <button onClick={() => openFull()} className="inline-flex items-center gap-1 hover:text-brand-700"><Icon name="MessagesSquare" size={12} />{idea.comments.length} comment{idea.comments.length === 1 ? '' : 's'}</button>
              </div>
            </Card>
            {(idea.npdRequestId || idea.papRequestId) && <LinkedRequests idea={idea} compact />}
            <KeyFacts idea={idea} compact />
            <ActivityLog idea={idea} compact limit={6} onShowAll={() => openFull('#audit-trail')} />
          </div>
          <div className="sticky bottom-0 z-10 border-t border-line bg-white/90 backdrop-blur-md px-4 py-3 shadow-[0_-8px_24px_-16px_rgb(14_19_48/.25)]">
            <ActionBar idea={idea} compact />
          </div>
        </div>
      )}
    </Drawer>
  )
}
