// M6 — Supplier Workspace: feasibility requests (respond with offered price, lead time, MOQ) via time-bound secure links.
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Idea, User } from '../lib/types'
import { useMe, useStore } from '../store/useStore'
import { can } from '../lib/nav'
import { isFeasibilityStage } from '../lib/calc'
import { fmtDate, fmtDateTime, inrPrice, inrShort, nowIso, num, uid } from '../lib/format'
import { Badge, BucketBadge, Button, Card, EmptyState, Icon, InfoTip, KpiCard, LeverChip, PageHeader, SkeletonGrid, StageBadge, Stagger, Tabs, Tooltip, cn, useWarmup } from '../components/ui'

const LINK_DAYS = 7
const DAY = 86400000
const expiresAt = (i: Idea) => new Date(i.feasibility?.requestedAt ?? i.stageEnteredAt).getTime() + LINK_DAYS * DAY
function left(ms: number) {
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return d > 0 ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${h}h ${String(m).padStart(2, '0')}m`
}
const tone = (v: number) => (v > 0 ? '#0f9f6e' : v < 0 ? '#e0364f' : '#64748b')

export default function Feasibility() {
  const me = useMe()
  const ideas = useStore((s) => s.ideas)
  const suppliers = useStore((s) => s.suppliers)
  const ready = useWarmup()
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t) }, [])

  const isSupplier = !!me?.roles.includes('supplier')
  const mine = useMemo(() => {
    if (!me) return { open: [] as Idea[], done: [] as Idea[] }
    const inScope = (i: Idea) => (isSupplier ? i.feasibility?.supplierCode === me.supplierCode : me.commodities.includes(i.commodity))
    const open = ideas.filter((i) => inScope(i) && !i.feasibility?.respondedAt && isFeasibilityStage(i.stage)).sort((a, b) => expiresAt(a) - expiresAt(b))
    const done = ideas.filter((i) => inScope(i) && !!i.feasibility?.respondedAt).sort((a, b) => (b.feasibility!.respondedAt! > a.feasibility!.respondedAt! ? 1 : -1))
    return { open, done }
  }, [ideas, me, isSupplier])

  if (!me) return null
  if (!can(me, 'feasibility')) {
    return (
      <div>
        <PageHeader icon="ClipboardCheck" title="Feasibility Requests" subtitle="Supplier feasibility and offered price" />
        <Card><EmptyState icon="ShieldCheck" title="Feasibility is confirmed by suppliers" desc="Suppliers confirm feasibility and offered price through a time-bound secure link; the Commodity Buyer can respond on their behalf (Section 3 permission matrix)." /></Card>
      </div>
    )
  }

  const company = suppliers.find((s) => s.code === me.supplierCode)
  const expiring = mine.open.filter((i) => { const l = expiresAt(i) - now; return l > 0 && l <= 2 * DAY }).length
  const expired = mine.open.filter((i) => expiresAt(i) <= now).length
  const feasibleN = mine.done.filter((i) => i.feasibility?.feasible).length
  const avgDays = mine.done.length ? mine.done.reduce((a, i) => a + (new Date(i.feasibility!.respondedAt!).getTime() - new Date(i.feasibility!.requestedAt).getTime()) / DAY, 0) / mine.done.length : 0

  return (
    <div>
      <PageHeader icon="ClipboardCheck" title="Feasibility Requests"
        badge={isSupplier && company ? <Badge color="#bf8f3f" icon="Factory">{company.name}</Badge> : <Badge color="#4470d6" icon="UserCheck">Respond on behalf</Badge>}
        subtitle={isSupplier ? 'Confirm feasibility with your offered price, lead time and MOQ — each request arrives by email with a time-bound secure link' : 'Feasibility-stage ideas in your commodities — respond on behalf of the supplier when they confirm offline'} />

      <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-gold-50 px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <span className="h-9 w-9 rounded-xl bg-white border border-brand-100 text-brand-600 grid place-items-center shrink-0"><Icon name="ShieldCheck" size={17} /></span>
        <div className="min-w-[220px] flex-1">
          <div className="text-[13px] font-semibold text-ink">Time-bound secure link</div>
          <div className="text-[12px] text-muted">Every feasibility request link expires {LINK_DAYS} days after the request. {isSupplier ? 'If a link has expired, ask the Commodity Buyer to re-issue it.' : 'Re-issue a link when a supplier missed the window; responses you enter are logged as "on behalf".'}</div>
        </div>
        <span className="text-[11.5px] text-muted inline-flex items-center gap-1"><Icon name="Timer" size={13} />Supplier feasibility SLA · 7 working days</span>
      </div>

      {!ready ? <SkeletonGrid rows={2} /> : (
        <>
          <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Open requests" value={mine.open.length} money={false} icon="Inbox" color="#2f5bc6" sub={expired ? `${expired} link${expired === 1 ? '' : 's'} expired` : 'All links active'} tip="Feasibility requests awaiting a response." onClick={() => setTab('open')} active={tab === 'open'} />
            <KpiCard label="Expiring ≤ 48 h" value={expiring} money={false} icon="Hourglass" color="#ec8a1c" sub="Respond before the link lapses" tip="Secure links expire 7 days after the request." />
            <KpiCard label="Responded" value={mine.done.length} money={false} icon="CheckCheck" color="#0f9f6e" sub={`Avg ${avgDays.toFixed(1)} days to respond`} tip="Requests already answered, with the idea's current status." onClick={() => setTab('done')} active={tab === 'done'} />
            <KpiCard label="Feasible rate" value={mine.done.length ? (feasibleN / mine.done.length) * 100 : 0} money={false} suffix="%" digits={0} icon="Gauge" color="#bf8f3f" sub={`${feasibleN} feasible of ${mine.done.length}`} formula="Feasible responses ÷ responses" />
          </Stagger>

          <Tabs layoutId="feas-tabs" className="mb-3" value={tab} onChange={(k) => setTab(k as any)}
            tabs={[{ key: 'open', label: 'Open requests', count: mine.open.length, icon: 'Inbox' }, { key: 'done', label: 'Responded', count: mine.done.length, icon: 'History' }]} />

          {tab === 'open' ? (
            mine.open.length ? (
              <Stagger className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {mine.open.map((i) => <RequestCard key={i.id} idea={i} me={me} onBehalf={!isSupplier} now={now} />)}
              </Stagger>
            ) : (
              <Card><EmptyState icon="CircleCheck" title="No open feasibility requests" desc={isSupplier ? 'You are all caught up. New requests arrive by email with a secure link and appear here.' : 'No idea in your commodities is waiting on supplier feasibility.'} /></Card>
            )
          ) : mine.done.length ? (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {mine.done.map((i) => <HistoryCard key={i.id} idea={i} showSupplier={!isSupplier} />)}
            </Stagger>
          ) : (
            <Card><EmptyState icon="History" title="No responses yet" desc="Responded requests appear here with the idea's live status." /></Card>
          )}
        </>
      )}
    </div>
  )
}

function Countdown({ idea, now }: { idea: Idea; now: number }) {
  const ms = expiresAt(idea) - now
  if (ms <= 0) return <Badge color="#e0364f" icon="Link2Off">Link expired</Badge>
  const warn = ms <= 2 * DAY
  return (
    <Tooltip content={<>Secure link expires {fmtDateTime(new Date(expiresAt(idea)).toISOString())}<div className="text-slate-300">{LINK_DAYS} days after the request</div></>}>
      <span className={cn('inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-semibold border num', warn ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-brand-700 bg-brand-50 border-brand-100')}>
        <Icon name="Timer" size={12} />Expires in {left(ms)}
      </span>
    </Tooltip>
  )
}

function RequestCard({ idea, me, onBehalf, now }: { idea: Idea; me: User; onBehalf: boolean; now: number }) {
  const commodities = useStore((s) => s.commodities)
  const suppliers = useStore((s) => s.suppliers)
  const { respondFeasibility, toast, openIdea, updateIdea, notify, users } = useStore.getState()
  const [open, setOpen] = useState(false)
  const [feasible, setFeasible] = useState<boolean | null>(null)
  const [price, setPrice] = useState('')
  const [lead, setLead] = useState('')
  const [moq, setMoq] = useState('')
  const [remarks, setRemarks] = useState('')
  const [tried, setTried] = useState(false)
  const expired = expiresAt(idea) <= now
  const cm = commodities.find((c) => c.code === idea.commodity)
  const supCode = idea.feasibility?.supplierCode ?? ''
  const sup = suppliers.find((s) => s.code === supCode)
  const p = idea.parts[0]
  const offered = Number(price)
  const unit = p && price ? p.baselinePrice - offered : 0
  const pct = p && price && p.baselinePrice ? (unit / p.baselinePrice) * 100 : 0
  const annual = p && price ? unit * p.annualVolume : 0

  const errs: Record<string, string> = {}
  if (feasible === null) errs.feasible = 'Choose feasible or not feasible'
  if (feasible) {
    if (p && !(offered > 0)) errs.price = 'Enter your offered price'
    if (!(Number(lead) > 0)) errs.lead = 'Enter lead time in days'
    if (!(Number(moq) > 0)) errs.moq = 'Enter the MOQ'
  }
  if (feasible === false && !remarks.trim()) errs.remarks = 'Remarks are mandatory when declining'
  const e = (k: string) => (tried ? errs[k] : undefined)

  const submit = () => {
    setTried(true)
    if (Object.keys(errs).length) return
    respondFeasibility(idea.id, { feasible: !!feasible, offeredPrice: feasible && p ? offered : undefined, leadTimeDays: feasible ? Number(lead) : undefined, moq: feasible ? Number(moq) : undefined, remarks: remarks.trim() || undefined, onBehalf })
    toast(feasible ? `${idea.id} — feasibility confirmed${p ? ` at ${inrPrice(offered)} / ${p.uom}` : ''}; idea moved to the next stage` : `${idea.id} — declined; idea dropped with reason "Supplier not feasible"`, feasible ? 'success' : 'warning')
  }
  const reissue = () => {
    const f = idea.feasibility ?? { requestedAt: idea.stageEnteredAt, supplierCode: supCode }
    updateIdea(idea.id, { feasibility: { ...f, requestedAt: nowIso() } }, 'Secure feasibility link re-issued (valid 7 days)')
    if (sup) useStore.setState((st) => ({ emails: [{ id: uid('e'), at: nowIso(), to: [sup.contactEmail], subject: `COIN · Feasibility requested for ${idea.id}`, body: `Secure link (valid 7 days): https://coin.amber/secure/${uid('lnk')}`, template: 'Feasibility request' }, ...st.emails] }))
    const su = users.find((u) => u.supplierCode === supCode)
    if (su) notify({ userId: su.id, title: 'Feasibility requested', body: `${idea.id} · ${idea.title} — link re-issued`, trigger: 'Feasibility requested', channel: 'Email with secure link', ideaId: idea.id, link: '/feasibility', severity: 'warning' })
    toast(`Secure link re-issued to ${sup?.contactEmail ?? supCode} — valid 7 days`, 'success')
  }

  const requestLink = () => {
    const buyer = users.find((u) => u.id === idea.buyerId)
    notify({ userId: idea.buyerId, title: 'Feasibility link re-issue requested', body: `${idea.id} · ${sup?.name ?? supCode} asked for a new secure link`, trigger: 'Feasibility requested', channel: 'In-app + email', ideaId: idea.id, link: '/feasibility', severity: 'warning' })
    toast(`Request sent to ${buyer?.name ?? 'the Commodity Buyer'} to re-issue the secure link`, 'info')
  }

  return (
    <div className={cn('card overflow-hidden', expired && 'border-red-200')}>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openIdea(idea.id)} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">{idea.id}</button>
          <StageBadge stage={idea.stage} bucket={idea.bucket} />
          <span className="ml-auto"><Countdown idea={idea} now={now} /></span>
        </div>
        <div className="mt-1.5 text-[14px] font-semibold text-ink leading-snug">{idea.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted">
          <LeverChip leverId={idea.leverId} />
          <span className="inline-flex items-center gap-1"><Icon name="Boxes" size={12} />{cm?.name ?? idea.commodity}</span>
          <span className="inline-flex items-center gap-1"><Icon name="CalendarClock" size={12} />Requested {fmtDate(idea.feasibility?.requestedAt?.slice(0, 10))}</span>
        </div>
        {onBehalf && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 border border-line px-2.5 py-1.5 text-[12px]">
            <Icon name="Factory" size={13} className="text-gold-600" />
            <span className="min-w-0 flex-1 truncate"><b className="text-ink">{sup?.name ?? supCode}</b> <span className="text-muted">· {supCode} · {sup?.contactName} · {sup?.contactEmail}</span></span>
          </div>
        )}

        {idea.parts.length ? (
          <div className="mt-3 rounded-xl border border-line overflow-hidden">
            {idea.parts.map((pt, k) => (
              <div key={pt.partCode} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] gap-x-3 gap-y-1 px-3 py-2 border-b border-slate-100 last:border-0 text-[12px]">
                <div className="col-span-2 sm:col-span-1 min-w-0">
                  <div className="font-mono font-semibold text-ink">{pt.partCode}{k === 0 && idea.parts.length > 1 && <span className="ml-1.5 font-sans text-[10.5px] font-bold text-brand-700">PRIMARY</span>}</div>
                  <div className="text-muted truncate">{pt.description}</div>
                </div>
                <div><div className="text-[10.5px] uppercase font-semibold text-muted">Baseline</div><div className="font-semibold num">{inrPrice(pt.baselinePrice)} <span className="text-muted font-normal">/ {pt.uom}</span></div></div>
                <div><div className="text-[10.5px] uppercase font-semibold text-muted">Expected new</div><div className="font-semibold num">{pt.newPrice ? inrPrice(pt.newPrice) : '—'}</div></div>
                <div className="col-span-2 sm:col-span-1"><div className="text-[10.5px] uppercase font-semibold text-muted">Annual volume</div><div className="font-semibold num">{num(pt.annualVolume)} {pt.uom}</div></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12px] text-muted">Open idea — no part code; rough annual estimate {inrShort((idea.openEstimateLakh ?? 0) * 1e5)}.</div>
        )}
        <p className="mt-2.5 text-[12.5px] text-ink-2 leading-relaxed line-clamp-3"><b className="text-ink">Proposed change:</b> {idea.proposedChange}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {expired && !onBehalf ? (
            <>
              <span className="w-full text-[12px] text-red-600 inline-flex items-center gap-1.5"><Icon name="Link2Off" size={13} />This link has expired — ask the Commodity Buyer to re-issue it.</span>
              <Button variant="outline" icon="RefreshCw" className="flex-1 sm:flex-none" onClick={requestLink}>Request a new link</Button>
            </>
          ) : (
            <Button variant={open ? 'secondary' : 'primary'} icon={open ? 'ChevronUp' : 'ClipboardPen'} className="flex-1 sm:flex-none" onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide response' : onBehalf ? 'Respond on behalf' : 'Respond'}
            </Button>
          )}
          {onBehalf && <Button variant="outline" icon="RefreshCw" onClick={reissue}>Re-issue link</Button>}
          <Button variant="ghost" icon="Eye" onClick={() => openIdea(idea.id)}>Details</Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && !(expired && !onBehalf) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="border-t border-line bg-slate-50/60 p-4 space-y-3">
              {onBehalf && <div className="text-[11.5px] text-muted inline-flex items-center gap-1.5"><Icon name="UserCheck" size={13} />Responding on behalf of {sup?.name ?? supCode} — logged as “{me.name} (on behalf)”</div>}
              <div>
                <div className="label">Feasible?<span className="text-brand-600">*</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFeasible(true)} className={cn('h-11 rounded-xl border-2 text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-all', feasible === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-line bg-white text-ink-2 hover:border-slate-300')}><Icon name="CircleCheck" size={16} />Yes, feasible</button>
                  <button type="button" onClick={() => setFeasible(false)} className={cn('h-11 rounded-xl border-2 text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-all', feasible === false ? 'border-red-400 bg-red-50 text-red-700' : 'border-line bg-white text-ink-2 hover:border-slate-300')}><Icon name="CircleX" size={16} />Not feasible</button>
                </div>
                {e('feasible') && <div className="text-[11.5px] text-red-600 mt-1">{e('feasible')}</div>}
              </div>
              {feasible !== false && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {p && (
                    <div className="sm:col-span-3">
                      <div className="label justify-between"><span>Offered price (₹ / unit)<span className="text-brand-600">*</span></span>{idea.parts.length > 1 && <span className="text-[11px] text-muted font-medium">for primary part {p.partCode}</span>}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-2 items-stretch">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">₹</span>
                          <input type="number" inputMode="decimal" min={0} step="any" className={cn('input num !pl-7 !pr-14', e('price') && '!border-red-400')} value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder={p.newPrice ? String(p.newPrice) : '0.00'} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-muted">/ {p.uom}</span>
                        </div>
                        <div className="rounded-lg border border-line bg-white px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px]">
                          <span className="text-muted">vs baseline {inrPrice(p.baselinePrice)}</span>
                          <span className="font-bold num" style={{ color: tone(unit) }}>{price ? `${unit >= 0 ? '' : '−'}${inrPrice(Math.abs(unit))} / ${p.uom}` : '—'}</span>
                          <span className="font-bold num" style={{ color: tone(pct) }}>{price ? `${pct.toFixed(2)}%` : ''}</span>
                          <span className="num text-ink-2">{price ? <>Annualised <b style={{ color: tone(annual) }}>{inrShort(annual)}</b></> : 'Saving updates as you type'}</span>
                          <InfoTip title="Saving vs baseline" formula="(P baseline − P offered) × Q last FY MRN" />
                        </div>
                      </div>
                      {e('price') && <div className="text-[11.5px] text-red-600 mt-1">{e('price')}</div>}
                    </div>
                  )}
                  <div>
                    <div className="label">Lead time (days){feasible && <span className="text-brand-600">*</span>}</div>
                    <input type="number" inputMode="numeric" min={0} className={cn('input num', e('lead') && '!border-red-400')} value={lead} onChange={(ev) => setLead(ev.target.value)} placeholder="e.g. 30" />
                    {e('lead') && <div className="text-[11.5px] text-red-600 mt-1">{e('lead')}</div>}
                  </div>
                  <div>
                    <div className="label">MOQ{feasible && <span className="text-brand-600">*</span>}</div>
                    <div className="relative">
                      <input type="number" inputMode="numeric" min={0} className={cn('input num !pr-12', e('moq') && '!border-red-400')} value={moq} onChange={(ev) => setMoq(ev.target.value)} placeholder="e.g. 5000" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-muted">{p?.uom ?? 'units'}</span>
                    </div>
                    {e('moq') && <div className="text-[11.5px] text-red-600 mt-1">{e('moq')}</div>}
                  </div>
                  <div className="hidden sm:block" />
                </div>
              )}
              <div>
                <div className="label">Remarks{feasible === false && <span className="text-brand-600">*</span>}</div>
                <textarea className={cn('input', e('remarks') && '!border-red-400')} rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} placeholder={feasible === false ? 'Why is it not feasible? (mandatory)' : 'Validity of price, conditions, tooling, sample timeline…'} />
                {e('remarks') && <div className="text-[11.5px] text-red-600 mt-1">{e('remarks')}</div>}
              </div>
              {feasible === false && <div className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 inline-flex items-center gap-2"><Icon name="TriangleAlert" size={14} />Declining drops the idea with the reason “Supplier not feasible”.</div>}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant={feasible === false ? 'danger' : 'success'} icon={feasible === false ? 'CircleX' : 'Send'} onClick={submit}>{feasible === false ? 'Decline feasibility' : onBehalf ? 'Submit on behalf' : 'Submit response'}</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HistoryCard({ idea, showSupplier }: { idea: Idea; showSupplier: boolean }) {
  const openIdea = useStore((s) => s.openIdea)
  const suppliers = useStore((s) => s.suppliers)
  const f = idea.feasibility!
  const p = idea.parts[0]
  const sup = suppliers.find((s) => s.code === f.supplierCode)
  const unit = p && f.offeredPrice ? p.baselinePrice - f.offeredPrice : 0
  return (
    <button onClick={() => openIdea(idea.id)} className="card p-3.5 text-left hover:shadow-md transition-shadow w-full">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11.5px] font-semibold text-ink-2">{idea.id}</span>
        {f.feasible ? <Badge color="#0f9f6e" icon="CircleCheck">Feasible</Badge> : <Badge color="#e0364f" icon="CircleX">Not feasible</Badge>}
        {f.onBehalf && <Badge color="#64748b">On behalf</Badge>}
        <span className="ml-auto"><BucketBadge bucket={idea.bucket} /></span>
      </div>
      <div className="mt-1.5 text-[13px] font-semibold text-ink line-clamp-2">{idea.title}</div>
      {showSupplier && <div className="text-[11.5px] text-muted mt-0.5 truncate">{sup?.name ?? f.supplierCode} · {f.supplierCode}</div>}
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-[12px]">
        <div><div className="text-[10.5px] uppercase font-semibold text-muted">Offered</div><div className="font-bold num">{f.offeredPrice != null ? inrPrice(f.offeredPrice) : '—'}</div>{p && f.offeredPrice != null && <div className="text-[10.5px] num" style={{ color: tone(unit) }}>{((unit / p.baselinePrice) * 100).toFixed(2)}% vs baseline</div>}</div>
        <div><div className="text-[10.5px] uppercase font-semibold text-muted">Lead time</div><div className="font-bold num">{f.leadTimeDays != null ? `${f.leadTimeDays} days` : '—'}</div></div>
        <div><div className="text-[10.5px] uppercase font-semibold text-muted">MOQ</div><div className="font-bold num">{f.moq != null ? num(f.moq) : '—'}</div></div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between gap-2 text-[11.5px] text-muted">
        <span className="truncate">Responded {fmtDate(f.respondedAt?.slice(0, 10))} · {f.respondedBy}</span>
        <span className="shrink-0 inline-flex items-center gap-1"><StageBadge stage={idea.stage} bucket={idea.bucket} /></span>
      </div>
    </button>
  )
}
