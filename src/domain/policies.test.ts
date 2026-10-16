// The server's command policy: the ladder decides, arguments a client could abuse are cleaned.
import { describe, it, expect } from 'vitest'
import { freshData, type DomainState } from './engine'
import { authorise } from './policies'
import { STAGE } from '../lib/masters'

const data = freshData()
const state: DomainState = { ...data, userId: null }
const user = (id: string) => data.users.find((u) => u.id === id)!
const run = (who: string, name: string, ...args: unknown[]) => authorise(name, { me: user(who), state, args })
const rdAt = (stage: string) => data.ideas.find((i) => i.stage === stage && i.evaluation?.dept === 'R&D')!

describe('stage actions follow the department ladder', () => {
  it('department approval: only the idea’s department head (or override)', () => {
    const i = rdAt(STAGE.approval)
    expect(run('u-rd-head', 'approve', i.id).ok).toBe(true)
    expect(run('u-head', 'approve', i.id).ok).toBe(true)
    expect(run('u-hr-head', 'approve', i.id).ok).toBe(false)
    expect(run('u-eval1', 'approve', i.id).ok).toBe(false) // the R&D department lead evaluates, does not approve
    expect(run('u-sub1', 'signLock', i.id).ok).toBe(false)
  })
  it('an unknown idea or one the caller cannot see is "not found"', () => {
    expect(run('u-head', 'approve', 'COIN-NOPE').ok).toBe(false)
    const hidden = data.ideas.find((x) => x.department === 'HR' && x.bucket === 'Pipeline')!
    const r = run('u-rd-tl', 'recordFeasibility', hidden.id)
    expect(r.ok).toBe(false)
    expect((r as { reason?: string }).reason).toBe('Idea not found')
  })
  it('internal steps and the supplier form are not callable as commands', () => {
    expect(run('u-admin', 'advance', data.ideas[0].id, 'x').ok).toBe(false)
    expect(run('u-admin', 'notify', {}).ok).toBe(false)
    expect(run('u-admin', 'respondSupplierCheck', 'tok', {}).ok).toBe(false)
    expect(run('u-admin', 'dropDatabase').ok).toBe(false)
  })
})

describe('arguments are cleaned', () => {
  it('a draft cannot set its own stage, approvals, submitter or supplier flag', () => {
    const r = run('u-sub1', 'saveDraft', { title: 'x', commodity: 'FAS', stage: 'Execution started', bucket: 'Implemented', approvals: [{ level: 'x', decision: 'Approved' }], submitterId: 'u-head', isSupplierSubmission: true, buyerId: 'u-admin' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const d = r.args[0] as Record<string, unknown>
    expect(d.stage).toBeUndefined(); expect(d.bucket).toBeUndefined(); expect(d.approvals).toBeUndefined(); expect(d.submitterId).toBeUndefined()
    expect(d.isSupplierSubmission).toBe(false)
    expect(d.buyerId).toBe(data.commodities.find((c) => c.code === 'FAS')!.buyerId)
  })
  it('a supplier submission always carries the supplier’s own vendor code', () => {
    const r = run('u-sup1', 'saveDraft', { title: 'x', supplierCode: 'V99999' })
    expect(r.ok && (r.args[0] as { supplierCode: string }).supplierCode).toBe(user('u-sup1').supplierCode)
  })
  it('only someone’s own draft can be continued or deleted', () => {
    const d = data.ideas.find((i) => i.stage === 'Draft')
    if (!d) return
    const other = data.users.find((u) => u.id !== d.submitterId && u.roles.includes('submitter'))!
    expect(run(other.id, 'deleteDraft', d.id).ok).toBe(false)
    expect(run(d.submitterId, 'deleteDraft', d.id).ok).toBe(true)
  })
  it('a saved view is personal unless an override user shares it', () => {
    const r = run('u-sub1', 'saveView', { name: 'v', userId: '*', filters: {}, columns: [] })
    expect(r.ok && (r.args[0] as { userId: string }).userId).toBe('u-sub1')
    const h = run('u-head', 'saveView', { name: 'v', userId: '*', filters: {}, columns: [] })
    expect(h.ok && (h.args[0] as { userId: string }).userId).toBe('*')
  })
})

describe('organisation actions', () => {
  it('masters and settings are Admin only', () => {
    expect(run('u-admin', 'upsert', 'levers', { id: 'L99' }).ok).toBe(true)
    for (const who of ['u-head', 'u-rd-head', 'u-sub1', 'u-sup1']) expect(run(who, 'upsert', 'users', { id: who, roles: ['admin'] }).ok).toBe(false)
    expect(run('u-head', 'updateSettings', { sessionTimeoutMin: 999 }).ok).toBe(false)
  })
  it('a supplier answers only its own workshop invitation', () => {
    const sup = user('u-sup1')
    const c = data.campaigns.find((x) => x.suppliers.includes(sup.supplierCode!))!
    const other = c.suppliers.find((x) => x !== sup.supplierCode)
    expect(run('u-sup1', 'setAttendance', c.id, sup.supplierCode, 'Accepted').ok).toBe(true)
    if (other) expect(run('u-sup1', 'setAttendance', c.id, other, 'Declined').ok).toBe(false)
  })
  it('finance actions belong to Finance (and override users)', () => {
    expect(run('u-fin', 'financeValidate', []).ok).toBe(true)
    expect(run('u-sub1', 'financeValidate', []).ok).toBe(false)
    expect(run('u-rd-exec', 'runRealisation').ok).toBe(false)
  })
})
