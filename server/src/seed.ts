// Create (or re-create) one organisation with the demo data set — the same data the browser demo starts from.
import { DATA_KEYS, freshData, type DomainData } from '../../src/domain/engine'
import type { Config } from './config'
import { tx, type Db } from './db'
import { persistDiff } from './collections'

export async function seedOrg(db: Db, config: Config, orgId = config.ORG_ID) {
  const fresh = freshData()
  const data: DomainData = { ...fresh, users: fresh.users.map((u) => ({ ...u, password: config.SEED_PASSWORD })) }
  // an empty organisation: every list empty, every setting unset — so persistDiff writes everything once
  const empty = Object.fromEntries(DATA_KEYS.map((k) => [k, Array.isArray(fresh[k]) ? [] : undefined])) as unknown as DomainData
  empty.emailPrefs = data.emailPrefs
  await tx(db, async (c) => {
    await c.query('delete from organisations where id = $1', [orgId]) // cascades to every table of the organisation
    await c.query('insert into organisations (id, name, slug, version) values ($1, $2, $3, 1)', [orgId, config.ORG_NAME, orgId])
    await persistDiff(c, orgId, empty, data, null)
  })
  return { users: data.users.length, ideas: data.ideas.length, ledger: data.ledger.length, emails: data.emails.length }
}
