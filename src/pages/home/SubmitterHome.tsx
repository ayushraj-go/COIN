// Submitter home — one screen at xl: ideas by bucket + submit banner, recent ideas with stage tracker, my actions, open campaigns
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore, useMe } from '../../store/useStore'
import type { Bucket } from '../../lib/types'
import { BUCKET_STYLE, ideaAnnualised, ideaRealised } from '../../lib/calc'
import { fmtDate, inrShort, sum, timeAgo } from '../../lib/format'
import { Badge, BucketBadge, Button, Card, Count, EmptyState, Icon, InfoTip, LeverChip, Money, useWarmup } from '../../components/ui'
import { HomeHeader, HomeSkeleton, Reveal, RevealGrid, StageTrackerMini, useDrill } from './shared'
import { MyActionsCard } from './MyActions'
import { useFitHeight, useRowsFit } from './fit'

const BUCKET_ORDER: Bucket[] = ['Draft', 'Pipeline', 'In Execution', 'Implemented', 'Dropped']
const BUCKET_ICON: Record<Bucket, string> = { Draft: 'FilePen', Pipeline: 'Filter', 'In Execution': 'Rocket', Implemented: 'CircleCheckBig', Dropped: 'CircleSlash' }

/** Compact submit banner (blue → teal) — sits in the top row of the people homes */
export function SubmitCta({ title, desc, campaignHint }: { title: string; desc: string; campaignHint?: string }) {
  const nav = useNavigate()
  return (
    <div className="relative overflow-hidden rounded-2xl bg-hero text-white p-4 h-full min-h-[96px] flex items-center gap-4 shadow-[0_18px_40px_-24px_rgb(36_89_224/.65)]">
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-16 -bottom-20 h-36 w-36 rounded-full bg-white/[.07]" />
      <div className="pointer-events-none absolute inset-0 opacity-[.18]" style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / .55) 1px, transparent 1px)', backgroundSize: '14px 14px', maskImage: 'linear-gradient(90deg, transparent 35%, #000)' }} />
      <div className="relative min-w-0 flex-1">
        <h2 className="text-[15px] leading-snug font-bold tracking-[-0.01em]">{title}</h2>
        <p className="text-[11.5px] text-white/80 mt-1 leading-snug line-clamp-2" title={desc}>{desc}</p>
        {campaignHint && <p className="text-[11px] text-white/90 mt-1.5 flex items-center gap-1 font-medium"><Icon name="Megaphone" size={12} />{campaignHint}</p>}
      </div>
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => nav('/submit')} className="relative shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white text-brand-700 font-bold text-[13px] shadow-[0_8px_20px_-10px_rgb(15_27_51/.6)] hover:bg-brand-50">
        <Icon name="CirclePlus" size={16} />Submit idea
      </motion.button>
    </div>
  )
}

