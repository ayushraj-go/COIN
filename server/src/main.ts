// Start the COIN API: apply pending migrations, then listen.
import { loadConfig } from './config'
import { createPool, migrate } from './db'
import { buildApp } from './app'

const config = loadConfig()
const db = createPool(config.DATABASE_URL)

try {
  await migrate(db, (m) => console.log(m))
} catch (e) {
  console.error(`Cannot reach or migrate the database (${(e as Error).message}).\nIs PostgreSQL running? Locally: "npm run db:start".`)
  process.exit(1)
}
const app = await buildApp({ db, config })
const seeded = (await db.query('select 1 from organisations where id = $1', [config.ORG_ID])).rowCount
if (!seeded) app.log.warn(`Organisation "${config.ORG_ID}" has no data yet — run "npm run db:seed"`)

await app.listen({ host: config.HOST, port: config.PORT })
app.log.info(`COIN API on http://${config.HOST}:${config.PORT} · demo sign-in ${config.DEMO_LOGIN ? 'on' : 'off'} · email ${config.EMAIL_DRIVER}`)

const stop = async () => { await app.close(); await db.end(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
