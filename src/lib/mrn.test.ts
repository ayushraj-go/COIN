import { describe, it, expect } from 'vitest'
import type { Idea, IdeaPart, MrnLine } from './types'
import { SEASON_RAC, approvedSupplierCode, claimMrn, ideaPoNo, ledgerForMonth, lockPlan, monthlyForecast, parseMrnCsv, seasonProfile, windowTarget } from './mrn'
import { planVsActual } from './workflow'

// ₹ 1 a unit on 1,20,000 a year = ₹ 1.2 L a year; locked Jul 2026 – Dec 2026 (6 months)
const part: IdeaPart = { partCode: 'P-1', description: 'Bracket', uom: 'Nos', currentSupplier: 'V1 · Old Metals', baselinePrice: 10, baselineSource: 'LBP', newPrice: 9, approvedPrice: 9, annualVolume: 120000, volumeSource: 'MRN FY26' }
const mk = (over: Partial<Idea> = {}): Idea => ({
  id: 'I-1', stage: 'Execution started', bucket: 'In Execution', route: 'Commercial', buyingType: 'Direct', approvedAt: '2026-06-10T10:00:00Z', plant: 'RJP',
  parts: [part], execution: { status: 'In Execution' }, lock: { startDate: '2026-07-01', endDate: '2027-01-01', timelineMonths: 6, targetSaving: 60000 },
  ...over,
} as unknown as Idea)
const line = (o: Partial<MrnLine>): MrnLine => ({ id: 'M', date: '2026-07-10', month: '2026-07', plant: 'RJP', partCode: 'P-1', supplierCode: 'V1', qty: 1000, price: 9, poNo: 'PO-1', source: 'ERP feed', status: 'Not claimed', ...o })

describe('seasonal monthly forecast (AC season, from the last-FY MRN pattern)', () => {
  it('direct buying follows the AC season; indirect buying is flat', () => {
    expect(SEASON_RAC.reduce((a, b) => a + b, 0)).toBeCloseTo(12, 6)
    expect(seasonProfile({ buyingType: 'Direct' } as Idea)).toEqual(SEASON_RAC)
    expect(seasonProfile({ buyingType: 'Indirect' } as Idea).every((x) => x === 1)).toBe(true)
  })
  it('each month = forecast ÷ 12 × that month’s season index; the window target is their sum', () => {
    const m = monthlyForecast(1_20_000, '2026-12-01', 3, SEASON_RAC)
    expect(m.map((x) => x.month)).toEqual(['2026-12', '2027-01', '2027-02'])
    expect(m.map((x) => Math.round(x.amount))).toEqual([Math.round(10000 * SEASON_RAC[11]), Math.round(10000 * SEASON_RAC[0]), Math.round(10000 * SEASON_RAC[1])])
    expect(windowTarget(1_20_000, '2026-12-01', 3, SEASON_RAC)).toBeCloseTo(m.reduce((a, x) => a + x.amount, 0), 6)
    // a flat profile gives the old rule: forecast × months ÷ 12
    expect(windowTarget(1_20_000, '2026-12-01', 3, Array(12).fill(1))).toBeCloseTo(30000, 6)
  })
  it('the signed monthly plan is used as is; an older lock is spread by the season over its window', () => {
    expect(lockPlan(mk({ lock: { startDate: '2026-07-01', timelineMonths: 2, targetSaving: 3, monthlyPlan: [1, 2] } as Idea['lock'] }))).toEqual([1, 2])
    const p = lockPlan(mk())
    expect(p).toHaveLength(6)
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(60000, 6)
    expect(p[0] / p[1]).toBeCloseTo(SEASON_RAC[6] / SEASON_RAC[7], 6)
  })
  it('plan vs actual takes the monthly plan; the projection scales the target by achievement to date', () => {
    const p = planVsActual({ target: 100, months: 2, startDate: '2026-07-01', ledger: [{ month: '2026-07', realised: 30 }], lastActualMonth: '2026-07', plan: [40, 60] })
    expect(p.rows.map((r) => r.plan)).toEqual([40, 60])
    expect(p.planToDate).toBe(40)
    expect(p.projected).toBeCloseTo(75, 6)
  })
})

