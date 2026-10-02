// M8 — Execution Hub row actions: Update progress, Add milestone note, Mark Done, Drop, due-date change (slippage),
// inline quarter phasing and NPD / PAP status sync (Section 9)
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { Idea } from '../../lib/types'
import { Badge, Button, Field, Icon, InfoTip, Modal, SourceTag, Toggle, cn } from '../../components/ui'
import { committedInFy, carryOver, ideaAnnualised, ideaCommitted, phaseByQuarter } from '../../lib/calc'
import { daysBetween, fmtDate, inrPrice, inrShort, monthLong, num, sum, todayIso, ymOf, QUARTER_MONTHS } from '../../lib/format'
import { snapshot, toast } from './shared'

type Q = 'Q1' | 'Q2' | 'Q3' | 'Q4'
const QS: Q[] = ['Q1', 'Q2', 'Q3', 'Q4']

// ─── Update progress ──────────────────────────────────────────────────────────
export function ProgressModal({ idea, open, onClose }: { idea: Idea | null; open: boolean; onClose: () => void }) {
  const [v, setV] = useState(0)
  const [note, setNote] = useState('')
  useEffect(() => { if (open && idea?.execution) { setV(idea.execution.progress); setNote('') } }, [open, idea])
  if (!idea?.execution) return null
  const ms = idea.execution.milestones
  const fromMs = ms.length ? Math.round((ms.filter((m) => m.doneDate).length / ms.length) * 100) : 0
  const save = () => {
    const undo = snapshot([idea.id])
    const st = useStore.getState()
    st.updateExecution(idea.id, { progress: v })
    if (note.trim()) st.addExecutionNote(idea.id, `Progress ${v}% — ${note.trim()}`)
    toast(`${idea.id} progress updated to ${v}%`, 'success', undo)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Update progress" subtitle={`${idea.id} · ${idea.title}`} icon="Activity" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Check" onClick={save}>Save progress</Button></>}>
      <div className="grid gap-3">
        <div className="flex items-end justify-between"><span className="label !mb-0">Progress</span><span className="text-[26px] font-extrabold num text-ink leading-none">{v}%</span></div>
        <input type="range" min={0} max={100} step={5} value={v} onChange={(e) => setV(Number(e.target.value))} className="w-full accent-brand-600" />
        <div className="flex flex-wrap gap-1.5">
          {[0, 25, 50, 75, 90].map((p) => <button key={p} onClick={() => setV(p)} className={cn('h-7 px-2.5 rounded-md border text-[12px] font-semibold num', v === p ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line hover:bg-slate-50')}>{p}%</button>)}
          <button onClick={() => setV(fromMs)} className="h-7 px-2.5 rounded-md border border-line hover:bg-slate-50 text-[12px] font-semibold">From milestones · {fromMs}%</button>
        </div>
        <Field label="Progress note" hint="Optional — added to the execution notes and the activity log."><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier sample dispatched; NPD trial slot booked for 14 Oct" /></Field>
      </div>
    </Modal>
  )
}

// ─── Add milestone note ───────────────────────────────────────────────────────
export function MilestoneNoteModal({ idea, open, onClose, milestoneId }: { idea: Idea | null; open: boolean; onClose: () => void; milestoneId?: string }) {
  const [mid, setMid] = useState('')
  const [note, setNote] = useState('')
  const [markDone, setMarkDone] = useState(false)
  useEffect(() => {
    if (open && idea?.execution) { setMid(milestoneId ?? idea.execution.milestones.find((m) => !m.doneDate)?.id ?? idea.execution.milestones[0]?.id ?? ''); setNote(''); setMarkDone(false) }
  }, [open, idea, milestoneId])
  if (!idea?.execution) return null
  const m = idea.execution.milestones.find((x) => x.id === mid)
  const save = () => {
    if (!m) return
    const undo = snapshot([idea.id])
    const st = useStore.getState()
    if (markDone && !m.doneDate) st.toggleMilestone(idea.id, m.id, note.trim())
    else useStore.setState((s) => ({ ideas: s.ideas.map((i) => (i.id === idea.id && i.execution ? { ...i, execution: { ...i.execution, milestones: i.execution.milestones.map((x) => (x.id === m.id ? { ...x, note: note.trim() } : x)) } } : i)) }))
    st.addExecutionNote(idea.id, `${m.name}: ${note.trim()}`)
    toast(`Note added to “${m.name}”${markDone && !m.doneDate ? ' — milestone marked done' : ''}`, 'success', undo)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add milestone note" subtitle={`${idea.id} · ${idea.title}`} icon="StickyNote" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Check" disabled={!note.trim() || !m} onClick={save}>Add note</Button></>}>
      <div className="grid gap-3">
        <Field label="Milestone" required>
          <div className="grid gap-1">
            {idea.execution.milestones.map((x) => {
              const overdue = !x.doneDate && x.dueDate < todayIso()
              return (
                <button key={x.id} type="button" onClick={() => setMid(x.id)} className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[12.5px]', mid === x.id ? 'border-brand-300 bg-brand-50' : 'border-line hover:bg-slate-50')}>
                  <Icon name={x.doneDate ? 'CircleCheck' : overdue ? 'CircleAlert' : 'Circle'} size={15} className={x.doneDate ? 'text-emerald-600' : overdue ? 'text-red-600' : 'text-slate-400'} />
                  <span className="flex-1 font-medium">{x.name}</span>
                  <span className={cn('text-[11.5px] num', overdue ? 'text-red-600 font-semibold' : 'text-muted')}>{x.doneDate ? `done ${fmtDate(x.doneDate)}` : `due ${fmtDate(x.dueDate)}`}</span>
                </button>
              )
            })}
          </div>
        </Field>
        {m?.note && <div className="text-[12px] text-muted">Current note: “{m.note}”</div>}
        <Field label="Note" required><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened, what is next, who is waiting on whom" /></Field>
        {m && !m.doneDate && <Toggle checked={markDone} onChange={setMarkDone} label="Also mark this milestone done today" />}
      </div>
    </Modal>
  )
}

// ─── Mark Done: effective date + approved new price per part (auto-pulled from PAP when linked) ─
export function MarkDoneModal({ idea, open, onClose, fy }: { idea: Idea | null; open: boolean; onClose: () => void; fy: string }) {
  const [date, setDate] = useState(todayIso())
  const [prices, setPrices] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open && idea) { setDate(todayIso()); setPrices(Object.fromEntries(idea.parts.map((p) => [p.partCode, String(p.approvedPrice ?? p.newPrice)]))) }
  }, [open, idea])
  const linked = !!idea?.papRequestId
  const approvedParts = useMemo(() => (idea ? idea.parts.map((p) => ({ ...p, approvedPrice: Number(prices[p.partCode]) || p.newPrice })) : []), [idea, prices])
  if (!idea?.execution) return null
  const annual = idea.parts.length ? sum(approvedParts.map((p) => (p.baselinePrice - p.approvedPrice!) * p.annualVolume)) : ideaAnnualised(idea)
  const committed = committedInFy(annual, date, fy)
  const carry = carryOver(annual, date, fy)
  const valid = !!date && date >= idea.execution.startDate && approvedParts.every((p) => Number(prices[p.partCode]) > 0)
  const save = () => {
    useStore.getState().markDone(idea.id, date, Object.fromEntries(approvedParts.map((p) => [p.partCode, p.approvedPrice!])))
    toast(`${idea.id} marked Done — Implemented, effective ${fmtDate(date)}. Realisation starts with the next MRN run.`, 'success')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Mark Done — Implemented" subtitle={`${idea.id} · ${idea.title}`} icon="PartyPopper" size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="success" icon="CircleCheck" disabled={!valid} onClick={save}>Mark Done</Button></>}>
      <div className="grid gap-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Effective date" required hint={`Not before the start date (${fmtDate(idea.execution.startDate)}). Realised saving counts MRNs after this date.`}>
            <input type="date" className="input" value={date} min={idea.execution.startDate} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Linked PAP request" tag={linked ? <SourceTag color="#0f9f6e">Linked</SourceTag> : <SourceTag color="#94a3b8">Not linked</SourceTag>}>
            <div className="h-9 flex items-center gap-2 text-[12.5px]">{linked ? <><span className="font-mono">{idea.papRequestId}</span><Badge color={idea.papStatus === 'Price approved' ? '#0f9f6e' : '#ec8a1c'}>{idea.papStatus}</Badge></> : <span className="text-muted">Enter the approved price manually</span>}</div>
          </Field>
          <Field label="NPD request">
            <div className="h-9 flex items-center gap-2 text-[12.5px]">{idea.npdRequestId ? <><span className="font-mono">{idea.npdRequestId}</span><Badge color={idea.npdStatus === 'Sample approved' ? '#0f9f6e' : '#ec8a1c'}>{idea.npdStatus}</Badge></> : <span className="text-muted">Not required for this route</span>}</div>
          </Field>
        </div>
        {idea.parts.length > 0 ? (
          <div className="rounded-lg border border-line overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Baseline</th><th style={{ textAlign: 'right' }}>Estimated new</th><th style={{ textAlign: 'right' }}>Approved new price ₹</th><th style={{ textAlign: 'right' }}>Annual volume</th><th style={{ textAlign: 'right' }}>Annualised (approved)</th></tr></thead>
              <tbody>
                {approvedParts.map((p) => (
                  <tr key={p.partCode}>
                    <td><div className="font-mono text-[11.5px]">{p.partCode}</div><div className="text-[11px] text-muted truncate max-w-[220px]">{p.description}</div></td>
                    <td style={{ textAlign: 'right' }} className="num">{inrPrice(p.baselinePrice)}</td>
                    <td style={{ textAlign: 'right' }} className="num text-muted">{inrPrice(p.newPrice)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1.5">
                        {linked && <SourceTag color="#0f9f6e">from {idea.papRequestId}</SourceTag>}
                        <input type="number" step="0.01" className="input !h-8 !w-28 text-right num" value={prices[p.partCode] ?? ''} onChange={(e) => setPrices({ ...prices, [p.partCode]: e.target.value })} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="num">{num(p.annualVolume)}</td>
                    <td style={{ textAlign: 'right' }} className="num font-bold">{inrShort((p.baselinePrice - p.approvedPrice!) * p.annualVolume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-[12.5px] text-muted rounded-lg border border-dashed border-line p-3">Open idea — no part codes; the estimate is carried as implemented value.</div>}
        <div className="grid grid-cols-3 gap-2">
          <Out label="Annualised (approved)" v={inrShort(annual)} tip="(P(baseline) − P(approved)) × Q(last FY MRN)" />
          <Out label={`Committed ${fy}`} v={inrShort(committed)} tip="Annualised × months live in FY from the effective date ÷ 12" />
          <Out label="Carry-over" v={inrShort(carry)} tip="Annualised impact falling beyond 31 March" />
        </div>
      </div>
    </Modal>
  )
}
function Out({ label, v, tip }: { label: string; v: string; tip: string }) {
  return <div className="rounded-lg bg-slate-50 border border-line px-3 py-2"><div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}<InfoTip title={label} formula={tip} /></div><div className="text-[16px] font-bold num text-ink mt-0.5">{v}</div></div>
}

// ─── Drop: reason code + remarks (mandatory) ──────────────────────────────────
export function DropModal({ idea, open, onClose, fy }: { idea: Idea | null; open: boolean; onClose: () => void; fy: string }) {
  const reasons = useStore((s) => s.dropReasons)
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) { setReason(''); setRemarks('') } }, [open])
  if (!idea) return null
  const committed = ideaCommitted(idea, fy)
  const save = () => {
    useStore.getState().dropIdea(idea.id, reason, remarks.trim())
    toast(`${idea.id} dropped — ${reason}. ${inrShort(committed)} removed from ${fy} committed savings; counted in ${monthLong(ymOf(todayIso()))} drops.`, 'warning')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Drop idea" subtitle={`${idea.id} · ${idea.title}`} icon="Ban" size="md"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" icon="Ban" disabled={!reason || !remarks.trim()} onClick={save}>Drop idea</Button></>}>
      <div className="grid gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900 flex gap-2">
          <Icon name="TriangleAlert" size={16} className="shrink-0 mt-px" />
          <span>A dropped idea stays dropped — it can never be reopened (a fresh attempt needs a new idea). Drop needs a reason code and remarks; the committed value is removed from committed savings and the drop is counted in its month. This idea removes <b className="num">{inrShort(committed)}</b> from {fy} committed savings and is counted in <b>{monthLong(ymOf(todayIso()))}</b>.</span>
        </div>
        <Field label="Reason code" required>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a drop reason…</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Remarks" required hint={reason.startsWith('Other') ? 'Other (remarks mandatory) — describe the reason fully.' : 'Visible to the submitter and in Drop analysis.'}>
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why is this idea being dropped?" />
        </Field>
      </div>
    </Modal>
  )
}

// ─── Due date change → slippage log (reason mandatory) ─────────────────────
export function TargetDateModal({ idea, newDate, open, onClose, fy }: { idea: Idea | null; newDate: string; open: boolean; onClose: () => void; fy: string }) {
  const [reason, setReason] = useState('')
  const [rephase, setRephase] = useState(true)
  useEffect(() => { if (open) { setReason(''); setRephase(true) } }, [open])
  if (!idea?.execution) return null
  const old = idea.execution.targetDate
  const slip = daysBetween(old, newDate)
  const annual = ideaAnnualised(idea)
  const next = phaseByQuarter(annual, newDate, fy)
  const save = () => {
    const undo = snapshot([idea.id])
    useStore.getState().updateExecution(idea.id, rephase ? { targetDate: newDate, phasing: next } : { targetDate: newDate }, reason.trim())
    toast(`Due date moved to ${fmtDate(newDate)} — slippage logged`, slip > 0 ? 'warning' : 'success', undo)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Change due date" subtitle={`${idea.id} · ${idea.title}`} icon="CalendarClock" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Check" disabled={!reason.trim()} onClick={save}>Save and log slippage</Button></>}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-line px-3 py-2.5">
          <div><div className="text-[10.5px] font-bold uppercase text-muted">Current</div><div className="font-bold num">{fmtDate(old)}</div></div>
          <Icon name="ArrowRight" size={16} className="text-muted" />
          <div><div className="text-[10.5px] font-bold uppercase text-muted">New</div><div className="font-bold num">{fmtDate(newDate)}</div></div>
          <Badge color={slip > 0 ? '#e0364f' : '#0f9f6e'}>{slip > 0 ? `+${slip} days` : `${slip} days`}</Badge>
        </div>
        <div className="text-[12px] text-muted">Each change needs a reason and is logged as slippage. Original due date: <b className="text-ink-2">{fmtDate(idea.execution.originalTargetDate)}</b>{idea.execution.slippage.length ? ` · ${idea.execution.slippage.length} earlier change${idea.execution.slippage.length > 1 ? 's' : ''}` : ''}.</div>
        <Field label="Reason for change" required><textarea autoFocus className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. NPD sample re-submission required" /></Field>
        <div className="rounded-lg border border-line p-2.5">
          <Toggle checked={rephase} onChange={setRephase} label="Re-phase quarters from the new due date" />
          {rephase && <div className="grid grid-cols-4 gap-1.5 mt-2">{QS.map((q) => <div key={q} className="text-center rounded-md bg-slate-50 py-1"><div className="text-[10.5px] font-bold text-muted">{q}</div><div className="text-[12px] font-semibold num">{inrShort(next[q])}</div></div>)}</div>}
        </div>
      </div>
    </Modal>
  )
}

// ─── Inline quarter phasing editor (₹ lakh) ───────────────────────────────────
export function PhasingEditor({ idea, fy, onClose, canEdit }: { idea: Idea; fy: string; onClose: () => void; canEdit: boolean }) {
  const ex = idea.execution!
  const toL = (v: number) => (v / 1e5).toFixed(2)
  const [vals, setVals] = useState<Record<Q, string>>({ Q1: toL(ex.phasing.Q1), Q2: toL(ex.phasing.Q2), Q3: toL(ex.phasing.Q3), Q4: toL(ex.phasing.Q4) })
  const annual = ideaAnnualised(idea)
  const system = committedInFy(annual, ex.targetDate, fy)
  const pre = phaseByQuarter(annual, ex.targetDate, fy)
  const total = sum(QS.map((q) => Number(vals[q]) * 1e5 || 0))
  const diff = total - system
  const match = Math.abs(diff) < Math.max(1000, system * 0.005)
  const save = () => {
    const phasing = Object.fromEntries(QS.map((q) => [q, Math.round((Number(vals[q]) || 0) * 1e5)])) as Record<Q, number>
    const undo = snapshot([idea.id])
    useStore.getState().updateExecution(idea.id, { phasing })
    toast(`Quarter phasing saved — ${inrShort(sum(Object.values(phasing)))} committed in ${fy}`, 'success', undo)
    onClose()
  }
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12.5px] font-bold text-ink">Quarter phasing · {fy}</div>
        <InfoTip title="Quarter phasing" formula="pre-fill = annualised ÷ 12 × months live per quarter">Owner enters expected saving per quarter (Q1–Q4); the system pre-fills from due date and annualised impact.</InfoTip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QS.map((q) => (
          <label key={q} className="block">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{q} · {QUARTER_MONTHS[q]}</span>
            <div className="relative mt-0.5">
              <input type="number" step="0.01" min={0} disabled={!canEdit} className="input !h-8 !pr-6 text-right num text-[12.5px]" value={vals[q]} onChange={(e) => setVals({ ...vals, [q]: e.target.value })} />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">L</span>
            </div>
          </label>
        ))}
      </div>
      <div className={cn('mt-2.5 rounded-lg px-2.5 py-2 text-[11.5px] num', match ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
        <div className="flex justify-between"><span>Sum of quarters</span><b>{inrShort(total)}</b></div>
        <div className="flex justify-between"><span>System committed (calc)</span><b>{inrShort(system)}</b></div>
        <div className="flex justify-between"><span>{match ? 'Matches the system pre-fill' : 'Difference'}</span>{!match && <b>{diff > 0 ? '+' : '−'}{inrShort(Math.abs(diff)).replace('−', '')}</b>}</div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <Button size="xs" variant="ghost" icon="RotateCcw" disabled={!canEdit} onClick={() => setVals({ Q1: toL(pre.Q1), Q2: toL(pre.Q2), Q3: toL(pre.Q3), Q4: toL(pre.Q4) })}>Pre-fill</Button>
        <div className="flex gap-1.5"><Button size="xs" onClick={onClose}>Cancel</Button>{canEdit && <Button size="xs" variant="primary" icon="Check" onClick={save}>Save</Button>}</div>
      </div>
    </div>
  )
}

