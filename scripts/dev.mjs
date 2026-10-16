#!/usr/bin/env node
// Local development in one terminal: PostgreSQL (if stopped), the API (watch mode) and the web app.
import { spawn, spawnSync } from 'node:child_process'
const sh = process.platform === 'win32'
spawnSync('node', ['scripts/db.mjs', 'start'], { stdio: 'inherit' })
const run = (name, args) => {
  const p = spawn('npm', ['run', ...args], { stdio: ['ignore', 'pipe', 'pipe'], shell: sh })
  const tag = (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`))
  p.stdout.on('data', tag); p.stderr.on('data', tag)
  return p
}
const kids = [run('api', ['dev:api']), run('web', ['dev'])]
const stop = () => { for (const k of kids) k.kill(); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
