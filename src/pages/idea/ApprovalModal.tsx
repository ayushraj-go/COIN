// Stage 4 — <dept> approval, in four steps:
// 1 detailed commercial assessment (part-wise cost, financial case, phasing, how the idea got here, risk register)
// 2 supplier alignment (exactly what the supplier answered on the capability form, checked against the plan)
// 3 budget + timeline lock (part-wise budget, calendar start / end, dated milestone plan)
// 4 sign & approve (signature, name, date, approval levels)
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApprovalLock, Idea } from '../../lib/types'
import { hasRole, useMe, useStore } from '../../store/useStore'
import { MILESTONE_TEMPLATES, RISK_FACTORS, STAGE } from '../../lib/masters'
import { cbaFigures, ideaAnnualised, partAnnualised, paybackMonths, phaseByQuarter, savingPct, savingPerUnit } from '../../lib/calc'
import { addMonthsIso, lockTarget, milestoneSchedule, monthsBetween, overallRisk, riskTotal, stageLabel } from '../../lib/workflow'
import { addDays, fmtDate, fmtDateTime, inrPrice, inrShort, quarterStart, sum, todayIso } from '../../lib/format'
import { Badge, Button, Field, Icon, InfoTip, Modal, Money, cn } from '../../components/ui'
import { SignaturePad } from './StageForms'
import { Block, Kpi, Kv, Mark } from './formKit'

