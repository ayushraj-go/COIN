// M7 — Campaigns & Workshops: shared stats, badges, create / edit modal, launch with auto-invites.
import React, { useEffect, useMemo, useState } from 'react'
import type { Campaign, Idea } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { ideaAnnualised } from '../../lib/calc'
import { fmtDate, inrShort, nowIso, sum, todayIso, uid } from '../../lib/format'
import { Avatar, Badge, Button, Field, Icon, Modal, Segmented, SourceTag, cn } from '../../components/ui'
import { Pager, usePaged } from './kit'

export const PRIMARY = '#2459e0'
export const GOLD = '#bf8f3f'
export type AttendanceStatus = Campaign['attendance'][string]
export const ATTENDANCE: AttendanceStatus[] = ['Invited', 'Accepted', 'Declined', 'Attended']
export const ATT_STYLE: Record<AttendanceStatus, { color: string; icon: string }> = {
  Invited: { color: '#64748b', icon: 'MailQuestion' },
  Accepted: { color: '#3b74f2', icon: 'CalendarCheck' },
  Declined: { color: '#e0364f', icon: 'CalendarX' },
  Attended: { color: '#0f9f6e', icon: 'UserCheck' },
}

/** Ideas raised through a campaign (drafts excluded) */
export const campaignIdeas = (c: Campaign, ideas: Idea[]) => ideas.filter((i) => i.campaignId === c.id && i.stage !== 'Draft')

/** KPI F2 — idea yield per campaign / workshop: ideas, ₹ value and conversion */
export function campaignStats(c: Campaign, ideas: Idea[]) {
  const list = campaignIdeas(c, ideas)
  const live = list.filter((i) => i.bucket !== 'Dropped')
  const value = sum(live.map((i) => ideaAnnualised(i)))
  const implemented = list.filter((i) => i.bucket === 'Implemented').length
  const buckets = { Pipeline: 0, 'In Execution': 0, Implemented: 0, Dropped: 0 } as Record<'Pipeline' | 'In Execution' | 'Implemented' | 'Dropped', number>
  list.forEach((i) => { if (i.bucket in buckets) buckets[i.bucket as keyof typeof buckets]++ })
  const att = { Invited: 0, Accepted: 0, Declined: 0, Attended: 0 } as Record<AttendanceStatus, number>
  c.suppliers.forEach((code) => { const a = c.attendance[code]; if (a) att[a]++ })
  return {
    list, count: list.length, value, implemented, buckets, att,
    conversion: list.length ? (implemented / list.length) * 100 : 0,
    supplierIdeas: list.filter((i) => i.isSupplierSubmission).length,
  }
}

export const dateRange = (a: string, b: string) => `${fmtDate(a)} – ${fmtDate(b)}`

export function CampaignStatusBadge({ status }: { status: Campaign['status'] }) {
  if (status === 'Live') return (
    <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-semibold border text-emerald-700 bg-emerald-50 border-emerald-200">
      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>Live
    </span>
  )
  return status === 'Draft' ? <Badge color="#64748b" icon="FilePen">Draft</Badge> : <Badge color="#475569" icon="Lock">Closed</Badge>
}
export function CampaignTypeBadge({ type }: { type: Campaign['type'] }) {
  return type === 'Workshop' ? <Badge color={GOLD} icon="Presentation">Workshop</Badge> : <Badge color={PRIMARY} icon="Megaphone">Campaign</Badge>
}

/** Recipients of the auto-invite (suppliers of the campaign + internal invitees) */
export function inviteRecipients(c: Campaign) {
  const s = useStore.getState()
  const sup = s.suppliers.filter((x) => c.suppliers.includes(x.code)).map((x) => x.contactEmail)
  const internal = c.internalInvitees.map((id) => s.users.find((u) => u.id === id)?.email).filter(Boolean) as string[]
  return [...sup, ...internal]
}
const listEmails = (all: string[]) => `${all.slice(0, 3).join(', ')}${all.length > 3 ? ` +${all.length - 3} more` : ''}`

/** Launch & send auto-invites — toast lists the emails sent */
export function launchWithToast(id: string) {
  const s = useStore.getState()
  const c = s.campaigns.find((x) => x.id === id)
  if (!c) return
  const all = inviteRecipients(c)
  s.launchCampaign(id)
  s.toast(`${c.name} is live — auto-invites emailed to ${all.length} recipient${all.length === 1 ? '' : 's'}: ${listEmails(all)}`, 'success')
}

