// Small ideas need no commercial evaluation; management sends an idea back to the submitter or to the workshop;
// the signed lock carries a part-wise budget and a dated milestone plan that execution starts from.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { throughWorkshop } from './flow.testkit'
import { ideaPerms } from '../pages/idea/model'
import { queueFor } from '../pages/queue/model'
import { ideaAnnualised } from '../lib/calc'
import { STAGE } from '../lib/masters'
import { EVALUATION_MIN, lockTarget, monthsBetween, sendBackTargets, workshopGaps } from '../lib/workflow'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
const user = (id: string) => st().users.find((u) => u.id === id)!
const inQueue = (uid: string, id: string) => queueFor(user(uid), st().ideas, st().users).mine.some((r) => r.idea.id === id)
// (300 − 280) × 12 000 = ₹ 2.4 L a year — below ₹ 5 L
const paper: IdeaPart = { partCode: 'FAC-PAPER-01', description: 'A4 copier paper, ream', uom: 'Nos', currentSupplier: 'Local stationer', baselinePrice: 300, baselineSource: 'LBP', newPrice: 280, annualVolume: 12000, volumeSource: 'MRN FY26' }
// (110 − 96) × 240 000 = ₹ 33.6 L a year
const meals: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }

const raise = (part: IdeaPart) => { st().loginAs('id-hr'); return st().submitIdea({ title: 'HR idea', commodity: 'CA', leverId: 'L01', parts: [part], currentState: 'Today', proposedChange: 'Change' }) }
/** …through the workshop, with the Central ID signed in */
function atApproval(part: IdeaPart = meals) {
  const id = raise(part)
  throughWorkshop(id)
  st().loginAs('id-central')
  return id
}

beforeEach(() => { st().resetDemo() })

describe('ideas below ₹ 5 L need no commercial evaluation', () => {
  it('go ahead on the feasibility form and wait on the Central ID', () => {
    const id = atApproval(paper)
    expect(ideaAnnualised(idea(id))).toBeLessThan(EVALUATION_MIN)
    const i = idea(id)
    expect(i.stage).toBe(STAGE.approval)
    expect(i.evaluation?.skipped).toBe(true)
    expect(i.evaluation?.supplier?.status).toBe('Skipped')
    expect(i.approvals).toEqual([{ level: 'Management', approverId: 'id-central' }])
    expect(inQueue('id-hr', id)).toBe(false)
    expect(inQueue('id-central', id)).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'id-central' && n.ideaId === id)).toBe(true)
  })
  it('the Central ID approves without an evaluation', () => {
    const id = atApproval(paper)
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: lockTarget(ideaAnnualised(idea(id)), 6), signatureName: 'Lata Krishnan' })
    expect(st().approve(id)).toBe(true)
    expect(idea(id).stage).toBe(STAGE.execution)
  })
  it('ideas of ₹ 5 L and more still need the commercial evaluation', () => {
    const id = raise(meals)
    expect(workshopGaps(idea(id), ideaAnnualised(idea(id)))).toContain('Commercial evaluation')
    expect(idea(id).evaluation?.skipped).toBeFalsy()
    expect(ideaPerms(user('id-hr'), idea(id)).evaluate).toBe(true)
  })
})

describe('management sends an idea back to the place it chooses', () => {
  it('offers the submitter or the workshop, instead of send back + reassign', () => {
    const id = atApproval()
    const p = ideaPerms(user('id-central'), idea(id))
    expect(p.sendBack).toBe(true)
    expect(p.reassign).toBe(false)
    expect(sendBackTargets(idea(id)).map((t) => t.to)).toEqual(['submitter', STAGE.feasibility])
  })
  it('back to the workshop tells the department ID, whose queue it returns to', () => {
    const id = atApproval()
    st().sendBack(id, 'Duplicate of another idea?', STAGE.feasibility)
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).feasibilityCheck).toBeUndefined()
    expect(idea(id).infoRequested).toBeFalsy()
    expect(inQueue('id-hr', id)).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'id-hr' && n.ideaId === id && /sent back/i.test(n.title))).toBe(true)
  })
  it('back to the submitter for rework', () => {
    const id = atApproval()
    st().sendBack(id, 'Add the vendor quote', 'submitter')
    expect(idea(id).stage).toBe(STAGE.feasibility)
    expect(idea(id).infoRequested).toBe(true)
    expect(st().notifications.some((n) => n.userId === 'id-hr' && n.ideaId === id && /sent back/i.test(n.title))).toBe(true)
  })
  it('a stage the idea is not sending back to does nothing', () => {
    const id = atApproval()
    st().sendBack(id, 'try', STAGE.execution as never)
    expect(idea(id).stage).toBe(STAGE.approval)
  })
})

describe('the signed lock carries the part-wise budget and the dated plan', () => {
  it('execution starts from the milestone dates management signed', () => {
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
  it('no seeded idea below ₹ 5 L past the workshop carries an evaluation decision', () => {
    const past: string[] = [STAGE.approval, STAGE.execution, STAGE.verification]
    const small = st().ideas.filter((i) => past.includes(i.stage) && ideaAnnualised(i) < EVALUATION_MIN)
    expect(small.length).toBeGreaterThan(0)
    for (const i of small) {
      expect(i.evaluation?.skipped, i.id).toBe(true)
      expect(i.evaluation?.decision, i.id).toBeUndefined()
    }
  })
})
