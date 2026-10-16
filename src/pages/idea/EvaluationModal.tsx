// Stage 3 — <dept> evaluation sheet: four steps the evaluator walks with Next — cost-benefit analysis (every figure
// editable: forecast, investment, go-live, payback, committed, carry-over, net savings and the quarter phasing), risk
// assessment, supplier capability (the check and its email, done right here) and the decision. The sheet fills the
// screen at a fixed height so each step lays out without scrolling.
import React, { useEffect, useState } from 'react'
import type { Idea, RiskItem, RiskLevel } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { RISK_FACTORS, STAGE } from '../../lib/masters'
import { cbaFigures, partAnnualised, partsForecast, savingPct, savingPerUnit } from '../../lib/calc'
import { needsSupplierCheck, overallRisk, riskTotal, stageLabel } from '../../lib/workflow'
import { fmtDate, inrPrice, inrShort, sum } from '../../lib/format'
import { Badge, Button, Icon, Modal, Money, cn } from '../../components/ui'
import { Block, Kpi, Mark } from './formKit'
import { SupplierCheckPanel } from './SupplierCheckPanel'

type Step = 'cba' | 'risk' | 'supplier' | 'decision'
const STEPS: Step[] = ['cba', 'risk', 'supplier', 'decision']
type Key = 'annual' | 'investment' | 'goLive' | 'payback' | 'committed' | 'carryOver' | 'netYear1' | 'net3yr'
const MONEY: Key[] = ['annual', 'investment', 'committed', 'carryOver', 'netYear1', 'net3yr']
const QS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
const RISK_COLOR: Record<RiskLevel, string> = { Low: 'var(--color-emerald-600)', Medium: 'var(--color-orange-400)', High: 'var(--color-accent-500)' }
const toast = () => useStore.getState().toast
const lakhs = (n: number) => String(+(n / 1e5).toFixed(2))
const blank = (v: string | null | undefined) => v == null || v.trim() === ''

/** One editable figure: the value (automatic until typed over), what COIN would use, and a way back to it */
function Figure({ label, unit, value, edited, onChange, onReset, how, type = 'number', ariaLabel }: {
  label: string; unit?: string; value: string; edited: boolean; onChange: (v: string) => void; onReset: () => void; how: string; type?: 'number' | 'date'; ariaLabel: string
}) {
  return (
    <div className={cn('rounded-xl border px-3 py-2 [@media(max-height:820px)]:py-1.5 min-w-0', edited ? 'border-brand-300 bg-brand-50/50' : 'border-line bg-white')}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[12px] font-semibold text-ink-2 truncate" title={how}>{label}</span>
        {edited ? <button type="button" onClick={onReset} className="text-[11px] font-semibold text-brand-700 hover:underline inline-flex items-center gap-1 shrink-0" title="Back to the automatic value"><Icon name="RotateCcw" size={11} />Auto</button>
          : <span className="text-[10.5px] font-semibold text-muted bg-slate-100 rounded px-1.5 shrink-0">Auto</span>}
      </div>
      <div className="relative">
        <input type={type} step={type === 'number' ? 'any' : undefined} aria-label={ariaLabel} className={cn('input num !h-9', unit && 'pr-14')} value={value} onChange={(e) => onChange(e.target.value)} />
        {unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] text-muted pointer-events-none">{unit}</span>}
      </div>
      <div className="text-[11px] text-muted mt-1 truncate [@media(max-height:820px)]:hidden" title={how}>{how}</div>
    </div>
  )
}

