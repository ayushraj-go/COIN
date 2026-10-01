// Supplier outreach by email — suppliers never log into COIN. Amber emails them from here and they reply through
// the external Supplier Portal. This module holds the Supplier responses inbox, the Email templates library and the
// template editor used by the New campaign wizard.
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Commodity, Idea, OutreachBatch, Supplier, SupplierEmailTemplate, SupplierResponse, SupplierResponseStatus, SupplierResponseType } from '../../lib/types'
import { commodityShort, renderSupplierTemplate, supplierTemplateVars, useMe, useStore } from '../../store/useStore'
import { SUPPLIER_EMAIL_TEMPLATES_DEFAULT, SUPPLIER_TEMPLATE_PLACEHOLDERS } from '../../lib/masters'
import { can } from '../../lib/nav'
import { addDays, fmtDateTime, timeAgo, todayIso } from '../../lib/format'
import { Button, EmptyState, Field, Icon, Modal, cn } from '../../components/ui'
import { batchName, kindForTemplate, linkResponses } from './metrics'
import { Pager, Panel, Pill, PortalIndicator, PortalTag, Seg, usePaged, type PillTone } from './kit'

const EMPTY_BATCHES: OutreachBatch[] = []
const EMPTY_RESPONSES: SupplierResponse[] = []

/** Store selectors that tolerate old persisted state without the outreach keys */
export const useSupplierTemplates = () => useStore((s) => s.supplierTemplates ?? SUPPLIER_EMAIL_TEMPLATES_DEFAULT)
export const useOutreachBatches = () => useStore((s) => s.outreachBatches ?? EMPTY_BATCHES)
export const useSupplierResponses = () => useStore((s) => s.supplierResponses ?? EMPTY_RESPONSES)

const commodityName = (commodities: Commodity[], code: string) => commodityShort(commodities.find((c) => c.code === code)?.name ?? code)
const usesToken = (t: Pick<SupplierEmailTemplate, 'subject' | 'body'> | undefined, key: string) => !!t && (t.subject + t.body).includes(`{{${key}}}`)

/** Mail-client style preview. `fit` fills the parent height and fades long bodies instead of scrolling. */
export function EmailPreview({ from, to, subject, body, clamp, fit, className }: { from: string; to: string; subject: string; body: string; clamp?: boolean; fit?: boolean; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-line overflow-hidden bg-white flex flex-col', className)}>
      <div className="px-4 py-2.5 border-b border-line bg-slate-50/80 text-[12px] space-y-0.5 shrink-0">
        <div className="flex gap-2 min-w-0"><span className="text-muted w-14 shrink-0">From</span><span className="text-ink-2 truncate">{from}</span></div>
        <div className="flex gap-2 min-w-0"><span className="text-muted w-14 shrink-0">To</span><span className="text-ink-2 truncate">{to}</span></div>
        <div className="flex gap-2 min-w-0"><span className="text-muted w-14 shrink-0">Subject</span><span className="text-ink font-semibold truncate min-w-0" title={subject}>{subject || '—'}</span></div>
      </div>
      <div className={cn('relative px-4 py-3 text-[12.5px] leading-[1.6] text-ink-2 whitespace-pre-wrap break-words', clamp && 'line-clamp-[16]', fit && 'flex-1 min-h-0 overflow-hidden')}>
        {body || <span className="text-muted">Nothing to preview yet.</span>}
        {fit && <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />}
      </div>
    </div>
  )
}

// ─── Supplier responses (from the Supplier Portal) ────────────────────────────
export const RESPONSE_STATUSES: SupplierResponseStatus[] = ['New', 'Under review', 'Converted to idea', 'Closed']
export const STATUS_COLOR: Record<SupplierResponseStatus, string> = { New: '#2459e0', 'Under review': '#b7791f', 'Converted to idea': '#14ab92', Closed: '#66758f' }
const STATUS_TONE: Record<SupplierResponseStatus, PillTone> = { New: 'blue', 'Under review': 'amber', 'Converted to idea': 'teal', Closed: 'muted' }
export const TYPE_STYLE: Record<SupplierResponseType, { color: string; icon: string }> = {
  Idea: { color: '#0b8a77', icon: 'Lightbulb' },
  Problem: { color: '#b7791f', icon: 'TriangleAlert' },
  Complaint: { color: '#e0364f', icon: 'MessageSquareWarning' },
}
const TYPE_TONE: Record<SupplierResponseType, PillTone> = { Idea: 'neutral', Problem: 'amber', Complaint: 'red' }

