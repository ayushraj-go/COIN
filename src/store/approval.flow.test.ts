// Small ideas skip the department evaluation; the department head sends an idea back to the stage they choose;
// the signed lock carries a part-wise budget and a dated milestone plan that execution starts from.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ideaPerms, kanbanMove } from '../pages/idea/model'
import { queueFor } from '../pages/queue/model'
import { ideaAnnualised } from '../lib/calc'
import { STAGE } from '../lib/masters'
import { EVALUATION_MIN, lockTarget, monthsBetween, sendBackTargets } from '../lib/workflow'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
const inQueue = (uid: string, id: string) => queueFor(user(uid), st().ideas, st().users).mine.some((r) => r.idea.id === id)
// (300 − 280) × 12 000 = ₹ 2.4 L a year — below ₹ 5 L
const paper: IdeaPart = { partCode: 'FAC-PAPER-01', description: 'A4 copier paper, ream', uom: 'Nos', currentSupplier: 'Local stationer', baselinePrice: 300, baselineSource: 'LBP', newPrice: 280, annualVolume: 12000, volumeSource: 'MRN FY26' }
// (110 − 96) × 240 000 = ₹ 33.6 L a year
const meals: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }
const go = { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'], remarks: 'Feasible' } as const

/** An HR idea submitted by the HR employee and cleared by the HR team lead */
function cleared(part: IdeaPart, title = 'HR idea') {
  st().loginAs('u-hr-emp')
  const id = st().submitIdea({ title, commodity: 'FAC', leverId: 'L01', parts: [part], currentState: 'Today', proposedChange: 'Change' })
  st().loginAs('u-hr-tl')
  st().recordFeasibility(id, { ...go, departments: [...go.departments] })
  return id
}
/** …and recommended by the HR department lead (₹ 5 L and above) */
function atApproval(part: IdeaPart = meals) {
  const id = cleared(part)
  if (idea(id).stage === STAGE.evaluation) { st().loginAs('u-hr-lead'); st().recordEvaluation(id, 'Recommend', 'CBA verified') }
  st().loginAs('u-hr-head')
  return id
}

beforeEach(() => { st().resetDemo() })

describe('ideas below ₹ 5 L skip the department evaluation', () => {
  it('go from the team feasibility check straight to the department head', () => {
    const id = cleared(paper)
    expect(ideaAnnualised(idea(id))).toBeLessThan(EVALUATION_MIN)
    const i = idea(id)
    expect(i.stage).toBe(STAGE.approval)
    expect(i.evaluation?.skipped).toBe(true)
    expect(i.evaluation?.supplier?.status).toBe('Skipped')
    // the tracker shows the evaluation as passed over, between the check and the approval
    expect(i.stageHistory.map((h) => h.stage)).toEqual(['Draft', STAGE.feasibility, STAGE.evaluation, STAGE.approval])
    expect(i.stageHistory[2].action).toMatch(/skipped/i)
    expect(i.approvals).toEqual([{ level: 'HR head', approverId: 'u-hr-head' }])
    expect(inQueue('u-hr-lead', id)).toBe(false)
    expect(inQueue('u-hr-head', id)).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'u-hr-lead' && n.ideaId === id)).toBe(false)
    expect(st().notifications.some((n) => n.userId === 'u-hr-head' && n.ideaId === id)).toBe(true)
  })
  it('the department head approves without an evaluation', () => {
    const id = atApproval(paper)
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: lockTarget(ideaAnnualised(idea(id)), 6), signatureName: 'Lata Krishnan' })
    expect(st().approve(id)).toBe(true)
    expect(idea(id).stage).toBe(STAGE.execution)
  })
  it('the board never moves a small idea into the evaluation it skips', () => {
    const id = atApproval(paper)
    expect(kanbanMove(user('u-head'), idea(id), 'evaluation').ok).toBe(false)
  })
  it('ideas of ₹ 5 L and more are still evaluated', () => {
    const id = cleared(meals)
    expect(idea(id).stage).toBe(STAGE.evaluation)
    expect(idea(id).evaluation?.skipped).toBeFalsy()
    expect(inQueue('u-hr-lead', id)).toBe(true)
  })
})

