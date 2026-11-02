import { describe, it, expect } from 'vitest'
import { buildSeed } from '../../lib/seed'
import { STAGE, USERS_DEFAULT } from '../../lib/masters'
import { ideaDept } from '../../lib/workflow'
import { pendingAction, queueFor } from './model'
import { ideaPerms } from '../idea/model'

const s = buildSeed()
const U = (id: string) => USERS_DEFAULT.find((u) => u.id === id)!
const IDS = USERS_DEFAULT.filter((u) => u.active !== false)
const departmentIds = IDS.filter((u) => !u.roles.includes('admin'))

describe('My queue', () => {
  it('a department ID sees only its own workshops and executions', () => {
    const q = queueFor(U('id-rd'), s.ideas, USERS_DEFAULT).mine
    expect(q.length).toBeGreaterThan(0)
    expect(new Set(q.map((r) => r.action))).toEqual(new Set(['workshop', 'execute']))
    expect(q.every((r) => ideaDept(r.idea) === 'R&D')).toBe(true)
  })
  it('the Central ID approves, and Finance verifies on top of its own department\'s work', () => {
    const central = queueFor(U('id-central'), s.ideas, USERS_DEFAULT).mine
    expect(central.length).toBeGreaterThan(0)
    expect(central.every((r) => r.action === 'approve')).toBe(true)
    expect(queueFor(U('id-finance'), s.ideas, USERS_DEFAULT).mine.some((r) => r.action === 'verify')).toBe(true)
  })
  it('the Central ID also sees every open item; every other ID only what is assigned to it', () => {
    const central = queueFor(U('id-central'), s.ideas, USERS_DEFAULT)
    expect(central.all.length).toBeGreaterThan(central.mine.length)
    expect(new Set(central.all.map((r) => r.action))).toEqual(new Set(['workshop', 'approve', 'execute', 'verify']))
    for (const u of departmentIds) {
      const q = queueFor(u, s.ideas, USERS_DEFAULT)
      expect(q.all, u.id).toEqual(q.mine)
      expect(q.mine.every((r) => r.assignedToMe), u.id).toBe(true)
    }
  })
  it('rows carry waiting time and SLA state; breached items come first', () => {
    const q = queueFor(U('id-central'), s.ideas, USERS_DEFAULT, Date.parse('2026-10-16T12:00:00Z')).all
    expect(q.every((r) => r.waitingHours >= 0)).toBe(true)
    const firstOk = q.findIndex((r) => r.sla !== 'breach')
    expect(q.slice(firstOk).every((r) => r.sla !== 'breach')).toBe(true)
  })
  it('a Sourcing idea reaches only the Sourcing ID, whatever its commodity', () => {
    const base = s.ideas.find((x) => x.stage === STAGE.feasibility)!
    const har = { ...base, id: 'COIN-FY27-HAR-9001', department: 'Sourcing', commodity: 'BL', submitterId: 'id-sourcing', submitterName: 'Aditi Sharma', evaluation: undefined }
    const ideas = [...s.ideas, har]
    expect(queueFor(U('id-sourcing'), ideas, USERS_DEFAULT).mine.some((r) => r.idea.id === har.id)).toBe(true)
    for (const other of departmentIds.filter((u) => u.id !== 'id-sourcing')) {
      expect(queueFor(other, ideas, USERS_DEFAULT).all.some((r) => r.idea.id === har.id), other.id).toBe(false)
    }
  })
  it('My queue lists exactly what the idea page lets each ID act on', () => {
    const flag = { workshop: 'workshop', approve: 'approve', execute: 'execute', verify: 'verify' } as const
    for (const me of departmentIds) {
      const listed = new Set(queueFor(me, s.ideas, USERS_DEFAULT).all.map((r) => r.idea.id))
      for (const idea of s.ideas) {
        const action = pendingAction(idea)
        if (!action) continue
        expect(listed.has(idea.id), `${me.id} · ${idea.id} · ${action}`).toBe(ideaPerms(me, idea)[flag[action]])
      }
    }
  })
})
