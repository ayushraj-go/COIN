// Action dialogs shared by the Idea 360 page, the side panel and the Kanban board.
import { useEffect, useMemo, useState } from 'react'
import type { Idea, IdeaPart } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { Button, Field, Icon, Modal, Money, Segmented, SourceTag, Avatar, cn } from '../../components/ui'
import { ideaAnnualised, ideaCommitted, partAnnualised } from '../../lib/calc'
import { inrPrice, inrShort, monthLong, num, sum, todayIso } from '../../lib/format'
import { withUndo, BASELINE_TAG, VOLUME_TAG } from './model'

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
        <Field label="Remarks" required hint="Mandatory on every drop — feeds the Drop analysis report. A dropped idea can never be reopened; a fresh attempt needs a new idea.">
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

// ─── Hand over for verification (first MRN date + approved new price per part) ─
const defaultApproved = (p: IdeaPart) => p.approvedPrice ?? p.newPrice
export function MarkDoneModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const handOver = useStore((s) => s.handOverForVerification)
  const [date, setDate] = useState(todayIso())
  const [prices, setPrices] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) { setDate(idea.execution?.effectiveDate ?? todayIso()); setPrices(Object.fromEntries(idea.parts.map((p) => [p.partCode, String(defaultApproved(p))]))) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const papApproved = idea.papStatus === 'Price approved'
  const parsed = Object.fromEntries(idea.parts.map((p) => [p.partCode, Number(prices[p.partCode])]))
  const valid = !!date && idea.parts.every((p) => Number(prices[p.partCode]) > 0)
  const approvedAnnual = idea.parts.length ? sum(idea.parts.map((p) => (p.baselinePrice - (parsed[p.partCode] || 0)) * p.annualVolume)) : ideaAnnualised(idea)
  const submit = () => {
    handOver(idea.id, date, parsed)
    t()(`${idea.id} implemented and handed for verification — ${inrShort(approvedAnnual)} annualised at the approved price`, 'success')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Hand over for verification" subtitle={`${idea.id} · ${idea.title}`} icon="PackageCheck" size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="success" icon="PackageCheck" disabled={!valid} onClick={submit}>Hand over</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="First MRN at the new price" required hint="Effective date — MRN savings count from this date.">
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
                        {papApproved && <SourceTag color="var(--color-emerald-600)">from PAP</SourceTag>}
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
      <p className="text-[11.5px] text-muted mt-3 flex items-start gap-1.5"><Icon name="Info" size={13} className="shrink-0 mt-px" />Hand-over closes Execution started: first MRN, implementation confirmed and hand-over milestones are ticked, approved prices are locked, and the business side verifies the savings in Verification.</p>
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

