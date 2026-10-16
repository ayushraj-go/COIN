// Stage 3 evaluation sheet — every cost-benefit figure can be changed by the evaluator, the corrected forecast carries
// into the department approval, and the supplier email can be edited and sent again.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { cbaFigures, ideaAnnualised } from '../lib/calc'
import { lockTarget } from '../lib/workflow'
import { sum } from '../lib/format'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
// (110 − 96) × 240 000 = ₹ 33.6 L a year
const meals: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }

/** An HR idea of ₹ 33.6 L waiting at the HR evaluation */
function inEvaluation() {
  st().loginAs('u-hr-emp')
  const id = st().submitIdea({ title: 'Canteen per-meal rate', commodity: 'FAC', leverId: 'L01', parts: [meals], currentState: 'Fixed fee', proposedChange: 'Per meal', oneTimeInvestment: 100000, expectedQuarter: 'Q3 FY27' })
  st().loginAs('u-hr-tl'); st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })
  st().loginAs('u-hr-lead')
  return id
}

beforeEach(() => { st().resetDemo() })

describe('every cost-benefit figure is editable', () => {
  it('auto values: net year 1, 3-year net and quarter phasing follow the forecast; phasing adds up to committed', () => {
    const id = inEvaluation()
    const f = cbaFigures(idea(id), 'FY27')
    expect(f.annual).toBe(3360000)
    expect(f.auto.annual).toBe(3360000)
    expect(f.netYear1).toBe(3360000 - 100000)
    expect(f.net3yr).toBe(3360000 * 3 - 100000)
    expect(sum(Object.values(f.phasing))).toBeCloseTo(f.committed, 0)
    expect(f.edited).toEqual([])
  })
  it('a corrected forecast becomes the idea’s forecast — payback and carry-over follow it, the parts total stays as the auto value', () => {
    const id = inEvaluation()
    st().saveEvaluation(id, { cbaInputs: { annual: 2400000 } })
    expect(ideaAnnualised(idea(id))).toBe(2400000)
    const f = cbaFigures(idea(id), 'FY27')
    expect(f.annual).toBe(2400000)
    expect(f.auto.annual).toBe(3360000)
    expect(f.payback).toBeCloseTo(100000 / (2400000 / 12), 5)
    expect(f.committed + f.carryOver).toBeCloseTo(2400000, 0)
    expect(f.edited).toContain('annual')
  })
  it('committed typed by hand: carry-over is the rest of the forecast and the auto phasing is scaled to it', () => {
    const id = inEvaluation()
    st().saveEvaluation(id, { cbaInputs: { committed: 1000000 } })
    const f = cbaFigures(idea(id), 'FY27')
    expect(f.committed).toBe(1000000)
    expect(f.carryOver).toBe(3360000 - 1000000)
    expect(sum(Object.values(f.phasing))).toBeCloseTo(1000000, 0)
  })
  it('net year 1, 3-year net and the quarter phasing keep the values typed by hand', () => {
    const id = inEvaluation()
    const phasing = { Q1: 0, Q2: 0, Q3: 500000, Q4: 700000 }
    st().saveEvaluation(id, { cbaInputs: { netYear1: 2000000, net3yr: 9000000, phasing } })
    const f = cbaFigures(idea(id), 'FY27')
    expect(f.netYear1).toBe(2000000)
    expect(f.net3yr).toBe(9000000)
    expect(f.phasing).toEqual(phasing)
    expect(f.edited).toEqual(expect.arrayContaining(['netYear1', 'net3yr', 'phasing']))
  })
  it('the department head locks and approves on the corrected forecast', () => {
    const id = inEvaluation()
    st().saveEvaluation(id, { cbaVerified: true, cbaInputs: { annual: 2400000 }, risks: [{ key: 'quality', label: 'Quality', level: 'Low', costAtRisk: 0 }] })
    st().recordEvaluation(id, 'Recommend', 'ok')
    st().loginAs('u-hr-head')
    st().signLock(id, { commercialOk: true, supplierAligned: 'Confirmed', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: lockTarget(2400000, 6), signatureName: 'Lata Krishnan' })
    expect(st().approve(id)).toBe(true)
    expect(idea(id).lock!.targetSaving).toBe(1200000)
  })
})

describe('the supplier email can be edited and sent again', () => {
  it('sends the evaluator’s own wording; a resend replaces the link and the old link no longer answers', () => {
    const id = inEvaluation()
    const base = { supplierName: 'Fresh Foods', contactName: 'Asha', email: 'asha@freshfoods.in', item: 'Canteen meals', spec: 'FSSAI kitchen', requiredBy: '2027-01-15' }
    const t1 = st().sendSupplierCheck(id, { ...base, subject: 'Can you cater?', body: 'Dear Asha,\nPlease answer here: [secure form link]\nThanks' })
    expect(idea(id).evaluation!.supplier!.body).toContain(`/supplier-form/${t1}`)
    const t2 = st().sendSupplierCheck(id, { ...base, subject: 'Can you cater? (updated)', body: 'Dear Asha,\nUpdated request: [secure form link]' })
    expect(t2).not.toBe(t1)
    expect(idea(id).evaluation!.supplier!.subject).toBe('Can you cater? (updated)')
    const answer = { canSupply: 'Yes' as const, meetsSpec: 'Yes' as const, contactName: 'Asha', respondedAt: new Date().toISOString() }
    expect(st().respondSupplierCheck(t1, answer)).toBe(false)
    expect(st().respondSupplierCheck(t2, answer)).toBe(true)
  })
})
