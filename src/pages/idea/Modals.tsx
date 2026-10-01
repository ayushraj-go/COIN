// Action dialogs shared by the Idea 360 page, the side panel and the Kanban board.
import { useEffect, useMemo, useState } from 'react'
import type { Idea, IdeaPart } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { Button, Field, Icon, Modal, Money, Segmented, SourceTag, Avatar, cn } from '../../components/ui'
import { ideaAnnualised, ideaCommitted, partAnnualised } from '../../lib/calc'
import { inrPrice, inrShort, monthLong, num, sum, todayIso } from '../../lib/format'
import { stagesOf, withUndo, BASELINE_TAG, VOLUME_TAG } from './model'

const t = () => useStore.getState().toast

// ─── Drop (reason code + mandatory remarks) ──────────────────────────────────
export function DropModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const reasons = useStore((s) => s.dropReasons)
  const dropIdea = useStore((s) => s.dropIdea)
  const fy = useStore((s) => s.settings.currentFy)
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) { setReason(''); setRemarks('') } }, [open])
  const committed = ideaCommitted(idea, fy)
  const submit = () => {
    dropIdea(idea.id, reason, remarks.trim())
    t()(`${idea.id} dropped — ${reason}`, 'warning')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Drop idea" subtitle={`${idea.id} · ${idea.title}`} icon="CircleX" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" icon="CircleX" disabled={!reason || !remarks.trim()} onClick={submit}>Drop idea</Button></>}>
      <div className="space-y-3">
        <Field label="Reason code" required>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Remarks" required hint="Mandatory on every drop — feeds the Drop analysis report.">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why is this idea being dropped?" />
        </Field>
        <div className={cn('rounded-lg border p-2.5 text-[12px] flex gap-2', committed > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-slate-50 border-line text-muted')}>
          <Icon name={committed > 0 ? 'TriangleAlert' : 'Info'} size={14} className="shrink-0 mt-px" />
          <span>
            {committed > 0
              ? <>{inrShort(committed)} committed for {fy} will be removed from committed savings; the drop is counted in {monthLong(todayIso().slice(0, 7))}.</>
              : <>Pipeline value of {inrShort(ideaAnnualised(idea))} leaves the funnel; the drop is counted in {monthLong(todayIso().slice(0, 7))}.</>}
          </span>
        </div>
      </div>
    </Modal>
  )
}

