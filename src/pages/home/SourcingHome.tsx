// M1 — Dashboard for every department ID, the Central ID and Finance
// One page: the headline KPI tiles + internal vs external ideas fill the first screen, the analytics follow below.
// Work waiting for the user lives in My queue.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import type { Bucket } from '../../lib/types'
import { Button, useWarmup } from '../../components/ui'
import { useHomeData } from './data'
import { HomeHeader, HomeSkeleton, Reveal, RevealGrid } from './shared'
import { RealisationCard, SavingsToValidateCard, TopIdeasCard } from './cards'
import { CommodityHeatCard, DepartmentCard, FunnelCard, LeverMixCard, PortfolioCard, TrendCard } from './charts'
import { SlaWatchCard } from './MyActions'
import { HeadlineKpis } from './Kpis'
import { SourcesCard } from './Sources'
import { Leaderboard } from './Leaderboard'
import { useFitHeight } from './fit'

export type SourcingVariant = 'sourcing' | 'finance' | 'mgmt'

export default function SourcingHome({ variant }: { variant: SourcingVariant }) {
  const ready = useWarmup(380)
  const me = useMe()
  const nav = useNavigate()
  const d = useHomeData()
  const settings = useStore((s) => s.settings)
  const [sel, setSel] = useState<Bucket | null>(null)
  const clear = () => setSel(null)
  const lb = settings.leaderboardVisible
  const [fitRef, fitH] = useFitHeight(300)
  if (!me) return null
  if (!ready) return <HomeSkeleton />

  const headerActions = variant === 'mgmt' ? <Button variant="secondary" icon="FileText" onClick={() => nav('/reports')}>Monthly report</Button> : undefined

  return (
    <div>
      <HomeHeader actions={headerActions} />

      <RevealGrid className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12"><HeadlineKpis d={d} /></Reveal>
        <Reveal className="col-span-12"><div ref={fitRef} style={fitH ? { height: fitH } : undefined}><SourcesCard fill={!!fitH} ideas={d.active.filter((i) => i.bucket !== 'Dropped')} mode="IN" fy={d.fy} /></div></Reveal>
        {/* idea portfolio + SLA watch */}
        <Reveal className="col-span-12 xl:col-span-7"><PortfolioCard d={d} className="flex-1" /></Reveal>
        <Reveal className="col-span-12 xl:col-span-5">{variant === 'finance' ? <SavingsToValidateCard d={d} className="flex-1" /> : <SlaWatchCard className="flex-1" />}</Reveal>
        {/* department-wise */}
        <Reveal className="col-span-12"><DepartmentCard d={d} className="flex-1" /></Reveal>
        {/* trend + funnel */}
        <Reveal className="col-span-12 xl:col-span-8"><TrendCard d={d} height={262} className="flex-1" /></Reveal>
        <Reveal className="col-span-12 xl:col-span-4"><FunnelCard d={d} sel={sel} onClear={clear} className="flex-1" /></Reveal>
        {/* top ideas + category mix */}
        <Reveal className="col-span-12 lg:col-span-6"><TopIdeasCard d={d} sel={sel} onClear={clear} className="flex-1" /></Reveal>
        <Reveal className="col-span-12 lg:col-span-6"><LeverMixCard d={d} sel={sel} onClear={clear} className="flex-1" /></Reveal>
        {/* top commodities (full list lives in MIS) + leaderboard / realisation */}
        <Reveal className="col-span-12 xl:col-span-8"><CommodityHeatCard d={d} limit={6} className="flex-1" /></Reveal>
        <Reveal className="col-span-12 xl:col-span-4">{variant === 'finance' || !lb ? <RealisationCard d={d} className="flex-1" /> : <Leaderboard limit={5} className="flex-1" />}</Reveal>
      </RevealGrid>
    </div>
  )
}
