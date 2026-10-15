// CO — Cost Optimisation home: the implementation side (everything after approval)
// LENS — Linked Evidence of Negotiation and Savings. Two views: the Dashboard (implementation KPIs, internal vs external
// ideas from MRN, portfolio plan vs actual) and Advanced analytics (implementation pipeline, execution health, realisation…).
import { useState } from 'react'
import { useMe } from '../../store/useStore'
import { useWarmup } from '../../components/ui'
import { HomeHeader, HomeSkeleton, Reveal, RevealGrid, ViewPills } from '../home/shared'
import { useScopeLabel } from '../home/cards'
import { useCoData } from './data'
import { CoKpis, HealthCard, PipelineCard } from './DashboardCards'
import { SourcesCard } from '../home/Sources'
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
  if (!me) return null
  if (!ready) return <HomeSkeleton />

  const headerActions = <ViewPills value={view} onChange={setView} />

  return (
    <div>
      <HomeHeader
        subtitle={<><Badge color="#d7192d">LENS</Badge> Linked Evidence of Negotiation and Savings · stages 5–6 · {c.fy} · {scope}</>}
        actions={headerActions} />

      {view === 'dashboard' ? (
        <RevealGrid className="grid grid-cols-12 gap-4">
          <Reveal className="col-span-12"><CoKpis c={c} /></Reveal>
          <Reveal className="col-span-12"><SourcesCard ideas={c.d.ideas.filter((i) => i.bucket === 'In Execution' || i.bucket === 'Implemented')} mode="CO" fy={c.fy} /></Reveal>
          <Reveal className="col-span-12"><PortfolioPlanCard ideas={c.d.ideas} /></Reveal>
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
function PortfolioPlanCard({ ideas }: { ideas: import('../../lib/types').Idea[] }) {
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const p = portfolioPlan(ideas, ledger, last)
  return (
    <Card title="Plan vs actual — locked targets" icon="ChartLine" subtitle={`${p.ideas} ideas with a signed budget + timeline lock · actuals from MRN`}>
      <PlanVsActualBlock p={p} />
    </Card>
  )
}