// ─── Mark Done (effective date + approved new price per part) ────────────────
const defaultApproved = (idea: Idea, p: IdeaPart) => {
  if (p.approvedPrice != null) return p.approvedPrice
  if (idea.parts.length === 1 && idea.feasibility?.offeredPrice) return idea.feasibility.offeredPrice
  return p.newPrice
}
export function MarkDoneModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const markDone = useStore((s) => s.markDone)
  const [date, setDate] = useState(todayIso())
  const [prices, setPrices] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) { setDate(todayIso()); setPrices(Object.fromEntries(idea.parts.map((p) => [p.partCode, String(defaultApproved(idea, p))]))) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const papApproved = idea.papStatus === 'Price approved'
  const parsed = Object.fromEntries(idea.parts.map((p) => [p.partCode, Number(prices[p.partCode])]))
  const valid = !!date && idea.parts.every((p) => Number(prices[p.partCode]) > 0)
  const approvedAnnual = idea.parts.length ? sum(idea.parts.map((p) => (p.baselinePrice - (parsed[p.partCode] || 0)) * p.annualVolume)) : ideaAnnualised(idea)
  const submit = () => {
    markDone(idea.id, date, parsed)
    t()(`${idea.id} marked Implemented — ${inrShort(approvedAnnual)} annualised at approved price`, 'success')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Mark Done — Implemented" subtitle={`${idea.id} · ${idea.title}`} icon="CircleCheckBig" size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="success" icon="CircleCheckBig" disabled={!valid} onClick={submit}>Mark Done</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Effective date" required hint="Realisation counts MRN received from this date.">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Approved annualised impact</div>
            <div className="text-[22px] font-bold text-ink leading-tight"><Money value={approvedAnnual} /></div>
          </div>
          <div className="text-right text-[11.5px] text-muted">Estimated<br /><span className="font-semibold text-ink-2 num">{inrShort(ideaAnnualised(idea))}</span></div>
        </div>
      </div>
      {idea.parts.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Baseline</th><th style={{ textAlign: 'right' }}>Estimated new</th><th style={{ textAlign: 'right', width: 170 }}>Approved new price</th><th style={{ textAlign: 'right' }}>Annualised</th></tr></thead>
            <tbody>
              {idea.parts.map((p) => {
                const ap = Number(prices[p.partCode]) || 0
                const ann = (p.baselinePrice - ap) * p.annualVolume
                return (
                  <tr key={p.partCode}>
                    <td><div className="font-mono text-[12px] font-semibold">{p.partCode}</div><div className="text-[11.5px] text-muted truncate max-w-[220px]">{p.description}</div></td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.baselinePrice)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.newPrice)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1.5">
                        {papApproved && <SourceTag color="#0f9f6e">from PAP</SourceTag>}
                        <input type="number" step="0.01" min="0" className="input num text-right !h-8 w-28" value={prices[p.partCode] ?? ''} onChange={(e) => setPrices((x) => ({ ...x, [p.partCode]: e.target.value }))} />
                      </div>
                    </td>
                    <td className={cn('num font-semibold', ann < 0 && 'text-red-600')} style={{ textAlign: 'right' }}>{inrShort(ann)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-line p-3 text-[12.5px] text-muted">Open idea without part codes — the estimate of {inrShort(ideaAnnualised(idea))} is carried as the implemented value.</div>
      )}
      <p className="text-[11.5px] text-muted mt-3 flex items-start gap-1.5"><Icon name="Info" size={13} className="shrink-0 mt-px" />Mark Done needs the effective date and the approved new price (auto-pulled from PAP when linked). Approved values are locked after this step.</p>
    </Modal>
  )
}

// ─── Feasibility (supplier, or buyer on behalf) ───────────────────────────────
export function FeasibilityModal({ idea, open, onClose, onBehalf }: { idea: Idea; open: boolean; onClose: () => void; onBehalf: boolean }) {
  const respond = useStore((s) => s.respondFeasibility)
  const suppliers = useStore((s) => s.suppliers)
  const [feasible, setFeasible] = useState('yes')
  const [price, setPrice] = useState('')
  const [lead, setLead] = useState('')
  const [moq, setMoq] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) { setFeasible('yes'); setPrice(idea.parts[0] ? String(idea.parts[0].newPrice) : ''); setLead('30'); setMoq(''); setRemarks('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const supCode = idea.feasibility?.supplierCode ?? idea.proposedSupplier?.code ?? idea.supplierCode
  const sup = suppliers.find((s) => s.code === supCode)
  const yes = feasible === 'yes'
  const valid = yes ? (idea.parts.length === 0 || Number(price) > 0) && Number(lead) > 0 : !!remarks.trim()
  const stages = stagesOf(idea)
  const next = stages[stages.indexOf(idea.stage) + 1]
  const submit = () => {
    const payload = { feasible: yes, offeredPrice: price ? Number(price) : undefined, leadTimeDays: lead ? Number(lead) : undefined, moq: moq ? Number(moq) : undefined, remarks: remarks.trim() || undefined, onBehalf }
    if (yes) withUndo(idea.id, () => respond(idea.id, payload), `Feasibility confirmed${onBehalf ? ' on behalf of supplier' : ''} — ${idea.id} moved to ${next}`)
    else { respond(idea.id, payload); t()(`${idea.id} dropped — supplier not feasible`, 'warning') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={onBehalf ? 'Respond feasibility on behalf of supplier' : 'Respond to feasibility request'} subtitle={`${idea.id} · ${sup ? `${sup.name} (${sup.code})` : supCode ?? 'Supplier'}`} icon="ClipboardCheck" size="md"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={yes ? 'primary' : 'danger'} icon={yes ? 'Send' : 'CircleX'} disabled={!valid} onClick={submit}>{yes ? 'Confirm feasibility' : 'Decline — not feasible'}</Button></>}>
      <div className="space-y-3">
        <Segmented value={feasible} onChange={setFeasible} options={[{ key: 'yes', label: 'Feasible', icon: 'CircleCheck' }, { key: 'no', label: 'Not feasible', icon: 'CircleX' }]} />
        {yes && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={`Offered price (₹${idea.parts[0] ? ' / ' + idea.parts[0].uom : ''})`} required={idea.parts.length > 0} tag={idea.parts[0] ? <SourceTag>Baseline {inrPrice(idea.parts[0].baselinePrice)}</SourceTag> : undefined}>
              <input type="number" step="0.01" className="input num" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Lead time (days)" required><input type="number" className="input num" value={lead} onChange={(e) => setLead(e.target.value)} /></Field>
            <Field label="MOQ"><input type="number" className="input num" value={moq} onChange={(e) => setMoq(e.target.value)} placeholder="e.g. 5000" /></Field>
          </div>
        )}
        <Field label="Remarks" required={!yes} hint={yes ? undefined : 'Mandatory — the idea is dropped with reason “Supplier not feasible”.'}>
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={yes ? 'Validity of price, conditions…' : 'Why is the change not feasible?'} />
        </Field>
        {onBehalf && <p className="text-[11.5px] text-muted flex items-center gap-1.5"><Icon name="Info" size={13} />Logged as “on behalf” of the supplier in the audit trail.</p>}
      </div>
    </Modal>
  )
}

// ─── Technical evaluation (go / no-go + validation plan) ──────────────────────
export function TechEvalModal({ idea, open, onClose, initial }: { idea: Idea; open: boolean; onClose: () => void; initial: 'Go' | 'No-go' }) {
  const techEvaluate = useStore((s) => s.techEvaluate)
  const [decision, setDecision] = useState<string>(initial)
  const [plan, setPlan] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) { setDecision(initial); setPlan(''); setRemarks('') } }, [open, initial])
  const go = decision === 'Go'
  const valid = go ? !!plan.trim() : !!remarks.trim()
  const stages = stagesOf(idea)
  const next = stages[stages.indexOf(idea.stage) + 1]
  const submit = () => {
    if (go) withUndo(idea.id, () => techEvaluate(idea.id, 'Go', plan.trim(), remarks.trim() || undefined), `Technical go recorded — ${idea.id} moved to ${next}`)
    else { techEvaluate(idea.id, 'No-go', plan.trim(), remarks.trim()); t()(`${idea.id} rejected — technical no-go`, 'warning') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Technical evaluation" subtitle={`${idea.id} · ${idea.techEval?.evaluatorDept ?? 'R&D'} · ${idea.stage}`} icon="FlaskConical" size="md"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={go ? 'success' : 'danger'} icon={go ? 'CircleCheck' : 'CircleX'} disabled={!valid} onClick={submit}>{go ? 'Record Go' : 'Record No-go'}</Button></>}>
      <div className="space-y-3">
        <Segmented value={decision} onChange={setDecision} options={[{ key: 'Go', label: 'Go', icon: 'CircleCheck' }, { key: 'No-go', label: 'No-go', icon: 'CircleX' }]} />
        <Field label="Validation plan" required={go} hint="Lab tests, pilot build, field audit — carried into NPD sampling.">
          <textarea className="input" rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="e.g. Salt spray 240 h + thermal cycling; 200-unit pilot build; field audit after 30 days" />
        </Field>
        <Field label="Remarks" required={!go} hint={go ? undefined : 'Mandatory on a no-go — the idea is rejected.'}>
          <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={go ? 'Optional remarks' : 'Why is the change not acceptable?'} />
        </Field>
      </div>
    </Modal>
  )
}

