#!/usr/bin/env node
// Turn qa-output/results.json into
//   qa-output/COIN_QA_Workbook.xlsx — one sheet per role (every step, expected vs actual, PASS / FAIL, screenshot),
//                                     plus emails, supplier requests, notifications, access matrix, issues, hard-coding audit
//   qa-output/COIN_User_Story.pdf   — how a person signs in and how an idea travels, told with the screenshots
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ExcelJS from 'exceljs'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'qa-output')
const R = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8'))
const started = new Date(R.started)
const fmt = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const userName = (id) => R.users?.find((u) => u.id === id)?.name ?? id

// what was found while building and testing the backend, and how it was fixed
const FINDINGS = [
  ['Security', 'A supplier could see Amber’s internal ideas that named it as the supplier (e.g. negotiation ideas about that vendor).', 'Suppliers now see only ideas submitted under their own vendor code — in the screens and in every API payload.'],
  ['Security', 'Passwords were stored in plain text in every user record and sent to the browser.', 'Passwords are scrypt hashes in the database; no password or hash ever leaves the server.'],
  ['Security', 'The role ladder was enforced only by the screens; any browser could change any idea.', 'Every action is a server command checked against the ladder (policies.ts) before anything changes; refusals are audited.'],
  ['Security', 'The session timeout ran only in the browser.', 'Server sessions in an httpOnly cookie with absolute and idle expiry; deactivating a user or changing a password signs them out everywhere.'],
  ['Security', 'Sign-in limit counted successful sign-ins per address — an office behind one address locked itself out.', 'Only failed attempts count: 10 per account and address, 100 per address, per 10 minutes.'],
  ['Admin', 'The Add-user form had no password field; new accounts got the hard-coded password coin@2026 (or none with the server).', 'Password field: required for new users (8+ characters, letters and digits); blank keeps the current one.'],
  ['Admin', 'A malformed Admin change (no id / email / roles) crashed the server with a 500.', 'The policy refuses it with a clear reason (missing field, duplicate email or employee ID, unknown list).'],
  ['Data', 'Screens wrote some data straight into the browser store (milestone notes, campaign invites, backup import) — those changes would never reach a server.', 'They are workflow actions now, run and saved by the server like every other change.'],
  ['Data', 'Undo restored data only in the browser.', 'Undo is a server command that restores the rows a person’s own action changed, unless someone changed them since.'],
  ['Data', 'Submit Idea predicted the next COIN number from the ideas the person can see — wrong once each person sees only their own.', 'The server issues the number; the form shows COIN-FY27-FAC-···· until submit.'],
  ['Data', 'Campaign numbers were “count + 1” and would repeat after a campaign was deleted.', 'Next free number after the highest one.'],
  ['Data', 'Attachments were stored as text inside each idea.', 'Files go to the files table and are served only to people who can see the idea.'],
  ['Hard-coding', 'Notifications went to fixed user ids (u-fin, u-mgmt, u-head) and new drafts to buyer u-buyer1.', 'Recipients come from roles and the commodity master.'],
  ['Hard-coding', 'Supplier portal URL, app URL in emailed links and the default filter year were fixed in the code.', 'SUPPLIER_PORTAL_URL / APP_URL in .env; the filter year follows the organisation’s current FY.'],
  ['Resilience', 'The error screen offered “Reset demo data”.', 'With the server it offers Reload; data is never reset from a browser.'],
  ['Concurrency', 'Two people acting on the same idea at the same moment could overwrite each other.', 'Commands of one organisation run one at a time (database advisory lock); the second gets a clear refusal.'],
]
const HARDCODING = [
  ['src/store/useStore.ts → engine.ts', "buyerId: 'u-buyer1' on every new draft", 'Buyer of the chosen commodity (commodity master)'],
  ['engine.ts handOverForVerification', "fallback recipient 'u-fin'", 'Every active Finance user'],
  ['engine.ts runRealisation', "'Savings to validate' sent to 'u-fin'", 'Every active Finance user'],
  ['engine.ts sendMonthlyReport', "['u-mgmt', 'u-head'] and the text “sent manually by Sourcing Head”", 'Users with Management / Sourcing Head roles; the sender’s real name'],
  ['engine.ts bookFyClosure', "['u-head', 'u-fin', 'u-mgmt']", 'Users with those roles'],
  ['SubmitIdea.tsx', "users.find(u => u.id === 'u-head')", 'Removed (unused)'],
  ['engine.ts saveDraft', "categoryId 'MET', commodity 'FAS', lever 'L01' defaults", 'First entries of the masters'],
  ['admin/masters.tsx', "new user password 'coin@2026'", 'Admin sets a password'],
  ['engine.ts supplierPortalLink', 'https://supplier-portal.coin.amber', 'SUPPLIER_PORTAL_URL / VITE_SUPPLIER_PORTAL_URL'],
  ['engine.ts sendSupplierCheck', 'window.location.origin in the emailed link', 'APP_URL on the server'],
  ['useStore.ts DEFAULT_FILTERS', "fy: 'FY27'", 'The organisation’s current FY'],
  ['useStore.ts createCampaign', 'CMP-<count + 1>', 'Next free number'],
  ['.env (local only)', 'SEED_PASSWORD=coin@2026 for the 55 demo accounts; DEMO_LOGIN=true', 'Set DEMO_LOGIN=false and real passwords before any real use'],
]

