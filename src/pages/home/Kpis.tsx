// KPI tile rows for the Home (all workspaces) and the Innovation Network dashboard.
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore } from '../../store/useStore'
import { STAGE } from '../../lib/masters'
import { inrShort, pct } from '../../lib/format'
import { Count, Money } from '../../components/ui'
import { KpiTile, TileValue } from '../../components/KpiTile'
import type { HomeData } from './data'
import { useDrill } from './shared'

export const TONE = { brand: 'var(--color-brand-600)', done: 'var(--color-emerald-600)', muted: 'var(--color-slate-500)', risk: 'var(--color-accent-500)' }

/** realised savings per completed month (for the hero sparkline) */
export const realisedSpark = (d: HomeData) => d.trend.filter((t) => t.realised != null).map((t) => t.realised ?? 0)

/** Innovation Network — Pipeline (hero) · In execution · Implemented · Dropped */
export function InKpis({ d }: { d: HomeData }) {
  const drill = useDrill()
  const c = d.summary.counts, v = d.summary.values, f = d.flows
  const live = c.Pipeline + c['In Execution'] + c.Implemented
  const stageCount = (s: string) => d.active.filter((i) => i.stage === s).length
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiTile hero label="Pipeline · stages 2–4" icon="Filter" onClick={() => drill({ bucket: 'Pipeline' })} spark={f.Pipeline.values}
        tip="Ideas in Team feasibility check, evaluation or approval. ₹ = Σ annualised impact (part price × MRN volume). Trend = ₹ entering the pipeline each month.">
        <TileValue hero value={<Money value={v.Pipeline} />} sub={<><b className="text-white num">{c.Pipeline}</b> ideas · {stageCount(STAGE.feasibility)} feasibility · {stageCount(STAGE.evaluation)} evaluation · {stageCount(STAGE.approval)} approval</>} />
      </KpiTile>
      <KpiTile label="In execution" icon="Rocket" color={TONE.brand} onClick={() => drill({ bucket: 'In Execution' })} spark={f['In Execution'].values}
        tip="Approved with a signed budget + timeline lock and handed to Cost Optimisation (stage 5). Trend = ₹ approved each month.">
        <TileValue value={<Money value={v['In Execution']} />} unit="annualised" sub={<><b className="text-ink-2 num"><Count value={c['In Execution']} /></b> ideas · {pct(live ? (c['In Execution'] / live) * 100 : 0, 0)} of active</>} />
      </KpiTile>
      <KpiTile label="Implemented" icon="CircleCheckBig" color={TONE.done} onClick={() => drill({ bucket: 'Implemented' })} spark={f.Implemented.values}
        tip="Handed for verification (stage 6); verified when Finance confirms the locked target from MRN. Trend = ₹ implemented each month.">
        <TileValue value={<Money value={v.Implemented} />} unit="annualised" sub={<><b className="text-ink-2 num"><Count value={c.Implemented} /></b> ideas · {d.active.filter((i) => i.verification?.verifiedAt).length} verified</>} />
      </KpiTile>
      <KpiTile label="Dropped" icon="CircleSlash" color={TONE.muted} onClick={() => drill({ bucket: 'Dropped' })} spark={f.Dropped.values} goodWhenUp={false}
        tip="Dropped or rejected with a reason — closed for good; a fresh attempt is a new idea. Trend = ₹ dropped each month.">
        <TileValue value={<Money value={v.Dropped} />} unit="value left" sub={<><b className="text-ink-2 num"><Count value={c.Dropped} /></b> ideas · {pct(d.submitted ? (c.Dropped / d.submitted) * 100 : 0, 0)} drop rate</>} />
      </KpiTile>
    </div>
  )
}

/** Home — Pipeline · In execution · Implemented · Realised savings (hero, MRN) */
export function HomeKpis({ d }: { d: HomeData }) {
  const drill = useDrill()
  const nav = useNavigate()
  const setSpace = useStore((s) => s.setSpace)
  const c = d.summary.counts, v = d.summary.values, sm = d.summary, f = d.flows
  const vShare = sm.realised ? (sm.realisedValidated / sm.realised) * 100 : 0
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiTile label="Pipeline" icon="Filter" color={TONE.brand} onClick={() => { setSpace('IN'); drill({ bucket: 'Pipeline' }) }} spark={f.Pipeline.values} tip="Ideas in stages 2–4 (Innovation Network). ₹ = Σ annualised impact. Trend = ₹ entering the pipeline each month.">
        <TileValue value={<Money value={v.Pipeline} />} unit="annualised" sub={<><b className="text-ink-2 num"><Count value={c.Pipeline} /></b> ideas in IN</>} />
      </KpiTile>
      <KpiTile label="In execution" icon="Rocket" color={TONE.brand} onClick={() => { setSpace('CO'); nav('/execution') }} spark={f['In Execution'].values} tip="Stage 5 in Cost Optimisation — locked target, milestones and plan vs actual. ₹ = FY-phased committed hard savings.">
        <TileValue value={<Money value={d.committedExec} />} unit="committed" sub={<><b className="text-ink-2 num"><Count value={c['In Execution']} /></b> ideas · {inrShort(v['In Execution'])} annualised</>} />
      </KpiTile>
      <KpiTile label="Implemented" icon="CircleCheckBig" color={TONE.done} onClick={() => { setSpace('CO'); drill({ bucket: 'Implemented' }) }} spark={f.Implemented.values} tip="Stage 6 — handed for verification, then verified against the locked target.">
        <TileValue value={<Money value={v.Implemented} />} unit="annualised" sub={<><b className="text-ink-2 num"><Count value={c.Implemented} /></b> ideas · {d.active.filter((i) => i.verification?.verifiedAt).length} verified</>} />
      </KpiTile>
      <KpiTile hero label={`Realised · ${d.fy} (MRN)`} icon="BadgeIndianRupee" spark={realisedSpark(d)} onClick={() => { setSpace('CO'); nav('/proof') }} tip="(baseline − approved price) × MRN quantity from the first MRN at the new price. Validated = accepted by Finance.">
        <div className="text-[27px] leading-none font-bold tracking-[-0.02em]"><Money value={sm.realised} /></div>
        <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-white/15"><motion.div initial={{ width: 0 }} animate={{ width: `${vShare}%` }} transition={{ duration: 0.9 }} className="bg-white rounded-full" /></div>
        <div className="flex items-center justify-between gap-2 mt-2 text-[11.5px] text-white/80"><span className="truncate"><b className="text-white num">{inrShort(sm.realisedValidated)}</b> validated</span><span className="truncate"><b className="text-white num">{inrShort(Math.max(0, sm.realised - sm.realisedValidated))}</b> pending</span></div>
      </KpiTile>
    </div>
  )
}
