// Stage forms of the six-stage workflow:
// 2 Team feasibility check · 3 <dept> evaluation (cost-benefit, risk, supplier capability) · 6 Verification
// (4 <dept> approval — the signed budget + timeline lock — is in ApprovalModal.tsx)
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Idea, RiskItem, RiskLevel } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { RISK_FACTORS, STAGE } from '../../lib/masters'
import { carryOver, committedInFy, duplicateCandidates, ideaAnnualised, partAnnualised, paybackMonths, phaseByQuarter, savingPct, savingPerUnit } from '../../lib/calc'
import { costFlags, EVALUATION_MIN, inLockWindow, needsEvaluation, needsSupplierCheck, overallRisk, riskTotal, savingsTrack, stageLabel, SUPPLIER_CHECK_MIN } from '../../lib/workflow'
import { addDays, addMonthsYm, fmtDate, inrPrice, inrShort, monthLong, quarterStart, todayIso } from '../../lib/format'
import { Badge, Button, Field, Icon, InfoTip, LinkText, Modal, Money, Segmented, cn } from '../../components/ui'
import { SavingsTrackPanel } from './SavingsTrack'
import { ideaPlan } from '../../lib/mrn'

const toast = () => useStore.getState().toast
const RISK_COLOR: Record<RiskLevel, string> = { Low: 'var(--color-emerald-600)', Medium: 'var(--color-orange-400)', High: 'var(--color-accent-500)' }
const DEPTS = ['Sourcing', 'R&D', 'Quality', 'DQA', 'Process', 'Production', 'Finance']

