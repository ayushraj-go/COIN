// My queue — the ideas waiting for one person's action, one row per idea, with how long it has waited.
// Who a row belongs to comes from stageAssignee (the department ladder); Sourcing Head and Admin also see every open item.
import type { Idea, SlaRule, User } from '../../lib/types'
import { SLA_RULES_DEFAULT, STAGE } from '../../lib/masters'
import { stageAssignee } from '../../lib/workflow'
import { healthOf, slaStatus } from '../../lib/calc'

export type QueueAction = 'feasibility' | 'evaluate' | 'approve' | 'execute' | 'verify'
export type QueueSla = 'ok' | 'due' | 'breach'
export interface QueueRow { idea: Idea; action: QueueAction; assignee?: string; assignedToMe: boolean; waitingHours: number; sla: QueueSla; slaDays?: number }

export const ACTION_META: Record<QueueAction, { label: string; verb: string; icon: string }> = {
  feasibility: { label: 'Team feasibility check', verb: 'Check feasibility', icon: 'UsersRound' },
  evaluate: { label: 'Evaluation', verb: 'Evaluate', icon: 'FlaskConical' },
  approve: { label: 'Approval', verb: 'Approve & sign', icon: 'Signature' },
  execute: { label: 'Execution', verb: 'Update execution', icon: 'Rocket' },
  verify: { label: 'Verification', verb: 'Verify', icon: 'ShieldCheck' },
}

/** the action an open idea is waiting for, or null when nothing is pending */
export function pendingAction(i: Idea): QueueAction | null {
  if (i.bucket === 'Dropped' || i.bucket === 'Draft') return null
  if (i.stage === STAGE.feasibility) return 'feasibility'
  if (i.stage === STAGE.evaluation) return 'evaluate'
  if (i.stage === STAGE.approval) return i.approvals.some((a) => !a.decision) || !i.approvals.length ? 'approve' : null
  if (i.stage === STAGE.execution) return i.execution?.status === 'In Execution' ? 'execute' : null
  if (i.stage === STAGE.verification) return i.verification?.verifiedAt ? null : 'verify'
  return null
}

const RANK: Record<QueueSla, number> = { breach: 0, due: 1, ok: 2 }

export function queueFor(me: User, ideas: Idea[], users: User[], now = Date.now(), rules: SlaRule[] = SLA_RULES_DEFAULT): { mine: QueueRow[]; all: QueueRow[] } {
  const override = me.roles.includes('head') || me.roles.includes('admin')
  const rows: QueueRow[] = []
  for (const idea of ideas) {
    const action = pendingAction(idea)
    if (!action) continue
    const assignee = stageAssignee(idea, idea.stage, users)
    const assignedToMe = assignee === me.id
    if (!assignedToMe && !override) continue
    let sla: QueueSla = 'ok'
    let slaDays: number | undefined
    if (action === 'execute') {
      const h = healthOf(idea)
      sla = h === 'Delayed' ? 'breach' : h === 'At risk' ? 'due' : 'ok'
    } else {
      const st = slaStatus(idea, rules)
      sla = st.state === 'breach' || st.state === 'escalated' ? 'breach' : st.state === 'due' ? 'due' : 'ok'
      slaDays = st.sla || undefined
    }
    const waitingHours = Math.max(0, Math.floor((now - Date.parse(idea.stageEnteredAt)) / 3.6e6))
    rows.push({ idea, action, assignee, assignedToMe, waitingHours, sla, slaDays })
  }
  rows.sort((a, b) => RANK[a.sla] - RANK[b.sla] || b.waitingHours - a.waitingHours)
  const mine = rows.filter((r) => r.assignedToMe)
  return { mine, all: override ? rows : mine }
}

/** "3 d 4 h" / "5 h" */
export const waitingText = (h: number) => (h >= 24 ? `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}` : `${h} h`)