// ─── Linked NPD / PAP requests — status synced ────────────────────────────────
const NPD_STATUSES = ['ECN raised', 'Sample submitted', 'Sample approved', 'Sample failed'] as const
const PAP_STATUSES = ['Raised', 'Price approved', 'Rejected'] as const
export const npdColor = (s?: string) => (s === 'Sample approved' ? '#0f9f6e' : s === 'Sample failed' ? '#e0364f' : s ? '#ec8a1c' : '#94a3b8')
export const papColor = (s?: string) => (s === 'Price approved' ? '#0f9f6e' : s === 'Rejected' ? '#e0364f' : s === 'Raised' ? '#ec8a1c' : '#94a3b8')

export function LinkedEditor({ idea, onClose, canEdit }: { idea: Idea; onClose: () => void; canEdit: boolean }) {
  const [npd, setNpd] = useState<string>(idea.npdStatus ?? '')
  const [pap, setPap] = useState<string>(idea.papStatus ?? '')
  const sync = () => {
    const patch: any = {}
    if (idea.npdRequestId && npd && npd !== idea.npdStatus) patch.npdStatus = npd
    if (pap && pap !== idea.papStatus) patch.papStatus = pap
    if (!Object.keys(patch).length) { onClose(); return }
    const undo = snapshot([idea.id])
    useStore.getState().syncNpdPap(idea.id, patch)
    toast(`Status synced from NPD / PAP${patch.papStatus === 'Price approved' ? ' — approved price is ready for Mark Done' : ''}`, 'success', undo)
    onClose()
  }
  return (
    <div className="p-3 grid gap-2.5">
      <div className="flex items-center justify-between"><div className="text-[12.5px] font-bold text-ink">Linked requests</div><span className="text-[11px] text-muted">status synced</span></div>
      <div className="rounded-lg border border-line p-2.5">
        <div className="flex items-center justify-between text-[12px]"><b>NPD Platform</b><span className="font-mono text-muted">{idea.npdRequestId ?? '—'}</span></div>
        {idea.npdRequestId ? (
          <select disabled={!canEdit} className="input !h-8 mt-1.5 text-[12.5px]" value={npd} onChange={(e) => setNpd(e.target.value)}>{NPD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        ) : <div className="text-[11.5px] text-muted mt-1">No NPD sample needed on the {idea.route} route.</div>}
      </div>
      <div className="rounded-lg border border-line p-2.5">
        <div className="flex items-center justify-between text-[12px]"><b>Price Approval Portal</b><span className="font-mono text-muted">{idea.papRequestId ?? '—'}</span></div>
        <select disabled={!canEdit} className="input !h-8 mt-1.5 text-[12.5px]" value={pap} onChange={(e) => setPap(e.target.value)}>
          {!idea.papStatus || idea.papStatus === 'Not raised' ? <option value="Not raised">Not raised</option> : null}
          {PAP_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-1.5"><Button size="xs" onClick={onClose}>Close</Button>{canEdit && <Button size="xs" variant="primary" icon="RefreshCw" onClick={sync}>Sync status</Button>}</div>
    </div>
  )
}
