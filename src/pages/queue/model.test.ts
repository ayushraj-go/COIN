import { describe, it, expect } from 'vitest'
import { buildSeed } from '../../lib/seed'
import { STAGE, USERS_DEFAULT } from '../../lib/masters'
import { stageAssignee } from '../../lib/workflow'
import { pendingAction, queueFor } from './model'
import { ideaPerms } from '../idea/model'

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
  it('a Sourcing team lead also sees team checks routed to another commodity lead, and can act on them', () => {
    // Aditi (Sourcing employee) raises a Wiring harness idea: it is assigned to the harness commodity lead (Anita),
    // but every Sourcing team lead may do the check — so it must be in Sanjay's queue too, marked as his team's
    const base = s.ideas.find((x) => x.stage === STAGE.feasibility)!
    const har = { ...base, id: 'COIN-FY27-HAR-9001', department: 'Sourcing', commodity: 'HAR', submitterId: 'u-so-emp', submitterName: 'Aditi Sharma', evaluation: undefined }
    const ideas = [...s.ideas, har]
    expect(stageAssignee(har, STAGE.feasibility, USERS_DEFAULT)).toBe('u-lead2')
    const anita = queueFor(U('u-lead2'), ideas, USERS_DEFAULT)
    expect(anita.mine.some((r) => r.idea.id === har.id)).toBe(true)
    const sanjay = queueFor(U('u-lead1'), ideas, USERS_DEFAULT)
    expect(sanjay.mine.some((r) => r.idea.id === har.id)).toBe(false)
    const row = sanjay.team.find((r) => r.idea.id === har.id)
    expect(row?.assignee).toBe('u-lead2')
    expect(row?.team).toBe(true)
    expect(sanjay.all.some((r) => r.idea.id === har.id)).toBe(true)
    // his own items come first
    expect(sanjay.all.slice(0, sanjay.mine.length).every((r) => r.assignedToMe)).toBe(true)
    // never their own idea, never another department's
    const own = { ...har, id: 'COIN-FY27-HAR-9002', submitterId: 'u-lead1' }
    const rd = { ...har, id: 'COIN-FY27-HAR-9003', department: 'R&D' }
    const q2 = queueFor(U('u-lead1'), [own, rd], USERS_DEFAULT)
    expect(q2.all).toEqual([])
  })
  it('My queue lists exactly what the idea page lets each person act on', () => {
    const flag = { feasibility: 'feasibilityCheck', evaluate: 'evaluate', approve: 'approve', execute: 'execute', verify: 'verify' } as const
    for (const me of USERS_DEFAULT.filter((u) => !u.roles.includes('head') && !u.roles.includes('admin'))) {
      const listed = new Set(queueFor(me, s.ideas, USERS_DEFAULT).all.map((r) => r.idea.id))
      for (const idea of s.ideas) {
        const action = pendingAction(idea)
        if (!action) continue
        expect(listed.has(idea.id), `${me.id} · ${idea.id} · ${action}`).toBe(ideaPerms(me, idea)[flag[action]])
      }
    }
  })
  it('a reassigned execution moves to the new owner', () => {
    const i = s.ideas.find((x) => x.stage === STAGE.execution && x.ownerId === 'u-buyer2')!
    const moved = s.ideas.map((x) => (x.id === i.id ? { ...x, ownerId: 'u-buyer5' } : x))
    expect(stageAssignee(moved.find((x) => x.id === i.id)!, STAGE.execution, USERS_DEFAULT)).toBe('u-buyer5')
    expect(queueFor(U('u-buyer5'), moved, USERS_DEFAULT).mine.some((r) => r.idea.id === i.id)).toBe(true)
    expect(queueFor(U('u-buyer2'), moved, USERS_DEFAULT).mine.some((r) => r.idea.id === i.id)).toBe(false)
  })
})
