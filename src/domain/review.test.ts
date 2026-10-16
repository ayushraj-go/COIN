// Independent security review of the backend branch — every finding reproduced here before it was fixed.
import { describe, it, expect } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { domainActions, freshData, type DomainActions, type DomainState } from './engine'
import { authorise } from './policies'
import { visibleData } from './visibility'
import { STAGE } from '../lib/masters'

const data = freshData()
const state: DomainState = { ...data, userId: null }
const user = (id: string) => data.users.find((u) => u.id === id)!
const auth = (who: string, name: string, ...args: unknown[]) => authorise(name, { me: user(who), state, args })
const argsOf = (r: ReturnType<typeof authorise>) => { expect(r.ok, (r as { reason?: string }).reason).toBe(true); return (r as { args: unknown[] }).args }
const execIdea = data.ideas.find((i) => i.stage === STAGE.execution && i.execution?.status === 'In Execution' && i.ownerId)!
const owner = execIdea.ownerId!

describe('#1 syncNpdPap cannot smuggle other fields', () => {
  it('keeps only the NPD / PAP status', () => {
    const a = argsOf(auth(owner, 'syncNpdPap', execIdea.id, { npdStatus: 'Sample approved', stage: 'Implemented', bucket: 'Implemented', id: 'COIN-OTHER', approvals: [] }))
    expect(a[1]).toEqual({ npdStatus: 'Sample approved' })
  })
  it('refuses a status that does not exist', () => {
    expect(auth(owner, 'syncNpdPap', execIdea.id, { papStatus: 'Hacked' }).ok).toBe(false)
  })
})

describe('#2 attachments are only files COIN stores', () => {
  it('drops script links and foreign file links, and stamps who uploaded', () => {
    const own = data.ideas.find((i) => i.submitterId === 'u-sub1' && i.bucket === 'Pipeline')!
    const a = argsOf(auth('u-sub1', 'addAttachments', own.id, [
      { id: 'a1', name: 'quote.pdf', size: 10, type: 'application/pdf', dataUrl: 'javascript:alert(1)', uploadedAt: 'x', by: 'Admin' },
      { id: 'a2', name: 'x.pdf', size: 10, type: 'application/pdf', url: 'https://evil.example/x', uploadedAt: 'x', by: 'x' },
      { id: 'a3', name: 'ok.png', size: 10, type: 'image/png', dataUrl: 'data:image/png;base64,AAAA', uploadedAt: 'x', by: 'x' },
    ]))
    const atts = a[1] as { id: string; dataUrl?: string; url?: string; by: string }[]
    expect(atts.map((x) => x.id)).toEqual(['a3'])
    expect(atts[0].by).toBe(user('u-sub1').name)
  })
})

describe('#3 moveToStage applies the stage it checked', () => {
  it('a raw "Implemented" becomes the checked Verification stage', () => {
    const i = data.ideas.find((x) => x.stage === STAGE.execution && x.execution?.effectiveDate && x.execution.status === 'In Execution')
    if (!i) return
    const r = auth('u-head', 'moveToStage', i.id, 'Implemented')
    expect(argsOf(r)[1]).toBe(STAGE.verification)
  })
})

describe('#4 patches carry only the fields their screen edits', () => {
  it('updateExecution: no slippage wipe, no backdated first MRN, no status', () => {
    const a = argsOf(auth(owner, 'updateExecution', execIdea.id, { progress: 50, slippage: [], effectiveDate: '2020-01-01', status: 'Done', originalTargetDate: 'x' }, 'r'))
    expect(a[1]).toEqual({ progress: 50 })
  })
  it('saveEvaluation: cannot move the idea to another department or fake the supplier check', () => {
    const ev = data.ideas.find((i) => i.stage === STAGE.evaluation)!
    const lead = data.users.find((u) => u.roles.includes('deptlead') && u.department === ev.evaluation?.dept)!
    const a = argsOf(auth(lead.id, 'saveEvaluation', ev.id, { cbaVerified: true, dept: 'Quality', supplier: { status: 'Skipped' } }))
    expect(a[1]).toEqual({ cbaVerified: true })
  })
  it('sendSupplierCheck: cannot set its own status or token', () => {
    const ev = data.ideas.find((i) => i.stage === STAGE.evaluation)!
    const lead = data.users.find((u) => u.roles.includes('deptlead') && u.department === ev.evaluation?.dept)!
    const a = argsOf(auth(lead.id, 'sendSupplierCheck', ev.id, { supplierName: 'S', contactName: 'C', email: 'c@s.com', item: 'i', spec: 's', requiredBy: '2026-12-01', subject: 'x', body: 'y', status: 'Responded', token: 'mine' }))
    expect(a[1]).not.toHaveProperty('status')
    expect(a[1]).not.toHaveProperty('token')
  })
})

