// Stage 5–6 on MRN receipts: the monthly ERP feed, the claim rules, saving at the price billed, verification after the
// final month's MRN, and the lock that keeps the forecast it was signed on.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ideaAnnualised } from '../lib/calc'
import { lockTarget } from '../lib/workflow'
import { STAGE } from '../lib/masters'
import type { IdeaPart } from '../lib/types'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!
// (110 − 96) × 2,40,000 = ₹ 33.6 L a year — facilities: indirect buying, a flat monthly plan
const meals: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'V10023 · Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }

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
const reads = (month: string) => st().mrnReads.filter((r) => r.month === month)

beforeEach(() => { st().resetDemo() })

describe('the monthly MRN feed', () => {
  it('the demo starts with a receipt trail: every saving traces to MRN receipts', () => {
    const withSaving = st().ledger.filter((l) => l.realised > 0)
    expect(withSaving.length).toBeGreaterThan(50)
    const ids = new Set(st().mrn.map((l) => l.id))
    expect(withSaving.every((l) => l.mrnIds?.length && l.mrnIds.every((m) => ids.has(m)))).toBe(true)
    expect(st().mrn.some((l) => l.status === 'Not claimed' && l.reason === 'Old price billed')).toBe(true)
    expect(st().mrn.some((l) => l.status === 'Not claimed' && l.reason === 'Other supplier')).toBe(true)
    expect(st().mrnReads.length).toBeGreaterThan(3)
  })
  it('while the new price is not live, receipts at the old price are read but nothing is claimed', () => {
    const id = approved('2026-10-01', '2027-04-01', 6)
    st().runRealisation('2026-10')
    const mine = st().mrn.filter((l) => l.partCode === meals.partCode && l.month === '2026-10')
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((l) => l.status === 'Not claimed' && l.reason === 'Old price billed')).toBe(true)
    expect(st().ledger.find((l) => l.ideaId === id && l.month === '2026-10')?.exceptions).toContain('No MRN received')
    expect(idea(id).execution?.effectiveDate).toBeUndefined()
    expect(reads('2026-10')[0]?.notClaimed['Old price billed']).toBeGreaterThan(0)
  })
  it('once PAP approves the price, the next month’s receipts are claimed and the first one sets the first-MRN date', () => {
    const id = approved('2026-10-01', '2027-04-01', 6)
    st().syncNpdPap(id, { papStatus: 'Price approved' })
    st().runRealisation('2026-10')
    const claimed = st().mrn.filter((l) => l.ideaId === id && l.status === 'Claimed')
    expect(claimed.length).toBeGreaterThan(0)
    const first = claimed.map((l) => l.date).sort()[0]
    expect(idea(id).execution?.effectiveDate).toBe(first)
    expect(idea(id).execution?.milestones.find((m) => m.name === 'First MRN at new price')?.doneDate).toBe(first)
    const e = st().ledger.find((l) => l.ideaId === id && l.month === '2026-10')!
    expect(e.realised).toBeCloseTo(claimed.reduce((a, l) => a + (110 - l.price) * l.qty, 0), 6)
  })
})