/** One numbered check with a pass / fail marker */
function Check({ n, title, hint, ok, children }: { n: number; title: string; hint?: React.ReactNode; ok: boolean | null; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-3.5">
      <div className="flex items-start gap-2.5 mb-2.5">
        <span className={cn('h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0 text-white', ok == null ? 'bg-slate-300' : ok ? 'bg-emerald-600' : 'bg-red-600')}>{ok == null ? n : <Icon name={ok ? 'Check' : 'X'} size={12} strokeWidth={3} />}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink leading-tight">{title}</div>
          {hint && <div className="text-[11.5px] text-muted mt-0.5">{hint}</div>}
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Stage 2 — Team feasibility check ─────────────────────────────────────────
export function FeasibilityCheckModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const parts = useStore((s) => s.parts)
  const ideas = useStore((s) => s.ideas)
  const me = useMe()
  const flags = useMemo(() => costFlags(idea, parts), [idea, parts])
  const dups = useMemo(() => duplicateCandidates(ideas.filter((i) => i.bucket !== 'Dropped'), idea.title, idea.commodity, idea.id), [ideas, idea])
  const [technical, setTechnical] = useState<'Yes' | 'No'>('Yes')
  const [technicalNote, setTechnicalNote] = useState('')
  const [cost, setCost] = useState<'Valid' | 'Not valid'>('Valid')
  const [costNote, setCostNote] = useState('')
  const [conflict, setConflict] = useState<'None' | 'Duplicate' | 'Conflict'>('None')
  const [conflictWith, setConflictWith] = useState('')
  const [conflictNote, setConflictNote] = useState('')
  const [departments, setDepartments] = useState<string[]>(['Sourcing'])
  const [decision, setDecision] = useState<'Go' | 'No-go'>('Go')
  const [remarks, setRemarks] = useState('')
  useEffect(() => {
    if (!open) return
    setTechnical('Yes'); setTechnicalNote(''); setCost(flags.length ? 'Not valid' : 'Valid'); setCostNote(flags.join('; '))
    setConflict('None'); setConflictWith(''); setConflictNote(''); setDepartments(me && me.department !== 'Sourcing' ? ['Sourcing', me.department] : ['Sourcing']); setRemarks('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const suggested = technical === 'Yes' && cost === 'Valid' && conflict === 'None' ? 'Go' : 'No-go'
  useEffect(() => { setDecision(suggested) }, [suggested])
  const valid = (conflict === 'None' || !!conflictWith.trim()) && (decision === 'Go' || !!remarks.trim())
  // below ₹ 5 L the idea skips the department evaluation and goes straight to the department head
  const skipEval = !needsEvaluation(ideaAnnualised(idea))
  const nextStep = skipEval ? stageLabel(idea, STAGE.approval) : stageLabel(idea, STAGE.evaluation)
  const submit = () => {
    useStore.getState().recordFeasibility(idea.id, { technical, technicalNote: technicalNote.trim() || undefined, cost, costNote: costNote.trim() || undefined, conflict, conflictWith: conflictWith.trim() || undefined, conflictNote: conflictNote.trim() || undefined, decision, departments, remarks: remarks.trim() || undefined })
    toast()(decision === 'Go' ? `${idea.id} cleared the team feasibility check — sent for ${nextStep}${skipEval ? ' (forecast below ₹ 5 L, evaluation skipped)' : ''}` : `${idea.id} not feasible — dropped for good`, decision === 'Go' ? 'success' : 'warning')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="xl" icon="UsersRound" title="Team feasibility check" subtitle={`${idea.id} · ${idea.title}`}
      footer={<>
        <span className="mr-auto text-[11.5px] text-muted hidden sm:inline">Recorded by {me?.name} · {me?.department}</span>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={decision === 'Go' ? 'success' : 'danger'} icon={decision === 'Go' ? 'CircleCheck' : 'CircleX'} disabled={!valid} onClick={submit}>
          {decision === 'Go' ? `Go — send for ${nextStep}` : 'No-go — drop idea'}
        </Button>
      </>}>
      {skipEval && (
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[12.5px] text-sky-900 flex items-start gap-2">
          <Icon name="SkipForward" size={15} className="shrink-0 mt-px" />
          <span>Forecast <b className="num">{inrShort(ideaAnnualised(idea))}</b> a year is below <b className="num">{inrShort(EVALUATION_MIN)}</b> — on Go the idea skips the {stageLabel(idea, STAGE.evaluation)} and goes straight to the {stageLabel(idea, STAGE.approval)}.</span>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Check n={1} title="Is it technically feasible?" hint="Fits the drawing, process and quality plan without hidden changes" ok={technical === 'Yes'}>
          <Segmented value={technical} onChange={(k) => setTechnical(k as 'Yes' | 'No')} options={[{ key: 'Yes', label: 'Feasible', icon: 'CircleCheck' }, { key: 'No', label: 'Not feasible', icon: 'CircleX' }]} />
          <input className="input mt-2" value={technicalNote} onChange={(e) => setTechnicalNote(e.target.value)} placeholder="Note (optional) — e.g. needs a 200-unit trial first" />
        </Check>
        <Check n={2} title="Is the entered cost valid?" hint="Baseline and new price as entered, against the part master (LBP / PO)" ok={cost === 'Valid'}>
          {idea.parts.length ? (
            <div className="rounded-lg border border-line overflow-hidden mb-2">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-muted"><tr><th className="text-left px-2 py-1.5 font-semibold">Part</th><th className="text-right px-2 font-semibold">Baseline</th><th className="text-right px-2 font-semibold">LBP / PO</th><th className="text-right px-2 font-semibold">New</th><th className="text-right px-2 font-semibold">Saving</th></tr></thead>
                <tbody>
                  {idea.parts.map((p) => {
                    const m = parts.find((x) => x.code === p.partCode)
                    return (
                      <tr key={p.partCode} className="border-t border-line">
                        <td className="px-2 py-1.5"><div className="font-mono font-semibold">{p.partCode}</div><div className="text-muted truncate max-w-[160px]">{p.description}</div></td>
                        <td className="px-2 text-right num whitespace-nowrap">{inrPrice(p.baselinePrice)}<div className="text-[10px] text-muted">{p.baselineSource}</div></td>
                        <td className="px-2 text-right num whitespace-nowrap">{m ? inrPrice(m.lbp ?? m.poPrice) : '—'}</td>
                        <td className="px-2 text-right num whitespace-nowrap">{inrPrice(p.newPrice)}</td>
                        <td className="px-2 text-right num font-semibold">{savingPct(p).toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12px] text-muted mb-2">Open idea — estimate {inrShort(ideaAnnualised(idea))} a year, no part prices to check.</div>}
          {flags.length > 0 ? (
            <ul className="mb-2 space-y-1">{flags.map((f) => <li key={f} className="flex items-start gap-1.5 text-[12px] text-amber-800"><Icon name="TriangleAlert" size={13} className="shrink-0 mt-px" />{f}</li>)}</ul>
          ) : <div className="mb-2 flex items-center gap-1.5 text-[12px] text-emerald-700"><Icon name="CircleCheck" size={13} />Baseline matches the part master and the saving is realistic.</div>}
          <Segmented value={cost} onChange={(k) => setCost(k as 'Valid' | 'Not valid')} options={[{ key: 'Valid', label: 'Cost valid', icon: 'CircleCheck' }, { key: 'Not valid', label: 'Not valid', icon: 'CircleX' }]} />
          <input className="input mt-2" value={costNote} onChange={(e) => setCostNote(e.target.value)} placeholder="Note (optional)" />
        </Check>
        <Check n={3} title="Duplicate of, or conflicting with, another idea or project?" hint="Similar ideas are matched on title and commodity" ok={conflict === 'None'}>
          {dups.length > 0 ? (
            <div className="mb-2 grid gap-1">
              {dups.map(({ idea: d, score }) => (
                <button key={d.id} type="button" onClick={() => { setConflictWith(d.id); if (conflict === 'None') setConflict('Duplicate') }} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12px] hover:bg-slate-50', conflictWith === d.id ? 'border-red-300 bg-red-50' : 'border-line')}>
                  <span className="font-mono text-[11px] text-muted shrink-0">{d.id}</span><span className="truncate flex-1 min-w-0">{d.title}</span><Badge color="var(--color-slate-500)">{Math.round(Math.min(1, score) * 100)}% match</Badge>
                </button>
              ))}
            </div>
          ) : <div className="mb-2 flex items-center gap-1.5 text-[12px] text-emerald-700"><Icon name="SearchCheck" size={13} />No similar idea found in the register.</div>}
          <Segmented value={conflict} onChange={(k) => setConflict(k as typeof conflict)} options={[{ key: 'None', label: 'None' }, { key: 'Duplicate', label: 'Duplicate' }, { key: 'Conflict', label: 'Conflict' }]} />
          {conflict !== 'None' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <input className="input" value={conflictWith} onChange={(e) => setConflictWith(e.target.value)} placeholder="Idea ID or project name *" />
              <input className="input" value={conflictNote} onChange={(e) => setConflictNote(e.target.value)} placeholder="How it overlaps" />
            </div>
          )}
        </Check>
        <Check n={4} title="Decision — Go / No-go" hint={`Suggested ${suggested} from the three checks; the team can override`} ok={decision === 'Go'}>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            {(['Go', 'No-go'] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDecision(d)} className={cn('h-14 rounded-xl border-2 flex items-center justify-center gap-2 text-[15px] font-bold transition-colors', decision === d ? (d === 'Go' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-red-600 bg-red-50 text-red-700') : 'border-line text-muted hover:border-slate-300')}>
                <Icon name={d === 'Go' ? 'CircleCheck' : 'CircleX'} size={18} />{d}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Departments consulted</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DEPTS.map((d) => {
              const on = departments.includes(d)
              return <button key={d} type="button" onClick={() => setDepartments((x) => (on ? x.filter((y) => y !== d) : [...x, d]))} className={cn('h-7 px-2.5 rounded-full border text-[12px] font-medium', on ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>{d}</button>
            })}
          </div>
          <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={decision === 'No-go' ? 'Why is it not feasible? (required — the idea is dropped for good)' : 'Remarks for the evaluator (optional)'} />
        </Check>
      </div>
    </Modal>
  )
}

// Stage 3 — <dept> evaluation lives in EvaluationModal.tsx (cost-benefit with editable inputs, risk, supplier check, decision)

export function SupplierResponseCard({ idea }: { idea: Idea }) {
  const sc = idea.evaluation?.supplier
  if (!sc?.response) return null
  const r = sc.response
  const c = r.canSupply === 'Yes' ? 'var(--color-emerald-600)' : r.canSupply === 'Partly' ? 'var(--color-orange-400)' : 'var(--color-accent-500)'
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="px-3.5 py-2.5 flex items-center gap-3 bg-slate-50/70 border-b border-line">
        <span className="h-9 w-9 rounded-xl grid place-items-center text-white" style={{ background: c }}><Icon name="Factory" size={17} /></span>
        <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-ink truncate">{sc.supplierName}</div><div className="text-[11.5px] text-muted truncate">{r.contactName} · responded {fmtDate(r.respondedAt.slice(0, 10))}</div></div>
        <Badge color={c} icon={r.canSupply === 'No' ? 'X' : 'Check'}>Can supply: {r.canSupply}</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 px-3.5 py-2.5 text-[12.5px]">
        <KvMini k="Meets specification" v={r.meetsSpec} />
        <KvMini k="Capacity" v={r.capacityPerMonth ?? '—'} />
        <KvMini k="Lead time" v={r.leadTimeDays ? `${r.leadTimeDays} days` : '—'} />
        <KvMini k="Certifications" v={r.certifications ?? '—'} />
        {r.indicativePrice ? <KvMini k="Indicative price" v={inrPrice(r.indicativePrice)} /> : null}
      </div>
      {r.remarks && <div className="px-3.5 pb-2.5 text-[12px] text-ink-2 italic">“{r.remarks}”</div>}
    </div>
  )
}
const KvMini = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="min-w-0"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{k}</div><div className="font-semibold text-ink truncate">{v}</div></div>

function Kpi({ label, value, tone, tip }: { label: string; value: React.ReactNode; tone?: 'good' | 'bad'; tip?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1 truncate">{label}{tip && <InfoTip title={label}>{tip}</InfoTip>}</div>
      <div className={cn('text-[16px] font-bold num truncate', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>
    </div>
  )
}

// ─── Signature pad ────────────────────────────────────────────────────────────
export function SignaturePad({ onChange, height = 120 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const inked = useRef(false) // read in pointer handlers — state would be stale within one quick stroke
  const [empty, setEmpty] = useState(true)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = height * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#13234b'
  }, [height])
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const }
  const down = (e: React.PointerEvent) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y) }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); if (!inked.current) { inked.current = true; setEmpty(false) } }
  const up = () => { if (!drawing.current) return; drawing.current = false; if (inked.current) onChange(ref.current!.toDataURL('image/png')) }
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); inked.current = false; setEmpty(true); onChange(null) }
  return (
    <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
      <canvas ref={ref} style={{ height, width: '100%', touchAction: 'none' }} className="block rounded-xl cursor-crosshair" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[12.5px] text-muted">Sign here with the mouse or a finger</span>}
      <span className="pointer-events-none absolute left-4 right-4 bottom-6 border-b border-slate-200" />
      {!empty && <button type="button" onClick={clear} className="absolute top-2 right-2 h-7 px-2 rounded-md bg-white border border-line text-[11.5px] font-semibold text-muted hover:text-ink">Clear</button>}
    </div>
  )
}

// Stage 4 — <dept> approval lives in ApprovalModal.tsx (detailed commercial assessment, supplier alignment, lock, sign)

// ─── Stage 6 — Verification: business side confirms the target was achieved ──
export function VerificationModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const rows = useMemo(() => ledger.filter((l) => l.ideaId === idea.id), [ledger, idea.id])
  const plan = useMemo(() => (idea.lock ? ideaPlan(idea, rows, last) : null), [idea, rows, last])
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (open) setRemarks('') }, [open])
  // MRN inside the locked window only — the period the target covers
  const inWindow = useMemo(() => (idea.lock ? rows.filter((r) => inLockWindow(idea.lock!, r.month)) : rows), [rows, idea.lock])
  const target = idea.lock?.targetSaving ?? 0
  const actual = inWindow.reduce((a, r) => a + r.realised, 0)
  const ended = !!idea.lock && idea.lock.endDate <= todayIso()
  const leakage = inWindow.reduce((a, r) => a + r.leakage, 0)
  const mrnOk = inWindow.length > 0 && leakage === 0
  const finOk = inWindow.length > 0 && inWindow.every((r) => r.financeStatus === 'Validated')
  // every month of the window is judged — the last month's MRN is read on the 5th after the deadline
  const finalMonth = idea.verification?.finalMrnMonth
  const waiting = !!finalMonth && finalMonth > last
  const me = useStore((s) => s.users.find((u) => u.id === s.userId))
  const canValidate = !!me && me.roles.some((r) => r === 'finance' || r === 'head' || r === 'admin')
  const validateWindow = () => { useStore.getState().financeValidate(inWindow.filter((r) => r.financeStatus !== 'Validated').map((r) => r.id)); toast()('MRN of the locked window validated', 'success') }
  // the locked timeline has ended (that is why the idea is here): achieved = MRN actual reached 95 % of the locked target
  const targetOk = target > 0 ? actual >= target * 0.95 : !!plan && plan.elapsed > 0 && plan.onTrack
  const all = mrnOk && finOk && targetOk
  // the outcome is recorded either way; a shortfall or a failed check needs remarks and is logged as an exception
  const canVerify = !waiting && (all || !!remarks.trim())
  const verify = () => {
    if (!useStore.getState().verifyIdea(idea.id, { mrnAtApproved: mrnOk, financeValidated: finOk, targetAchieved: targetOk, remarks: remarks.trim() || undefined, targetAtVerification: target || plan?.planToDate || 0 })) return
    toast()(all ? `${idea.id} verified — MRN savings met the locked target` : `${idea.id} verified with shortfall — logged with the failed checks`, all ? 'success' : 'warning'); onClose()
  }
  const items = [
    { ok: mrnOk, label: 'MRN at the approved price', detail: rows.length ? (leakage ? `${inrShort(leakage)} price leakage on ${rows.filter((r) => r.leakage > 0).length} MRN lines` : `${rows.length} MRN lines, all at the approved price`) : 'No MRN posted yet' },
    { ok: finOk, label: 'Finance validated', detail: rows.length ? `${rows.filter((r) => r.financeStatus === 'Validated').length} of ${rows.length} entries validated` : '—' },
    { ok: targetOk, label: 'Locked target achieved from MRN', detail: idea.lock ? `${inrShort(actual)} MRN actual vs ${inrShort(target)} locked target (${target ? Math.round((actual / target) * 100) : 0} %) · ${fmtDate(idea.lock.startDate)} → ${fmtDate(idea.lock.endDate)}` : 'No lock on record' },
  ]
  return (
    <Modal open={open} onClose={onClose} size="lg" icon="ShieldCheck" title="Verification — locked target vs MRN actual" subtitle={`${idea.id} · ${idea.title}`}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={all ? 'success' : 'primary'} icon="ShieldCheck" disabled={!canVerify} onClick={verify}>{all ? 'Verify savings' : 'Verify with shortfall'}</Button>
      </>}>
      {(
        <div className="grid gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Locked target (forecast)" value={<Money value={target} />} />
            <Kpi label="MRN actual in the window" value={<Money value={actual} />} tone={targetOk ? 'good' : 'bad'} />
            <Kpi label="Achieved" value={target ? `${Math.round((actual / target) * 100)} %` : '—'} tone={targetOk ? 'good' : 'bad'} />
            <Kpi label="Variance" value={<Money value={actual - target} />} tone={actual - target >= 0 ? 'good' : 'bad'} />
          </div>
          <div className="text-[12px] text-muted flex items-center gap-1.5"><Icon name="Info" size={13} />{ended ? `The locked timeline ended on ${fmtDate(idea.lock!.endDate)} — COIN moved the idea here. Only MRN transactions count.` : 'Only MRN transactions inside the locked window count.'}</div>
          {waiting && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900 flex items-start gap-2"><Icon name="CalendarClock" size={15} className="shrink-0 mt-px" /><span><b>Waiting for {monthLong(finalMonth!)} MRN.</b> The last month of the locked window is read from the ERP on {fmtDate(addDays(`${addMonthsYm(finalMonth!, 1)}-01`, 4))}; verification opens once it is in.</span></div>}
          {!waiting && !finOk && inWindow.length > 0 && canValidate && <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-[12.5px]"><Icon name="BadgeCheck" size={15} className="text-brand-600" /><span className="flex-1 min-w-[200px]">{inWindow.filter((r) => r.financeStatus !== 'Validated').length} MRN saving line{inWindow.filter((r) => r.financeStatus !== 'Validated').length === 1 ? '' : 's'} of the window still to validate.</span><Button size="sm" variant="success" icon="BadgeCheck" onClick={validateWindow}>Validate the window's MRN</Button></div>}
          <div className="grid gap-1.5">
            {items.map((x) => (
              <div key={x.label} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2">
                <span className={cn('h-6 w-6 rounded-full grid place-items-center text-white shrink-0', x.ok ? 'bg-emerald-600' : 'bg-red-600')}><Icon name={x.ok ? 'Check' : 'X'} size={12} strokeWidth={3} /></span>
                <div className="min-w-0"><div className="text-[13px] font-semibold text-ink">{x.label}</div><div className="text-[11.5px] text-muted">{x.detail}</div></div>
              </div>
            ))}
          </div>
          {plan && idea.lock && <SavingsTrackPanel idea={idea} t={savingsTrack(plan)} compact tiles={false} />}
          <Field label="Verification remarks" hint={all ? 'Optional' : 'Required — a shortfall or a failed check is logged as an exception with these remarks'}>
            <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Target met for July–September; MRN at ₹ 14.50 every month" />
          </Field>
        </div>
      )}
    </Modal>
  )
}