describe('the department head sends an idea back to the stage they choose', () => {
  it('offers every earlier stage instead of send back + reassign', () => {
    const id = atApproval()
    const p = ideaPerms(user('u-hr-head'), idea(id))
    expect(p.sendBack).toBe(true)
    expect(p.reassign).toBe(false)
    expect(ideaPerms(user('u-head'), idea(id)).reassign).toBe(false)
    expect(sendBackTargets(idea(id)).map((t) => t.to)).toEqual(['submitter', STAGE.feasibility, STAGE.evaluation])
  })
  it('back to the department evaluation keeps the team feasibility check', () => {
    const id = atApproval()
    st().sendBack(id, 'Re-check the risk register', STAGE.evaluation)
    const i = idea(id)
    expect(i.stage).toBe(STAGE.evaluation)
    expect(i.feasibilityCheck?.decision).toBe('Go')
    expect(i.evaluation?.decision).toBeUndefined()
    expect(i.lock).toBeUndefined()
    expect(inQueue('u-hr-lead', id)).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'u-hr-lead' && n.ideaId === id && /sent back/i.test(n.title))).toBe(true)
  })
  it('back to the team feasibility check', () => {
    const id = atApproval()
    st().sendBack(id, 'Duplicate of another idea?', STAGE.feasibility)
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).feasibilityCheck).toBeUndefined()
    expect(idea(id).infoRequested).toBeFalsy()
    expect(inQueue('u-hr-tl', id)).toBe(true)
  })
  it('back to the submitter for rework', () => {
    const id = atApproval()
    st().sendBack(id, 'Add the vendor quote', 'submitter')
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).infoRequested).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'u-hr-emp' && n.ideaId === id && /sent back/i.test(n.title))).toBe(true)
  })
  it('a small idea is never sent back to the evaluation it skipped', () => {
    const id = atApproval(paper)
    expect(sendBackTargets(idea(id)).map((t) => t.to)).toEqual(['submitter', STAGE.feasibility])
    st().sendBack(id, 'try', STAGE.evaluation)
    expect(idea(id).stage).toBe(STAGE.approval)
  })
})

describe('the signed lock carries the part-wise budget and the dated plan', () => {
  it('execution starts from the milestone dates the head signed', () => {
    const id = atApproval()
    const target = lockTarget(ideaAnnualised(idea(id)), 6)
    const milestones = [
      { name: 'Execution plan signed off', dueDate: '2026-11-10' },
      { name: 'Trial run', dueDate: '2026-11-25' },
      { name: 'First MRN at new price', dueDate: '2026-12-01' },
      { name: 'Implementation confirmed', dueDate: '2027-01-01' },
      { name: 'Handed for verification', dueDate: '2027-06-01' },
    ]
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 150000, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: target, signatureName: 'Lata Krishnan',
      parts: [{ partCode: meals.partCode, budget: 150000, note: 'New contract drafting' }], milestones })
    expect(idea(id).lock?.parts?.[0].budget).toBe(150000)
    expect(st().approve(id)).toBe(true)
    const ex = idea(id).execution!
    expect(ex.milestones.map((m) => [m.name, m.dueDate])).toEqual(milestones.map((m) => [m.name, m.dueDate]))
    expect(ex.targetDate).toBe('2027-06-01')
  })
  it('counts the timeline in months between two calendar dates', () => {
    expect(monthsBetween('2026-12-01', '2027-06-01')).toBe(6)
    expect(monthsBetween('2026-12-01', '2027-03-16')).toBe(3.5)
    expect(monthsBetween('2026-12-01', '2026-11-01')).toBe(0)
  })
})

describe('the demo data follows the ₹ 5 L rule', () => {
  it('no seeded idea below ₹ 5 L waits at, or was evaluated in, the department evaluation', () => {
    const small = st().ideas.filter((i) => i.stage !== 'Draft' && ideaAnnualised(i) < EVALUATION_MIN && i.stageHistory.some((h) => h.stage === STAGE.evaluation))
    expect(small.length).toBeGreaterThan(0)
    for (const i of small) {
      expect(i.stage).not.toBe(STAGE.evaluation)
      expect(i.evaluation?.skipped).toBe(true)
      expect(i.stageHistory.find((h) => h.stage === STAGE.evaluation)?.action).toMatch(/skipped/i)
    }
  })
})
