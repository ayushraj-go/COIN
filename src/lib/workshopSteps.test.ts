// The numbered steps a department follows to finish a workshop: what is done, and the one thing to do now.
import { describe, expect, it } from 'vitest'
import { stageAssignee, workshopSteps } from './workflow'
import { STAGE, USERS_DEFAULT } from './masters'
import type { Idea } from './types'

const idea = (patch: Partial<Idea> = {}) => ({ workshop: undefined, feasibilityCheck: undefined, evaluation: undefined, ...patch }) as Idea
const event = (status: 'Scheduled' | 'Held', no = 1) => ({ id: `e${no}`, no, status }) as NonNullable<Idea['workshop']>['events'][number]
const now = (i: Idea, annual = 10_00_000) => workshopSteps(i, annual).find((s) => s.now)?.key
const keys = (i: Idea, annual = 10_00_000) => workshopSteps(i, annual).map((s) => s.key)

describe('workshop steps', () => {
  it('runs event, technical, commercial, close, in that order', () => {
    expect(keys(idea())).toEqual(['event', 'feas', 'eval', 'close'])
  })
  it('leaves out the commercial evaluation below ₹ 5 L', () => {
    expect(keys(idea(), 4_00_000)).toEqual(['event', 'feas', 'close'])
  })
  it('starts on the event', () => {
    expect(now(idea())).toBe('event')
  })
  it('moves to technical feasibility once an event is open', () => {
    expect(now(idea({ workshop: { events: [event('Scheduled')] } }))).toBe('feas')
  })
  it('moves to the commercial evaluation after a Go', () => {
    expect(now(idea({ workshop: { events: [event('Scheduled')] }, feasibilityCheck: { decision: 'Go' } as Idea['feasibilityCheck'] }))).toBe('eval')
  })
  it('ends on closing the event', () => {
    const done = idea({ workshop: { events: [event('Scheduled')] }, feasibilityCheck: { decision: 'Go' } as Idea['feasibilityCheck'], evaluation: { decision: 'Recommend' } as Idea['evaluation'] })
    expect(now(done)).toBe('close')
    expect(workshopSteps(done, 10_00_000).filter((s) => s.done).map((s) => s.key)).toEqual(['event', 'feas', 'eval'])
  })
  it('asks for a new event when the last one was held and none is open', () => {
    expect(now(idea({ workshop: { events: [event('Held')] }, feasibilityCheck: { decision: 'Go' } as Idea['feasibilityCheck'] }))).toBe('event')
  })
  it('points at exactly one step', () => {
    expect(workshopSteps(idea(), 10_00_000).filter((s) => s.now)).toHaveLength(1)
  })
})

describe('who works stage 4', () => {
  it('is the Execution Manager ID, whichever department raised the idea', () => {
    for (const department of ['R&D', 'HR', 'Sourcing'] as const) expect(stageAssignee({ department, ownerId: 'u-buyer1' } as Idea, STAGE.execution, USERS_DEFAULT)).toBe('id-execution')
  })
})
