// One HR idea through all six stages, each step taken by the person the department ladder names —
// and refused for people from another department or another stage.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ideaPerms } from '../pages/idea/model'
import { queueFor } from '../pages/queue/model'
import { ideaAnnualised } from '../lib/calc'
import { STAGE } from '../lib/masters'
import { lockTarget } from '../lib/workflow'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
const can = (uid: string, id: string) => ideaPerms(user(uid), idea(id))
const inQueue = (uid: string, id: string) => queueFor(user(uid), st().ideas, st().users).mine.some((r) => r.idea.id === id)
const part: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }

beforeEach(() => { st().resetDemo() })

describe('an HR idea runs the whole department ladder', () => {
  it('employee → team lead → department lead → department head → execution owner → Finance', () => {
    st().loginAs('u-hr-emp')
    const id = st().submitIdea({ title: 'Re-bid the Noida canteen contract on a per-meal rate', commodity: 'FAC', leverId: 'L01', parts: [part], currentState: 'Fixed monthly fee', proposedChange: 'Per-meal rate' })
    expect(idea(id).department).toBe('HR')
    expect(idea(id).stage).toBe(STAGE.feasibility)

    // 2 · team feasibility check — HR team lead only
    expect(inQueue('u-hr-tl', id)).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'u-hr-tl' && n.ideaId === id)).toBe(true)
    expect(can('u-hr-emp', id).feasibilityCheck).toBe(false)
    expect(can('u-rd-tl', id).feasibilityCheck).toBe(false)
    st().loginAs('u-hr-tl')
    expect(can('u-hr-tl', id).feasibilityCheck).toBe(true)
    st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'], remarks: 'Feasible' })
    expect(idea(id).stage).toBe(STAGE.evaluation)
    expect(idea(id).feasibilityCheck?.by).toBe('Varun Malhotra')

    // 3 · HR evaluation — HR department lead
    expect(idea(id).evaluation?.dept).toBe('HR')
    expect(inQueue('u-hr-lead', id)).toBe(true)
    expect(can('u-hr-tl', id).evaluate).toBe(false)
    expect(can('u-eval1', id).evaluate).toBe(false)
    st().loginAs('u-hr-lead')
    expect(can('u-hr-lead', id).evaluate).toBe(true)
    st().recordEvaluation(id, 'Recommend', 'CBA verified')
    expect(idea(id).stage).toBe(STAGE.approval)

    // 4 · HR approval — HR department head signs the lock and approves
    expect(idea(id).approvals).toEqual([{ level: 'HR head', approverId: 'u-hr-head' }])
    expect(inQueue('u-hr-head', id)).toBe(true)
    expect(can('u-hr-lead', id).approve).toBe(false)
    expect(can('u-qa-head', id).approve).toBe(false)
    st().loginAs('u-hr-head')
    expect(can('u-hr-head', id).approve).toBe(true)
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: 6, startDate: '2026-11-01', endDate: '2027-05-01', targetSaving: lockTarget(ideaAnnualised(idea(id)), 6), signatureName: 'Lata Krishnan' })
    expect(st().approve(id)).toBe(true)
    expect(idea(id).stage).toBe(STAGE.execution)
    expect(idea(id).ownerId).toBe('u-hr-exec')

    // 5 · execution — HR execution owner keeps the record; MRN is counted month by month from the savings start;
    //     when the locked timeline ends COIN moves the idea to verification by itself
    expect(inQueue('u-hr-exec', id)).toBe(true)
    expect(can('u-hr-head', id).execute).toBe(false)
    expect(can('u-pr-exec', id).execute).toBe(false)
    expect(can('u-hr-exec', id).execute).toBe(true)
    expect(can('u-hr-exec', id).handOver).toBe(false)
    st().uploadMrn([{ ideaId: id, partCode: part.partCode, month: '2026-11', mrnQty: 20000, mrnPrice: 96 }])
    expect(idea(id).execution?.effectiveDate).toBe('2026-11-01')
    st().closeEndedExecutions('2027-04-30')
    expect(idea(id).stage).toBe(STAGE.execution)
    st().closeEndedExecutions('2027-05-01')
    expect(idea(id).stage).toBe(STAGE.verification)

    // 6 · verification — Finance
    expect(st().notifications.some((n) => n.userId === 'u-fin' && n.ideaId === id)).toBe(true)
    expect(inQueue('u-fin', id)).toBe(true)
    expect(can('u-hr-head', id).verify).toBe(false)
    st().loginAs('u-fin')
    expect(can('u-fin', id).verify).toBe(true)
    // the locked window runs to April 2027 — Finance verifies once April's MRN is read
    expect(idea(id).verification?.finalMrnMonth).toBe('2027-04')
    expect(st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: idea(id).lock!.targetSaving })).toBe(false)
    st().syncMrn('2027-05-06')
    expect(idea(id).verification?.actualAtClose).toBeTypeOf('number')
    expect(st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: idea(id).lock!.targetSaving })).toBe(true)
    expect(idea(id).verification?.verifiedBy).toBe('Meera Iyer')
    expect(inQueue('u-fin', id)).toBe(false)
  })
})
