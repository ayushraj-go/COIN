import { describe, it, expect } from 'vitest'
import { buildSeed } from './seed'
import { STAGE, WORKFLOW_STAGES } from './masters'
import { inLockWindow, ladderOf, planVsActual, savingsTrack } from './workflow'
import { USERS_DEFAULT } from './masters'

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
    // ₹ 5 L and above — waiting at the department evaluation with the supplier check still to send (smaller ideas skip stage 3)
    expect(show(2).stage).toBe('Evaluation')
    expect(show(2).evaluation?.skipped).toBeFalsy()
    expect(show(2).evaluation?.supplier?.status).toBe('Not sent')
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
  it('live executions tell different stories month by month — most on track, some behind, a few off track', () => {
    const tracks = seed.ideas.filter((i) => i.stage === STAGE.execution && i.lock)
      .map((i) => savingsTrack(planVsActual({ target: i.lock!.targetSaving, months: i.lock!.timelineMonths, startDate: i.lock!.startDate, ledger: seed.ledger.filter((l) => l.ideaId === i.id && inLockWindow(i.lock!, l.month)), lastActualMonth: seed.lastRealisationMonth })))
      .filter((t) => t.elapsed > 0)
    const n = (v: string) => tracks.filter((t) => t.verdict === v).length
    expect(tracks.length).toBeGreaterThan(15)
    expect(n('On track')).toBeGreaterThanOrEqual(tracks.length * 0.4)
    expect(n('Behind') + n('Off track') + n('No MRN')).toBeGreaterThanOrEqual(4)
    expect(n('Off track') + n('No MRN')).toBeGreaterThanOrEqual(2)
  })
  it('ideas in verification ran a multi-month locked timeline (not one month each)', () => {
    const ver = seed.ideas.filter((i) => i.stage === STAGE.verification && i.lock)
    const multi = ver.filter((i) => i.lock!.timelineMonths >= 3)
    expect(multi.length).toBeGreaterThanOrEqual(ver.length * 0.5)
  })
  it('at verification most ideas met the locked target in MRN and some fell short', () => {
    const ver = seed.ideas.filter((i) => i.stage === STAGE.verification && i.lock)
      .map((i) => savingsTrack(planVsActual({ target: i.lock!.targetSaving, months: i.lock!.timelineMonths, startDate: i.lock!.startDate, ledger: seed.ledger.filter((l) => l.ideaId === i.id && inLockWindow(i.lock!, l.month)), lastActualMonth: seed.lastRealisationMonth })))
    expect(ver.filter((t) => t.verdict === 'Target met').length).toBeGreaterThanOrEqual(ver.length * 0.5)
    expect(ver.filter((t) => t.verdict === 'Shortfall').length).toBeGreaterThanOrEqual(4)
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

describe('department ladder authors every stage', () => {
  const name = (id?: string) => USERS_DEFAULT.find((u) => u.id === id)?.name
  it('feasibility by the team lead (department lead on their own idea), evaluation by the department lead', () => {
    for (const i of seed.ideas.filter((x) => x.feasibilityCheck && x.evaluation)) {
      const l = ladderOf(i.evaluation!.dept, i.commodity, USERS_DEFAULT)
      expect(i.feasibilityCheck!.by, i.id).toBe(name(l.teamLead === i.submitterId ? l.deptLead : l.teamLead))
      if (i.evaluation!.decision === 'Recommend') expect(i.evaluation!.by, i.id).toBe(name(l.deptLead))
    }
  })
  it('the department head approves and signs; the department execution owner runs execution; Finance verifies', () => {
    const locked = seed.ideas.filter((x) => x.lock)
    expect(locked.length).toBeGreaterThan(20)
    for (const i of locked) {
      const l = ladderOf(i.evaluation!.dept, i.commodity, USERS_DEFAULT)
      expect(i.approvals.map((a) => a.level), i.id).toEqual([`${i.evaluation!.dept} head`])
      expect(i.lock!.signedBy, i.id).toBe(name(l.deptHead))
      if (i.execution) expect(i.ownerId, i.id).toBe(l.execOwner)
      if (i.verification?.verifiedAt) expect(i.verification.verifiedBy, i.id).toBe('Meera Iyer')
    }
  })
  it('ideas come from all 8 departments, and the walkthrough spans at least three', () => {
    expect(new Set(seed.ideas.map((i) => i.evaluation?.dept).filter(Boolean)).size).toBe(8)
    expect(new Set([1, 2, 3, 4, 5, 6].map((n) => show(n).evaluation?.dept ?? show(n).department)).size).toBeGreaterThanOrEqual(3)
  })
})
