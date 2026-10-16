// Who may do what with an idea — the department ladder (Section 3 matrix, applied per idea + stage).
// Pure functions shared by the screens (buttons, board) and the API server (every command is checked here).
import type { Bucket, Idea, User } from '../lib/types'
import { EVALUATION_STAGES, FEASIBILITY_STAGES, ROUTE_STAGES, STAGE } from '../lib/masters'
import { stageLabel, ideaDept, stageAssignee } from '../lib/workflow'
import { can } from '../lib/nav'

const hasRole = (u: User | null | undefined, ...roles: User['roles']) => !!u && u.roles.some((r) => roles.includes(r))

// ─── Stage groups (Kanban columns) ────────────────────────────────────────────
export interface StageGroup { key: string; label: string; short: string; stages: string[]; bucket: Bucket; icon: string }
// One column per workflow stage — the same six stages for every idea (Idea submitted is the entry event).
// Team feasibility check → <dept> evaluation → <dept> approval live in IN; Execution started and Verification in CO.
export const STAGE_GROUPS: StageGroup[] = [
  { key: 'feasibility', label: STAGE.feasibility, short: STAGE.feasibility, stages: [STAGE.feasibility], bucket: 'Pipeline', icon: 'UsersRound' },
  { key: 'evaluation', label: 'Evaluation', short: 'Evaluation', stages: [STAGE.evaluation], bucket: 'Pipeline', icon: 'FlaskConical' },
  { key: 'approval', label: STAGE.approval, short: STAGE.approval, stages: [STAGE.approval], bucket: 'Pipeline', icon: 'Stamp' },
  { key: 'execution', label: STAGE.execution, short: STAGE.execution, stages: [STAGE.execution], bucket: 'In Execution', icon: 'Rocket' },
  { key: 'verification', label: STAGE.verification, short: STAGE.verification, stages: [STAGE.verification, 'Implemented'], bucket: 'Implemented', icon: 'ShieldCheck' },
  { key: 'dropped', label: 'Dropped', short: 'Dropped', stages: ['Dropped', 'Rejected'], bucket: 'Dropped', icon: 'CircleX' },
]
export const groupOfStage = (stage: string) => STAGE_GROUPS.find((g) => g.stages.includes(stage))

export const stagesOf = (idea: Pick<Idea, 'route'>) => ROUTE_STAGES[idea.route] ?? ROUTE_STAGES.Commercial

// ─── Permissions (Section 3 matrix, applied per idea + stage) ────────────────
export function inScope(me: User | null | undefined, idea: Idea) {
  if (!me) return false
  if (hasRole(me, 'head')) return true
  return me.commodities.includes(idea.commodity)
}
export interface IdeaPerms {
  feasibilityCheck: boolean; evaluate: boolean; approve: boolean
  sendBack: boolean; requestInfo: boolean; reassign: boolean; drop: boolean; handOver: boolean; verify: boolean
  override: boolean; sync: boolean; continueDraft: boolean; comment: boolean; upload: boolean
}
export function ideaPerms(me: User | null | undefined, idea: Idea, users: User[]): IdeaPerms {
  const none: IdeaPerms = { feasibilityCheck: false, evaluate: false, approve: false, sendBack: false, requestInfo: false, reassign: false, drop: false, handOver: false, verify: false, override: false, sync: false, continueDraft: false, comment: false, upload: false }
  if (!me) return none
  const stage = idea.stage
  const pipeline = idea.bucket === 'Pipeline'
  const exec = idea.bucket === 'In Execution'
  // Sourcing Head and Admin can act at every stage; everyone else only at their own stage, for their own department
  const head = hasRole(me, 'head', 'admin')
  const scope = inScope(me, idea)
  const validator = can(me, 'validate') && scope
  const evalStage = EVALUATION_STAGES.includes(stage)
  const dept = ideaDept(idea)
  const inDept = me.department === dept
  // stage 2 — the team lead of the submitter's department, never on their own idea (then the department lead steps in)
  const feasibilityCheck = pipeline && FEASIBILITY_STAGES.includes(stage) &&
    (head || (hasRole(me, 'teamlead') && inDept && idea.submitterId !== me.id) || stageAssignee(idea, stage, users) === me.id)
  // stage 3 — the department lead; stage 4 — the department head
  const evaluate = pipeline && evalStage && (head || (hasRole(me, 'deptlead') && inDept))
  const approve = pipeline && stage === STAGE.approval && idea.approvals.some((a) => !a.decision) && (head || (hasRole(me, 'depthead') && inDept))
  const actor = feasibilityCheck || evaluate || approve
  // stage 5 — the department's execution owner, or whoever the execution was reassigned to
  const executor = head || idea.ownerId === me.id || (hasRole(me, 'execowner') && inDept)
  return {
    feasibilityCheck, evaluate, approve,
    sendBack: pipeline && actor,
    requestInfo: pipeline && actor,
    // pipeline stages are assigned by the ladder — only override users re-point the commodity buyer;
    // in execution the department head (or override) hands the execution to another owner
    reassign: (pipeline && head) || (exec && (head || (hasRole(me, 'depthead') && inDept))),
    drop: (pipeline && (actor || head)) || (exec && executor),
    handOver: exec && executor && idea.execution?.status === 'In Execution',
    // stage 6 — Finance verifies the locked target
    verify: stage === STAGE.verification && !idea.verification?.verifiedAt && (head || hasRole(me, 'finance')),
    override: pipeline && validator && !idea.locked,
    sync: executor && idea.bucket !== 'Dropped',
    continueDraft: stage === 'Draft' && idea.submitterId === me.id,
    comment: idea.stage !== 'Draft' || idea.submitterId === me.id,
    upload: idea.bucket !== 'Dropped' && (idea.submitterId === me.id || scope || evalStage || hasRole(me, 'supplier')),
  }
}

