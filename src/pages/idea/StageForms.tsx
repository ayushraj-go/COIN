// Stage forms of the six-stage workflow:
// 2 Team feasibility check · 3 <dept> evaluation (cost-benefit, risk, supplier capability) · 4 Sourcing approval (signed lock) · 6 Verification
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApprovalLock, Idea, RiskItem, RiskLevel } from '../../lib/types'
import { hasRole, useMe, useStore } from '../../store/useStore'
import { RISK_FACTORS, STAGE } from '../../lib/masters'
import { carryOver, committedInFy, duplicateCandidates, ideaAnnualised, partAnnualised, paybackMonths, phaseByQuarter, savingPct, savingPerUnit } from '../../lib/calc'
import { addMonthsIso, costFlags, lockTarget, needsSupplierCheck, overallRisk, planVsActual, riskTotal, stageLabel, SUPPLIER_CHECK_MIN } from '../../lib/workflow'
import { fmtDate, inrPrice, inrShort, quarterStart, todayIso } from '../../lib/format'
import { Badge, Button, Field, Icon, InfoTip, Modal, Money, Segmented, cn } from '../../components/ui'
import { PlanVsActualBlock } from './PlanVsActual'

const toast = () => useStore.getState().toast
const RISK_COLOR: Record<RiskLevel, string> = { Low: '#0f9f6e', Medium: '#ec8a1c', High: '#d7192d' }
const DEPTS = ['Sourcing', 'R&D', 'Quality', 'DQA', 'Process', 'Production', 'Finance']
const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`

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
  const submit = () => {
    useStore.getState().recordFeasibility(idea.id, { technical, technicalNote: technicalNote.trim() || undefined, cost, costNote: costNote.trim() || undefined, conflict, conflictWith: conflictWith.trim() || undefined, conflictNote: conflictNote.trim() || undefined, decision, departments, remarks: remarks.trim() || undefined })
    toast()(decision === 'Go' ? `${idea.id} cleared the team feasibility check — sent for ${stageLabel(idea, STAGE.evaluation)}` : `${idea.id} not feasible — dropped for good`, decision === 'Go' ? 'success' : 'warning')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="xl" icon="UsersRound" title="Team feasibility check" subtitle={`${idea.id} · ${idea.title}`}
      footer={<>
        <span className="mr-auto text-[11.5px] text-muted hidden sm:inline">Recorded by {me?.name} · {me?.department}</span>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={decision === 'Go' ? 'success' : 'danger'} icon={decision === 'Go' ? 'CircleCheck' : 'CircleX'} disabled={!valid} onClick={submit}>
          {decision === 'Go' ? `Go — send for ${stageLabel(idea, STAGE.evaluation)}` : 'No-go — drop idea'}
        </Button>
      </>}>
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
                  <span className="font-mono text-[11px] text-muted shrink-0">{d.id}</span><span className="truncate flex-1 min-w-0">{d.title}</span><Badge color="#64748b">{Math.round(Math.min(1, score) * 100)}% match</Badge>
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

// ─── Stage 3 — <dept> evaluation ──────────────────────────────────────────────
type EvalTab = 'cba' | 'risk' | 'supplier' | 'decision'
export function EvaluationModal({ idea, open, onClose, tab: initialTab = 'cba' }: { idea: Idea; open: boolean; onClose: () => void; tab?: EvalTab }) {
  const nav = useNavigate()
  const settings = useStore((s) => s.settings)
  const ev = idea.evaluation
  const [tab, setTab] = useState<EvalTab>(initialTab)
  const [cbaVerified, setCbaVerified] = useState(false)
  const [cbaNote, setCbaNote] = useState('')
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [riskRemarks, setRiskRemarks] = useState('')
  const [remarks, setRemarks] = useState('')
  const annual = ideaAnnualised(idea)
  useEffect(() => {
    if (!open) return
    setTab(initialTab); setCbaVerified(!!ev?.cbaVerified); setCbaNote(ev?.cbaNote ?? ''); setRiskRemarks(ev?.riskRemarks ?? ''); setRemarks('')
    setRisks(RISK_FACTORS.map((f) => ev?.risks?.find((r) => r.key === f.key) ?? { key: f.key, label: f.label, level: 'Low', costAtRisk: 0 }))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const fy = settings.currentFy
  const [q, qfy] = (idea.expectedQuarter || `Q3 ${fy}`).split(' ')
  const goLive = quarterStart(q, qfy || fy)
  const inv = idea.oneTimeInvestment || 0
  const committed = committedInFy(annual, goLive, fy)
  const phasing = phaseByQuarter(annual, goLive, fy)
  const payback = paybackMonths(annual, inv)
  const sc = ev?.supplier
  const riskSaved = !!ev?.risks?.length
  const supplierOk = sc?.status === 'Responded' || sc?.status === 'Skipped'
  const ready = !!ev?.cbaVerified && riskSaved && supplierOk
  const deptLabel = stageLabel(idea, STAGE.evaluation)

  const saveCba = () => { useStore.getState().saveEvaluation(idea.id, { cbaVerified, cbaNote: cbaNote.trim() || undefined }); toast()(cbaVerified ? 'Cost-benefit analysis verified' : 'Cost-benefit notes saved') }
  const saveRisk = () => { useStore.getState().saveEvaluation(idea.id, { risks, riskRemarks: riskRemarks.trim() || undefined }); toast()(`Risk assessment saved — overall ${overallRisk(risks)}, ${inrShort(riskTotal(risks))} at risk`) }
  const decide = (d: 'Recommend' | 'Reject') => {
    useStore.getState().recordEvaluation(idea.id, d, remarks.trim() || undefined)
    toast()(d === 'Recommend' ? `${idea.id} recommended — sent for Sourcing approval` : `${idea.id} rejected at ${deptLabel} — dropped for good`, d === 'Recommend' ? 'success' : 'warning')
    onClose()
  }
  const sendBack = () => { useStore.getState().sendBack(idea.id, remarks.trim()); toast()(`${idea.id} sent back to the Team feasibility check`, 'warning'); onClose() }

  const tabs: { key: EvalTab; label: string; icon: string; done: boolean }[] = [
    { key: 'cba', label: 'Cost-benefit', icon: 'Calculator', done: !!ev?.cbaVerified },
    { key: 'risk', label: 'Risk assessment', icon: 'ShieldAlert', done: riskSaved },
    { key: 'supplier', label: 'Supplier capability', icon: 'Factory', done: supplierOk },
    { key: 'decision', label: 'Decision', icon: 'Gavel', done: false },
  ]
  const footer = tab === 'cba' ? <><Button onClick={onClose}>Close</Button><Button variant="primary" icon="Save" onClick={saveCba}>Save cost-benefit</Button></>
    : tab === 'risk' ? <><Button onClick={onClose}>Close</Button><Button variant="primary" icon="Save" onClick={saveRisk}>Save risk assessment</Button></>
      : tab === 'supplier' ? <Button onClick={onClose}>Close</Button>
        : <>
          <Button variant="ghost" icon="Undo2" disabled={!remarks.trim()} onClick={sendBack} className="mr-auto">Send back to feasibility</Button>
          <Button variant="danger" icon="CircleX" disabled={!remarks.trim()} onClick={() => decide('Reject')}>Reject</Button>
          <Button variant="success" icon="CircleCheck" disabled={!ready} onClick={() => decide('Recommend')}>Recommend for sourcing approval</Button>
        </>
  return (
    <Modal open={open} onClose={onClose} size="xl" icon="FlaskConical" title={deptLabel} subtitle={`${idea.id} · ${idea.title}`} footer={footer}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn('h-9 pl-2.5 pr-3 rounded-lg border text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors', tab === t.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>
            <Icon name={t.done ? 'CircleCheck' : t.icon} size={14} className={cn(t.done && tab !== t.key && 'text-emerald-600')} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'cba' && (
        <div className="grid gap-3">
          {idea.parts.length ? (
            <div className="rounded-xl border border-line overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Baseline</th><th style={{ textAlign: 'right' }}>New</th><th style={{ textAlign: 'right' }}>Saving / unit</th><th style={{ textAlign: 'right' }}>Saving %</th><th style={{ textAlign: 'right' }}>Annual volume</th><th style={{ textAlign: 'right' }}>Annualised</th></tr></thead>
                <tbody>
                  {idea.parts.map((p) => (
                    <tr key={p.partCode}>
                      <td><div className="font-mono text-[12px] font-semibold">{p.partCode}</div><div className="text-[11.5px] text-muted truncate max-w-[220px]">{p.description}</div></td>
                      <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.baselinePrice)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.newPrice)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{inrPrice(savingPerUnit(p))}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{savingPct(p).toFixed(2)}%</td>
                      <td className="num" style={{ textAlign: 'right' }}>{p.annualVolume.toLocaleString('en-IN')} {p.uom}</td>
                      <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(partAnnualised(p))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12.5px] text-muted">Open idea — valued by the estimate of {inrShort(annual)} a year; part-wise analysis follows once part codes are added.</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Annualised saving" value={<Money value={annual} />} tip="(baseline − new price) × annual volume" />
            <Kpi label="One-time investment" value={<Money value={inv} />} />
            <Kpi label="Net saving · year 1" value={<Money value={annual - inv} />} tone={annual - inv >= 0 ? 'good' : 'bad'} tip="Annualised − one-time investment" />
            <Kpi label="Payback" value={inv ? `${payback.toFixed(1)} months` : 'Immediate'} tip="Investment ÷ (annualised ÷ 12)" />
            <Kpi label={`Committed in ${fy}`} value={<Money value={committed} />} tip={`Live from ${fmtDate(goLive)} (${idea.expectedQuarter})`} />
            <Kpi label="Carry-over to next FY" value={<Money value={carryOver(annual, goLive, fy)} />} />
            <Kpi label="3-year saving, net" value={<Money value={annual * 3 - inv} />} />
            <Kpi label="Benefit / cost (3 yr)" value={inv ? `${((annual * 3) / inv).toFixed(1)}×` : '—'} />
          </div>
          <div className="rounded-xl border border-line p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">Quarter phasing {fy}</div>
            <div className="grid grid-cols-4 gap-2">{(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((k) => <div key={k} className="rounded-lg bg-slate-50 border border-line px-2 py-1.5 text-center"><div className="text-[10.5px] font-semibold text-muted">{k}</div><div className="text-[13px] font-bold num">{inrShort(phasing[k])}</div></div>)}</div>
          </div>
          <label className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={cbaVerified} onChange={(e) => setCbaVerified(e.target.checked)} />
            <span className="text-[13px] font-semibold text-ink">Cost-benefit analysis verified</span>
            <span className="text-[12px] text-muted">— baseline, volume, investment and phasing checked</span>
          </label>
          <input className="input" value={cbaNote} onChange={(e) => setCbaNote(e.target.value)} placeholder="Evaluator note (optional)" />
        </div>
      )}

      {tab === 'risk' && (
        <div className="grid gap-2">
          {risks.map((r, k) => {
            const f = RISK_FACTORS[k]
            return (
              <div key={r.key} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_150px] gap-2 items-center rounded-xl border border-line bg-white px-3 py-2">
                <div className="min-w-0"><div className="text-[13px] font-semibold text-ink">{r.label}</div><div className="text-[11.5px] text-muted">{f?.hint}</div></div>
                <div className="flex gap-1">
                  {(['Low', 'Medium', 'High'] as RiskLevel[]).map((l) => (
                    <button key={l} type="button" onClick={() => setRisks((x) => x.map((y, j) => (j === k ? { ...y, level: l } : y)))}
                      className={cn('h-8 px-2.5 rounded-lg border text-[12px] font-semibold', r.level === l ? 'text-white' : 'bg-white text-ink-2 border-line')} style={r.level === l ? { background: RISK_COLOR[l], borderColor: RISK_COLOR[l] } : undefined}>{l}</button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5"><span className="text-[11px] text-muted whitespace-nowrap">₹ at risk (L)</span>
                  <input type="number" min="0" step="0.1" className="input num !h-8 text-right" value={r.costAtRisk ? +(r.costAtRisk / 1e5).toFixed(2) : ''} onChange={(e) => setRisks((x) => x.map((y, j) => (j === k ? { ...y, costAtRisk: Math.max(0, Number(e.target.value) || 0) * 1e5 } : y)))} placeholder="0" />
                </label>
              </div>
            )
          })}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <Kpi label="Overall risk" value={<span style={{ color: RISK_COLOR[overallRisk(risks)] }}>{overallRisk(risks)}</span>} />
            <Kpi label="Total ₹ at risk" value={<Money value={riskTotal(risks)} />} tone={riskTotal(risks) > annual * 0.1 ? 'bad' : undefined} />
            <Kpi label="Risk-adjusted saving" value={<Money value={annual - riskTotal(risks)} />} />
          </div>
          <input className="input" value={riskRemarks} onChange={(e) => setRiskRemarks(e.target.value)} placeholder="Mitigation (e.g. 200-unit pilot, phased cut-over, dual source for 3 months)" />
        </div>
      )}

      {tab === 'supplier' && (
        <div className="grid gap-3">
          <div className="rounded-xl border border-line bg-slate-50/70 px-3 py-2.5 text-[12.5px] text-ink-2 flex items-start gap-2">
            <Icon name="ShieldCheck" size={15} className="text-brand-600 shrink-0 mt-px" />
            <span>The supplier gets an email with a link to a short form asking only whether they can supply the item — no Amber prices, volumes, part codes or current suppliers. Ideas below <b className="num">{inrShort(SUPPLIER_CHECK_MIN)}</b> a year skip this check.</span>
          </div>
          {sc?.status === 'Skipped' || !needsSupplierCheck(annual) ? (
            <div className="rounded-xl border border-line px-3.5 py-3 flex items-center gap-3"><span className="h-9 w-9 rounded-xl grid place-items-center bg-slate-100 text-slate-500"><Icon name="SkipForward" size={17} /></span><div><div className="text-[13.5px] font-semibold text-ink">Skipped — below the minimum saving threshold</div><div className="text-[12px] text-muted">Annualised {inrShort(annual)} is below {inrShort(SUPPLIER_CHECK_MIN)}.</div></div></div>
          ) : sc?.status === 'Responded' && sc.response ? (
            <SupplierResponseCard idea={idea} />
          ) : (
            <div className="rounded-xl border border-line px-3.5 py-3 flex flex-wrap items-center gap-3">
              <span className="h-9 w-9 rounded-xl grid place-items-center bg-amber-50 text-amber-600"><Icon name={sc?.status === 'Sent' ? 'MailCheck' : 'Mail'} size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{sc?.status === 'Sent' ? `Sent to ${sc.supplierName} — awaiting response` : 'Not sent yet'}</div>
                <div className="text-[12px] text-muted">{sc?.status === 'Sent' ? `${sc.email} · ${fmtDate(sc.sentAt?.slice(0, 10))}` : 'Choose a supplier, review the template and send the capability request.'}</div>
              </div>
              <Button variant="primary" icon="ArrowUpRight" onClick={() => { onClose(); nav(`/ideas/${idea.id}/supplier-check`) }}>{sc?.status === 'Sent' ? 'Open supplier check' : 'Start supplier check'}</Button>
            </div>
          )}
        </div>
      )}

      {tab === 'decision' && (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            {[
              { ok: !!ev?.cbaVerified, label: 'Cost-benefit analysis verified', go: 'cba' as EvalTab },
              { ok: riskSaved, label: `Risk assessment saved${riskSaved ? ` — overall ${overallRisk(ev!.risks!)}, ${inrShort(riskTotal(ev!.risks!))} at risk` : ''}`, go: 'risk' as EvalTab },
              { ok: supplierOk, label: sc?.status === 'Skipped' ? 'Supplier capability check — skipped below ₹ 5 L' : sc?.status === 'Responded' ? `Supplier capability — ${sc.supplierName}: can supply ${sc.response?.canSupply}` : 'Supplier capability check — response awaited', go: 'supplier' as EvalTab },
            ].map((x) => (
              <button key={x.label} type="button" onClick={() => setTab(x.go)} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left hover:bg-slate-50">
                <span className={cn('h-5 w-5 rounded-full grid place-items-center text-white shrink-0', x.ok ? 'bg-emerald-600' : 'bg-slate-300')}><Icon name={x.ok ? 'Check' : 'Minus'} size={11} strokeWidth={3} /></span>
                <span className={cn('text-[13px]', x.ok ? 'text-ink font-medium' : 'text-muted')}>{x.label}</span>
              </button>
            ))}
          </div>
          {!ready && <div className="text-[12px] text-amber-800 flex items-center gap-1.5"><Icon name="Info" size={13} />Complete the three parts to recommend this idea.</div>}
          <Field label="Remarks" hint="Required to reject or send back; optional when recommending">
            <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Recommended with a 200-unit pilot before full cut-over" />
          </Field>
        </div>
      )}
    </Modal>
  )
}

export function SupplierResponseCard({ idea }: { idea: Idea }) {
  const sc = idea.evaluation?.supplier
  if (!sc?.response) return null
  const r = sc.response
  const c = r.canSupply === 'Yes' ? '#0f9f6e' : r.canSupply === 'Partly' ? '#ec8a1c' : '#d7192d'
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

// ─── Stage 4 — Sourcing approval: commercial assessment, supplier alignment, signed budget + timeline lock ──
export function SourcingApprovalModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const me = useMe()
  const users = useStore((s) => s.users)
  const annual = ideaAnnualised(idea)
  const ev = idea.evaluation
  const sc = ev?.supplier
  const leadMonths = idea.route === 'Technical' || idea.route === 'Supplier change' ? 2 : 1
  const [commercialOk, setCommercialOk] = useState(false)
  const [budgetL, setBudgetL] = useState('')
  const [months, setMonths] = useState(6)
  const [start, setStart] = useState('')
  const [sigName, setSigName] = useState('')
  const [sig, setSig] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [rejecting, setRejecting] = useState(false)
  useEffect(() => {
    if (!open) return
    setCommercialOk(false); setBudgetL(String(+(((idea.oneTimeInvestment || Math.round(annual * 0.02)) / 1e5).toFixed(2)))); setMonths(6)
    setStart(firstOfMonth(addMonthsIso(todayIso(), leadMonths))); setSigName(me?.name ?? ''); setSig(null); setRemarks(''); setRejecting(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const locked = idea.lock
  const end = addMonthsIso(start || todayIso(), months)
  const target = lockTarget(annual, months)
  const pending = idea.approvals.filter((a) => !a.decision)
  const head = hasRole(me, 'head')
  const finalStep = head || pending.length <= 1
  const supplierAligned: ApprovalLock['supplierAligned'] = sc?.status === 'Responded' && sc.response?.canSupply !== 'No' ? 'Confirmed' : sc?.status === 'Skipped' ? 'Skipped' : 'Not confirmed'
  const canSign = commercialOk && !!sig && !!sigName.trim() && !!start && Number(budgetL) >= 0
  const approveNow = () => {
    const st = useStore.getState()
    if (!locked) st.signLock(idea.id, { commercialOk, supplierAligned, budget: Math.round(Number(budgetL) * 1e5), timelineMonths: months, startDate: start, endDate: end, targetSaving: target, signatureName: sigName.trim(), signatureData: sig ?? undefined })
    const ok = st.approve(idea.id, remarks.trim() || undefined)
    if (ok) toast()(finalStep ? `${idea.id} approved — execution started in Cost Optimisation` : `Approved at ${pending[0]?.level} — pending ${pending[1]?.level}`, 'success')
    onClose()
  }
  const rejectNow = () => { useStore.getState().reject(idea.id, remarks.trim()); toast()(`${idea.id} rejected at Sourcing approval — dropped for good`, 'warning'); onClose() }
  const r = ev?.risks ?? []
  return (
    <Modal open={open} onClose={onClose} size="xl" icon="Stamp" title="Sourcing approval" subtitle={`${idea.id} · ${idea.title}`}
      footer={rejecting ? <>
        <Button onClick={() => setRejecting(false)}>Back</Button>
        <Button variant="danger" icon="CircleX" disabled={!remarks.trim()} onClick={rejectNow}>Reject — drop for good</Button>
      </> : <>
        <Button variant="ghost" icon="CircleX" className="mr-auto" onClick={() => setRejecting(true)}>Reject…</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="success" icon="Signature" disabled={!locked && !canSign} onClick={approveNow}>{locked ? 'Approve' : finalStep ? 'Sign lock & approve' : 'Sign lock & approve level'}</Button>
      </>}>
      {rejecting ? (
        <Field label="Why is this idea rejected?" required hint="The idea is dropped for good; a fresh attempt needs a new idea.">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Check n={1} title="Commercial assessment" hint={`From the ${stageLabel(idea, STAGE.evaluation)} by ${ev?.by ?? '—'}`} ok={locked ? true : commercialOk}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Kpi label="Annualised saving" value={<Money value={annual} />} />
              <Kpi label="Payback" value={idea.oneTimeInvestment ? `${paybackMonths(annual, idea.oneTimeInvestment).toFixed(1)} mo` : 'Immediate'} />
              <Kpi label="Overall risk" value={r.length ? <span style={{ color: RISK_COLOR[overallRisk(r)] }}>{overallRisk(r)}</span> : '—'} />
              <Kpi label="₹ at risk" value={<Money value={riskTotal(r)} />} />
            </div>
            {!locked && <label className="flex items-center gap-2 cursor-pointer text-[13px] font-semibold text-ink"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={commercialOk} onChange={(e) => setCommercialOk(e.target.checked)} />Commercial assessment complete</label>}
          </Check>
          <Check n={2} title="Supplier alignment & confirmation" hint="Supplier capability form result" ok={supplierAligned !== 'Not confirmed'}>
            {sc?.status === 'Responded' ? <SupplierResponseCard idea={idea} />
              : <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12.5px] text-muted">{sc?.status === 'Skipped' ? `Skipped — annualised ${inrShort(annual)} is below the ₹ 5 L threshold.` : 'No supplier response on record.'}</div>}
          </Check>
          <Check n={3} title="Budget + timeline lock" hint="Target saving = annualised × months ÷ 12; the savings start is the expected first MRN at the new price" ok={locked ? true : !!start}>
            {locked ? (
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Budget" value={<Money value={locked.budget} />} /><Kpi label="Timeline" value={`${locked.timelineMonths} months`} />
                <Kpi label="Savings start → end" value={`${fmtDate(locked.startDate)} → ${fmtDate(locked.endDate)}`} /><Kpi label="Locked target" value={<Money value={locked.targetSaving} />} />
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Budget (₹ lakh)"><input type="number" min="0" step="0.5" className="input num" value={budgetL} onChange={(e) => setBudgetL(e.target.value)} /></Field>
                  <Field label="Savings start (first MRN)"><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Timeline</div>
                  <div className="flex gap-1.5">{[3, 6, 9, 12].map((m) => <button key={m} type="button" onClick={() => setMonths(m)} className={cn('h-8 px-3 rounded-lg border text-[12.5px] font-semibold', months === m ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2')}>{m} months</button>)}</div>
                </div>
                <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5 flex items-center justify-between gap-3">
                  <div><div className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-700">Locked target saving</div><div className="text-[22px] font-extrabold text-ink leading-tight"><Money value={target} /></div></div>
                  <div className="text-right text-[12px] text-muted">{fmtDate(start)} → {fmtDate(end)}<br /><b className="text-ink-2 num">{inrShort(target / months)}</b> a month</div>
                </div>
              </div>
            )}
          </Check>
          <Check n={4} title={locked ? 'Signed' : 'Sign the lock'} hint={locked ? `${locked.signedBy} · ${fmtDate(locked.signedAt.slice(0, 10))}` : 'Signature, name and date are stored with the approval'} ok={locked ? true : !!sig}>
            {locked ? (
              locked.signatureData ? <img src={locked.signatureData} alt={`Signature of ${locked.signatureName}`} className="h-[90px] rounded-lg border border-line bg-white" /> : <div className="font-[cursive] text-[26px] text-brand-800">{locked.signatureName}</div>
            ) : (
              <div className="grid gap-2">
                <SignaturePad onChange={setSig} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Name"><input className="input" value={sigName} onChange={(e) => setSigName(e.target.value)} /></Field>
                  <Field label="Date"><input className="input" value={fmtDate(todayIso())} readOnly /></Field>
                </div>
              </div>
            )}
            <div className="mt-2.5 grid gap-1">
              {idea.approvals.map((a, k) => (
                <div key={k} className="flex items-center justify-between gap-2 text-[12px] rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="font-semibold text-ink-2">L{k + 1} · {a.level}</span>
                  <span className="text-muted truncate">{users.find((u) => u.id === a.approverId)?.name ?? '—'}</span>
                  <Badge color={a.decision === 'Approved' ? '#0f9f6e' : head || k === idea.approvals.findIndex((x) => !x.decision) ? '#ec8a1c' : '#94a3b8'}>{a.decision ?? (head || k === idea.approvals.findIndex((x) => !x.decision) ? 'This approval' : 'Next')}</Badge>
                </div>
              ))}
            </div>
            <input className="input mt-2" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Approval remarks (optional)" />
          </Check>
        </div>
      )}
    </Modal>
  )
}

// ─── Stage 6 — Verification: business side confirms the target was achieved ──
export function VerificationModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const rows = useMemo(() => ledger.filter((l) => l.ideaId === idea.id), [ledger, idea.id])
  const plan = useMemo(() => (idea.lock ? planVsActual({ target: idea.lock.targetSaving, months: idea.lock.timelineMonths, startDate: idea.lock.startDate, ledger: rows, lastActualMonth: last }) : null), [idea.lock, rows, last])
  const [remarks, setRemarks] = useState('')
  const [returning, setReturning] = useState(false)
  useEffect(() => { if (open) { setRemarks(''); setReturning(false) } }, [open])
  const leakage = rows.reduce((a, r) => a + r.leakage, 0)
  const mrnOk = rows.length > 0 && leakage === 0
  const finOk = rows.length > 0 && rows.every((r) => r.financeStatus === 'Validated')
  const targetOk = !!plan && plan.elapsed > 0 && plan.onTrack
  const all = mrnOk && finOk && targetOk
  const verify = () => {
    useStore.getState().verifyIdea(idea.id, { mrnAtApproved: mrnOk, financeValidated: finOk, targetAchieved: targetOk, remarks: remarks.trim() || undefined, targetAtVerification: plan?.planToDate ?? 0 })
    toast()(`${idea.id} verified — savings proven against the locked target`, 'success'); onClose()
  }
  const back = () => { useStore.getState().returnToExecution(idea.id, remarks.trim()); toast()(`${idea.id} returned to execution`, 'warning'); onClose() }
  const items = [
    { ok: mrnOk, label: 'MRN at the approved price', detail: rows.length ? (leakage ? `${inrShort(leakage)} price leakage on ${rows.filter((r) => r.leakage > 0).length} MRN lines` : `${rows.length} MRN lines, all at the approved price`) : 'No MRN posted yet' },
    { ok: finOk, label: 'Finance validated', detail: rows.length ? `${rows.filter((r) => r.financeStatus === 'Validated').length} of ${rows.length} entries validated` : '—' },
    { ok: targetOk, label: 'Target achieved for the period', detail: plan ? `${inrShort(plan.actualToDate)} realised vs ${inrShort(plan.planToDate)} due to date · ${inrShort(plan.target)} locked` : 'No lock on record' },
  ]
  return (
    <Modal open={open} onClose={onClose} size="lg" icon="ShieldCheck" title="Verification" subtitle={`${idea.id} · ${idea.title}`}
      footer={returning ? <>
        <Button onClick={() => setReturning(false)}>Back</Button>
        <Button variant="danger" icon="Undo2" disabled={!remarks.trim()} onClick={back}>Return to execution</Button>
      </> : <>
        <Button variant="ghost" icon="Undo2" className="mr-auto" onClick={() => setReturning(true)}>Return to execution…</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="success" icon="ShieldCheck" disabled={!all && !remarks.trim()} onClick={verify}>Verify savings</Button>
      </>}>
      {returning ? (
        <Field label="Why is verification not passed?" required hint="The idea goes back to Execution started; the reason is shown to the owner.">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. MRN price above the approved price in August — PAP revision not applied" />
        </Field>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            {items.map((x) => (
              <div key={x.label} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2">
                <span className={cn('h-6 w-6 rounded-full grid place-items-center text-white shrink-0', x.ok ? 'bg-emerald-600' : 'bg-red-600')}><Icon name={x.ok ? 'Check' : 'X'} size={12} strokeWidth={3} /></span>
                <div className="min-w-0"><div className="text-[13px] font-semibold text-ink">{x.label}</div><div className="text-[11.5px] text-muted">{x.detail}</div></div>
              </div>
            ))}
          </div>
          {plan && <PlanVsActualBlock p={plan} compact />}
          <Field label="Verification remarks" hint={all ? 'Optional' : 'Required to verify while a check is not met'}>
            <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Target met for July–September; MRN at ₹ 14.50 every month" />
          </Field>
        </div>
      )}
    </Modal>
  )
}
