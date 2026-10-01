// CO — Cost Optimisation home: the implementation side (everything after approval)
// Two views: the one-screen Dashboard (four implementation KPIs, implementation pipeline, execution health) and
// Advanced analytics — execution & realisation only (realisation, Finance validation, route mix, ageing, delivery, leakage).
import { useState } from 'react'
import { useMe } from '../../store/useStore'
import { useWarmup } from '../../components/ui'
import { HomeHeader, HomeSkeleton, Reveal, RevealGrid, ViewPills } from '../home/shared'
import { useScopeLabel } from '../home/cards'
import { useCoData } from './data'
import { CoKpis, HealthCard, PipelineCard } from './DashboardCards'
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
        subtitle={<>Cost Optimisation · implementation &amp; realised savings · {c.fy} · {scope}</>}
        actions={headerActions} />

      {view === 'dashboard' ? (
        <RevealGrid className="grid grid-cols-12 gap-4">
          <Reveal className="col-span-12"><CoKpis c={c} /></Reveal>
          <Reveal className="col-span-12 xl:col-span-7 xl:h-[max(380px,calc(100vh-330px))]"><PipelineCard c={c} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-5 xl:h-[max(380px,calc(100vh-330px))]"><HealthCard c={c} className="flex-1" /></Reveal>
        </RevealGrid>
      ) : (
        <RevealGrid className="grid grid-cols-12 gap-4">
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
