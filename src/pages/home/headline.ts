// The headline KPI row — Pipeline · In execution · Implemented · Realised — shown on the Home, the Innovation Network
// and Cost Optimisation dashboards for every role. The tiles and numbers never change between workspaces; only where a
// tile leads depends on the pages the role can open.
import type { Idea, User } from '../../lib/types'
import { navFor } from '../../lib/nav'

export type KpiKey = 'pipeline' | 'execution' | 'implemented' | 'realised'
export interface KpiLink { space: 'IN' | 'CO'; base: string; bucket?: string }

export function kpiLinks(me: User | null | undefined): Record<KpiKey, KpiLink> {
  const can = (key: string) => navFor(me ?? null).some((n) => n.key === key)
  // without the Idea Register (employees, suppliers) every tile opens My Ideas in the Innovation Network
  if (!can('register')) {
    const mine = (bucket: string): KpiLink => ({ space: 'IN', base: '/my-ideas', bucket })
    return { pipeline: mine('Pipeline'), execution: mine('In Execution'), implemented: mine('Implemented'), realised: mine('Implemented') }
  }
  return {
    pipeline: { space: 'IN', base: '/ideas', bucket: 'Pipeline' },
    execution: can('execution') ? { space: 'CO', base: '/execution' } : { space: 'CO', base: '/ideas', bucket: 'In Execution' },
    implemented: can('execution') ? { space: 'CO', base: '/execution?tab=verification' } : { space: 'CO', base: '/ideas', bucket: 'Implemented' },
    realised: can('execution') ? { space: 'CO', base: '/execution?tab=proof' } : { space: 'CO', base: '/ideas', bucket: 'Implemented' },
  }
}

/** My Ideas' rule: ideas I submitted, and for a supplier every idea submitted under its supplier code */
export const ownsIdea = (me: User, i: Idea) => i.submitterId === me.id || (me.roles.includes('supplier') && !!i.isSupplierSubmission && !!me.supplierCode && i.supplierCode === me.supplierCode)

/** The ideas the headline row counts: people whose tiles open My Ideas count exactly that list; everyone else every idea they can see */
export function headlineScope(me: User | null | undefined, ideas: Idea[]): Idea[] {
  if (!me) return []
  return navFor(me).some((n) => n.key === 'register') ? ideas : ideas.filter((i) => ownsIdea(me, i))
}

/** Live executions past their target date */
export const overdueExecutions = (ideas: Idea[], today: string) =>
  ideas.filter((i) => i.bucket === 'In Execution' && i.execution?.status === 'In Execution' && !!i.execution.targetDate && i.execution.targetDate < today)