/** Invite suppliers added to an already-live campaign (email log + attendance = Invited) */
function inviteAdded(c: Campaign, codes: string[]) {
  const s = useStore.getState()
  const sups = s.suppliers.filter((x) => codes.includes(x.code))
  if (!sups.length) return
  useStore.setState((st) => ({
    emails: [{ id: uid('e'), at: nowIso(), to: sups.map((x) => x.contactEmail), subject: `COIN · Invitation: ${c.name}`, body: `You are invited to "${c.name}"${c.workshopDate ? ' on ' + c.workshopDate : ''}.`, template: 'Workshop invitation' }, ...st.emails],
    campaigns: st.campaigns.map((x) => (x.id === c.id ? { ...x, attendance: { ...x.attendance, ...Object.fromEntries(codes.map((k) => [k, x.attendance[k] ?? 'Invited'])) } } : x)),
  }))
  sups.forEach((sp) => { const u = s.users.find((x) => x.supplierCode === sp.code); if (u) s.notify({ userId: u.id, title: 'Workshop invitation', body: c.name, trigger: 'Workshop invitation', channel: 'Email', link: '/workshops', severity: 'info' }) })
  s.toast(`Invites emailed to ${sups.length} added supplier${sups.length === 1 ? '' : 's'}: ${listEmails(sups.map((x) => x.contactEmail))}`, 'success')
}

// ─── Create / edit campaign modal ─────────────────────────────────────────────
interface Draft {
  name: string; type: Campaign['type']; categoryId: string; commodity: string; startDate: string; endDate: string; workshopDate: string; venue: string
  suppliers: string[]; internalInvitees: string[]; description: string
}
const blank = (): Draft => ({ name: '', type: 'Workshop', categoryId: '', commodity: '', startDate: todayIso(), endDate: '', workshopDate: '', venue: '', suppliers: [], internalInvitees: [], description: '' })
const fromCampaign = (c: Campaign): Draft => ({
  name: c.name, type: c.type, categoryId: c.categoryId, commodity: c.commodity, startDate: c.startDate, endDate: c.endDate, workshopDate: c.workshopDate ?? '', venue: c.venue ?? '',
  suppliers: c.suppliers, internalInvitees: c.internalInvitees, description: c.description,
})

