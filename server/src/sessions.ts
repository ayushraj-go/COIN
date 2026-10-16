// Server-side sessions: a random id in an httpOnly cookie; only its SHA-256 is stored.
// Expiry = absolute (SESSION_HOURS) and idle (the organisation's sessionTimeoutMin setting).
import { createHash, randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Config } from './config'
import type { Db } from './db'

export const COOKIE = 'coin_sid'
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export interface Session { orgId: string; userId: string; idHash: string }

export class Sessions {
  constructor(private db: Db, private config: Config) {}

  async create(reply: FastifyReply, req: FastifyRequest, orgId: string, userId: string) {
    const raw = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + this.config.SESSION_HOURS * 3600_000)
    await this.db.query('insert into sessions (id_hash, org_id, user_id, expires_at, ip, user_agent) values ($1, $2, $3, $4, $5, $6)',
      [sha(raw), orgId, userId, expires, req.ip, String(req.headers['user-agent'] ?? '').slice(0, 200)])
    await this.db.query('update users set last_login_at = now() where org_id = $1 and id = $2', [orgId, userId])
    reply.setCookie(COOKIE, raw, { path: '/', httpOnly: true, sameSite: 'lax', secure: this.config.COOKIE_SECURE, expires })
  }

  /** The session behind the request cookie, or null when missing, expired or idle too long */
  async read(req: FastifyRequest): Promise<Session | null> {
    const raw = req.cookies?.[COOKIE]
    if (!raw) return null
    const idHash = sha(raw)
    const r = (await this.db.query(
      `select s.org_id, s.user_id, s.expires_at, s.last_seen_at, coalesce((o.settings->>'sessionTimeoutMin')::int, 30) as idle_min
         from sessions s left join org_settings o on o.org_id = s.org_id where s.id_hash = $1`, [idHash])).rows[0]
    if (!r) return null
    const now = Date.now()
    if (new Date(r.expires_at).getTime() < now || now - new Date(r.last_seen_at).getTime() > r.idle_min * 60_000) {
      await this.db.query('delete from sessions where id_hash = $1', [idHash])
      return null
    }
    // keep the idle clock running (at most one write a minute)
    if (now - new Date(r.last_seen_at).getTime() > 60_000) await this.db.query('update sessions set last_seen_at = now() where id_hash = $1', [idHash])
    return { orgId: r.org_id, userId: r.user_id, idHash }
  }

  async destroy(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.cookies?.[COOKIE]
    if (raw) await this.db.query('delete from sessions where id_hash = $1', [sha(raw)])
    reply.clearCookie(COOKIE, { path: '/' })
  }

  /** Sign a user out everywhere (deactivated by Admin, password changed) */
  async destroyUser(orgId: string, userId: string) {
    await this.db.query('delete from sessions where org_id = $1 and user_id = $2', [orgId, userId])
  }
}
