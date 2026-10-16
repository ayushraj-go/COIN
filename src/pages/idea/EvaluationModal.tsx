// Stage 3 — <dept> evaluation sheet, in four steps: cost-benefit analysis (part-wise saving, editable inputs — one-time
// investment, go-live, payback, carry-over — and the figures they drive), risk assessment, supplier capability, decision.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Idea, RiskItem, RiskLevel } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { RISK_FACTORS, STAGE } from '../../lib/masters'
import { cbaFigures, ideaAnnualised, partAnnualised, paybackMonths, phaseByQuarter, savingPct, savingPerUnit } from '../../lib/calc'
import { needsSupplierCheck, overallRisk, riskTotal, stageLabel, SUPPLIER_CHECK_MIN } from '../../lib/workflow'
import { fmtDate, inrPrice, inrShort, sum } from '../../lib/format'
import { Badge, Button, Icon, LinkText, Modal, Money, cn } from '../../components/ui'
import { SupplierResponseCard } from './StageForms'
import { Block, Kpi, Mark } from './formKit'

type Tab = 'cba' | 'risk' | 'supplier' | 'decision'
const RISK_COLOR: Record<RiskLevel, string> = { Low: 'var(--color-emerald-600)', Medium: 'var(--color-orange-400)', High: 'var(--color-accent-500)' }
const toast = () => useStore.getState().toast
const lakhs = (n: number) => String(+(n / 1e5).toFixed(2))

/** One editable input card: the value, how COIN works it out, and a way back to the automatic value */
function InputCard({ label, how, edited, onReset, children }: { label: string; how: React.ReactNode; edited: boolean; onReset: () => void; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 min-w-0', edited ? 'border-brand-300 bg-brand-50/50' : 'border-line bg-white')}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-semibold text-ink-2">{label}</span>
        {edited ? <button type="button" onClick={onReset} className="text-[11px] font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"><Icon name="RotateCcw" size={11} />Auto</button>
          : <span className="text-[10.5px] font-semibold text-muted bg-slate-100 rounded px-1.5">Auto</span>}
      </div>
      {children}
      <div className="text-[11px] text-muted mt-1.5 leading-snug">{how}</div>
    </div>
  )
}