const RISK_COLOR = { Low: 'var(--color-emerald-600)', Medium: 'var(--color-orange-400)', High: 'var(--color-accent-500)' } as const
const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`
const lakh = (n: number) => +(n / 1e5).toFixed(2)
type Tab = 'commercial' | 'supplier' | 'lock' | 'sign'

export function SourcingApprovalModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const me = useMe()
  const nav = useNavigate()
  const users = useStore((s) => s.users)
  const levers = useStore((s) => s.levers)
  const commodities = useStore((s) => s.commodities)
  const fy = useStore((s) => s.settings.currentFy)
  const annual = ideaAnnualised(idea)
  const ev = idea.evaluation
  const sc = ev?.supplier
  const f = idea.feasibilityCheck
  const risks = ev?.risks ?? []
  const leadMonths = idea.route === 'Technical' || idea.route === 'Supplier change' ? 2 : 1
  const template = MILESTONE_TEMPLATES[idea.route] ?? MILESTONE_TEMPLATES.Commercial
  // one budget row per part (an open idea has one row for the whole idea)
  const rows = idea.parts.length ? idea.parts.map((p) => ({ key: p.partCode, label: p.description, saving: partAnnualised(p) })) : [{ key: 'IDEA', label: 'Whole idea (open)', saving: annual }]

  const [tab, setTab] = useState<Tab>('commercial')
  const [commercialOk, setCommercialOk] = useState(false)
  const [commercialNote, setCommercialNote] = useState('')
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [plan, setPlan] = useState<{ name: string; dueDate: string }[]>([])
  const [sigName, setSigName] = useState('')
  const [sig, setSig] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const replan = (s: string, e: string) => {
    const due = milestoneSchedule(todayIso(), s, e, template)
    setPlan(template.map((name, k) => ({ name, dueDate: due[k] })))
  }
  useEffect(() => {
    if (!open) return
    const total = cbaFigures(idea, fy).investment || Math.round(annual * 0.02)
    // the idea's one-time investment, split by each part's share of the saving
    const split = Object.fromEntries(rows.map((r) => [r.key, String(lakh(annual ? (total * r.saving) / annual : total / rows.length))]))
    const s = firstOfMonth(addMonthsIso(todayIso(), leadMonths))
    const e = addMonthsIso(s, 6)
    setTab('commercial'); setCommercialOk(false); setCommercialNote(''); setBudgets(split); setNotes({})
    setStart(s); setEnd(e); replan(s, e)
    setSigName(me?.name ?? ''); setSig(null); setRemarks(''); setRejecting(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // a lock signed for a different saving (baseline changed since) must be signed again
  const stale = !!idea.lock && Math.abs(idea.lock.targetSaving - lockTarget(annual, idea.lock.timelineMonths)) > 1
  const locked = stale ? undefined : idea.lock
  const months = monthsBetween(start || todayIso(), end || todayIso())
  const target = lockTarget(annual, months)
  const budgetTotal = sum(rows.map((r) => Math.max(0, Number(budgets[r.key]) || 0) * 1e5))
  const pending = idea.approvals.filter((a) => !a.decision)
  const head = hasRole(me, 'head')
  const finalStep = head || pending.length <= 1
  const supplierAligned: ApprovalLock['supplierAligned'] = sc?.status === 'Responded' && sc.response?.canSupply !== 'No' ? 'Confirmed' : sc?.status === 'Skipped' || ev?.skipped ? 'Skipped' : 'Not confirmed'
  const planOk = plan.length > 0 && plan.every((m) => m.dueDate && m.dueDate >= todayIso() && m.dueDate <= end)
  const timelineOk = !!start && !!end && months >= 1 && start >= todayIso()
  const canSign = commercialOk && timelineOk && planOk && !!sig && !!sigName.trim()

  // ─── commercial numbers ──
  // the department evaluation's cost-benefit figures (with any inputs the evaluator changed)
  const cba = cbaFigures(idea, fy)
  const inv = cba.investment
  const goLive = locked?.startDate ?? cba.goLive
  const committed = cba.committed
  const phasing = phaseByQuarter(annual, goLive, fy)
  const spendToday = sum(idea.parts.map((p) => p.baselinePrice * p.annualVolume))
  const spendAfter = sum(idea.parts.map((p) => p.newPrice * p.annualVolume))
  const lever = levers.find((l) => l.id === idea.leverId)
  const commodity = commodities.find((c) => c.code === idea.commodity)
  const atRisk = riskTotal(risks)

  // ─── supplier alignment checks (only from what the supplier answered) ──
  const r = sc?.response
  const firstPart = idea.parts[0]
  const earliest = r?.leadTimeDays ? addDays(todayIso(), r.leadTimeDays) : undefined
  const savingsStart = locked?.startDate ?? start
  const checks = r ? [
    { label: `Can supply — ${r.canSupply}`, ok: r.canSupply === 'Yes', warn: r.canSupply === 'Partly' },
    { label: `Meets the specification — ${r.meetsSpec}`, ok: r.meetsSpec === 'Yes', warn: r.meetsSpec === 'With deviation' },
    ...(earliest ? [{ label: `Lead time ${r.leadTimeDays} days → first supply around ${fmtDate(earliest)}${savingsStart ? ` · savings start ${fmtDate(savingsStart)}` : ''}`, ok: !savingsStart || earliest <= savingsStart, warn: true }] : []),
    ...(r.indicativePrice && firstPart ? [{ label: `Indicative price ${inrPrice(r.indicativePrice)} vs proposed new price ${inrPrice(firstPart.newPrice)}`, ok: r.indicativePrice <= firstPart.newPrice, warn: r.indicativePrice <= firstPart.newPrice * 1.03 }] : []),
  ] : []

  const approveNow = () => {
    const st = useStore.getState()
    if (!locked) st.signLock(idea.id, {
      commercialOk, supplierAligned, budget: budgetTotal, timelineMonths: months, startDate: start, endDate: end, targetSaving: target,
      signatureName: sigName.trim(), signatureData: sig ?? undefined, commercialNote: commercialNote.trim() || undefined,
      parts: rows.map((x) => ({ partCode: x.key, budget: Math.max(0, Number(budgets[x.key]) || 0) * 1e5, note: notes[x.key]?.trim() || undefined })),
      milestones: plan,
    })
    const ok = st.approve(idea.id, remarks.trim() || undefined)
    if (ok) st.toast(finalStep ? `${idea.id} approved — execution started in Cost Optimisation` : `Approved at ${pending[0]?.level} — pending ${pending[1]?.level}`, 'success')
    onClose()
  }
  const rejectNow = () => { useStore.getState().reject(idea.id, remarks.trim()); useStore.getState().toast(`${idea.id} rejected at ${stageLabel(idea, STAGE.approval)} — dropped for good`, 'warning'); onClose() }

  const tabs: { key: Tab; label: string; icon: string; done: boolean }[] = [
    { key: 'commercial', label: '1 · Commercial assessment', icon: 'Calculator', done: !!locked || commercialOk },
    { key: 'supplier', label: '2 · Supplier alignment', icon: 'Factory', done: supplierAligned !== 'Not confirmed' },
    { key: 'lock', label: '3 · Budget & timeline lock', icon: 'CalendarRange', done: !!locked || (timelineOk && planOk) },
    { key: 'sign', label: '4 · Sign & approve', icon: 'Signature', done: !!locked || !!sig },
  ]
  const order: Tab[] = ['commercial', 'supplier', 'lock', 'sign']
  const next = order[order.indexOf(tab) + 1]

  return (
    <Modal open={open} onClose={onClose} size="2xl" icon="Stamp" title={`${stageLabel(idea, STAGE.approval)} — detailed commercial assessment`} subtitle={`${idea.id} · ${idea.title}`}
      footer={rejecting ? <>
        <Button onClick={() => setRejecting(false)}>Back</Button>
        <Button variant="danger" icon="CircleX" disabled={!remarks.trim()} onClick={rejectNow}>Reject — drop for good</Button>
      </> : <>
        <Button variant="ghost" icon="CircleX" className="mr-auto" onClick={() => setRejecting(true)}>Reject…</Button>
        <Button onClick={onClose}>Cancel</Button>
        {next && <Button icon="ArrowRight" onClick={() => setTab(next)}>Next</Button>}
        <Button variant="success" icon="Signature" disabled={!locked && !canSign} onClick={approveNow}>{locked ? 'Approve' : finalStep ? 'Sign lock & approve' : 'Sign lock & approve level'}</Button>
      </>}>
      {rejecting ? (
        <Field label="Why is this idea rejected?" required hint="The idea is dropped for good; a fresh attempt needs a new idea.">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      ) : (
        <div className="grid gap-3">
          {/* summary strip — always visible */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            <Kpi label="Forecast saving / year" value={<Money value={annual} />} sub={idea.parts.length ? `${idea.parts.length} part${idea.parts.length === 1 ? '' : 's'}` : 'open idea'} />
            <Kpi label="Locked target" value={<Money value={locked?.targetSaving ?? target} />} sub={`${locked?.timelineMonths ?? months} months`} />
            <Kpi label="Budget" value={<Money value={locked?.budget ?? budgetTotal} />} sub={inv ? `investment ${inrShort(inv)}` : 'no investment entered'} />
            <Kpi label="Payback" value={inv || cba.edited.includes('payback') ? `${cba.payback.toFixed(1)} months` : 'Immediate'} sub={cba.edited.length ? 'inputs set at evaluation' : undefined} />
            <Kpi label="Overall risk" value={risks.length ? <span style={{ color: RISK_COLOR[overallRisk(risks)] }}>{overallRisk(risks)}</span> : ev?.skipped ? 'Not assessed' : '—'} sub={risks.length ? `${inrShort(atRisk)} at risk` : undefined} />
            <Kpi label="Supplier alignment" value={supplierAligned} tone={supplierAligned === 'Confirmed' ? 'good' : supplierAligned === 'Not confirmed' ? 'bad' : undefined} sub={sc?.supplierName} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn('h-9 pl-2.5 pr-3 rounded-lg border text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors', tab === t.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>
                <Icon name={t.done ? 'CircleCheck' : t.icon} size={14} className={cn(t.done && tab !== t.key && 'text-emerald-600')} />{t.label}
              </button>
            ))}
          </div>

          {tab === 'commercial' && (
            <div className="grid gap-3">
              <Block title="The idea" icon="Lightbulb" hint={`${idea.route} route · ${lever?.name ?? idea.leverId} · ${commodity?.name ?? idea.commodity} · ${idea.department} · raised by ${idea.submitterName}`}>
                <div className="grid md:grid-cols-3 gap-3 text-[12.5px]">
                  <div><div className="text-[11px] font-medium text-muted mb-0.5">Today</div><div className="text-ink-2 leading-relaxed">{idea.currentState || '—'}</div></div>
                  <div><div className="text-[11px] font-medium text-muted mb-0.5">Proposed change</div><div className="text-ink-2 leading-relaxed">{idea.proposedChange || '—'}</div></div>
                  <div><div className="text-[11px] font-medium text-muted mb-0.5">Evidence</div><div className="text-ink-2 leading-relaxed">{idea.evidence || '—'}</div></div>
                </div>
              </Block>

              <Block title="Part-wise cost" icon="Table2" hint="Price per unit today and after the change, the annual spend and the forecast saving of every part">
                {idea.parts.length ? (
                  <div className="rounded-lg border border-line overflow-x-auto">
                    <table className="tbl">
                      <thead><tr>
                        <th>Part</th><th>Current supplier</th><th style={{ textAlign: 'right' }}>Annual volume</th><th style={{ textAlign: 'right' }}>Cost today / unit</th><th style={{ textAlign: 'right' }}>New cost / unit</th>
                        <th style={{ textAlign: 'right' }}>Saving / unit</th><th style={{ textAlign: 'right' }}>Saving %</th><th style={{ textAlign: 'right' }}>Spend today / yr</th><th style={{ textAlign: 'right' }}>Spend after / yr</th><th style={{ textAlign: 'right' }}>Forecast saving / yr</th><th style={{ textAlign: 'right' }}>Share</th>
                      </tr></thead>
                      <tbody>
                        {idea.parts.map((p) => (
                          <tr key={p.partCode}>
                            <td><div className="font-mono text-[12px] font-semibold">{p.partCode}</div><div className="text-[11.5px] text-muted truncate max-w-[200px]" title={p.description}>{p.description}</div></td>
                            <td className="text-[12px] text-ink-2 max-w-[160px] truncate" title={p.currentSupplier}>{p.currentSupplier}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{p.annualVolume.toLocaleString('en-IN')} {p.uom}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.baselinePrice)}<div className="text-[10.5px] text-muted">{p.baselineSource}</div></td>
                            <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.newPrice)}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{inrPrice(savingPerUnit(p))}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{savingPct(p).toFixed(2)}%</td>
                            <td className="num" style={{ textAlign: 'right' }}>{inrShort(p.baselinePrice * p.annualVolume)}</td>
                            <td className="num" style={{ textAlign: 'right' }}>{inrShort(p.newPrice * p.annualVolume)}</td>
                            <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(partAnnualised(p))}</td>
                            <td className="num text-muted" style={{ textAlign: 'right' }}>{annual ? `${((partAnnualised(p) / annual) * 100).toFixed(0)}%` : '—'}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td colSpan={7}>Total · {idea.parts.length} part{idea.parts.length === 1 ? '' : 's'}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrShort(spendToday)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrShort(spendAfter)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrShort(annual)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12.5px] text-muted">Open idea — valued by the estimate of {inrShort(annual)} a year; part-wise cost follows once part codes are added.</div>}
              </Block>

              <Block title="Financial case" icon="ChartNoAxesCombined" hint={`${fy} · savings counted from ${fmtDate(goLive)} (the savings start in the lock)`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Kpi label="Forecast saving / year" value={<Money value={annual} />} tip="(cost today − new cost) × annual volume, summed over the parts" />
                  <Kpi label="Saving on spend" value={spendToday ? `${((annual / spendToday) * 100).toFixed(2)}%` : '—'} tip="Forecast saving ÷ annual spend today" />
                  <Kpi label="One-time investment" value={<Money value={inv} />} />
                  <Kpi label="Net saving · year 1" value={<Money value={annual - inv} />} tone={annual - inv >= 0 ? 'good' : 'bad'} />
                  <Kpi label={`Committed in ${fy}`} value={<Money value={committed} />} tip="Forecast × months live in the FY ÷ 12" />
                  <Kpi label="Carry-over to next FY" value={<Money value={cba.carryOver} />} />
                  <Kpi label="3-year saving, net" value={<Money value={annual * 3 - inv} />} />
                  <Kpi label="Benefit / cost (3 yr)" value={inv ? `${((annual * 3) / inv).toFixed(1)}×` : '—'} />
                  <Kpi label="Risk-adjusted saving" value={<Money value={annual - atRisk} />} tip="Forecast − ₹ at risk from the risk register" />
                  <Kpi label="₹ at risk" value={<Money value={atRisk} />} tone={atRisk > annual * 0.1 ? 'bad' : undefined} />
                  <Kpi label="Monthly run-rate" value={<Money value={annual / 12} />} />
                  <Kpi label="Expected go-live" value={idea.expectedQuarter || '—'} />
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((k) => <div key={k} className="rounded-lg bg-slate-50 border border-line px-2 py-1.5 text-center"><div className="text-[11px] font-medium text-muted">{k} {fy}</div><div className="text-[13px] font-bold num">{inrShort(phasing[k])}</div></div>)}
                </div>
              </Block>

              <div className="grid lg:grid-cols-2 gap-3">
                <Block title="How it got here" icon="Route" hint="Team feasibility check and department evaluation">
                  <div className="text-[11px] font-semibold text-muted mb-0.5">Team feasibility check</div>
                  {f ? <>
                    <Kv k="Technically feasible" v={`${f.technical === 'Yes' ? 'Yes' : 'No'}${f.technicalNote ? ` — ${f.technicalNote}` : ''}`} />
                    <Kv k="Cost" v={`${f.cost}${f.costNote ? ` — ${f.costNote}` : ''}`} />
                    <Kv k="Duplicate / conflict" v={f.conflict === 'None' ? 'None' : `${f.conflict} · ${f.conflictWith ?? ''}`} />
                    <Kv k="Departments consulted" v={f.departments.join(', ')} />
                    <Kv k="Decision" v={`${f.decision} · ${f.by} · ${fmtDate(f.at.slice(0, 10))}${f.remarks ? ` — “${f.remarks}”` : ''}`} />
                  </> : <div className="text-[12.5px] text-muted">No feasibility check on record.</div>}
                  <div className="text-[11px] font-semibold text-muted mt-2.5 mb-0.5">{stageLabel(idea, STAGE.evaluation)}</div>
                  {ev?.skipped ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12.5px] text-sky-900 flex items-start gap-2"><Icon name="SkipForward" size={14} className="shrink-0 mt-px" />Skipped — {ev.skippedReason ?? 'forecast below ₹ 5 L'}. Review the part-wise cost and risk here.</div>
                  ) : ev ? <>
                    <Kv k="Cost-benefit" v={ev.cbaVerified ? `Verified${ev.cbaNote ? ` — ${ev.cbaNote}` : ''}` : 'Not verified'} />
                    <Kv k="Recommendation" v={ev.decision ? `${ev.decision === 'Recommend' ? 'Recommended' : 'Rejected'} · ${ev.by ?? '—'}${ev.at ? ` · ${fmtDate(ev.at.slice(0, 10))}` : ''}` : '—'} />
                    {ev.remarks && <Kv k="Evaluator remarks" v={`“${ev.remarks}”`} />}
                  </> : <div className="text-[12.5px] text-muted">No evaluation on record.</div>}
                </Block>
                <Block title="Risk register" icon="ShieldAlert" hint={risks.length ? `Overall ${overallRisk(risks)} · ${inrShort(atRisk)} at risk` : 'From the department evaluation'}>
                  {risks.length ? (
                    <div className="grid gap-1.5">
                      {RISK_FACTORS.map((rf) => {
                        const x = risks.find((y) => y.key === rf.key)
                        if (!x) return null
                        return (
                          <div key={rf.key} className="grid grid-cols-[minmax(0,1fr)_80px_90px] items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px]">
                            <span className="min-w-0"><span className="font-semibold text-ink">{rf.label}</span><span className="block text-[11px] text-muted truncate">{rf.hint}</span></span>
                            <span className="font-semibold" style={{ color: RISK_COLOR[x.level] }}>{x.level}</span>
                            <span className="num text-right">{inrShort(x.costAtRisk || 0)}</span>
                          </div>
                        )
                      })}
                      {ev?.riskRemarks && <div className="text-[12px] text-ink-2 mt-1"><b>Mitigation:</b> {ev.riskRemarks}</div>}
                    </div>
                  ) : <div className="text-[12.5px] text-muted">{ev?.skipped ? 'No risk register — the evaluation was skipped (forecast below ₹ 5 L).' : 'No risk assessment on record.'}</div>}
                </Block>
              </div>

              {!locked && (
                <div className="grid gap-2">
                  <label className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={commercialOk} onChange={(e) => setCommercialOk(e.target.checked)} />
                    <span className="text-[13px] font-semibold text-ink">Commercial assessment reviewed</span>
                    <span className="text-[12px] text-muted">— part-wise cost, financial case, feasibility, evaluation and risks</span>
                  </label>
                  <input className="input" value={commercialNote} onChange={(e) => setCommercialNote(e.target.value)} placeholder="Commercial note for the lock (optional) — e.g. approve with a 200-unit pilot first" />
                </div>
              )}
              {locked?.commercialNote && <div className="text-[12.5px] text-ink-2"><b>Commercial note:</b> {locked.commercialNote}</div>}
            </div>
          )}

          {tab === 'supplier' && (
            <div className="grid gap-3">
              {ev?.skipped || sc?.status === 'Skipped' ? (
                <Block title="Supplier alignment — skipped" icon="SkipForward" hint={ev?.skipped ? ev.skippedReason : `Forecast ${inrShort(annual)} is below the ₹ 5 L threshold`}>
                  <div className="text-[12.5px] text-muted">No supplier capability request was needed for this idea, so there is no supplier answer to align with. The lock records supplier alignment as <b>Skipped</b>.</div>
                </Block>
              ) : sc?.status === 'Responded' && r ? (
                <>
                  <div className="grid lg:grid-cols-2 gap-3">
                    <Block title="What we asked" icon="Send" hint={`Capability request sent ${fmtDateTime(sc.sentAt)} by ${sc.sentBy ?? '—'}`}>
                      <Kv k="Supplier" v={`${sc.supplierName}${sc.supplierCode ? ` (${sc.supplierCode})` : ''}`} />
                      <Kv k="Contact" v={`${sc.contactName ?? '—'} · ${sc.email ?? '—'}`} />
                      <Kv k="Item" v={sc.item ?? '—'} />
                      <Kv k="Specification" v={sc.spec ?? '—'} />
                      <Kv k="Required by" v={fmtDate(sc.requiredBy)} />
                    </Block>
                    <Block title="What the supplier answered" icon="MailCheck" hint={`On the secure form · ${r.contactName} · ${fmtDateTime(r.respondedAt)}`}>
                      <Kv k="Can supply" v={<Badge color={r.canSupply === 'Yes' ? 'var(--color-emerald-600)' : r.canSupply === 'Partly' ? 'var(--color-orange-400)' : 'var(--color-accent-500)'}>{r.canSupply}</Badge>} />
                      <Kv k="Meets the specification" v={r.meetsSpec} />
                      <Kv k="Monthly capacity" v={r.capacityPerMonth ?? 'Not given'} />
                      <Kv k="Lead time" v={r.leadTimeDays ? `${r.leadTimeDays} days` : 'Not given'} />
                      <Kv k="Indicative price / unit" v={r.indicativePrice ? inrPrice(r.indicativePrice) : 'Not given'} />
                      <Kv k="Certifications" v={r.certifications ?? 'Not given'} />
                      <Kv k="Remarks" v={r.remarks ? `“${r.remarks}”` : 'None'} />
                      <Kv k="Answered by" v={`${r.contactName} · ${fmtDateTime(r.respondedAt)}`} />
                    </Block>
                  </div>
                  <Block title="Alignment with this idea" icon="ListChecks" hint="The supplier's answers checked against the proposal and the savings start in the lock">
                    <div className="grid gap-1.5">
                      {checks.map((c) => <div key={c.label} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[12.5px]"><Mark ok={c.ok} warn={c.warn} /><span className="text-ink-2">{c.label}</span></div>)}
                      {firstPart && <div className="text-[11.5px] text-muted mt-1">Amber needs about <b className="num text-ink-2">{Math.round(firstPart.annualVolume / 12).toLocaleString('en-IN')} {firstPart.uom}</b> a month of {firstPart.description} — compare with the capacity above.</div>}
                    </div>
                  </Block>
                </>
              ) : (
                <Block title="Supplier alignment — no answer yet" icon="MailQuestion" hint={sc?.status === 'Sent' ? `Sent to ${sc.supplierName} · ${sc.email} · ${fmtDateTime(sc.sentAt)}` : 'No capability request was sent'}>
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    <span>{sc?.status === 'Sent' ? 'The supplier has not answered the capability form yet.' : 'The department evaluation did not send a capability request.'} The lock records supplier alignment as <b>Not confirmed</b>.</span>
                    {sc?.status === 'Sent' && <Button size="sm" icon="ArrowUpRight" onClick={() => { onClose(); nav(`/ideas/${idea.id}/supplier-check`) }}>Open the supplier check</Button>}
                  </div>
                </Block>
              )}
            </div>
          )}

          {tab === 'lock' && (
            <div className="grid gap-3">
              {stale && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">The saving changed after the lock was signed ({inrShort(idea.lock!.targetSaving)} locked) — sign it again.</div>}
              {locked ? (
                <LockedView lock={locked} idea={idea} />
              ) : (
                <>
                  <Block title="Part-wise budget" icon="Wallet" hint="One-time cost per part — tooling, trials, validation, PPAP, freight. Pre-filled from the idea's investment, split by each part's saving.">
                    <div className="rounded-lg border border-line overflow-x-auto">
                      <table className="tbl">
                        <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Forecast saving / yr</th><th style={{ textAlign: 'right', width: 150 }}>Budget (₹ lakh)</th><th>What the budget covers</th><th style={{ textAlign: 'right' }}>Payback</th></tr></thead>
                        <tbody>
                          {rows.map((x) => {
                            const b = Math.max(0, Number(budgets[x.key]) || 0) * 1e5
                            return (
                              <tr key={x.key}>
                                <td><div className="font-mono text-[12px] font-semibold">{x.key === 'IDEA' ? '—' : x.key}</div><div className="text-[11.5px] text-muted truncate max-w-[240px]">{x.label}</div></td>
                                <td className="num" style={{ textAlign: 'right' }}>{inrShort(x.saving)}</td>
                                <td style={{ textAlign: 'right' }}><input type="number" min="0" step="0.1" aria-label={`Budget for ${x.key}`} className="input num !h-8 text-right" value={budgets[x.key] ?? ''} onChange={(e) => setBudgets((v) => ({ ...v, [x.key]: e.target.value }))} /></td>
                                <td><input className="input !h-8" aria-label={`Budget note for ${x.key}`} value={notes[x.key] ?? ''} onChange={(e) => setNotes((v) => ({ ...v, [x.key]: e.target.value }))} placeholder="e.g. new die, sample trial" /></td>
                                <td className="num text-muted" style={{ textAlign: 'right' }}>{b && x.saving ? `${paybackMonths(x.saving, b).toFixed(1)} mo` : 'Immediate'}</td>
                              </tr>
                            )
                          })}
                          <tr className="bg-slate-50 font-semibold"><td>Total budget</td><td className="num" style={{ textAlign: 'right' }}>{inrShort(annual)}</td><td className="num" style={{ textAlign: 'right' }}>{inrShort(budgetTotal)}</td><td /><td className="num" style={{ textAlign: 'right' }}>{budgetTotal ? `${paybackMonths(annual, budgetTotal).toFixed(1)} mo` : 'Immediate'}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </Block>

                  <Block title="Timeline" icon="CalendarRange" hint="Pick the savings start (expected first MRN at the new price) and end on the calendar; target = forecast × months ÷ 12">
                    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-3 items-end">
                      <Field label="Savings start (first MRN)" required><input type="date" className="input" min={todayIso()} value={start} onChange={(e) => { const s = e.target.value; setStart(s); if (s && end && end <= s) { const e2 = addMonthsIso(s, 6); setEnd(e2); replan(s, e2) } else if (s && end) replan(s, end) }} /></Field>
                      <Field label="Savings end" required><input type="date" className="input" min={start || todayIso()} value={end} onChange={(e) => { setEnd(e.target.value); if (start && e.target.value) replan(start, e.target.value) }} /></Field>
                      <div>
                        <div className="text-[11.5px] font-medium text-muted mb-1">Quick timeline</div>
                        <div className="flex flex-wrap gap-1.5">{[3, 6, 9, 12].map((m) => <button key={m} type="button" onClick={() => { const e2 = addMonthsIso(start || todayIso(), m); setEnd(e2); replan(start, e2) }} className={cn('h-9 px-3 rounded-lg border text-[12.5px] font-semibold', months === m ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>{m} months</button>)}</div>
                      </div>
                    </div>
                    {!timelineOk && <div className="mt-2 text-[12px] text-red-600 flex items-center gap-1.5"><Icon name="TriangleAlert" size={13} />The savings start must be today or later and the end at least a month after it.</div>}
                    <div className="mt-3 rounded-xl bg-brand-50 border border-brand-100 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                      <div><div className="text-[11px] font-medium text-brand-700">Locked target saving</div><div className="text-[22px] font-extrabold text-ink leading-tight"><Money value={target} /></div></div>
                      <div className="text-right text-[12.5px] text-muted">{fmtDate(start)} → {fmtDate(end)} · <b className="text-ink-2 num">{months} months</b><br /><b className="text-ink-2 num">{inrShort(months ? target / months : 0)}</b> a month</div>
                    </div>
                  </Block>

                  <Block title="Execution plan" icon="ListTodo" hint="Milestones the execution owner works to — set each date on the calendar" right={<Button size="xs" variant="ghost" icon="RotateCcw" onClick={() => replan(start, end)}>Spread evenly</Button>}>
                    <div className="grid gap-1.5">
                      {plan.map((m, k) => {
                        const bad = !m.dueDate || m.dueDate < todayIso() || m.dueDate > end
                        return (
                          <div key={k} className="grid grid-cols-[22px_minmax(0,1fr)_170px] items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
                            <span className="h-5 w-5 rounded-full bg-brand-50 text-brand-700 text-[10.5px] font-bold grid place-items-center">{k + 1}</span>
                            <span className="text-[12.5px] font-medium text-ink truncate">{m.name}</span>
                            <input type="date" aria-label={`Due date for ${m.name}`} className={cn('input !h-8', bad && 'border-red-300')} min={todayIso()} max={end} value={m.dueDate} onChange={(e) => setPlan((x) => x.map((y, j) => (j === k ? { ...y, dueDate: e.target.value } : y)))} />
                          </div>
                        )
                      })}
                      {!planOk && <div className="text-[12px] text-red-600 flex items-center gap-1.5"><Icon name="TriangleAlert" size={13} />Every milestone needs a date between today and the savings end.</div>}
                    </div>
                  </Block>
                </>
              )}
            </div>
          )}

          {tab === 'sign' && (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Block title={locked ? 'Signed' : 'Sign the lock'} icon="Signature" hint={locked ? `${locked.signedBy} · ${fmtDate(locked.signedAt.slice(0, 10))}` : 'Signature, name and date are stored with the approval'}>
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
              </Block>
              <Block title="Before you approve" icon="ListChecks" hint={finalStep ? 'Approving starts execution in Cost Optimisation' : 'This approves your level'}>
                <div className="grid gap-1.5">
                  {[
                    { ok: !!locked || commercialOk, label: 'Commercial assessment reviewed', go: 'commercial' as Tab },
                    { ok: supplierAligned !== 'Not confirmed', warn: true, label: `Supplier alignment — ${supplierAligned}`, go: 'supplier' as Tab },
                    { ok: !!locked || (timelineOk && planOk), label: `Budget ${inrShort(locked?.budget ?? budgetTotal)} · ${locked?.timelineMonths ?? months} months · target ${inrShort(locked?.targetSaving ?? target)}`, go: 'lock' as Tab },
                    { ok: !!locked || (!!sig && !!sigName.trim()), label: 'Signed with name and date', go: 'sign' as Tab },
                  ].map((x) => (
                    <button key={x.label} type="button" onClick={() => setTab(x.go)} className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2 text-left hover:bg-slate-50"><Mark ok={x.ok} warn={x.warn} /><span className="text-[12.5px] text-ink-2">{x.label}</span></button>
                  ))}
                </div>
                <div className="mt-2.5 grid gap-1">
                  {idea.approvals.map((a, k) => (
                    <div key={k} className="flex items-center justify-between gap-2 text-[12px] rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <span className="font-semibold text-ink-2">L{k + 1} · {a.level}</span>
                      <span className="text-muted truncate">{users.find((u) => u.id === a.approverId)?.name ?? '—'}</span>
                      <Badge color={a.decision === 'Approved' ? 'var(--color-emerald-600)' : head || k === idea.approvals.findIndex((x) => !x.decision) ? 'var(--color-orange-400)' : 'var(--color-slate-400)'}>{a.decision ?? (head || k === idea.approvals.findIndex((x) => !x.decision) ? 'This approval' : 'Next')}</Badge>
                    </div>
                  ))}
                </div>
                <input className="input mt-2" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Approval remarks (optional)" />
              </Block>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/** A signed lock, read-only: budget per part, timeline and the dated plan */
export function LockedView({ lock, idea }: { lock: ApprovalLock; idea: Idea }) {
  const desc = (code: string) => idea.parts.find((p) => p.partCode === code)?.description ?? (code === 'IDEA' ? 'Whole idea (open)' : '')
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Block title="Budget & timeline" icon="Lock" hint={`Signed by ${lock.signedBy} · ${fmtDate(lock.signedAt.slice(0, 10))}`}>
        <Kv k="Locked target" v={<Money value={lock.targetSaving} />} />
        <Kv k="Timeline" v={`${lock.timelineMonths} months · ${fmtDate(lock.startDate)} → ${fmtDate(lock.endDate)}`} />
        <Kv k="Budget" v={<Money value={lock.budget} />} />
        <Kv k="Supplier alignment" v={lock.supplierAligned} />
        {lock.commercialNote && <Kv k="Commercial note" v={lock.commercialNote} />}
        {!!lock.parts?.length && (
          <div className="mt-2 grid gap-1">
            {lock.parts.map((p) => <div key={p.partCode} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px]"><span className="min-w-0 truncate"><b className="font-mono">{p.partCode === 'IDEA' ? 'Idea' : p.partCode}</b> · {desc(p.partCode)}{p.note ? ` — ${p.note}` : ''}</span><span className="num font-semibold">{inrShort(p.budget)}</span></div>)}
          </div>
        )}
      </Block>
      <Block title="Execution plan" icon="ListTodo" hint="Dates signed with the lock">
        {lock.milestones?.length ? (
          <div className="grid gap-1">
            {lock.milestones.map((m, k) => <div key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px]"><span className="truncate">{k + 1}. {m.name}</span><span className="num text-ink-2">{fmtDate(m.dueDate)}</span></div>)}
          </div>
        ) : <div className="text-[12.5px] text-muted">The route's standard milestones, spread over the locked period.</div>}
      </Block>
    </div>
  )
}
