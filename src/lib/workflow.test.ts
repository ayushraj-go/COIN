import { describe, it, expect } from 'vitest'
import { evalDeptOf, stageLabel, needsSupplierCheck, overallRisk, riskTotal, lockTarget, addMonthsIso, supplierCapabilityEmail, amberDataLeaks, planVsActual, savingsTrack, monthVerdict, sourceBreakdown, costFlags, milestoneSchedule, inLockWindow } from './workflow'

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

describe('monthly savings track — ₹ 12 L over 6 months = ₹ 2 L a month', () => {
  const base = { target: 12_00_000, months: 6, startDate: '2026-07-01' }
  const run = (actuals: (number | undefined)[], last = '2026-09') =>
    savingsTrack(planVsActual({ ...base, lastActualMonth: last, ledger: actuals.flatMap((v, k) => (v == null ? [] : [{ month: `2026-${String(7 + k).padStart(2, '0')}`, realised: v }])) }))

  it('grades a month: met at the monthly target, near from 90 %, short below, no MRN at zero, pending until posted', () => {
    expect(monthVerdict(2_00_000, 2_00_000)).toBe('met')
    expect(monthVerdict(2_00_000, 1_80_000)).toBe('near')
    expect(monthVerdict(2_00_000, 1_79_999)).toBe('short')
    expect(monthVerdict(2_00_000, 0)).toBe('no-mrn')
    expect(monthVerdict(2_00_000, null)).toBe('pending')
  })
  it('a month with no MRN line at all counts as no MRN — nothing is claimed', () => {
    const t = run([2_10_000, 1_85_000, undefined])
    expect(t.rows.map((r) => r.verdict)).toEqual(['met', 'near', 'no-mrn', 'pending', 'pending', 'pending'])
    expect(t.monthsMet).toBe(1)
    expect(t.monthsNear).toBe(1)
    expect(t.monthsShort).toBe(1)
  })
  it('on track at 90 % or more of the target to date', () => {
    const t = run([2_00_000, 1_90_000, 1_60_000])
    expect(t.achievement).toBeCloseTo(0.9167, 3)
    expect(t.verdict).toBe('On track')
  })
  it('behind from 70 % to 90 %', () => {
    expect(run([1_60_000, 1_60_000, 1_60_000]).verdict).toBe('Behind')
  })
  it('off track below 70 % — the remaining months need ₹ 3 L a month (1.5× the plan) to still reach ₹ 12 L', () => {
    const t = run([1_00_000, 1_00_000, 1_00_000])
    expect(t.verdict).toBe('Off track')
    expect(t.remaining).toBe(3)
    expect(t.toGo).toBe(9_00_000)
    expect(t.neededPerMonth).toBe(3_00_000)
    expect(t.neededVsPlan).toBeCloseTo(1.5)
  })
  it('not started before the first month is posted; no MRN when posted months found nothing', () => {
    expect(run([], '2026-06').verdict).toBe('Not started')
    expect(run([0, 0]).verdict).toBe('No MRN')
  })
  it('closed timeline: every month posted — target met at 95 % of the locked target, else a shortfall; nothing left to need', () => {
    const met = run([2_00_000, 2_00_000, 2_00_000, 2_00_000, 2_00_000, 1_50_000], '2026-12')
    expect(met.closed).toBe(true)
    expect(met.verdict).toBe('Target met')
    expect(met.neededPerMonth).toBe(0)
    const short = run([2_00_000, 2_00_000, 2_00_000, 2_00_000, 1_00_000, 1_00_000], '2026-12')
    expect(short.verdict).toBe('Shortfall')
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

describe('milestone schedule', () => {
  it('route steps before the savings start, first MRN on it, verification hand-over at the end', () => {
    const names = ['NPD sample approved', 'PAP price approved', 'First MRN at new price', 'Implementation confirmed', 'Handed for verification']
    const ds = milestoneSchedule('2026-09-10', '2026-11-01', '2027-05-01', names)
    expect(ds).toHaveLength(5)
    expect(ds[0] > '2026-09-10' && ds[1] < '2026-11-01').toBe(true)
    expect(ds[2]).toBe('2026-11-01')
    expect(ds[3]).toBe('2026-12-01')
    expect(ds[4]).toBe('2027-05-01')
    for (let k = 1; k < ds.length; k++) expect(ds[k] >= ds[k - 1]).toBe(true)
  })
})

describe('leak guard false positives (review #5)', () => {
  const sup: any[] = [{ code: 'V10001', name: 'Kiran Copper Tubes Pvt Ltd' }]
  it('naming the recipient supplier in its own email is not a leak', () => {
    const idea: any = { parts: [{ partCode: 'P1', baselinePrice: 874, newPrice: 850, annualVolume: 1000, currentSupplier: 'V10001 · Kiran Copper Tubes Pvt Ltd' }] }
    expect(amberDataLeaks('We would like to know whether Kiran Copper Tubes Pvt Ltd can supply it.', idea, sup, { code: 'V10001', name: 'Kiran Copper Tubes Pvt Ltd' })).toEqual([])
  })
  it('whole-number prices do not match other numbers, but do match as an amount', () => {
    const idea: any = { parts: [{ partCode: 'P2', baselinePrice: 35, newPrice: 7, annualVolume: 1000, currentSupplier: 'V9 · Other' }] }
    expect(amberDataLeaks('Tensile 350 MPa, 70 mm wide. Kindly respond within 7 days.', idea, sup)).toEqual([])
    expect(amberDataLeaks('Current rate Rs 35 per piece', idea, sup).some((l) => l.includes('35'))).toBe(true)
  })
})

describe('lock window (review minor #10)', () => {
  it('covers the locked months only', () => {
    const lock = { startDate: '2026-07-01', timelineMonths: 3 }
    expect(inLockWindow(lock, '2026-07')).toBe(true)
    expect(inLockWindow(lock, '2026-09')).toBe(true)
    expect(inLockWindow(lock, '2026-10')).toBe(false)
    expect(inLockWindow(lock, '2026-06')).toBe(false)
  })
})
