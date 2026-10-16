// Database commands:  tsx server/src/cli.ts migrate | seed | reset   [--test  = use TEST_DATABASE_URL]
//   migrate  apply pending migrations
//   seed     (re)create the organisation with the demo data; every account gets SEED_PASSWORD
//   reset    drop every table, migrate and seed
import { loadConfig } from './config'
import { createPool, migrate, type Db } from './db'
import { seedOrg } from './seed'

const [cmd = 'migrate', ...flags] = process.argv.slice(2)
const config = loadConfig()
const url = flags.includes('--test') ? config.TEST_DATABASE_URL : config.DATABASE_URL
if (!url) { console.error('No database URL (set DATABASE_URL / TEST_DATABASE_URL in .env)'); process.exit(1) }
const db: Db = createPool(url)

async function dropAll() {
  await db.query('drop schema public cascade; create schema public;')
}

try {
  if (cmd === 'reset') { await dropAll(); console.log('All tables dropped') }
  await migrate(db, (m) => console.log(m))
  if (cmd === 'seed' || cmd === 'reset') {
    const n = await seedOrg(db, config)
    console.log(`Seeded organisation "${config.ORG_ID}": ${n.users} accounts (password from SEED_PASSWORD), ${n.ideas} ideas, ${n.ledger} ledger rows, ${n.emails} emails`)
  }
  if (!['migrate', 'seed', 'reset'].includes(cmd)) { console.error(`Unknown command ${cmd}`); process.exitCode = 1 }
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await db.end()
}
