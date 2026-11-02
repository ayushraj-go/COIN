// The headline KPI row (Pipeline · In execution · Implemented · Realised) is the same for every role and workspace;
// only where a tile leads depends on the pages the role can open.
import { describe, it, expect } from 'vitest'
import { USERS_DEFAULT } from '../../lib/masters'
import { headlineScope, kpiLinks, overdueExecutions } from './headline'
import type { Idea } from '../../lib/types'

const user = (id: string) => USERS_DEFAULT.find((u) => u.id === id)!

describe('kpiLinks', () => {
  it('employees and suppliers land on My Ideas, filtered by bucket, in the Innovation Network', () => {
    for (const id of ['u-sub1', 'u-so-emp', 'u-sup1']) {
      const l = kpiLinks(user(id))
      expect(l.pipeline).toEqual({ space: 'IN', base: '/my-ideas', bucket: 'Pipeline' })
      expect(l.execution).toEqual({ space: 'IN', base: '/my-ideas', bucket: 'In Execution' })
      expect(l.implemented).toEqual({ space: 'IN', base: '/my-ideas', bucket: 'Implemented' })
      expect(l.realised).toEqual({ space: 'IN', base: '/my-ideas', bucket: 'Implemented' })
    }
  })
  it('the Sourcing Head opens the register and the Execution Hub — its Verification and Savings proof tabs', () => {
    const l = kpiLinks(user('u-head'))
    expect(l.pipeline).toEqual({ space: 'IN', base: '/ideas', bucket: 'Pipeline' })
    expect(l.execution).toEqual({ space: 'CO', base: '/execution' })
    expect(l.implemented).toEqual({ space: 'CO', base: '/execution?tab=verification' })
    expect(l.realised).toEqual({ space: 'CO', base: '/execution?tab=proof' })
  })
  it('the ladder roles open the Execution Hub too (savings proof and verification live there now)', () => {
    const l = kpiLinks(user('u-rd-tl'))
    expect(l.execution).toEqual({ space: 'CO', base: '/execution' })
    expect(l.realised).toEqual({ space: 'CO', base: '/execution?tab=proof' })
  })
})

describe('overdueExecutions', () => {
  const ex = (id: string, status: string, targetDate: string) => ({ id, bucket: 'In Execution', execution: { status, targetDate } }) as unknown as Idea
  it('counts live executions past their target date', () => {
    const list = [ex('a', 'In Execution', '2026-09-30'), ex('b', 'In Execution', '2026-12-31'), ex('c', 'Implemented', '2026-01-01')]
    expect(overdueExecutions(list, '2026-10-16').map((i) => i.id)).toEqual(['a'])
  })
})

describe('headlineScope', () => {
  const idea = (id: string, extra: Partial<Idea>) => ({ id, submitterId: 'x', ...extra }) as unknown as Idea
  const list = [
    idea('own', { submitterId: 'u-sup1' }),
    idea('supplier-sub', { isSupplierSubmission: true, supplierCode: user('u-sup1').supplierCode }),
    idea('amber-idea-on-my-part', { feasibility: { supplierCode: user('u-sup1').supplierCode } } as Partial<Idea>),
  ]
  it('people without the register count only their own ideas — the list their tiles open', () => {
    expect(headlineScope(user('u-sup1'), list).map((i) => i.id)).toEqual(['own', 'supplier-sub'])
  })
  it('register users keep every idea they can see', () => {
    expect(headlineScope(user('u-head'), list)).toHaveLength(3)
  })
})
