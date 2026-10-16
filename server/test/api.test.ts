// API integration tests — the real server against the real PostgreSQL test database (TEST_DATABASE_URL).
// One HR idea travels all six stages through HTTP, each step by the person the ladder names; everyone else is refused.
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { loadConfig } from '../src/config'
import { createPool, migrate, type Db } from '../src/db'
import { buildApp } from '../src/app'
import { seedOrg } from '../src/seed'
import { STAGE } from '../../src/lib/masters'
import { lockTarget } from '../../src/lib/workflow'
import { ideaAnnualised } from '../../src/lib/calc'
import type { Idea, IdeaPart } from '../../src/lib/types'

const base = loadConfig()
const enabled = !!base.TEST_DATABASE_URL
const config = loadConfig({ DATABASE_URL: base.TEST_DATABASE_URL ?? '', DEMO_LOGIN: 'true', LOG_LEVEL: 'silent', EMAIL_DRIVER: 'outbox' })
let db: Db
let app: FastifyInstance

const cookies = new Map<string, string>()
async function as(userId: string): Promise<string> {
  if (cookies.has(userId)) return cookies.get(userId)!
  const r = await app.inject({ method: 'POST', url: '/api/auth/demo-login', payload: { userId } })
  expect(r.statusCode, `demo login ${userId}`).toBe(200)
  const c = String(r.headers['set-cookie']).split(';')[0]
  cookies.set(userId, c)
  return c
}
async function cmd(userId: string, name: string, ...args: unknown[]) {
  const r = await app.inject({ method: 'POST', url: `/api/commands/${name}`, headers: { cookie: await as(userId) }, payload: { args } })
  return { status: r.statusCode, body: r.json() as { result: unknown; version: number; changes: Record<string, { upsert: Idea[] }>; error?: string } }
}
async function boot(userId: string) {
  const r = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { cookie: await as(userId) } })
  expect(r.statusCode).toBe(200)
  return r.json() as { version: number; userId: string; data: { ideas: Idea[]; users: Record<string, unknown>[]; emails: { to: string[]; subject: string; body: string }[]; notifications: { userId: string; ideaId?: string; title: string }[]; ledger: { ideaId: string }[] } }
}
const ideaOf = async (userId: string, id: string) => (await boot(userId)).data.ideas.find((i) => i.id === id)!

beforeAll(async () => {
  if (!enabled) return
  db = createPool(config.DATABASE_URL)
  await db.query('drop schema public cascade; create schema public;')
  await migrate(db)
  await seedOrg(db, config)
  app = await buildApp({ db, config })
}, 120_000)
afterAll(async () => { if (enabled) { await app.close(); await db.end() } })

describe.skipIf(!enabled)('sign-in', () => {
  it('health and config', async () => {
    expect((await app.inject({ url: '/api/health' })).json()).toMatchObject({ ok: true, organisation: 'ready' })
    expect((await app.inject({ url: '/api/config' })).json()).toMatchObject({ demoLogin: true })
  })
  it('email or employee id + password; wrong password and unknown user get the same answer', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'AEL-20877', password: config.SEED_PASSWORD } })
    expect(ok.statusCode).toBe(200)
    expect(String(ok.headers['set-cookie'])).toMatch(/coin_sid=.*HttpOnly/i)
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'AEL-20877', password: 'nope' } })
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'nobody@x.com', password: 'nope' } })
    expect(bad.statusCode).toBe(401)
    expect(unknown.json()).toEqual(bad.json())
  })
  it('only failed sign-ins are limited — a busy office is never locked out', async () => {
    const ok = () => app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'meera.iyer@ambergroupindia.com', password: config.SEED_PASSWORD } })
    for (let k = 0; k < 15; k++) expect((await ok()).statusCode).toBe(200)
    const bad = () => app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'rajesh.khanna@ambergroupindia.com', password: 'nope' } })
    for (let k = 0; k < 10; k++) expect((await bad()).statusCode).toBe(401)
    expect((await bad()).statusCode).toBe(429)
    // another account from the same address still signs in
    expect((await ok()).statusCode).toBe(200)
  })
  it('no session → 401 everywhere', async () => {
    for (const url of ['/api/bootstrap', '/api/auth/me', '/api/version']) expect((await app.inject({ url })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/commands/approve', payload: { args: ['x'] } })).statusCode).toBe(401)
  })
  it('an idle session expires on the server', async () => {
    const c = await as('u-mgmt')
    await db.query("update sessions set last_seen_at = now() - interval '2 hours' where user_id = 'u-mgmt'")
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: c } })).statusCode).toBe(401)
    cookies.delete('u-mgmt')
  })
})

