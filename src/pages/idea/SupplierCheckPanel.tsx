// Stage 3 — supplier capability check, used inside the evaluation sheet and on /ideas/:id/supplier-check.
// Pick a supplier, write the email (a ready-made template, every word editable — no Amber data), send it, and see the
// supplier's answer from the secure form (/supplier-form/:token). A sent request can be edited and sent again; the
// new email carries a new link and the earlier link stops answering.
import { useEffect, useMemo, useState } from 'react'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { ideaAnnualised } from '../../lib/calc'
import { addDays, fmtDateTime, inrShort, todayIso } from '../../lib/format'
import { amberDataLeaks, needsSupplierCheck, stageLabel, supplierCapabilityEmail, SUPPLIER_CHECK_MIN, SUPPLIER_LINK_PLACEHOLDER, SUPPLIER_SPEC_BY_GROUP } from '../../lib/workflow'
import { STAGE } from '../../lib/masters'
import { Badge, Button, Icon, LinkText, cn } from '../../components/ui'
import { SupplierResponseCard } from './StageForms'
import { ideaPerms } from './model'

const LINK_RE = /\S*\/supplier-form\/[\w-]+/g

export function SupplierCheckPanel({ idea, embedded }: { idea: Idea; embedded?: boolean }) {
  const me = useMe()
  const suppliers = useStore((s) => s.suppliers)
  const levers = useStore((s) => s.levers)
  const toast = useStore((s) => s.toast)
  const sc = idea.evaluation?.supplier
  const lever = levers.find((l) => l.id === idea.leverId)
  const current = useMemo(() => new Set(idea.parts.map((p) => p.currentSupplier.split(' · ')[0])), [idea.parts])
  const options = useMemo(() => suppliers.filter((s) => s.commodities.includes(idea.commodity)), [suppliers, idea.commodity])
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [other, setOther] = useState({ name: '', contactName: '' })
  const [to, setTo] = useState('')
  const [item, setItem] = useState('')
  const [spec, setSpec] = useState('')
  const [requiredBy, setRequiredBy] = useState(addDays(todayIso(), 90))
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [touched, setTouched] = useState(false)

  const sup = code === 'other' ? { code: undefined, name: other.name, contactName: other.contactName, contactEmail: '' } : suppliers.find((s) => s.code === code)
  // first open: the proposed or an alternate supplier, the first part as the item, the category's standard specification
  useEffect(() => {
    const alt = options.find((s) => s.code === idea.proposedSupplier?.code) ?? options.find((s) => !current.has(s.code)) ?? options[0]
    setCode(alt?.code ?? 'other'); setTo(alt?.contactEmail ?? '')
    setItem(idea.parts[0]?.description ?? idea.title)
    setSpec(lever ? SUPPLIER_SPEC_BY_GROUP[lever.group] : '')
    setEditing(false); setTouched(false)
  }, [idea.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // the template follows the request until the evaluator edits the email by hand
  useEffect(() => {
    if (touched || !sup) return
    const m = supplierCapabilityEmail({ supplierName: sup.name || 'your company', contactName: sup.contactName, item, spec, requiredBy, link: SUPPLIER_LINK_PLACEHOLDER, sender: `${me?.name ?? 'Sourcing'}, Amber Sourcing` })
    setSubject(m.subject); setBody(m.body)
  }, [code, other.name, other.contactName, item, spec, requiredBy, touched]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (c: string) => { setCode(c); setTouched(false); setTo(c === 'other' ? '' : suppliers.find((s) => s.code === c)?.contactEmail ?? '') }
  // edit & resend: start from the email as it was sent, with its link turned back into the placeholder
  const startEdit = () => {
    if (!sc) return
    setCode(sc.supplierCode && suppliers.some((s) => s.code === sc.supplierCode) ? sc.supplierCode : 'other')
    setOther({ name: sc.supplierName ?? '', contactName: sc.contactName ?? '' })
    setTo(sc.email ?? ''); setItem(sc.item ?? item); setSpec(sc.spec ?? spec); setRequiredBy(sc.requiredBy ?? requiredBy)
    setSubject(sc.subject ?? ''); setBody((sc.body ?? '').replace(LINK_RE, SUPPLIER_LINK_PLACEHOLDER)); setTouched(true)
    setEditing(true)
  }

  const annual = ideaAnnualised(idea)
  const mayEvaluate = !!me && ideaPerms(me, idea).evaluate
  const inEvaluation = idea.stage === STAGE.evaluation
  const leaks = amberDataLeaks(`${subject}\n${body}\n${item}\n${spec}`, idea, suppliers, sup ? { code: sup.code, name: sup.name } : undefined)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())
  const hasLink = body.includes(SUPPLIER_LINK_PLACEHOLDER)
  const canSend = mayEvaluate && inEvaluation && !!sup?.name?.trim() && emailOk && !!item.trim() && !!spec.trim() && !!subject.trim() && hasLink && !leaks.length
  const send = () => {
    if (!sup) return
    const resend = editing
    const token = useStore.getState().sendSupplierCheck(idea.id, { supplierCode: sup.code, supplierName: sup.name.trim(), contactName: sup.contactName, email: to.trim(), item: item.trim(), spec: spec.trim(), requiredBy, subject: subject.trim(), body })
    toast(resend ? `Updated request sent to ${sup.name} — the earlier link no longer works` : `Capability request sent to ${sup.name} — form link ${token}`, 'success')
    setEditing(false)
  }
  const formUrl = sc?.token ? `/supplier-form/${sc.token}` : null
  const col = embedded ? 'flex flex-col min-h-0 gap-2.5' : 'grid gap-3 content-start'
  const grid = cn('grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3', embedded && 'h-full min-h-0')

  if (!needsSupplierCheck(annual) || sc?.status === 'Skipped') {
    return (
      <div className="rounded-xl border border-line px-4 py-4 flex items-center gap-3 bg-white">
        <span className="h-10 w-10 rounded-xl grid place-items-center bg-slate-100 text-slate-500"><Icon name="SkipForward" size={18} /></span>
        <div><div className="text-[14px] font-semibold text-ink">Skipped — below the minimum saving threshold</div><div className="text-[12.5px] text-muted">Forecast {inrShort(annual)} is below {inrShort(SUPPLIER_CHECK_MIN)}; this idea goes to approval without a supplier capability check.</div></div>
      </div>
    )
  }

  // sent or answered — the request as it went out, the answer when it is in
  if (sc && (sc.status === 'Sent' || sc.status === 'Responded') && !editing) {
    return (
      <div className={grid} data-testid="supplier-check" data-status={sc.status}>
        <div className={col}>
          <div className="rounded-xl border border-line bg-white px-3.5 py-3 flex items-start gap-3">
            <span className={cn('h-9 w-9 rounded-xl grid place-items-center shrink-0', sc.status === 'Responded' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}><Icon name={sc.status === 'Responded' ? 'MailCheck' : 'MailQuestion'} size={17} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-ink">{sc.status === 'Responded' ? `${sc.supplierName} answered` : `Sent to ${sc.supplierName} — awaiting the answer`}</div>
              <div className="text-[12px] text-muted truncate">{sc.email} · sent {fmtDateTime(sc.sentAt)}{sc.sentBy ? ` by ${sc.sentBy}` : ''}</div>
            </div>
            <Badge color={sc.status === 'Responded' ? 'var(--color-emerald-600)' : 'var(--color-orange-400)'}>{sc.status}</Badge>
          </div>
          {sc.status === 'Responded' ? <SupplierResponseCard idea={idea} /> : (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900 flex gap-2"><Icon name="Clock3" size={15} className="shrink-0 mt-px" />The supplier answers on the secure form. The answer appears here and on the idea page; the evaluation can then be recommended.</div>
              <div className="flex flex-wrap items-center gap-2">
                {formUrl && <Button variant="primary" icon="ExternalLink" onClick={() => window.open(formUrl, '_blank')}>Open the supplier form</Button>}
                {formUrl && <Button icon="Copy" onClick={() => { navigator.clipboard?.writeText(window.location.origin + formUrl).catch(() => undefined); toast('Supplier form link copied', 'info') }}>Copy link</Button>}
                {mayEvaluate && inEvaluation && <Button icon="PencilLine" onClick={startEdit}>Edit &amp; resend</Button>}
              </div>
              <div className="text-[11.5px] text-muted">In the demo the supplier form opens in this browser.</div>
            </>
          )}
        </div>
        <div className={cn('rounded-xl border border-line bg-white px-3.5 py-3', embedded && 'flex flex-col min-h-0')}>
          <div className="flex items-center gap-2 mb-2"><Icon name="Mail" size={15} className="text-brand-600" /><span className="text-[13px] font-semibold text-ink">The email as sent</span><span className="ml-auto text-[11.5px] text-muted truncate">To {sc.contactName ? `${sc.contactName} · ` : ''}{sc.email}</span></div>
          <div className="text-[12.5px] font-semibold text-ink mb-1.5">{sc.subject}</div>
          <pre className={cn('whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-2 rounded-lg bg-slate-50 border border-line p-3', embedded && 'flex-1 min-h-0 overflow-auto')}><LinkText text={sc.body ?? ''} /></pre>
        </div>
      </div>
    )
  }

  // compose (first send, or edit & resend)
  return (
    <div className={grid} data-testid="supplier-check" data-status={editing ? 'Editing' : 'Not sent'}>
      <div className={col}>
        <div className="grid gap-1">
          <span className="text-[12px] font-semibold text-ink-2">Supplier <span className="text-red-500">*</span></span>
          <div className={cn('grid sm:grid-cols-2 gap-1.5', embedded && 'max-h-[132px] overflow-auto pr-0.5')}>
            {options.map((s) => (
              <button key={s.code} type="button" onClick={() => pick(s.code)} className={cn('text-left rounded-lg border px-2.5 py-1.5 transition-colors', code === s.code ? 'border-brand-500 bg-brand-50' : 'border-line bg-white hover:border-slate-300')}>
                <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                <div className="text-[11px] text-muted truncate">{s.code} · {s.city} · {s.contactName}{current.has(s.code) ? ' · current supplier' : ''}</div>
              </button>
            ))}
            <button type="button" onClick={() => pick('other')} className={cn('text-left rounded-lg border px-2.5 py-1.5', code === 'other' ? 'border-brand-500 bg-brand-50' : 'border-dashed border-line bg-white hover:border-slate-300')}>
              <div className="text-[12.5px] font-semibold text-ink">Another vendor</div><div className="text-[11px] text-muted">Not in the vendor master yet</div>
            </button>
          </div>
        </div>
        {code === 'other' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1"><span className="text-[12px] font-semibold text-ink-2">Company *</span><input className="input !h-9" aria-label="Supplier company" value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })} /></label>
            <label className="grid gap-1"><span className="text-[12px] font-semibold text-ink-2">Contact *</span><input className="input !h-9" aria-label="Supplier contact" value={other.contactName} onChange={(e) => setOther({ ...other, contactName: e.target.value })} /></label>
          </div>
        )}
        <label className="grid gap-1"><span className="text-[12px] font-semibold text-ink-2">Item (generic description) * <span className="font-normal text-muted">— no part code</span></span><input className="input !h-9" aria-label="Item" value={item} onChange={(e) => { setItem(e.target.value); setTouched(false) }} /></label>
        <label className="grid gap-1"><span className="text-[12px] font-semibold text-ink-2">Specification * <span className="font-normal text-muted">— technical requirement only</span></span><textarea className="input text-[12.5px]" rows={embedded ? 2 : 3} aria-label="Specification" value={spec} onChange={(e) => { setSpec(e.target.value); setTouched(false) }} /></label>
        <label className="grid gap-1 max-w-[220px]"><span className="text-[12px] font-semibold text-ink-2">Required by</span><input type="date" className="input !h-9" aria-label="Required by" value={requiredBy} onChange={(e) => { setRequiredBy(e.target.value); setTouched(false) }} /></label>
        {leaks.length > 0 ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            <div className="font-semibold flex items-center gap-1.5"><Icon name="ShieldAlert" size={14} />Remove Amber data before sending</div>
            <ul className="list-disc pl-5">{leaks.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        ) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 flex items-center gap-1.5"><Icon name="ShieldCheck" size={14} />No Amber data in this email — no part codes, prices, volumes or current suppliers.</div>}
      </div>

      <div className={cn('rounded-xl border border-line bg-white px-3.5 py-3 gap-2', embedded ? 'flex flex-col min-h-0' : 'grid')}>
        <div className="flex items-center gap-2"><Icon name="Mail" size={15} className="text-brand-600" /><span className="text-[13px] font-semibold text-ink">{editing ? 'Edit the email and send it again' : 'Email — write or change anything'}</span>
          {touched && !editing && <button type="button" onClick={() => setTouched(false)} className="ml-auto text-[11.5px] font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"><Icon name="RotateCcw" size={11} />Back to the template</button>}
        </div>
        <label className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 text-[12.5px]"><span className="text-muted">To</span><input className={cn('input !h-8', to && !emailOk && '!border-red-400')} aria-label="To" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="supplier@company.com" /></label>
        <label className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 text-[12.5px]"><span className="text-muted">Subject</span><input className="input !h-8" aria-label="Subject" value={subject} onChange={(e) => { setSubject(e.target.value); setTouched(true) }} /></label>
        <textarea className={cn('input font-[inherit] text-[12.5px] leading-relaxed', embedded && 'flex-1 min-h-[140px] resize-none')} rows={embedded ? undefined : 16} aria-label="Email body" value={body} onChange={(e) => { setBody(e.target.value); setTouched(true) }} />
        {!hasLink && <div className="text-[11.5px] text-red-700 flex items-center gap-1"><Icon name="Link2Off" size={12} />Keep <code className="font-mono">{SUPPLIER_LINK_PLACEHOLDER}</code> in the email — COIN puts the supplier's secure form link there.</div>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!inEvaluation && <span className="text-[11.5px] text-muted mr-auto">Requests can be sent while the idea is in evaluation.</span>}
          {inEvaluation && !mayEvaluate && <span className="text-[11.5px] text-muted mr-auto">Only the {stageLabel(idea, STAGE.evaluation)} team or the Sourcing Head can send this request.</span>}
          {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          <Button variant="primary" icon="Send" disabled={!canSend} onClick={send}>{editing ? 'Send updated request' : 'Send capability request'}</Button>
        </div>
      </div>
    </div>
  )
}