export function OpenCampaigns({ className, supplierCode }: { className?: string; supplierCode?: string }) {
  const campaigns = useStore((s) => s.campaigns)
  const ideas = useStore((s) => s.ideas)
  const commodities = useStore((s) => s.commodities)
  const me = useMe()
  const nav = useNavigate()
  const live = campaigns.filter((c) => c.status === 'Live' && (!supplierCode || c.suppliers.includes(supplierCode)))
  return (
    <Card className={className} icon="Megaphone" title="Open campaigns to contribute to" subtitle={`${live.length} live · ideas submitted from a campaign link are tagged to it automatically`}>
      {live.length ? (
        <div className="grid grid-cols-1 gap-2 [&>*]:min-w-0">
          {live.map((c) => {
            const yieldIdeas = ideas.filter((i) => i.campaignId === c.id && i.stage !== 'Draft')
            const value = sum(yieldIdeas.map((x) => ideaAnnualised(x)))
            const invited = !!me && c.internalInvitees.includes(me.id)
            const com = commodities.find((x) => x.code === c.commodity)
            return (
              <div key={c.id} className="rounded-xl border border-line p-3 hover:border-brand-200 hover:shadow-[0_8px_24px_-14px_rgb(36_89_224/.45)] transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge color={c.type === 'Workshop' ? '#7c3aed' : '#0284c7'} icon={c.type === 'Workshop' ? 'Presentation' : 'Megaphone'}>{c.type}</Badge>
                      {invited && <Badge color="#2f5bc6" icon="MailCheck">Invited</Badge>}
                      <span className="text-[11px] text-muted font-mono">{c.id}</span>
                    </div>
                    <div className="text-[13px] font-semibold text-ink mt-1 truncate">{c.name}</div>
                    <div className="text-[11.5px] text-muted truncate">{com?.name ?? c.commodity} · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}{c.workshopDate ? ` · workshop ${fmtDate(c.workshopDate)}` : ''}</div>
                  </div>
                  <Button size="sm" variant="outline" icon="CirclePlus" onClick={() => nav(`/submit?campaign=${c.id}`)}>Contribute</Button>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[12px] text-muted">
                  <span><b className="text-ink num">{yieldIdeas.length}</b> ideas</span>
                  <span><b className="text-ink num">{inrShort(value)}</b> value</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon="Megaphone" title="No live campaigns right now" desc="Campaigns and supplier workshops appear here when Sourcing launches them. You can still submit an idea any time." className="py-6" />
      )}
    </Card>
  )
}

/** Compact live-campaign list sized to its card (rows fit the space, no inner scroll) */
function CampaignsCompact({ className }: { className?: string }) {
  const campaigns = useStore((s) => s.campaigns)
  const ideas = useStore((s) => s.ideas)
  const commodities = useStore((s) => s.commodities)
  const me = useMe()
  const nav = useNavigate()
  const live = campaigns.filter((c) => c.status === 'Live')
  const [boxRef, fit] = useRowsFit(54, 3, 1, live.length)
  const shown = live.slice(0, fit)
  return (
    <Card className={className} bodyClass="flex flex-col" icon="Megaphone" title="Open campaigns" subtitle={`${live.length} live · ideas from a campaign link are tagged to it`}>
      <div ref={boxRef} className="flex-1 min-h-0 overflow-hidden">
        {live.length ? shown.map((c) => {
          const yieldIdeas = ideas.filter((i) => i.campaignId === c.id && i.stage !== 'Draft')
          const value = sum(yieldIdeas.map((x) => ideaAnnualised(x)))
          const invited = !!me && c.internalInvitees.includes(me.id)
          const com = commodities.find((x) => x.code === c.commodity)
          const ws = c.type === 'Workshop'
          return (
            <div key={c.id} className="h-[54px] flex items-center gap-2.5 border-b border-slate-100 last:border-0">
              <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${ws ? 'bg-accent-50 text-accent-600' : 'bg-brand-50 text-brand-600'}`} title={c.type}><Icon name={ws ? 'Presentation' : 'Megaphone'} size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0"><span className="text-[12.5px] font-semibold text-ink truncate">{c.name}</span>{invited && <Icon name="MailCheck" size={12} className="text-brand-600 shrink-0" />}</span>
                <span className="block text-[11px] text-muted truncate">{com?.name ?? c.commodity} · till {fmtDate(c.endDate)} · <b className="text-ink-2 num">{yieldIdeas.length}</b> ideas · <b className="text-ink-2 num">{inrShort(value)}</b></span>
              </span>
              <Button size="xs" variant="outline" icon="CirclePlus" onClick={() => nav(`/submit?campaign=${c.id}`)}>Contribute</Button>
            </div>
          )
        }) : <EmptyState icon="Megaphone" title="No live campaigns right now" desc="You can still submit an idea any time." className="py-4" />}
        {live.length > shown.length && <div className="h-7 flex items-center text-[11.5px] font-semibold text-muted">+ {live.length - shown.length} more live campaign{live.length - shown.length > 1 ? 's' : ''}</div>}
      </div>
    </Card>
  )
}

export default function SubmitterHome() {
  const ready = useWarmup(320)
  const me = useMe()!
  const ideas = useStore((s) => s.ideas)
  const ledger = useStore((s) => s.ledger)
  const campaigns = useStore((s) => s.campaigns)
  const commodities = useStore((s) => s.commodities)
  const openIdea = useStore((s) => s.openIdea)
  const drill = useDrill()
  const nav = useNavigate()
  const [fitRef, fitH] = useFitHeight()
  const mine = useMemo(() => ideas.filter((i) => i.submitterId === me.id).sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt)), [ideas, me.id])
  const [listRef, rows] = useRowsFit(54, 6, 3, mine.length)
  const stats = BUCKET_ORDER.map((b) => { const l = mine.filter((i) => i.bucket === b); return { b, count: l.length, value: sum(l.map((x) => ideaAnnualised(x))) } })
  const realised = sum(mine.map((i) => ideaRealised(ledger, i.id)))
  const submitted = mine.filter((i) => i.bucket !== 'Draft')
  const submittedValue = sum(submitted.map((x) => ideaAnnualised(x)))
  const conversion = submitted.length ? Math.round((stats[3].count / submitted.length) * 100) : 0
  const live = campaigns.filter((c) => c.status === 'Live')
  const firstCommodity = commodities.find((c) => c.code === live[0]?.commodity)?.name ?? 'your plant'
  const mix = stats.filter((s) => s.b !== 'Draft' && s.value > 0)
  if (!ready) return <HomeSkeleton variant="people" />
  return (
    <div>
      <HomeHeader />
      <div ref={fitRef} style={fitH ? { height: fitH } : undefined}>
        <RevealGrid className="h-full grid grid-cols-12 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]">
          {/* Row 1 — my ideas by bucket + submit banner */}
          <Reveal className="col-span-12 xl:col-span-8">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 h-full">
              {stats.map((s) => {
                const st = BUCKET_STYLE[s.b]
                return (
                  <button key={s.b} onClick={() => drill({ bucket: s.b }, '/my-ideas', false)} className="card relative overflow-hidden text-left px-4 py-3.5 hover:-translate-y-0.5 hover:border-[#d0d5dd] transition-all">
                    <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: st.color }} />
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: st.text }}><Icon name={BUCKET_ICON[s.b]} size={13} />{s.b}</div>
                    <div className="text-[24px] leading-none font-bold tracking-tight text-ink mt-2.5"><Count value={s.count} /></div>
                    <div className="text-[11.5px] text-muted mt-1.5 num">{s.value ? <Money value={s.value} /> : '—'}</div>
                  </button>
                )
              })}
            </div>
          </Reveal>
          <Reveal className="col-span-12 xl:col-span-4">
            <SubmitCta title="Have a cost-reduction idea?" desc="Put a rupee value on it in minutes — pick a lever and part, and the savings panel values it from LBP and last-FY MRN." campaignHint={live.length ? `${live.length} campaign${live.length > 1 ? 's' : ''} open for ideas` : undefined} />
          </Reveal>

          {/* Row 2 — recent ideas (fills) + actions & campaigns */}
          <Reveal className="col-span-12 xl:col-span-8 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="Lightbulb"
              title={<span className="flex items-center gap-1.5">My recent ideas<InfoTip title="My ideas">Every idea you submitted, by bucket. Value = Σ annualised impact; realised comes from actual MRN after the effective date. Click an idea to open it in the side panel.</InfoTip></span>}
              subtitle={`${submitted.length} submitted · ${inrShort(submittedValue)} annualised · ${inrShort(realised)} realised`}
              actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => nav('/my-ideas')}>View all</Button>}>
              {mine.length ? (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_170px_96px] gap-3 pb-1.5 border-b border-line text-[10.5px] font-semibold uppercase tracking-wide text-muted shrink-0">
                    <span>Idea</span><span className="hidden sm:block">Live status</span><span className="text-right">Annualised</span>
                  </div>
                  <div ref={listRef} className="flex-1 min-h-0 overflow-hidden">
                    {mine.slice(0, rows).map((i) => (
                      <button key={i.id} onClick={() => openIdea(i.id)} className="group w-full h-[54px] grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_170px_96px] items-center gap-3 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 min-w-0"><span className="font-mono text-[10.5px] text-muted shrink-0">{i.id}</span><span className="text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title || 'Untitled draft'}</span></span>
                          <span className="flex items-center gap-2 mt-1 min-w-0 overflow-hidden"><BucketBadge bucket={i.bucket} /><LeverChip leverId={i.leverId} compact /><span className="text-[11px] text-muted whitespace-nowrap">{timeAgo(i.submittedAt ?? i.createdAt)}</span></span>
                        </span>
                        <span className="hidden sm:flex flex-col gap-1 min-w-0"><StageTrackerMini idea={i} /><span className="text-[11px] text-muted truncate">{i.stage}</span></span>
                        <span className="text-right text-[13px] font-bold text-ink num">{inrShort(ideaAnnualised(i))}</span>
                      </button>
                    ))}
                    {mine.length > rows && <button onClick={() => nav('/my-ideas')} className="h-7 flex items-center text-left text-[11.5px] font-semibold text-muted hover:text-brand-700">+ {mine.length - rows} more in My Ideas</button>}
                  </div>
                  {/* value mix across buckets */}
                  <div className="shrink-0 mt-2 pt-3 border-t border-line">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-muted flex items-center gap-1.5"><Icon name="TrendingUp" size={13} className="text-brand-600" />Conversion <b className="text-ink">{conversion}%</b> of submitted ideas implemented</span>
                      <span className="text-muted">Realised to date <b className="text-accent-700 num">{inrShort(realised)}</b></span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden flex">
                      {mix.map((s) => <span key={s.b} className="h-full" title={`${s.b} · ${inrShort(s.value)}`} style={{ width: `${(s.value / (submittedValue || 1)) * 100}%`, background: BUCKET_STYLE[s.b].color }} />)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
                      {stats.filter((s) => s.b !== 'Draft').map((s) => <span key={s.b} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: BUCKET_STYLE[s.b].color }} />{s.b} <b className="text-ink-2 num">{inrShort(s.value)}</b></span>)}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState icon="Lightbulb" title={`No ideas yet — submit the first idea for ${firstCommodity}`} desc="Pick a lever, add the part code and the savings panel values it for you — baseline from LBP, volume from last FY MRN." action={<Button variant="primary" icon="CirclePlus" onClick={() => nav(live[0] ? `/submit?campaign=${live[0].id}` : '/submit')}>Submit idea</Button>} className="flex-1" />
              )}
            </Card>
          </Reveal>
          <Reveal className="col-span-12 xl:col-span-4 min-h-0 gap-3">
            <div className="flex-1 min-h-0 flex flex-col"><MyActionsCard /></div>
            <CampaignsCompact className="flex-1 min-h-0" />
          </Reveal>
        </RevealGrid>
      </div>
    </div>
  )
}
