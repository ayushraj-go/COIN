// Value card — estimated vs approved vs realised, committed this FY, carry-over, payback, net saving (Section 4).
import type { ReactNode } from 'react'
import type { Idea } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { Card, Icon, InfoTip, Money, ProgressBar, Tooltip, cn } from '../../components/ui'
import { committedInFy, goLiveOf, ideaAnnualised, ideaApprovedAnnualised, ideaCommitted, ideaLeakage, ideaRealised, ideaSavingPct, netSaving, paybackMonths } from '../../lib/calc'
import { fmtDate, inr, inrShort, nextFy, quarterStart } from '../../lib/format'

export function useIdeaValue(idea: Idea) {
  const ledger = useStore((s) => s.ledger)
  const settings = useStore((s) => s.settings)
  const fy = settings.currentFy
  const est = ideaAnnualised(idea)
  const approvedStage = !!idea.approvedAt || idea.bucket === 'In Execution' || idea.bucket === 'Implemented'
  const appr = approvedStage ? ideaApprovedAnnualised(idea) : null
  const realised = ideaRealised(ledger, idea.id)
  const validated = ideaRealised(ledger, idea.id, true)
  const leakage = ideaLeakage(ledger, idea.id)
  const inv = idea.oneTimeInvestment || 0
  const basis = idea.bucket === 'Implemented' && appr != null ? appr : est
  let committed = 0
  let goLive = ''
  let projected = false
  if (idea.bucket === 'In Execution' || idea.bucket === 'Implemented') {
    committed = ideaCommitted(idea, fy)
    goLive = goLiveOf(idea)
  } else if (idea.bucket !== 'Dropped') {
    const [q, qfy] = (idea.expectedQuarter || '').split(' ')
    if (/^Q[1-4]$/.test(q) && /^FY\d\d$/.test(qfy)) {
      goLive = quarterStart(q, qfy)
      committed = qfy === fy ? committedInFy(est, goLive, fy) : qfy < fy ? est : 0
      projected = true
    }
  }
  const carry = idea.bucket === 'Dropped' ? 0 : Math.max(0, basis - committed)
  return {
    fy, est, appr, realised, validated, leakage, inv, basis, committed, goLive, projected, carry,
    payback: paybackMonths(basis, inv), net: netSaving(basis, inv), pct: ideaSavingPct(idea), financeValidation: settings.financeValidation,
  }
}

function Figure({ label, value, sub, color, tip, formula, muted }: { label: string; value: number | null; sub?: ReactNode; color: string; tip?: string; formula?: string; muted?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white px-2.5 py-2.5 pl-3 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}{(tip || formula) && <InfoTip title={label} formula={formula}>{tip}</InfoTip>}</div>
      <div className={cn('mt-1 text-[17px] font-bold tracking-tight leading-none whitespace-nowrap', value != null && value < 0 ? 'text-red-600' : 'text-ink')}>
        {value == null ? <span className="text-[13px] font-semibold text-muted">{muted}</span> : <Money value={value} />}
      </div>
      {sub && <div className="text-[11px] text-muted mt-1.5 truncate">{sub}</div>}
    </div>
  )
}

function Mini({ label, value, sub, tone, tip, formula }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; tip?: string; formula?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50/80 border border-slate-100 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted truncate">{label}{(tip || formula) && <InfoTip title={label} formula={formula}>{tip}</InfoTip>}</div>
      <div className="text-[13.5px] font-bold num mt-0.5 truncate" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="text-[10.5px] text-muted truncate">{sub}</div>}
    </div>
  )
}