export function CampaignFormModal({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Campaign | null; onSaved?: (id: string) => void }) {
  const { categories, commodities, suppliers, users, createCampaign, updateCampaign, toast } = useStore()
  const [d, setD] = useState<Draft>(blank)
  const [showErr, setShowErr] = useState(false)
  const [allVendors, setAllVendors] = useState(false)
  const [q, setQ] = useState('')
  const [uq, setUq] = useState('')
  const [vPage, setVPage] = useState(0)
  const [uPage, setUPage] = useState(0)
  useEffect(() => { if (open) { setD(initial ? fromCampaign(initial) : blank()); setShowErr(false); setAllVendors(false); setQ(''); setUq(''); setVPage(0); setUPage(0) } }, [open, initial])
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const edit = !!initial

  const cm = commodities.find((c) => c.code === d.commodity)
  const setCommodity = (code: string) => {
    const c = commodities.find((x) => x.code === code)
    const patch: Partial<Draft> = { commodity: code }
    if (!edit && c) {
      patch.suppliers = suppliers.filter((s) => s.commodities.includes(code)).map((s) => s.code)
      patch.internalInvitees = [...new Set([c.buyerId, c.leadId, ...d.internalInvitees])]
    }
    set(patch)
  }
  const vendors = useMemo(() => {
    const k = q.trim().toLowerCase()
    return suppliers
      .filter((s) => allVendors || !d.commodity || s.commodities.includes(d.commodity) || d.suppliers.includes(s.code))
      .filter((s) => !k || s.name.toLowerCase().includes(k) || s.code.toLowerCase().includes(k) || s.city.toLowerCase().includes(k))
      .sort((a, b) => b.spend - a.spend)
  }, [suppliers, allVendors, d.commodity, d.suppliers, q])
  const internalPool = useMemo(() => {
    const k = uq.trim().toLowerCase()
    return users.filter((u) => u.active && !u.roles.includes('supplier') && (!k || u.name.toLowerCase().includes(k) || u.department.toLowerCase().includes(k) || u.designation.toLowerCase().includes(k)))
  }, [users, uq])

  const vp = usePaged(vendors, 4, vPage)
  const up = usePaged(internalPool, 4, uPage)

  const errors: Record<string, string> = {}
  if (!d.name.trim()) errors.name = 'Name is required'
  if (!d.categoryId) errors.category = 'Select a category'
  if (!d.commodity) errors.commodity = 'Select a commodity'
  if (!d.startDate) errors.start = 'Start date is required'
  if (!d.endDate) errors.end = 'End date is required'
  else if (d.startDate && d.endDate < d.startDate) errors.end = 'End date must be on or after the start date'
  if (d.type === 'Workshop') {
    if (!d.workshopDate) errors.workshopDate = 'Workshop date is required'
    else if ((d.startDate && d.workshopDate < d.startDate) || (d.endDate && d.workshopDate > d.endDate)) errors.workshopDate = 'Must fall between the start and end dates'
    if (!d.venue.trim()) errors.venue = 'Venue is required'
  }
  if (!d.suppliers.length) errors.suppliers = 'Select at least one supplier'
  const e = (k: string) => (showErr ? errors[k] : undefined)

  const payload = () => ({
    name: d.name.trim(), type: d.type, categoryId: d.categoryId, commodity: d.commodity, startDate: d.startDate, endDate: d.endDate,
    workshopDate: d.type === 'Workshop' || d.workshopDate ? d.workshopDate || undefined : undefined, venue: d.type === 'Workshop' || d.venue ? d.venue.trim() || undefined : undefined,
    suppliers: d.suppliers, internalInvitees: d.internalInvitees, description: d.description.trim(),
  })
  const save = (launch: boolean) => {
    setShowErr(true)
    if (Object.keys(errors).length) { toast(`${Object.keys(errors).length} field(s) need attention`, 'error'); return }
    if (edit && initial) {
      const p = payload()
      const added = p.suppliers.filter((c) => !initial.suppliers.includes(c))
      updateCampaign(initial.id, p)
      if (launch && initial.status === 'Draft') launchWithToast(initial.id)
      else {
        if (initial.status === 'Live' && added.length) inviteAdded({ ...initial, ...p }, added)
        toast(`${p.name} updated`, 'success')
      }
      onSaved?.(initial.id)
    } else {
      const id = createCampaign({ ...payload(), targetIdeas: 0, targetValue: 0, status: 'Draft' })
      if (launch) launchWithToast(id)
      else toast(`${d.name.trim()} saved as draft (${id}) — launch it to send auto-invites`, 'success')
      onSaved?.(id)
    }
    onClose()
  }

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const cats = categories
  const comms = commodities.filter((c) => c.categoryId === d.categoryId)

  return (
    <Modal open={open} onClose={onClose} size="xl" icon={d.type === 'Workshop' ? 'Presentation' : 'Megaphone'}
      title={edit ? `Edit ${initial!.type === 'Workshop' ? 'workshop' : 'drive'} · ${initial!.id}` : 'New workshop / drive'}
      subtitle="Commodity, dates, suppliers and internal invitees — launching sends auto-invite emails"
      footer={<>
        <span className="mr-auto text-[12px] text-muted hidden sm:block">{d.suppliers.length} supplier{d.suppliers.length === 1 ? '' : 's'} · {d.internalInvitees.length} internal invitee{d.internalInvitees.length === 1 ? '' : 's'} will be emailed</span>
        <Button onClick={onClose}>Cancel</Button>
        {!edit && <Button icon="Save" onClick={() => save(false)}>Save as draft</Button>}
        {edit && <Button icon="Save" variant={initial!.status === 'Draft' ? 'secondary' : 'primary'} onClick={() => save(false)}>Save changes</Button>}
        {(!edit || initial!.status === 'Draft') && <Button variant="primary" icon="Send" onClick={() => save(true)}>Launch &amp; send auto-invites</Button>}
      </>}>
      <div className="grid grid-cols-12 gap-3">
        <Field className="col-span-12 md:col-span-8" label="Name" required error={e('name')}>
          <input className={cn('input', e('name') && '!border-red-400')} value={d.name} onChange={(ev) => set({ name: ev.target.value })} placeholder="e.g. Fasteners supplier improvement workshop" />
        </Field>
        <Field className="col-span-12 md:col-span-4" label="Type" required>
          <Segmented size="sm" value={d.type} onChange={(k) => set({ type: k as Campaign['type'] })} options={[{ key: 'Campaign', label: 'Drive', icon: 'Megaphone' }, { key: 'Workshop', label: 'Workshop', icon: 'Presentation' }]} />
        </Field>
        <Field className="col-span-6 md:col-span-3" label="Category" required error={e('category')}>
          <select className={cn('input', e('category') && '!border-red-400')} value={d.categoryId} onChange={(ev) => set({ categoryId: ev.target.value, commodity: commodities.find((c) => c.code === d.commodity)?.categoryId === ev.target.value ? d.commodity : '' })}>
            <option value="">Select…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.buyingType}</option>)}
          </select>
        </Field>
        <Field className="col-span-6 md:col-span-3" label="Commodity" required error={e('commodity')}>
          <select className={cn('input', e('commodity') && '!border-red-400')} value={d.commodity} disabled={!d.categoryId} onChange={(ev) => setCommodity(ev.target.value)}>
            <option value="">{d.categoryId ? 'Select…' : 'Category first'}</option>
            {comms.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </Field>
        <Field className="col-span-6 md:col-span-3" label="Start date" required error={e('start')}>
          <input type="date" className={cn('input', e('start') && '!border-red-400')} value={d.startDate} onChange={(ev) => set({ startDate: ev.target.value })} />
        </Field>
        <Field className="col-span-6 md:col-span-3" label="End date" required error={e('end')}>
          <input type="date" min={d.startDate} className={cn('input', e('end') && '!border-red-400')} value={d.endDate} onChange={(ev) => set({ endDate: ev.target.value })} />
        </Field>
        <Field className="col-span-6 md:col-span-3" label="Workshop date" required={d.type === 'Workshop'} error={e('workshopDate')} tag={<span className="text-[11px] text-muted font-normal">{d.type === 'Workshop' ? 'reminder 2 days before' : 'optional'}</span>}>
          <input type="date" min={d.startDate} max={d.endDate || undefined} className={cn('input', e('workshopDate') && '!border-red-400')} value={d.workshopDate} onChange={(ev) => set({ workshopDate: ev.target.value })} />
        </Field>
        <Field className="col-span-6 md:col-span-4" label="Venue" required={d.type === 'Workshop'} error={e('venue')}>
          <input className={cn('input', e('venue') && '!border-red-400')} value={d.venue} onChange={(ev) => set({ venue: ev.target.value })} placeholder="e.g. Amber Rajpura Plant, Training Hall" />
        </Field>
        <Field className="col-span-12 md:col-span-5" label="Description">
          <input className="input" value={d.description} onChange={(ev) => set({ description: ev.target.value })} placeholder="What ideas are sought, gain-share rules, what to bring" />
        </Field>

        {/* suppliers from vendor master, filtered by commodity */}
        <div className="col-span-12 lg:col-span-7 min-w-0">
          <div className="label justify-between">
            <span className="flex items-center gap-1">Suppliers<span className="text-brand-600">*</span><span className="text-muted font-normal">· vendor master{cm ? `, ${cm.name}` : ''}</span></span>
            <span className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted cursor-pointer"><input type="checkbox" className="accent-brand-600" checked={allVendors} onChange={(ev) => setAllVendors(ev.target.checked)} />All vendors</label>
              <button type="button" className="text-[11.5px] font-semibold text-brand-700 hover:underline" onClick={() => set({ suppliers: [...new Set([...d.suppliers, ...vendors.map((v) => v.code)])] })}>Select all</button>
              <button type="button" className="text-[11.5px] font-semibold text-muted hover:underline" onClick={() => set({ suppliers: [] })}>Clear</button>
            </span>
          </div>
          <div className={cn('rounded-xl border overflow-hidden', e('suppliers') ? 'border-red-300' : 'border-line')}>
            <div className="p-2 border-b border-line bg-slate-50/70">
              <div className="relative"><Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 !pl-8" value={q} onChange={(ev) => { setQ(ev.target.value); setVPage(0) }} placeholder="Search vendor code, name or city" /></div>
            </div>
            <div className="divide-y divide-slate-100">
              {vp.slice.map((s) => {
                const on = d.suppliers.includes(s.code)
                return (
                  <label key={s.code} className={cn('flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-slate-50', on && 'bg-brand-50/50')}>
                    <input type="checkbox" className="accent-brand-600" checked={on} onChange={() => set({ suppliers: toggle(d.suppliers, s.code) })} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink truncate">{s.name}</span>
                      <span className="block text-[11px] text-muted truncate">{s.code} · {s.city} · {s.contactEmail}</span>
                    </span>
                    <span className="text-right shrink-0"><span className="block text-[11.5px] font-semibold num">{inrShort(s.spend)}</span><span className="block text-[10.5px] text-muted">last FY spend</span></span>
                  </label>
                )
              })}
              {!vendors.length && <div className="px-3 py-6 text-center text-[12px] text-muted">{d.commodity ? 'No vendor matches' : 'Select a commodity to list its vendors'}</div>}
            </div>
            <Pager className="px-3 py-1.5 border-t border-line" {...vp} onPage={setVPage} noun="vendors" />
          </div>
          {e('suppliers') && <div className="text-[11.5px] text-red-600 mt-1">{e('suppliers')}</div>}
        </div>

        {/* internal invitees */}
        <div className="col-span-12 lg:col-span-5 min-w-0">
          <div className="label justify-between"><span>Internal invitees</span><span className="text-[11px] text-muted font-medium num">{d.internalInvitees.length} selected</span></div>
          <div className="rounded-xl border border-line overflow-hidden">
            <div className="p-2 border-b border-line bg-slate-50/70">
              <div className="relative"><Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 !pl-8" value={uq} onChange={(ev) => { setUq(ev.target.value); setUPage(0) }} placeholder="Search people, department or role" /></div>
            </div>
            <div className="divide-y divide-slate-100">
              {up.slice.map((u) => {
                const on = d.internalInvitees.includes(u.id)
                return (
                  <label key={u.id} className={cn('flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-slate-50', on && 'bg-brand-50/50')}>
                    <input type="checkbox" className="accent-brand-600" checked={on} onChange={() => set({ internalInvitees: toggle(d.internalInvitees, u.id) })} />
                    <Avatar name={u.name} color={u.avatarColor} size={24} />
                    <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold text-ink truncate">{u.name}</span><span className="block text-[11px] text-muted truncate">{u.department} · {u.designation}</span></span>
                    {cm && (u.id === cm.buyerId || u.id === cm.leadId) && <SourceTag>{u.id === cm.buyerId ? 'Buyer' : 'Lead'}</SourceTag>}
                  </label>
                )
              })}
            </div>
            <Pager className="px-3 py-1.5 border-t border-line" {...up} onPage={setUPage} noun="people" />
          </div>
        </div>

      </div>
    </Modal>
  )
}

