// Entry screen after login — the four status cards for everyone, then choose a workspace:
// CO (Cost Optimisation: execution & realised savings) or IN (Innovation Network: the overall idea network)
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore, useMe } from '../store/useStore'
import { Icon, Money, cn } from '../components/ui'
import { greeting, todayLine, useDrill } from './home/shared'
import { useHomeData } from './home/data'
import { BucketCards } from './home/cards'

function SpaceCard({ code, title, desc, points, stats, tone, onOpen, delay }: {
  code: string; title: string; desc: string; points: string[]; stats: [React.ReactNode, string][]; tone: 'blue' | 'teal'; onOpen: () => void; delay: number
}) {
  const teal = tone === 'teal'
  return (
    <motion.button type="button" onClick={onOpen}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', duration: 0.5, bounce: 0.1 }}
      className={cn('group relative text-left card overflow-hidden flex flex-col p-5 transition-all hover:-translate-y-0.5', teal ? 'hover:shadow-[0_22px_44px_-24px_rgb(20_171_146/.6)]' : 'hover:shadow-[0_22px_44px_-24px_rgb(36_89_224/.6)]')}
      style={{ background: teal ? 'linear-gradient(140deg, #e6f7f3 0%, #ffffff 46%, #f4fbfa 100%)' : 'linear-gradient(140deg, #e8efff 0%, #ffffff 46%, #f5f8ff 100%)' }}>
      <span className={cn('absolute inset-x-0 top-0 h-1', teal ? 'bg-gradient-to-r from-accent-400 via-accent-500 to-[#1b86d6]' : 'bg-brand-grad')} />
      <span className={cn('pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full blur-3xl', teal ? 'bg-accent-300/30' : 'bg-brand-300/30')} />
      <div className="relative flex items-start gap-3.5">
        <span className={cn('h-12 w-12 rounded-2xl text-white grid place-items-center text-[16px] font-extrabold tracking-tight shrink-0 shadow-[0_10px_20px_-10px_rgb(15_27_51/.6)]', teal ? 'bg-gradient-to-br from-accent-400 to-accent-700' : 'bg-brand-grad')}>{code}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink leading-tight">{title}</h2>
          <p className="mt-1 text-[12.5px] text-muted leading-snug">{desc}</p>
        </div>
        <span className={cn('h-9 w-9 rounded-full grid place-items-center shrink-0 transition-colors ring-1', teal ? 'ring-accent-200 text-accent-700 group-hover:bg-accent-600 group-hover:text-white' : 'ring-brand-200 text-brand-700 group-hover:bg-brand-600 group-hover:text-white')}><Icon name="ArrowRight" size={16} /></span>
      </div>
      <div className="relative mt-3.5 flex flex-wrap gap-1.5">
        {points.map((p) => (
          <span key={p} className={cn('inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full text-[12px] font-medium bg-white border', teal ? 'border-accent-100 text-accent-700' : 'border-brand-100 text-brand-700')}>
            <Icon name="Check" size={12} strokeWidth={2.6} />{p}
          </span>
        ))}
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2.5">
        {stats.map(([v, l]) => (
          <div key={l} className={cn('rounded-xl px-3 py-2.5 border bg-white/80', teal ? 'border-accent-100' : 'border-brand-100')}>
            <div className={cn('text-[18px] font-bold num leading-none', teal ? 'text-accent-700' : 'text-brand-700')}>{v}</div>
            <div className="text-[11.5px] text-muted mt-1">{l}</div>
          </div>
        ))}
      </div>
      <div className={cn('relative mt-4 h-10 rounded-xl text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_20px_-12px_rgb(15_27_51/.6)]', teal ? 'bg-gradient-to-r from-accent-500 to-accent-700' : 'bg-brand-grad')}>
        Enter {title}<Icon name="ArrowRight" size={15} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.button>
  )
}

export default function Entry() {
  const me = useMe()
  const setSpace = useStore((s) => s.setSpace)
  const nav = useNavigate()
  const drill = useDrill()
  const d = useHomeData()
  if (!me) return null
  const first = me.name.replace(/^Dr\.\s*/, '').split(' ')[0]
  const c = d.summary.counts, v = d.summary.values
  const open = (space: 'IN' | 'CO') => { setSpace(space); nav('/') }
  return (
    <div className="max-w-[1240px] mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3.5">
        <h1 className="text-[21px] font-bold tracking-[-0.02em] text-ink">{greeting()}, <span className="text-brand-grad">{first}</span></h1>
        <p className="text-[13px] text-muted mt-0.5">{todayLine()} · here is where every idea stands. Choose a workspace to continue.</p>
      </motion.div>
      <BucketCards d={d} sel={null} onSel={(b) => b && drill({ bucket: b })} layout="row" className="mb-4" />
      <div className="grid md:grid-cols-2 gap-4">
        <SpaceCard code="CO" title="Cost Optimisation" tone="teal" delay={0.05} onOpen={() => open('CO')}
          desc="Execution after approval — NPD and PAP progress, due dates, realised savings and leakage."
          points={['Execution hub and due dates', 'Implemented ideas', 'Realised savings and price leakage']}
          stats={[[c['In Execution'], 'In execution'], [c.Implemented, 'Implemented'], [<Money key="r" value={d.summary.realisedCounting} />, 'Realised FY']]} />
        <SpaceCard code="IN" title="Innovation Network" tone="blue" delay={0.12} onOpen={() => open('IN')}
          desc="The overall idea network — ideas, suppliers and campaigns, through validation and approval."
          points={['Submit and track ideas', 'Idea register, approvals and SLAs', 'Supplier campaigns and outreach']}
          stats={[[c.Pipeline, 'In pipeline'], [<Money key="p" value={v.Pipeline} />, 'Pipeline value'], [c.Pipeline + c['In Execution'] + c.Implemented + c.Dropped, 'Ideas']]} />
      </div>
    </div>
  )
}
