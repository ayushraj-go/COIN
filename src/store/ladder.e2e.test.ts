// One HR idea through all five stages, each step taken by the ID that owns it —
// and refused for another department's ID.
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

describe('an HR idea runs the five stages', () => {
  it('department ID → workshop → Management ID → Execution Manager ID → Finance', () => {
    // 1 · idea submitted on the HR ID, by a person who types their name
    st().loginAs('id-hr')
    const id = st().submitIdea({ title: 'Re-bid the Noida canteen contract on a per-meal rate', commodity: 'CA', leverId: 'L01', parts: [part], currentState: 'Fixed monthly fee', proposedChange: 'Per-meal rate', submitterName: 'Simran Kaur', employeeId: 'AEL-20932' })
    expect(idea(id).department).toBe('HR')
    expect(idea(id).stage).toBe(STAGE.feasibility)

    // 2 · workshop — the HR ID creates the event, fills both forms, and closes it with Go ahead
    expect(inQueue('id-hr', id)).toBe(true)
    expect(can('id-rd', id).workshop).toBe(false)
    const ev = st().createWorkshopEvent(id, { date: '2026-11-10', time: '11:00', venue: 'Noida', points: ['Is the per-meal rate workable?'], attendees: ['HR', 'Sourcing'], spoc: { name: 'Simran Kaur', email: 'simran.kaur@ambergroupindia.com' } })
    st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'], remarks: 'Feasible' })
    st().recordEvaluation(id, 'Recommend', 'CBA verified')
    expect(idea(id).evaluation?.dept).toBe('HR')
    expect(st().closeWorkshopEvent(id, ev, { notes: 'Agreed', closedBy: 'Simran Kaur', outcome: 'Go ahead' })).toBe(true)
    expect(idea(id).stage).toBe(STAGE.approval)

    // 3 · management approval — the Management ID signs the lock and the KPI, and approves
    expect(idea(id).approvals).toEqual([{ level: 'Management', approverId: 'id-management' }])
    expect(inQueue('id-management', id)).toBe(true)
    expect(can('id-hr', id).approve).toBe(false)
    st().loginAs('id-management')
    expect(can('id-management', id).approve).toBe(true)
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: 6, startDate: '2026-11-01', endDate: '2027-05-01', targetSaving: lockTarget(ideaAnnualised(idea(id)), 6), signatureName: 'Lata Krishnan' })
    expect(st().approve(id)).toBe(true)
    expect(idea(id).stage).toBe(STAGE.execution)
    expect(idea(id).ownerId).toBe('id-execution')

    // 4 · execution — the Execution Manager ID keeps the record; MRN is counted month by month from the savings start;
    //     when the locked timeline ends COIN moves the idea to verification by itself
    expect(inQueue('id-execution', id)).toBe(true)
    expect(inQueue('id-hr', id)).toBe(false)
    expect(can('id-rd', id).execute).toBe(false)
    expect(can('id-hr', id).execute).toBe(false)
    expect(can('id-execution', id).execute).toBe(true)
    expect(can('id-execution', id).handOver).toBe(false)
    st().uploadMrn([{ ideaId: id, partCode: part.partCode, month: '2026-11', mrnQty: 20000, mrnPrice: 96 }])
    expect(idea(id).execution?.effectiveDate).toBe('2026-11-01')
    st().closeEndedExecutions('2027-04-30')
    expect(idea(id).stage).toBe(STAGE.execution)
    st().closeEndedExecutions('2027-05-01')
    expect(idea(id).stage).toBe(STAGE.verification)

    // 5 · verification — Finance
    expect(st().notifications.some((n) => n.userId === 'id-finance' && n.ideaId === id)).toBe(true)
    expect(inQueue('id-finance', id)).toBe(true)
    expect(can('id-hr', id).verify).toBe(false)
    st().loginAs('id-finance')
    expect(can('id-finance', id).verify).toBe(true)
    // the locked window runs to April 2027 — Finance verifies once April's MRN is read
    expect(idea(id).verification?.finalMrnMonth).toBe('2027-04')
    expect(st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: idea(id).lock!.targetSaving })).toBe(false)
    st().syncMrn('2027-05-06')
    expect(idea(id).verification?.actualAtClose).toBeTypeOf('number')
    expect(st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: idea(id).lock!.targetSaving })).toBe(true)
    expect(idea(id).verification?.verifiedBy).toBe(user('id-finance').name)
    expect(inQueue('id-finance', id)).toBe(false)
  })
})
