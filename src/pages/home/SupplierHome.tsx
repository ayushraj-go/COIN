// M6 — Supplier Workspace home (one screen at xl): KPIs + submit banner, then my ideas · workshop invites · feasibility requests
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import type { Campaign } from '../../lib/types'
import { BUCKET_STYLE, ideaAnnualised, slaStatus } from '../../lib/calc'
import { daysBetween, fmtDate, inrPrice, inrShort, pct, sum, timeAgo, todayIso } from '../../lib/format'
import { OUT_OF_SCOPE } from '../../lib/scope'
import { Badge, BucketBadge, Button, Card, EmptyState, Icon, InfoTip, LeverChip, SlaPill, useWarmup } from '../../components/ui'
import { HomeHeader, HomeSkeleton, MiniStat, Reveal, RevealGrid, StageTrackerMini } from './shared'
import { SubmitCta } from './SubmitterHome'
import { useFitHeight, useRowsFit } from './fit'

const ATT_STYLE: Record<string, { color: string; icon: string }> = {
  Invited: { color: '#4470d6', icon: 'MailOpen' },
  Accepted: { color: '#0f9f6e', icon: 'CircleCheck' },
  Declined: { color: '#6b7280', icon: 'CircleX' },
  Attended: { color: '#7c3aed', icon: 'BadgeCheck' },
}

