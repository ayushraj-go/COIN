// CO (Cost Optimisation) — data derived for the implementation side: everything after approval
import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import type { Health, Idea } from '../../lib/types'
import { healthOf, ideaAnnualised, ideaApprovedAnnualised, ideaCommitted, isHard } from '../../lib/calc'
import { fyMonths, quarterOf, sum, todayIso } from '../../lib/format'
import { monthlyCommitted } from '../exec/shared'
import { STAGE } from '../../lib/masters'
import { useHomeData, type HomeData } from '../home/data'

/** Which step of "Execution started" an idea is on — its first open milestone (NPD sample → PAP price → go-live) */
export function execStep(i: Idea): 'npd' | 'pap' | 'exec' {
  const open = i.execution?.milestones.find((m) => !m.doneDate)?.name ?? ''
  if (open.includes('NPD')) return 'npd'
  if (open.includes('PAP')) return 'pap'
  return 'exec'
}

/** Post-approval view, grouped as the Sourcing Head reads it: the steps inside Execution started, then Implemented */
export interface CoStage { key: string; label: string; short: string; stages: string[]; icon: string; hint: string; match: (i: Idea) => boolean }
export const CO_STAGES: CoStage[] = [
  { key: 'npd', label: 'NPD sample', short: 'NPD sample', stages: [STAGE.execution], icon: 'TestTubes', hint: 'Execution started · ECN raised, sample under trial / approval', match: (i) => i.stage === STAGE.execution && execStep(i) === 'npd' },
  { key: 'pap', label: 'PAP price / source', short: 'PAP', stages: [STAGE.execution], icon: 'FileBadge', hint: 'Execution started · price or source revision awaiting PAP release', match: (i) => i.stage === STAGE.execution && execStep(i) === 'pap' },
  { key: 'exec', label: 'Go-live / internal', short: 'Go-live', stages: [STAGE.execution], icon: 'Wrench', hint: 'Execution started · first MRN at the new price, or an internal change on the line', match: (i) => i.stage === STAGE.execution && execStep(i) === 'exec' },
  { key: 'impl', label: 'Implemented', short: 'Implemented', stages: ['Implemented'], icon: 'CircleCheckBig', hint: 'Effective date set; realisation flows from actual MRN', match: (i) => i.stage === 'Implemented' },
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
    const ideas = post.filter(st.match)
    return { st, ideas, count: ideas.length, value: sum(ideas.map(coValue)), present: [] as string[] }
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