export function EvaluationModal({ idea, open, onClose, tab: initialStep = 'cba' }: { idea: Idea; open: boolean; onClose: () => void; tab?: Step }) {
  const fy = useStore((s) => s.settings.currentFy)
  const ev = idea.evaluation
  const sc = ev?.supplier
  const saved = cbaFigures(idea, fy)
  const [step, setStep] = useState<Step>(initialStep)
  const [ov, setOv] = useState<Partial<Record<Key, string>>>({})
  const [ph, setPh] = useState<(string | null)[]>([null, null, null, null])
  const [cbaNote, setCbaNote] = useState('')
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [riskRemarks, setRiskRemarks] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => {
    if (!open) return
    const x = ev?.cbaInputs ?? {}
    const o: Partial<Record<Key, string>> = {}
    MONEY.forEach((k) => { const v = x[k as keyof typeof x]; if (typeof v === 'number') o[k] = lakhs(v) })
    if (x.goLive) o.goLive = x.goLive
    if (x.payback != null) o.payback = String(+x.payback.toFixed(1))
    setOv(o); setPh(x.phasing ? QS.map((q) => lakhs(x.phasing![q])) : [null, null, null, null])
    setStep(initialStep); setCbaNote(ev?.cbaNote ?? ''); setRiskRemarks(ev?.riskRemarks ?? ''); setRemarks('')
    setRisks(RISK_FACTORS.map((f) => ev?.risks?.find((r) => r.key === f.key) ?? { key: f.key, label: f.label, level: 'Low', costAtRisk: 0 }))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // the figures as currently entered: a blank field is automatic
  const money = (k: Key) => (blank(ov[k]) ? undefined : Math.max(0, Number(ov[k]) || 0) * 1e5)
  const typed = { annual: money('annual'), investment: money('investment'), committed: money('committed'), carryOver: money('carryOver'), netYear1: blank(ov.netYear1) ? undefined : (Number(ov.netYear1) || 0) * 1e5, net3yr: blank(ov.net3yr) ? undefined : (Number(ov.net3yr) || 0) * 1e5, goLive: blank(ov.goLive) ? undefined : ov.goLive, payback: blank(ov.payback) ? undefined : Math.max(0, Number(ov.payback) || 0) }
  const withInputs = (cbaInputs: NonNullable<NonNullable<Idea['evaluation']>['cbaInputs']>) => ({ ...idea, evaluation: { ...(ev ?? { dept: '' }), cbaInputs } })
  const f0 = cbaFigures(withInputs(typed), fy)
  const phasing = ph.some((v) => !blank(v)) ? { Q1: 0, Q2: 0, Q3: 0, Q4: 0, ...Object.fromEntries(QS.map((q, k) => [q, blank(ph[k]) ? f0.auto.phasing[q] : Math.max(0, Number(ph[k]) || 0) * 1e5])) } as Record<(typeof QS)[number], number> : undefined
  const f = phasing ? { ...f0, phasing } : f0
  const autoOf: Record<Key, string> = {
    annual: lakhs(f.auto.annual), investment: lakhs(f.auto.investment), goLive: f.auto.goLive, payback: f.investment ? String(+f.auto.payback.toFixed(1)) : '0',
    committed: lakhs(f.auto.committed), carryOver: lakhs(f.auto.carryOver), netYear1: lakhs(f.auto.netYear1), net3yr: lakhs(f.auto.net3yr),
  }
  const shown = (k: Key) => ov[k] ?? autoOf[k]
  const set = (k: Key) => (v: string) => setOv((o) => ({ ...o, [k]: v }))
  const reset = (k: Key) => () => setOv((o) => { const n = { ...o }; delete n[k]; return n })
  const isEdited = (k: Key) => ov[k] != null

  const annual = f.annual
  const paybackText = f.investment || !blank(ov.payback) ? `${f.payback.toFixed(1)} months` : 'Immediate'
  const atRisk = riskTotal(risks)
  const riskSaved = !!ev?.risks?.length
  const supplierOk = sc?.status === 'Responded' || sc?.status === 'Skipped' || !needsSupplierCheck(annual)
  const ready = !!ev?.cbaVerified && riskSaved && supplierOk
  const deptLabel = stageLabel(idea, STAGE.evaluation)
  const spendToday = sum(idea.parts.map((p) => p.baselinePrice * p.annualVolume))
  const phSum = sum(QS.map((q) => f.phasing[q]))
  const changed = f0.edited.length + (phasing ? 1 : 0)

  // Next saves quietly — the step bar's check mark shows it; Save says so in a toast
  const saveCba = (verify: boolean, quiet = false) => {
    // only what the evaluator typed over is stored; everything else stays automatic
    const cbaInputs = { ...typed, phasing }
    useStore.getState().saveEvaluation(idea.id, { cbaVerified: verify || !!ev?.cbaVerified, cbaNote: cbaNote.trim() || undefined, cbaInputs })
    if (!quiet) toast()(verify ? 'Cost-benefit analysis verified and saved' : 'Cost-benefit analysis saved')
  }
  const saveRisk = (quiet = false) => { useStore.getState().saveEvaluation(idea.id, { risks, riskRemarks: riskRemarks.trim() || undefined }); if (!quiet) toast()(`Risk assessment saved — overall ${overallRisk(risks)}, ${inrShort(riskTotal(risks))} at risk`) }
  const decide = (d: 'Recommend' | 'Reject') => {
    useStore.getState().recordEvaluation(idea.id, d, remarks.trim() || undefined)
    toast()(d === 'Recommend' ? `${idea.id} recommended — sent for ${stageLabel(idea, STAGE.approval)}` : `${idea.id} rejected at ${deptLabel} — dropped for good`, d === 'Recommend' ? 'success' : 'warning')
    onClose()
  }
  const sendBack = () => { useStore.getState().sendBack(idea.id, remarks.trim()); toast()(`${idea.id} sent back to the Team feasibility check`, 'warning'); onClose() }

  const steps: { key: Step; label: string; icon: string; done: boolean }[] = [
    { key: 'cba', label: 'Cost-benefit analysis', icon: 'Calculator', done: !!ev?.cbaVerified },
    { key: 'risk', label: 'Risk assessment', icon: 'ShieldAlert', done: riskSaved },
    { key: 'supplier', label: 'Supplier capability', icon: 'Factory', done: supplierOk },
    { key: 'decision', label: 'Decision', icon: 'Gavel', done: false },
  ]
  const idx = STEPS.indexOf(step)
  const go = (k: number) => setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, k))])
  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} className="mr-auto">Close</Button>
      {idx > 0 && <Button icon="ArrowLeft" onClick={() => go(idx - 1)}>Back</Button>}
      {step === 'cba' && <><Button icon="Save" onClick={() => saveCba(false)}>Save</Button><Button variant="primary" iconRight="ArrowRight" onClick={() => { saveCba(true, true); go(1) }}>Verify &amp; next</Button></>}
      {step === 'risk' && <><Button icon="Save" onClick={() => saveRisk()}>Save</Button><Button variant="primary" iconRight="ArrowRight" onClick={() => { saveRisk(true); go(2) }}>Save &amp; next</Button></>}
      {step === 'supplier' && <Button variant="primary" iconRight="ArrowRight" onClick={() => go(3)}>Next</Button>}
      {step === 'decision' && <>
        <Button variant="ghost" icon="Undo2" disabled={!remarks.trim()} onClick={sendBack}>Send back to feasibility</Button>
        <Button variant="danger" icon="CircleX" disabled={!remarks.trim()} onClick={() => decide('Reject')}>Reject</Button>
        <Button variant="success" icon="CircleCheck" disabled={!ready} onClick={() => decide('Recommend')}>Recommend for {stageLabel(idea, STAGE.approval)}</Button>
      </>}
    </>
  )

  return (
    <Modal open={open} onClose={onClose} size="full" icon="FlaskConical" title={`${deptLabel} — evaluation sheet`} subtitle={`${idea.id} · ${idea.title}`} footer={footer}>
      <div className="flex flex-col gap-2.5 h-full min-h-0 [@media(max-height:820px)]:[&_.block-hint]:hidden [@media(max-height:820px)]:[&_.kpi-sub]:hidden" data-testid="evaluation-sheet" data-step={step}>
        {/* summary strip — follows the figures as they are typed */}
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-2 shrink-0 [@media(max-height:700px)]:hidden">
          <Kpi label="Forecast saving / year" value={<Money value={annual} />} sub={isEdited('annual') ? `changed · parts ${inrShort(f.auto.annual)}` : idea.parts.length ? `${idea.parts.length} part${idea.parts.length === 1 ? '' : 's'}` : 'open idea'} />
          <Kpi label="One-time investment" value={<Money value={f.investment} />} sub={isEdited('investment') ? 'changed by the evaluator' : 'from the idea'} />
          <Kpi label="Payback" value={paybackText} />
          <Kpi label={`Committed ${fy}`} value={<Money value={f.committed} />} sub={`live from ${fmtDate(f.goLive)}`} />
          <Kpi label="Overall risk" value={riskSaved ? <span style={{ color: RISK_COLOR[overallRisk(ev!.risks!)] }}>{overallRisk(ev!.risks!)}</span> : 'To assess'} sub={riskSaved ? `${inrShort(riskTotal(ev!.risks!))} at risk` : undefined} />
          <Kpi label="Supplier check" value={sc?.status === 'Responded' ? `Can supply: ${sc.response?.canSupply}` : !needsSupplierCheck(annual) ? 'Not needed' : sc?.status ?? 'Not sent'} tone={sc?.status === 'Responded' ? 'good' : undefined} sub={sc?.supplierName} />
        </div>

        {/* stepper */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto" role="tablist">
          {steps.map((t, k) => (
            <React.Fragment key={t.key}>
              {k > 0 && <span className={cn('h-px w-5 shrink-0', steps[k - 1].done ? 'bg-emerald-400' : 'bg-slate-200')} />}
              <button type="button" role="tab" aria-selected={step === t.key} onClick={() => setStep(t.key)} className={cn('h-9 pl-1.5 pr-3 rounded-lg border text-[12.5px] font-semibold inline-flex items-center gap-2 shrink-0 transition-colors', step === t.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-ink-2 hover:border-slate-300')}>
                <span className={cn('h-6 w-6 rounded-md grid place-items-center text-[11.5px] font-bold', step === t.key ? 'bg-white/20' : t.done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-muted')}>{t.done && step !== t.key ? <Icon name="Check" size={13} strokeWidth={3} /> : k + 1}</span>
                {t.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 min-h-0">
          {step === 'cba' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 h-full min-h-0">
              <div className="flex flex-col gap-3 min-h-0">
                <Block title="Part-wise saving" icon="Table2" hint="Cost today and after the change for every part">
                  {idea.parts.length ? (
                    <div className="rounded-lg border border-line overflow-auto max-h-[230px]">
                      <table className="tbl">
                        <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Volume / yr</th><th style={{ textAlign: 'right' }}>Today</th><th style={{ textAlign: 'right' }}>New</th><th style={{ textAlign: 'right' }}>Saving / unit</th><th style={{ textAlign: 'right' }}>Spend / yr</th><th style={{ textAlign: 'right' }}>Forecast / yr</th></tr></thead>
                        <tbody>
                          {idea.parts.map((p) => (
                            <tr key={p.partCode}>
                              <td><div className="font-mono text-[12px] font-semibold">{p.partCode}</div><div className="text-[11.5px] text-muted truncate max-w-[200px]" title={p.description}>{p.description}</div></td>
                              <td className="num" style={{ textAlign: 'right' }}>{p.annualVolume.toLocaleString('en-IN')}<div className="text-[10.5px] text-muted">{p.uom}</div></td>
                              <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.baselinePrice)}<div className="text-[10.5px] text-muted">{p.baselineSource}</div></td>
                              <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.newPrice)}</td>
                              <td className="num" style={{ textAlign: 'right' }}>{inrPrice(savingPerUnit(p))}<div className="text-[10.5px] text-muted">{savingPct(p).toFixed(2)}%</div></td>
                              <td className="num" style={{ textAlign: 'right' }}>{inrShort(p.baselinePrice * p.annualVolume)}</td>
                              <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(partAnnualised(p))}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 font-semibold"><td colSpan={5}>Total of the parts</td><td className="num" style={{ textAlign: 'right' }}>{inrShort(spendToday)}</td><td className="num" style={{ textAlign: 'right' }}>{inrShort(partsForecast(idea))}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12.5px] text-muted">Open idea — valued by the estimate of {inrShort(partsForecast(idea))} a year.</div>}
                  {isEdited('annual') && <div className="mt-2 text-[12px] text-brand-800 flex items-center gap-1.5"><Icon name="PencilLine" size={13} />Forecast set at evaluation: <b className="num">{inrShort(annual)}</b> a year — used for the approval and the locked target.</div>}
                </Block>
                <Block title={`Quarter phasing ${fy}`} icon="CalendarRange" hint={`Saving expected in each quarter — adds up to ${inrShort(phSum)}${Math.abs(phSum - f.committed) > 1000 ? ` (committed ${inrShort(f.committed)})` : ''}`}
                  right={ph.some((v) => !blank(v)) ? <button type="button" onClick={() => setPh([null, null, null, null])} className="text-[11.5px] font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"><Icon name="RotateCcw" size={11} />Auto</button> : <span className="text-[10.5px] font-semibold text-muted bg-slate-100 rounded px-1.5">Auto</span>}>
                  <div className="grid grid-cols-4 gap-2">
                    {QS.map((q, k) => (
                      <label key={q} className={cn('rounded-lg border px-2 py-1.5 flex items-center gap-2', !blank(ph[k]) ? 'border-brand-300 bg-brand-50/50' : 'border-line bg-slate-50')}>
                        <span className="text-[11.5px] font-semibold text-muted">{q}</span>
                        <div className="relative flex-1 min-w-0"><input type="number" step="any" aria-label={`Phasing ${q}`} className="input num !h-8 pr-6 text-right" value={ph[k] ?? lakhs(f.phasing[q])} onChange={(e) => setPh((x) => x.map((v, j) => (j === k ? e.target.value : v)))} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">L</span></div>
                      </label>
                    ))}
                  </div>
                </Block>
                <input className="input shrink-0" aria-label="Evaluator note" value={cbaNote} onChange={(e) => setCbaNote(e.target.value)} placeholder="Evaluator note (optional) — e.g. volume confirmed with planning for FY27" />
              </div>

              <Block title="Financial case — change any figure" icon="SlidersHorizontal" hint="Every value starts automatic; type over it if the evaluation finds a different number. Saved with the evaluation and used at approval.">
                <div className="grid grid-cols-2 gap-2">
                  <Figure label="Forecast saving / year" unit="₹ lakh" ariaLabel="Forecast saving per year" value={shown('annual')} edited={isEdited('annual')} onChange={set('annual')} onReset={reset('annual')} how={`Auto: total of the parts, ${inrShort(f.auto.annual)}`} />
                  <Figure label="One-time investment" unit="₹ lakh" ariaLabel="One-time investment" value={shown('investment')} edited={isEdited('investment')} onChange={set('investment')} onReset={reset('investment')} how={`Auto: from the idea, ${inrShort(f.auto.investment)} (tooling, trials, validation)`} />
                  <Figure label="Go-live (savings start)" type="date" ariaLabel="Go-live" value={shown('goLive')} edited={isEdited('goLive')} onChange={set('goLive')} onReset={reset('goLive')} how={`Auto: expected quarter ${idea.expectedQuarter || '—'}, ${fmtDate(f.auto.goLive)}`} />
                  <Figure label="Payback" unit="months" ariaLabel="Payback months" value={shown('payback')} edited={isEdited('payback')} onChange={set('payback')} onReset={reset('payback')} how="Auto: investment ÷ (forecast ÷ 12)" />
                  <Figure label={`Committed in ${fy}`} unit="₹ lakh" ariaLabel="Committed this FY" value={shown('committed')} edited={isEdited('committed')} onChange={set('committed')} onReset={reset('committed')} how="Auto: forecast − carry-over to next FY" />
                  <Figure label="Carry-over to next FY" unit="₹ lakh" ariaLabel="Carry-over" value={shown('carryOver')} edited={isEdited('carryOver')} onChange={set('carryOver')} onReset={reset('carryOver')} how="Auto: forecast falling after 31 March, from the go-live" />
                  <Figure label="Net saving · year 1" unit="₹ lakh" ariaLabel="Net saving year 1" value={shown('netYear1')} edited={isEdited('netYear1')} onChange={set('netYear1')} onReset={reset('netYear1')} how="Auto: forecast − one-time investment" />
                  <Figure label="3-year saving, net" unit="₹ lakh" ariaLabel="Three-year net saving" value={shown('net3yr')} edited={isEdited('net3yr')} onChange={set('net3yr')} onReset={reset('net3yr')} how="Auto: forecast × 3 − one-time investment" />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
                  <span>Benefit / cost (3 yr) <b className="text-ink num">{f.investment ? `${((annual * 3) / f.investment).toFixed(1)}×` : '—'}</b></span>
                  <span>Saving on spend <b className="text-ink num">{spendToday ? `${((annual / spendToday) * 100).toFixed(2)}%` : '—'}</b></span>
                  <span>Risk-adjusted saving <b className="text-ink num">{inrShort(annual - (ev?.risks ? riskTotal(ev.risks) : 0))}</b></span>
                  {changed > 0 && <span className="text-brand-700 font-semibold">{changed} figure{changed === 1 ? '' : 's'} changed</span>}
                </div>
              </Block>
            </div>
          )}

          {step === 'risk' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 h-full min-h-0">
              <Block title="Risk register" icon="ShieldAlert" hint="Rate each factor and put a value on what could be lost">
                <div className="grid gap-2">
                  {risks.map((r, k) => (
                    <div key={r.key} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_160px] gap-2 items-center rounded-xl border border-line bg-white px-3 py-2">
                      <div className="min-w-0"><div className="text-[13px] font-semibold text-ink">{r.label}</div><div className="text-[11.5px] text-muted truncate">{RISK_FACTORS[k]?.hint}</div></div>
                      <div className="flex gap-1">
                        {(['Low', 'Medium', 'High'] as RiskLevel[]).map((l) => (
                          <button key={l} type="button" onClick={() => setRisks((x) => x.map((y, j) => (j === k ? { ...y, level: l } : y)))}
                            className={cn('h-8 px-2.5 rounded-lg border text-[12px] font-semibold', r.level === l ? 'text-white' : 'bg-white text-ink-2 border-line')} style={r.level === l ? { background: RISK_COLOR[l], borderColor: RISK_COLOR[l] } : undefined}>{l}</button>
                        ))}
                      </div>
                      <label className="flex items-center gap-1.5"><span className="text-[11px] text-muted whitespace-nowrap">₹ at risk (L)</span>
                        <input type="number" min="0" step="0.1" aria-label={`${r.label} at risk`} className="input num !h-8 text-right" value={r.costAtRisk ? +(r.costAtRisk / 1e5).toFixed(2) : ''} onChange={(e) => setRisks((x) => x.map((y, j) => (j === k ? { ...y, costAtRisk: Math.max(0, Number(e.target.value) || 0) * 1e5 } : y)))} placeholder="0" />
                      </label>
                    </div>
                  ))}
                </div>
              </Block>
              <div className="flex flex-col gap-3 min-h-0">
                <div className="grid grid-cols-3 xl:grid-cols-1 gap-2">
                  <Kpi label="Overall risk" value={<span style={{ color: RISK_COLOR[overallRisk(risks)] }}>{overallRisk(risks)}</span>} />
                  <Kpi label="Total ₹ at risk" value={<Money value={atRisk} />} tone={atRisk > annual * 0.1 ? 'bad' : undefined} />
                  <Kpi label="Risk-adjusted saving" value={<Money value={annual - atRisk} />} />
                </div>
                <label className="flex flex-col gap-1 flex-1 min-h-0"><span className="text-[12px] font-semibold text-ink-2">Mitigation</span>
                  <textarea className="input flex-1 min-h-[90px] resize-none text-[12.5px]" aria-label="Mitigation" value={riskRemarks} onChange={(e) => setRiskRemarks(e.target.value)} placeholder="e.g. 200-unit pilot, phased cut-over, dual source for 3 months" />
                </label>
              </div>
            </div>
          )}

          {step === 'supplier' && <SupplierCheckPanel idea={idea} embedded />}

          {step === 'decision' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 h-full min-h-0">
              <Block title="Before deciding" icon="ListChecks" hint={`Recommend sends the idea to the ${stageLabel(idea, STAGE.approval)}; reject drops it for good`}>
                <div className="grid gap-1.5">
                  {[
                    { ok: !!ev?.cbaVerified, label: `Cost-benefit analysis verified${ev?.cbaVerified ? ` — ${inrShort(saved.annual)} a year, payback ${saved.investment || saved.edited.includes('payback') ? `${saved.payback.toFixed(1)} months` : 'immediate'}` : ''}`, go: 0 },
                    { ok: riskSaved, label: `Risk assessment saved${riskSaved ? ` — overall ${overallRisk(ev!.risks!)}, ${inrShort(riskTotal(ev!.risks!))} at risk` : ''}`, go: 1 },
                    { ok: supplierOk, label: !needsSupplierCheck(annual) || sc?.status === 'Skipped' ? 'Supplier capability check — not needed below ₹ 5 L' : sc?.status === 'Responded' ? `Supplier capability — ${sc.supplierName}: can supply ${sc.response?.canSupply}` : sc?.status === 'Sent' ? `Supplier capability — answer awaited from ${sc.supplierName}` : 'Supplier capability check — not sent yet', go: 2 },
                  ].map((x) => (
                    <button key={x.label} type="button" onClick={() => go(x.go)} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left hover:bg-slate-50">
                      <Mark ok={x.ok} warn /><span className={cn('text-[13px]', x.ok ? 'text-ink font-medium' : 'text-muted')}>{x.label}</span><Icon name="ChevronRight" size={14} className="ml-auto text-muted" />
                    </button>
                  ))}
                </div>
                {!ready && <div className="mt-2 text-[12px] text-amber-800 flex items-center gap-1.5"><Icon name="Info" size={13} />Complete the three steps to recommend this idea.</div>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Kpi label="Forecast saving / year" value={<Money value={saved.annual} />} />
                  <Kpi label={`Committed ${fy}`} value={<Money value={saved.committed} />} />
                  <Kpi label="Net saving · year 1" value={<Money value={saved.netYear1} />} tone={saved.netYear1 >= 0 ? 'good' : 'bad'} />
                  <Kpi label="3-year saving, net" value={<Money value={saved.net3yr} />} />
                </div>
              </Block>
              <div className="flex flex-col gap-2 min-h-0">
                <label className="flex flex-col gap-1 flex-1 min-h-0"><span className="text-[12px] font-semibold text-ink-2">Remarks <span className="font-normal text-muted">— required to reject or send back; optional when recommending</span></span>
                  <textarea className="input flex-1 min-h-[110px] resize-none" aria-label="Decision remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Recommended with a 200-unit pilot before full cut-over" />
                </label>
                {ev?.decision && <div><Badge color="var(--color-slate-500)">Earlier decision: {ev.decision}{ev.by ? ` · ${ev.by}` : ''}</Badge></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
