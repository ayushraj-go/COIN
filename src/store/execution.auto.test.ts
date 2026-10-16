// Stage 5–6 run on MRN: savings are counted only from MRN transactions month by month, inside the locked timeline;
// when the timeline signed at stage 4 ends, the idea moves to Verification by itself with forecast vs MRN actual.
// Also: the department evaluation's cost-benefit inputs can be changed, and the pipeline has no free "reassign".
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ideaPerms, kanbanMove } from '../pages/idea/model'
import { cbaFigures, ideaAnnualised } from '../lib/calc'
import { STAGE } from '../lib/masters'
import { inLockWindow, lockTarget, sendBackTargets } from '../lib/workflow'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
// (110 − 96) × 240 000 = ₹ 33.6 L a year
const meals: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }

/** An HR idea taken to Execution started with the lock window given */
function approved(start: string, end: string, months: number) {
  st().loginAs('u-hr-emp')
  const id = st().submitIdea({ title: 'Canteen per-meal rate', commodity: 'FAC', leverId: 'L01', parts: [meals], currentState: 'Fixed fee', proposedChange: 'Per meal' })
  st().loginAs('u-hr-tl'); st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })
  st().loginAs('u-hr-lead'); st().recordEvaluation(id, 'Recommend', 'ok')
  st().loginAs('u-hr-head')
  st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: months, startDate: start, endDate: end, targetSaving: lockTarget(ideaAnnualised(idea(id)), months), signatureName: 'Lata Krishnan' })
  st().approve(id)
  return id
}

beforeEach(() => { st().resetDemo() })

describe('MRN drives execution', () => {
  it('the first MRN at the new price comes from the MRN feed, not typed by hand', () => {
    const id = approved('2026-09-01', '2027-03-01', 6)
    expect(idea(id).execution?.effectiveDate).toBeUndefined()
    // the monthly feed reads MRN from the savings start in the lock
    st().runRealisation('2026-09')
    const rows = st().ledger.filter((l) => l.ideaId === id)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.month === '2026-09')).toBe(true)
    // the first MRN line with quantity at the new price sets the first-MRN date and ticks the milestone
    st().uploadMrn([{ ideaId: id, partCode: meals.partCode, month: '2026-09', mrnQty: 18000, mrnPrice: 96 }])
    expect(idea(id).execution?.effectiveDate).toBe('2026-09-01')
    expect(idea(id).execution?.milestones.find((m) => m.name === 'First MRN at new price')?.doneDate).toBe('2026-09-01')
  })
  it('nothing is claimed before the savings start in the lock', () => {
    const id = approved('2026-12-01', '2027-06-01', 6)
    st().runRealisation('2026-10')
    expect(st().ledger.some((l) => l.ideaId === id)).toBe(false)
  })
})

describe('the locked deadline closes execution', () => {
  it('after the lock end the idea moves to Verification by itself, with forecast vs MRN actual', () => {
    const id = approved('2026-06-01', '2026-09-01', 3)
    for (const m of ['2026-06', '2026-07', '2026-08']) st().runRealisation(m)
    st().closeEndedExecutions('2026-10-16')
    const i = idea(id)
    expect(i.stage).toBe(STAGE.verification)
    expect(i.verification?.handedAt?.slice(0, 10)).toBe('2026-09-01')
    expect(i.verification?.handedBy).toMatch(/COIN/)
    const actual = st().ledger.filter((l) => l.ideaId === id && inLockWindow(i.lock!, l.month)).reduce((a, l) => a + l.realised, 0)
    expect(i.verification?.forecastAtClose).toBe(i.lock!.targetSaving)
    expect(i.verification?.actualAtClose).toBeCloseTo(actual, 0)
    expect(i.execution?.status).toBe('Done')
    expect(st().notifications.some((n) => n.userId === 'u-fin' && n.ideaId === id)).toBe(true)
  })
  it('stays in execution until the lock end', () => {
    const id = approved('2026-06-01', '2026-09-01', 3)
    st().closeEndedExecutions('2026-08-31')
    expect(idea(id).stage).toBe(STAGE.execution)
    st().closeEndedExecutions('2026-09-01')
    expect(idea(id).stage).toBe(STAGE.verification)
  })
  it('nobody hands over by hand', () => {
    const id = approved('2026-06-01', '2026-09-01', 3)
    expect(ideaPerms(user('u-hr-exec'), idea(id)).handOver).toBe(false)
    expect(ideaPerms(user('u-head'), idea(id)).handOver).toBe(false)
    expect(kanbanMove(user('u-head'), idea(id), 'verification').ok).toBe(false)
  })
  it('the monthly MRN sync posts every completed month not yet posted, then closes ended timelines', () => {
    const before = st().settings.lastRealisationMonth
    const id = approved('2026-04-01', '2026-07-01', 3)
    st().syncMrn('2026-12-05')
    expect(st().settings.lastRealisationMonth).toBe('2026-11')
    expect(st().ledger.some((l) => l.month > before)).toBe(true)
    expect(idea(id).stage).toBe(STAGE.verification)
  })
  it('the demo data follows the rule: nothing is still in execution after its lock end, and every hand-over is the lock end', () => {
    const today = new Date().toISOString().slice(0, 10)
    const ideas = st().ideas
    expect(ideas.filter((i) => i.stage === STAGE.execution && i.lock && i.lock.endDate <= today).map((i) => i.id)).toEqual([])
    const handed = ideas.filter((i) => i.lock && i.verification?.handedAt)
    expect(handed.length).toBeGreaterThan(10)
    expect(handed.filter((i) => i.verification!.handedAt!.slice(0, 10) !== i.lock!.endDate).map((i) => i.id)).toEqual([])
  })
})

