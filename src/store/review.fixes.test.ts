// Every action entry point follows the department IDs: the board, the Execution Hub, pipeline reassignment and MIS.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import type { Idea } from '../lib/types'
import { execRights, kanbanMove, ownerCandidates } from '../pages/idea/model'
import { ideaAnnualised } from '../lib/calc'
import { canOpenReports } from '../lib/nav'
import { STAGE } from '../lib/masters'
import { ideaDept, ladderOf, lockTarget } from '../lib/workflow'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
// the demo data moves with the date, so these use whichever department's idea is there; the Sourcing ID is always the outsider
const atApproval = () => st().ideas.find((i) => i.stage === STAGE.approval && ideaDept(i) !== 'Sourcing' && i.bucket !== 'Dropped')!
const liveExec = () => st().ideas.find((i) => i.stage === STAGE.execution && ideaDept(i) !== 'Sourcing' && i.execution?.status === 'In Execution' && i.execution.effectiveDate)!
const execId = (i: Idea) => ladderOf(ideaDept(i), st().users).execution!
const deptId = (i: Idea) => ladderOf(ideaDept(i), st().users).departmentId!

beforeEach(() => { st().resetDemo(); st().loginAs('id-management') })

describe('the board follows the IDs', () => {
  it('another department\'s ID cannot move, drop or hand over an idea', () => {
    const a = atApproval()
    for (const t of ['feasibility', 'dropped']) expect(kanbanMove(user('id-sourcing'), a, t).ok, t).toBe(false)
    const ex = liveExec()
    expect(ex).toBeTruthy()
    expect(kanbanMove(user('id-sourcing'), ex, 'verification').ok).toBe(false)
    expect(kanbanMove(user('id-sourcing'), ex, 'dropped').ok).toBe(false)
  })
  it('the stage\'s own ID and the Management ID can use the board', () => {
    expect(kanbanMove(user('id-management'), atApproval(), 'feasibility').ok).toBe(true)
    // verification is reached only when the locked timeline ends — never by a board move
    expect(kanbanMove(user(execId(liveExec())), liveExec(), 'verification').ok).toBe(false)
    expect(kanbanMove(user(execId(liveExec())), liveExec(), 'dropped').ok).toBe(true)
  })
})

describe('Execution Hub rights', () => {
  it('the Execution Manager ID and the Management ID edit; the department only watches; nobody reassigns', () => {
    const ex = liveExec()
    expect(execRights(user('id-sourcing'), ex).editable).toBe(false)
    expect(execRights(user(deptId(ex)), ex).editable).toBe(false)
    expect(execRights(user('id-execution'), ex).editable).toBe(true)
    expect(execRights(user('id-execution'), ex).canReassign).toBe(false)
    expect(execRights(user('id-management'), ex).editable).toBe(true)
    expect(execRights(user('id-management'), ex).canReassign).toBe(false)
  })
})

describe('pipeline reassignment does not hijack the flow', () => {
  it('the Management ID still approves and the Execution Manager ID still executes', () => {
    const a = atApproval()
    st().reassign(a.id, 'id-sourcing', 'commodity buyer change')
    expect(idea(a.id).approvals[0].approverId).toBe('id-management')
    expect(idea(a.id).ownerId).toBeUndefined()
    st().signLock(a.id, { commercialOk: true, supplierAligned: 'Confirmed', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: lockTarget(ideaAnnualised(idea(a.id)), 6), signatureName: 'Dr. Sameer Kulkarni' })
    expect(st().approve(a.id)).toBe(true)
    expect(idea(a.id).ownerId).toBe(execId(a))
    // the Execution Manager ID is told execution has started
    expect(st().notifications.some((n) => n.userId === execId(a) && n.ideaId === a.id)).toBe(true)
  })
  it('the only owner an execution can have is the Execution Manager ID', () => {
    expect(ownerCandidates(liveExec(), st().users).map((u) => u.id)).toEqual(['id-execution'])
    // an execution that has lost its owner still has exactly one place to go
    expect(ownerCandidates({ ...liveExec(), ownerId: undefined }, st().users).map((u) => u.id)).toEqual(['id-execution'])
  })
})

describe('MIS', () => {
  it('opens for the IDs the sidebar offers it to', () => {
    expect(canOpenReports(user('id-rd'))).toBe(true)
    expect(canOpenReports(user('id-management'))).toBe(true)
    expect(canOpenReports(user('id-finance'))).toBe(true)
  })
})
