// The Execution Manager ID's home list: an execution past its target date is its to chase, whichever department it came from.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../../store/useStore'
import { buildActions } from './MyActions'
import { STAGE } from '../../lib/masters'
import type { Idea } from '../../lib/types'

const st = () => useStore.getState()
const user = (id: string) => st().users.find((u) => u.id === id)!
const live = () => st().ideas.find((i) => i.stage === STAGE.execution && i.bucket === 'In Execution' && i.execution?.status === 'In Execution')!
const overdue = (i: Idea): Idea => ({ ...i, execution: { ...i.execution!, targetDate: '2020-01-01' } })

beforeEach(() => { st().resetDemo() })

describe('home actions at stage 4', () => {
  it('the Execution Manager ID is told about an overdue execution', () => {
    const late = overdue(live())
    const mine = buildActions(user('id-execution'), [late], st())
    expect(mine.some((a) => a.kind === 'overdue' && a.ideaId === late.id)).toBe(true)
  })
  it('the department behind it is not', () => {
    const late = overdue(live())
    const dept = st().users.find((u) => u.roles.includes('teamlead') && u.department === (late.evaluation?.dept ?? late.department))!
    expect(buildActions(dept, [late], st()).some((a) => a.kind === 'overdue')).toBe(false)
  })
})
