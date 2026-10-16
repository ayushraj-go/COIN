// The headline KPI row — the same four tiles on the Home and on the Innovation Network and Cost Optimisation dashboards,
// for every role: Pipeline · In execution · Implemented · Realised savings (hero, MRN).
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore, useMe } from '../../store/useStore'
import { STAGE } from '../../lib/masters'
import { inrShort, todayIso } from '../../lib/format'
import { Count, Money } from '../../components/ui'
import { KpiTile, TileValue } from '../../components/KpiTile'
import type { HomeData } from './data'
import { drillUrl } from './shared'
import { kpiLinks, overdueExecutions, type KpiLink } from './headline'

export const TONE = { brand: 'var(--color-brand-600)', done: 'var(--color-emerald-600)', muted: 'var(--color-slate-500)', risk: 'var(--color-accent-500)' }

/** realised savings per completed month (for the hero sparkline) */
export const realisedSpark = (d: HomeData) => d.trend.filter((t) => t.realised != null).map((t) => t.realised ?? 0)

export function HeadlineKpis({ d }: { d: HomeData }) {
  const me = useMe()
  const nav = useNavigate()
  const filters = useStore((s) => s.filters)
  const setSpace = useStore((s) => s.setSpace)
  const links = kpiLinks(me)
  const go = (l: KpiLink) => { setSpace(l.space); nav(l.bucket ? drillUrl({ bucket: l.bucket }, l.base === '/ideas' ? filters : undefined, l.base) : l.base) }
  const c = d.summary.counts, v = d.summary.values, sm = d.summary, f = d.flows
  const stageCount = (s: string) => d.active.filter((i) => i.stage === s).length
  const overdue = overdueExecutions(d.active, todayIso()).length
  const vShare = sm.realised ? (sm.realisedValidated / sm.realised) * 100 : 0
  const ideas = (n: number) => <><b className="text-ink-2 num"><Count value={n} /></b> idea{n === 1 ? '' : 's'}</>
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiTile label="Pipeline" icon="Filter" color={TONE.brand} onClick={() => go(links.pipeline)} spark={f.Pipeline.values}
        tip="Stages 2–4 in the Innovation Network: team feasibility check, department evaluation and department approval. ₹ = Σ forecast impact (part price × MRN volume). Trend = ₹ entering the pipeline each month.">
        <TileValue value={<Money value={v.Pipeline} />} unit="forecast"
          sub={<>{ideas(c.Pipeline)} · {stageCount(STAGE.feasibility)} feasibility · {stageCount(STAGE.evaluation)} evaluation · {stageCount(STAGE.approval)} approval</>} />
      </KpiTile>
      <KpiTile label="In execution" icon="Rocket" color={TONE.brand} onClick={() => go(links.execution)} spark={f['In Execution'].values}
        tip="Stage 5 in Cost Optimisation — approved with a signed budget + timeline lock; milestones and plan vs actual. ₹ = FY-phased committed hard savings. Overdue = past the target date.">
        <TileValue value={<Money value={d.committedExec} />} unit="committed"
          sub={<>{ideas(c['In Execution'])} · {overdue ? <b className="text-accent-600 num">{overdue} overdue</b> : <>{inrShort(v['In Execution'])} forecast</>}</>} />
      </KpiTile>
      <KpiTile label="Implemented" icon="CircleCheckBig" color={TONE.done} onClick={() => go(links.implemented)} spark={f.Implemented.values}
        tip="Stage 6 — handed over for verification, then verified by Finance against the locked target from MRN. ₹ = forecast impact. Trend = ₹ implemented each month.">
        <TileValue value={<Money value={v.Implemented} />} unit="forecast" sub={<>{ideas(c.Implemented)} · {d.active.filter((i) => i.verification?.verifiedAt).length} verified</>} />
      </KpiTile>
      <KpiTile hero label={`Realised · ${d.fy} (MRN)`} icon="BadgeIndianRupee" spark={realisedSpark(d)} onClick={() => go(links.realised)}
        tip="(baseline − approved price) × MRN quantity from the first MRN at the new price. Validated = accepted by Finance.">
        <div className="text-[27px] leading-none font-bold tracking-[-0.02em]"><Money value={sm.realised} /></div>
        <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-white/15"><motion.div initial={{ width: 0 }} animate={{ width: `${vShare}%` }} transition={{ duration: 0.9 }} className="bg-white rounded-full" /></div>
        <div className="flex items-center justify-between gap-2 mt-2 text-[11.5px] text-white/80"><span className="truncate"><b className="text-white num">{inrShort(sm.realisedValidated)}</b> validated</span><span className="truncate"><b className="text-white num">{inrShort(Math.max(0, sm.realised - sm.realisedValidated))}</b> pending</span></div>
      </KpiTile>
    </div>
  )
}
