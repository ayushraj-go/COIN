// Campaign workspace — dashboard (KPIs, the six-step supplier flow, campaign list) and the New campaign wizard.
// Suppliers never log into COIN: campaigns are emails; suppliers reply through the external Supplier Portal.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OutreachKind, SupplierResponse } from '../../lib/types'
import { commodityShort, renderSupplierTemplate, supplierTemplateVars, useMe, useStore } from '../../store/useStore'
import { OUTREACH_KINDS } from '../../lib/masters'
import { can } from '../../lib/nav'
import { addDays, daysBetween, fmtDate, timeAgo, todayIso } from '../../lib/format'
import { Button, EmptyState, Field, Icon, Modal, cn } from '../../components/ui'
import { EmailPreview, TemplateEditor, useOutreachBatches, useSupplierResponses, useSupplierTemplates } from './Outreach'
import { batchDeadline, batchFunnel, batchName, commodityLabel, isBatchLive, kindForTemplate, kindMeta, kindOf, linkResponses, npdProgress } from './metrics'
import { Check, FlowStepper, FunnelBar, KpiStrip, LinkBtn, Pager, Panel, Pill, PortalTag, Seg, usePaged, type PillTone } from './kit'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/** Every batch with its linked replies and funnel — newest first */
export function useCampaignRows() {
  const batches = useOutreachBatches()
  const responses = useSupplierResponses()
  const commodities = useStore((s) => s.commodities)
  const ideas = useStore((s) => s.ideas)
  return useMemo(() => {
    const { byBatch } = linkResponses(responses, batches)
    const byId = new Map(ideas.map((i) => [i.id, i]))
    const today = todayIso()
    return [...batches]
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .map((b) => {
        const replies = byBatch.get(b.id) ?? []
        const ideasN = replies.filter((r) => r.type === 'Idea').length
        const approved = replies.filter((r) => { const i = r.ideaId ? byId.get(r.ideaId) : undefined; return !!i && npdProgress(i).approved }).length
        return { b, name: batchName(b, commodities), kind: kindOf(b), replies, f: batchFunnel(b, replies), ideas: ideasN, approved, live: isBatchLive(b, today), deadline: batchDeadline(b) }
      })
  }, [batches, responses, commodities, ideas])
}
export type CampaignRow = ReturnType<typeof useCampaignRows>[number]

/** Small neutral glyph for the campaign type */
export function KindIcon({ kind, size = 28 }: { kind: OutreachKind; size?: number }) {
  return <span className="rounded-lg border border-line bg-slate-50 text-ink-2 grid place-items-center shrink-0" style={{ width: size, height: size }}><Icon name={kindMeta(kind).icon} size={Math.round(size * 0.5)} /></span>
}

export const RESPONSE_TONE: Record<SupplierResponse['status'], PillTone> = { New: 'blue', 'Under review': 'amber', 'Converted to idea': 'teal', Closed: 'muted' }
const TYPE_ICON: Record<string, string> = { Idea: 'Lightbulb', Problem: 'TriangleAlert', Complaint: 'MessageSquareWarning' }

