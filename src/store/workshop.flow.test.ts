// The flow from the walkthrough of 2 Nov 2026: one ID per department, five stages, and a workshop at stage 2 that holds
// the event, the technical feasibility form and the commercial evaluation form before Go ahead sends it to management.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ideaPerms } from '../pages/idea/model'
import { queueFor } from '../pages/queue/model'
import { canSeeIdea, ideaAnnualised } from '../lib/calc'
import { CO_STAGE_NAMES, IN_STAGES, STAGE, TRACKER_STAGES } from '../lib/masters'
import { DEPARTMENTS, ladderOf, lockTarget, sendBackTargets, stageAssignee, workshopGaps } from '../lib/workflow'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
const can = (uid: string, id: string) => ideaPerms(user(uid), idea(id))
const inQueue = (uid: string, id: string) => queueFor(user(uid), st().ideas, st().users).mine.some((r) => r.idea.id === id)
const part: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }
const small: IdeaPart = { ...part, annualVolume: 10000 }
const person = { submitterName: 'Simran Kaur', employeeId: 'AEL-20932', submitterEmail: 'simran.kaur@ambergroupindia.com' }
const raise = (p: IdeaPart = part) => st().submitIdea({ title: 'Re-bid the Noida canteen contract', commodity: 'CA', leverId: 'L01', parts: [p], currentState: 'Fixed monthly fee', proposedChange: 'Per-meal rate', ...person })
const event = { date: '2026-11-10', time: '11:00', venue: 'Noida · Room 2', points: ['Is the per-meal rate workable?'], attendees: ['HR', 'Sourcing'], spoc: { name: 'Simran Kaur', email: 'simran.kaur@ambergroupindia.com' } }
const feasible = { technical: 'Yes' as const, cost: 'Valid' as const, conflict: 'None' as const, decision: 'Go' as const, departments: ['HR'] }
const held = { notes: 'Agreed to go ahead', closedBy: 'Simran Kaur' }

beforeEach(() => { st().resetDemo(); st().loginAs('id-hr') })

describe('one ID per department', () => {
  it('only the eight department IDs, the Management ID and the Execution Manager ID sign in; people no longer do', () => {
    const ids = st().users.filter((u) => u.active && !u.roles.includes('supplier'))
    expect(ids.map((u) => u.id).sort()).toEqual(['id-dqa', 'id-execution', 'id-finance', 'id-hr', 'id-management', 'id-process', 'id-production', 'id-quality', 'id-rd', 'id-sourcing'])
    expect(st().login('sourcing@ambergroupindia.com', 'coin@2026')).toBe(true)
    expect(st().login('management@ambergroupindia.com', 'coin@2026')).toBe(true)
    expect(st().login('execution@ambergroupindia.com', 'coin@2026')).toBe(true)
    expect(st().login('aditi.sharma@ambergroupindia.com', 'coin@2026')).toBe(false)
    expect(st().login('neha.verma@ambergroupindia.com', 'coin@2026')).toBe(false)
  })
  it('the person behind the ID is typed on the form, and is what the idea records', () => {
    const id = raise()
    expect(idea(id).department).toBe('HR')
    expect(idea(id).submitterName).toBe('Simran Kaur')
    expect(idea(id).employeeId).toBe('AEL-20932')
    expect(idea(id).submitterEmail).toBe('simran.kaur@ambergroupindia.com')
  })
  it('each stage belongs to one ID: the department, Management, the Execution Manager, Finance', () => {
    const id = raise()
    const at = (stage: string) => stageAssignee(idea(id), stage, st().users)
    expect(at(STAGE.feasibility)).toBe('id-hr')
    expect(at(STAGE.approval)).toBe('id-management')
    expect(at(STAGE.execution)).toBe('id-execution')
    expect(at(STAGE.verification)).toBe('id-finance')
    // a person who has left the sign-in list never holds a stage: their execution falls to the Execution Manager ID
    expect(stageAssignee({ ...idea(id), ownerId: 'u-hr-exec' }, STAGE.execution, st().users)).toBe('id-execution')
  })
})

