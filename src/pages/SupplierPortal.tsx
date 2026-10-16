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
import { CoinMark } from '../components/Logo'

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

  const shell = (children: React.ReactNode) => (
    <div className="min-h-full bg-[var(--color-slate-100)]">
      <header className="bg-white border-b border-line">
        <div className="max-w-[820px] mx-auto px-4 h-14 flex items-center gap-2.5">
          <CoinMark size={30} />
          <div className="leading-tight"><div className="text-[14px] font-bold text-ink">Amber Supplier Portal</div><div className="text-[11.5px] text-muted">Share ideas with Amber Sourcing · no login needed</div></div>
        </div>
      </header>
      <main className="max-w-[820px] mx-auto px-4 py-6">{children}</main>
    </div>
  )

  if (!sup) return shell(
    <div className="card p-8 text-center"><Icon name="LinkOff" size={28} className="mx-auto text-muted" /><h1 className="mt-3 text-[18px] font-bold text-ink">This link is not valid</h1><p className="text-[13px] text-muted mt-1">The link may have been copied incompletely. Please use the link in the email from Amber Sourcing, or reply to that email.</p></div>,
  )

  const valid = !!commodity && !!subject.trim() && body.trim().length >= 10 && !!contact.trim() && (scope === 'Open idea' || chosen.length > 0)
  const submit = () => {
    const id = useStore.getState().submitPortalResponse({ supplierCode: code, commodity, type, scope, partCodes: chosen, subject, body, estSavingLakh: Number(est) || undefined, contactName: contact, batchId })
    if (id) { setSent(id); setSubject(''); setBody(''); setEst(''); setChosen([]) }
  }

  if (sent) return shell(
    <div className="card p-8 text-center">
      <span className="h-12 w-12 rounded-full bg-emerald-600 text-white grid place-items-center mx-auto"><Icon name="Check" size={24} strokeWidth={3} /></span>
      <h1 className="mt-3 text-[19px] font-bold text-ink">Thank you — Amber Sourcing has received it</h1>
      <p className="text-[13px] text-muted mt-1">Reference <b className="text-ink font-mono">{sent}</b>. The sourcing team reviews every submission and contacts you if it moves ahead.</p>
      <Button className="mt-4" icon="Plus" onClick={() => setSent(null)}>Send another</Button>
    </div>,
  )

  return shell(
    <div className="grid gap-4">
      <section className="card p-5">
        <div className="text-[12px] text-muted">For <b className="text-ink">{sup.name}</b>{sup.contactName ? ` · ${sup.contactName}` : ''} · vendor code {sup.code}</div>
        <h1 className="text-[20px] font-bold text-ink mt-1">Send your idea to Amber</h1>
        <p className="text-[13px] text-ink-2 mt-1">{batch ? <>For <b>{batch.name ?? batch.templateName}</b>{batch.replyBy ? <> · please send by <b>{fmtDate(batch.replyBy)}</b></> : null}{batch.workshopDate ? <> · workshop on <b>{fmtDate(batch.workshopDate)}</b></> : null}. </> : null}Commodities: {comms.map(nameOf).join(', ') || '—'}.</p>
      </section>

      <section className="card p-5 grid gap-4">
        <Field label="What are you sending?" required>
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
        <Field label="Title" required><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Replace Zn-Ni plating with Zn-flake coating on the M6 flange bolt" /></Field>
        <Field label="Describe it" required hint="What changes, why it is cheaper or better, what trials or approvals it needs"><textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Estimated saving to Amber a year (₹ lakh, optional)"><input type="number" min="0" step="0.5" className="input num" value={est} onChange={(e) => setEst(e.target.value)} /></Field>
          <Field label="Your name" required><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11.5px] text-muted">Sent to Amber Sourcing only. It carries no commitment from either side.</span>
          <Button variant="primary" icon="Send" disabled={!valid} onClick={submit}>Send to Amber</Button>
        </div>
      </section>

    </div>,
  )
}
