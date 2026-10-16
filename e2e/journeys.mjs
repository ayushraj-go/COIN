// Every role's journey through COIN, step by step. Each step is checked against the API (what the database holds),
// not just against the screen. Shared state (idea ids, tokens) travels in ctx.
import { sleep } from './lib.mjs'

export const P = {
  aditi: 'aditi.sharma@ambergroupindia.com',        // Employee · Sourcing
  simran: 'simran.kaur@ambergroupindia.com',        // Employee · HR
  varun: 'varun.malhotra@ambergroupindia.com',      // Team lead · HR
  neelam: 'neelam.saxena@ambergroupindia.com',      // Department lead · HR
  lata: 'lata.krishnan@ambergroupindia.com',        // Department head · HR
  imtiaz: 'imtiaz.ali@ambergroupindia.com',         // Execution owner · HR
  meera: 'meera.iyer@ambergroupindia.com',          // Finance verifier
  girish: 'girish.saluja@ambergroupindia.com',      // Sourcing Head (override)
  nikhil: 'nikhil.agarwal@ambergroupindia.com',     // Admin
  rajesh: 'rajesh.khanna@ambergroupindia.com',      // Management
  sanjay: 'sanjay.kapoor@ambergroupindia.com',      // Commodity lead · Sourcing team lead
  kavita: 'kavita.rao@ambergroupindia.com',         // Commodity buyer · Sourcing execution owner
  arvind: 'arvind.rao@ambergroupindia.com',         // Team lead · R&D
  priya: 'dr.priya.nair@ambergroupindia.com',       // Department lead · R&D
  sameer: 'dr.sameer.kulkarni@ambergroupindia.com', // Department head · R&D
  neha: 'neha.verma@ambergroupindia.com',           // Employee · R&D
  rakesh: 'rakesh.gupta@sunrisefasteners.in',       // Supplier · Sunrise Fasteners
}
export const ROLE_OF = {
  [P.simran]: 'Employee', [P.varun]: 'Team lead', [P.neelam]: 'Department lead', [P.lata]: 'Department head', [P.imtiaz]: 'Execution owner',
  [P.meera]: 'Finance verifier', [P.girish]: 'Sourcing Head', [P.nikhil]: 'Admin', [P.rajesh]: 'Management', [P.kavita]: 'Commodity buyer',
  [P.sanjay]: 'Commodity lead', [P.rakesh]: 'Supplier', [P.sameer]: 'Department head (R&D)', [P.arvind]: 'Team lead (R&D)', [P.priya]: 'Department lead (R&D)',
}

const must = (cond, msg) => { if (!cond) throw new Error(msg) }
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
const stageOf = async (api, who, id) => (await api.idea(who, id))?.stage
const created = (ctx, id) => { (ctx.createdIdeas ??= []).includes(id) || ctx.createdIdeas.push(id) }

// ─── 1 · signing in ──────────────────────────────────────────────────────────
async function signIn(qa) {
  qa.section('Signing in', 'Everyone')
  await qa.newPage()
  await qa.step('Open COIN', 'The sign-in page: email / employee ID, password and the demo accounts', () => qa.goto('/login'), () => qa.expectText('Sign in to Cost Innovation Hub'))
  await qa.step('Sign in with a wrong password', 'Refused with a clear message; no session is created', async () => {
    await qa.type('input:not([type="password"]):not([type="checkbox"])', P.aditi)
    await qa.type('input[type="password"]', 'wrong-password')
    await qa.click('Sign in', { exact: true, wait: 1500 })
  }, () => qa.expectText('Invalid email / employee ID or password'))
  await qa.step('Sign in with the right password', 'Home opens with her name and role; the session is an httpOnly cookie', async () => {
    await qa.type('input[type="password"]', process.env.SEED_PASSWORD || 'coin@2026')
    await qa.click('Sign in', { exact: true, wait: 2500 })
  }, async () => { must(!qa.page.url().includes('/login'), 'still on the sign-in page'); await qa.expectText('Aditi'); const c = await qa.page.cookies(); must(c.some((x) => x.name === 'coin_sid' && x.httpOnly), 'no httpOnly session cookie'); return 'Home shown · httpOnly session cookie set' })
  await qa.step('Reload the page', 'Still signed in — the server keeps the session', () => qa.goto('/'), () => qa.expectText('Aditi'))
  await qa.step('Sign in with the employee ID instead of the email', 'Works the same way', () => qa.as('AEL-20877'), () => qa.expectText('Aditi'))
  await qa.step('Sign out', 'Back to sign-in; protected pages ask to sign in again', async () => {
    await qa.click('Aditi Sharma', { wait: 500 })
    await qa.click('Sign out', { wait: 1500 })
    await qa.goto('/ideas')
  }, async () => { must(qa.page.url().includes('/login'), 'a protected page opened without a session'); return 'Redirected to sign-in' })
  await qa.step('Change your own password', 'User menu → Change password: current password required, new one 8+ characters with letters and digits', async () => {
    await qa.as(P.aditi)
    await qa.click('Aditi Sharma', { wait: 500 })
    await qa.click('Change password', { wait: 800 })
    await qa.type('[role="dialog"] input[autocomplete="current-password"]', process.env.SEED_PASSWORD || 'coin@2026')
    const nw = await qa.page.$$('[role="dialog"] input[autocomplete="new-password"]')
    await nw[0].type('Aditi2026x'); await nw[1].type('Aditi2026x'); await sleep(200)
    await qa.click('Change password', { dialog: true, wait: 1500 })
  }, async () => {
    const r = await fetch(`${qa.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: P.aditi, password: 'Aditi2026x' }) })
    must(r.status === 200, `new password refused (${r.status})`)
    const old = await fetch(`${qa.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: P.aditi, password: process.env.SEED_PASSWORD || 'coin@2026' }) })
    must(old.status === 401, 'the old password still works')
    return 'New password works; the old one no longer does'
  })
  await qa.step('One-click demo account', 'The department picker signs in a demo person (switch DEMO_LOGIN off for real users)', async () => {
    await qa.goto('/login')
    await qa.click('HR', { exact: true, wait: 400 })
    await qa.click('Employee', { wait: 2500 })
  }, () => qa.expectText('Simran'))
}