describe('who may act', () => {
  it('every department has its one ID, who holds all of the department\'s work', () => {
    expect([...DEPARTMENTS]).toEqual(['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance', 'Sourcing', 'HR'])
    for (const d of DEPARTMENTS) {
      const l = ladderOf(d, st().users)
      expect(user(l.departmentId!).department, d).toBe(d)
      expect(l.management).toBe('id-management')
      expect(l.verifier).toBe('id-finance')
    }
  })
  it('a supplier idea has its workshop on the Sourcing ID, whatever the commodity', () => {
    const id = raise()
    const supplierIdea = { ...idea(id), department: 'Supplier', commodity: 'AO', submitterId: 'u-sup2', evaluation: undefined }
    expect(stageAssignee(supplierIdea, STAGE.feasibility, st().users)).toBe('id-sourcing')
    expect(stageAssignee(supplierIdea, STAGE.execution, st().users)).toBe('id-execution')
  })
  it('another department\'s ID neither sees nor acts on an idea, at any stage', () => {
    const id = raise()
    expect(canSeeIdea(user('id-hr'), idea(id))).toBe(true)
    expect(canSeeIdea(user('id-rd'), idea(id))).toBe(false)
    for (const stage of [STAGE.feasibility, STAGE.approval, STAGE.execution, STAGE.verification]) {
      const p = ideaPerms(user('id-rd'), { ...idea(id), stage })
      expect(p.workshop || p.approve || p.execute || p.verify, stage).toBe(false)
    }
  })
  it('nobody hands over by hand, the department only watches execution, and it never verifies its own saving', () => {
    const atExecution = { ...idea(raise()), stage: STAGE.execution, bucket: 'In Execution' as const, execution: { status: 'In Execution' as const, milestones: [] } as never }
    expect(ideaPerms(user('id-execution'), atExecution).execute).toBe(true)
    expect(ideaPerms(user('id-hr'), atExecution).execute).toBe(false)
    expect(canSeeIdea(user('id-hr'), atExecution)).toBe(true)
    expect(ideaPerms(user('id-execution'), atExecution).handOver).toBe(false)
    expect(ideaPerms(user('id-hr'), { ...atExecution, stage: STAGE.verification }).verify).toBe(false)
    expect(ideaPerms(user('id-finance'), { ...atExecution, stage: STAGE.verification }).verify).toBe(true)
  })
  it('the Management ID can act at every stage', () => {
    const base = { ...idea(raise()), execution: { status: 'In Execution' as const, milestones: [] } as never, approvals: [{ level: 'Management', approverId: 'id-management' }] }
    expect(ideaPerms(user('id-management'), { ...base, stage: STAGE.feasibility }).workshop).toBe(true)
    expect(ideaPerms(user('id-management'), { ...base, stage: STAGE.approval }).approve).toBe(true)
    expect(ideaPerms(user('id-management'), { ...base, stage: STAGE.execution, bucket: 'In Execution' }).execute).toBe(true)
    expect(ideaPerms(user('id-management'), { ...base, stage: STAGE.verification, bucket: 'In Execution' }).verify).toBe(true)
  })
})

