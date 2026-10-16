// CO · PROOF — Part-linked Realisation and Optimisation Output Framework.
// Every locked target traced to its parts and MRN: portfolio plan vs actual, then part-wise MRN savings, leakage and variance.
import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { useFilteredIdeas } from '../lib/hooks'
import type { Idea } from '../lib/types'
import { STAGE } from '../lib/masters'
import { partAnnualised } from '../lib/calc'
import { inLockWindow, planVsActual } from '../lib/workflow'
import { inrPrice, inrShort, num, sum } from '../lib/format'
import { Badge, Card, DataTable, PageHeader, Segmented, cn, type Column } from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { PlanVsActualBlock, portfolioPlan } from './idea/PlanVsActual'

interface PartRow { key: string; idea: Idea; partCode: string; description: string; supplier: string; baseline: number; approved: number; mrnQty: number; realised: number; leakage: number; planToDate: number; variance: number; status: 'Verified' | 'Awaiting verification' | 'In execution' }

export default function Proof() {
  const ideas = useFilteredIdeas()
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const openIdea = useStore((s) => s.openIdea)
  const [scope, setScope] = useState<'all' | 'execution' | 'verification'>('all')
  const locked = useMemo(() => ideas.filter((i) => i.lock && (i.bucket === 'In Execution' || i.bucket === 'Implemented') && (scope === 'all' || (scope === 'execution' ? i.stage === STAGE.execution : i.stage === STAGE.verification))), [ideas, scope])
  const pf = useMemo(() => portfolioPlan(locked, ledger, last), [locked, ledger, last])

  const rows = useMemo<PartRow[]>(() => locked.flatMap((i) => {
    const led = ledger.filter((l) => l.ideaId === i.id)
    const plan = planVsActual({ target: i.lock!.targetSaving, months: i.lock!.timelineMonths, startDate: i.lock!.startDate, ledger: led, lastActualMonth: last })
    const total = sum(i.parts.map((p) => partAnnualised(p))) || 1
    const status: PartRow['status'] = i.verification?.verifiedAt ? 'Verified' : i.stage === STAGE.verification ? 'Awaiting verification' : 'In execution'
    return i.parts.map((p) => {
      // MRN inside the locked savings period only — the same window as the plan it is compared with
      const pl = led.filter((l) => l.partCode === p.partCode && l.month <= last && inLockWindow(i.lock!, l.month))
      const realised = sum(pl.map((l) => l.realised))
      const planToDate = plan.planToDate * (partAnnualised(p) / total)
      return { key: `${i.id}-${p.partCode}`, idea: i, partCode: p.partCode, description: p.description, supplier: p.currentSupplier, baseline: p.baselinePrice, approved: p.approvedPrice ?? p.newPrice, mrnQty: sum(pl.map((l) => l.mrnQty)), realised, leakage: sum(pl.map((l) => l.leakage)), planToDate, variance: realised - planToDate, status }
    })
  }).sort((a, b) => b.realised - a.realised), [locked, ledger, last])

  const leakage = sum(rows.map((r) => r.leakage))
  const firstMrn = locked.filter((i) => !!i.execution?.effectiveDate).length
  const verified = locked.filter((i) => !!i.verification?.verifiedAt).length
  const STATUS_COLOR = { Verified: 'var(--color-emerald-600)', 'Awaiting verification': 'var(--color-orange-400)', 'In execution': 'var(--color-brand-700)' }
  const cols: Column<PartRow>[] = [
    { key: 'idea', label: 'Idea', value: (r) => r.idea.id, render: (r) => <button onClick={(e) => { e.stopPropagation(); openIdea(r.idea.id) }} className="font-mono text-[11.5px] font-semibold text-brand-700 hover:underline">{r.idea.id}</button> },
    { key: 'part', label: 'Part', value: (r) => r.partCode, render: (r) => <div className="min-w-[180px]"><div className="font-mono text-[12px] font-semibold">{r.partCode}</div><div className="text-[11.5px] text-muted truncate max-w-[240px]">{r.description}</div></div> },
    { key: 'supplier', label: 'Supplier', value: (r) => r.supplier, render: (r) => <span className="text-[12px] truncate max-w-[180px] inline-block">{r.supplier.split(' · ')[1] ?? r.supplier}</span> },
    { key: 'baseline', label: 'Baseline', align: 'right', value: (r) => r.baseline, render: (r) => <span className="num">{inrPrice(r.baseline)}</span> },
    { key: 'approved', label: 'Approved price', align: 'right', value: (r) => r.approved, render: (r) => <span className="num">{inrPrice(r.approved)}</span> },
    { key: 'mrnQty', label: 'MRN qty', align: 'right', value: (r) => r.mrnQty, render: (r) => <span className="num">{num(r.mrnQty)}</span> },
    { key: 'planToDate', label: 'Plan to date', align: 'right', value: (r) => Math.round(r.planToDate), render: (r) => <span className="num">{inrShort(r.planToDate)}</span> },
    { key: 'realised', label: 'Realised (MRN, lock window)', align: 'right', value: (r) => Math.round(r.realised), render: (r) => <b className="num">{inrShort(r.realised)}</b> },
    { key: 'variance', label: 'Variance', align: 'right', value: (r) => Math.round(r.variance), render: (r) => <span className={cn('num font-semibold', r.variance < 0 ? 'text-red-600' : 'text-emerald-700')}>{r.variance >= 0 ? '+' : ''}{inrShort(r.variance)}</span> },
    { key: 'leakage', label: 'Leakage', align: 'right', value: (r) => Math.round(r.leakage), render: (r) => <span className={cn('num', r.leakage > 0 ? 'text-red-600 font-semibold' : 'text-muted')}>{r.leakage > 0 ? inrShort(r.leakage) : '—'}</span> },
    { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge> },
  ]

  return (
    <div className="pb-8">
      <PageHeader icon="BadgeIndianRupee" title="Savings proof" badge={<Badge color="var(--color-accent-500)">PROOF</Badge>} fit
        subtitle="Part-linked Realisation and Optimisation Output Framework — every locked target traced to its parts and MRN"
        actions={<Segmented size="sm" value={scope} onChange={(k) => setScope(k as typeof scope)} options={[{ key: 'all', label: 'All' }, { key: 'execution', label: 'Execution started' }, { key: 'verification', label: 'Verification' }]} />} />
      <FilterBar compact className="mb-4" />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 mb-4">
        <Card title="Plan vs actual — all locked targets" icon="ChartLine" subtitle={`${pf.ideas} ideas with a signed budget + timeline lock · plan = locked target spread over the timeline · actual = MRN savings`}>
          <PlanVsActualBlock p={pf} />
        </Card>
        <div className="grid grid-cols-2 xl:grid-cols-1 gap-3 content-start">
          <Mini label="Ideas with first MRN" value={`${firstMrn} / ${locked.length}`} sub="savings counting from the first MRN at the new price" />
          <Mini label="Verified" value={`${verified}`} sub="business side confirmed the target" tone="good" />
          <Mini label="Price leakage" value={inrShort(leakage)} sub="MRN price above the approved price" tone={leakage > 0 ? 'bad' : undefined} />
          <Mini label="Part lines traced" value={`${rows.length}`} sub="each with baseline, approved price and MRN qty" />
        </div>
      </div>
      <Card title="Part-wise proof" icon="Boxes" subtitle="Within each locked savings period: realised = (baseline − approved price) × MRN quantity · plan to date shared by each part's forecast value" pad={false}>
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.key} onRowClick={(r) => openIdea(r.idea.id)} exportName="COIN_Savings_proof" maxHeight={620} />
      </Card>
    </div>
  )
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('text-[20px] font-bold num leading-tight', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>
      <div className="text-[11.5px] text-muted leading-snug">{sub}</div>
    </div>
  )
}
