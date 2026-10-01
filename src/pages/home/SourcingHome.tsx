// M1 — Dashboard for Buyer, Commodity Lead, Sourcing Head, Admin, Finance and Management
// Two views: the one-screen Dashboard (four status cards, portfolio chart, SLA watch) and Advanced analytics.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import type { Bucket } from '../../lib/types'
import { Button, useWarmup } from '../../components/ui'
import { useHomeData } from './data'
import { HomeHeader, HomeSkeleton, Reveal, RevealGrid, ViewPills, useDrill } from './shared'
import { BucketCards, RealisationCard, SavingsToValidateCard, TopIdeasCard } from './cards'
import { CommodityHeatCard, FunnelCard, LeverMixCard, PortfolioCard, TrendCard } from './charts'
import { SlaWatchCard } from './MyActions'
import { Leaderboard } from './Leaderboard'

export type SourcingVariant = 'sourcing' | 'finance' | 'mgmt'

export default function SourcingHome({ variant }: { variant: SourcingVariant }) {
  const ready = useWarmup(380)
  const me = useMe()
  const nav = useNavigate()
  const d = useHomeData()
  const settings = useStore((s) => s.settings)
  const [sel, setSel] = useState<Bucket | null>(null)
  const [view, setView] = useState<'dashboard' | 'advanced'>('dashboard')
  const drill = useDrill()
  const clear = () => setSel(null)
  const lb = settings.leaderboardVisible
  if (!me) return null
  if (!ready) return <HomeSkeleton />

  const headerActions = (
    <>
      <ViewPills value={view} onChange={setView} />
      {variant === 'mgmt' && <Button variant="secondary" icon="FileText" onClick={() => nav('/reports')}>Monthly report</Button>}
    </>
  )

  return (
    <div>
      <HomeHeader actions={headerActions} />

      {view === 'dashboard' ? (
        <RevealGrid className="grid grid-cols-12 gap-4">
          <Reveal className="col-span-12"><BucketCards d={d} sel={null} onSel={(b) => b && drill({ bucket: b })} layout="row" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-7"><PortfolioCard d={d} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-5">
            {variant === 'finance' ? <SavingsToValidateCard d={d} className="flex-1" />
              : variant === 'mgmt' ? <SlaWatchCard className="flex-1" />
                : <SlaWatchCard className="flex-1" />}
          </Reveal>
        </RevealGrid>
      ) : (
        <RevealGrid className="grid grid-cols-12 gap-4">
          {/* row 1 — trend + funnel */}
          <Reveal className="col-span-12 xl:col-span-8"><TrendCard d={d} height={262} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-4"><FunnelCard d={d} sel={sel} onClear={clear} className="flex-1" /></Reveal>
          {/* row 2 — top ideas + category mix */}
          <Reveal className="col-span-12 lg:col-span-6"><TopIdeasCard d={d} sel={sel} onClear={clear} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 lg:col-span-6"><LeverMixCard d={d} sel={sel} onClear={clear} className="flex-1" /></Reveal>
          {/* row 3 — top commodities (full list lives in MIS) + leaderboard / realisation */}
          <Reveal className="col-span-12 xl:col-span-8"><CommodityHeatCard d={d} limit={6} className="flex-1" /></Reveal>
          <Reveal className="col-span-12 xl:col-span-4">{variant === 'finance' || !lb ? <RealisationCard d={d} className="flex-1" /> : <Leaderboard limit={5} className="flex-1" />}</Reveal>
        </RevealGrid>
      )}
    </div>
  )
}
