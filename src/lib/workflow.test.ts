import { describe, it, expect } from 'vitest'
import { evalDeptOf, stageLabel, needsSupplierCheck, overallRisk, riskTotal, lockTarget, addMonthsIso, supplierCapabilityEmail, amberDataLeaks, planVsActual, sourceBreakdown, costFlags } from './workflow'

describe('evaluation department', () => {
  it('uses the submitter department', () => {
    expect(evalDeptOf('Quality')).toBe('Quality')
    expect(stageLabel({ department: 'R&D' }, 'Evaluation')).toBe('R&D evaluation')
  })
  it('maps sourcing-side departments to Sourcing', () => {
    for (const d of ['Sourcing', 'Sourcing Excellence', 'Supplier', 'Management', undefined]) expect(evalDeptOf(d)).toBe('Sourcing')
  })
  it('leaves other stage names alone', () => expect(stageLabel({ department: 'R&D' }, 'Sourcing approval')).toBe('Sourcing approval'))
})

describe('thresholds and lock', () => {
  it('supplier check from ₹ 5 lakh up', () => {
    expect(needsSupplierCheck(499999)).toBe(false)
    expect(needsSupplierCheck(500000)).toBe(true)
  })
  it('lock target = annual × months ÷ 12', () => expect(lockTarget(24_00_000, 6)).toBe(12_00_000))
  it('adds months to an ISO date', () => expect(addMonthsIso('2026-10-01', 6)).toBe('2027-04-01'))
})

describe('risk', () => {
  it('overall = highest level, total = Σ cost at risk', () => {
    const r = [{ key: 'q', label: 'Quality', level: 'Low', costAtRisk: 10000 }, { key: 's', label: 'Supply', level: 'High', costAtRisk: 50000 }] as any
    expect(overallRisk(r)).toBe('High')
    expect(riskTotal(r)).toBe(60000)
    expect(overallRisk([])).toBe('Low')
  })
})

describe('cost validity flags', () => {
  it('flags a new price at or above baseline and an unrealistic saving', () => {
    const idea: any = { scope: 'Part-specific', parts: [
      { partCode: 'P1', baselinePrice: 10, newPrice: 10, annualVolume: 100, baselineSource: 'LBP' },
      { partCode: 'P2', baselinePrice: 10, newPrice: 5, annualVolume: 100, baselineSource: 'LBP' },
    ] }
    const flags = costFlags(idea, [{ code: 'P1', lbp: 10, poPrice: 10 }, { code: 'P2', lbp: 10, poPrice: 10 }] as any)
    expect(flags.some((f) => f.includes('P1'))).toBe(true)
    expect(flags.some((f) => f.includes('P2'))).toBe(true)
  })
  it('a normal saving has no flags', () => {
    const idea: any = { scope: 'Part-specific', parts: [{ partCode: 'P1', baselinePrice: 10, newPrice: 9, annualVolume: 100, baselineSource: 'LBP' }] }
    expect(costFlags(idea, [{ code: 'P1', lbp: 10, poPrice: 10 }] as any)).toEqual([])
  })
})

describe('supplier capability email', () => {
  const idea: any = { scope: 'Part-specific', openEstimateLakh: 0, parts: [{ partCode: '3100045612', baselinePrice: 4.2, newPrice: 3.85, annualVolume: 2400000, currentSupplier: 'V10021 · Sunrise Fasteners Pvt Ltd' }] }
  const sup: any[] = [{ code: 'V10021', name: 'Sunrise Fasteners Pvt Ltd' }]
  it('generated email has no Amber data', () => {
    const e = supplierCapabilityEmail({ supplierName: 'Metro Precision', contactName: 'Ravi', item: 'Hex flange bolt M6×16', spec: 'Trivalent Zn with sealer, 240 h salt spray', requiredBy: '2026-12-31', link: 'https://x/supplier-form/t1', sender: 'Sourcing team' })
    expect(amberDataLeaks(`${e.subject}\n${e.body}`, idea, sup)).toEqual([])
    expect(e.body).toContain('https://x/supplier-form/t1')
  })
  it('flags part codes, prices, volumes and current supplier', () => {
    const leaks = amberDataLeaks('Part 3100045612 at ₹ 4.20, 24,00,000 Nos from Sunrise Fasteners Pvt Ltd', idea, sup)
    expect(leaks.length).toBeGreaterThanOrEqual(4)
  })
})

describe('plan vs actual', () => {
  it('₹ 12 L over 6 months, ₹ 1.4 L in month 1 → projected ₹ 8.4 L, behind plan', () => {
    const p = planVsActual({ target: 12_00_000, months: 6, startDate: '2026-09-01', ledger: [{ month: '2026-09', realised: 1_40_000 }], lastActualMonth: '2026-09' })
    expect(p.rows).toHaveLength(6)
    expect(p.rows[0].plan).toBe(2_00_000)
    expect(p.actualToDate).toBe(1_40_000)
    expect(Math.round(p.projected)).toBe(8_40_000)
    expect(p.onTrack).toBe(false)
    expect(p.rows[1].actual).toBeNull()
  })
  it('zero target never divides by zero', () => {
    const p = planVsActual({ target: 0, months: 6, startDate: '2026-09-01', ledger: [], lastActualMonth: '2026-09' })
    expect(p.projected).toBe(0)
    expect(p.onTrack).toBe(true)
  })
})

describe('source breakdown', () => {
  it('splits internal vs external and tiers', () => {
    const ideas: any[] = [
      { id: 'a', isSupplierSubmission: false, commodity: 'FAS', department: 'R&D', submitterId: 'u1', submitterName: 'Neha' },
      { id: 'b', isSupplierSubmission: true, supplierCode: 'V1', commodity: 'FAS', department: 'Supplier', submitterId: 'u2', submitterName: 'Rakesh', campaignId: 'CMP-003' },
      { id: 'c', isSupplierSubmission: true, supplierCode: 'V2', commodity: 'CMP', department: 'Supplier', submitterId: 'u3', submitterName: 'Lakshmi' },
    ]
    const s = sourceBreakdown(ideas, [{ code: 'V1', tier: 'Tier 2' }, { code: 'V2', tier: 'Tier 1' }] as any, () => 100)
    expect(s.internal.count).toBe(1)
    expect(s.external.count).toBe(2)
    expect(s.external.tier1.count).toBe(1)
    expect(s.external.tier2.count).toBe(1)
    expect(s.external.viaCampaign.count).toBe(1)
    expect(s.internal.byDepartment[0]).toMatchObject({ key: 'R&D', count: 1, value: 100 })
  })
})
