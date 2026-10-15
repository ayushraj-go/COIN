import { describe, it, expect } from 'vitest'
import { buildSeed } from '../../lib/seed'
import { STAGE, USERS_DEFAULT } from '../../lib/masters'
import { stageAssignee } from '../../lib/workflow'
import { queueFor } from './model'

const s = buildSeed()
const U = (id: string) => USERS_DEFAULT.find((u) => u.id === id)!

describe('My queue', () => {
  it('a team lead sees only feasibility checks of their own department', () => {
    const q = queueFor(U('u-rd-tl'), s.ideas, USERS_DEFAULT)
    expect(q.mine.length).toBeGreaterThan(0)
    expect(q.mine.every((r) => r.action === 'feasibility' && r.idea.stage === STAGE.feasibility)).toBe(true)
    expect(q.mine.every((r) => (r.idea.evaluation?.dept ?? 'R&D') === 'R&D' && r.idea.submitterId !== 'u-rd-tl')).toBe(true)
  })
  it('department lead, head, execution owner and Finance each get their own stage', () => {
    const one = (id: string, action: string) => {
      const q = queueFor(U(id), s.ideas, USERS_DEFAULT).mine
      expect(q.length, id).toBeGreaterThan(0)
      expect(q.every((r) => r.action === action), id).toBe(true)
      return q
    }
    // the department lead also takes the feasibility check of ideas their team lead raised
    const dl = queueFor(U('u-so-lead'), s.ideas, USERS_DEFAULT).mine
    expect(dl.some((r) => r.action === 'evaluate')).toBe(true)
    expect(dl.every((r) => r.action === 'evaluate' || (r.action === 'feasibility' && USERS_DEFAULT.find((u) => u.id === r.idea.submitterId)?.roles.includes('teamlead')))).toBe(true)
    one('u-head', 'approve')
    const ex = one('u-buyer2', 'execute')
    expect(ex.every((r) => r.idea.ownerId === 'u-buyer2')).toBe(true)
    one('u-fin', 'verify')
  })
  it('employees have nothing to do; override users also see every open item', () => {
    expect(queueFor(U('u-sub1'), s.ideas, USERS_DEFAULT).mine).toEqual([])
    const head = queueFor(U('u-head'), s.ideas, USERS_DEFAULT)
    const fin = queueFor(U('u-fin'), s.ideas, USERS_DEFAULT)
    expect(head.all.length).toBeGreaterThan(head.mine.length + fin.mine.length)
    expect(new Set(head.all.map((r) => r.action))).toEqual(new Set(['feasibility', 'evaluate', 'approve', 'execute', 'verify']))
    expect(queueFor(U('u-fin'), s.ideas, USERS_DEFAULT).all).toEqual(fin.mine)
  })
  it('rows carry waiting time and SLA state; breached items come first', () => {
    const q = queueFor(U('u-head'), s.ideas, USERS_DEFAULT, Date.parse('2026-10-16T12:00:00Z')).all
    expect(q.every((r) => r.waitingHours >= 0)).toBe(true)
    const firstOk = q.findIndex((r) => r.sla !== 'breach')
    expect(q.slice(firstOk).every((r) => r.sla !== 'breach')).toBe(true)
  })
  it('a reassigned execution moves to the new owner', () => {
    const i = s.ideas.find((x) => x.stage === STAGE.execution && x.ownerId === 'u-buyer2')!
    const moved = s.ideas.map((x) => (x.id === i.id ? { ...x, ownerId: 'u-buyer5' } : x))
    expect(stageAssignee(moved.find((x) => x.id === i.id)!, STAGE.execution, USERS_DEFAULT)).toBe('u-buyer5')
    expect(queueFor(U('u-buyer5'), moved, USERS_DEFAULT).mine.some((r) => r.idea.id === i.id)).toBe(true)
    expect(queueFor(U('u-buyer2'), moved, USERS_DEFAULT).mine.some((r) => r.idea.id === i.id)).toBe(false)
  })
})