describe('cost-benefit inputs in the department evaluation', () => {
  it('investment, go-live, payback and carry-over can be changed, and the approval uses them', () => {
    st().loginAs('u-hr-emp')
    const id = st().submitIdea({ title: 'Canteen per-meal rate', commodity: 'FAC', leverId: 'L01', parts: [meals], currentState: 'Fixed fee', proposedChange: 'Per meal', oneTimeInvestment: 100000, expectedQuarter: 'Q3 FY27' })
    const annual = ideaAnnualised(idea(id))
    const auto = cbaFigures(idea(id), 'FY27')
    expect(auto.investment).toBe(100000)
    expect(auto.payback).toBeCloseTo(100000 / (annual / 12), 5)
    expect(auto.committed + auto.carryOver).toBeCloseTo(annual, 0)
    st().saveEvaluation(id, { cbaInputs: { investment: 300000, goLive: '2027-01-01' } })
    const edited = cbaFigures(idea(id), 'FY27')
    expect(edited.investment).toBe(300000)
    expect(edited.goLive).toBe('2027-01-01')
    expect(edited.payback).toBeCloseTo(300000 / (annual / 12), 5)
    expect(edited.carryOver).toBeGreaterThan(auto.carryOver)
    st().saveEvaluation(id, { cbaInputs: { investment: 300000, goLive: '2027-01-01', payback: 9, carryOver: 2000000 } })
    const over = cbaFigures(idea(id), 'FY27')
    expect(over.payback).toBe(9)
    expect(over.carryOver).toBe(2000000)
    expect(over.committed).toBeCloseTo(annual - 2000000, 0)
    expect(over.edited).toEqual(expect.arrayContaining(['investment', 'goLive', 'payback', 'carryOver']))
  })
})

describe('no free reassign in the pipeline', () => {
  it('Sourcing Head and Admin send an idea back to a stage it has passed instead of picking any SPOC', () => {
    st().loginAs('u-hr-emp')
    const id = st().submitIdea({ title: 'x', commodity: 'FAC', leverId: 'L01', parts: [meals], currentState: 'a', proposedChange: 'b' })
    st().loginAs('u-hr-tl'); st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })
    expect(idea(id).stage).toBe(STAGE.evaluation)
    expect(ideaPerms(user('u-head'), idea(id)).reassign).toBe(false)
    expect(ideaPerms(user('u-admin'), idea(id)).reassign).toBe(false)
    expect(ideaPerms(user('u-head'), idea(id)).sendBack).toBe(true)
    expect(sendBackTargets(idea(id)).map((t) => t.to)).toEqual(['submitter', STAGE.feasibility])
  })
})

describe('evaluation inputs survive a send back to the evaluation', () => {
  it('the evaluator starts again from the inputs already entered', () => {
    st().loginAs('u-hr-emp')
    const j = st().submitIdea({ title: 'y', commodity: 'FAC', leverId: 'L01', parts: [meals], currentState: 'a', proposedChange: 'b' })
    st().loginAs('u-hr-tl'); st().recordFeasibility(j, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })
    st().loginAs('u-hr-lead'); st().saveEvaluation(j, { cbaVerified: true, cbaInputs: { investment: 200000, payback: 6 } }); st().recordEvaluation(j, 'Recommend', 'ok')
    st().loginAs('u-hr-head'); st().sendBack(j, 'redo risks', STAGE.evaluation)
    expect(idea(j).stage).toBe(STAGE.evaluation)
    expect(idea(j).evaluation?.cbaVerified).toBeFalsy()
    expect(idea(j).evaluation?.cbaInputs).toEqual({ investment: 200000, payback: 6 })
  })
})
