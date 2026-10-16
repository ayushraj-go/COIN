// Add what the QA run caused in the database — every notification (they are personal, so no single person sees
// them all) and the full audit trail of commands — to qa-output/results.json. Run after e2e/run.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.loadEnvFile?.(path.join(ROOT, '.env'))
const file = path.join(ROOT, 'qa-output', 'results.json')

export async function collect() {
  const R = JSON.parse(fs.readFileSync(file, 'utf8'))
  const db = new pg.Client({ connectionString: process.env.QA_DATABASE_URL || process.env.TEST_DATABASE_URL })
  await db.connect()
  try {
    R.notifications = (await db.query("select data from notifications where org_id = 'amber' and at >= $1 order by at", [R.started])).rows.map((r) => r.data)
    R.commands = (await db.query("select id, actor_id, command, ok, error, at from command_log where org_id = 'amber' and at >= $1 order by at", [R.started])).rows
  } finally { await db.end() }
  fs.writeFileSync(file, JSON.stringify(R, null, 2))
  return { notifications: R.notifications.length, commands: R.commands.length }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log(await collect())
