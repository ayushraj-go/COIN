// Workshops: every idea at stage 2 with its next event and what is still missing, and the guide to which ID works which stage.
import { ideaAnnualised } from '../../lib/calc'
import { STAGE } from '../../lib/masters'
import type { Space } from '../../lib/nav'
import type { Idea, User, WorkshopEvent } from '../../lib/types'
import { stageAssignee, workshopGaps, workshopSteps, type WorkshopStep } from '../../lib/workflow'

export type WorkshopStatus = 'To schedule' | 'Scheduled' | 'Ready for Go ahead'
export interface WorkshopRow { idea: Idea; status: WorkshopStatus; event?: WorkshopEvent; held: number; gaps: string[]; steps: WorkshopStep[] }

/** The Management ID sees every workshop; a department ID sees the ones it runs, the same rule as My queue */
export function workshopRows(ideas: Idea[], me: User, users: User[]): WorkshopRow[] {
  const all = me.roles.includes('admin')
  return ideas
    .filter((i) => i.stage === STAGE.feasibility && (all || stageAssignee(i, STAGE.feasibility, users) === me.id))
    .map((idea) => {
      const event = idea.workshop?.events.find((e) => e.status === 'Scheduled')
      const annual = ideaAnnualised(idea)
      const gaps = workshopGaps(idea, annual)
      return { idea, event, gaps, steps: workshopSteps(idea, annual), held: idea.workshop?.events.filter((e) => e.status === 'Held').length ?? 0, status: !event ? 'To schedule' : gaps.length ? 'Scheduled' : 'Ready for Go ahead' }
    })
}

export interface StageGuideRow { stage: string; role: string; who: string; fixedId?: string; does: string; where: string; path: string; space: Space }
/** Which ID works each stage and where it does it. `fixedId` is set where one ID owns the stage for every idea */
export const STAGE_GUIDE: StageGuideRow[] = [
  { stage: STAGE.submitted, role: 'Idea Submitter', who: 'Any department ID', does: 'Raises the idea; the person types their name and employee ID', where: 'Capture My Idea', path: '/submit', space: 'IN' },
  { stage: STAGE.feasibility, role: 'Workshop Owner', who: 'The idea\'s department ID, one owner for each workshop', does: 'Follows the numbered steps: event, technical feasibility, commercial evaluation, then closes the event', where: 'My queue · Workshops', path: '/workshops', space: 'IN' },
  { stage: STAGE.approval, role: 'Management', who: 'Management ID', fixedId: 'id-management', does: 'Approves or rejects, allocates the KPI and signs it', where: 'My queue', path: '/queue', space: 'IN' },
  { stage: STAGE.execution, role: 'Execution Manager', who: 'Execution Manager ID', fixedId: 'id-execution', does: 'Sees every execution started and runs the milestones; savings come in from MRN each month', where: 'Execution Hub', path: '/execution', space: 'CO' },
  { stage: STAGE.verification, role: 'Finance Verifier', who: 'Finance ID', fixedId: 'id-finance', does: 'Verifies the savings after the final MRN month', where: 'Execution Hub · Verification', path: '/execution?tab=verification', space: 'CO' },
]

/** The ID with the most ideas waiting at a stage, so opening that stage from the guide lands on real work */
export function busiestId(ideas: Idea[], stage: string, users: User[]): string | undefined {
  const count = new Map<string, number>()
  for (const i of ideas) {
    if (i.stage !== stage) continue
    const id = stageAssignee(i, stage, users)
    if (id) count.set(id, (count.get(id) ?? 0) + 1)
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0]
}