// ─── Excel ───────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook()
wb.creator = 'COIN QA'; wb.created = new Date()
const BRAND = 'FF3730A3', PASS = 'FF047857', FAIL = 'FFB91C1C'
const head = (ws, cols) => {
  ws.columns = cols
  const r = ws.getRow(1)
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }; r.height = 22
  r.alignment = { vertical: 'middle', wrapText: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}
const wrap = (row) => { row.alignment = { vertical: 'top', wrapText: true } }
const statusCell = (c, v) => { c.value = v; c.font = { bold: true, color: { argb: v === 'PASS' ? PASS : v === 'FAIL' ? FAIL : 'FF6B7280' } } }
const safeName = (s, used) => { let n = s.replace(/[\\/?*[\]:]/g, '-').slice(0, 31); let k = 2; while (used.has(n)) n = `${s.slice(0, 27)} (${k++})`; used.add(n); return n }

const steps = R.steps
const passN = steps.filter((s) => s.status === 'PASS').length
const sum = wb.addWorksheet('Summary')
sum.columns = [{ width: 34 }, { width: 90 }]
const line = (a, b, bold) => { const r = sum.addRow([a, b]); if (bold) r.font = { bold: true }; wrap(r); return r }
sum.addRow(['COIN — QA workbook']).font = { bold: true, size: 16, color: { argb: BRAND } }
line('What was tested', 'Every role through the real screens, on the real API server and PostgreSQL database (not the browser demo). Each step is checked against what the database holds.')
line('Run', `${fmt(R.started)} → ${fmt(R.finished)}`)
line('Server', `${R.base} · fresh copy of the seed data (55 accounts, 137 ideas) in the QA database`)
line('Result', `${passN} of ${steps.length} steps passed · ${steps.length - passN} failed · ${R.consoleErrors.length} browser errors · ${R.serverErrors.length} server errors`, true)
line('Access checks', R.ctx.access ? `${R.ctx.access.filter((x) => x.status === 'PASS').length} of ${R.ctx.access.filter((x) => x.status !== 'SKIP').length} role × action checks as expected` : '—', true)
line('How to run again', 'npm run db:start → npm run qa (resets the QA database, builds, starts its own server, drives Chrome) → npm run qa:report')
sum.addRow([])
sum.addRow(['Journey', 'Steps passed']).font = { bold: true }
for (const j of [...new Set(steps.map((s) => s.journey))]) {
  const js = steps.filter((s) => s.journey === j)
  const r = sum.addRow([j, `${js.filter((s) => s.status === 'PASS').length} / ${js.length}`])
  if (js.some((s) => s.status === 'FAIL')) r.getCell(2).font = { color: { argb: FAIL }, bold: true }
}
sum.addRow([])
sum.addRow(['Sheets', 'One sheet per role with every step and its screenshot · Idea journeys · Emails · Supplier requests · Notifications · Audit trail · Access matrix · What each role receives · Issues found & fixed · Hard-coding audit']).alignment = { wrapText: true }

