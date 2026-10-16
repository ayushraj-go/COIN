// Public supplier capability form — opened from the emailed link, no login and no app shell.
// Shows only what the email asked (item, specification, required-by date); never Amber prices, volumes or suppliers.
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import type { SupplierCheck } from '../lib/types'
import { fmtDate, nowIso } from '../lib/format'
import { Button, Field, Icon, cn } from '../components/ui'
import { CoinMark } from '../components/Logo'

type Resp = NonNullable<SupplierCheck['response']>

function Choice<T extends string>({ value, options, onChange }: { value: T | ''; options: { key: T; label: string; tone: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={cn('h-11 rounded-xl border-2 text-[13.5px] font-semibold transition-colors', value === o.key ? 'text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}
          style={value === o.key ? { background: o.tone, borderColor: o.tone } : undefined}>{o.label}</button>
      ))}
    </div>
  )
}

export default function SupplierForm() {
  const { token } = useParams()
  const req = useStore((s) => {
    const i = s.ideas.find((x) => x.evaluation?.supplier?.token === token)
    return i?.evaluation?.supplier
  })
  const [canSupply, setCanSupply] = useState<Resp['canSupply'] | ''>('')
  const [meetsSpec, setMeetsSpec] = useState<Resp['meetsSpec'] | ''>('')
  const [capacity, setCapacity] = useState('')
  const [lead, setLead] = useState('')
  const [price, setPrice] = useState('')
  const [certs, setCerts] = useState('')
  const [remarks, setRemarks] = useState('')
  const [contact, setContact] = useState(req?.contactName ?? '')
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  const shell = (children: React.ReactNode) => (
    <div className="min-h-full bg-[var(--color-slate-100)]">
      <header className="bg-white border-b border-line">
        <div className="max-w-[760px] mx-auto px-4 h-14 flex items-center gap-2.5">
          <CoinMark size={30} />
          <div className="leading-tight"><div className="text-[14px] font-bold text-ink">Supplier capability request</div><div className="text-[11.5px] text-muted">Secure form · no login needed</div></div>
        </div>
      </header>
      <main className="max-w-[760px] mx-auto px-4 py-6">{children}</main>
    </div>
  )

  if (!req || !token) return shell(
    <div className="card p-8 text-center"><Icon name="LinkOff" size={28} className="mx-auto text-muted" /><h1 className="mt-3 text-[18px] font-bold text-ink">This link is not valid</h1><p className="text-[13px] text-muted mt-1">The request may have been withdrawn, or the link was copied incompletely. Please contact the sender.</p></div>,
  )
  if (done || req.status === 'Responded') return shell(
    <div className="card p-8 text-center"><span className="h-12 w-12 rounded-full bg-emerald-600 text-white grid place-items-center mx-auto"><Icon name="Check" size={24} strokeWidth={3} /></span>
      <h1 className="mt-3 text-[19px] font-bold text-ink">Thank you — your response was received</h1>
      <p className="text-[13px] text-muted mt-1">{req.response ? `Received ${fmtDate(req.response.respondedAt.slice(0, 10))} from ${req.response.contactName}. ` : ''}The sourcing team will contact you if the item moves ahead.</p></div>,
  )

  const valid = !!canSupply && !!meetsSpec && !!contact.trim()
  const submit = async () => {
    const ok = await useStore.getState().respondSupplierCheck(token, { canSupply: canSupply as Resp['canSupply'], meetsSpec: meetsSpec as Resp['meetsSpec'], capacityPerMonth: capacity.trim() || undefined, leadTimeDays: Number(lead) || undefined, indicativePrice: Number(price) || undefined, certifications: certs.trim() || undefined, remarks: remarks.trim() || undefined, contactName: contact.trim(), respondedAt: nowIso() })
    if (ok) setDone(true); else setFailed(true)
  }
  return shell(
    <div className="grid gap-4">
      <section className="card p-5">
        <div className="text-[12px] text-muted">For <b className="text-ink">{req.supplierName}</b>{req.contactName ? ` · ${req.contactName}` : ''}</div>
        <h1 className="text-[20px] font-bold text-ink mt-1">Can you supply this item?</h1>
        <div className="mt-3 grid gap-2 text-[13px]">
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2"><span className="text-muted">Item</span><span className="font-semibold text-ink">{req.item}</span></div>
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2"><span className="text-muted">Specification</span><span className="text-ink-2">{req.spec}</span></div>
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2"><span className="text-muted">Required by</span><span className="text-ink-2">{fmtDate(req.requiredBy)}</span></div>
        </div>
      </section>
      <section className="card p-5 grid gap-4">
        <Field label="Can you supply this item?" required><Choice<Resp['canSupply']> value={canSupply} onChange={(v) => setCanSupply(v)} options={[{ key: 'Yes', label: 'Yes', tone: 'var(--color-emerald-600)' }, { key: 'Partly', label: 'Partly', tone: 'var(--color-orange-400)' }, { key: 'No', label: 'No', tone: 'var(--color-accent-500)' }]} /></Field>
        <Field label="Does it meet the specification?" required><Choice<Resp['meetsSpec']> value={meetsSpec} onChange={(v) => setMeetsSpec(v)} options={[{ key: 'Yes', label: 'Yes', tone: 'var(--color-emerald-600)' }, { key: 'With deviation', label: 'With deviation', tone: 'var(--color-orange-400)' }, { key: 'No', label: 'No', tone: 'var(--color-accent-500)' }]} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Monthly capacity"><input className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 120 MT per month" /></Field>
          <Field label="Lead time (days)"><input className="input num" type="number" min="0" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="e.g. 30" /></Field>
          <Field label="Indicative price per unit (optional)"><input className="input num" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="Certifications"><input className="input" value={certs} onChange={(e) => setCerts(e.target.value)} placeholder="e.g. IATF 16949, ISO 14001" /></Field>
        </div>
        <Field label="Remarks"><textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Deviations, samples, conditions…" /></Field>
        <Field label="Your name" required><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
        {failed && <div className="text-[12.5px] text-red-600">This request is no longer open for responses.</div>}
        <div className="flex justify-end"><Button variant="primary" icon="Send" disabled={!valid} onClick={submit}>Submit response</Button></div>
      </section>
      <p className="text-[11.5px] text-muted text-center">This form only asks about your capability. It carries no commitment.</p>
    </div>,
  )
}