export function EvaluationModal({ idea, open, onClose, tab: initialTab = 'cba' }: { idea: Idea; open: boolean; onClose: () => void; tab?: Tab }) {
  const nav = useNavigate()
  const fy = useStore((s) => s.settings.currentFy)
  const ev = idea.evaluation
  const sc = ev?.supplier
  const annual = ideaAnnualised(idea)
  const saved = cbaFigures(idea, fy)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [cbaVerified, setCbaVerified] = useState(false)
  const [cbaNote, setCbaNote] = useState('')
  const [inv, setInv] = useState('')
  const [goLive, setGoLive] = useState('')
  const [payback, setPayback] = useState('')
  const [carry, setCarry] = useState('')
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [riskRemarks, setRiskRemarks] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => {
    if (!open) return
    const x = ev?.cbaInputs ?? {}
    setTab(initialTab); setCbaVerified(!!ev?.cbaVerified); setCbaNote(ev?.cbaNote ?? ''); setRiskRemarks(ev?.riskRemarks ?? ''); setRemarks('')
    setInv(lakhs(saved.investment)); setGoLive(saved.goLive)
    setPayback(x.payback != null ? String(+x.payback.toFixed(1)) : ''); setCarry(x.carryOver != null ? lakhs(x.carryOver) : '')
    setRisks(RISK_FACTORS.map((f) => ev?.risks?.find((r) => r.key === f.key) ?? { key: f.key, label: f.label, level: 'Low', costAtRisk: 0 }))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // the figures as currently entered (blank payback / carry-over = automatic)
  const investment = Math.max(0, Number(inv) || 0) * 1e5
  const autoPayback = paybackMonths(annual, investment)
  const draft = cbaFigures({ ...idea, evaluation: { ...(ev ?? { dept: '' }), cbaInputs: { investment, goLive: goLive || saved.auto.goLive, payback: payback !== '' ? Number(payback) : undefined, carryOver: carry !== '' ? Number(carry) * 1e5 : undefined } } }, fy)
  const phasing = phaseByQuarter(annual, draft.goLive, fy)
  const atRisk = riskTotal(risks)
  const riskSaved = !!ev?.risks?.length
  const supplierOk = sc?.status === 'Responded' || sc?.status === 'Skipped'
  const ready = !!ev?.cbaVerified && riskSaved && supplierOk
  const deptLabel = stageLabel(idea, STAGE.evaluation)
  const spendToday = sum(idea.parts.map((p) => p.baselinePrice * p.annualVolume))

  const saveCba = () => {
    // only what the evaluator changed is stored; everything else stays automatic
    const cbaInputs = {
      investment: investment !== (idea.oneTimeInvestment || 0) ? investment : undefined,
      goLive: goLive && goLive !== saved.auto.goLive ? goLive : undefined,
      payback: payback !== '' ? Number(payback) : undefined,
      carryOver: carry !== '' ? Number(carry) * 1e5 : undefined,
    }
    useStore.getState().saveEvaluation(idea.id, { cbaVerified, cbaNote: cbaNote.trim() || undefined, cbaInputs })
    toast()(cbaVerified ? 'Cost-benefit analysis verified and saved' : 'Cost-benefit analysis saved')
  }
  const saveRisk = () => { useStore.getState().saveEvaluation(idea.id, { risks, riskRemarks: riskRemarks.trim() || undefined }); toast()(`Risk assessment saved — overall ${overallRisk(risks)}, ${inrShort(riskTotal(risks))} at risk`) }
  const decide = (d: 'Recommend' | 'Reject') => {
    useStore.getState().recordEvaluation(idea.id, d, remarks.trim() || undefined)
    toast()(d === 'Recommend' ? `${idea.id} recommended — sent for ${stageLabel(idea, STAGE.approval)}` : `${idea.id} rejected at ${deptLabel} — dropped for good`, d === 'Recommend' ? 'success' : 'warning')
    onClose()
  }
  const sendBack = () => { useStore.getState().sendBack(idea.id, remarks.trim()); toast()(`${idea.id} sent back to the Team feasibility check`, 'warning'); onClose() }

  const tabs: { key: Tab; label: string; icon: string; done: boolean }[] = [
    { key: 'cba', label: '1 · Cost-benefit analysis', icon: 'Calculator', done: !!ev?.cbaVerified },
    { key: 'risk', label: '2 · Risk assessment', icon: 'ShieldAlert', done: riskSaved },
    { key: 'supplier', label: '3 · Supplier capability', icon: 'Factory', done: supplierOk },
    { key: 'decision', label: '4 · Decision', icon: 'Gavel', done: false },
  ]
  const footer = tab === 'cba' ? <><Button onClick={onClose}>Close</Button><Button variant="primary" icon="Save" onClick={saveCba}>Save cost-benefit</Button></>
    : tab === 'risk' ? <><Button onClick={onClose}>Close</Button><Button variant="primary" icon="Save" onClick={saveRisk}>Save risk assessment</Button></>
      : tab === 'supplier' ? <Button onClick={onClose}>Close</Button>
        : <>
          <Button variant="ghost" icon="Undo2" disabled={!remarks.trim()} onClick={sendBack} className="mr-auto">Send back to feasibility</Button>
          <Button variant="danger" icon="CircleX" disabled={!remarks.trim()} onClick={() => decide('Reject')}>Reject</Button>
          <Button variant="success" icon="CircleCheck" disabled={!ready} onClick={() => decide('Recommend')}>Recommend for {stageLabel(idea, STAGE.approval)}</Button>
        </>

  return (
    <Modal open={open} onClose={onClose} size="2xl" icon="FlaskConical" title={`${deptLabel} — evaluation sheet`} subtitle={`${idea.id} · ${idea.title}`} footer={footer}>
      <div className="grid gap-3">
        {/* summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <Kpi label="Forecast saving / year" value={<Money value={annual} />} sub={idea.parts.length ? `${idea.parts.length} part${idea.parts.length === 1 ? '' : 's'}` : 'open idea'} />
          <Kpi label="One-time investment" value={<Money value={draft.investment} />} sub={investment !== (idea.oneTimeInvestment || 0) ? 'changed by the evaluator' : 'from the idea'} />
          <Kpi label="Payback" value={draft.investment || draft.edited.includes('payback') ? `${draft.payback.toFixed(1)} months` : 'Immediate'} />
          <Kpi label={`Committed ${fy}`} value={<Money value={draft.committed} />} sub={`live from ${fmtDate(draft.goLive)}`} />
          <Kpi label="Overall risk" value={riskSaved ? <span style={{ color: RISK_COLOR[overallRisk(ev!.risks!)] }}>{overallRisk(ev!.risks!)}</span> : 'To assess'} sub={riskSaved ? `${inrShort(riskTotal(ev!.risks!))} at risk` : undefined} />
          <Kpi label="Supplier check" value={sc?.status === 'Responded' ? `Can supply: ${sc.response?.canSupply}` : sc?.status ?? 'Not sent'} tone={sc?.status === 'Responded' ? 'good' : undefined} sub={sc?.supplierName} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn('h-9 pl-2.5 pr-3 rounded-lg border text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors', tab === t.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>
              <Icon name={t.done ? 'CircleCheck' : t.icon} size={14} className={cn(t.done && tab !== t.key && 'text-emerald-600')} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'cba' && (
          <div className="grid gap-3">
            <Block title="Part-wise saving" icon="Table2" hint="Cost today and after the change, saving per unit and the forecast saving of every part">
              {idea.parts.length ? (
                <div className="rounded-lg border border-line overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Annual volume</th><th style={{ textAlign: 'right' }}>Cost today / unit</th><th style={{ textAlign: 'right' }}>New cost / unit</th><th style={{ textAlign: 'right' }}>Saving / unit</th><th style={{ textAlign: 'right' }}>Saving %</th><th style={{ textAlign: 'right' }}>Spend today / yr</th><th style={{ textAlign: 'right' }}>Forecast saving / yr</th></tr></thead>
                    <tbody>
                      {idea.parts.map((p) => (
                        <tr key={p.partCode}>
                          <td><div className="font-mono text-[12px] font-semibold">{p.partCode}</div><div className="text-[11.5px] text-muted truncate max-w-[240px]">{p.description}</div></td>
                          <td className="num" style={{ textAlign: 'right' }}>{p.annualVolume.toLocaleString('en-IN')} {p.uom}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.baselinePrice)}<div className="text-[10.5px] text-muted">{p.baselineSource}</div></td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.newPrice)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrPrice(savingPerUnit(p))}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{savingPct(p).toFixed(2)}%</td>
                          <td className="num" style={{ textAlign: 'right' }}>{inrShort(p.baselinePrice * p.annualVolume)}</td>
                          <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(partAnnualised(p))}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold"><td colSpan={6}>Total</td><td className="num" style={{ textAlign: 'right' }}>{inrShort(spendToday)}</td><td className="num" style={{ textAlign: 'right' }}>{inrShort(annual)}</td></tr>
                    </tbody>
                  </table>
                </div>
              ) : <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12.5px] text-muted">Open idea — valued by the estimate of {inrShort(annual)} a year; part-wise analysis follows once part codes are added.</div>}
            </Block>

            <Block title="Inputs — change any of these" icon="SlidersHorizontal" hint="Each starts from the idea; change it if the evaluation finds a different value. Changed values are stored with the evaluation and used at department approval.">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                <InputCard label="One-time investment (₹ lakh)" edited={investment !== (idea.oneTimeInvestment || 0)} onReset={() => setInv(lakhs(idea.oneTimeInvestment || 0))}
                  how={<>From the idea: <b className="num">{inrShort(idea.oneTimeInvestment || 0)}</b> (tooling, trials, validation). Enter the evaluated amount.</>}>
                  <input type="number" min="0" step="0.1" aria-label="One-time investment" className="input num" value={inv} onChange={(e) => setInv(e.target.value)} />
                </InputCard>
                <InputCard label="Go-live (savings start)" edited={!!goLive && goLive !== saved.auto.goLive} onReset={() => setGoLive(saved.auto.goLive)}
                  how={<>From the expected quarter <b>{idea.expectedQuarter || '—'}</b> ({fmtDate(saved.auto.goLive)}). Drives committed this FY and carry-over.</>}>
                  <input type="date" aria-label="Go-live" className="input" value={goLive} onChange={(e) => setGoLive(e.target.value)} />
                </InputCard>
                <InputCard label="Payback (months)" edited={payback !== ''} onReset={() => setPayback('')}
                  how={<>Auto = investment ÷ (forecast ÷ 12) = <b className="num">{investment ? `${autoPayback.toFixed(1)} months` : 'immediate'}</b>. Enter a value if savings ramp up.</>}>
                  <input type="number" min="0" step="0.5" aria-label="Payback months" className="input num" value={payback} placeholder={investment ? autoPayback.toFixed(1) : '0'} onChange={(e) => setPayback(e.target.value)} />
                </InputCard>
                <InputCard label="Carry-over to next FY (₹ lakh)" edited={carry !== ''} onReset={() => setCarry('')}
                  how={<>Auto = forecast falling after 31 March, from the go-live = <b className="num">{inrShort(draft.auto.carryOver)}</b>.</>}>
                  <input type="number" min="0" step="0.1" aria-label="Carry-over" className="input num" value={carry} placeholder={lakhs(draft.auto.carryOver)} onChange={(e) => setCarry(e.target.value)} />
                </InputCard>
              </div>
            </Block>

            <Block title="Financial case" icon="ChartNoAxesCombined" hint="Worked out from the part-wise saving and the inputs above">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Kpi label="Forecast saving / year" value={<Money value={annual} />} tip="(cost today − new cost) × annual volume" />
                <Kpi label="Net saving · year 1" value={<Money value={annual - draft.investment} />} tone={annual - draft.investment >= 0 ? 'good' : 'bad'} tip="Forecast − one-time investment" />
                <Kpi label={`Committed in ${fy}`} value={<Money value={draft.committed} />} tip="Forecast − carry-over to next FY" />
                <Kpi label="Carry-over to next FY" value={<Money value={draft.carryOver} />} />
                <Kpi label="Payback" value={draft.investment || draft.edited.includes('payback') ? `${draft.payback.toFixed(1)} months` : 'Immediate'} />
                <Kpi label="3-year saving, net" value={<Money value={annual * 3 - draft.investment} />} />
                <Kpi label="Benefit / cost (3 yr)" value={draft.investment ? `${((annual * 3) / draft.investment).toFixed(1)}×` : '—'} />
                <Kpi label="Saving on spend" value={spendToday ? `${((annual / spendToday) * 100).toFixed(2)}%` : '—'} tip="Forecast ÷ annual spend today" />
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((k) => <div key={k} className="rounded-lg bg-slate-50 border border-line px-2 py-1.5 text-center"><div className="text-[11px] font-medium text-muted">{k} {fy}</div><div className="text-[13px] font-bold num">{inrShort(phasing[k])}</div></div>)}
              </div>
            </Block>

            <div className="grid gap-2">
              <label className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={cbaVerified} onChange={(e) => setCbaVerified(e.target.checked)} />
                <span className="text-[13px] font-semibold text-ink">Cost-benefit analysis verified</span>
                <span className="text-[12px] text-muted">— baseline, volume, investment, go-live and phasing checked</span>
              </label>
              <input className="input" value={cbaNote} onChange={(e) => setCbaNote(e.target.value)} placeholder="Evaluator note (optional)" />
            </div>
          </div>
        )}

        {tab === 'risk' && (
          <Block title="Risk register" icon="ShieldAlert" hint="Rate each factor and put a value on what could be lost" right={<span className="text-[12px] text-muted">Overall <b style={{ color: RISK_COLOR[overallRisk(risks)] }}>{overallRisk(risks)}</b> · <b className="num text-ink-2">{inrShort(atRisk)}</b> at risk</span>}>
            <div className="grid gap-2">
              {risks.map((r, k) => {
                const f = RISK_FACTORS[k]
                return (
                  <div key={r.key} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_170px] gap-2 items-center rounded-xl border border-line bg-white px-3 py-2">
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
                <Kpi label="Total ₹ at risk" value={<Money value={atRisk} />} tone={atRisk > annual * 0.1 ? 'bad' : undefined} />
                <Kpi label="Risk-adjusted saving" value={<Money value={annual - atRisk} />} />
              </div>
              <input className="input" value={riskRemarks} onChange={(e) => setRiskRemarks(e.target.value)} placeholder="Mitigation (e.g. 200-unit pilot, phased cut-over, dual source for 3 months)" />
            </div>
          </Block>
        )}

        {tab === 'supplier' && (
          <Block title="Supplier capability" icon="Factory" hint={<>The supplier gets an email with a link to a short form — no Amber prices, volumes, part codes or current suppliers. Ideas below <b className="num">{inrShort(SUPPLIER_CHECK_MIN)}</b> a year skip this check.</>}>
            {sc?.status === 'Skipped' || !needsSupplierCheck(annual) ? (
              <div className="rounded-xl border border-line px-3.5 py-3 flex items-center gap-3"><span className="h-9 w-9 rounded-xl grid place-items-center bg-slate-100 text-slate-500"><Icon name="SkipForward" size={17} /></span><div><div className="text-[13.5px] font-semibold text-ink">Skipped — below the minimum saving threshold</div><div className="text-[12px] text-muted">Forecast {inrShort(annual)} is below {inrShort(SUPPLIER_CHECK_MIN)}.</div></div></div>
            ) : sc?.status === 'Responded' && sc.response ? (
              <SupplierResponseCard idea={idea} />
            ) : (
              <div className="grid gap-3">
                <div className="rounded-xl border border-line px-3.5 py-3 flex flex-wrap items-center gap-3">
                  <span className="h-9 w-9 rounded-xl grid place-items-center bg-amber-50 text-amber-600"><Icon name={sc?.status === 'Sent' ? 'MailCheck' : 'Mail'} size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{sc?.status === 'Sent' ? `Sent to ${sc.supplierName} — awaiting response` : 'Not sent yet'}</div>
                    <div className="text-[12px] text-muted">{sc?.status === 'Sent' ? `${sc.email} · ${fmtDate(sc.sentAt?.slice(0, 10))}` : 'Choose a supplier, review the template and send the capability request.'}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sc?.status === 'Sent' && sc.token && <Button icon="ExternalLink" onClick={() => window.open(`/supplier-form/${sc.token}`, '_blank', 'noopener')}>Open the supplier form</Button>}
                    <Button variant="primary" icon="ArrowUpRight" onClick={() => { onClose(); nav(`/ideas/${idea.id}/supplier-check`) }}>{sc?.status === 'Sent' ? 'Open supplier check' : 'Start supplier check'}</Button>
                  </div>
                </div>
                {sc?.status === 'Sent' && sc.body && (
                  <details className="rounded-xl border border-line bg-white" open>
                    <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-semibold text-ink flex items-center gap-2"><Icon name="Mail" size={15} className="text-brand-600" />The email sent to {sc.supplierName}<span className="ml-auto text-[11.5px] font-normal text-muted">{sc.email}</span></summary>
                    <div className="px-3.5 pb-3">
                      <div className="text-[12.5px] font-semibold text-ink mb-1.5">{sc.subject}</div>
                      <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-2 rounded-lg bg-slate-50 border border-line p-3"><LinkText text={sc.body} /></pre>
                    </div>
                  </details>
                )}
              </div>
            )}
          </Block>
        )}

        {tab === 'decision' && (
          <Block title="Decision" icon="Gavel" hint={`Recommend sends the idea to the ${stageLabel(idea, STAGE.approval)}; reject drops it for good`}>
            <div className="grid gap-1.5 mb-3">
              {[
                { ok: !!ev?.cbaVerified, label: `Cost-benefit analysis verified${ev?.cbaVerified ? ` — ${inrShort(annual)} a year, payback ${saved.investment || saved.edited.includes('payback') ? `${saved.payback.toFixed(1)} months` : 'immediate'}` : ''}`, go: 'cba' as Tab },
                { ok: riskSaved, label: `Risk assessment saved${riskSaved ? ` — overall ${overallRisk(ev!.risks!)}, ${inrShort(riskTotal(ev!.risks!))} at risk` : ''}`, go: 'risk' as Tab },
                { ok: supplierOk, label: sc?.status === 'Skipped' ? 'Supplier capability check — skipped below ₹ 5 L' : sc?.status === 'Responded' ? `Supplier capability — ${sc.supplierName}: can supply ${sc.response?.canSupply}` : 'Supplier capability check — response awaited', go: 'supplier' as Tab },
              ].map((x) => (
                <button key={x.label} type="button" onClick={() => setTab(x.go)} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left hover:bg-slate-50">
                  <Mark ok={x.ok} warn /><span className={cn('text-[13px]', x.ok ? 'text-ink font-medium' : 'text-muted')}>{x.label}</span>
                </button>
              ))}
            </div>
            {!ready && <div className="text-[12px] text-amber-800 flex items-center gap-1.5 mb-2"><Icon name="Info" size={13} />Complete the three parts to recommend this idea.</div>}
            <div className="text-[12px] font-semibold text-ink-2 mb-1">Remarks <span className="font-normal text-muted">— required to reject or send back; optional when recommending</span></div>
            <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Recommended with a 200-unit pilot before full cut-over" />
            {ev?.decision && <div className="mt-2"><Badge color="var(--color-slate-500)">Earlier decision: {ev.decision}{ev.by ? ` · ${ev.by}` : ''}</Badge></div>}
          </Block>
        )}
      </div>
    </Modal>
  )
}