/** Inbox-style reply row (dashboard + campaign detail) */
export function ReplyRow({ r, supplierName, commodity, onClick }: { r: SupplierResponse; supplierName: string; commodity: string; onClick?: () => void }) {
  const unread = r.status === 'New'
  return (
    <button type="button" onClick={onClick} className="w-full text-left px-4 py-2.5 border-t border-line first:border-t-0 flex items-center gap-3 hover:bg-slate-50 transition-colors">
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', unread ? 'bg-brand-600' : 'bg-transparent')} />
      <Icon name={TYPE_ICON[r.type] ?? 'Mail'} size={15} className="text-muted shrink-0" />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[12.5px] truncate', unread ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{r.subject}</span>
        <span className="block text-[11.5px] text-muted truncate">{supplierName} · {commodity}</span>
      </span>
      <span className="hidden md:inline-flex"><PortalTag /></span>
      <Pill tone={RESPONSE_TONE[r.status]}>{r.status}</Pill>
      <span className="text-[11.5px] text-muted w-14 text-right shrink-0 num">{timeAgo(r.receivedAt)}</span>
    </button>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
type ListFilter = 'all' | 'live' | 'done'

export function CampaignDashboard({ onNew, onOpenResponses, onOpenWorkshops }: { onNew: () => void; onOpenResponses: () => void; onOpenWorkshops: () => void }) {
  const nav = useNavigate()
  const me = useMe()
  const canManage = can(me, 'campaign')
  const rows = useCampaignRows()
  const responses = useSupplierResponses()
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const campaigns = useStore((s) => s.campaigns)
  const ideas = useStore((s) => s.ideas)
  const [filter, setFilter] = useState<ListFilter>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const today = todayIso()

  const k = useMemo(() => {
    const sent = rows.reduce((a, r) => a + r.f.sent, 0)
    const opened = rows.reduce((a, r) => a + r.f.opened, 0)
    const replied = rows.reduce((a, r) => a + r.f.replied, 0)
    // supplier ideas: Supplier Portal idea responses + supplier submissions already in COIN
    const linked = new Set(responses.map((r) => r.ideaId).filter(Boolean) as string[])
    const supIdeas = ideas.filter((i) => i.stage !== 'Draft' && (i.isSupplierSubmission || linked.has(i.id)))
    const portalIdeas = responses.filter((r) => r.type === 'Idea')
    const extra = supIdeas.filter((i) => !linked.has(i.id))
    const received = portalIdeas.length + extra.length
    const open = portalIdeas.filter((r) => r.scope === 'Open idea').length + extra.filter((i) => i.scope === 'Open').length
    const prog = supIdeas.map((i) => npdProgress(i))
    const approved = prog.filter((p) => p.approved).length
    const inNpd = prog.filter((p) => p.inNpd).length
    const pastSample = prog.filter((p) => p.pastSample).length
    const liveDrives = campaigns.filter((c) => c.status === 'Live').length
    const wsBatches = rows.filter((r) => r.kind === 'Improvement workshop')
    const wsCampaigns = campaigns.filter((c) => c.type === 'Workshop' && c.status !== 'Draft')
    const nextWs = [...wsBatches.map((r) => r.b.workshopDate), ...wsCampaigns.map((c) => c.workshopDate)].filter((d): d is string => !!d && d >= today).sort()[0]
    const covered = new Set([...rows.flatMap((r) => r.b.commodities), ...campaigns.filter((c) => c.status !== 'Draft').map((c) => c.commodity)])
    return {
      runs: rows.length, live: rows.filter((r) => r.live).length, liveDrives, sent, opened, replied,
      reached: new Set(rows.flatMap((r) => r.b.recipients)).size, replies: rows.reduce((a, r) => a + r.f.replies, 0),
      received, open, specific: received - open, approved, inNpd, pastSample, underReview: supIdeas.length - approved - supIdeas.filter((i) => i.bucket === 'Dropped').length,
      workshops: wsBatches.length + wsCampaigns.length, nextWs, covered: covered.size,
    }
  }, [rows, responses, ideas, campaigns, today])

  const counts = { all: rows.length, live: rows.filter((r) => r.live).length, done: rows.filter((r) => !r.live).length }
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows.filter((r) => (filter === 'all' || (filter === 'live') === r.live) &&
      (!t || r.name.toLowerCase().includes(t) || r.b.id.toLowerCase().includes(t) || r.b.commodities.some((c) => c.toLowerCase().includes(t)) || r.b.sentByName.toLowerCase().includes(t)))
  }, [rows, filter, q])
  const pg = usePaged(filtered, 6, page)
  const latest = useMemo(() => [...responses].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5), [responses])
  const upcoming = useMemo(() => {
    const fromCampaigns = campaigns.filter((c) => c.workshopDate && c.workshopDate >= today && c.status !== 'Closed').map((c) => ({ id: c.id, name: c.name, date: c.workshopDate!, meta: `${c.venue ?? 'Venue to be confirmed'} · ${c.suppliers.length} suppliers` }))
    const fromBatches = rows.filter((r) => r.b.workshopDate && r.b.workshopDate >= today).map((r) => ({ id: r.b.id, name: r.name, date: r.b.workshopDate!, meta: `Email invite · ${r.f.sent} suppliers` }))
    return [...fromCampaigns, ...fromBatches].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
  }, [campaigns, rows, today])

  const sup = (code: string) => suppliers.find((s) => s.code === code)?.name ?? code

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip items={[
        { label: 'Campaigns live', value: k.live, sub: `${k.runs} sent · ${k.liveDrives} drives live`, tip: 'Email campaigns still inside their reply window' },
        { label: 'Emails sent', value: k.sent, sub: `${pctOf(k.opened, k.sent)}% opened` },
        { label: 'Suppliers reached', value: k.reached, sub: `of ${suppliers.length} in vendor master` },
        { label: 'Replies', value: k.replies, sub: `${pctOf(k.replied, k.sent)}% of suppliers replied` },
        { label: 'Ideas received', value: k.received, sub: `${k.open} open · ${k.specific} specific parts` },
        { label: 'Approved', value: <>{k.approved}<span className="text-[13px] font-medium text-muted ml-1.5">{pctOf(k.approved, k.received)}%</span></>, sub: 'conversion from ideas received' },
      ]} />

      <FlowStepper title="Supplier innovation flow" note="Auto-email to NPD sample — where every supplier idea stands today" steps={[
        { label: 'Auto-email', value: k.sent, caption: `${k.reached} suppliers reached` },
        { label: 'Improvement workshop', value: k.workshops, caption: k.nextWs ? `next on ${fmtDate(k.nextWs)}` : 'none scheduled', onClick: onOpenWorkshops, tip: 'Open workshops & drives' },
        { label: 'Commodity-wise', value: k.covered, caption: `of ${commodities.length} commodities covered` },
        { label: 'Submit ideas', value: k.received, caption: `${k.open} open · ${k.specific} specific parts`, onClick: onOpenResponses, tip: 'Open supplier responses' },
        { label: 'Approval', value: k.approved, caption: `${Math.max(0, k.underReview)} under evaluation` },
        { label: 'NPD till sample', value: k.inNpd + k.pastSample, caption: `${k.inNpd} at sample · ${k.pastSample} cleared` },
      ]} />

      <Panel pad={false} title="Email campaigns" sub={`${rows.length} sent`}
        actions={<>
          <div className="relative w-52">
            <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !h-8 !pl-8 !text-[12.5px]" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search campaigns" />
          </div>
          <Seg<ListFilter> value={filter} onChange={(f) => { setFilter(f); setPage(0) }} options={[{ key: 'all', label: 'All', count: counts.all }, { key: 'live', label: 'Live', count: counts.live }, { key: 'done', label: 'Completed', count: counts.done }]} />
        </>}>
        {pg.slice.length ? (
          <>
            <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_330px_72px_96px_84px_14px] gap-4 px-4 h-8 items-center text-[11.5px] text-muted border-b border-line bg-slate-50/60">
              <span>Campaign</span><span>Progress</span><span className="text-right">Reply rate</span><span>Reply by</span><span>Status</span><span />
            </div>
            {pg.slice.map((r) => {
              const left = daysBetween(today, r.deadline)
              return (
                <button key={r.b.id} type="button" onClick={() => nav(`/campaigns/${r.b.id}`)}
                  className="w-full text-left grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px_72px_96px_84px_14px] gap-x-4 gap-y-2 items-center px-4 py-3 border-t border-line first:border-t-0 hover:bg-slate-50 transition-colors group">
                  <span className="flex items-center gap-3 min-w-0">
                    <KindIcon kind={r.kind} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink truncate group-hover:underline underline-offset-2">{r.name}</span>
                      <span className="block text-[11.5px] text-muted truncate">
                        <span className="font-mono text-[11px]">{r.b.id}</span> · {r.kind} · {r.b.commodities.join(', ')} · {fmtDate(r.b.sentAt.slice(0, 10))} by {r.b.sentByName}
                      </span>
                    </span>
                  </span>
                  <FunnelBar sent={r.f.sent} opened={r.f.opened} replied={r.f.replied} ideas={r.ideas} approved={r.approved} />
                  <span className="lg:text-right text-[13px] font-semibold text-ink num">{Math.round(r.f.rate)}%</span>
                  <span className="text-[12px] text-ink-2 num">{fmtDate(r.deadline)}<span className="block text-[11px] text-muted">{r.live ? (left === 0 ? 'today' : `${left}d left`) : 'closed'}</span></span>
                  <span>{r.live ? <Pill tone="live" dot>Live</Pill> : <Pill tone="muted">Completed</Pill>}</span>
                  <Icon name="ChevronRight" size={14} className="text-muted hidden lg:block" />
                </button>
              )
            })}
            <Pager className="px-4 py-2 border-t border-line" {...pg} onPage={setPage} noun="campaigns" />
          </>
        ) : rows.length ? (
          <EmptyState icon="Search" title="No campaigns match" desc="Clear the search or the status filter." action={<Button size="sm" onClick={() => { setQ(''); setFilter('all') }}>Clear filters</Button>} />
        ) : (
          <EmptyState icon="Send" title="No campaigns yet" desc="Pick commodity codes, select their vendors and send one personalised email each. Replies come back from the Supplier Portal."
            action={canManage ? <Button variant="primary" icon="Plus" onClick={onNew}>New campaign</Button> : undefined} />
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <Panel className="xl:col-span-7" pad={false} title="Latest replies" sub="from the Supplier Portal" actions={<LinkBtn icon="ArrowRight" onClick={onOpenResponses}>All responses</LinkBtn>}>
          {latest.length ? latest.map((r) => <ReplyRow key={r.id} r={r} supplierName={sup(r.supplierCode)} commodity={commodityLabel(commodities, r.commodity)} onClick={onOpenResponses} />)
            : <EmptyState icon="Inbox" title="No replies yet" desc="Supplier replies appear here as soon as the portal syncs." />}
        </Panel>
        <Panel className="xl:col-span-5" pad={false} title="Upcoming workshops" actions={<LinkBtn icon="ArrowRight" onClick={onOpenWorkshops}>Workshops & drives</LinkBtn>}>
          {upcoming.length ? upcoming.map((w) => {
            const d = daysBetween(today, w.date)
            return (
              <button key={w.id} type="button" onClick={() => nav(`/campaigns/${w.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-line first:border-t-0 text-left hover:bg-slate-50">
                <span className="h-9 w-9 rounded-lg border border-line bg-white grid place-items-center shrink-0 leading-none text-center">
                  <span><span className="block text-[13px] font-semibold text-ink">{w.date.slice(8, 10)}</span><span className="block text-[10px] text-muted">{fmtDate(w.date).slice(3, 6)}</span></span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-ink truncate">{w.name}</span>
                  <span className="block text-[11.5px] text-muted truncate">{w.meta}</span>
                </span>
                <span className="text-[11.5px] text-muted shrink-0">{d === 0 ? 'today' : `in ${d}d`}</span>
              </button>
            )
          }) : <EmptyState icon="CalendarDays" title="No workshop scheduled" desc="Send an improvement workshop invite from New campaign." />}
        </Panel>
      </div>
    </div>
  )
}

// ─── New campaign wizard ──────────────────────────────────────────────────────
const STEPS = ['Commodity codes', 'Vendors', 'Email template', 'Review & send']
const STEP_H = 'h-[436px]'

export interface WizardPreset { kind?: OutreachKind; commodities?: string[]; /** keep only these vendors selected */ only?: string[]; name?: string; replyBy?: string; workshopDate?: string }

export function NewCampaignWizard({ open, onClose, initialTemplateId, preset }: { open: boolean; onClose: () => void; initialTemplateId?: string; preset?: WizardPreset }) {
  const nav = useNavigate()
  const me = useMe()
  const templates = useSupplierTemplates()
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const categories = useStore((s) => s.categories)
  const sendOutreach = useStore((s) => s.sendOutreach)
  const toast = useStore((s) => s.toast)

  const presetTpl = initialTemplateId ?? (preset?.kind ? OUTREACH_KINDS.find((k) => k.key === preset.kind)?.templateId : undefined)
  const [step, setStep] = useState(preset?.commodities?.length ? 1 : 0)
  const [name, setName] = useState(preset?.name ?? '')
  const [chosen, setChosen] = useState<string[]>(preset?.commodities ?? [])
  const [excluded, setExcluded] = useState<string[]>(() => (preset?.only ? suppliers.filter((s) => s.commodities.some((c) => preset.commodities?.includes(c)) && !preset.only!.includes(s.code)).map((s) => s.code) : []))
  const [templateId, setTemplateId] = useState<string>(presetTpl ?? 'ST02')
  const tpl = templates.find((t) => t.id === templateId) ?? templates[0]
  const kind = preset?.kind && tpl?.id === presetTpl ? preset.kind : kindForTemplate(tpl)
  const usesWs = !!tpl && (tpl.subject + tpl.body).includes('{{workshopDate}}')
  const usesReply = !!tpl && (tpl.subject + tpl.body).includes('{{replyBy}}')
  const [workshopDate, setWorkshopDate] = useState(preset?.workshopDate ?? addDays(todayIso(), 14))
  const [replyBy, setReplyBy] = useState(preset?.replyBy && preset.replyBy >= todayIso() ? preset.replyBy : addDays(todayIso(), 10))
  const [previewCode, setPreviewCode] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [tried, setTried] = useState(false)
  // step-local UI
  const [cq, setCq] = useState('')
  const [cat, setCat] = useState('all')
  const [vq, setVq] = useState('')
  const [focus, setFocus] = useState<string>('all')
  const [vPage, setVPage] = useState(0)
  const [tPage, setTPage] = useState(0)

  const pool = useMemo(() => suppliers.filter((s) => s.commodities.some((c) => chosen.includes(c))).sort((a, b) => a.name.localeCompare(b.name)), [suppliers, chosen])
  const recipients = pool.filter((s) => !excluded.includes(s.code))
  const preview = recipients.find((s) => s.code === previewCode) ?? recipients[0]
  const kindShort = kind === 'Improvement workshop' ? 'Workshop' : kind === 'Reminder' ? 'Reminder' : 'Idea drive'
  const autoName = `${kindShort} · ${chosen.length ? chosen.map((c) => commodityLabel(commodities, c)).join(', ') : 'commodity'} · ${fmtDate(todayIso()).slice(3)}`
  const finalName = name.trim() || autoName

  const vars = preview ? supplierTemplateVars(preview, chosen, commodities, { workshopDate: usesWs ? workshopDate : undefined, replyBy: usesReply ? replyBy : undefined, senderName: me?.name }) : null
  const rendered = tpl && vars ? { subject: renderSupplierTemplate(tpl.subject, vars), body: renderSupplierTemplate(tpl.body, vars) } : null
  const from = `${me?.name ?? 'Amber Sourcing'} <sourcing@ambergroupindia.com>`

  const stepError = (i: number): string | null => {
    if (i === 0 && !chosen.length) return 'Select at least one commodity code'
    if (i === 1 && !recipients.length) return 'Keep at least one vendor selected'
    if (i === 2 && !tpl) return 'Choose an email template'
    if (i === 2 && usesWs && !workshopDate) return 'This template needs a workshop date'
    return null
  }
  const err = tried ? stepError(step) : null
  const next = () => { if (stepError(step)) { setTried(true); return } setTried(false); setStep((s) => Math.min(3, s + 1)) }
  const goto = (i: number) => { for (let j = 0; j < i; j++) if (stepError(j)) { setStep(j); setTried(true); return } setTried(false); setStep(i) }

  const supplierCount = (code: string) => suppliers.filter((s) => s.commodities.includes(code)).length
  const toggleCommodity = (code: string) => setChosen((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]))
  const toggleVendor = (code: string) => setExcluded((x) => (x.includes(code) ? x.filter((y) => y !== code) : [...x, code]))
  const vendorsOf = (code: string) => pool.filter((s) => s.commodities.includes(code))
  const groupState = (code: string): boolean | 'mixed' => { const v = vendorsOf(code); const on = v.filter((s) => !excluded.includes(s.code)).length; return on === 0 ? false : on === v.length ? true : 'mixed' }
  const toggleGroup = (codes: string[]) => {
    const allOn = codes.every((c) => !excluded.includes(c))
    setExcluded((x) => (allOn ? [...new Set([...x, ...codes])] : x.filter((c) => !codes.includes(c))))
  }

  // step 1 — commodity list
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const commodityList = useMemo(() => {
    const t = cq.trim().toLowerCase()
    return commodities.filter((c) => (cat === 'all' || c.categoryId === cat) && (!t || c.code.toLowerCase().includes(t) || c.name.toLowerCase().includes(t)))
  }, [commodities, cq, cat])
  const usedCats = categories.filter((c) => commodities.some((x) => x.categoryId === c.id))

  // step 2 — vendors
  const focusCode = focus !== 'all' && chosen.includes(focus) ? focus : 'all'
  const vendorList = useMemo(() => {
    const t = vq.trim().toLowerCase()
    return pool.filter((s) => (focusCode === 'all' || s.commodities.includes(focusCode)) && (!t || s.name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t) || s.city.toLowerCase().includes(t) || s.contactName.toLowerCase().includes(t)))
  }, [pool, focusCode, vq])
  const vSize = chosen.length > 9 ? 9 : 12
  const vp = usePaged(vendorList, vSize, vPage)
  const tp = usePaged(templates, 5, tPage)

  const send = () => {
    if (!tpl) return
    const b = sendOutreach({ templateId: tpl.id, commodities: chosen, recipients: recipients.map((s) => s.code), name: finalName, kind, workshopDate: usesWs ? workshopDate || undefined : undefined, replyBy: usesReply ? replyBy || undefined : undefined })
    if (!b) { toast('No vendors selected', 'warning'); return }
    toast(`“${finalName}” emailed to ${plural(b.recipientCount, 'vendor')}`, 'success')
    onClose()
    nav(`/campaigns/${b.id}`)
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" icon="Send" title={preset?.kind === 'Reminder' ? 'Send reminder' : 'New campaign'} subtitle="One personalised email per vendor — suppliers reply through the Supplier Portal"
      footer={<>
        <span className="mr-auto text-[12px] hidden sm:flex items-center gap-1.5">
          {err ? <span className="text-red-600 inline-flex items-center gap-1"><Icon name="CircleAlert" size={13} />{err}</span>
            : <span className="text-muted num">{plural(chosen.length, 'commodity code')} · <b className="text-ink font-semibold">{plural(recipients.length, 'vendor')}</b> selected</span>}
        </span>
        {step > 0 ? <Button icon="ArrowLeft" onClick={() => { setTried(false); setStep(step - 1) }}>Back</Button> : <Button onClick={onClose}>Cancel</Button>}
        {step < 3 ? <Button variant="primary" iconRight="ArrowRight" onClick={next}>Continue</Button>
          : <Button variant="primary" icon="Send" disabled={!recipients.length || !tpl} onClick={send}>Send to {plural(recipients.length, 'vendor')}</Button>}
      </>}>
      {/* stepper */}
      <ol className="flex items-center gap-2 mb-4">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 min-w-0 flex-1 last:flex-none">
            <button type="button" onClick={() => goto(i)} className="flex items-center gap-2 min-w-0 shrink-0">
              <span className={cn('h-[22px] w-[22px] rounded-full grid place-items-center text-[11px] font-semibold shrink-0 border transition-colors',
                i < step ? 'bg-ink border-ink text-white' : i === step ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-muted')}>
                {i < step ? <Icon name="Check" size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-[12.5px] whitespace-nowrap', i === step ? 'text-ink font-semibold' : i < step ? 'text-ink-2 font-medium' : 'text-muted font-medium')}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className={cn('h-px flex-1 min-w-4', i < step ? 'bg-ink/40' : 'bg-line')} />}
          </li>
        ))}
      </ol>

      <div className={cn(STEP_H, 'min-h-0')}>
        {/* ── 1 · commodity codes ── */}
        {step === 0 && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-56">
                <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input !h-8 !pl-8 !text-[12.5px]" autoFocus value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search code or commodity" />
              </div>
              <Seg value={cat} onChange={setCat} options={[{ key: 'all', label: 'All' }, ...usedCats.map((c) => ({ key: c.id, label: c.name }))]} />
              {chosen.length > 0 && <span className="ml-auto"><LinkBtn onClick={() => setChosen([])}>Clear {chosen.length}</LinkBtn></span>}
            </div>
            {commodityList.length ? (
              <div className="grid grid-cols-3 gap-2 content-start">
                {commodityList.map((c) => {
                  const on = chosen.includes(c.code)
                  const n = supplierCount(c.code)
                  return (
                    <button key={c.code} type="button" onClick={() => toggleCommodity(c.code)}
                      className={cn('flex items-center gap-2.5 h-[52px] px-3 rounded-lg border text-left transition-colors min-w-0', on ? 'border-brand-300 bg-brand-50/50' : 'border-line bg-white hover:border-slate-300')}>
                      <Check state={on} onChange={() => toggleCommodity(c.code)} label={c.name} />
                      <span className="font-mono text-[11.5px] font-semibold text-ink w-9 shrink-0">{c.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium text-ink truncate">{commodityShort(c.name)}</span>
                        <span className="block text-[11px] text-muted truncate">{catName(c.categoryId)}</span>
                      </span>
                      <span className={cn('text-[11.5px] num shrink-0', n ? 'text-ink-2' : 'text-muted')}>{plural(n, 'vendor')}</span>
                    </button>
                  )
                })}
              </div>
            ) : <EmptyState icon="Search" title="No commodity matches" desc="Try a code such as CUT, ALU or FAS." />}
            <p className="mt-auto text-[11.5px] text-muted">Every vendor mapped to the selected codes is added on the next step — you can deselect any of them there.</p>
          </div>
        )}

        {/* ── 2 · vendors ── */}
        {step === 1 && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setFocus('all'); setVPage(0) }}
                className={cn('inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border text-[12px] font-medium', focusCode === 'all' ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-slate-300')}>
                All selected <span className={cn('num', focusCode === 'all' ? 'text-white/80' : 'text-muted')}>{recipients.length}/{pool.length}</span>
              </button>
              {chosen.map((code) => {
                const v = vendorsOf(code)
                const on = v.filter((s) => !excluded.includes(s.code)).length
                const active = focusCode === code
                return (
                  <span key={code} role="button" tabIndex={0} onClick={() => { setFocus(code); setVPage(0) }} onKeyDown={(e) => e.key === 'Enter' && setFocus(code)}
                    className={cn('inline-flex items-center gap-2 h-8 pl-2 pr-2.5 rounded-lg border text-[12px] cursor-pointer select-none', active ? 'border-brand-400 bg-brand-50/60 text-ink' : 'border-line bg-white text-ink-2 hover:border-slate-300')}>
                    <Check state={v.length ? groupState(code) : false} onChange={() => toggleGroup(v.map((s) => s.code))} label={`Select all ${code} vendors`} />
                    <span className="font-mono text-[11px] font-semibold">{code}</span>
                    <span className="max-w-[140px] truncate">{commodityLabel(commodities, code)}</span>
                    <span className="text-muted num">{on}/{v.length}</span>
                  </span>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input !h-8 !pl-8 !text-[12.5px]" value={vq} onChange={(e) => { setVq(e.target.value); setVPage(0) }} placeholder="Search vendor, code, contact or city" />
              </div>
              {vendorList.length > 0 && <>
                <LinkBtn onClick={() => setExcluded((x) => x.filter((c) => !vendorList.some((s) => s.code === c)))}>Select all{focusCode !== 'all' ? ` ${focusCode}` : ''}</LinkBtn>
                <LinkBtn onClick={() => setExcluded((x) => [...new Set([...x, ...vendorList.map((s) => s.code)])])}>Deselect all</LinkBtn>
              </>}
            </div>
            {pool.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line flex-1 grid place-items-center"><EmptyState icon="Boxes" title="No vendors mapped to these codes" desc="Map suppliers to commodities in Admin → Suppliers, or go back and pick other codes." /></div>
            ) : vendorList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line flex-1 grid place-items-center"><EmptyState icon="Search" title="No vendor matches" /></div>
            ) : (
              <div className="grid grid-cols-3 gap-2 content-start">
                {vp.slice.map((s) => {
                  const on = !excluded.includes(s.code)
                  return (
                    <div key={s.code} role="button" tabIndex={0} onClick={() => toggleVendor(s.code)} onKeyDown={(e) => e.key === ' ' && toggleVendor(s.code)}
                      className={cn('flex items-start gap-2.5 h-[66px] px-3 py-2.5 rounded-lg border cursor-pointer transition-colors min-w-0', on ? 'border-brand-300 bg-brand-50/40' : 'border-line bg-white hover:border-slate-300')}>
                      <span className="mt-0.5"><Check state={on} onChange={() => toggleVendor(s.code)} label={s.name} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={cn('text-[12.5px] font-semibold truncate', on ? 'text-ink' : 'text-ink-2')}>{s.name}</span>
                          <span className="ml-auto font-mono text-[10.5px] text-muted shrink-0">{s.code}</span>
                        </span>
                        <span className="block text-[11.5px] text-ink-2 truncate">{s.contactName} · {s.city}</span>
                        <span className="block text-[11px] text-muted truncate">{s.contactEmail} · {s.commodities.filter((c) => chosen.includes(c)).join(', ')}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <Pager className="mt-auto" {...vp} onPage={setVPage} noun="vendors" />
          </div>
        )}

        {/* ── 3 · email template ── */}
        {step === 2 && (
          <div className="grid grid-cols-12 grid-rows-[minmax(0,1fr)] gap-5 h-full">
            <div className="col-span-5 flex flex-col gap-2 min-w-0">
              <div className="label !mb-0">Template</div>
              {tp.slice.map((t) => {
                const on = t.id === tpl?.id
                return (
                  <button key={t.id} type="button" onClick={() => setTemplateId(t.id)}
                    className={cn('flex items-start gap-2.5 text-left rounded-lg border px-3 py-2 transition-colors min-w-0', on ? 'border-brand-400 bg-brand-50/50' : 'border-line bg-white hover:border-slate-300')}>
                    <span className={cn('mt-0.5 h-4 w-4 rounded-full border grid place-items-center shrink-0', on ? 'border-brand-600' : 'border-slate-300')}>{on && <span className="h-2 w-2 rounded-full bg-brand-600" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="text-[12.5px] font-semibold text-ink truncate">{t.name}</span><span className="ml-auto text-[11px] text-muted shrink-0">{kindForTemplate(t)}</span></span>
                      <span className="block text-[11.5px] text-muted truncate">{t.purpose || t.subject}</span>
                    </span>
                  </button>
                )
              })}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-slate-300 text-[12px] font-medium text-ink-2 hover:bg-slate-50"><Icon name="Plus" size={13} />New template</button>
                {tp.pages > 1 && <Pager className="flex-1" {...tp} onPage={setTPage} noun="templates" />}
              </div>
              {(usesWs || usesReply) && (
                <div className="grid grid-cols-2 gap-3 mt-auto pt-3 border-t border-line">
                  {usesWs && <Field label="Workshop date" required hint="Fills {{workshopDate}}"><input type="date" className="input" min={todayIso()} value={workshopDate} onChange={(e) => setWorkshopDate(e.target.value)} /></Field>}
                  {usesReply && <Field label="Reply by" hint="Fills {{replyBy}}"><input type="date" className="input" min={todayIso()} value={replyBy} onChange={(e) => setReplyBy(e.target.value)} /></Field>}
                </div>
              )}
            </div>
            <div className="col-span-7 min-w-0 flex flex-col">
              <div className="flex items-center gap-2 mb-1.5 h-7">
                <span className="text-[12px] font-medium text-ink-2">Live preview as</span>
                <select className="input !h-7 !w-auto max-w-[260px] !text-[12px] !py-0" value={preview?.code} onChange={(e) => setPreviewCode(e.target.value)} aria-label="Preview vendor">
                  {recipients.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
              <EmailPreview from={from} to={preview ? `${preview.contactName} <${preview.contactEmail}>` : '—'} subject={rendered?.subject ?? ''} body={rendered?.body ?? ''} fit className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── 4 · review & send ── */}
        {step === 3 && (
          <div className="grid grid-cols-12 grid-rows-[minmax(0,1fr)] gap-5 h-full">
            <div className="col-span-5 flex flex-col gap-3 min-w-0">
              <div className="rounded-lg border border-line bg-slate-50/70 px-4 py-3">
                <div className="flex items-end gap-2"><span className="text-[34px] leading-none font-semibold text-ink num">{recipients.length}</span><span className="text-[12.5px] text-ink-2 pb-1">vendors · one personalised email each</span></div>
                <div className="flex flex-wrap gap-1 mt-2.5">{chosen.map((c) => <Pill key={c}><span className="font-mono">{c}</span>{commodityLabel(commodities, c)}</Pill>)}</div>
              </div>
              <Field label="Campaign name" hint={name.trim() ? undefined : 'Leave blank to use the suggested name'}>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={autoName} />
              </Field>
              <dl className="rounded-lg border border-line divide-y divide-line text-[12.5px]">
                {([
                  ['Type', kind],
                  ['Template', tpl?.name ?? '—'],
                  ...(usesWs ? [['Workshop date', workshopDate ? fmtDate(workshopDate) : '—']] : []),
                  ...(usesReply ? [['Reply by', replyBy ? fmtDate(replyBy) : '—']] : []),
                  ['Sender', `${me?.name ?? 'Amber Sourcing'} · sourcing@ambergroupindia.com`],
                ] as [string, string][]).map(([k2, v]) => (
                  <div key={k2} className="flex gap-3 px-3 py-1.5"><dt className="text-muted w-28 shrink-0">{k2}</dt><dd className="text-ink min-w-0 truncate">{v}</dd></div>
                ))}
              </dl>
            </div>
            <div className="col-span-7 flex flex-col gap-3 min-w-0">
              <div>
                <div className="label">Subject · as {preview?.name ?? 'the vendor'} sees it</div>
                <div className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-ink truncate">{rendered?.subject || '—'}</div>
              </div>
              <div>
                <div className="label">Recipients</div>
                <div className="flex flex-wrap gap-1">
                  {recipients.slice(0, 18).map((s) => <Pill key={s.code}>{s.name}</Pill>)}
                  {recipients.length > 18 && <Pill tone="muted">+{recipients.length - 18} more</Pill>}
                </div>
              </div>
              <div className="mt-auto rounded-lg border border-line px-4 py-3">
                <div className="text-[12px] font-semibold text-ink mb-2">What happens next</div>
                <ol className="flex flex-col gap-2 text-[12px] text-ink-2">
                  {[
                    ['Send', `COIN emails each vendor now from ${me?.name ?? 'Amber Sourcing'}.`],
                    ['ExternalLink', 'Suppliers open their link and submit open or part-specific ideas on the Supplier Portal.'],
                    ['Inbox', 'Responses sync back into COIN tagged “via Supplier Portal” and link to this campaign.'],
                  ].map(([ic, t]) => <li key={t} className="flex items-start gap-2"><Icon name={ic} size={13} className="mt-[3px] text-muted shrink-0" />{t}</li>)}
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      <TemplateEditor key={editorOpen ? 'wiz-new' : 'wiz-closed'} open={editorOpen} template={null} readOnly={false} onClose={() => setEditorOpen(false)} onSaved={(id) => setTemplateId(id)} />
    </Modal>
  )
}