describe('saving at the price billed', () => {
  it('billing above the approved price lowers the saving and shows as leakage', () => {
    const id = approved('2026-09-01', '2027-03-01', 6)
    st().uploadMrn([{ ideaId: id, partCode: meals.partCode, month: '2026-09', mrnQty: 20000, mrnPrice: 100 }])
    const e = st().ledger.find((l) => l.ideaId === id && l.month === '2026-09')!
    expect(e.realised).toBe((110 - 100) * 20000)
    expect(e.leakage).toBe((100 - 96) * 20000)
  })
  it('an uploaded extract runs through the same rules — a receipt from another vendor is not counted', () => {
    const id = approved('2026-09-01', '2027-03-01', 6)
    const r = st().uploadMrnLines([
      { id: 'U-1', date: '2026-09-04', month: '2026-09', plant: 'NDA', partCode: meals.partCode, supplierCode: 'V10023', qty: 8000, price: 96, poNo: 'PO-1', source: 'Upload', status: 'Not claimed' },
      { id: 'U-2', date: '2026-09-09', month: '2026-09', plant: 'NDA', partCode: meals.partCode, supplierCode: 'V99999', qty: 5000, price: 96, poNo: 'PO-2', source: 'Upload', status: 'Not claimed' },
    ])
    expect(r).toMatchObject({ posted: 2, claimed: 1 })
    expect(st().mrn.find((l) => l.id === 'U-2')?.reason).toBe('Other supplier')
    expect(st().ledger.find((l) => l.ideaId === id && l.month === '2026-09')?.mrnQty).toBe(8000)
  })
  it('a month that has not ended cannot be uploaded', () => {
    approved('2026-09-01', '2027-03-01', 6)
    const r = st().uploadMrnLines([{ id: 'U-9', date: '2099-01-04', month: '2099-01', plant: 'NDA', partCode: meals.partCode, supplierCode: 'V10023', qty: 1, price: 96, poNo: '', source: 'Upload', status: 'Not claimed' }])
    expect(r.posted).toBe(0)
    expect(r.errors[0]).toMatch(/not ended/i)
  })
})

describe('verification after the final month’s MRN', () => {
  it('moves on the deadline, but Finance can verify only once the last month of the window is read', () => {
    const id = approved('2026-08-01', '2026-11-01', 3)
    st().closeEndedExecutions('2026-11-02')
    expect(idea(id).stage).toBe(STAGE.verification)
    expect(idea(id).verification?.finalMrnMonth).toBe('2026-10')
    expect(idea(id).verification?.actualAtClose).toBeUndefined()
    st().loginAs('u-fin')
    expect(st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: 1 })).toBe(false)
    expect(idea(id).verification?.verifiedAt).toBeUndefined()
    st().runRealisation('2026-10')
    expect(idea(id).verification?.actualAtClose).toBeTypeOf('number')
    expect(st().notifications.some((n) => n.userId === 'u-fin' && n.ideaId === id && /ready to verify/i.test(n.title))).toBe(true)
    expect(st().verifyIdea(id, { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: 1 })).toBe(true)
  })
})

describe('the lock keeps the forecast it was signed on', () => {
  it('signing records the forecast and the monthly plan; a later forecast change asks for a new signature', () => {
    st().loginAs('u-hr-emp')
    const id = st().submitIdea({ title: 'Canteen per-meal rate', commodity: 'FAC', leverId: 'L01', parts: [meals], currentState: 'Fixed fee', proposedChange: 'Per meal' })
    st().loginAs('u-hr-tl'); st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })
    st().loginAs('u-hr-lead'); st().recordEvaluation(id, 'Recommend', 'ok')
    st().loginAs('u-hr-head')
    st().signLock(id, { commercialOk: true, supplierAligned: 'Skipped', budget: 0, timelineMonths: 6, startDate: '2026-12-01', endDate: '2027-06-01', targetSaving: 1680000, signatureName: 'Lata Krishnan' })
    expect(idea(id).lock?.forecastAtLock).toBe(3360000)
    expect(idea(id).lock?.monthlyPlan).toHaveLength(6)
    st().saveEvaluation(id, { cbaInputs: { annual: 3000000 } })
    expect(st().approve(id)).toBe(false)
  })
})

describe('Finance validates the MRN behind a saving', () => {
  it('validating marks the ledger lines', () => {
    const id = approved('2026-09-01', '2027-03-01', 6)
    st().uploadMrn([{ ideaId: id, partCode: meals.partCode, month: '2026-09', mrnQty: 20000, mrnPrice: 96 }])
    const ids = st().ledger.filter((l) => l.ideaId === id).map((l) => l.id)
    st().loginAs('u-fin'); st().financeValidate(ids)
    expect(st().ledger.filter((l) => l.ideaId === id).every((l) => l.financeStatus === 'Validated')).toBe(true)
  })
})
