#!/usr/bin/env node
// Local PostgreSQL for COIN — a project-local cluster in .pgdata (git-ignored), separate from any system install.
//   node scripts/db.mjs init     create the cluster, the `coin` role and the `coin` + `coin_test` databases
//   node scripts/db.mjs start    start it on PGPORT (default 5433)
//   node scripts/db.mjs stop     stop it
//   node scripts/db.mjs status   is it running?
//   node scripts/db.mjs psql     open psql on the app database
// Settings come from .env: PGPORT, PG_BIN (folder with pg_ctl / initdb / psql), DATABASE_URL (user + password).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'))

const DATA = path.join(root, '.pgdata')
const PORT = process.env.PGPORT || '5433'
const url = new URL(process.env.DATABASE_URL || `postgres://coin:coin@localhost:${PORT}/coin`)
const USER = decodeURIComponent(url.username), PASS = decodeURIComponent(url.password), DB = url.pathname.slice(1)
const TEST_DB = process.env.TEST_DATABASE_URL ? new URL(process.env.TEST_DATABASE_URL).pathname.slice(1) : `${DB}_test`
const QA_DB = process.env.QA_DATABASE_URL ? new URL(process.env.QA_DATABASE_URL).pathname.slice(1) : `${DB}_qa`

function findBin() {
  const exe = os.platform() === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'
  const candidates = [process.env.PG_BIN, ...['18', '17', '16', '15'].map((v) => `C:\\Program Files\\PostgreSQL\\${v}\\bin`), '/usr/lib/postgresql/18/bin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']
  for (const c of candidates) if (c && fs.existsSync(path.join(c, exe))) return c
  throw new Error('PostgreSQL binaries not found — set PG_BIN in .env to the folder that contains pg_ctl')
}
const BIN = findBin()
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(path.join(BIN, cmd), args, { stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8', env: { ...process.env, PGPASSWORD: PASS }, ...opts })
  if (r.error) throw r.error
  return r
}
const running = () => run('pg_ctl', ['-D', DATA, 'status'], { capture: true }).status === 0
const psql = (db, sql) => run('psql', ['-h', 'localhost', '-p', PORT, '-U', USER, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql])

function start() {
  if (running()) { console.log(`PostgreSQL already running on port ${PORT}`); return }
  // stdio must not be inherited: the server process would keep the pipes open and this script would never return
  const r = run('pg_ctl', ['-D', DATA, '-o', `-p ${PORT} -c listen_addresses=localhost`, '-l', path.join(DATA, 'server.log'), '-w', 'start'], { stdio: 'ignore' })
  if (r.status !== 0) process.exit(r.status ?? 1)
  console.log(`PostgreSQL started on localhost:${PORT} (data in .pgdata)`)
}

const cmd = process.argv[2] ?? 'status'
if (cmd === 'init') {
  if (fs.existsSync(path.join(DATA, 'PG_VERSION'))) { console.log('.pgdata already exists — nothing to do (use "reset" to recreate)'); start() }
  else {
    const pwfile = path.join(os.tmpdir(), `coin-pw-${process.pid}`)
    fs.writeFileSync(pwfile, PASS)
    try {
      const r = run('initdb', ['-D', DATA, '-U', USER, '--pwfile', pwfile, '--auth=scram-sha-256', '--encoding=UTF8', '--no-locale'])
      if (r.status !== 0) process.exit(r.status ?? 1)
    } finally { fs.rmSync(pwfile, { force: true }) }
    start()
    for (const d of [DB, TEST_DB, QA_DB]) psql('postgres', `CREATE DATABASE "${d}" OWNER "${USER}"`)
    console.log(`Created databases ${DB}, ${TEST_DB} and ${QA_DB} owned by ${USER}`)
  }
} else if (cmd === 'start') start()
else if (cmd === 'stop') { if (running()) run('pg_ctl', ['-D', DATA, '-m', 'fast', '-w', 'stop']); else console.log('PostgreSQL is not running') }
else if (cmd === 'status') console.log(running() ? `PostgreSQL running on localhost:${PORT}` : 'PostgreSQL is not running')
else if (cmd === 'psql') run('psql', ['-h', 'localhost', '-p', PORT, '-U', USER, '-d', DB])
// add any database named in .env that the cluster does not have yet (e.g. coin_qa on an older cluster)
else if (cmd === 'ensure') {
  for (const d of [DB, TEST_DB, QA_DB]) {
    const r = run('psql', ['-h', 'localhost', '-p', PORT, '-U', USER, '-d', 'postgres', '-tAc', `select 1 from pg_database where datname = '${d}'`], { capture: true })
    if (!String(r.stdout).trim()) { psql('postgres', `CREATE DATABASE "${d}" OWNER "${USER}"`); console.log(`created database ${d}`) }
  }
  console.log('databases ready')
}
else if (cmd === 'reset') {
  if (running()) run('pg_ctl', ['-D', DATA, '-m', 'fast', '-w', 'stop'])
  fs.rmSync(DATA, { recursive: true, force: true })
  console.log('Removed .pgdata — run "npm run db:init" to create a fresh cluster')
} else { console.error(`Unknown command ${cmd}`); process.exit(1) }