// ─── 2 · an HR idea through all six stages ───────────────────────────────────
async function employeeSubmits(qa, api, ctx) {
  qa.section('One idea, six stages', 'Employee')
  await qa.as(P.simran)
  await qa.step('Employee home', 'Her own KPI row (Pipeline · In execution · Implemented · Realised), recent ideas, actions and open campaigns', null, () => qa.expectText('Good'))
  await qa.step('Open Submit Idea', 'The submission form with the route "Your idea goes to …" (her HR team lead, HR lead, HR head)', () => qa.goto('/submit', 1800), () => qa.expectText('Varun Malhotra'))
  await qa.step('Fill in the idea', 'Commodity, category, open-idea estimate, title, today vs proposed and evidence', async () => {
    await qa.click('Expand all', { wait: 600 })
    await qa.selectWhere('Select a commodity', 'FAC')
    await qa.click('Choose a category', { wait: 400 })
    await qa.typeByPlaceholder('Search categories', 'Negotiation')
    await qa.click('Negotiation', { wait: 400 })
    await qa.click('Open idea', { wait: 400 })
    await qa.typeByPlaceholder('Idea name', 'Re-bid the Noida canteen contract on a per-meal rate')
    await qa.typeByPlaceholder('How it is done', 'Fixed monthly fee of ₹ 9.6 L for up to 2,400 meals a day; actual average is 1,850 meals')
    await qa.typeByPlaceholder('What changes', 'Per-meal rate of ₹ 96 with a 1,500-meal floor; quarterly menu review')
    await qa.typeByPlaceholder('Trial result', 'Three caterer quotes received in September (₹ 92–99 per meal)')
    await qa.type('input[type="number"]', '18')
  }, async () => {
    const v = await qa.page.$eval('[placeholder*="Idea name"]', (e) => e.value)
    must(v.startsWith('Re-bid the Noida canteen'), 'title not filled')
    return 'Form filled · savings panel shows ₹ 18 L'
  })
  await qa.step('Submit for validation', 'A COIN number is issued by the server; the idea goes to the HR team lead', () => qa.click('Submit for validation', { wait: 2500 }), async () => {
    const mine = (await api.data(P.simran)).ideas.filter((i) => i.title.startsWith('Re-bid the Noida canteen') && i.stage !== 'Draft')
    must(mine.length === 1, `expected one submitted idea, found ${mine.length}`)
    ctx.hrIdea = mine[0].id; created(ctx, ctx.hrIdea)
    must(mine[0].stage === 'Team feasibility check', `stage is ${mine[0].stage}`)
    return `${ctx.hrIdea} at Team feasibility check · department ${mine[0].department}`
  })
  await qa.step('My Ideas', 'The new idea is listed with its live stage', () => qa.goto('/my-ideas', 1500), () => qa.expectText(ctx.hrIdea))
  const n = (await api.data(P.varun)).notifications.find((x) => x.ideaId === ctx.hrIdea)
  await qa.step('The HR team lead is told', 'A notification "Team feasibility check requested" for Varun Malhotra', null, () => { must(n, 'no notification for the team lead'); return `"${n.title}" → Varun Malhotra` }, { shot: false })
}