describe('five stages', () => {
  it('three in Innovation Network, two in Cost Optimisation', () => {
    expect(TRACKER_STAGES).toEqual([STAGE.submitted, STAGE.feasibility, STAGE.approval, STAGE.execution, STAGE.verification])
    expect(IN_STAGES).toEqual([STAGE.feasibility, STAGE.approval])
    expect(CO_STAGE_NAMES).toEqual([STAGE.execution, STAGE.verification])
    expect(STAGE.feasibility).toBe('Workshop / event creation')
  })
  it('a workshop runs on every idea: submission lands on it, and no other department can act', () => {
    const id = raise()
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(inQueue('id-hr', id)).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'id-hr' && n.ideaId === id)).toBe(true)
    expect(can('id-rd', id).workshop).toBe(false)
    expect(can('id-hr', id).workshop).toBe(true)
    expect(can('id-management', id).workshop).toBe(true)
  })
  it('Go ahead needs the feasibility form, the evaluation form and an open event — nothing moves before', () => {
    const id = raise()
    expect(workshopGaps(idea(id), ideaAnnualised(idea(id)))).toEqual(['Workshop event', 'Technical feasibility check', 'Commercial evaluation'])
    const ev = st().createWorkshopEvent(id, event)
    expect(idea(id).workshop?.events).toHaveLength(1)
    expect(idea(id).workshop?.events[0]).toMatchObject({ no: 1, status: 'Scheduled', spoc: event.spoc })
    expect(st().closeWorkshopEvent(id, ev, { ...held, outcome: 'Go ahead' })).toBe(false)
    expect(idea(id).stage).toBe(STAGE.feasibility)

    st().recordFeasibility(id, feasible)
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).feasibilityCheck?.decision).toBe('Go')
    expect(st().closeWorkshopEvent(id, ev, { ...held, outcome: 'Go ahead' })).toBe(false)

    st().recordEvaluation(id, 'Recommend', 'CBA verified')
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).evaluation?.decision).toBe('Recommend')
    expect(workshopGaps(idea(id), ideaAnnualised(idea(id)))).toEqual([])

    expect(st().closeWorkshopEvent(id, ev, { ...held, outcome: 'Go ahead' })).toBe(true)
    expect(idea(id).stage).toBe(STAGE.approval)
    expect(idea(id).workshop?.events[0]).toMatchObject({ status: 'Held', outcome: 'Go ahead', closedBy: 'Simran Kaur', notes: 'Agreed to go ahead' })
    expect(idea(id).workshop?.goAheadBy).toBe('Simran Kaur')
  })
  it('closing an event needs a name, because the ID itself is shared', () => {
    const id = raise()
    const ev = st().createWorkshopEvent(id, event)
    st().recordFeasibility(id, feasible)
    st().recordEvaluation(id, 'Recommend')
    expect(st().closeWorkshopEvent(id, ev, { notes: 'ok', closedBy: '  ', outcome: 'Go ahead' })).toBe(false)
    expect(idea(id).stage).toBe(STAGE.feasibility)
  })
  it('a follow-up discussion closes this event and schedules the next, with the SPOC changed if someone else attends', () => {
    const id = raise()
    const ev = st().createWorkshopEvent(id, event)
    const stand = { name: 'Rohit Bansal', email: 'rohit.bansal@ambergroupindia.com' }
    expect(st().closeWorkshopEvent(id, ev, { notes: 'Need the vendor quote', closedBy: 'Simran Kaur', outcome: 'Follow-up', followUp: { date: '2026-11-17', time: '15:00', venue: 'Teams', points: ['Vendor quote'], spoc: stand } })).toBe(true)
    const [one, two] = idea(id).workshop!.events
    expect(one).toMatchObject({ status: 'Held', outcome: 'Follow-up' })
    expect(two).toMatchObject({ no: 2, status: 'Scheduled', date: '2026-11-17', points: ['Vendor quote'], spoc: stand })
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(st().emails.some((e) => e.to.includes(stand.email))).toBe(true)
  })
  it('below ₹ 5 L the evaluation is not needed: the workshop goes ahead on the feasibility form alone', () => {
    const id = raise(small)
    expect(ideaAnnualised(idea(id))).toBeLessThan(5_00_000)
    const ev = st().createWorkshopEvent(id, event)
    expect(can('id-hr', id).evaluate).toBe(false)
    st().recordFeasibility(id, feasible)
    expect(workshopGaps(idea(id), ideaAnnualised(idea(id)))).toEqual([])
    expect(st().closeWorkshopEvent(id, ev, { ...held, outcome: 'Go ahead' })).toBe(true)
    expect(idea(id).stage).toBe(STAGE.approval)
    expect(idea(id).evaluation?.skipped).toBe(true)
  })
  it('No-go on feasibility or Reject on evaluation drops the idea for good', () => {
    const a = raise()
    st().recordFeasibility(a, { ...feasible, technical: 'No', decision: 'No-go', remarks: 'Not workable' })
    expect(idea(a).stage).toBe('Dropped')
    const b = raise()
    st().recordEvaluation(b, 'Reject', 'Saving too thin')
    expect(idea(b).stage).toBe('Rejected')
  })
  it('management approval signs the KPI, then the idea moves to Cost Optimisation with the Execution Manager ID as owner', () => {
    const id = raise()
    const ev = st().createWorkshopEvent(id, event)
    st().recordFeasibility(id, feasible)
    st().recordEvaluation(id, 'Recommend')
    st().closeWorkshopEvent(id, ev, { ...held, outcome: 'Go ahead' })
    expect(idea(id).approvals).toEqual([{ level: 'Management', approverId: 'id-management' }])
    expect(inQueue('id-management', id)).toBe(true)
    expect(inQueue('id-hr', id)).toBe(false)
    expect(can('id-hr', id).approve).toBe(false)
    st().loginAs('id-management')
    expect(can('id-management', id).approve).toBe(true)
    const target = lockTarget(ideaAnnualised(idea(id)), 6)
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: target, signatureName: 'Abhishek Sharma', kpi: { owner: 'Simran Kaur', ownerEmail: person.submitterEmail, target } })
    expect(st().approve(id, 'On the workshop minutes')).toBe(true)
    expect(idea(id).stage).toBe(STAGE.execution)
    expect(idea(id).bucket).toBe('In Execution')
    expect(idea(id).ownerId).toBe('id-execution')
    expect(idea(id).lock?.kpi?.owner).toBe('Simran Kaur')
    expect(idea(id).lock?.signatureName).toBe('Abhishek Sharma')
    expect(inQueue('id-execution', id)).toBe(true)
    expect(inQueue('id-hr', id)).toBe(false)
  })
  it('sent back from management, the workshop runs again: forms reopen and a new event is needed', () => {
    const id = raise()
    const ev = st().createWorkshopEvent(id, event)
    st().recordFeasibility(id, feasible)
    st().recordEvaluation(id, 'Recommend')
    st().closeWorkshopEvent(id, ev, { ...held, outcome: 'Go ahead' })
    expect(sendBackTargets(idea(id)).map((t) => t.to)).toEqual(['submitter', STAGE.feasibility])
    st().loginAs('id-management')
    st().sendBack(id, 'Quote is out of date', STAGE.feasibility)
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).feasibilityCheck).toBeUndefined()
    expect(idea(id).evaluation?.decision).toBeUndefined()
    expect(idea(id).workshop?.goAheadAt).toBeUndefined()
    expect(idea(id).workshop?.events).toHaveLength(1) // the minutes of the earlier event stay on record
    expect(workshopGaps(idea(id), ideaAnnualised(idea(id)))).toContain('Workshop event')
  })
})