describe('#5 supplier form tokens are secret and unguessable', () => {
  it('the token is 128 random bits and only the evaluating side receives it', () => {
    const ev = data.ideas.find((i) => i.stage === STAGE.evaluation)!
    const store = createStore<DomainState & DomainActions>()((set, get) => ({ ...state, userId: 'u-head', ...domainActions(set as never, get as never, { warn: () => undefined, appUrl: () => 'https://coin.test' }) }))
    const token = store.getState().sendSupplierCheck(ev.id, { supplierName: 'S', contactName: 'C', email: 'c@s.com', item: 'i', spec: 's', requiredBy: '2026-12-01', subject: 'x', body: 'Answer here: {{formLink}}' })
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    const after = store.getState()
    const submitter = data.users.find((u) => u.id === ev.submitterId)!
    const seen = visibleData(submitter, after)
    expect(JSON.stringify(seen.ideas.find((i) => i.id === ev.id))).not.toContain(token)
    expect(JSON.stringify(seen.emails)).not.toContain(token)
    const lead = data.users.find((u) => u.roles.includes('deptlead') && u.department === ev.evaluation?.dept)!
    expect(JSON.stringify(visibleData(lead, after).ideas.find((i) => i.id === ev.id))).toContain(token)
  })
})

describe('#6 a supplier never learns about competing suppliers', () => {
  it('one invitation email per supplier; campaigns and commodities trimmed for suppliers', () => {
    const c = data.campaigns.find((x) => x.suppliers.length > 1)!
    const draft = { ...c, status: 'Draft' as const }
    const store = createStore<DomainState & DomainActions>()((set, get) => ({ ...state, campaigns: state.campaigns.map((x) => (x.id === c.id ? draft : x)), userId: 'u-head', ...domainActions(set as never, get as never, { warn: () => undefined, appUrl: () => '' }) }))
    const before = store.getState().emails.length
    store.getState().launchCampaign(c.id)
    const mails = store.getState().emails.slice(0, store.getState().emails.length - before)
    expect(mails.every((m) => m.to.length === 1)).toBe(true)
    const sup = data.users.find((u) => u.roles.includes('supplier') && c.suppliers.includes(u.supplierCode!))!
    const v = visibleData(sup, store.getState())
    const seen = v.campaigns.find((x) => x.id === c.id)!
    expect(seen.suppliers).toEqual([sup.supplierCode])
    expect(Object.keys(seen.attendance)).toEqual([sup.supplierCode])
    expect(seen.targetValue).toBeUndefined()
    expect(v.commodities.every((x) => x.target === undefined && x.addressableSpend === undefined)).toBe(true)
  })
})

describe('#8 settings stay valid', () => {
  it('a decimal or out-of-range session timeout is refused; unknown settings are dropped', () => {
    expect(auth('u-admin', 'updateSettings', { sessionTimeoutMin: 30.5 }).ok).toBe(false)
    expect(auth('u-admin', 'updateSettings', { sessionTimeoutMin: 1 }).ok).toBe(false)
    expect(argsOf(auth('u-admin', 'updateSettings', { sessionTimeoutMin: 45, evil: 1 }))[0]).toEqual({ sessionTimeoutMin: 45 })
  })
})

describe('#10 a backup import never wipes per-person data', () => {
  it('notifications, email preferences, saved views, emails and accounts are not imported', () => {
    const a = argsOf(auth('u-admin', 'importData', { levers: data.levers, notifications: [], emailPrefs: {}, savedViews: [], emails: [], users: [] }))
    expect(Object.keys(a[0] as object)).toEqual(['levers'])
  })
})

describe('#12 drafts are private', () => {
  it('nobody but the submitter receives a draft', () => {
    const d = data.ideas.find((i) => i.stage === 'Draft')
    if (!d) return
    for (const id of ['u-head', 'u-admin', 'u-fin']) expect(visibleData(user(id), state).ideas.some((i) => i.id === d.id)).toBe(false)
    expect(visibleData(user(d.submitterId), state).ideas.some((i) => i.id === d.id)).toBe(true)
  })
})
