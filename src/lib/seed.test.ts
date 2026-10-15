import { describe, it, expect } from 'vitest'
import { buildSeed } from './seed'
import { STAGE, WORKFLOW_STAGES } from './masters'
import { planVsActual } from './workflow'

const seed = buildSeed()
const show = (n: number) => seed.ideas.find((i) => i.showcase === n)!

describe('demo seed — six-stage walkthrough', () => {
  it('has one showcase idea at each stage', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => show(n)?.stage)).toEqual([STAGE.feasibility, STAGE.evaluation, STAGE.approval, STAGE.execution, STAGE.verification, STAGE.verification])
    expect(show(5).verification?.verifiedAt).toBeUndefined()
    expect(show(6).verification?.verifiedAt).toBeTruthy()
  })
  it('fills every form up to the idea’s stage', () => {
    expect(show(1).feasibilityCheck).toBeUndefined()
    expect(show(2).feasibilityCheck?.decision).toBe('Go')
    expect(show(2).evaluation?.supplier?.status).toBe('Skipped') // below ₹ 5 L
    expect(show(3).evaluation?.decision).toBe('Recommend')
    expect(show(3).evaluation?.supplier?.status).toBe('Responded')
    expect(show(3).lock).toBeUndefined()
    expect(show(4).lock?.signatureName).toBeTruthy()
    expect(show(4).lock?.timelineMonths).toBe(6)
    expect(Math.round(show(4).lock!.targetSaving)).toBe(12_00_000)
    expect(show(5).execution?.effectiveDate).toBeTruthy()
  })
  it('walkthrough MRN savings meet the locked plan for S5 and S6', () => {
    for (const n of [5, 6]) {
      const i = show(n)
      const p = planVsActual({ target: i.lock!.targetSaving, months: i.lock!.timelineMonths, startDate: i.lock!.startDate, ledger: seed.ledger.filter((l) => l.ideaId === i.id), lastActualMonth: seed.lastRealisationMonth })
      expect(p.actualToDate).toBeGreaterThan(0)
      expect(p.onTrack).toBe(true)
    }
  })
  it('uses only the six-stage names', () => {
    const allowed = new Set(['Draft', 'Dropped', 'Rejected', ...WORKFLOW_STAGES])
    expect(seed.ideas.filter((i) => !allowed.has(i.stage)).map((i) => i.stage)).toEqual([])
  })
  it('every approved idea has a signed lock and its execution follows it', () => {
    const approved = seed.ideas.filter((i) => i.bucket === 'In Execution' || i.bucket === 'Implemented')
    expect(approved.length).toBeGreaterThan(20)
    for (const i of approved) {
      expect(i.lock, i.id).toBeTruthy()
      expect(i.execution?.targetDate, i.id).toBe(i.lock!.endDate)
    }
  })
  it('has external ideas from both supplier tiers', () => {
    const ext = seed.ideas.filter((i) => i.isSupplierSubmission && i.stage !== 'Draft')
    expect(ext.length).toBeGreaterThan(8)
  })
})

describe('reset restores the same demo data', () => {
  it('building the seed again gives the same ideas and IDs', () => {
    const again = buildSeed()
    expect(again.ideas.map((i) => i.id)).toEqual(seed.ideas.map((i) => i.id))
    expect(again.ideas.find((i) => i.showcase === 5)?.id).toBe(show(5).id)
  })
})