// ─── Kanban move rules (permission-checked) ──────────────────────────────────
export type MoveResult =
  | { ok: true; kind: 'move' | 'drop' | 'done'; stage: string; backward: boolean }
  | { ok: false; reason: string; same?: boolean }
export function kanbanMove(me: User | null | undefined, idea: Idea, targetKey: string, users: User[]): MoveResult {
  const from = groupOfStage(idea.stage)
  const target = STAGE_GROUPS.find((g) => g.key === targetKey)!
  if (!from) return { ok: false, reason: 'Drafts are not on the board — submit the idea first' }
  if (from.key === targetKey) return { ok: false, reason: '', same: true }
  if (!me) return { ok: false, reason: 'Sign in to move ideas' }
  if (idea.bucket === 'Implemented' || idea.bucket === 'Dropped') return { ok: false, reason: `${idea.id} is ${idea.stage === 'Dropped' || idea.stage === 'Rejected' ? 'dropped for good' : 'in verification'} — it cannot be moved on the board` }
  // every move is decided by the department ladder: the role for the stage being left, or Sourcing Head / Admin
  const p = ideaPerms(me, idea, users)
  const who = `the ${stageLabel(idea, idea.stage)} role of ${ideaDept(idea)} (or the Sourcing Head / Admin)`
  if (targetKey === 'dropped') {
    if (!p.drop) return { ok: false, reason: `Dropping ${idea.id} needs ${who}` }
    return { ok: true, kind: 'drop', stage: 'Dropped', backward: false }
  }
  if (targetKey === 'verification') {
    if (!p.handOver) return { ok: false, reason: `Handing ${idea.id} over for verification needs the ${ideaDept(idea)} execution owner (or the Sourcing Head / Admin)` }
    if (idea.bucket !== 'In Execution') return { ok: false, reason: 'Only ideas in Execution started can be handed for verification' }
    if (!idea.execution?.effectiveDate) return { ok: false, reason: 'Record the first MRN at the new price in the Execution Hub before handing over for verification' }
    return { ok: true, kind: 'done', stage: STAGE.verification, backward: false }
  }
  const stages = stagesOf(idea)
  const stage = stages.find((s) => target.stages.includes(s))
  if (!stage) return { ok: false, reason: `There is no “${target.label}” stage` }
  const ai = stages.indexOf(STAGE.approval), ci = stages.indexOf(idea.stage), ti = stages.indexOf(stage)
  if (ci > ai && ti <= ai) return { ok: false, reason: 'Approved values are locked — an idea in execution cannot return to IN' }
  // forward moves need the stage form of every stage being left
  if (ti > ci) {
    if (ci <= stages.indexOf(STAGE.feasibility) && ti > stages.indexOf(STAGE.feasibility) && idea.feasibilityCheck?.decision !== 'Go') return { ok: false, reason: 'Open the idea and complete the Team feasibility check (Go / No-go) first' }
    if (ci <= stages.indexOf(STAGE.evaluation) && ti > stages.indexOf(STAGE.evaluation) && idea.evaluation?.decision !== 'Recommend') return { ok: false, reason: `Open the idea and complete the ${stageLabel(idea, STAGE.evaluation)} (cost-benefit, risk, supplier check) first` }
    if (ti > ai && (!idea.lock || idea.approvals.some((a) => a.decision !== 'Approved'))) return { ok: false, reason: 'Sign the budget & timeline lock and approve in department approval before execution can start' }
  }
  if (ti > ai && ci <= ai) {
    if (!ideaPerms(me, idea, users).approve && !hasRole(me, 'head', 'admin')) return { ok: false, reason: `Moving past ${stageLabel(idea, STAGE.approval)} needs the department head (or the Sourcing Head / Admin)` }
  } else if (ti <= ai) {
    if (!(p.feasibilityCheck || p.evaluate || p.approve)) return { ok: false, reason: `Moving ${idea.id} needs ${who}` }
  } else if (!p.handOver) return { ok: false, reason: `Execution moves need the ${ideaDept(idea)} execution owner (or the Sourcing Head / Admin)` }
  return { ok: true, kind: 'move', stage, backward: ti < ci }
}

/** Execution Hub rights for one execution — straight from the ladder */
export function execRights(me: User | null | undefined, idea: Idea, users: User[]) {
  const p = ideaPerms(me, idea, users)
  return { editable: p.handOver, canReassign: p.reassign && idea.bucket === 'In Execution' }
}
/** Who an execution can be handed to: the idea's department execution owners (Sourcing: the commodity buyers) */
export function ownerCandidates(idea: Idea, users: User[]): User[] {
  const dept = ideaDept(idea)
  const list = users.filter((u) => u.active !== false && u.department === dept && u.roles.includes('execowner'))
  const cur = users.find((u) => u.id === idea.ownerId)
  return cur && !list.includes(cur) ? [cur, ...list] : list
}

