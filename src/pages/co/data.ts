// CO (Cost Optimisation) — data derived for the implementation side: everything after approval
import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import type { Health, Idea } from '../../lib/types'
import { healthOf, ideaAnnualised, ideaApprovedAnnualised, ideaCommitted, isHard } from '../../lib/calc'
import { fyMonths, quarterOf, sum, todayIso } from '../../lib/format'
import { monthlyCommitted } from '../exec/shared'
import { useHomeData, type HomeData } from '../home/data'

/** Post-approval stages, grouped as the Sourcing Head reads them */
export interface CoStage { key: string; label: string; short: string; stages: string[]; icon: string; hint: string }
export const CO_STAGES: CoStage[] = [
  { key: 'npd', label: 'NPD sample', short: 'NPD sample', stages: ['NPD sample', 'NPD ECN up to sample approval'], icon: 'TestTubes', hint: 'ECN raised, sample under trial / approval' },
  { key: 'pap', label: 'PAP price / source', short: 'PAP', stages: ['Price revision in PAP', 'Price / source change in PAP'], icon: 'FileBadge', hint: 'Price or source revision awaiting PAP release' },
  { key: 'exec', label: 'Internal execution', short: 'Execution', stages: ['Execution'], icon: 'Wrench', hint: 'Internal change being executed by the owning department' },
  { key: 'impl', label: 'Implemented', short: 'Implemented', stages: ['Implemented'], icon: 'CircleCheckBig', hint: 'Effective date set; realisation flows from actual MRN' },
]

export const HEALTHS: Health[] = ['On track', 'At risk', 'Delayed']

/** Value used for an idea on the CO side: approved annualised once implemented, estimated annualised before */
export const coValue = (i: Idea) => (i.bucket === 'Implemented' ? ideaApprovedAnnualised(i) : ideaAnnualised(i))

export function useCoData() {
  const d = useHomeData()
  const users = useStore((s) => s.users)
  return useMemo(() => buildCo(d, users), [d, users])
}

function buildCo(d: HomeData, users: { id: string; name: string; avatarColor: string }[]) {
  const t = todayIso()
  const fy = d.fy
  const inExec = d.ideas.filter((i) => i.bucket === 'In Execution')
  const implemented = d.ideas.filter((i) => i.bucket === 'Implemented')
  const post = [...inExec, ...implemented]

  // live executions (have an execution plan and are still running)
  const live = inExec.filter((i) => i.execution && i.execution.status === 'In Execution')
  const health = Object.fromEntries(HEALTHS.map((h) => [h, live.filter((i) => healthOf(i) === h)])) as Record<Health, Idea[]>
  const committedOf = (list: Idea[]) => sum(list.filter(isHard).map((i) => ideaCommitted(i, fy)))
  const overdue = health.Delayed
  const atRisk = health['At risk']
  const watch = [...overdue, ...atRisk]

  // next due / overdue — earliest due date first (overdue naturally lead)
  const due = [...live].sort((a, b) => a.execution!.targetDate.localeCompare(b.execution!.targetDate))
  const userOf = (id?: string) => users.find((u) => u.id === id)

  // pipeline by post-approval stage
  const stages = CO_STAGES.map((st) => {
    const ideas = post.filter((i) => st.stages.includes(i.stage))
    return { st, ideas, count: ideas.length, value: sum(ideas.map(coValue)), present: st.stages.filter((x) => ideas.some((i) => i.stage === x)) }
  })

  // realised FY to date (hard savings, ledger)
  const s = d.summary
  const pending = Math.max(0, s.realised - s.realisedValidated)

  // quarter phasing of committed savings (hard) + realised per quarter
  const months = fyMonths(fy)
  const qKeys = ['Q1', 'Q2', 'Q3', 'Q4'] as const
  const hardIds = new Set(d.ideas.filter(isHard).map((i) => i.id))
  const phasing = qKeys.map((q, qi) => {
    const ms = months.slice(qi * 3, qi * 3 + 3)
    const part = (list: Idea[]) => sum(list.filter(isHard).map((i) => { const m = monthlyCommitted(i, fy); return sum(ms.map((x) => m[x] ?? 0)) }))
    const realised = sum(d.ledger.filter((l) => ms.includes(l.month) && hardIds.has(l.ideaId)).map((l) => l.realised))
    return { q, implemented: part(implemented), inExec: part(inExec), realised, current: quarterOf(t) === q }
  })

  return {
    d, fy, t, inExec, implemented, post, live, health, overdue, atRisk, watch, due, stages, userOf,
    committedOf,
    kpi: {
      execCount: inExec.length,
      execCommitted: committedOf(inExec),
      execAnnualised: sum(inExec.map((i) => ideaAnnualised(i))),
      implCount: implemented.length,
      implAnnualised: sum(implemented.map(ideaApprovedAnnualised)),
      implCommitted: committedOf(implemented),
      realised: s.realised,
      validated: s.realisedValidated,
      pending,
      leakage: s.leakage,
      watchCount: watch.length,
      watchCommitted: committedOf(watch),
    },
    phasing,
  }
}
export type CoData = ReturnType<typeof useCoData>
