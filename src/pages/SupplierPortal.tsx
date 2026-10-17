// Public Supplier Portal page — opened from the {{portalLink}} in a supplier outreach email (campaign / workshop
// invitation, idea drive, reminder). No login: the supplier sends an idea, a problem or a complaint, which lands in
// Supplier responses for Amber Sourcing. Shows only the supplier's own parts — never Amber prices, volumes, other suppliers
// or earlier submissions (the link carries only the vendor code).
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { commodityShort, useStore } from '../store/useStore'
import type { SupplierResponse, SupplierResponseType } from '../lib/types'
import { fmtDate } from '../lib/format'
import { Button, Field, Icon, cn } from '../components/ui'
import { Fact, FormStep, SupplierShell } from '../components/SupplierShell'

const TYPES: { key: SupplierResponseType; label: string; hint: string; icon: string }[] = [
  { key: 'Idea', label: 'Cost idea', hint: 'A design, material, process, packing or logistics change that lowers cost', icon: 'Lightbulb' },
  { key: 'Problem', label: 'Problem', hint: 'Something in the current supply that causes cost or rework', icon: 'TriangleAlert' },
  { key: 'Complaint', label: 'Complaint', hint: 'A commercial or process issue you want Amber to look at', icon: 'MessageSquareWarning' },
]