// one sheet per role
const used = new Set(['Summary'])
const roles = [...new Set(steps.map((s) => s.role))]
const IMG_W = 420, IMG_H = Math.round(IMG_W * 864 / 1536)
for (const role of roles) {
  const ws = wb.addWorksheet(safeName(role, used))
  head(ws, [{ header: '#', width: 5 }, { header: 'Journey', width: 22 }, { header: 'What the person does', width: 30 }, { header: 'Expected', width: 40 }, { header: 'Actual', width: 40 }, { header: 'Result', width: 9 }, { header: 'Screenshot', width: 62 }, { header: 'Page', width: 26 }])
  let k = 0
  for (const s of steps.filter((x) => x.role === role)) {
    const row = ws.addRow([++k, s.journey, s.action, s.expected, s.actual, '', s.shot ?? '—', s.url])
    wrap(row); statusCell(row.getCell(6), s.status)
    if (s.shot && fs.existsSync(path.join(OUT, 'shots', s.shot))) {
      row.height = IMG_H * 0.75 + 6
      const id = wb.addImage({ filename: path.join(OUT, 'shots', s.shot), extension: 'jpeg' })
      ws.addImage(id, { tl: { col: 6.05, row: row.number - 1 + 0.05 }, ext: { width: IMG_W, height: IMG_H } })
      row.getCell(7).value = { text: s.shot, hyperlink: `shots/${s.shot}` }
      row.getCell(7).alignment = { vertical: 'bottom' }
    }
  }
}

// idea journeys
const ij = wb.addWorksheet('Idea journeys')
head(ij, [{ header: 'Idea', width: 22 }, { header: 'Title', width: 44 }, { header: 'Department', width: 12 }, { header: 'Stage', width: 22 }, { header: 'Entered', width: 18 }, { header: 'Left', width: 18 }, { header: 'By', width: 22 }, { header: 'Action / remarks', width: 60 }])
for (const i of R.ideas) {
  for (const h of i.stageHistory ?? []) wrap(ij.addRow([i.id, i.title, i.department, h.stage, h.enteredAt ? fmt(h.enteredAt) : '', h.exitedAt ? fmt(h.exitedAt) : '', h.by ?? '', [h.action, h.remarks].filter(Boolean).join(' — ')]))
  ij.addRow([])
}

// emails written during the run
const runEmails = R.emails.filter((e) => new Date(e.at) >= started)
const em = wb.addWorksheet('Emails')
head(em, [{ header: 'When', width: 18 }, { header: 'To', width: 40 }, { header: 'Subject', width: 50 }, { header: 'Template', width: 26 }, { header: 'Body', width: 90 }])
for (const e of runEmails) wrap(em.addRow([fmt(e.at), e.to.join(', '), e.subject, e.template ?? '', e.body]))

// supplier requests: capability requests + invitations and outreach
const sr = wb.addWorksheet('Supplier requests')
head(sr, [{ header: 'Kind', width: 24 }, { header: 'Idea / campaign', width: 22 }, { header: 'Supplier', width: 30 }, { header: 'Sent to', width: 34 }, { header: 'Status', width: 14 }, { header: 'What was asked / answered', width: 90 }])
for (const i of R.ideas) {
  const sc = i.evaluation?.supplier
  if (!sc || !sc.sentAt) continue
  const resp = sc.response ? `Answer from ${sc.response.contactName}: can supply ${sc.response.canSupply}, meets spec ${sc.response.meetsSpec}${sc.response.capacityPerMonth ? `, capacity ${sc.response.capacityPerMonth}` : ''}${sc.response.leadTimeDays ? `, lead time ${sc.response.leadTimeDays} d` : ''}${sc.response.indicativePrice ? `, price ₹ ${sc.response.indicativePrice}` : ''}` : 'No answer yet'
  wrap(sr.addRow(['Capability request (stage 3)', i.id, sc.supplierName, sc.email, sc.status, `Item: ${sc.item}\nSpecification: ${sc.spec}\nRequired by: ${sc.requiredBy}\nForm link token: ${sc.token}\n${resp}`]))
}
for (const e of runEmails.filter((x) => /invitation|outreach/i.test(`${x.template} ${x.subject}`))) wrap(sr.addRow([e.template ?? 'Invitation', e.subject.replace(/^COIN · /, ''), '', e.to.join(', '), 'Sent', e.body]))

// notifications during the run
const nt = wb.addWorksheet('Notifications')
head(nt, [{ header: 'When', width: 18 }, { header: 'To', width: 24 }, { header: 'Title', width: 40 }, { header: 'Detail', width: 60 }, { header: 'Channel', width: 16 }])
for (const n of R.notifications.filter((x) => new Date(x.at) >= started)) wrap(nt.addRow([fmt(n.at), userName(n.userId), n.title, n.body, n.channel]))