async function teamLead(qa, api, ctx) {
  qa.section('One idea, six stages', 'Team lead')
  must(ctx.hrIdea, 'no idea from the previous step')
  await qa.as(P.varun)
  await qa.step('My queue', 'The new HR idea waits for him with its SLA clock', () => qa.goto('/queue', 1500), () => qa.expectText(ctx.hrIdea))
  await qa.step('Open the idea', 'Idea 360 with "Your action · Team feasibility check"', () => qa.goto(`/ideas/${ctx.hrIdea}`, 1500), () => qa.expectText('Team feasibility check'))
  await qa.step('Team feasibility check form', 'Four checks: technical, cost, duplicates, Go / No-go — suggested Go', () => qa.click('Team feasibility check', { exact: true, wait: 900 }), () => qa.expectText('Is it technically feasible?'))
  await qa.step('Decide Go', 'The idea moves to HR evaluation; the HR department lead is told', async () => {
    await qa.typeByPlaceholder('Remarks for the evaluator', 'Feasible — HR and Admin consulted; canteen quotes look realistic', { dialog: true })
    await qa.click('Go — send for', { dialog: true, wait: 2000 })
  }, async () => { const s = await stageOf(api, P.varun, ctx.hrIdea); must(s === 'Evaluation', `stage is ${s}`); return 'Stage: HR evaluation' })
  qa.section('One idea, six stages', 'Team lead (R&D)')
  await qa.as(P.arvind)
  await qa.step('Another department’s team lead opens the link', 'He cannot see the HR idea at all — "not found"', () => qa.goto(`/ideas/${ctx.hrIdea}`, 1500), () => qa.expectText('not found'))
  await qa.step('…and cannot act on it through the API either', 'The server refuses (403 / not found)', null, async () => {
    const r = await api.cmd(P.arvind, 'recordFeasibility', ctx.hrIdea, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: ['R&D'] })
    must(r.status === 403, `status ${r.status}`)
    return `403 · ${r.body.error}`
  }, { shot: false })
}

async function deptLead(qa, api, ctx) {
  qa.section('One idea, six stages', 'Department lead')
  await qa.as(P.neelam)
  await qa.step('Open the idea from My queue', 'Her action: HR evaluation', async () => { await qa.goto('/queue', 1200); await qa.goto(`/ideas/${ctx.hrIdea}`, 1500) }, () => qa.expectText('HR evaluation'))
  await qa.step('Cost-benefit analysis', 'Annualised saving, payback, FY phasing; she ticks "verified" and saves', async () => {
    await qa.click('HR evaluation', { exact: true, wait: 900 })
    await qa.checkbox('[role="dialog"] input[type="checkbox"]', true)
    await qa.click('Save cost-benefit', { dialog: true, wait: 1500 })
  }, async () => { const i = await api.idea(P.neelam, ctx.hrIdea); must(i.evaluation?.cbaVerified, 'not saved'); return 'Cost-benefit verified and saved' })
  await qa.step('Risk assessment', 'Risks rated and saved (overall risk + ₹ at risk)', async () => {
    await qa.click('Risk assessment', { dialog: true, wait: 700 })
    await qa.click('Medium', { dialog: true, wait: 300 }).catch(() => undefined)
    await qa.click('Save risk assessment', { dialog: true, wait: 1500 })
  }, async () => { const i = await api.idea(P.neelam, ctx.hrIdea); must(i.evaluation?.risks?.length, 'risks not saved'); return `${i.evaluation.risks.length} risks saved` })
  await qa.step('Supplier capability — start', 'Above ₹ 5 L a capability request is needed; opens the request page', async () => {
    await qa.click('Supplier capability', { dialog: true, wait: 700 })
    await qa.click('Start supplier check', { dialog: true, wait: 1800 })
  }, () => qa.expectText('Send capability request'))
  await qa.step('Write the capability request', 'Vendor, item and specification — no Amber prices, volumes or current supplier; the email preview updates', async () => {
    await qa.click('Another vendor', { wait: 500 })
    await qa.fill('Company', 'Sodexo Food Services')
    await qa.fill('Contact', 'Ramesh Iyer')
    await qa.fill('Email', 'ramesh.iyer@sodexo.example')
    await qa.fill('Item (generic description)', 'Industrial canteen meals (breakfast + lunch)')
    await qa.fill('Specification summary', 'Per-meal rate for 1,500–2,400 meals a day, FSSAI licensed kitchen, menu approved monthly')
    await qa.setField('Required by', plusDays(30))
  }, async () => { const ok = await qa.page.evaluate(() => [...document.querySelectorAll('input, textarea')].some((e) => e.value.includes('Sodexo Food Services'))); must(ok, 'vendor not filled'); return 'Request filled · the email preview updates with the vendor, item and form link' })
  await qa.step('Send the capability request', 'The email with a secure form link is written to the outbox', () => qa.click('Send capability request', { wait: 2200 }), async () => {
    const i = await api.idea(P.neelam, ctx.hrIdea)
    const sc = i.evaluation?.supplier
    must(sc?.status === 'Sent' && sc.token, `status ${sc?.status}`)
    ctx.token = sc.token
    const mail = (await api.data(P.girish)).emails.find((e) => e.to.includes('ramesh.iyer@sodexo.example'))
    must(mail, 'no email in the outbox')
    ctx.capabilityEmail = mail
    must(mail.body.includes(`/supplier-form/${sc.token}`), 'the email has no form link')
    return `Email "${mail.subject}" to ramesh.iyer@sodexo.example with link /supplier-form/${sc.token}`
  })

  qa.section('One idea, six stages', 'Supplier (external, no login)')
  await qa.newPage()
  await qa.step('The supplier opens the emailed link', 'A secure form without login, showing only what the email asked', () => qa.goto(`/supplier-form/${ctx.token}`, 1500), async () => { await qa.expectText('Can you supply this item?'); await qa.expectNoText('₹ 110'); return 'Form shown — no prices, volumes or current supplier' })
  await qa.step('The supplier answers', 'Yes / meets spec, capacity, lead time, price, name — then a thank-you', async () => {
    await qa.click('Yes', { exact: true, nth: 0, wait: 200 })
    await qa.click('Yes', { exact: true, nth: 1, wait: 200 })
    await qa.fill('Monthly capacity', '2,500 meals a day')
    await qa.fill('Lead time (days)', '21')
    await qa.fill('Indicative price per unit', '94')
    await qa.fill('Certifications', 'FSSAI, ISO 22000')
    await qa.fill('Your name', 'Ramesh Iyer')
    await qa.click('Submit', { wait: 2000 })
  }, async () => { await qa.expectText('Thank you'); const i = await api.idea(P.neelam, ctx.hrIdea); must(i.evaluation?.supplier?.status === 'Responded', 'response not stored'); return `Stored: can supply ${i.evaluation.supplier.response.canSupply}` })
  await qa.step('The link cannot be used twice', 'Opening it again shows "response received"', () => qa.goto(`/supplier-form/${ctx.token}`, 1500), () => qa.expectText('your response was received'))

  qa.section('One idea, six stages', 'Department lead')
  await qa.as(P.neelam)
  await qa.step('Recommend', 'Decision tab: all three checks done → "Recommend for sourcing approval"; the HR head is told', async () => {
    await qa.goto(`/ideas/${ctx.hrIdea}`, 1500)
    await qa.click('HR evaluation', { exact: true, wait: 900 })
    await qa.click('Decision', { dialog: true, wait: 600 })
    await qa.type('[role="dialog"] textarea', 'Recommended — supplier confirmed capacity and price; pilot one month at Noida')
    await qa.click('Recommend for sourcing approval', { dialog: true, wait: 2000 })
  }, async () => { const s = await stageOf(api, P.neelam, ctx.hrIdea); must(s === 'Approval', `stage is ${s}`); return 'Stage: HR approval' })
}

