// Home after login — COIN coin mark, greeting, KPI tiles, the two workspaces and the six-stage walkthrough.
// Cost Optimisation carries LENS · PROOF · TRACE; Innovation Network invites you into the world of ideas.
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore, useMe } from '../store/useStore'
import { STAGE, TRACKER_STAGES } from '../lib/masters'
import { stageLabel } from '../lib/workflow'
import { inrShort } from '../lib/format'
import { Icon, Money, cn } from '../components/ui'
import { CoinMark } from '../components/Logo'
import { greeting, todayLine } from './home/shared'
import { useHomeData } from './home/data'
import { HomeKpis } from './home/Kpis'
import { portfolioPlan } from './idea/PlanVsActual'

const PILLARS = [
  { key: 'LENS', full: 'Linked Evidence of Negotiation and Savings', icon: 'ScanSearch', path: '/', hint: 'Dashboard' },
  { key: 'PROOF', full: 'Part-linked Realisation and Optimisation Output Framework', icon: 'BadgeIndianRupee', path: '/proof', hint: 'Savings proof' },
  { key: 'TRACE', full: 'Transition-linked Realisation of Actual CI Evidence', icon: 'Route', path: '/execution', hint: 'Execution Hub' },
] as const

export default function Entry() {
  const me = useMe()
  const setSpace = useStore((s) => s.setSpace)
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const campaigns = useStore((s) => s.campaigns)
  const nav = useNavigate()
  const d = useHomeData()
  if (!me) return null
  const first = me.name.replace(/^Dr\.\s*/, '').split(' ')[0]
  const c = d.summary.counts, v = d.summary.values
  const go = (space: 'IN' | 'CO', path = '/') => { setSpace(space); nav(path) }
  const pf = portfolioPlan(d.ideas, ledger, last)
  const inStage = (s: string) => d.active.filter((i) => i.stage === s).length
  const awaiting = d.active.filter((i) => i.stage === STAGE.verification && !i.verification?.verifiedAt).length
  const supplierIdeas = d.active.filter((i) => i.isSupplierSubmission && i.bucket !== 'Dropped').length
  const stat: Record<string, [string, string]> = {
    LENS: [inrShort(d.summary.realised), 'savings evidenced from MRN'],
    PROOF: [inrShort(pf.target), `locked across ${pf.ideas} ideas`],
    TRACE: [`${c['In Execution']} · ${awaiting}`, 'in execution · awaiting verification'],
  }
  const show = [1, 2, 3, 4, 5, 6].map((n) => d.ideas.find((i) => i.showcase === n)).filter(Boolean)

  return (
    <div className="max-w-[1280px] mx-auto w-full">
      {/* greeting */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CoinMark size={52} spin className="drop-shadow-[0_10px_18px_rgb(19_35_75/.35)]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink leading-tight">{greeting()}, <span className="text-brand-grad">{first}</span></h1>
          <p className="text-[12.5px] text-muted mt-0.5">{todayLine()} · every idea traced from submission to verified savings</p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full bg-white/80 border border-line pl-1.5 pr-3.5 h-10 shadow-[0_6px_18px_-12px_rgb(19_35_75/.4)]">
          <span className="h-7 px-2.5 rounded-full bg-brand-grad text-white text-[11.5px] font-extrabold tracking-[.14em] grid place-items-center">COIN</span>
          <span className="text-[12px] text-ink-2"><b className="text-brand-800">C</b>ost <b className="text-brand-800">O</b>ptimisation and <b className="text-accent-600">I</b>nnovation <b className="text-accent-600">N</b>etwork</span>
        </div>
      </motion.div>

      <HomeKpis d={d} />

      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 mt-4">
        {/* Cost Optimisation — LENS · PROOF · TRACE */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card relative overflow-hidden p-4">
          <span className="absolute inset-x-0 top-0 h-1 bg-red-grad" />
          <span className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent-300/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="h-11 w-11 rounded-2xl bg-red-grad text-white grid place-items-center text-[15px] font-extrabold shrink-0 shadow-[0_10px_20px_-10px_rgb(184_20_42/.7)]">CO</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink leading-tight">Cost Optimisation</h2>
              <p className="text-[12.5px] text-muted leading-snug">Cost innovation in execution — locked targets, part-wise proof from MRN and verified savings · stages 5–6</p>
            </div>
          </div>
          <div className="relative mt-3.5 grid sm:grid-cols-3 gap-2.5">
            {PILLARS.map((p, k) => (
              <motion.button key={p.key} type="button" onClick={() => go('CO', p.path)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + k * 0.06 }}
                className="group text-left rounded-xl border border-line bg-gradient-to-b from-white to-brand-50/40 p-3 hover:border-accent-300 hover:shadow-[0_14px_28px_-18px_rgb(19_35_75/.55)] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[19px] font-extrabold tracking-[.12em] text-brand-800 group-hover:text-accent-600 transition-colors">{p.key}</span>
                  <span className="h-8 w-8 rounded-lg grid place-items-center bg-brand-grad text-white"><Icon name={p.icon} size={15} /></span>
                </div>
                <div className="mt-1 text-[11px] leading-snug text-muted min-h-[30px]">{p.full}</div>
                <div className="mt-2 pt-2 border-t border-dashed border-line">
                  <div className="text-[15px] font-bold num text-ink leading-tight">{stat[p.key][0]}</div>
                  <div className="text-[10.5px] text-muted truncate">{stat[p.key][1]}</div>
                </div>
                <div className="mt-1.5 text-[11px] font-semibold text-brand-700 inline-flex items-center gap-1">{p.hint}<Icon name="ArrowRight" size={11} className="transition-transform group-hover:translate-x-0.5" /></div>
              </motion.button>
            ))}
          </div>
          <button onClick={() => go('CO')} className="relative mt-3.5 w-full h-10 rounded-xl text-white text-[13px] font-semibold flex items-center justify-center gap-2 bg-red-grad shadow-[0_10px_20px_-12px_rgb(184_20_42/.7)] hover:brightness-105">
            Enter Cost Optimisation<Icon name="ArrowRight" size={15} />
          </button>
        </motion.section>

        {/* Innovation Network — the world of ideas */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="relative overflow-hidden rounded-2xl p-4 text-white bg-hero shadow-[0_22px_44px_-26px_rgb(19_35_75/.8)] flex flex-col">
          <span className="pointer-events-none absolute -left-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 grid place-items-center text-[15px] font-extrabold shrink-0">IN</span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white/75">Innovation Network</div>
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em] leading-tight">Enter the world of ideas</h2>
              <p className="text-[12px] text-white/80 mt-0.5">Amber Cost Optimisation and Innovation Network</p>
            </div>
          </div>
          <div className="relative mt-3.5 grid grid-cols-2 gap-2">
            {[[<Money key="p" value={v.Pipeline} />, 'pipeline value'], [c.Pipeline, 'ideas in the network'], [supplierIdeas, 'supplier ideas'], [campaigns.filter((x) => x.status === 'Live').length, 'live campaigns']].map(([val, l]) => (
              <div key={String(l)} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2"><div className="text-[17px] font-bold num leading-tight">{val}</div><div className="text-[11px] text-white/75">{l}</div></div>
            ))}
          </div>
          <div className="relative mt-3 flex flex-wrap items-center gap-1 text-[11px]">
            {TRACKER_STAGES.slice(0, 4).map((s, k) => (
              <span key={s} className="inline-flex items-center gap-1">
                {k > 0 && <Icon name="ChevronRight" size={11} className="text-white/50" />}
                <span className="rounded-full bg-white/12 border border-white/20 px-2 h-6 inline-flex items-center gap-1"><b className="num">{k + 1}</b>{s === STAGE.evaluation ? 'Dept evaluation' : s}{k > 0 && <span className="text-white/70 num">· {inStage(s)}</span>}</span>
              </span>
            ))}
          </div>
          <button onClick={() => go('IN')} className="relative mt-auto pt-0 h-10 rounded-xl bg-white text-brand-800 text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-brand-50 mt-3.5">
            Enter Innovation Network<Icon name="ArrowRight" size={15} />
          </button>
        </motion.section>
      </div>

      {/* six-stage walkthrough */}
      {show.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card mt-4 p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2"><Icon name="Workflow" size={15} className="text-brand-600" /><span className="text-[13.5px] font-bold text-ink">Six-stage walkthrough</span><span className="text-[11.5px] text-muted hidden sm:inline">one idea at each stage — every form filled up to its stage</span></div>
            <span className="text-[11px] text-muted">1–4 Innovation Network · 5–6 Cost Optimisation</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {show.map((i) => {
              const n = i!.showcase!
              const verified = !!i!.verification?.verifiedAt
              const label = n === 1 ? 'Idea submitted' : n === 6 ? 'Verified' : stageLabel(i!, TRACKER_STAGES[n - 1])
              return (
                <button key={i!.id} onClick={() => go(n >= 5 ? 'CO' : 'IN', `/ideas/${i!.id}`)} className={cn('group text-left rounded-xl border px-2.5 py-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-18px_rgb(19_35_75/.6)]', n >= 5 ? 'border-accent-100 bg-accent-50/40' : 'border-brand-100 bg-brand-50/40')}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold text-white', verified ? 'bg-emerald-600' : n >= 5 ? 'bg-red-grad' : 'bg-brand-grad')}>{verified ? <Icon name="Check" size={10} strokeWidth={3} /> : n}</span>
                    <span className="text-[11.5px] font-bold text-ink truncate">{label}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-muted mt-1">{i!.id}</div>
                  <div className="text-[11.5px] text-ink-2 leading-snug line-clamp-2 group-hover:text-brand-700">{i!.title}</div>
                </button>
              )
            })}
          </div>
        </motion.section>
      )}
    </div>
  )
}