// ─── Reassign (owner / validating buyer) ──────────────────────────────────────
export function ReassignModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const users = useStore((s) => s.users)
  const reassign = useStore((s) => s.reassign)
  const current = idea.ownerId ?? idea.buyerId
  const candidates = useMemo(() => users.filter((u) => u.active && u.id !== current && ((u.roles.some((r) => r === 'buyer' || r === 'lead') && u.commodities.includes(idea.commodity)) || u.roles.includes('head'))), [users, current, idea.commodity])
  const [to, setTo] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) { setTo(''); setRemarks('') } }, [open])
  const target = users.find((u) => u.id === to)
  const submit = () => {
    withUndo(idea.id, () => reassign(idea.id, to, remarks.trim()), `${idea.id} reassigned to ${target?.name}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Reassign idea" subtitle={`${idea.id} · currently with ${users.find((u) => u.id === current)?.name ?? '—'}`} icon="UserRoundCog" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="UserRoundCog" disabled={!to || !remarks.trim()} onClick={submit}>Reassign</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-1.5 max-h-56 overflow-y-auto">
          {candidates.map((u) => (
            <button key={u.id} onClick={() => setTo(u.id)} className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition', to === u.id ? 'border-brand-300 bg-brand-50' : 'border-line hover:bg-slate-50')}>
              <Avatar name={u.name} color={u.avatarColor} size={26} />
              <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold truncate">{u.name}</span><span className="block text-[11px] text-muted truncate">{u.designation}</span></span>
              {to === u.id && <Icon name="Check" size={15} className="text-brand-600" />}
            </button>
          ))}
          {!candidates.length && <div className="text-[12.5px] text-muted p-3 text-center">No other buyer or lead is mapped to this commodity.</div>}
        </div>
        <Field label="Remarks" required><textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for reassignment" /></Field>
      </div>
    </Modal>
  )
}

// ─── Baseline / volume override (buyer, mandatory reason, logged) ────────────
export function OverrideModal({ idea, part, field, open, onClose }: { idea: Idea; part: IdeaPart | null; field: 'baselinePrice' | 'annualVolume'; open: boolean; onClose: () => void }) {
  const overrideBaseline = useStore((s) => s.overrideBaseline)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => { if (open && part) { setValue(String(part[field])); setReason('') } }, [open, part, field])
  if (!part) return null
  const isPrice = field === 'baselinePrice'
  const nv = Number(value)
  const before = partAnnualised(part)
  const after = partAnnualised({ ...part, [field]: nv })
  const changed = nv > 0 && nv !== part[field]
  const tag = isPrice ? BASELINE_TAG[part.baselineSource] : VOLUME_TAG[part.volumeSource]
  const submit = () => {
    withUndo(idea.id, () => overrideBaseline(idea.id, part.partCode, field, nv, reason.trim()), `${isPrice ? 'Baseline price' : 'Annual volume'} overridden on ${part.partCode} — logged in the audit trail`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={isPrice ? 'Override baseline price' : 'Override annual volume'} subtitle={`${part.partCode} · ${part.description}`} icon="PencilLine" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!changed || !reason.trim()} onClick={submit}>Save override</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current" tag={<SourceTag color={tag.color}>{tag.label}</SourceTag>}>
            <div className="input flex items-center num bg-slate-50 text-muted">{isPrice ? inrPrice(part[field]) : `${num(part[field])} ${part.uom}`}</div>
          </Field>
          <Field label={isPrice ? `New baseline (₹ / ${part.uom})` : `New volume (${part.uom})`} required>
            <input autoFocus type="number" step={isPrice ? '0.01' : '1'} className="input num" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
        <Field label="Reason" required hint="Every override is logged with user, time, old and new value.">
          <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isPrice ? 'e.g. LBP includes one-off expedite surcharge' : 'e.g. Model phased out; FY27 forecast lower'} />
        </Field>
        <div className="rounded-lg bg-slate-50 border border-line p-2.5 text-[12px] flex items-center justify-between">
          <span className="text-muted">Annualised impact for this part</span>
          <span className="num font-semibold">{inrShort(before)} <Icon name="ArrowRight" size={12} className="inline mx-1 text-muted" /> <span className={after < 0 ? 'text-red-600' : 'text-ink'}>{changed ? inrShort(after) : '—'}</span></span>
        </div>
      </div>
    </Modal>
  )
}