async function deptHead(qa, api, ctx) {
  qa.section('One idea, six stages', 'Department head')
  await qa.as(P.lata)
  await qa.step('Department approval', 'Her action: "Sign lock & approve" — commercials, budget, timeline and a signature', async () => {
    await qa.goto(`/ideas/${ctx.hrIdea}`, 1500)
    await qa.click('Sign lock & approve', { exact: true, wait: 900 })
  }, () => qa.expectText('Budget'))
  await qa.step('Sign the budget & timeline lock', 'Budget ₹ 0.5 L, 6 months from next month, signature drawn, name typed', async () => {
    await qa.checkbox('[role="dialog"] input[type="checkbox"]', true)
    await qa.fill('Budget (₹ lakh)', '0.5', { dialog: true })
    await qa.setField('Savings start (first MRN)', plusDays(20), { dialog: true })
    await qa.click('6 months', { exact: true, dialog: true, wait: 200 })
    await qa.sign()
    await qa.fill('Name', 'Lata Krishnan', { dialog: true })
    await qa.typeByPlaceholder('Approval remarks', 'Approved — start with Noida, extend to Rajpura after one quarter', { dialog: true })
  }, async () => { must(await qa.isEnabled('Sign lock & approve', { dialog: true }), 'the approve button is still disabled'); return 'Lock filled, signed and ready to approve' })
  await qa.step('Approve', 'Execution starts in Cost Optimisation; the HR execution owner and the employee are told', () => qa.click('Sign lock & approve', { dialog: true, wait: 2500 }), async () => {
    const i = await api.idea(P.lata, ctx.hrIdea)
    must(i.stage === 'Execution started', `stage is ${i.stage}`)
    must(i.lock?.signedBy === 'Lata Krishnan', 'lock not signed')
    return `Stage: Execution started · owner ${i.ownerId} · locked target ₹ ${Math.round(i.lock.targetSaving).toLocaleString('en-IN')}`
  })
}

async function execOwner(qa, api, ctx) {
  qa.section('One idea, six stages', 'Execution owner')
  await qa.as(P.imtiaz)
  await qa.step('Execution Hub', 'The HR execution is his: milestones, plan vs actual, health', () => qa.goto('/execution', 1800), () => qa.expectText(ctx.hrIdea))
  await qa.step('Open the execution', 'Idea 360 in Cost Optimisation with his action "Hand over for verification"', () => qa.goto(`/ideas/${ctx.hrIdea}`, 1500), () => qa.expectText('Hand over for verification'))
  await qa.step('Hand over for verification', 'Effective date = first MRN at the new rate; the idea moves to Verification and Finance is told', async () => {
    await qa.click('Hand over for verification', { exact: true, wait: 900 })
    await qa.setField('First MRN at the new price', today(), { dialog: true })
    await qa.click('Hand over', { exact: true, dialog: true, wait: 2200 })
  }, async () => { const s = await stageOf(api, P.imtiaz, ctx.hrIdea); must(s === 'Verification', `stage is ${s}`); return 'Stage: Verification' })
  await qa.step('Another department’s execution owner cannot', 'R&D execution owner gets 403 on this idea', null, async () => {
    const r = await api.cmd('rahul.jain@ambergroupindia.com', 'handOverForVerification', ctx.hrIdea, today(), {})
    must(r.status === 403, `status ${r.status}`); return `403 · ${r.body.error}`
  }, { shot: false })
}

