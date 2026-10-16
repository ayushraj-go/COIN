// Stage 3 — supplier capability check: pick a supplier, review the ready-made email (no Amber data), send it,
// and see the supplier's answer from the secure form (/supplier-form/:token).
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMe, useStore } from '../store/useStore'
import { canSeeIdea, ideaAnnualised } from '../lib/calc'
import { addDays, fmtDate, fmtDateTime, inrShort, todayIso } from '../lib/format'
import { amberDataLeaks, needsSupplierCheck, stageLabel, supplierCapabilityEmail, SUPPLIER_CHECK_MIN, SUPPLIER_LINK_PLACEHOLDER, SUPPLIER_SPEC_BY_GROUP } from '../lib/workflow'
import { STAGE } from '../lib/masters'
import { Badge, Button, Card, EmptyState, Field, Icon, PageHeader, cn } from '../components/ui'
import { SupplierResponseCard } from './idea/StageForms'
import { ideaPerms } from './idea/model'

export default function SupplierCheck() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const idea = useStore((s) => s.ideas.find((i) => i.id === id))
  const suppliers = useStore((s) => s.suppliers)
  const levers = useStore((s) => s.levers)
  const toast = useStore((s) => s.toast)
  const sc = idea?.evaluation?.supplier
  const lever = levers.find((l) => l.id === idea?.leverId)
  const current = new Set(idea?.parts.map((p) => p.currentSupplier.split(' · ')[0]) ?? [])
  const options = useMemo(() => suppliers.filter((s) => idea && s.commodities.includes(idea.commodity)), [suppliers, idea])
  const [code, setCode] = useState<string>('')
  const [other, setOther] = useState({ name: '', contactName: '', email: '' })
  const [item, setItem] = useState('')
  const [spec, setSpec] = useState('')
  const [requiredBy, setRequiredBy] = useState(addDays(todayIso(), 90))
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [touched, setTouched] = useState(false)

  const sup = code === 'other' ? { code: undefined, name: other.name, contactName: other.contactName, contactEmail: other.email } : suppliers.find((s) => s.code === code)
  useEffect(() => {
    if (!idea) return
    const alt = options.find((s) => s.code === idea.proposedSupplier?.code) ?? options.find((s) => !current.has(s.code)) ?? options[0]
    setCode(alt?.code ?? 'other')
    setItem(idea.parts[0]?.description ?? idea.title)
    setSpec(lever ? SUPPLIER_SPEC_BY_GROUP[lever.group] : '')
  }, [idea?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // regenerate the template until the evaluator edits it by hand
  useEffect(() => {
    if (touched || !sup) return
    const m = supplierCapabilityEmail({ supplierName: sup.name || 'your company', contactName: sup.contactName, item, spec, requiredBy, link: SUPPLIER_LINK_PLACEHOLDER, sender: `${me?.name ?? 'Sourcing'}, Amber Sourcing` })
    setSubject(m.subject); setBody(m.body)
  }, [code, other.name, other.contactName, item, spec, requiredBy, touched]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!idea) return <Card><EmptyState icon="SearchX" title={`Idea ${id} not found`} action={<Button onClick={() => nav('/ideas')}>Go to ideas</Button>} /></Card>
  if (!me || !canSeeIdea(me, idea)) return <Card><EmptyState icon="ShieldX" title="You don't have access to this idea" desc="Visibility follows your role and commodity mapping." action={<Button onClick={() => nav('/')}>Go home</Button>} /></Card>
  const mayEvaluate = ideaPerms(me, idea).evaluate
  const annual = ideaAnnualised(idea)
  // the recipient's own name is not Amber data
  const leaks = amberDataLeaks(`${subject}\n${body}\n${item}\n${spec}`, idea, suppliers, sup ? { code: sup.code, name: sup.name } : undefined)
  const canSend = mayEvaluate && !!sup?.name && !!sup.contactEmail && /@/.test(sup.contactEmail) && !!item.trim() && !!spec.trim() && !leaks.length && idea.stage === STAGE.evaluation
  const send = async () => {
    if (!sup) return
    const token = await useStore.getState().sendSupplierCheck(idea.id, { supplierCode: sup.code, supplierName: sup.name, contactName: sup.contactName, email: sup.contactEmail, item: item.trim(), spec: spec.trim(), requiredBy, subject, body })
    toast(`Capability request sent to ${sup.name} — form link ${token}`, 'success')
  }
  const formUrl = sc?.token ? `/supplier-form/${sc.token}` : null

  return (
    <div className="pb-8">
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted mb-2">
        <button onClick={() => nav(`/ideas/${idea.id}`)} className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-lg hover:bg-white hover:text-ink font-medium"><Icon name="ChevronLeft" size={15} />{idea.id}</button>
        <span className="text-slate-300">/</span><span className="text-ink font-semibold">Supplier capability check</span>
      </div>
      <PageHeader icon="Factory" title="Supplier capability check" fit
        badge={<Badge color={sc?.status === 'Responded' ? 'var(--color-emerald-600)' : sc?.status === 'Sent' ? 'var(--color-orange-400)' : 'var(--color-slate-500)'}>{sc?.status ?? 'Not sent'}</Badge>}
        subtitle={`${stageLabel(idea, STAGE.evaluation)} · ${idea.title} · annualised ${inrShort(annual)}`}
        actions={<Button size="sm" icon="FlaskConical" onClick={() => nav(`/ideas/${idea.id}`)}>Back to the idea</Button>} />

      {!needsSupplierCheck(annual) || sc?.status === 'Skipped' ? (
        <Card><EmptyState icon="SkipForward" title="Skipped — below the minimum saving threshold" desc={`Annualised ${inrShort(annual)} is below ${inrShort(SUPPLIER_CHECK_MIN)}; this idea goes to approval without a supplier capability check.`} /></Card>
      ) : sc?.status === 'Sent' || sc?.status === 'Responded' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
          <Card title={sc.status === 'Responded' ? 'Supplier response' : 'Waiting for the supplier'} icon={sc.status === 'Responded' ? 'MailCheck' : 'MailQuestion'}
            subtitle={`${sc.supplierName} · ${sc.email} · sent ${fmtDateTime(sc.sentAt)} by ${sc.sentBy}`}>
            {sc.status === 'Responded' ? <SupplierResponseCard idea={idea} /> : (
              <div className="grid gap-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-900 flex gap-2"><Icon name="Clock3" size={15} className="shrink-0 mt-px" />The supplier answers on the secure form. Their response appears here and on the idea page; the evaluation can then be recommended.</div>
                {formUrl && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" icon="ExternalLink" onClick={() => window.open(formUrl, '_blank')}>Open the supplier form (demo)</Button>
                    <Button icon="Copy" onClick={() => { navigator.clipboard?.writeText(window.location.origin + formUrl); toast('Supplier form link copied', 'info') }}>Copy link</Button>
                    <span className="text-[11.5px] text-muted">In the demo the supplier form opens in this browser.</span>
                  </div>
                )}
              </div>
            )}
          </Card>
          <EmailPreview subject={sc.subject ?? ''} body={sc.body ?? ''} to={`${sc.contactName} <${sc.email}>`} readOnly />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_480px] gap-4 items-start">
          <Card title="Request" icon="ClipboardList" subtitle="Who receives it and what is asked">
            <div className="grid gap-3">
              <Field label="Supplier" required>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {options.map((s) => (
                    <button key={s.code} type="button" onClick={() => { setCode(s.code); setTouched(false) }} className={cn('text-left rounded-xl border px-3 py-2 transition-colors', code === s.code ? 'border-brand-500 bg-brand-50' : 'border-line bg-white hover:border-slate-300')}>
                      <div className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-ink truncate">{s.name}</span>{s.tier && <Badge color={s.tier === 'Tier 1' ? 'var(--color-brand-700)' : 'var(--color-slate-500)'}>{s.tier}</Badge>}</div>
                      <div className="text-[11.5px] text-muted truncate">{s.code} · {s.city} · {s.contactName}{current.has(s.code) ? ' · current supplier' : ''}</div>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setCode('other'); setTouched(false) }} className={cn('text-left rounded-xl border px-3 py-2', code === 'other' ? 'border-brand-500 bg-brand-50' : 'border-dashed border-line bg-white hover:border-slate-300')}>
                    <div className="text-[13px] font-semibold text-ink">Another vendor</div><div className="text-[11.5px] text-muted">Not in the vendor master yet</div>
                  </button>
                </div>
              </Field>
              {code === 'other' && (
                <div className="grid sm:grid-cols-3 gap-2">
                  <Field label="Company" required><input className="input" value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })} /></Field>
                  <Field label="Contact" required><input className="input" value={other.contactName} onChange={(e) => setOther({ ...other, contactName: e.target.value })} /></Field>
                  <Field label="Email" required><input className="input" type="email" value={other.email} onChange={(e) => setOther({ ...other, email: e.target.value })} /></Field>
                </div>
              )}
              <Field label="Item (generic description)" required hint="No part code — describe the item the way any vendor would understand it"><input className="input" value={item} onChange={(e) => { setItem(e.target.value); setTouched(false) }} /></Field>
              <Field label="Specification summary" required hint="Technical requirement only — no prices, volumes or current supplier"><textarea className="input" rows={3} value={spec} onChange={(e) => { setSpec(e.target.value); setTouched(false) }} /></Field>
              <Field label="Required by"><input type="date" className="input" value={requiredBy} onChange={(e) => { setRequiredBy(e.target.value); setTouched(false) }} /></Field>
            </div>
          </Card>
          <div className="grid gap-3">
            <EmailPreview subject={subject} body={body} to={sup ? `${sup.contactName || '—'} <${sup.contactEmail || '—'}>` : '—'} onSubject={(v) => { setSubject(v); setTouched(true) }} onBody={(v) => { setBody(v); setTouched(true) }} />
            {leaks.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12.5px] text-red-800">
                <div className="font-semibold flex items-center gap-1.5 mb-1"><Icon name="ShieldAlert" size={15} />Remove Amber data before sending</div>
                <ul className="list-disc pl-5 space-y-0.5">{leaks.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] text-emerald-800 flex items-center gap-1.5"><Icon name="ShieldCheck" size={15} />No Amber data in this email — no part codes, prices, volumes or current suppliers.</div>
            )}
            <div className="flex justify-end gap-2">
              {touched && <Button variant="ghost" icon="RotateCcw" onClick={() => setTouched(false)}>Reset template</Button>}
              <Button variant="primary" icon="Send" disabled={!canSend} onClick={send}>Send capability request</Button>
            </div>
            {idea.stage !== STAGE.evaluation && <div className="text-[12px] text-muted text-right">Requests can be sent while the idea is in evaluation.</div>}
            {idea.stage === STAGE.evaluation && !mayEvaluate && <div className="text-[12px] text-muted text-right">Only the {stageLabel(idea, STAGE.evaluation)} team or the Sourcing Head can send this request.</div>}
          </div>
        </div>
      )}
      <div className="mt-4 text-[11.5px] text-muted"><Link to={`/ideas/${idea.id}`} className="hover:text-brand-700">← Back to {idea.id}</Link></div>
    </div>
  )
}

function EmailPreview({ subject, body, to, readOnly, onSubject, onBody }: { subject: string; body: string; to: string; readOnly?: boolean; onSubject?: (v: string) => void; onBody?: (v: string) => void }) {
  return (
    <Card title="Email" icon="Mail" subtitle={readOnly ? 'As sent' : 'Ready-made template — edit if needed'} pad={false}>
      <div className="px-4 pb-4 grid gap-2">
        <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-2 text-[12.5px]"><span className="text-muted">To</span><span className="font-medium text-ink truncate">{to}</span></div>
        <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-2 text-[12.5px]"><span className="text-muted">Subject</span>
          {readOnly ? <span className="font-semibold text-ink">{subject}</span> : <input className="input !h-8" value={subject} onChange={(e) => onSubject?.(e.target.value)} />}
        </div>
        {readOnly ? <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-2 rounded-lg bg-slate-50 border border-line p-3">{body}</pre>
          : <textarea className="input font-[inherit] text-[12.5px] leading-relaxed" rows={16} value={body} onChange={(e) => onBody?.(e.target.value)} />}
      </div>
    </Card>
  )
}