export default function SupplierPortal() {
  const [params] = useSearchParams()
  const code = params.get('s') ?? ''
  const batchId = params.get('b') ?? undefined
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const parts = useStore((s) => s.parts)
  const batches = useStore((s) => s.outreachBatches)
  const sup = suppliers.find((x) => x.code === code)
  const asked = (params.get('c') ?? '').split(',').filter(Boolean)
  const comms = (asked.length ? asked : sup?.commodities ?? []).filter((c) => !sup || sup.commodities.includes(c) || asked.includes(c))
  const batch = batches?.find((b) => b.id === batchId)
  const [type, setType] = useState<SupplierResponseType>('Idea')
  const [commodity, setCommodity] = useState(comms[0] ?? '')
  const [scope, setScope] = useState<SupplierResponse['scope']>('Open idea')
  const [chosen, setChosen] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [est, setEst] = useState('')
  const [contact, setContact] = useState(sup?.contactName ?? '')
  const [sent, setSent] = useState<string | null>(null)
  // only this supplier's own parts in the chosen commodity — no prices or volumes
  const myParts = useMemo(() => parts.filter((p) => p.supplierCode === code && p.commodity === commodity), [parts, code, commodity])
  const nameOf = (c: string) => commodityShort(commodities.find((x) => x.code === c)?.name ?? c)

  const shell = (children: React.ReactNode) => <SupplierShell title="Amber Supplier Portal" subtitle={sup ? `For ${sup.name}` : 'Share ideas with Amber Sourcing'}>{children}</SupplierShell>

  if (!sup) return shell(
    <div className="card p-8 text-center max-w-[560px] mx-auto"><span className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 grid place-items-center mx-auto"><Icon name="Link2Off" size={22} /></span><h1 className="mt-3 text-[18px] font-bold text-ink">This link is not valid</h1><p className="text-[13px] text-muted mt-1">The link may have been copied incompletely. Please use the link in the email from Amber Sourcing, or reply to that email.</p></div>,
  )

  const valid = !!commodity && !!subject.trim() && body.trim().length >= 10 && !!contact.trim() && (scope === 'Open idea' || chosen.length > 0)
  const submit = () => {
    const id = useStore.getState().submitPortalResponse({ supplierCode: code, commodity, type, scope, partCodes: chosen, subject, body, estSavingLakh: Number(est) || undefined, contactName: contact, batchId })
    if (id) { setSent(id); setSubject(''); setBody(''); setEst(''); setChosen([]) }
  }

  if (sent) return shell(
    <div className="grid gap-4 max-w-[640px] mx-auto">
      <div className="card p-7 text-center">
        <span className="h-14 w-14 rounded-full bg-emerald-600 text-white grid place-items-center mx-auto shadow-[0_8px_24px_-8px_rgb(5_150_105/.6)]"><Icon name="Check" size={28} strokeWidth={3} /></span>
        <h1 className="mt-3 text-[20px] font-bold text-ink">Thank you{contact ? `, ${contact.split(' ')[0]}` : ''} — Amber Sourcing has received it</h1>
        <p className="text-[13px] text-muted mt-1">Your reference is <b className="text-ink font-mono">{sent}</b> — quote it when you write to Amber about this.</p>
        <Button className="mt-4" icon="Plus" onClick={() => setSent(null)}>Send another idea</Button>
      </div>
      <div className="card p-5">
        <div className="text-[13px] font-bold text-ink mb-2">What happens next</div>
        <ol className="grid gap-2 text-[13px] text-ink-2">
          {['Amber Sourcing reads every submission and shares it with the right buyer and engineers.', 'If it moves ahead, the buyer contacts you for drawings, samples or a quotation.', 'Sending an idea carries no commitment from either side.'].map((t, k) => (
            <li key={t} className="flex gap-2.5"><span className="h-5 w-5 rounded-full bg-[#1b2f63] text-white text-[11px] font-bold grid place-items-center shrink-0 mt-px">{k + 1}</span>{t}</li>
          ))}
        </ol>
      </div>
    </div>,
  )

  return shell(
    <div className="grid gap-4">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-[#1b2f63]/[.07] text-[#1b2f63] font-semibold"><Icon name="Megaphone" size={13} />{batch ? (batch.name ?? batch.templateName) : 'Supplier ideas for Amber'}</span>
        </div>
        <h1 className="text-[22px] sm:text-[24px] font-extrabold text-ink mt-2 tracking-tight">Share an idea with Amber</h1>
        <p className="text-[13.5px] text-ink-2 mt-0.5">For <b className="text-ink">{sup.name}</b>{sup.contactName ? ` · ${sup.contactName}` : ''} · vendor code {sup.code}</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          <Fact icon="Boxes" label="Commodities">{comms.map(nameOf).join(', ') || '—'}</Fact>
          <Fact icon="CalendarCheck" label={batch?.workshopDate ? 'Workshop' : 'Please send by'}>{batch?.workshopDate ? fmtDate(batch.workshopDate) : batch?.replyBy ? fmtDate(batch.replyBy) : 'Any time'}</Fact>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-slate-100 text-ink-2"><Icon name="Timer" size={12} />About 3 minutes</span>
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-emerald-50 text-emerald-800"><Icon name="ShieldCheck" size={12} />Goes to Amber Sourcing only · no commitment</span>
        </div>
      </section>

      <section className="card p-5 sm:p-6 grid gap-6">
        <FormStep n={1} title="What are you sending?" hint="An idea, a problem in the current supply, or a complaint" done={!!type && !!commodity && (scope === 'Open idea' || chosen.length > 0)}>
        <Field label="Type" required>
          <div className="grid sm:grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setType(t.key)} className={cn('text-left rounded-xl border-2 px-3 py-2.5 transition-colors', type === t.key ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-slate-300')}>
                <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink"><Icon name={t.icon} size={15} className="text-brand-600" />{t.label}</div>
                <div className="text-[11.5px] text-muted mt-0.5 leading-snug">{t.hint}</div>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Commodity" required>
            <select className="input" value={commodity} onChange={(e) => { setCommodity(e.target.value); setChosen([]) }}>
              {comms.map((c) => <option key={c} value={c}>{nameOf(c)}</option>)}
            </select>
          </Field>
          <Field label="Applies to" required>
            <div className="grid grid-cols-2 gap-2">
              {(['Open idea', 'Specific parts'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)} className={cn('h-10 rounded-xl border text-[13px] font-semibold', scope === s ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>{s === 'Open idea' ? 'Any part / general' : 'Specific parts'}</button>
              ))}
            </div>
          </Field>
        </div>
        {scope === 'Specific parts' && (
          <Field label="Your parts" required hint="Parts you supply to Amber in this commodity">
            {myParts.length ? (
              <div className="grid sm:grid-cols-2 gap-1.5">
                {myParts.map((p) => {
                  const on = chosen.includes(p.code)
                  return (
                    <label key={p.code} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-[12.5px]', on ? 'border-brand-500 bg-brand-50' : 'border-line bg-white')}>
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on} onChange={() => setChosen((x) => (on ? x.filter((y) => y !== p.code) : [...x, p.code]))} />
                      <span className="min-w-0"><span className="font-mono font-semibold">{p.code}</span><span className="block text-muted truncate">{p.description}</span></span>
                    </label>
                  )
                })}
              </div>
            ) : <div className="text-[12.5px] text-muted">No parts on record for you in this commodity — choose “Any part / general”.</div>}
          </Field>
        )}
        </FormStep>
        <div className="h-px bg-line" />
        <FormStep n={2} title="Your idea" hint="What changes, why it costs less or works better, what trials or approvals it needs" done={!!subject.trim() && body.trim().length >= 10}>
        <Field label="Title" required><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Replace Zn-Ni plating with Zn-flake coating on the M6 flange bolt" /></Field>
        <Field label="Describe it" required hint={body.trim().length < 10 ? 'At least a sentence or two' : undefined}><textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Zn-flake gives the same 720 h salt-spray at a lower cost; we can run a 500-piece trial in 3 weeks" /></Field>
        <Field label="Estimated saving to Amber a year (optional)"><div className="relative sm:max-w-[280px]"><input type="number" min="0" step="0.5" className="input num" style={{ paddingRight: 64 }} aria-label="Estimated saving" value={est} onChange={(e) => setEst(e.target.value)} placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">₹ lakh</span></div></Field>
        </FormStep>
        <div className="h-px bg-line" />
        <FormStep n={3} title="Your details" done={!!contact.trim()}>
          <div className="sm:max-w-[360px]"><Field label="Your name" required><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></Field></div>
        </FormStep>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 pt-1">
          <span className="text-[12px] text-muted flex-1">{valid ? <span className="text-emerald-700 font-semibold inline-flex items-center gap-1"><Icon name="CircleCheck" size={14} />Ready to send</span> : 'Fill the type, a title, a short description and your name'}</span>
          <Button variant="primary" icon="Send" disabled={!valid} onClick={submit} className="sm:min-w-[200px] justify-center">Send to Amber</Button>
        </div>
      </section>

    </div>,
  )
}