export function MiniStat({ label, children, tone }: { label: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted truncate">{label}</div>
      <div className="text-[13.5px] font-bold text-ink num truncate mt-0.5" style={tone ? { color: tone } : undefined}>{children}</div>
    </div>
  )
}

/** Attendance mini bar: Attended / Accepted / Invited / Declined */
export function AttendanceBar({ att, total }: { att: Record<AttendanceStatus, number>; total: number }) {
  const order: AttendanceStatus[] = ['Attended', 'Accepted', 'Invited', 'Declined']
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 gap-px">
      {order.map((k) => att[k] > 0 && <span key={k} style={{ width: `${(att[k] / Math.max(1, total)) * 100}%`, background: ATT_STYLE[k].color }} title={`${k}: ${att[k]}`} />)}
    </div>
  )
}

export function copyText(text: string, label = 'Link') {
  const done = () => useStore.getState().toast(`${label} copied to clipboard`, 'success')
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallback())
  else fallback()
  function fallback() {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy'); done() } catch { useStore.getState().toast('Copy failed — select the link and copy manually', 'error') }
    ta.remove()
  }
}
export const submissionLink = (id: string) => `${window.location.origin}/submit?campaign=${id}`

/** Single-line category tick for horizontal bar charts (no wrapping) */
export const YTick = ({ x, y, payload, max = 22 }: any) => {
  const v = String(payload?.value ?? '')
  return <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#334155">{v.length > max ? v.slice(0, max - 1) + '…' : v}</text>
}
