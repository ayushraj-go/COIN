// Public supplier capability form — opened from the emailed link, no login and no app shell.
// Shows only what the email asked (item, specification, required-by date); never Amber prices, volumes or suppliers.
// Anything the stored request lacks (older data) is taken from the idea's own generic description, so the page is
// never blank.
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import type { SupplierCheck } from '../lib/types'
import { addDays, fmtDate, nowIso } from '../lib/format'
import { SUPPLIER_SPEC_BY_GROUP } from '../lib/workflow'
import { Button, Icon, cn } from '../components/ui'
import { Fact, FormStep, SupplierShell } from '../components/SupplierShell'

type Resp = NonNullable<SupplierCheck['response']>
type Opt<T extends string> = { key: T; label: string; sub: string; icon: string; tone: string }

function Choice<T extends string>({ value, options, onChange, label }: { value: T | ''; options: Opt<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-[13px] font-semibold text-ink">{label} <span className="text-red-500">*</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = value === o.key
          return (
            <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.key)}
              className={cn('text-left rounded-xl border-2 px-3 py-2.5 flex items-start gap-2.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2', on ? 'shadow-sm' : 'bg-white border-line hover:border-slate-300')}
              style={on ? { borderColor: o.tone, background: `color-mix(in srgb, ${o.tone} 8%, white)` } : undefined}>
              <span className="h-7 w-7 rounded-full grid place-items-center shrink-0 transition-colors" style={{ background: on ? o.tone : 'var(--color-slate-100)', color: on ? 'white' : 'var(--color-slate-500)' }}><Icon name={o.icon} size={14} strokeWidth={2.6} /></span>
              <span className="min-w-0"><span className="block text-[13.5px] font-bold text-ink">{o.label}</span><span className="block text-[11.5px] text-muted leading-snug">{o.sub}</span></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
const GREEN = 'var(--color-emerald-600)', AMBERISH = 'var(--color-orange-500)', RED = 'var(--color-red-600)'
const CAN: Opt<Resp['canSupply']>[] = [
  { key: 'Yes', label: 'Yes', sub: 'We can supply it', icon: 'Check', tone: GREEN },
  { key: 'Partly', label: 'Partly', sub: 'Part of the volume, or with conditions', icon: 'Minus', tone: AMBERISH },
  { key: 'No', label: 'No', sub: 'Not at the moment', icon: 'X', tone: RED },
]
const SPEC: Opt<Resp['meetsSpec']>[] = [
  { key: 'Yes', label: 'Yes', sub: 'Meets the specification as it is', icon: 'Check', tone: GREEN },
  { key: 'With deviation', label: 'With deviation', sub: 'Needs a deviation — explain below', icon: 'Minus', tone: AMBERISH },
  { key: 'No', label: 'No', sub: 'Cannot meet it', icon: 'X', tone: RED },
]
const CERTS = ['IATF 16949', 'ISO 9001', 'ISO 14001', 'ISO 45001']
const lbl = 'text-[12.5px] font-semibold text-ink-2'

export default function SupplierForm() {
  const { token } = useParams()
  // select the idea itself (a stable reference) — the request is its supplier check
  const idea = useStore((s) => s.ideas.find((x) => x.evaluation?.supplier?.token === token))
  const suppliers = useStore((s) => s.suppliers)
  const levers = useStore((s) => s.levers)
  const sc = idea?.evaluation?.supplier
  const vendor = suppliers.find((x) => x.code === sc?.supplierCode)
  const lever = levers.find((l) => l.id === idea?.leverId)
  // what the email asked — with the idea's generic description as a fallback, never part codes or prices
  const req = sc && idea ? {
    supplierName: sc.supplierName || vendor?.name || idea.proposedSupplier?.name || '',
    contactName: sc.contactName || vendor?.contactName || '',
    item: sc.item || idea.parts[0]?.description || idea.title,
    spec: sc.spec || (lever ? SUPPLIER_SPEC_BY_GROUP[lever.group] : '') || 'As per the drawing shared by Amber Sourcing',
    requiredBy: sc.requiredBy || (sc.sentAt ? addDays(sc.sentAt.slice(0, 10), 90) : undefined),
    replyBy: sc.sentAt ? addDays(sc.sentAt.slice(0, 10), 7) : undefined,
    sentAt: sc.sentAt, sentBy: sc.sentBy,
  } : null

  const [canSupply, setCanSupply] = useState<Resp['canSupply'] | ''>('')
  const [meetsSpec, setMeetsSpec] = useState<Resp['meetsSpec'] | ''>('')
  const [capacity, setCapacity] = useState('')
  const [lead, setLead] = useState('')
  const [price, setPrice] = useState('')
  const [certs, setCerts] = useState('')
  const [remarks, setRemarks] = useState('')
  const [contact, setContact] = useState(req?.contactName ?? '')
  const [done, setDone] = useState<Resp | null>(null)
  const [failed, setFailed] = useState(false)
  const shell = (children: React.ReactNode) => <SupplierShell title="Supplier capability request" subtitle={req?.supplierName ? `For ${req.supplierName}` : 'From Amber Sourcing'}>{children}</SupplierShell>

  if (!req || !token) return shell(
    <div className="card p-8 text-center max-w-[560px] mx-auto">
      <span className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 grid place-items-center mx-auto"><Icon name="Link2Off" size={22} /></span>
      <h1 className="mt-3 text-[18px] font-bold text-ink">This link is not valid</h1>
      <p className="text-[13px] text-muted mt-1">The request may have been replaced by a newer email, withdrawn, or the link was copied incompletely. Please use the link in the latest email from Amber Sourcing, or reply to that email.</p>
    </div>,
  )

  const answer = done ?? sc?.response
  if (answer) {
    const rows: [string, string | undefined][] = [
      ['Can supply', answer.canSupply], ['Meets the specification', answer.meetsSpec], ['Monthly capacity', answer.capacityPerMonth],
      ['Lead time', answer.leadTimeDays ? `${answer.leadTimeDays} days` : undefined], ['Indicative price per unit', answer.indicativePrice ? `₹ ${answer.indicativePrice}` : undefined],
      ['Certifications', answer.certifications], ['Remarks', answer.remarks],
    ]
    return shell(
      <div className="grid gap-4 max-w-[640px] mx-auto">
        <div className="card p-7 text-center">
          <span className="h-14 w-14 rounded-full bg-emerald-600 text-white grid place-items-center mx-auto shadow-[0_8px_24px_-8px_rgb(5_150_105/.6)]"><Icon name="Check" size={28} strokeWidth={3} /></span>
          <h1 className="mt-3 text-[20px] font-bold text-ink">Thank you{answer.contactName ? `, ${answer.contactName.split(' ')[0]}` : ''} — Amber Sourcing has your answer</h1>
          <p className="text-[13px] text-muted mt-1">{done ? 'Received just now' : `Received ${fmtDate(answer.respondedAt.slice(0, 10))}`} for <b className="text-ink-2">{req.item}</b>{req.supplierName ? <> · {req.supplierName}</> : null}.</p>
        </div>
        <div className="card p-5">
          <div className="text-[13px] font-bold text-ink mb-2">Your answer</div>
          <dl className="grid gap-1.5 text-[13px]">
            {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="grid grid-cols-[170px_minmax(0,1fr)] gap-2 py-1 border-b border-dashed border-line last:border-0"><dt className="text-muted">{k}</dt><dd className="text-ink font-medium break-words">{v}</dd></div>)}
          </dl>
        </div>
        <div className="card p-5">
          <div className="text-[13px] font-bold text-ink mb-2">What happens next</div>
          <ol className="grid gap-2 text-[13px] text-ink-2">
            {['Amber Sourcing reviews your answer with the evaluation team.', 'If the item moves ahead, the buyer contacts you for drawings, samples and a quotation.', 'Nothing is ordered on the basis of this form — it carries no commitment.'].map((t, k) => (
              <li key={t} className="flex gap-2.5"><span className="h-5 w-5 rounded-full bg-[#1b2f63] text-white text-[11px] font-bold grid place-items-center shrink-0 mt-px">{k + 1}</span>{t}</li>
            ))}
          </ol>
        </div>
      </div>,
    )
  }

  const deviation = meetsSpec === 'With deviation' || canSupply === 'Partly'
  const steps = [!!canSupply && !!meetsSpec, true, !!contact.trim() && (!deviation || !!remarks.trim())]
  const valid = steps.every(Boolean)
  const missing = [!canSupply && 'whether you can supply it', !meetsSpec && 'whether it meets the specification', deviation && !remarks.trim() && 'the deviation or conditions in remarks', !contact.trim() && 'your name'].filter(Boolean) as string[]
  const addCert = (c: string) => setCerts((x) => (x.split(',').map((y) => y.trim()).includes(c) ? x : x.trim() ? `${x.trim()}, ${c}` : c))
  const submit = () => {
    const r: Resp = { canSupply: canSupply as Resp['canSupply'], meetsSpec: meetsSpec as Resp['meetsSpec'], capacityPerMonth: capacity.trim() || undefined, leadTimeDays: Number(lead) || undefined, indicativePrice: Number(price) || undefined, certifications: certs.trim() || undefined, remarks: remarks.trim() || undefined, contactName: contact.trim(), respondedAt: nowIso() }
    if (useStore.getState().respondSupplierCheck(token, r)) setDone(r); else setFailed(true)
  }

  return shell(
    <div className="grid gap-4" data-testid="supplier-form">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-[#1b2f63]/[.07] text-[#1b2f63] font-semibold"><Icon name="MailOpen" size={13} />Capability request from Amber Sourcing</span>
          {req.sentAt && <span>sent {fmtDate(req.sentAt.slice(0, 10))}{req.sentBy ? ` by ${req.sentBy}` : ''}</span>}
        </div>
        <h1 className="text-[22px] sm:text-[24px] font-extrabold text-ink mt-2 tracking-tight">Can you supply this item?</h1>
        {req.supplierName && <p className="text-[13.5px] text-ink-2 mt-0.5">For <b className="text-ink">{req.supplierName}</b>{req.contactName ? ` · ${req.contactName}` : ''}</p>}
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          <Fact icon="Package" label="Item">{req.item}</Fact>
          <Fact icon="CalendarClock" label="Required by">{req.requiredBy ? fmtDate(req.requiredBy) : 'To be agreed'}</Fact>
          <Fact icon="ClipboardList" label="Specification" wide>{req.spec}</Fact>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-slate-100 text-ink-2"><Icon name="Timer" size={12} />About 2 minutes</span>
          {req.replyBy && <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-50 text-amber-800"><Icon name="CalendarCheck" size={12} />Please reply by {fmtDate(req.replyBy)}</span>}
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-emerald-50 text-emerald-800"><Icon name="ShieldCheck" size={12} />No commitment from either side</span>
        </div>
      </section>

      <section className="card p-5 sm:p-6 grid gap-6">
        <FormStep n={1} title="Your capability" hint="Two quick answers — choose one in each row" done={steps[0]}>
          <Choice<Resp['canSupply']> label="Can you supply this item?" value={canSupply} onChange={(v) => setCanSupply(v)} options={CAN} />
          <Choice<Resp['meetsSpec']> label="Does it meet the specification?" value={meetsSpec} onChange={(v) => setMeetsSpec(v)} options={SPEC} />
        </FormStep>
        <div className="h-px bg-line" />
        <FormStep n={2} title="Capacity and terms" hint="Optional, but it helps Amber move faster">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="grid gap-1"><span className={lbl}>Monthly capacity</span><input className="input" aria-label="Monthly capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 2.5 million pieces a month" /></label>
            <label className="grid gap-1"><span className={lbl}>Lead time</span><div className="relative flex items-center"><input className="input num" style={{ paddingRight: 52 }} type="number" min="0" aria-label="Lead time days" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="e.g. 30" /><span className="absolute right-3 text-[12px] leading-none text-muted pointer-events-none">days</span></div></label>
            <label className="grid gap-1"><span className={lbl}>Indicative price per unit <span className="font-normal text-muted">(optional)</span></span><div className="relative flex items-center"><span className="absolute left-3 text-[13px] leading-none text-muted pointer-events-none">₹</span><input className="input num" style={{ paddingLeft: 28 }} type="number" min="0" step="0.01" aria-label="Indicative price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></div></label>
            <label className="grid gap-1"><span className={lbl}>Certifications</span><input className="input" aria-label="Certifications" value={certs} onChange={(e) => setCerts(e.target.value)} placeholder="e.g. IATF 16949, ISO 14001" />
              <span className="flex flex-wrap gap-1">{CERTS.map((c) => <button key={c} type="button" onClick={() => addCert(c)} className="h-6 px-2 rounded-full border border-line bg-white text-[11px] font-semibold text-ink-2 hover:border-[#1b2f63] hover:text-[#1b2f63]">+ {c}</button>)}</span>
            </label>
          </div>
        </FormStep>
        <div className="h-px bg-line" />
        <FormStep n={3} title="Remarks and your name" done={steps[2] && !!contact.trim()}>
          <label className="grid gap-1"><span className={lbl}>Remarks {deviation ? <span className="text-red-500">* describe the deviation or conditions</span> : <span className="font-normal text-muted">(optional)</span>}</span>
            <textarea className={cn('input', deviation && !remarks.trim() && '!border-amber-400')} rows={3} aria-label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Deviations, samples, conditions, MOQ…" /></label>
          <label className="grid gap-1 sm:max-w-[360px]"><span className={lbl}>Your name <span className="text-red-500">*</span></span><input className="input" aria-label="Your name" value={contact} onChange={(e) => setContact(e.target.value)} /></label>
        </FormStep>
        {failed && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700 flex items-center gap-2"><Icon name="TriangleAlert" size={14} />This request is no longer open for answers — Amber may have sent a newer email.</div>}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 pt-1">
          <div className="text-[12px] text-muted flex-1">{valid ? <span className="text-emerald-700 font-semibold inline-flex items-center gap-1"><Icon name="CircleCheck" size={14} />Ready to send</span> : <>Still needed: {missing.join(', ')}</>}</div>
          <Button variant="primary" icon="Send" disabled={!valid} onClick={submit} className="sm:min-w-[200px] justify-center">Send my answer</Button>
        </div>
      </section>
    </div>,
  )
}
