// M6 — Supplier Workspace: workshop / campaign invitations — accept or decline, details, submit ideas, track my ideas.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Campaign, Idea } from '../lib/types'
import { useMe, useStore } from '../store/useStore'
import { can } from '../lib/nav'
import { ideaAnnualised } from '../lib/calc'
import { addDays, daysBetween, fmtDate, inrShort, sum, todayIso } from '../lib/format'
import { Badge, BucketBadge, Button, Card, EmptyState, Icon, KpiCard, PageHeader, SkeletonGrid, StageBadge, Stagger, Tooltip, cn, useWarmup } from '../components/ui'
import { ATT_STYLE, CampaignStatusBadge, CampaignTypeBadge, GOLD, PRIMARY, dateRange, type AttendanceStatus } from './campaign/shared'

export default function Workshops() {
  const me = useMe()
  const nav = useNavigate()
  const campaigns = useStore((s) => s.campaigns)
  const ideas = useStore((s) => s.ideas)
  const commodities = useStore((s) => s.commodities)
  const suppliers = useStore((s) => s.suppliers)
  const ready = useWarmup()
  const isSupplier = !!me?.roles.includes('supplier')
  const code = me?.supplierCode ?? ''

  const invites = useMemo(() => {
    if (!me) return [] as Campaign[]
    const list = campaigns.filter((c) => c.status !== 'Draft' && (isSupplier ? c.suppliers.includes(code) : c.internalInvitees.includes(me.id)))
    const rank = (c: Campaign) => (c.status === 'Live' ? 0 : 1)
    return list.sort((a, b) => rank(a) - rank(b) || (a.workshopDate ?? a.endDate).localeCompare(b.workshopDate ?? b.endDate))
  }, [campaigns, me, isSupplier, code])

  const myIdeasIn = (c: Campaign): Idea[] => ideas.filter((i) => i.campaignId === c.id && i.stage !== 'Draft' && (i.submitterId === me?.id || (isSupplier && i.isSupplierSubmission && i.supplierCode === code)))

  if (!me) return null
  const setAttendance = useStore.getState().setAttendance
  const toast = useStore.getState().toast
  const respond = (c: Campaign, st: AttendanceStatus) => {
    const prev = c.attendance[code] ?? 'Invited'
    setAttendance(c.id, code, st)
    toast(st === 'Accepted' ? `Accepted — see you${c.workshopDate ? ` on ${fmtDate(c.workshopDate)}` : ''}. Reminder 2 days before.` : `Declined ${c.name}`, st === 'Accepted' ? 'success' : 'info', () => setAttendance(c.id, code, prev))
  }

  const today = todayIso()
  const accepted = invites.filter((c) => ['Accepted', 'Attended'].includes(c.attendance[code])).length
  const pending = invites.filter((c) => c.status === 'Live' && (c.attendance[code] ?? 'Invited') === 'Invited').length
  const next = invites.filter((c) => c.workshopDate && c.workshopDate >= today && c.status === 'Live').sort((a, b) => a.workshopDate!.localeCompare(b.workshopDate!))[0]
  const allMine = invites.flatMap(myIdeasIn)
  const myValue = sum(allMine.filter((i) => i.bucket !== 'Dropped').map((i) => ideaAnnualised(i)))
  const company = suppliers.find((s) => s.code === code)

  return (
    <div>
      <PageHeader icon="Presentation" title="Workshops"
        badge={isSupplier && company ? <Badge color={GOLD} icon="Factory">{company.name}</Badge> : undefined}
        subtitle={isSupplier ? 'Supplier improvement workshops and campaigns you are invited to — accept, bring ideas with gain-share offers, and track what you submitted' : 'Campaigns and workshops you are invited to as an internal participant'} />

      {!ready ? <SkeletonGrid rows={2} /> : (
        <>
          <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Invitations" value={invites.length} money={false} icon="MailOpen" color={PRIMARY} sub={isSupplier ? `${pending} awaiting your reply` : `${invites.filter((c) => c.status === 'Live').length} live`} tip="Workshop invitations are emailed on campaign launch, with a reminder 2 days before." />
            <KpiCard label={isSupplier ? 'Accepted' : 'Live now'} value={isSupplier ? accepted : invites.filter((c) => c.status === 'Live').length} money={false} icon="CalendarCheck" color="#0f9f6e" sub={isSupplier ? 'Accepted or attended' : 'Open for submissions'} />
            <KpiCard label="My ideas" value={allMine.length} money={false} icon="Lightbulb" color="#ec8a1c" sub={`${allMine.filter((i) => i.bucket === 'Implemented').length} implemented`} tip="Ideas you submitted with a campaign / workshop tag." />
            <KpiCard label="My ideas · ₹ value" value={myValue} icon="IndianRupee" color={GOLD} sub="Annualised impact, excl. dropped" formula="(P baseline − P new) × Q last FY MRN" />
          </Stagger>

          {next && (
            <div className="rounded-2xl border border-gold-200 bg-gradient-to-r from-gold-50 via-white to-brand-50 px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
              <span className="h-12 w-12 rounded-xl bg-white border border-gold-200 text-gold-700 grid place-items-center leading-none shrink-0">
                <span className="text-center"><span className="block text-[17px] font-extrabold">{next.workshopDate!.slice(8, 10)}</span><span className="block text-[10px] font-bold uppercase">{fmtDate(next.workshopDate).slice(3, 6)}</span></span>
              </span>
              <div className="min-w-[200px] flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gold-700">Next workshop · {daysBetween(today, next.workshopDate!) === 0 ? 'today' : `in ${daysBetween(today, next.workshopDate!)} days`}</div>
                <div className="text-[14px] font-semibold text-ink truncate">{next.name}</div>
                <div className="text-[12px] text-muted truncate">{next.venue ?? 'Venue to be confirmed'}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white border border-line text-[12px] font-semibold text-ink-2"><Icon name="BellRing" size={13} className="text-gold-600" />Reminder 2 days before · {fmtDate(addDays(next.workshopDate!, -2))}</span>
            </div>
          )}

          {invites.length ? (
            <Stagger className="flex flex-col gap-4">
              {invites.map((c) => {
                const st: AttendanceStatus = c.attendance[code] ?? 'Invited'
                const cm = commodities.find((x) => x.code === c.commodity)
                const mine = myIdeasIn(c)
                const d = c.workshopDate ? daysBetween(today, c.workshopDate) : null
                const upcoming = c.workshopDate ? c.workshopDate >= today : c.endDate >= today
                return (
                  <div key={c.id} className="card overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                      <div className="lg:col-span-8 p-4 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <CampaignTypeBadge type={c.type} />
                          <CampaignStatusBadge status={c.status} />
                          {c.workshopDate && upcoming && c.status === 'Live' && st !== 'Declined' && (
                            <Tooltip content={`Email reminder on ${fmtDate(addDays(c.workshopDate, -2))}`}>
                              <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-semibold border text-gold-700 bg-gold-50 border-gold-200"><Icon name="BellRing" size={12} />Reminder 2 days before</span>
                            </Tooltip>
                          )}
                          <span className="ml-auto font-mono text-[11px] text-muted">{c.id}</span>
                        </div>
                        <div className="mt-2 text-[15px] font-bold text-ink leading-snug">{c.name}</div>
                        {c.description && <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed">{c.description}</p>}
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Detail icon="CalendarDays" label={c.workshopDate ? 'Workshop date' : 'Campaign window'} value={c.workshopDate ? fmtDate(c.workshopDate) : dateRange(c.startDate, c.endDate)} sub={c.workshopDate ? (d! > 0 ? `in ${d} days` : d === 0 ? 'Today' : 'Held') : undefined} />
                          <Detail icon="MapPin" label="Venue" value={c.venue ?? (c.type === 'Campaign' ? 'Online submissions' : 'To be confirmed')} />
                          <Detail icon="Boxes" label="Commodity" value={cm?.name ?? c.commodity} />
                          <Detail icon="CalendarRange" label="Submissions open" value={dateRange(c.startDate, c.endDate)} />
                        </div>
                      </div>

                      <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-line bg-slate-50/60 p-4 flex flex-col gap-3 min-w-0">
                        {isSupplier ? (
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">Your response</div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge color={ATT_STYLE[st].color} icon={ATT_STYLE[st].icon}>{st}</Badge>
                              {st === 'Accepted' && c.workshopDate && d! < 0 && <span className="text-[11.5px] text-muted">Attendance being confirmed</span>}
                            </div>
                            {c.status === 'Live' && st !== 'Attended' && upcoming ? (
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant={st === 'Accepted' ? 'success' : 'secondary'} icon="CalendarCheck" onClick={() => st !== 'Accepted' && respond(c, 'Accepted')}>{st === 'Accepted' ? 'Accepted' : 'Accept'}</Button>
                                <Button variant={st === 'Declined' ? 'danger' : 'secondary'} icon="CalendarX" onClick={() => st !== 'Declined' && respond(c, 'Declined')}>{st === 'Declined' ? 'Declined' : 'Decline'}</Button>
                              </div>
                            ) : <div className="text-[12px] text-muted">{c.status === 'Closed' ? 'This workshop is closed.' : 'The workshop date has passed.'}</div>}
                          </div>
                        ) : (
                          <div className="text-[12.5px] text-ink-2">You are an internal invitee.{can(me, 'campaign') && <button onClick={() => nav(`/campaigns/${c.id}`)} className="ml-1 font-semibold text-brand-700 hover:underline">Open campaign</button>}</div>
                        )}
                        {c.status === 'Live' && (
                          <Button variant="primary" icon="CirclePlus" className="w-full" onClick={() => nav(`/submit?campaign=${c.id}`)}>Submit idea for this workshop</Button>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">
                            <span>My ideas in this {c.type.toLowerCase()}</span><span className="num">{mine.length}</span>
                          </div>
                          {mine.length ? (
                            <div className="rounded-xl border border-line bg-white divide-y divide-slate-100 overflow-hidden">
                              {mine.map((i) => (
                                <button key={i.id} onClick={() => useStore.getState().openIdea(i.id)} className="w-full text-left px-2.5 py-2 hover:bg-slate-50">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] text-muted">{i.id}</span>
                                    <span className="ml-auto text-[11.5px] font-semibold num">{inrShort(ideaAnnualised(i))}</span>
                                  </div>
                                  <div className="text-[12.5px] font-medium text-ink truncate">{i.title}</div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5"><StageBadge stage={i.stage} bucket={i.bucket} /><BucketBadge bucket={i.bucket} /></div>
                                </button>
                              ))}
                            </div>
                          ) : <div className={cn('rounded-xl border border-dashed border-slate-300 px-3 py-3 text-[12px] text-muted text-center')}>No ideas yet{c.status === 'Live' ? ' — bring your first idea with a gain-share offer.' : '.'}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </Stagger>
          ) : (
            <Card><EmptyState icon="Presentation" title="No workshop invitations yet" desc={isSupplier ? 'When Amber Sourcing launches a campaign or workshop for your commodity, the invitation arrives by email and appears here.' : 'You have not been invited to a campaign or workshop.'} /></Card>
          )}
        </>
      )}
    </div>
  )
}

function Detail({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted"><Icon name={icon} size={11} />{label}</div>
      <div className="text-[12.5px] font-semibold text-ink mt-0.5 leading-snug">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  )
}