async function finance(qa, api, ctx) {
  qa.section('One idea, six stages', 'Finance verifier')
  await qa.as(P.meera)
  await qa.step('My queue', 'Ideas handed over for verification wait for Finance', () => qa.goto('/queue', 1500), () => qa.expectText(ctx.hrIdea))
  await qa.step('Verify — before any MRN', 'The three checks are not met yet (no MRN at the new price) — Finance cannot verify, only return it', async () => {
    await qa.goto(`/ideas/${ctx.hrIdea}`, 1500)
    await qa.click('Verify savings', { exact: true, wait: 900 })
  }, async () => { const en = await qa.isEnabled('Verify', { dialog: true }); must(en === false, 'verify was allowed without MRN'); return 'Verify button disabled until MRN arrives' })
  await qa.page.keyboard.press('Escape'); await sleep(400)
  // a seeded idea whose MRN is validated and on target
  const cands = (await api.data(P.meera)).ideas.filter((i) => i.stage === 'Verification' && !i.verification?.verifiedAt && i.id !== ctx.hrIdea)
  let picked = null
  for (const c of cands.slice(0, 8)) {
    await qa.goto(`/ideas/${c.id}`, 1300)
    try { await qa.click('Verify savings', { exact: true, wait: 900 }) } catch { continue }
    if (await qa.isEnabled('Verify savings', { dialog: true })) { picked = c; break }
    await qa.page.keyboard.press('Escape'); await sleep(300)
  }
  await qa.step('Verify an idea whose MRN is in', 'MRN at the approved price ✓, Finance validated ✓, target achieved ✓ → Verify savings', async () => {
    must(picked, 'no idea ready for verification in the seed')
    ctx.verifiedIdea = picked.id; created(ctx, picked.id)
    await qa.type('[role="dialog"] textarea', 'Target met — MRN at the approved price every month since go-live')
    await qa.click('Verify savings', { exact: true, dialog: true, wait: 2000 })
  }, async () => { const i = await api.idea(P.meera, ctx.verifiedIdea); must(i.verification?.verifiedAt, 'not verified'); return `${ctx.verifiedIdea} verified by ${i.verification.verifiedBy}` })
  await qa.step('Savings proof', 'Part-wise realised savings from MRN against locked targets', () => qa.goto('/proof', 2000), () => qa.expectText('Savings'))
}

// ─── 3 · supplier portal ─────────────────────────────────────────────────────
async function supplier(qa, api, ctx) {
  qa.section('Supplier workspace', 'Supplier')
  await qa.as(P.rakesh)
  await qa.step('Supplier home', 'Only Sunrise Fasteners’ own ideas, invitations and KPI row — nothing about other vendors', null, () => qa.expectText('Rakesh'))
  await qa.step('What the supplier receives', 'Own vendor record only, no other vendors’ parts or prices, no passwords', null, async () => {
    const d = await api.data(P.rakesh)
    must(d.suppliers.length === 1, `${d.suppliers.length} vendors visible`)
    must(d.parts.every((p) => p.supplierCode === d.suppliers[0].code), 'another vendor’s part is visible')
    must(d.ideas.every((i) => i.isSupplierSubmission && i.supplierCode === d.suppliers[0].code), 'an Amber idea is visible')
    return `${d.ideas.length} own ideas · ${d.parts.length} own parts · 1 vendor record`
  }, { shot: false })
  await qa.step('Workshops', 'Invitations to workshops and campaigns with accept / decline', () => qa.goto('/workshops', 1500), () => qa.expectText('Workshop'))
  await qa.step('Submit a supplier idea', 'Open idea with a gain-share offer and validity', async () => {
    await qa.goto('/submit', 1800)
    await qa.click('Expand all', { wait: 600 })
    await qa.selectWhere('Select a commodity', 'FAS').catch(() => undefined)
    await qa.click('Choose a category', { wait: 400 })
    await qa.typeByPlaceholder('Search categories', 'Value engineering')
    await qa.click('Value engineering', { wait: 400 })
    await qa.click('Open idea', { wait: 400 })
    await qa.typeByPlaceholder('Idea name', 'Cold-forged flange bolts replace machined bolts on the outdoor unit')
    await qa.typeByPlaceholder('How it is done', 'M8 flange bolts machined from bar stock')
    await qa.typeByPlaceholder('What changes', 'Cold-forged M8 flange bolts, same drawing, 12% lighter')
    await qa.fill('Estimate for open ideas', '25')
    await qa.fill('Gain-share % offered to Amber', '20')
  }, async () => { const v = await qa.page.$eval('[placeholder*="Idea name"]', (e) => e.value); must(v.startsWith('Cold-forged'), 'title not filled'); return 'Form filled with gain-share 20%' })
  await qa.step('Submit for validation', 'Goes to the Sourcing team lead for the commodity; the supplier sees it in My Ideas', () => qa.click('Submit for validation', { wait: 2500 }), async () => {
    const i = (await api.data(P.rakesh)).ideas.find((x) => x.title.startsWith('Cold-forged flange bolts') && x.stage !== 'Draft')
    must(i, 'not submitted'); created(ctx, i.id); ctx.supplierIdea = i.id
    must(i.isSupplierSubmission, 'not marked as a supplier submission')
    return `${i.id} · supplier submission · ${i.stage}`
  })
}