// every server action during the run, accepted or refused (command_log)
const at = wb.addWorksheet('Audit trail')
head(at, [{ header: 'When', width: 18 }, { header: 'Who', width: 26 }, { header: 'Action', width: 28 }, { header: 'Result', width: 10 }, { header: 'Reason (when refused)', width: 70 }])
for (const c of R.commands ?? []) { const r = at.addRow([fmt(c.at), c.actor_id === 'system' ? 'Supplier form (no login)' : userName(c.actor_id), c.command, c.ok ? 'Done' : 'Refused', c.error ?? '']); wrap(r); r.getCell(4).font = { bold: true, color: { argb: c.ok ? PASS : 'FFB45309' } } }

// access matrix
const am = wb.addWorksheet('Access matrix')
head(am, [{ header: 'Action', width: 34 }, { header: 'Idea', width: 22 }, { header: 'Person', width: 26 }, { header: 'Expected', width: 11 }, { header: 'Server said', width: 11 }, { header: 'Result', width: 9 }, { header: 'Reason given', width: 70 }])
for (const a of R.ctx.access ?? []) { const r = am.addRow([a.action, a.idea, a.person, a.expected, a.actual, '', a.reason]); wrap(r); statusCell(r.getCell(6), a.status) }

const vis = wb.addWorksheet('What each role receives')
head(vis, [{ header: 'Person', width: 28 }, { header: 'Ideas', width: 10 }, { header: 'Emails', width: 10 }, { header: 'Vendors', width: 10 }, { header: 'Parts', width: 10 }, { header: 'Passwords sent', width: 16 }])
for (const v of R.ctx.visibility ?? []) vis.addRow([v.person, v.ideas, v.emails, v.suppliers, v.parts, v.passwordsSent])

const iss = wb.addWorksheet('Issues found & fixed')
head(iss, [{ header: 'Area', width: 14 }, { header: 'What was wrong', width: 70 }, { header: 'How it is fixed', width: 80 }, { header: 'Status', width: 10 }])
for (const f of FINDINGS) { const r = iss.addRow([...f, 'Fixed']); wrap(r); r.getCell(4).font = { bold: true, color: { argb: PASS } } }
for (const q of R.issues) { const r = iss.addRow(['QA run', `${q.role} · ${q.step}`, q.problem, 'Open']); wrap(r); r.getCell(4).font = { bold: true, color: { argb: FAIL } } }
for (const c of R.consoleErrors) { const r = iss.addRow(['Browser error', `${c.role} · ${c.url}`, c.text, 'Open']); wrap(r) }

const hc = wb.addWorksheet('Hard-coding audit')
head(hc, [{ header: 'Where', width: 36 }, { header: 'Was hard-coded', width: 60 }, { header: 'Now', width: 60 }])
for (const h of HARDCODING) wrap(hc.addRow(h))

const xlsx = path.join(OUT, 'COIN_QA_Workbook.xlsx')
await wb.xlsx.writeFile(xlsx)
console.log('workbook', path.relative(ROOT, xlsx))

// ─── PDF user story ──────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const CHAPTERS = [
  ['Signing in', 'How a person gets into COIN: email or employee ID and password, a session the server keeps, signing out, and the one-click demo accounts.'],
  ['One idea, six stages', 'An HR employee’s idea — re-bidding the Noida canteen contract — travels the department ladder: team lead, department lead (with a supplier capability request answered by the supplier on a secure form), department head, execution owner and Finance.'],
  ['Supplier workspace', 'A supplier signs in to its own workspace, sees only its own ideas and invitations, and submits an idea with a gain-share offer.'],
  ['Campaigns & supplier outreach', 'A commodity lead launches a campaign; invitations are emailed to every invited supplier and colleague.'],
  ['Override and exceptions', 'The Sourcing Head approves another department’s idea as override; a team lead says No-go; a department lead sends an idea back.'],
  ['Administration', 'Admin adds a person with a password, the person signs in, and is signed out everywhere when deactivated.'],
  ['What each role sees', 'Every role’s home and Innovation Network dashboard — the same KPI row everywhere, only the ideas that role may see.'],
]
const stepHtml = (s) => `
  <section class="step">
    <div class="meta"><span class="role">${esc(s.role)}</span><span class="${s.status === 'PASS' ? 'ok' : 'bad'}">${s.status}</span></div>
    <h3>${esc(s.action)}</h3>
    <p class="exp">${esc(s.expected)}</p>
    <p class="act">Result: ${esc(s.actual)}</p>
    ${s.shot ? `<img src="shots/${esc(s.shot)}">` : ''}
  </section>`