describe('claim rules — a receipt counts only when the MRN shows the saving', () => {
  it('approved supplier; the old supplier for a supplier-change idea is not counted', () => {
    expect(approvedSupplierCode(mk(), part)).toBe('V1')
    expect(approvedSupplierCode(mk({ route: 'Supplier change', proposedSupplier: { code: 'V2', name: 'New Metals', isNew: false } }), part)).toBe('V2')
  })
  it('claims the approved supplier at the new price inside the window; says why everything else is not claimed', () => {
    const out = claimMrn([
      line({ id: 'ok' }),
      line({ id: 'other', supplierCode: 'V9' }),
      line({ id: 'old', price: 10 }),
      line({ id: 'early', date: '2026-06-28', month: '2026-06' }),
      line({ id: 'leak', price: 9.3 }),
    ], [mk()])
    const by = Object.fromEntries(out.map((l) => [l.id, l]))
    expect(by.ok.status).toBe('Claimed'); expect(by.ok.ideaId).toBe('I-1')
    expect(by.leak.status).toBe('Claimed')
    expect(by.other.reason).toBe('Other supplier')
    expect(by.old.reason).toBe('Old price billed')
    expect(by.early.reason).toBe('Before the savings start')
  })
  it('a receipt is counted once — the idea approved first takes it', () => {
    const later = mk({ id: 'I-2', approvedAt: '2026-08-01T10:00:00Z' })
    const out = claimMrn([line({ id: 'x' })], [later, mk()])
    expect(out[0].ideaId).toBe('I-1')
  })
  it('when two ideas cover the same part, the PO the receipt was received against decides, then the price billed', () => {
    const other = mk({ id: 'I-2', approvedAt: '2026-08-01T10:00:00Z', parts: [{ ...part, newPrice: 8.5, approvedPrice: 8.5 }] })
    const out = claimMrn([line({ id: 'po', price: 9, poNo: ideaPoNo(other, part) }), line({ id: 'price', price: 8.5, poNo: '' })], [mk(), other])
    expect(out.find((l) => l.id === 'po')?.ideaId).toBe('I-2')
    expect(out.find((l) => l.id === 'price')?.ideaId).toBe('I-2')
  })
  it('ignores dropped ideas', () => {
    const out = claimMrn([line({ id: 'x' })], [mk({ stage: 'Dropped', bucket: 'Dropped' })])
    expect(out[0].status).toBe('Not claimed')
    expect(out[0].reason).toBe('No live idea for this part')
  })
})

describe('monthly ledger from the claimed receipts', () => {
  it('saving at the price paid; overbilling shows as leakage and lowers the saving', () => {
    const lines = claimMrn([line({ id: 'a', qty: 6000, price: 9 }), line({ id: 'b', qty: 4000, price: 9.5 }), line({ id: 'c', qty: 999, supplierCode: 'V9' })], [mk()])
    const [e] = ledgerForMonth('2026-07', lines, [mk()], { full: true, postedAt: '2026-08-05T00:00:00Z' })
    expect(e.mrnQty).toBe(10000)
    expect(e.realised).toBeCloseTo(6000 * 1 + 4000 * 0.5, 6)
    expect(e.leakage).toBeCloseTo(4000 * 0.5, 6)
    expect(e.mrnPrice).toBeCloseTo((6000 * 9 + 4000 * 9.5) / 10000, 6)
    expect(e.plannedQty).toBe(Math.round((120000 / 12) * SEASON_RAC[6]))
    expect(e.mrnIds).toEqual(['a', 'b'])
    expect(e.exceptions).toContain('Price leakage')
  })
  it('a full monthly read records "No MRN received" for a live part with nothing claimed inside the window', () => {
    const lines = claimMrn([line({ id: 'old', price: 10 })], [mk()])
    const [e] = ledgerForMonth('2026-07', lines, [mk()], { full: true, postedAt: 'x' })
    expect(e.mrnQty).toBe(0); expect(e.realised).toBe(0); expect(e.exceptions).toContain('No MRN received')
    // an upload only touches what it carries
    expect(ledgerForMonth('2026-07', lines, [mk()], { full: false, postedAt: 'x' })).toHaveLength(0)
  })
})

describe('MRN extract upload (CSV in the ERP layout)', () => {
  it('reads the columns by name, accepts DD-MM-YYYY dates and reports bad rows', () => {
    const csv = 'MRN No,GRN Date,Plant,Part Code,Vendor Code,Qty,Rate,PO No\n5000000001,05-09-2026,RJP,P-1,V1,1200,9,4500001\n5000000002,2026-09-12,RJP,P-1,V1,abc,9,4500001\n'
    const r = parseMrnCsv(csv)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0]).toMatchObject({ id: '5000000001', date: '2026-09-05', month: '2026-09', partCode: 'P-1', supplierCode: 'V1', qty: 1200, price: 9, poNo: '4500001', source: 'Upload' })
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/row 3/i)
  })
})