describe.skipIf(!enabled)('what each role receives', () => {
  it('no password or hash ever leaves the server', async () => {
    for (const u of ['u-admin', 'u-sub1', 'u-sup1']) {
      const raw = JSON.stringify((await boot(u)).data.users)
      expect(raw).not.toMatch(/password|scrypt\$/i)
    }
  })
  it('an employee gets only their own ideas; the Sourcing Head gets all', async () => {
    const mine = await boot('u-sub1')
    expect(mine.data.ideas.length).toBeGreaterThan(0)
    expect(mine.data.ideas.every((i) => i.submitterId === 'u-sub1')).toBe(true)
    const all = (await db.query("select count(*)::int as n from ideas where org_id = 'amber'")).rows[0].n
    expect((await boot('u-head')).data.ideas.length).toBe(all)
  })
  it('a department lead gets only their department’s ideas (plus their own)', async () => {
    const b = await boot('u-hr-lead')
    const { ideaDept } = await import('../../src/lib/workflow')
    expect(b.data.ideas.every((i) => ideaDept(i) === 'HR' || i.submitterId === 'u-hr-lead' || i.ownerId === 'u-hr-lead')).toBe(true)
  })
})

describe.skipIf(!enabled)('one HR idea through the whole ladder over HTTP', () => {
  const part: IdeaPart = { partCode: 'FAC-CANTEEN-01', description: 'Canteen meals per day', uom: 'Nos', currentSupplier: 'Local caterer', baselinePrice: 110, baselineSource: 'LBP', newPrice: 96, annualVolume: 240000, volumeSource: 'MRN FY26' }
  let id = ''
  let token = ''

  it('1 · the employee submits; the draft cannot set its own stage', async () => {
    const d = await cmd('u-hr-emp', 'saveDraft', { title: 'Canteen per-meal rate', commodity: 'FAC', stage: 'Execution started', bucket: 'Implemented' })
    expect(d.status).toBe(200)
    const draft = await ideaOf('u-hr-emp', d.body.result as string)
    expect(draft.stage).toBe('Draft')
    const r = await cmd('u-hr-emp', 'submitIdea', { title: 'Re-bid the Noida canteen contract on a per-meal rate', commodity: 'FAC', leverId: 'L01', parts: [part], currentState: 'Fixed monthly fee', proposedChange: 'Per-meal rate' }, draft.id)
    expect(r.status).toBe(200)
    id = r.body.result as string
    expect(id).toMatch(/^COIN-FY\d\d-FAC-\d{4}$/)
    const i = await ideaOf('u-hr-emp', id)
    expect(i.stage).toBe(STAGE.feasibility)
    expect(i.department).toBe('HR')
    // the HR team lead is told
    expect((await boot('u-hr-tl')).data.notifications.some((n) => n.ideaId === id)).toBe(true)
  })

  it('2 · only the HR team lead checks feasibility', async () => {
    expect((await cmd('u-rd-tl', 'recordFeasibility', id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })).status).toBe(403)
    expect((await cmd('u-hr-emp', 'recordFeasibility', id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'] })).status).toBe(403)
    const r = await cmd('u-hr-tl', 'recordFeasibility', id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['HR'], remarks: 'Feasible' })
    expect(r.status).toBe(200)
    expect(r.body.changes.ideas.upsert.find((x) => x.id === id)!.stage).toBe(STAGE.evaluation)
  })

  it('3 · the HR department lead evaluates; the supplier answers the emailed form without logging in', async () => {
    expect((await cmd('u-hr-tl', 'recordEvaluation', id, 'Recommend')).status).toBe(403)
    const s = await cmd('u-hr-lead', 'sendSupplierCheck', id, { supplierName: 'Sodexo Food', contactName: 'R. Iyer', email: 'r.iyer@sodexo.example', item: 'Canteen meals', spec: 'Per-meal rate, 2,000 meals a day', requiredBy: '2026-12-01', subject: 'Capability request', body: 'Please answer: {{formLink}}' })
    expect(s.status).toBe(200)
    token = s.body.result as string
    const mail = (await db.query("select to_addrs, subject, data from emails where org_id = 'amber' and $1 = any(to_addrs)", ['r.iyer@sodexo.example'])).rows[0]
    expect(mail.subject).toBe('Capability request')
    const pub = await app.inject({ url: `/api/public/supplier-check/${token}` })
    expect(pub.statusCode).toBe(200)
    const shown = JSON.stringify(pub.json())
    expect(shown).not.toMatch(/baseline|newPrice|annualVolume|110|96/)
    const resp = await app.inject({ method: 'POST', url: `/api/public/supplier-check/${token}`, payload: { canSupply: 'Yes', meetsSpec: 'Yes', contactName: 'R. Iyer', leadTimeDays: 30 } })
    expect(resp.json()).toEqual({ ok: true })
    expect((await app.inject({ method: 'POST', url: `/api/public/supplier-check/${token}`, payload: { canSupply: 'No', meetsSpec: 'No', contactName: 'x' } })).statusCode).toBe(409)
    expect((await app.inject({ url: '/api/public/supplier-check/not-a-token' })).statusCode).toBe(404)
    const r = await cmd('u-hr-lead', 'recordEvaluation', id, 'Recommend', 'CBA verified')
    expect(r.status).toBe(200)
    expect((await ideaOf('u-hr-lead', id)).stage).toBe(STAGE.approval)
  })

  it('4 · the HR department head signs the lock and approves — two people at once cannot both approve', async () => {
    const i = await ideaOf('u-hr-head', id)
    expect((await cmd('u-hr-lead', 'approve', id)).status).toBe(403)
    // approving without a signed lock is refused by the workflow (409, not a crash)
    const noLock = await cmd('u-hr-head', 'approve', id)
    expect(noLock.status).toBe(409)
    expect(noLock.body.error).toMatch(/lock/i)
    expect((await cmd('u-hr-head', 'signLock', id, { commercialOk: true, supplierAligned: 'Confirmed', budget: 0, timelineMonths: 6, startDate: '2026-11-01', endDate: '2027-05-01', targetSaving: lockTarget(ideaAnnualised(i), 6), signatureName: 'Lata Krishnan' })).status).toBe(200)
    const [a, b] = await Promise.all([cmd('u-hr-head', 'approve', id), cmd('u-head', 'approve', id)])
    expect([a.status, b.status].sort()).toEqual([200, 403])
    const after = await ideaOf('u-hr-head', id)
    expect(after.stage).toBe(STAGE.execution)
    expect(after.ownerId).toBe('u-hr-exec')
  })

  it('5 · the HR execution owner runs execution and hands over; others cannot', async () => {
    const i = await ideaOf('u-hr-exec', id)
    const mrn = i.execution!.milestones.find((m) => m.name === 'First MRN at new price')!
    expect((await cmd('u-rd-exec', 'toggleMilestone', id, mrn.id)).status).toBe(403)
    expect((await cmd('u-hr-exec', 'toggleMilestone', id, mrn.id, 'first MRN booked')).status).toBe(200)
    const h = await cmd('u-hr-exec', 'handOverForVerification', id, new Date().toISOString().slice(0, 10), { [part.partCode]: 96 })
    expect(h.status).toBe(200)
    expect((await ideaOf('u-hr-exec', id)).stage).toBe(STAGE.verification)
  })

  it('6 · Finance verifies; the execution owner cannot', async () => {
    const v = { mrnAtApproved: true, financeValidated: true, targetAchieved: true, targetAtVerification: 0 }
    expect((await cmd('u-hr-exec', 'verifyIdea', id, v)).status).toBe(403)
    expect((await cmd('u-fin', 'verifyIdea', id, v)).status).toBe(200)
    const done = await ideaOf('u-hr-emp', id)
    expect(done.verification?.verifiedAt).toBeTruthy()
    // the employee was told at every milestone of their idea
    const titles = (await boot('u-hr-emp')).data.notifications.filter((n) => n.ideaId === id).map((n) => n.title)
    expect(titles).toEqual(expect.arrayContaining(['Idea approved — execution started', 'Implemented — handed for verification', 'Savings verified']))
  })
})

describe.skipIf(!enabled)('commands are safe to retry and to undo', () => {
  it('the same command id runs once', async () => {
    const c = await as('u-admin')
    const payload = { args: ['levers', { id: 'L99', name: 'Retry lever', group: 'Commercial', route: 'Commercial', defaultSavingsType: 'Hard', active: true }], commandId: 'retry-test-0001' }
    const a = await app.inject({ method: 'POST', url: '/api/commands/upsert', headers: { cookie: c }, payload })
    const b = await app.inject({ method: 'POST', url: '/api/commands/upsert', headers: { cookie: c }, payload })
    expect(a.json().duplicate).toBe(false)
    expect(b.json().duplicate).toBe(true)
    expect(b.json().version).toBe(a.json().version)
  })
  it('undo puts the rows back — only for the person who did it', async () => {
    const c = await as('u-admin')
    const before = (await db.query("select data from levers where org_id = 'amber' and id = 'L01'")).rows[0].data
    const r = await app.inject({ method: 'POST', url: '/api/commands/upsert', headers: { cookie: c }, payload: { args: ['levers', { ...before, name: 'Renamed' }], commandId: 'undo-test-0001' } })
    expect(r.statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/undo', headers: { cookie: await as('u-head') }, payload: { commandIds: ['undo-test-0001'] } })).statusCode).toBe(403)
    const u = await app.inject({ method: 'POST', url: '/api/undo', headers: { cookie: c }, payload: { commandIds: ['undo-test-0001'] } })
    expect(u.statusCode).toBe(200)
    expect((await db.query("select data from levers where org_id = 'amber' and id = 'L01'")).rows[0].data.name).toBe(before.name)
  })
})

describe.skipIf(!enabled)('attachments', () => {
  it('files are stored on the server and served only to people who can see the idea', async () => {
    const own = (await boot('u-sub1')).data.ideas.find((i) => i.bucket === 'Pipeline')!
    const dataUrl = `data:text/plain;base64,${Buffer.from('hello COIN').toString('base64')}`
    const r = await cmd('u-sub1', 'addAttachments', own.id, [{ id: 'att-test-1', name: 'note.txt', size: 10, type: 'text/plain', dataUrl, uploadedAt: new Date().toISOString(), by: 'test' }])
    expect(r.status).toBe(200)
    const att = (await ideaOf('u-sub1', own.id)).attachments.find((a) => a.id === 'att-test-1')!
    expect(att.dataUrl).toBeUndefined()
    expect(att.url).toMatch(/^\/api\/files\//)
    const get = await app.inject({ url: att.url!, headers: { cookie: await as('u-sub1') } })
    expect(get.statusCode).toBe(200)
    expect(get.body).toBe('hello COIN')
    expect((await app.inject({ url: att.url!, headers: { cookie: await as('u-sup1') } })).statusCode).toBe(404)
  })
})

describe.skipIf(!enabled)('administration', () => {
  it('a new account gets a hashed password, can sign in, and is signed out when deactivated', async () => {
    const user = { id: 'u-new-1', name: 'Neha Test', employeeId: 'AEL-99001', email: 'neha.test@ambergroupindia.com', roles: ['submitter'], department: 'HR', plant: 'NDA', designation: 'Executive', commodities: [], avatarColor: '#4338ca', active: true }
    expect((await cmd('u-admin', 'upsert', 'users', { ...user, password: 'short' })).status).toBe(400)
    expect((await cmd('u-hr-head', 'upsert', 'users', { ...user, password: 'Strong123' })).status).toBe(403)
    expect((await cmd('u-admin', 'upsert', 'users', { ...user, password: 'Strong123' })).status).toBe(200)
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'neha.test@ambergroupindia.com', password: 'Strong123' } })
    expect(login.statusCode).toBe(200)
    const c = String(login.headers['set-cookie']).split(';')[0]
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: c } })).statusCode).toBe(200)
    expect((await cmd('u-admin', 'upsert', 'users', { ...user, active: false })).status).toBe(200)
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: c } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'neha.test@ambergroupindia.com', password: 'Strong123' } })).statusCode).toBe(403)
  })
})