// ─── 4 · campaigns ───────────────────────────────────────────────────────────
async function campaigns(qa, api, ctx) {
  qa.section('Campaigns & supplier outreach', 'Commodity lead')
  await qa.as(P.sanjay)
  await qa.step('Campaigns', 'Live, draft and closed campaigns with yield (ideas, ₹)', () => qa.goto('/campaigns', 1800), () => qa.expectText('Campaign'))
  const before = (await api.data(P.girish)).emails.length
  let draft = (await api.data(P.sanjay)).campaigns.find((c) => c.status === 'Draft')
  if (!draft) {
    const r = await api.cmd(P.sanjay, 'createCampaign', { name: 'Fastener weight-reduction sprint', type: 'Workshop', categoryId: 'MET', commodity: 'FAS', startDate: today(), endDate: plusDays(45), workshopDate: plusDays(14), venue: 'Rajpura plant, training hall', suppliers: ['V10021', 'V10022'], internalInvitees: ['u-buyer1'], description: 'Weight and cost reduction on fasteners — bring your ideas.', targetIdeas: 6, targetValue: 5e6 })
    draft = { id: r.body.result, name: 'Fastener weight-reduction sprint' }
  }
  ctx.campaign = draft.id
  await qa.step('Open a draft campaign', 'Details, invited suppliers and internal invitees', () => qa.goto(`/campaigns/${draft.id}`, 1800), () => qa.expectText(draft.name))
  await qa.step('Launch it', 'Status Live; invitation emails go to every invited supplier and colleague', () => qa.click('Launch', { wait: 2200 }), async () => {
    const d = await api.data(P.girish)
    const c = d.campaigns.find((x) => x.id === draft.id)
    must(c?.status === 'Live', `status ${c?.status}`)
    must(d.emails.length > before, 'no invitation emails')
    return `${d.emails.length - before} invitation emails written`
  })
}

// ─── 5 · Sourcing Head override, negative paths ─────────────────────────────
async function override(qa, api, ctx) {
  qa.section('Override and exceptions', 'Sourcing Head')
  await qa.as(P.girish)
  await qa.step('Overview', 'All ideas, all departments: the KPI row and both workspaces', null, () => qa.expectText('Cost Optimisation'))
  await qa.step('My queue — all pending', 'The Sourcing Head can see every open item across departments', async () => { await qa.goto('/queue', 1500); await qa.click('All pending', { wait: 900 }).catch(() => undefined) }, () => qa.expectText('pending'))
  const target = (await api.data(P.girish)).ideas.find((i) => i.stage === 'Approval' && i.evaluation?.dept === 'R&D' && i.approvals?.some((a) => !a.decision))
  await qa.step('Approve another department’s idea as override', 'Signs the lock and approves an R&D idea; the log says "acting as override"', async () => {
    must(target, 'no R&D idea waiting for approval')
    ctx.overrideIdea = target.id; created(ctx, target.id)
    await qa.goto(`/ideas/${target.id}`, 1500)
    await qa.click(target.lock ? 'Approval' : 'Sign lock & approve', { wait: 900 })
    if (!target.lock) {
      await qa.checkbox('[role="dialog"] input[type="checkbox"]', true)
      await qa.fill('Budget (₹ lakh)', '1', { dialog: true })
      await qa.setField('Savings start (first MRN)', plusDays(30), { dialog: true })
      await qa.sign()
      await qa.fill('Name', 'Girish Saluja', { dialog: true })
    }
    await qa.click(target.lock ? 'Approve' : 'Sign lock & approve', { dialog: true, wait: 2200 })
  }, async () => { const i = await api.idea(P.girish, ctx.overrideIdea); must(i.stage === 'Execution started', `stage ${i.stage}`); must(i.activity.some((a) => /override/i.test(a.action)), 'no override entry'); return `${ctx.overrideIdea} approved — logged as override` })

  qa.section('Override and exceptions', 'Team lead (R&D)')
  await qa.as(P.arvind)
  const feas = (await api.data(P.arvind)).ideas.find((i) => i.stage === 'Team feasibility check' && i.submitterId !== 'u-rd-tl')
  await qa.step('No-go at the team feasibility check', 'A reason is required; the idea is dropped for good and the submitter is told', async () => {
    must(feas, 'no R&D idea at feasibility'); ctx.droppedIdea = feas.id; created(ctx, feas.id)
    await qa.goto(`/ideas/${feas.id}`, 1500)
    await qa.click('Team feasibility check', { exact: true, wait: 900 })
    await qa.click('No-go', { exact: true, dialog: true, wait: 300 })
    await qa.type('[role="dialog"] textarea', 'Duplicate of an ongoing R&D project on the same bracket')
    await qa.click('No-go — drop idea', { dialog: true, wait: 2000 })
  }, async () => { const i = await api.idea(P.arvind, ctx.droppedIdea); must(i.bucket === 'Dropped', `bucket ${i.bucket}`); return `${ctx.droppedIdea} dropped — reason recorded` })

  // any idea at evaluation, sent back by that department's lead
  const all = await api.data(P.girish)
  const ev = all.ideas.find((i) => i.stage === 'Evaluation' && i.id !== ctx.hrIdea)
  const lead = ev && all.users.find((u) => u.roles.includes('deptlead') && u.department === ev.evaluation?.dept && u.active !== false)
  qa.section('Override and exceptions', `Department lead (${ev?.evaluation?.dept ?? '—'})`)
  if (lead) await qa.as(lead.email)
  await qa.step('Send back to the team feasibility check', 'Remarks required; the idea returns to stage 2 and its stage forms reopen', async () => {
    must(ev && lead, 'no idea at evaluation'); ctx.sentBackIdea = ev.id; created(ctx, ev.id)
    await qa.goto(`/ideas/${ev.id}`, 1500)
    await qa.click('Send back', { exact: true, wait: 800 })
    await qa.type('[role="dialog"] textarea', 'Baseline price does not match the LBP — please recheck with the buyer')
    await qa.click('Send back', { exact: true, dialog: true, wait: 2000 })
  }, async () => { const s = await stageOf(api, P.girish, ctx.sentBackIdea); must(s === 'Team feasibility check', `stage ${s}`); return `${ctx.sentBackIdea} back at Team feasibility check` })
}