export function ValueCard({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const v = useIdeaValue(idea)
  const max = Math.max(1, Math.abs(v.est), Math.abs(v.appr ?? 0), Math.abs(v.realised))
  const counts = idea.savingsType === 'Hard'
  const nfy = nextFy(v.fy)
  return (
    <Card title="Value" subtitle={compact ? undefined : `${idea.savingsType} saving · ${counts ? 'counts as hard savings' : 'reported separately from hard savings'}`} icon="IndianRupee"
      actions={idea.locked ? <Tooltip content="Approved values are locked; changes after approval need a change reason and re-approval above the set %."><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded px-1.5 h-5"><Icon name="Lock" size={11} />Locked</span></Tooltip> : undefined}>
      <div className={cn('grid gap-2', 'grid-cols-1 min-[420px]:grid-cols-3')}>
        <Figure label="Estimated" value={v.est} color="#4470d6" formula="(P(baseline) − P(new)) × Q(last FY MRN)" tip="Annualised impact at the estimated new price."
          sub={idea.scope === 'Open' ? 'Estimate for open idea' : `${v.pct.toFixed(1)}% on baseline spend`} />
        <Figure label="Approved" value={v.appr} muted={idea.bucket === 'Dropped' ? 'Not approved' : 'Pending approval'} color="#ec8a1c" formula="(P(baseline) − P(approved)) × Q(last FY MRN)" tip="Uses the approved revised price where available."
          sub={v.appr != null ? (idea.approvedAt ? `Approved ${fmtDate(idea.approvedAt.slice(0, 10))}` : 'At approved price') : undefined} />
        <Figure label="Realised FY to date" value={v.realised} color="#0f9f6e" formula="(P(baseline) − P(approved)) × Q(MRN after effective date)" tip="From actual MRN data only — never manual entry."
          sub={v.realised ? `${inrShort(v.validated)} validated by Finance` : idea.bucket === 'Implemented' ? 'Awaiting first MRN' : 'Starts after implementation'} />
      </div>

      {!compact && (
        <div className="mt-3 space-y-1.5">
          {[
            { k: 'Estimated', val: v.est, c: '#4470d6' },
            { k: 'Approved', val: v.appr ?? 0, c: '#ec8a1c' },
            { k: 'Realised', val: v.realised, c: '#0f9f6e' },
          ].map((b) => (
            <div key={b.k} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 text-muted">{b.k}</span>
              <ProgressBar value={(Math.max(0, b.val) / max) * 100} color={b.c} height={6} className="flex-1" />
              <span className="w-20 text-right num font-semibold text-ink-2">{inrShort(b.val)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={cn('grid gap-2 mt-3', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
        <Mini label={`Committed ${v.fy}`} value={idea.bucket === 'Dropped' ? '—' : inrShort(v.committed)} tone={v.projected ? '#64748b' : undefined}
          sub={v.projected ? `Projected · live ${v.goLive ? fmtDate(v.goLive) : idea.expectedQuarter}` : v.goLive ? `Go-live ${fmtDate(v.goLive)}` : undefined}
          formula="Annualised × months live in FY ÷ 12" tip="Saving expected inside the current FY, phased by quarter from the implementation date." />
        <Mini label={`Carry-over ${nfy}`} value={idea.bucket === 'Dropped' ? '—' : inrShort(v.carry)} formula="Annualised impact falling beyond 31 March" tip="Part of the annualised impact that falls in the next FY." />
        <Mini label="Payback" value={v.inv > 0 ? (v.payback > 0 ? (v.payback < 0.1 ? '< 0.1 months' : `${v.payback.toFixed(1)} months`) : 'No payback') : 'No investment'} tone={v.inv > 0 && v.payback > 12 ? '#ec8a1c' : undefined} formula="One-time investment ÷ (Annualised impact ÷ 12)" />
        {!compact && <Mini label="Net saving" value={inrShort(v.net)} tone={v.net < 0 ? '#e0364f' : undefined} formula="Annualised impact − One-time investment" />}
        {!compact && <Mini label="One-time investment" value={v.inv ? inr(v.inv) : '₹ 0'} sub="Tooling, trials, validation" tip="Tooling, validation, trial or changeover cost needed to implement the idea." />}
        {!compact && <Mini label="Validated realised" value={inrShort(v.validated)} sub={v.financeValidation ? 'Finance validated' : 'Finance validation off'} tip="Realised savings count as validated only after Finance validation." />}
      </div>

      {(v.leakage > 0 || !counts) && (
        <div className="mt-3 space-y-1.5">
          {v.leakage > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-2.5 py-2 text-[12px] text-red-700">
              <Icon name="TriangleAlert" size={14} className="shrink-0 mt-px" />
              <span><b>Price leakage {inrShort(v.leakage)}</b> — MRN price above the approved new price.</span>
            </div>
          )}
          {!counts && (
            <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-100 px-2.5 py-2 text-[12px] text-sky-800">
              <Icon name="Info" size={14} className="shrink-0 mt-px" />
              <span>{idea.savingsType === 'Cost avoidance' ? 'Cost avoidance' : 'One-time saving'} — tracked and reported separately from hard savings.</span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
