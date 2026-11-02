import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ideaPerms, kanbanMove } from '../pages/idea/model'
import { canSeeIdea, ideaAnnualised } from '../lib/calc'
import { STAGE } from '../lib/masters'
import { ideaDept, ladderOf, lockTarget } from '../lib/workflow'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const show = (n: number) => st().ideas.find((i) => i.showcase === n)!
const user = (id: string) => st().users.find((u) => u.id === id)!
const signValidLock = (id: string) => {
  const i = idea(id)
  st().signLock(id, { commercialOk: true, supplierAligned: 'Confirmed', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: lockTarget(ideaAnnualised(i), 6), signatureName: 'Girish Saluja' })
}

beforeEach(() => { st().resetDemo(); st().loginAs('id-management') })

describe('send back clears the stage records (review #1)', () => {
  it('a sent-back idea must pass the workshop and the lock again', () => {
    const id = show(3).id
    signValidLock(id)
    st().sendBack(id, 'Rework the baseline')
    const i = idea(id)
    expect(i.stage).toBe(STAGE.feasibility)
    expect(i.feasibilityCheck).toBeUndefined()
    expect(i.evaluation?.decision).toBeUndefined()
    expect(i.lock).toBeUndefined()
    expect(i.approvals.every((a) => !a.decision)).toBe(true)
    expect(kanbanMove(user('id-management'), i, 'approval').ok).toBe(false)
  })
  it('approve refuses a lock whose target no longer matches the idea', () => {
    const id = show(3).id
    st().signLock(id, { commercialOk: true, supplierAligned: 'Confirmed', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: 999, signatureName: 'x' })
    expect(st().approve(id)).toBe(false)
    expect(idea(id).stage).toBe(STAGE.approval)
  })
})

describe('verification (review #2, #3)', () => {
  it('only Finance and the Management ID may verify — not the department that executed it', () => {
    const s5 = show(5)
    expect(ideaDept(s5)).not.toBe('Finance')
    expect(ideaPerms(user(ladderOf(ideaDept(s5), st().users).departmentId!), s5).verify).toBe(false)
    expect(ideaPerms(user('id-management'), s5).verify).toBe(true)
    expect(ideaPerms(user('id-finance'), s5).verify).toBe(true)
  })
  it('verifying with a failed check is logged as an exception, never as "target achieved"', () => {
    const id = show(5).id
    st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: false, remarks: 'Accepted — volume dip in September', targetAtVerification: 100 })
    const i = idea(id)
    const last = i.activity[i.activity.length - 1].action
    expect(last).not.toMatch(/target achieved/)
    expect(last).toMatch(/exception/i)
  })
})

describe('the workshop (review #4)', () => {
  it('the department\'s own ID runs it; other departments neither see nor act', () => {
    const s1 = show(1) // R&D idea
    expect(canSeeIdea(user('id-rd'), s1)).toBe(true)
    expect(ideaPerms(user('id-rd'), s1).workshop).toBe(true)
    expect(ideaPerms(user('id-management'), s1).workshop).toBe(true)
    expect(canSeeIdea(user('id-hr'), s1)).toBe(false)
    expect(ideaPerms(user('id-hr'), s1).workshop).toBe(false)
  })
})

describe('return to execution resets the hand-over (review minor #3, regraded)', () => {
  it('an idea returned from verification no longer looks implemented or handed over', () => {
    const id = show(5).id
    st().returnToExecution(id, 'MRN price above approved in September')
    const i = idea(id)
    expect(i.stage).toBe(STAGE.execution)
    expect(i.implementedAt).toBeUndefined()
    expect(i.verification?.handedAt).toBeUndefined()
    expect(i.verification?.returnReason).toBe('MRN price above approved in September')
    expect(i.execution!.progress).toBeLessThan(100)
  })
})

describe('verification uses MRN inside the lock window (review minor #10, regraded)', () => {
  it('realisedAtVerification counts only MRN months inside the locked period', () => {
    const id = show(6).id
    const i = idea(id)
    const inWindow = st().ledger.filter((l) => l.ideaId === id && l.month >= i.lock!.startDate.slice(0, 7) && l.month < i.lock!.endDate.slice(0, 7)).reduce((a, l) => a + l.realised, 0)
    const all = st().ledger.filter((l) => l.ideaId === id).reduce((a, l) => a + l.realised, 0)
    expect(all).toBeGreaterThan(inWindow) // S6 keeps realising after its 3-month lock
    st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: 1 })
    expect(Math.round(idea(id).verification!.realisedAtVerification!)).toBe(Math.round(inWindow))
  })
})

describe('management approval and the execution owner', () => {
  it('after Go ahead the idea waits on the Management ID, who approves; execution goes to the Execution Manager ID', () => {
    const s2 = show(2)
    const dept = s2.evaluation!.dept
    expect(dept).not.toBe('Sourcing')
    const owner = ladderOf(dept, st().users).execution!
    st().recordEvaluation(s2.id, 'Recommend', 'ok')
    const ev = idea(s2.id).workshop!.events.find((e) => e.status === 'Scheduled')!
    expect(st().closeWorkshopEvent(s2.id, ev.id, { notes: 'ok', closedBy: 'Test SPOC', outcome: 'Go ahead' })).toBe(true)
    const a = idea(s2.id)
    expect(a.stage).toBe(STAGE.approval)
    expect(a.approvals).toEqual([{ level: 'Management', approverId: 'id-management' }])
    expect(st().notifications.some((n) => n.userId === 'id-management' && n.ideaId === s2.id)).toBe(true)
    signValidLock(s2.id)
    expect(st().approve(s2.id)).toBe(true)
    const b = idea(s2.id)
    expect(b.stage).toBe(STAGE.execution)
    expect(b.approvals[0]).toMatchObject({ decision: 'Approved', approverId: 'id-management' })
    expect(b.ownerId).toBe(owner)
    expect(b.execution?.ownerId).toBe(owner)
  })
})
