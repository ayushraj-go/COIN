// What each role may receive from the server — ideas, people, suppliers, emails, settings.
import { describe, it, expect } from 'vitest'
import { freshData, type DomainState } from './engine'
import { canSeeIdea } from '../lib/calc'
import { visibleData, visibleDelta } from './visibility'
import type { Idea } from '../lib/types'

const data = freshData()
const state: DomainState = { ...data, userId: null }
const user = (id: string) => data.users.find((u) => u.id === id)!

describe('suppliers', () => {
  const sup = user('u-sup1')
  it('see only ideas submitted under their own vendor code — never Amber ideas about them', () => {
    const amberIdeaAboutThem = { ...data.ideas[0], submitterId: 'u-sub1', isSupplierSubmission: false, supplierCode: sup.supplierCode } as Idea
    expect(canSeeIdea(sup, amberIdeaAboutThem)).toBe(false)
    const theirs = { ...data.ideas[0], submitterId: 'someone', isSupplierSubmission: true, supplierCode: sup.supplierCode } as Idea
    expect(canSeeIdea(sup, theirs)).toBe(true)
  })
  it('get no passwords, no colleague contact details, only their own vendor record and the parts they supply', () => {
    const v = visibleData(sup, state)
    expect(v.users.every((u) => !('password' in u) || !u.password)).toBe(true)
    expect(v.users.every((u) => !u.email || u.id === sup.id)).toBe(true)
    expect(v.suppliers.map((s) => s.code)).toEqual([sup.supplierCode])
    // other vendors' parts carry their prices — a supplier never sees them
    expect(v.parts.length).toBeGreaterThan(0)
    expect(v.parts.every((p) => p.supplierCode === sup.supplierCode)).toBe(true)
    expect(v.outreachBatches).toEqual([])
    expect(v.supplierResponses).toEqual([])
    expect(v.buyerTargets).toEqual({})
    expect(v.campaigns.every((c) => c.suppliers.includes(sup.supplierCode!))).toBe(true)
  })
})

describe('internal roles', () => {
  it('every role receives exactly the ideas it may see', () => {
    for (const u of data.users) {
      const v = visibleData(u, state)
      expect(v.ideas.length).toBe(data.ideas.filter((i) => canSeeIdea(u, i)).length)
    }
  })
  it('nobody receives password hashes or passwords', () => {
    for (const id of ['u-head', 'u-admin', 'u-sub1']) expect(visibleData(user(id), state).users.some((u) => (u as { password?: string }).password)).toBe(false)
  })
  it('notifications and email preferences are personal', () => {
    const v = visibleData(user('u-rd-head'), state)
    expect(v.notifications.every((n) => n.userId === 'u-rd-head')).toBe(true)
  })
  it('an employee sees only emails addressed to them or about their ideas', () => {
    const me = user('u-sub1')
    const v = visibleData(me, state)
    const mine = new Set(data.ideas.filter((i) => canSeeIdea(me, i)).map((i) => i.id))
    expect(v.emails.every((e) => e.to.includes(me.email) || [...mine].some((id) => e.subject.includes(id) || e.body.includes(id)))).toBe(true)
    expect(visibleData(user('u-head'), state).emails.length).toBe(data.emails.length)
  })
})

describe('visibleDelta', () => {
  it('sends changed records the user may see and removes the ones that vanished or became invisible', () => {
    const me = user('u-rd-head')
    const before: DomainState = state
    const target = data.ideas.find((i) => canSeeIdea(me, i))!
    const hidden = data.ideas.find((i) => !canSeeIdea(me, i))!
    const after: DomainState = { ...state, ideas: state.ideas.map((i) => (i.id === target.id ? { ...i, title: 'changed' } : i.id === hidden.id ? { ...i, title: 'secret' } : i)).filter((i) => i.id !== data.ideas[data.ideas.length - 1].id) }
    const d = visibleDelta(me, before, after)
    expect(d.ideas?.upsert.map((i) => i.id)).toEqual([target.id])
    expect(d.ideas?.remove).toContain(data.ideas[data.ideas.length - 1].id)
    expect(d.users).toBeUndefined()
  })
})
