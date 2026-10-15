// Final-review fixes: every action entry point follows the department ladder (C1, C2, I1–I6).
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { execRights, ideaPerms, kanbanMove, ownerCandidates } from '../pages/idea/model'
import { canSeeIdea, ideaAnnualised } from '../lib/calc'
import { canOpenReports } from '../lib/nav'
import { STAGE } from '../lib/masters'
import { approvalRoute, lockTarget } from '../lib/workflow'
import { queueFor } from '../pages/queue/model'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
const rd = (stage: string) => st().ideas.find((i) => i.stage === stage && i.evaluation?.dept === 'R&D' && i.bucket !== 'Dropped')!
const rdExec = () => st().ideas.find((i) => i.stage === STAGE.execution && i.evaluation?.dept === 'R&D' && i.execution?.status === 'In Execution' && i.execution.effectiveDate)!

beforeEach(() => { st().resetDemo(); st().loginAs('u-head') })

describe('C1 — the board follows the ladder', () => {
  it('a Sourcing buyer or lead cannot move, drop or hand over another department\'s idea', () => {
    const a = rd(STAGE.approval)
    for (const u of ['u-buyer2', 'u-lead1']) for (const t of ['feasibility', 'evaluation', 'dropped']) expect(kanbanMove(user(u), a, t).ok, `${u} → ${t}`).toBe(false)
    const ex = rdExec()
    expect(ex).toBeTruthy()
    expect(kanbanMove(user('u-lead1'), ex, 'verification').ok).toBe(false)
    expect(kanbanMove(user('u-buyer2'), ex, 'dropped').ok).toBe(false)
  })
  it('the stage\'s own role and the override users can use the board', () => {
    expect(kanbanMove(user('u-rd-head'), rd(STAGE.approval), 'evaluation').ok).toBe(true)
    expect(kanbanMove(user('u-admin'), rd(STAGE.approval), 'evaluation').ok).toBe(true)
    expect(kanbanMove(user('u-rd-exec'), rdExec(), 'verification').ok).toBe(true)
  })
})

describe('C2 — Execution Hub rights', () => {
  it('only the department execution owner, the department head (reassign) and override users edit', () => {
    const ex = rdExec()
    expect(execRights(user('u-lead1'), ex).editable).toBe(false)
    expect(execRights(user('u-buyer2'), ex).editable).toBe(false)
    expect(execRights(user('u-rd-exec'), ex).editable).toBe(true)
    expect(execRights(user('u-admin'), ex).editable).toBe(true)
    expect(execRights(user('u-rd-head'), ex).canReassign).toBe(true)
    expect(execRights(user('u-lead1'), ex).canReassign).toBe(false)
  })
})

describe('I1 — pipeline reassignment does not hijack the ladder', () => {
  it('the department head still approves and the department execution owner still executes', () => {
    const a = rd(STAGE.approval)
    expect(ideaPerms(user('u-buyer2'), a).reassign).toBe(false)
    st().reassign(a.id, 'u-buyer2', 'commodity buyer change')
    expect(idea(a.id).approvals[0].approverId).toBe('u-rd-head')
    expect(idea(a.id).ownerId).toBeUndefined()
    st().loginAs('u-rd-head')
    st().signLock(a.id, { commercialOk: true, supplierAligned: 'Confirmed', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: lockTarget(ideaAnnualised(idea(a.id)), 6), signatureName: 'Dr. Sameer Kulkarni' })
    expect(st().approve(a.id)).toBe(true)
    expect(idea(a.id).ownerId).toBe('u-rd-exec')
    // I6 — the execution owner is told execution has started
    expect(st().notifications.some((n) => n.userId === 'u-rd-exec' && n.ideaId === a.id)).toBe(true)
  })
})

describe('I2 / I3 — reassigned owners', () => {
  it('a reassigned execution owner can open the idea and finds it in their queue', () => {
    const ex = rdExec()
    st().reassign(ex.id, 'u-buyer1', 'cover during leave')
    expect(canSeeIdea(user('u-buyer1'), idea(ex.id))).toBe(true)
    expect(queueFor(user('u-buyer1'), st().ideas, st().users).mine.some((r) => r.idea.id === ex.id)).toBe(true)
  })
  it('owner candidates come from the idea\'s department', () => {
    const ids = ownerCandidates(rdExec(), st().users).map((u) => u.id)
    expect(ids).toContain('u-rd-exec')
    expect(ids).not.toContain('u-lead1')
    const src = st().ideas.find((i) => i.stage === STAGE.execution && i.evaluation?.dept === 'Sourcing')!
    expect(ownerCandidates(src, st().users).some((u) => u.roles.includes('buyer'))).toBe(true)
  })
})

describe('I4 — MIS for department leads and heads', () => {
  it('opens for the roles the sidebar offers it to', () => {
    expect(canOpenReports(user('u-eval1'))).toBe(true)
    expect(canOpenReports(user('u-rd-head'))).toBe(true)
    expect(canOpenReports(user('u-sub1'))).toBe(false)
  })
})

describe('I5 — Submit shows the department route', () => {
  it('team lead → department lead → department head of the submitter\'s department', () => {
    const names = (r: { userId?: string }[]) => r.map((x) => user(x.userId!).name)
    expect(names(approvalRoute('R&D', 'CMP', st().users, 'u-sub1'))).toEqual(['Arvind Rao', 'Dr. Priya Nair', 'Dr. Sameer Kulkarni'])
    expect(approvalRoute('R&D', 'CMP', st().users, 'u-sub1').map((r) => r.label)).toEqual(['Team feasibility check', 'R&D evaluation', 'R&D approval'])
    expect(names(approvalRoute('R&D', 'CMP', st().users, 'u-rd-tl'))[0]).toBe('Dr. Priya Nair')
  })
})