interface Row {
  key: string
  r?: SupplierResponse // portal response (editable)
  idea?: Idea // supplier idea already in COIN
  supplierCode: string
  commodity: string
  type: SupplierResponseType
  scope: 'Open idea' | 'Specific parts'
  partCodes: string[]
  subject: string
  body: string
  receivedAt: string
  status: SupplierResponseStatus
  ideaId?: string
  batchId?: string
}

/** Legacy export — the connection indicator */
export function PortalStatusChip() { return <PortalIndicator /> }

type StatusF = 'All' | SupplierResponseStatus

export function SupplierResponsesTab() {
  const me = useMe()
  const nav = useNavigate()
  const canManage = can(me, 'campaign')
  const responses = useSupplierResponses()
  const batches = useOutreachBatches()
  const ideas = useStore((s) => s.ideas)
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const setStatus = useStore((s) => s.setSupplierResponseStatus)
  const openIdea = useStore((s) => s.openIdea)
  const toast = useStore((s) => s.toast)
  const [type, setType] = useState<'All' | SupplierResponseType>('All')
  const [status, setStatusF] = useState<StatusF>('All')
  const [campaign, setCampaign] = useState('All')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<Row | null>(null)

  const linked = useMemo(() => linkResponses(responses, batches).byResponse, [responses, batches])

  const rows = useMemo<Row[]>(() => {
    const fromPortal: Row[] = responses.map((r) => ({
      key: r.id, r, supplierCode: r.supplierCode, commodity: r.commodity, type: r.type, scope: r.scope, partCodes: r.partCodes ?? [],
      subject: r.subject, body: r.body, receivedAt: r.receivedAt, status: r.status, ideaId: r.ideaId, batchId: linked.get(r.id),
    }))
    const linkedIdeas = new Set(responses.map((r) => r.ideaId).filter(Boolean))
    const fromIdeas: Row[] = ideas.filter((i) => i.isSupplierSubmission && i.stage !== 'Draft' && !linkedIdeas.has(i.id)).map((i) => ({
      key: i.id, idea: i, supplierCode: i.supplierCode ?? '', commodity: i.commodity, type: 'Idea', scope: i.scope === 'Open' ? 'Open idea' : 'Specific parts',
      partCodes: i.parts.map((p) => p.partCode), subject: i.title, body: i.proposedChange, receivedAt: i.submittedAt ?? i.createdAt, status: 'Converted to idea', ideaId: i.id,
    }))
    return [...fromPortal, ...fromIdeas].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }, [responses, ideas, linked])

  const supplierOf = (code: string): Supplier | undefined => suppliers.find((s) => s.code === code)
  const base = useMemo(() => {
    const k = q.trim().toLowerCase()
    return rows.filter((x) => (type === 'All' || x.type === type) && (campaign === 'All' || (campaign === 'none' ? !x.batchId : x.batchId === campaign)) &&
      (!k || x.subject.toLowerCase().includes(k) || x.supplierCode.toLowerCase().includes(k) || x.commodity.toLowerCase().includes(k) || (supplierOf(x.supplierCode)?.name.toLowerCase().includes(k) ?? false)))
  }, [rows, type, campaign, q, suppliers]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = status === 'All' ? base : base.filter((x) => x.status === status)
  const pg = usePaged(filtered, 10, page)
  const count = (s: SupplierResponseStatus) => base.filter((x) => x.status === s).length
  const reset = () => setPage(0)

  const convert = (x: Row) => {
    if (!x.r) return
    setStatus(x.r.id, 'Converted to idea')
    const p = new URLSearchParams({ supplier: x.supplierCode, commodity: x.commodity, source: 'supplier-portal', ref: x.r.portalRef })
    if (x.partCodes.length) p.set('parts', x.partCodes.join(','))
    toast(`${x.r.portalRef} marked as converted — complete the idea on Submit`, 'info')
    nav(`/submit?${p.toString()}`)
  }
  const changeStatus = (x: Row, s: SupplierResponseStatus) => {
    if (!x.r) return
    setStatus(x.r.id, s)
    toast(`${x.r.portalRef} · status set to ${s}`, 'success')
    setOpen((o) => (o && o.key === x.key ? { ...o, status: s } : o))
  }
  const batchLabel = (id?: string) => { const b = id ? batches.find((y) => y.id === id) : undefined; return b ? batchName(b, commodities) : undefined }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Seg<StatusF> value={status} onChange={(s) => { setStatusF(s); reset() }} options={[{ key: 'All', label: 'All', count: base.length }, ...RESPONSE_STATUSES.map((s) => ({ key: s, label: s === 'Converted to idea' ? 'Converted' : s, count: count(s) }))]} />
        <select className="input !h-8 !w-auto max-w-[260px] !text-[12.5px]" value={campaign} onChange={(e) => { setCampaign(e.target.value); reset() }} aria-label="Campaign">
          <option value="All">All campaigns</option>
          {[...batches].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).map((b) => <option key={b.id} value={b.id}>{batchName(b, commodities)}</option>)}
          <option value="none">Not linked to a campaign</option>
        </select>
        <select className="input !h-8 !w-auto !text-[12.5px]" value={type} onChange={(e) => { setType(e.target.value as any); reset() }} aria-label="Type">
          <option value="All">All types</option>
          {(['Idea', 'Problem', 'Complaint'] as const).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="relative ml-auto w-64">
          <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !h-8 !pl-8 !text-[12.5px]" value={q} onChange={(e) => { setQ(e.target.value); reset() }} placeholder="Search subject, supplier or commodity" />
        </div>
      </div>

      <Panel pad={false}>
        {pg.slice.length ? pg.slice.map((x) => {
          const sup = supplierOf(x.supplierCode)
          const unread = x.status === 'New'
          const camp = batchLabel(x.batchId)
          return (
            <div key={x.key} role="button" tabIndex={0} onClick={() => setOpen(x)} onKeyDown={(e) => e.key === 'Enter' && setOpen(x)}
              className="grid grid-cols-[8px_minmax(0,1fr)_auto] lg:grid-cols-[8px_minmax(0,1fr)_190px_118px_76px_128px] gap-x-3 items-center px-4 py-2.5 border-t border-line first:border-t-0 cursor-pointer hover:bg-slate-50 transition-colors">
              <span className={cn('h-1.5 w-1.5 rounded-full', unread ? 'bg-brand-600' : 'bg-transparent')} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <Icon name={TYPE_STYLE[x.type].icon} size={14} className="text-muted shrink-0" />
                  <span className={cn('text-[13px] truncate', unread ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{x.subject}</span>
                  <span className="text-[12px] text-muted truncate hidden xl:inline min-w-0 flex-1">— {x.body}</span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted">
                  {x.r ? <PortalTag /> : <Pill tone="muted" icon="Lightbulb">Idea in COIN</Pill>}
                  {x.type !== 'Idea' && <Pill tone={TYPE_TONE[x.type]}>{x.type}</Pill>}
                  <span className="truncate">{sup?.name ?? x.supplierCode} · {commodityName(commodities, x.commodity)} · {x.scope}{x.partCodes.length ? ` (${x.partCodes.length === 1 ? x.partCodes[0] : `${x.partCodes.length} parts`})` : ''}{x.r?.estSavingLakh != null ? ` · est. ₹ ${x.r.estSavingLakh} L / yr` : ''}</span>
                </span>
              </span>
              <span className="hidden lg:block min-w-0">
                {camp ? <button type="button" onClick={(e) => { e.stopPropagation(); nav(`/campaigns/${x.batchId}`) }} className="block max-w-full truncate text-[12px] text-ink-2 hover:text-ink hover:underline underline-offset-2 text-left" title={camp}>{camp}</button>
                  : <span className="text-[12px] text-muted">—</span>}
              </span>
              <span className="hidden lg:block"><Pill tone={STATUS_TONE[x.status]}>{x.status}</Pill></span>
              <span className="hidden lg:block text-[11.5px] text-muted text-right num whitespace-nowrap">{timeAgo(x.receivedAt)}</span>
              <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                {x.r && x.type === 'Idea' && x.status !== 'Converted to idea' && x.status !== 'Closed' && canManage ? <Button size="xs" variant="secondary" icon="Lightbulb" onClick={() => convert(x)}>Convert to idea</Button>
                  : x.ideaId ? <Button size="xs" variant="ghost" icon="PanelRightOpen" onClick={() => openIdea(x.ideaId!)}>Open idea</Button>
                  : <span className="lg:hidden"><Pill tone={STATUS_TONE[x.status]}>{x.status}</Pill></span>}
              </span>
            </div>
          )
        }) : <EmptyState icon="Inbox" title="No responses match" desc="Clear the filters, or send a campaign to a commodity's suppliers." />}
        <Pager className="px-4 py-2 border-t border-line" {...pg} onPage={setPage} noun="responses" />
      </Panel>

      <Modal open={!!open} onClose={() => setOpen(null)} size="lg" icon={open ? TYPE_STYLE[open.type].icon : 'Inbox'}
        title={open?.subject ?? ''} subtitle={open ? `${supplierOf(open.supplierCode)?.name ?? open.supplierCode} · ${commodityName(commodities, open.commodity)}` : ''}
        footer={open && (
          <>
            <Button onClick={() => setOpen(null)}>Close</Button>
            {open.r && open.type === 'Idea' && open.status !== 'Converted to idea' && open.status !== 'Closed' && canManage && (
              <Button variant="primary" icon="Lightbulb" onClick={() => { const x = open; setOpen(null); convert(x) }}>Convert to idea</Button>
            )}
            {open.ideaId && <Button variant="primary" icon="PanelRightOpen" onClick={() => { const id = open.ideaId!; setOpen(null); openIdea(id) }}>Open idea</Button>}
          </>
        )}>
        {open && <ResponseDetail row={open} campaign={batchLabel(open.batchId)} canManage={canManage} onStatus={(s) => changeStatus(open, s)} />}
      </Modal>
    </div>
  )
}

function ResponseDetail({ row, campaign, canManage, onStatus }: { row: Row; campaign?: string; canManage: boolean; onStatus: (s: SupplierResponseStatus) => void }) {
  const sup = useStore((s) => s.suppliers.find((x) => x.code === row.supplierCode))
  const parts = useStore((s) => s.parts)
  const r = row.r
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {r ? <PortalTag /> : <Pill tone="muted" icon="Lightbulb">Idea in COIN</Pill>}
        <Pill tone={TYPE_TONE[row.type]} icon={TYPE_STYLE[row.type].icon}>{row.type}</Pill>
        <Pill>{row.scope}</Pill>
        {campaign && <Pill icon="Send">{campaign}</Pill>}
        {r && <span className="text-[11.5px] text-muted font-mono ml-auto">{r.portalRef}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
        <div className="min-w-0"><div className="text-muted">Supplier</div><div className="font-semibold text-ink truncate">{sup?.name ?? row.supplierCode}</div><div className="text-muted font-mono text-[11px]">{row.supplierCode}</div></div>
        <div className="min-w-0"><div className="text-muted">Contact</div><div className="font-semibold text-ink truncate">{sup?.contactName ?? '—'}</div><div className="text-muted text-[11px] truncate">{sup?.contactEmail}</div></div>
        <div className="min-w-0"><div className="text-muted">Received</div><div className="font-semibold text-ink">{fmtDateTime(row.receivedAt)}</div></div>
        <div className="min-w-0"><div className="text-muted">Est. saving</div><div className="font-semibold text-ink">{r?.estSavingLakh != null ? `₹ ${r.estSavingLakh} lakh / yr` : '—'}</div></div>
      </div>
      {row.body && <div className="rounded-lg border border-line bg-slate-50/70 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">{row.body}</div>}
      {row.partCodes.length > 0 && (
        <div>
          <div className="label">Parts referenced</div>
          <ul className="rounded-lg border border-line">
            {row.partCodes.map((pc) => { const p = parts.find((x) => x.code === pc); return (
              <li key={pc} className="px-3 py-1.5 border-t border-line first:border-t-0 text-[12.5px] flex flex-wrap gap-x-3"><span className="font-mono text-ink">{pc}</span><span className="text-muted">{p?.description ?? 'Not in part master'}</span></li>
            ) })}
          </ul>
        </div>
      )}
      <div>
        <div className="label">Status</div>
        {r && canManage ? (
          <Seg<SupplierResponseStatus> value={row.status} onChange={onStatus} options={RESPONSE_STATUSES.map((s) => ({ key: s, label: s }))} />
        ) : <Pill tone={STATUS_TONE[row.status]}>{row.status}</Pill>}
        {r?.updatedBy && <div className="text-[11.5px] text-muted mt-1.5">Last updated by {r.updatedBy}{r.updatedAt ? ` · ${timeAgo(r.updatedAt)}` : ''}</div>}
      </div>
      {row.type === 'Idea' && (
        <p className="text-[11.5px] text-muted flex items-start gap-1.5"><Icon name="Info" size={13} className="mt-px shrink-0" />Next: approval, then NPD until the sample stage.</p>
      )}
    </div>
  )
}

// ─── Email templates library ──────────────────────────────────────────────────
export function EmailTemplatesTab({ onUse }: { onUse?: (templateId: string) => void }) {
  const me = useMe()
  const canManage = can(me, 'campaign')
  const templates = useSupplierTemplates()
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const save = useStore((s) => s.saveSupplierTemplate)
  const toast = useStore((s) => s.toast)
  const [editing, setEditing] = useState<SupplierEmailTemplate | 'new' | null>(null)
  const [selId, setSelId] = useState<string | undefined>(undefined)
  const [vendor, setVendor] = useState(suppliers[0]?.code ?? '')
  const [page, setPage] = useState(0)
  const sel = templates.find((t) => t.id === selId) ?? templates[0]
  const sample = suppliers.find((s) => s.code === vendor) ?? suppliers[0]
  const vars = sample ? supplierTemplateVars(sample, sample.commodities, commodities, { workshopDate: addDays(todayIso(), 14), replyBy: addDays(todayIso(), 10), senderName: me?.name }) : {}
  const tokensOf = (t: SupplierEmailTemplate) => SUPPLIER_TEMPLATE_PLACEHOLDERS.filter((p) => usesToken(t, p.key))
  const pg = usePaged(templates, 8, page)

  const duplicate = (t: SupplierEmailTemplate) => {
    const id = save({ name: `${t.name} (copy)`, purpose: t.purpose, subject: t.subject, body: t.body })
    setSelId(id)
    setPage(Math.floor(templates.length / 8))
    toast(`Duplicated “${t.name}” — edit the copy to tailor it`, 'success')
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      <Panel className="xl:col-span-5" pad={false} title="Templates" sub={`${templates.length} supplier emails`}
        actions={canManage && <Button size="sm" icon="Plus" onClick={() => setEditing('new')}>New template</Button>}>
        {pg.slice.map((t) => {
          const on = t.id === sel?.id
          return (
            <button key={t.id} type="button" onClick={() => setSelId(t.id)}
              className={cn('relative w-full text-left px-4 py-2.5 border-t border-line first:border-t-0 transition-colors', on ? 'bg-slate-50' : 'hover:bg-slate-50/70')}>
              {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-ink" />}
              <span className="flex items-center gap-2 min-w-0">
                <span className={cn('text-[13px] truncate', on ? 'font-semibold text-ink' : 'font-medium text-ink')}>{t.name}</span>
                <span className="ml-auto text-[11px] text-muted shrink-0">{kindForTemplate(t)}</span>
              </span>
              <span className="block text-[12px] text-muted truncate">{t.purpose || t.subject}</span>
              <span className="block text-[11px] text-muted mt-0.5 truncate">{tokensOf(t).length} placeholders · {t.updatedBy ? `edited by ${t.updatedBy} ${timeAgo(t.updatedAt!)}` : 'default template'}</span>
            </button>
          )
        })}
        <Pager className="px-4 py-2 border-t border-line" {...pg} onPage={setPage} noun="templates" />
      </Panel>

      <Panel className="xl:col-span-7" title={sel?.name ?? 'Preview'}
        actions={sel && <>
          {canManage && <Button size="sm" variant="ghost" icon="Copy" onClick={() => duplicate(sel)}>Duplicate</Button>}
          <Button size="sm" icon={canManage ? 'Pencil' : 'Eye'} onClick={() => setEditing(sel)}>{canManage ? 'Edit' : 'View'}</Button>
          {onUse && canManage && <Button size="sm" variant="primary" icon="Send" onClick={() => onUse(sel.id)}>Use in campaign</Button>}
        </>}>
        {sel && sample ? (
          <>
            <div className="flex flex-wrap items-center gap-1 mb-3">
              <span className="text-[11.5px] text-muted mr-1">Placeholders</span>
              {tokensOf(sel).map((p) => <span key={p.key} title={p.label} className="font-mono text-[11px] px-1.5 h-5 inline-flex items-center rounded bg-slate-100 text-ink-2">{`{{${p.key}}}`}</span>)}
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[12px] font-medium text-ink-2">Live preview as</span>
              <select className="input !h-7 !w-auto max-w-[240px] !text-[12px] !py-0" value={sample?.code} onChange={(e) => setVendor(e.target.value)} aria-label="Preview vendor">
                {suppliers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <EmailPreview from={`${me?.name ?? 'Amber Sourcing'} <sourcing@ambergroupindia.com>`} to={`${sample.contactName} <${sample.contactEmail}>`}
              subject={renderSupplierTemplate(sel.subject, vars)} body={renderSupplierTemplate(sel.body, vars)} />
          </>
        ) : <EmptyState icon="MailOpen" title="No template selected" />}
      </Panel>

      <TemplateEditor key={editing === 'new' ? 'new' : editing?.id ?? 'none'} open={!!editing} template={editing === 'new' ? null : editing} readOnly={!canManage}
        onClose={() => setEditing(null)} onSaved={(id) => setSelId(id)} />
    </div>
  )
}

export function TemplateEditor({ open, template, readOnly, onClose, onSaved }: { open: boolean; template: SupplierEmailTemplate | null; readOnly: boolean; onClose: () => void; onSaved?: (id: string) => void }) {
  const save = useStore((s) => s.saveSupplierTemplate)
  const toast = useStore((s) => s.toast)
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const me = useMe()
  const [name, setName] = useState(template?.name ?? '')
  const [purpose, setPurpose] = useState(template?.purpose ?? '')
  const [subject, setSubject] = useState(template?.subject ?? 'Amber · {{commodity}} — ')
  const [body, setBody] = useState(template?.body ?? 'Dear {{contactName}},\n\n\n\nSubmit on the Amber Supplier Portal: {{portalLink}}\n\nRegards,\n{{senderName}}\nAmber Sourcing')
  const [err, setErr] = useState(false)
  const [focus, setFocus] = useState<'subject' | 'body'>('body')
  const [vendor, setVendor] = useState(suppliers[0]?.code ?? '')
  const subjRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const sample = suppliers.find((s) => s.code === vendor) ?? suppliers[0]
  const vars = sample ? supplierTemplateVars(sample, sample.commodities, commodities, { workshopDate: addDays(todayIso(), 14), replyBy: addDays(todayIso(), 10), senderName: me?.name }) : {}
  // grow the body box with its text (no inner scrollbar) within what the dialog can show
  const bodyRows = Math.max(8, Math.min(17, body.split(/\r?\n/).reduce((a, l) => a + Math.max(1, Math.ceil(l.length / 64)), 0) + 1))

  const insert = (key: string) => {
    const token = `{{${key}}}`
    const el = focus === 'subject' ? subjRef.current : bodyRef.current
    const cur = focus === 'subject' ? subject : body
    const setter = focus === 'subject' ? setSubject : setBody
    const a = el?.selectionStart ?? cur.length, b = el?.selectionEnd ?? cur.length
    setter(cur.slice(0, a) + token + cur.slice(b))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + token.length, a + token.length) })
  }
  const submit = () => {
    if (!name.trim() || !subject.trim() || !body.trim()) { setErr(true); return }
    const id = save({ id: template?.id, name: name.trim(), purpose: purpose.trim(), subject: subject.trim(), body })
    toast(`Template “${name.trim()}” saved`, 'success')
    onSaved?.(id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" icon="Mail" title={template ? (readOnly ? template.name : `Edit template · ${template.name}`) : 'New supplier email template'}
      subtitle="Placeholders are filled per vendor when a campaign is sent"
      footer={<><Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>{!readOnly && <Button variant="primary" icon="Save" onClick={submit}>Save template</Button>}</>}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Template name" required error={err && !name.trim() ? 'Name is required' : undefined}>
              <input className="input" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} placeholder="e.g. Improvement workshop invitation" />
            </Field>
            <Field label="Purpose"><input className="input" value={purpose} disabled={readOnly} onChange={(e) => setPurpose(e.target.value)} placeholder="One line shown in the list" /></Field>
          </div>
          <Field label="Subject" required error={err && !subject.trim() ? 'Subject is required' : undefined}>
            <input ref={subjRef} className="input" value={subject} disabled={readOnly} onFocus={() => setFocus('subject')} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Body" required error={err && !body.trim() ? 'Body is required' : undefined}>
            <textarea ref={bodyRef} className="input font-[inherit] !resize-none" rows={bodyRows} value={body} disabled={readOnly} onFocus={() => setFocus('body')} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
        <div className="relative min-w-0 min-h-[360px]">
          <div className="lg:absolute lg:inset-0 flex flex-col">
            {!readOnly && (
              <div className="mb-2.5">
                <div className="label">Insert placeholder into the {focus}</div>
                <div className="flex flex-wrap gap-1">
                  {SUPPLIER_TEMPLATE_PLACEHOLDERS.map((p) => {
                    const used = usesToken({ subject, body }, p.key)
                    return (
                      <button key={p.key} type="button" title={p.label} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(p.key)}
                        className={cn('inline-flex items-center gap-1 h-6 px-1.5 rounded-md border font-mono text-[11px] transition-colors', used ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:border-slate-300')}>
                        {used && <Icon name="Check" size={10} strokeWidth={3} />}{`{{${p.key}}}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mb-1.5 h-[22px]">
              <span className="text-[12px] font-medium text-ink-2">Live preview as</span>
              <select className="input !h-7 !w-auto max-w-[220px] !text-[12px] !py-0" value={sample?.code} onChange={(e) => setVendor(e.target.value)} aria-label="Preview vendor">
                {suppliers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <EmailPreview from={`${me?.name ?? 'Amber Sourcing'} <sourcing@ambergroupindia.com>`} to={sample ? `${sample.contactName} <${sample.contactEmail}>` : '—'}
              subject={renderSupplierTemplate(subject, vars)} body={renderSupplierTemplate(body, vars)} fit className="flex-1 min-h-0" />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** Small counts for tab badges */
export function useOutreachCounts() {
  const responses = useSupplierResponses()
  const templates = useSupplierTemplates()
  const batches = useOutreachBatches()
  return { newResponses: responses.filter((r) => r.status === 'New').length, responses: responses.length, templates: templates.length, batches: batches.length }
}