export default function SupplierHome() {
  const ready = useWarmup(320)
  const me = useMe()!
  const code = me.supplierCode ?? ''
  const { ideas, campaigns, suppliers, commodities, slaRules, setAttendance, toast, openIdea } = useStore()
  const nav = useNavigate()
  const [fitRef, fitH] = useFitHeight()
  const [feasRef, feasRows] = useRowsFit(46, 4)
  const sup = suppliers.find((s) => s.code === code)
  const invites = useMemo(() => campaigns.filter((c) => c.suppliers.includes(code) && c.status !== 'Draft').sort((a, b) => (b.workshopDate ?? b.startDate).localeCompare(a.workshopDate ?? a.startDate)), [campaigns, code])
  const pendingFeas = ideas.filter((i) => i.feasibility?.supplierCode === code && !i.feasibility.respondedAt && i.bucket === 'Pipeline')
  const answered = ideas.filter((i) => i.feasibility?.supplierCode === code && i.feasibility.respondedAt).sort((a, b) => (b.feasibility!.respondedAt ?? '').localeCompare(a.feasibility!.respondedAt ?? ''))
  const own = useMemo(() => ideas.filter((i) => (i.isSupplierSubmission && i.supplierCode === code) || i.submitterId === me.id).sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt)), [ideas, code, me.id])
  const [ideasRef, ideaRows] = useRowsFit(76, 4, 1, own.length)
  const [invRef, invRows] = useRowsFit(150, 2, 1, invites.length)
  const ownSubmitted = own.filter((i) => i.stage !== 'Draft')
  const gs = ownSubmitted.filter((i) => i.gainSharePct != null)
  const gsAvg = gs.length ? sum(gs.map((i) => i.gainSharePct!)) / gs.length : 0
  const gsValue = sum(gs.map((i) => (ideaAnnualised(i) * (i.gainSharePct ?? 0)) / 100))
  const awaitingReply = invites.filter((c) => c.status === 'Live' && (c.attendance[code] ?? 'Invited') === 'Invited')
  const payoutNote = OUT_OF_SCOPE.find((o) => o.toLowerCase().includes('gain-share'))
  const nextWs = invites.filter((c) => c.workshopDate && c.workshopDate >= todayIso()).sort((a, b) => a.workshopDate!.localeCompare(b.workshopDate!))[0]
  const nextDays = nextWs ? daysBetween(todayIso(), nextWs.workshopDate!) : null
  const accepted = invites.filter((c) => c.attendance[code] === 'Accepted').length
  const attended = invites.filter((c) => c.attendance[code] === 'Attended').length
  // feasibility: pending first, then the most recently answered, in one fitted list
  const feasPending = pendingFeas.slice(0, feasRows)
  const feasAnswered = answered.slice(0, Math.max(0, feasRows - feasPending.length - (pendingFeas.length ? 0 : 1) - 1))

  const respond = (c: Campaign, status: 'Accepted' | 'Declined') => {
    const prev = c.attendance[code] ?? 'Invited'
    setAttendance(c.id, code, status)
    toast(`${status === 'Accepted' ? 'Accepted' : 'Declined'} — ${c.name}`, status === 'Accepted' ? 'success' : 'info', () => setAttendance(c.id, code, prev))
  }
  if (!ready) return <HomeSkeleton variant="people" />
  return (
    <div>
      <HomeHeader subtitle={<>{sup?.name ?? me.designation} · <span className="font-mono">{code}</span> · {sup?.city} · Supplier Workspace</>} />

      <div ref={fitRef} style={fitH ? { height: fitH } : undefined}>
        <RevealGrid className="h-full grid grid-cols-12 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]">
          {/* Row 1 — KPIs + submit banner */}
          <Reveal className="col-span-12 xl:col-span-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full [&>*]:h-full">
              <MiniStat label="Workshop invites" icon="Presentation" color="#7c3aed" value={invites.length} sub={awaitingReply.length ? `${awaitingReply.length} awaiting your reply` : 'All invitations answered'} onClick={() => nav('/workshops')} />
              <MiniStat label="Feasibility requests" icon="ClipboardCheck" color={pendingFeas.length ? '#e0364f' : '#0f9f6e'} value={pendingFeas.length} sub={pendingFeas.length ? 'Pending — price, lead time, MOQ' : `None pending · ${answered.length} answered`} onClick={() => nav('/feasibility')} />
              <MiniStat label="My ideas" icon="Lightbulb" color="#4470d6" value={ownSubmitted.length} sub={<>{inrShort(sum(ownSubmitted.map((x) => ideaAnnualised(x))))} annualised impact</>} onClick={() => nav('/my-ideas')} />
              <MiniStat label="Gain-share offered" icon="Handshake" color="#0d9488" value={gs.length ? `${gsAvg.toFixed(1)}%` : '—'} sub={gs.length ? `avg on ${gs.length} ideas · ≈ ${inrShort(gsValue)} / yr` : 'Offer gain-share when you submit'} tip={<InfoTip title="Gain-share offered to Amber">{payoutNote}</InfoTip>} />
            </div>
          </Reveal>
          <Reveal className="col-span-12 xl:col-span-4">
            <SubmitCta title="Bring your next idea to Amber" desc="Submit with a gain-share offer and its validity, then track it from buyer validation to PAP price revision and first MRN." campaignHint={awaitingReply.length ? `${awaitingReply.length} workshop invite${awaitingReply.length > 1 ? 's' : ''} awaiting reply` : undefined} />
          </Reveal>

          {/* Row 2 — three equal columns: my ideas · workshop invites · feasibility */}
          <Reveal className="col-span-12 md:col-span-6 xl:col-span-4 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="Lightbulb"
              title={<span className="flex items-center gap-1.5">My ideas & status<InfoTip title="Gain-share">{payoutNote}</InfoTip></span>}
              subtitle={`${ownSubmitted.length} submitted · gain-share and live stage tracker`}
              actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => nav('/my-ideas')}>My Ideas</Button>}>
              {own.length ? (
                <>
                  <div ref={ideasRef} className="flex-1 min-h-0 overflow-hidden">
                    {own.slice(0, ideaRows).map((i) => (
                      <button key={i.id} onClick={() => openIdea(i.id)} className="group w-full h-[76px] flex flex-col justify-center gap-1 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                        <span className="flex items-center justify-between gap-3 min-w-0"><span className="text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title || 'Untitled draft'}</span><span className="text-[13px] font-bold text-ink num shrink-0">{inrShort(ideaAnnualised(i))}</span></span>
                        <span className="flex items-center gap-1.5 min-w-0 overflow-hidden"><span className="font-mono text-[10.5px] text-muted shrink-0">{i.id}</span><LeverChip leverId={i.leverId} compact />{i.gainSharePct != null && <span className="ml-auto shrink-0 text-[11px] text-muted">GS <b className="text-ink-2 num">{pct(i.gainSharePct, 0)}</b></span>}</span>
                        <span className="flex items-center gap-2 min-w-0"><StageTrackerMini idea={i} className="shrink-0" /><span className="text-[11px] text-muted truncate">{i.stage}</span>{i.offerValidity && <span className="ml-auto shrink-0 text-[11px] text-muted">valid to {fmtDate(i.offerValidity)}</span>}</span>
                      </button>
                    ))}
                    {own.length > ideaRows && <button onClick={() => nav('/my-ideas')} className="h-7 flex items-center text-left text-[11.5px] font-semibold text-muted hover:text-brand-700">+ {own.length - ideaRows} more in My Ideas</button>}
                  </div>
                  <div className="shrink-0 mt-2 pt-3 border-t border-line grid grid-cols-2 gap-2">
                    {(['Pipeline', 'In Execution', 'Implemented', 'Dropped'] as const).map((b) => {
                      const l = ownSubmitted.filter((i) => i.bucket === b)
                      const st = BUCKET_STYLE[b]
                      return <div key={b} className="rounded-xl border px-3 py-1.5" style={{ borderColor: `${st.color}33`, background: st.soft }}><div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: st.text }}>{b}</div><div className="flex items-baseline justify-between gap-2"><span className="text-[17px] font-bold text-ink num leading-tight">{l.length}</span><span className="text-[11px] text-muted num">{inrShort(sum(l.map((x) => ideaAnnualised(x))))}</span></div></div>
                    })}
                  </div>
                </>
              ) : (
                <EmptyState icon="Lightbulb" title={`No ideas yet — submit the first idea for ${commodities.find((c) => c.code === sup?.commodities[0])?.name ?? 'your commodity'}`} desc="Share a cost-reduction idea with Amber and offer a gain-share; Sourcing validates it and routes it by lever." action={<Button variant="primary" icon="CirclePlus" onClick={() => nav('/submit')}>Submit idea</Button>} className="flex-1" />
              )}
            </Card>
          </Reveal>

          <Reveal className="col-span-12 md:col-span-6 xl:col-span-4 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="Presentation" title="Workshop invites" subtitle="Supplier improvement workshops & campaigns"
              actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => nav('/workshops')}>Workshops</Button>}>
              <div ref={invRef} className="flex-1 min-h-0 overflow-hidden">
                {invites.length ? invites.slice(0, invRows).map((c) => {
                  const st = c.attendance[code] ?? 'Invited'
                  const s = ATT_STYLE[st]
                  const upcoming = (c.workshopDate ?? c.endDate) >= todayIso()
                  const com = commodities.find((x) => x.code === c.commodity)
                  const canRespond = c.status === 'Live' && upcoming && st !== 'Attended'
                  const mineIn = ownSubmitted.filter((i) => i.campaignId === c.id)
                  const allIn = ideas.filter((i) => i.campaignId === c.id && i.stage !== 'Draft')
                  return (
                    <div key={c.id} className="h-[150px] py-2.5 flex flex-col border-b border-slate-100 last:border-0">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 text-center leading-none ${c.status === 'Live' ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-500'}`}>
                          {c.workshopDate ? <span><span className="block text-[16px] font-bold">{c.workshopDate.slice(8, 10)}</span><span className="block text-[9.5px] font-bold uppercase mt-0.5">{fmtDate(c.workshopDate).slice(3, 6)}</span></span> : <Icon name="Megaphone" size={17} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden"><Badge color={c.status === 'Live' ? '#0f9f6e' : '#64748b'} dot>{c.status}</Badge><Badge color={s.color} icon={s.icon}>{st}</Badge></div>
                          <div className="text-[12.5px] font-semibold text-ink mt-1 truncate">{c.name}</div>
                          <div className="text-[11px] text-muted truncate">{c.type} · {com?.name ?? c.commodity}{c.venue ? ` · ${c.venue}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-[11.5px] text-ink-2 leading-snug mt-1.5 line-clamp-1" title={c.summary ?? c.description}>{c.summary ?? c.description}</div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted truncate">Yield <b className="text-ink-2 num">{allIn.length}</b> ideas · <b className="text-ink-2 num">{inrShort(sum(allIn.map((x) => ideaAnnualised(x))))}</b> · yours <b className="text-brand-700 num">{mineIn.length}</b></span>
                        {canRespond ? (
                          <span className="flex items-center gap-1 shrink-0">
                            <Button size="xs" variant={st === 'Accepted' ? 'success' : 'secondary'} icon="Check" title="Accept" aria-label="Accept" disabled={st === 'Accepted'} onClick={() => respond(c, 'Accepted')} />
                            <Button size="xs" variant="danger" icon="X" title="Decline" aria-label="Decline" disabled={st === 'Declined'} onClick={() => respond(c, 'Declined')} />
                            <Button size="xs" variant="outline" icon="CirclePlus" title="Submit an idea to this campaign" onClick={() => nav(`/submit?campaign=${c.id}`)}>Idea</Button>
                          </span>
                        ) : <span className="text-[11px] text-muted shrink-0">{c.summary ? 'Summary published' : 'Closed'}</span>}
                      </div>
                    </div>
                  )
                }) : <EmptyState icon="Presentation" title="No workshop invitations yet" desc="Invitations arrive by email and appear here when Sourcing launches a campaign for your commodity." className="py-6" />}
                {invites.length > invRows && <button onClick={() => nav('/workshops')} className="h-7 flex items-center text-left text-[11.5px] font-semibold text-muted hover:text-brand-700">+ {invites.length - invRows} more invitations</button>}
              </div>
              {invites.length > 0 && (
                <div className="shrink-0 mt-2 pt-3 border-t border-line grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-line bg-soft-blue px-2.5 py-1.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Next</div><div className="text-[13px] font-bold text-ink">{nextWs ? (nextDays === 0 ? 'Today' : `In ${nextDays}d`) : '—'}</div><div className="text-[10.5px] text-muted truncate">{nextWs ? fmtDate(nextWs.workshopDate) : 'None scheduled'}</div></div>
                  <div className="rounded-xl border border-line bg-soft-teal px-2.5 py-1.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Accepted</div><div className="text-[13px] font-bold text-accent-700 num">{accepted}</div><div className="text-[10.5px] text-muted truncate">of {invites.length} invitations</div></div>
                  <div className="rounded-xl border border-line bg-soft-blue px-2.5 py-1.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">Attended</div><div className="text-[13px] font-bold text-brand-700 num">{attended}</div><div className="text-[10.5px] text-muted truncate">to date</div></div>
                </div>
              )}
            </Card>
          </Reveal>

          <Reveal className="col-span-12 xl:col-span-4 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="ClipboardCheck"
              title={<span className="flex items-center gap-1.5">Feasibility requests<InfoTip title="Feasibility requests">Amber asks you to confirm feasibility and your offered price, lead time and MOQ via a time-bound secure link. SLA: 7 working days, reminder on day 5.</InfoTip></span>}
              subtitle={`${pendingFeas.length} pending · ${answered.length} answered`}
              actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => nav('/feasibility')}>Respond</Button>}>
              <div ref={feasRef} className="flex-1 min-h-0 overflow-hidden">
                {!pendingFeas.length && (
                  <div className="h-[46px] flex items-center"><div className="w-full rounded-lg bg-accent-50 border border-accent-100 px-3 py-2 text-[12px] text-accent-700 flex items-center gap-2"><Icon name="CheckCheck" size={14} />No pending requests — you're up to date.</div></div>
                )}
                {feasPending.map((i) => {
                  const sla = slaStatus(i, slaRules)
                  return (
                    <button key={i.id} onClick={() => nav('/feasibility')} className="w-full h-[46px] flex items-center gap-2.5 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                      <span className="h-7 w-7 rounded-lg grid place-items-center bg-red-50 text-red-600 shrink-0"><Icon name="ClipboardCheck" size={14} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold text-ink truncate">{i.title}</span><span className="block text-[11px] text-muted truncate">{i.id} · requested {timeAgo(i.feasibility!.requestedAt)} · {i.parts[0]?.description ?? i.commodity}</span></span>
                      <SlaPill state={sla.state} left={sla.left} working={sla.working} />
                    </button>
                  )
                })}
                {feasAnswered.length > 0 && <div className="h-[22px] flex items-end text-[10.5px] font-semibold uppercase tracking-wide text-muted">Recently answered</div>}
                {feasAnswered.map((i) => (
                  <button key={i.id} onClick={() => openIdea(i.id)} className="w-full h-[46px] flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                    <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-ink truncate">{i.title}</span><span className="block text-[11px] text-muted truncate">{i.id} · {fmtDate(i.feasibility!.respondedAt!.slice(0, 10))}</span></span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {i.feasibility!.offeredPrice != null && <span className="text-[11.5px] font-semibold text-ink num">{inrPrice(i.feasibility!.offeredPrice)}</span>}
                      <Badge color={i.feasibility!.feasible ? '#0f9f6e' : '#e0364f'} icon={i.feasibility!.feasible ? 'Check' : 'X'}>{i.feasibility!.feasible ? 'Feasible' : 'Not feasible'}</Badge>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          </Reveal>
        </RevealGrid>
      </div>
    </div>
  )
}
