// CO — Cost Optimisation home: the implementation side (everything after approval)
// LENS — Linked Evidence of Negotiation and Savings. Two views: the Dashboard (implementation KPIs, internal vs external
// ideas from MRN, portfolio plan vs actual) and Advanced analytics (implementation pipeline, execution health, realisation…).
import { useState } from 'react'
import { useMe } from '../../store/useStore'
import { useWarmup } from '../../components/ui'
import { HomeHeader, HomeSkeleton, Reveal, RevealGrid, ViewPills } from '../home/shared'
import { useScopeLabel } from '../home/cards'
import { useCoData } from './data'
import { HealthCard, PipelineCard } from './DashboardCards'
import { HeadlineKpis } from '../home/Kpis'
import { SourcesCard } from '../home/Sources'
import { useFitHeight } from '../home/fit'
import { PlanVsActualBlock, portfolioPlan } from '../idea/PlanVsActual'
import { Badge, Card } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { AgeingCard, DeliveryCard, LeakageCard, PhasingCard, RealisationLeadersCard, RealisedMonthlyCard, RouteMixCard, ValidationBacklogCard } from './AnalyticsCards'

export default function CoHome() {
  const ready = useWarmup(380)
  const me = useMe()
  const c = useCoData()
  const scope = useScopeLabel()
  const [view, setView] = useState<'dashboard' | 'advanced'>('dashboard')
  const [fitRef, fitH] = useFitHeight(300)
  if (!me) return null
  if (!ready) return <HomeSkeleton />

  const headerActions = <ViewPills value={view} onChange={setView} />

  return (
    <div>
      <HomeHeader
        subtitle={<><Badge color="var(--color-accent-500)">LENS</Badge> Linked Evidence of Negotiation and Savings · {c.fy} · {scope}</>}
        actions={headerActions} />

      {view === 'dashboard' ? (
        <RevealGrid className="grid grid-cols-12 gap-4">
          <Reveal className="col-span-12"><HeadlineKpis d={c.d} /></Reveal>
          {/* one screen at xl: where the savings come from beside plan vs actual, sized to the space left */}
          <Reveal className="col-span-12">
            <div ref={fitRef} style={fitH ? { height: fitH } : undefined} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-4">
              <SourcesCard fill={!!fitH} ideas={c.d.ideas.filter((i) => i.bucket === 'In Execution' || i.bucket === 'Implemented')} mode="CO" fy={c.fy} />
              <PortfolioPlanCard ideas={c.d.ideas} height={fitH ?? undefined} />
            </div>
          </Reveal>
        </RevealGrid>
      ) : (
        <RevealGrid className="grid grid-cols-12 gap-4">
          {/* moved from the dashboard: implementation pipeline + execution health */}
          <Reveal className="col-span-12 xl:col-span-7 xl:h-[max(380px,calc(100vh-330px))]"><PipelineCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-5 xl:h-[max(380px,calc(100vh-330px))]"><HealthCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-8"><RealisedMonthlyCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-4"><ValidationBacklogCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6 xl:col-span-4"><PhasingCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6 xl:col-span-4"><RouteMixCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6 xl:col-span-4"><AgeingCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6 xl:col-span-4"><DeliveryCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6 xl:col-span-4"><LeakageCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6 xl:col-span-4"><RealisationLeadersCard c={c} className="flex-1" /></Reveal>
        </RevealGrid>
      )}
    </div>
  )
}

/** Σ locked targets vs Σ MRN savings — the LENS view of plan vs actual */
/** `height`: the card fills that box (one-screen dashboard) and the chart takes what the figures leave */
function PortfolioPlanCard({ ideas, height }: { ideas: import('../../lib/types').Idea[]; height?: number }) {
  const fill = !!height
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const p = portfolioPlan(ideas, ledger, last)
  return (
    <Card title="Locked target vs MRN actual" icon="ChartLine" subtitle={`${p.ideas} ideas with a signed budget + timeline lock · actual savings from MRN only`} className={fill ? 'h-full overflow-hidden' : undefined}>
      <PlanVsActualBlock p={p} compact={fill} chartHeight={height ? Math.max(110, Math.min(260, height - 270)) : undefined} />
    </Card>
  )
}