// ─── 6 · administration ─────────────────────────────────────────────────────
async function admin(qa, api, ctx) {
  qa.section('Administration', 'Admin')
  await qa.as(P.nikhil)
  await qa.step('Admin & Masters', 'Users, role ladder, commodities, suppliers, SLA rules, email templates, settings', () => qa.goto('/admin', 1800), () => qa.expectText('Users'))
  await qa.step('Add a user — weak password refused', 'New HR employee; the password must have 8+ characters with letters and digits', async () => {
    await qa.click('Users', { wait: 900 })
    await qa.click('Add user', { wait: 900 })
    await qa.fill('Full name', 'Pooja Mehta', { dialog: true })
    await qa.fill('Employee ID', 'AEL-31001', { dialog: true })
    await qa.fill('Email', 'pooja.mehta@ambergroupindia.com', { dialog: true })
    await qa.fill('Designation', 'Executive, HR', { dialog: true })
    await qa.select(await qa.markField('Department', { dialog: true }), 'HR')
    await qa.fill('Password', 'short', { dialog: true })
    await qa.click('Add user', { dialog: true, wait: 600 })
  }, () => qa.expectText('Password needs at least 8 characters'))
  await qa.step('…with a proper password', 'Saved; the password is stored only as a hash and never sent back', async () => {
    await qa.fill('Password', 'Welcome2026', { dialog: true })
    await qa.click('Add user', { dialog: true, wait: 1800 })
  }, async () => { const u = (await api.data(P.nikhil)).users.find((x) => x.email === 'pooja.mehta@ambergroupindia.com'); must(u, 'user not saved'); must(!('password' in u), 'password sent back'); ctx.newUser = u.id; return `User ${u.id} created · no password in the API` })
  await qa.step('The new person signs in', 'Pooja signs in with her password and sees the employee home', () => qa.as('pooja.mehta@ambergroupindia.com', 'Welcome2026'), () => qa.expectText('Pooja'))
  await qa.as(P.nikhil)
  await qa.step('Deactivate the user', 'She is signed out everywhere and cannot sign in again', async () => {
    await qa.goto('/admin', 1500)
    must(ctx.newUser, 'no user from the previous step')
    const r = await api.cmd(P.nikhil, 'upsert', 'users', { ...(await api.data(P.nikhil)).users.find((x) => x.id === ctx.newUser), active: false })
    must(r.status === 200, `status ${r.status}`)
  }, async () => {
    const r = await fetch(`${qa.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'pooja.mehta@ambergroupindia.com', password: 'Welcome2026' }) })
    must(r.status === 403, `login status ${r.status}`); return 'Sign-in refused: account deactivated'
  })
  await qa.step('Role ladder', 'Who does what in each of the 8 departments', () => qa.click('Role ladder', { wait: 1000 }), () => qa.expectText('who acts at each stage'))
}

// ─── 7 · what every role sees ───────────────────────────────────────────────
async function dashboards(qa, api) {
  for (const [email, role] of Object.entries(ROLE_OF)) {
    qa.section('What each role sees', role)
    await qa.as(email)
    const d = await api.data(email)
    await qa.step('Home', `${role}: KPI row and workspaces · ${d.ideas.length} ideas visible`, null, () => qa.expectText('Good'))
    await qa.step('Innovation Network dashboard', 'The same KPI row; queue, sources and analytics for this role', async () => { await qa.click('Innovation Network', { wait: 1800 }) }, () => qa.expectText('Pipeline'))
  }
}

// ─── 8 · the access matrix (server policy, changes nothing) ─────────────────
async function accessMatrix(qa, api, ctx) {
  qa.section('Access checks (server)', 'Everyone')
  const head = await api.data(P.girish)
  const pick = (stage) => head.ideas.find((i) => i.stage === stage && (i.evaluation?.dept ?? 'x') === 'HR') ?? head.ideas.find((i) => i.stage === stage && i.department === 'HR')
  const at = {
    feasibility: pick('Team feasibility check'), evaluation: pick('Evaluation'), approval: pick('Approval'),
    execution: head.ideas.find((i) => i.stage === 'Execution started' && i.ownerId === 'u-hr-exec'),
    verification: head.ideas.find((i) => i.stage === 'Verification' && !i.verification?.verifiedAt),
  }
  const people = [P.simran, P.varun, P.neelam, P.lata, P.imtiaz, P.meera, P.girish, P.nikhil, P.rajesh, P.kavita, P.sanjay, P.rakesh, P.sameer]
  const cases = [
    ['Team feasibility check (HR idea)', 'recordFeasibility', at.feasibility, [P.varun, P.girish, P.nikhil]],
    ['HR evaluation decision', 'recordEvaluation', at.evaluation, [P.neelam, P.girish, P.nikhil]],
    ['HR department approval', 'approve', at.approval, [P.lata, P.girish, P.nikhil]],
    ['Hand over an HR execution', 'handOverForVerification', at.execution, [P.imtiaz, P.girish, P.nikhil]],
    ['Verify savings', 'verifyIdea', at.verification, [P.meera, P.girish, P.nikhil]],
    ['Create a campaign', 'createCampaign', null, [P.girish, P.nikhil, P.kavita, P.sanjay]],
    ['Validate realised savings', 'financeValidate', null, [P.meera, P.girish, P.nikhil]],
    ['Add or change users', 'upsert', null, [P.nikhil]],
  ]
  const rows = []
  for (const [label, cmd, idea, allowed] of cases) {
    if (idea === undefined) { rows.push({ action: label, idea: '—', person: '—', expected: '—', actual: 'no HR idea at this stage in the seed', reason: '', status: 'SKIP' }); continue }
    for (const who of people) {
      // a complete, valid request — only the person decides; nothing is changed (dry run)
      const args = idea ? [idea.id] : cmd === 'upsert' ? ['users', { id: 'u-qa-check', name: 'QA Check', email: 'qa.check@ambergroupindia.com', employeeId: 'AEL-QA-1', department: 'HR', roles: ['submitter'], password: 'Strong2026' }] : cmd === 'financeValidate' ? [[]] : [{}]
      const c = api.cookies.get(who) ?? (await api.login(who))
      const r = await fetch(`${qa.base}/api/authorise/${cmd}`, { method: 'POST', headers: { cookie: c, 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) }).then((x) => x.json())
      const expected = allowed.includes(who)
      rows.push({ action: label, idea: idea?.id ?? '—', person: ROLE_OF[who] ?? who, expected: expected ? 'Allowed' : 'Refused', actual: r.allowed ? 'Allowed' : 'Refused', reason: r.reason ?? '', status: expected === !!r.allowed ? 'PASS' : 'FAIL' })
    }
  }
  ctx.access = rows
  const fails = rows.filter((r) => r.status === 'FAIL')
  await qa.step(`Policy matrix — ${cases.length} actions × ${people.length} people`, 'Exactly the ladder’s people (plus Sourcing Head / Admin override) may act; everyone else is refused', null, () => { must(!fails.length, `${fails.length} mismatches: ${fails.slice(0, 3).map((f) => `${f.person} ${f.action} → ${f.actual}`).join('; ')}`); return `${rows.filter((r) => r.status === 'PASS').length} checks, all as expected` }, { shot: false })
  for (const who of people) {
    const d = await api.data(who)
    const ok = d.users.every((u) => !u.password)
    ;(ctx.visibility ??= []).push({ person: ROLE_OF[who], ideas: d.ideas.length, emails: d.emails.length, suppliers: d.suppliers.length, parts: d.parts.length, passwordsSent: ok ? 'none' : 'LEAK' })
  }
}

export const JOURNEYS = [
  { key: 'signin', title: 'Signing in', run: signIn },
  { key: 'submit', title: 'Employee submits an idea', run: employeeSubmits },
  { key: 'teamlead', title: 'Team feasibility check', run: teamLead },
  { key: 'deptlead', title: 'Department evaluation + supplier capability request', run: deptLead },
  { key: 'depthead', title: 'Department approval with budget & timeline lock', run: deptHead },
  { key: 'exec', title: 'Execution and hand-over', run: execOwner },
  { key: 'finance', title: 'Finance verification', run: finance },
  { key: 'supplier', title: 'Supplier workspace', run: supplier },
  { key: 'campaigns', title: 'Campaigns', run: campaigns },
  { key: 'override', title: 'Override, drop and send back', run: override },
  { key: 'admin', title: 'Administration', run: admin },
  { key: 'dashboards', title: 'What each role sees', run: dashboards },
  { key: 'access', title: 'Access checks', run: accessMatrix },
]
