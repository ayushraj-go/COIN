#!/usr/bin/env node
// QA run:  node e2e/run.mjs [--skip-build] [--only=name,name] [--keep-server]
//   1. resets the QA database (TEST_DATABASE_URL) to the seed
//   2. builds the web app in api mode and starts its own API server (serving the app) on QA_PORT (8790)
//   3. drives every role's journey in Chrome, checking each step against the API
//   4. writes qa-output/results.json (+ screenshots) — e2e/report.mjs turns it into the workbook and the PDF
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Qa, Api, sleep } from './lib.mjs'
import { JOURNEYS } from './journeys.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.loadEnvFile?.(path.join(ROOT, '.env'))
const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const PORT = Number(process.env.QA_PORT || 8790)
const BASE = `http://localhost:${PORT}`
const OUT = path.join(ROOT, 'qa-output')
// its own database, so the QA run and the API tests (coin_test) never touch each other's data
const DB = process.env.QA_DATABASE_URL || process.env.TEST_DATABASE_URL
if (!DB) { console.error('QA_DATABASE_URL is not set (.env)'); process.exit(1) }

const run = (cmd, a, env = {}) => {
  const r = spawnSync(cmd, a, { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')} failed`)
}

console.log('▸ resetting the QA database')
run('npx', ['tsx', 'server/src/cli.ts', 'reset'], { DATABASE_URL: DB })
if (!args.includes('--skip-build')) {
  console.log('▸ building the web app (api mode)')
  run('npx', ['vite', 'build', '--logLevel', 'warn'], { VITE_DATA_MODE: 'api' })
}

console.log(`▸ starting the API on ${BASE}`)
const server = spawn('npx', ['tsx', 'server/src/main.ts'], {
  cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, DATABASE_URL: DB, PORT: String(PORT), HOST: '127.0.0.1', APP_URL: BASE, SERVE_STATIC: 'true', DEMO_LOGIN: 'true', LOG_LEVEL: 'warn', EMAIL_DRIVER: 'outbox' },
})
const serverLog = []
server.stdout.on('data', (d) => serverLog.push(String(d)))
server.stderr.on('data', (d) => serverLog.push(String(d)))
const stopServer = () => { try { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill('SIGTERM') } catch { /* gone */ } }
process.on('exit', stopServer)
for (let k = 0; k < 120; k++) {
  try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break } catch { /* not up yet */ }
  await sleep(500)
}

fs.rmSync(OUT, { recursive: true, force: true })
const qa = new Qa({ base: BASE, api: BASE, outDir: OUT })
const api = new Api(BASE)
const ctx = { started: new Date().toISOString(), base: BASE }
await qa.start()
try {
  for (const j of JOURNEYS) {
    if (only && !only.includes(j.key)) continue
    console.log(`\n━━ ${j.title}`)
    try { await j.run(qa, api, ctx) } catch (e) {
      qa.issues.push({ journey: j.title, role: qa.role, step: '(journey stopped)', problem: String(e?.message ?? e) })
      console.log(`✗ journey stopped: ${e?.message ?? e}`)
    }
  }
} finally {
  await qa.stop()
}

// what the database holds after the run (as the Sourcing Head, who sees everything)
const head = await api.data('girish.saluja@ambergroupindia.com')
const results = {
  started: ctx.started, finished: new Date().toISOString(), base: BASE, ctx,
  steps: qa.steps, issues: qa.issues, consoleErrors: qa.consoleErrors,
  emails: head.emails, notifications: head.notifications.slice(0, 400),
  users: head.users.map((u) => ({ id: u.id, name: u.name, roles: u.roles, department: u.department, email: u.email })),
  ideas: head.ideas.filter((i) => (ctx.createdIdeas ?? []).includes(i.id)),
  serverErrors: serverLog.join('').split('\n').filter((l) => /"level":(50|60)/.test(l)).slice(0, 50),
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
const pass = qa.steps.filter((s) => s.status === 'PASS').length
console.log(`\n▸ ${pass}/${qa.steps.length} steps passed · ${qa.issues.length} issues · ${qa.consoleErrors.length} console errors → ${path.relative(ROOT, OUT)}`)
if (args.includes('--keep-server')) { console.log(`server still running on ${BASE} (Ctrl+C to stop)`); await new Promise(() => {}) }
stopServer()
process.exit(0)