const emailHtml = R.ctx.capabilityEmail ? `
  <section class="step"><div class="meta"><span class="role">Email sent by COIN</span></div><h3>${esc(R.ctx.capabilityEmail.subject)}</h3>
  <p class="exp">To: ${esc(R.ctx.capabilityEmail.to.join(', '))}</p><pre>${esc(R.ctx.capabilityEmail.body)}</pre></section>` : ''
const accessRows = (R.ctx.access ?? []).filter((a) => a.status !== 'SKIP')
const html = `<!doctype html><html><head><meta charset="utf-8"><title>COIN — user story</title><style>
  @page { size: A4 landscape; margin: 12mm 14mm }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 11pt }
  .cover { height: 170mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always }
  .cover h1 { font-size: 34pt; color: #3730a3; margin: 0 } .cover p { font-size: 13pt; color: #4b5563; max-width: 200mm }
  .toc li { margin: 4px 0; font-size: 12pt }
  h2 { color: #3730a3; font-size: 20pt; margin: 0 0 4px; page-break-before: always } .intro { color: #4b5563; margin: 0 0 10px; font-size: 11.5pt }
  .step { page-break-inside: avoid; margin: 0 0 14px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px }
  .step h3 { margin: 4px 0 2px; font-size: 13pt } .exp { margin: 2px 0; color: #374151 } .act { margin: 2px 0 6px; color: #6b7280; font-size: 10pt }
  .meta { display: flex; gap: 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: .08em }
  .role { color: #3730a3; font-weight: 700 } .ok { color: #047857; font-weight: 700 } .bad { color: #b91c1c; font-weight: 700 }
  img { width: 100%; max-height: 118mm; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 6px }
  pre { white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; font-size: 9.5pt }
  table { border-collapse: collapse; width: 100%; font-size: 9pt } td, th { border: 1px solid #e5e7eb; padding: 3px 6px; text-align: left } th { background: #eef2ff }
</style></head><body>
<div class="cover"><h1>COIN — how it works</h1><p>Cost Optimisation and Innovation Network for Amber Enterprises · user story of the full product on its own server and database · ${fmt(R.finished)}</p>
<p>${passN} of ${steps.length} tested steps passed. Every screenshot below is a real screen from this run.</p>
<ol class="toc">${CHAPTERS.map(([t]) => `<li>${esc(t)}</li>`).join('')}<li>Who may do what (server checks)</li></ol></div>
${CHAPTERS.map(([t, intro]) => `<h2>${esc(t)}</h2><p class="intro">${esc(intro)}</p>${steps.filter((s) => s.journey === t && (s.shot || t !== 'What each role sees')).map(stepHtml).join('')}${t === 'One idea, six stages' ? emailHtml : ''}`).join('')}
<h2>Who may do what (server checks)</h2><p class="intro">Each action was asked of the server for every person below. Only the department ladder’s person for that stage — plus the Sourcing Head and Admin as override — is allowed; everyone else is refused with a reason. Nothing is changed by these checks.</p>
<table><tr><th>Action</th><th>Person</th><th>Expected</th><th>Server</th><th>Result</th></tr>${accessRows.map((a) => `<tr><td>${esc(a.action)}</td><td>${esc(a.person)}</td><td>${a.expected}</td><td>${a.actual}</td><td class="${a.status === 'PASS' ? 'ok' : 'bad'}">${a.status}</td></tr>`).join('')}</table>
</body></html>`
const htmlFile = path.join(OUT, 'user-story.html')
fs.writeFileSync(htmlFile, html)
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p))
const b = await puppeteer.launch({ executablePath: CHROME, headless: true })
const pg = await b.newPage()
await pg.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle0' })
const pdf = path.join(OUT, 'COIN_User_Story.pdf')
await pg.pdf({ path: pdf, format: 'A4', landscape: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#9ca3af">COIN user story · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>', margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' } })
await b.close()
console.log('pdf', path.relative(ROOT, pdf))
