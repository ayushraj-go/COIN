// PostgreSQL access: one pool, a transaction helper and the migration runner.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { ROOT } from './config'

// bigint columns (organisations.version) come back as JS numbers
pg.types.setTypeParser(20, (v: string) => Number(v))

export type Db = pg.Pool
export type Tx = pg.PoolClient

export function createPool(url: string): Db {
  return new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 })
}

/** Run fn inside BEGIN / COMMIT; any error rolls back and is re-thrown */
export async function tx<T>(db: Db, fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await db.connect()
  try {
    await c.query('BEGIN')
    const out = await fn(c)
    await c.query('COMMIT')
    return out
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}

/** Apply db/migrations/*.sql in name order; each file once, recorded in schema_migrations */
export async function migrate(db: Db, log: (m: string) => void = () => undefined): Promise<string[]> {
  const dir = path.join(ROOT, 'db', 'migrations')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  await db.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const done = new Set((await db.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name))
  const applied: string[] = []
  for (const f of files) {
    if (done.has(f)) continue
    const sql = fs.readFileSync(path.join(dir, f), 'utf8')
    await tx(db, async (c) => {
      await c.query(sql)
      await c.query('insert into schema_migrations (name) values ($1)', [f])
    })
    applied.push(f)
    log(`migration applied: ${f}`)
  }
  return applied
}
