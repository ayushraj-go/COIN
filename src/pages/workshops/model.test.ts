// Who sees which workshop, and the guide that says which ID works which stage. The guide is checked against the real routing.
import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '../../lib/seed'
import { STAGE, TRACKER_STAGES, USERS_DEFAULT } from '../../lib/masters'
import { stageAssignee } from '../../lib/workflow'
import { STAGE_GUIDE, busiestId, workshopRows } from './model'

const ideas = buildSeed().ideas
const user = (id: string) => USERS_DEFAULT.find((u) => u.id === id)!
const atWorkshop = ideas.filter((i) => i.stage === STAGE.feasibility)

describe('workshop list', () => {
  beforeEach(() => expect(atWorkshop.length).toBeGreaterThan(3))

  it('shows the Management ID every idea at the workshop stage', () => {
    expect(workshopRows(ideas, user('id-management'), USERS_DEFAULT).length).toBe(atWorkshop.length)
  })
  it('shows a department ID only the workshops it runs', () => {
    const sourcing = workshopRows(ideas, user('id-sourcing'), USERS_DEFAULT)
    expect(sourcing.length).toBeGreaterThan(0)
    expect(sourcing.length).toBeLessThan(atWorkshop.length)
    expect(sourcing.every((r) => stageAssignee(r.idea, STAGE.feasibility, USERS_DEFAULT) === 'id-sourcing')).toBe(true)
  })
  it('lists every workshop exactly once between the department IDs', () => {
    const ids = USERS_DEFAULT.filter((u) => u.active !== false && !u.roles.includes('admin'))
    expect(ids.flatMap((u) => workshopRows(ideas, u, USERS_DEFAULT)).length).toBe(atWorkshop.length)
  })
  it('says what is still missing and which event is next', () => {
    const rows = workshopRows(ideas, user('id-management'), USERS_DEFAULT)
    const none = rows.find((r) => !r.idea.workshop?.events.length)!
    expect(none.status).toBe('To schedule')
    expect(none.event).toBeUndefined()
    expect(none.gaps).toContain('Workshop event')
    const scheduled = rows.find((r) => r.idea.workshop?.events.some((e) => e.status === 'Scheduled'))!
    expect(scheduled.status).toBe(scheduled.gaps.length ? 'Scheduled' : 'Ready for Go ahead')
    expect(scheduled.event?.status).toBe('Scheduled')
  })
})

describe('who does what', () => {
  it('covers the five stages in order', () => {
    expect(STAGE_GUIDE.map((g) => g.stage)).toEqual(TRACKER_STAGES)
  })
  it('names the IDs the routing really uses', () => {
    const owner = (stage: string) => ideas.filter((i) => i.stage === stage).map((i) => stageAssignee(i, stage, USERS_DEFAULT))
    expect(new Set(owner(STAGE.approval))).toEqual(new Set(['id-management']))
    expect(STAGE_GUIDE.find((g) => g.stage === STAGE.approval)?.fixedId).toBe('id-management')
    expect(new Set(owner(STAGE.verification))).toEqual(new Set(['id-finance']))
    expect(STAGE_GUIDE.find((g) => g.stage === STAGE.verification)?.fixedId).toBe('id-finance')
    expect(owner(STAGE.feasibility).every((id) => user(id!).roles.includes('teamlead'))).toBe(true)
    expect(STAGE_GUIDE.find((g) => g.stage === STAGE.feasibility)?.fixedId).toBeUndefined()
  })
  it('opens each stage in the workspace it belongs to', () => {
    expect(STAGE_GUIDE.map((g) => g.space)).toEqual(['IN', 'IN', 'IN', 'CO', 'CO'])
  })
  it('picks the department ID with the most work at a stage, so the demo opens on something', () => {
    const id = busiestId(ideas, STAGE.feasibility, USERS_DEFAULT)
    const count = (x: string) => atWorkshop.filter((i) => stageAssignee(i, STAGE.feasibility, USERS_DEFAULT) === x).length
    expect(count(id!)).toBeGreaterThan(0)
    for (const u of USERS_DEFAULT.filter((x) => x.active !== false)) expect(count(u.id)).toBeLessThanOrEqual(count(id!))
  })
})

describe('one named role at each stage', () => {
  it('names the five roles in stage order', () => {
    expect(STAGE_GUIDE.map((g) => g.role)).toEqual(['Idea Submitter', 'Workshop Owner', 'Management', 'Execution Manager', 'Finance Verifier'])
  })
  it('gives stage 4 to the Execution Manager ID for every idea', () => {
    expect(STAGE_GUIDE[3].fixedId).toBe('id-execution')
  })
})
