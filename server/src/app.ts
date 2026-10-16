// The COIN API (Fastify). buildApp() is used by main.ts and by the integration tests.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import { z } from 'zod'
import { configureSupplierPortal } from '../../src/domain/engine'
import { COMMAND_NAMES } from '../../src/domain/policies'
import { scrubUser, visibleData } from '../../src/domain/visibility'
import type { User } from '../../src/lib/types'
import { ROOT, type Config } from './config'
import type { Db } from './db'
import { HttpError, OrgData } from './orgdata'
import { Sessions } from './sessions'
import { passwordProblem, verifyPassword } from './passwords'
import { Mailer } from './email'

export interface AppDeps { db: Db; config: Config }

const LoginBody = z.object({ login: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) })
const DemoBody = z.object({ userId: z.string().min(1).max(100) })
const CommandBody = z.object({ args: z.array(z.unknown()).max(8).default([]), commandId: z.string().min(8).max(100).optional() })
const UndoBody = z.object({ commandIds: z.array(z.string().min(8).max(100)).min(1).max(50) })
const SupplierResponse = z.object({
  canSupply: z.enum(['Yes', 'Partly', 'No']), meetsSpec: z.enum(['Yes', 'Partly', 'No']), contactName: z.string().trim().min(1).max(120),
  capacityPerMonth: z.string().max(200).optional(), leadTimeDays: z.number().nonnegative().max(3650).optional(), indicativePrice: z.number().nonnegative().optional(),
  certifications: z.string().max(500).optional(), remarks: z.string().max(2000).optional(), respondedAt: z.string().optional(),
})

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body)
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '))
  return r.data
}

/** small in-memory limiter for sign-in and the public supplier form (per IP) */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>()
  return (key: string) => {
    const now = Date.now()
    const h = hits.get(key)
    if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return }
    if (++h.n > max) throw new HttpError(429, 'Too many attempts — wait a few minutes and try again')
  }
}

export async function buildApp({ db, config }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.LOG_LEVEL === 'silent' ? false : { level: config.LOG_LEVEL, redact: ['req.headers.cookie', 'req.body.password'] },
    bodyLimit: 15 * 1024 * 1024,
    disableRequestLogging: config.LOG_LEVEL !== 'debug' && config.LOG_LEVEL !== 'trace',
    trustProxy: true,
  })
  configureSupplierPortal(config.SUPPLIER_PORTAL_URL)
  await app.register(cookie)
  const orgs = new OrgData(db, config, app.log)
  const sessions = new Sessions(db, config)
  const mailer = new Mailer(db, config, app.log)
  const loginLimit = limiter(10, 10 * 60_000)
  const publicLimit = limiter(30, 10 * 60_000)

  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'same-origin')
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
  })
  app.setErrorHandler((err, req, reply) => {
    const status = err instanceof HttpError ? err.status : (err as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) req.log.error({ err }, 'request failed')
    reply.status(status).send({ error: status >= 500 ? 'Something went wrong on the server' : (err as Error).message })
  })

  /** the signed-in user (fresh from the organisation's data), or 401 */
  const requireUser = async (req: FastifyRequest): Promise<{ orgId: string; me: User }> => {
    const s = await sessions.read(req)
    if (!s) throw new HttpError(401, 'Please sign in')
    const snap = await orgs.snapshot(s.orgId)
    const me = snap.data.users.find((u) => u.id === s.userId)
    if (!me || me.active === false) throw new HttpError(401, 'Your account is not active')
    return { orgId: s.orgId, me }
  }

  // ─── health & config ───
  app.get('/api/health', async () => {
    const v = (await db.query('select version from organisations where id = $1', [config.ORG_ID])).rows[0]
    return { ok: true, database: 'up', organisation: v ? 'ready' : 'not seeded', version: v?.version ?? null }
  })
  app.get('/api/config', async () => {
    // three headline counts for the sign-in page — totals only, nothing about any single idea or supplier
    let stats: { implemented: number; inNetwork: number; suppliers: number } | undefined
    try {
      const d = (await orgs.snapshot(config.ORG_ID)).data
      stats = { implemented: d.ideas.filter((i) => i.bucket === 'Implemented').length, inNetwork: d.ideas.filter((i) => i.stage !== 'Draft').length, suppliers: d.suppliers.length }
    } catch { /* not seeded yet */ }
    return { demoLogin: config.DEMO_LOGIN, orgName: config.ORG_NAME, emailDriver: config.EMAIL_DRIVER, stats }
  })

  // ─── sign-in ───
  app.get('/api/auth/demo-accounts', async () => {
    if (!config.DEMO_LOGIN) throw new HttpError(404, 'Demo sign-in is switched off')
    const snap = await orgs.snapshot(config.ORG_ID)
    return { accounts: snap.data.users.filter((u) => u.active !== false).map((u) => ({ id: u.id, name: u.name, roles: u.roles, department: u.department, designation: u.designation, supplierCode: u.supplierCode, avatarColor: u.avatarColor })) }
  })
  app.post('/api/auth/login', async (req, reply) => {
    loginLimit(req.ip)
    const { login, password } = parse(LoginBody, req.body)
    const k = login.toLowerCase()
    const row = (await db.query('select id, password_hash, active from users where org_id = $1 and (lower(email) = $2 or lower(employee_id) = $2)', [config.ORG_ID, k])).rows[0]
    // same answer for unknown user and wrong password
    if (!row || !(await verifyPassword(password, row.password_hash))) throw new HttpError(401, 'Invalid email / employee ID or password')
    if (!row.active) throw new HttpError(403, 'Your account is deactivated — contact your COIN administrator')
    await sessions.create(reply, req, config.ORG_ID, row.id)
    const snap = await orgs.snapshot(config.ORG_ID)
    const me = snap.data.users.find((u) => u.id === row.id)!
    return { user: scrubUser(me, me) }
  })
  app.post('/api/auth/demo-login', async (req, reply) => {
    if (!config.DEMO_LOGIN) throw new HttpError(404, 'Demo sign-in is switched off')
    const { userId } = parse(DemoBody, req.body)
    const snap = await orgs.snapshot(config.ORG_ID)
    const me = snap.data.users.find((u) => u.id === userId && u.active !== false)
    if (!me) throw new HttpError(404, 'No such active account')
    await sessions.create(reply, req, config.ORG_ID, me.id)
    return { user: scrubUser(me, me) }
  })
  app.post('/api/auth/logout', async (req, reply) => { await sessions.destroy(req, reply); return { ok: true } })
  app.get('/api/auth/me', async (req) => { const { me } = await requireUser(req); return { user: scrubUser(me, me) } })

  // ─── data ───
  app.get('/api/bootstrap', async (req) => {
    const { orgId, me } = await requireUser(req)
    const snap = await orgs.snapshot(orgId)
    return { version: snap.version, userId: me.id, data: visibleData(me, snap.data) }
  })
  app.get('/api/version', async (req) => {
    const s = await sessions.read(req)
    if (!s) throw new HttpError(401, 'Please sign in')
    const v = (await db.query('select version from organisations where id = $1', [s.orgId])).rows[0]
    return { version: v?.version ?? 0 }
  })

  app.post<{ Params: { name: string } }>('/api/commands/:name', async (req) => {
    const { orgId, me } = await requireUser(req)
    const name = req.params.name
    if (!COMMAND_NAMES.includes(name)) throw new HttpError(404, `Unknown action ${name}`)
    const body = parse(CommandBody, req.body ?? {})
    // an Admin setting a password must meet the rule; the hash is made when the user row is written
    if (name === 'upsert' && body.args[0] === 'users') {
      const pw = (body.args[1] as { password?: string } | undefined)?.password
      if (pw) { const p = passwordProblem(pw); if (p) throw new HttpError(400, `Password needs ${p}`) }
    }
    const out = await orgs.run(orgId, me.id, name, body.args, body.commandId ?? randomUUID())
    // a deactivated account or a reset password ends that person's sessions
    if (name === 'upsert' && body.args[0] === 'users') {
      const u = body.args[1] as { id?: string; active?: boolean; password?: string }
      if (u?.id && (u.active === false || u.password)) await sessions.destroyUser(orgId, u.id)
    }
    void mailer.deliver(orgId, out.insertedEmails)
    return { result: out.result ?? null, version: out.version, changes: out.changes, duplicate: !!out.duplicate }
  })

  app.post('/api/undo', async (req) => {
    const { orgId, me } = await requireUser(req)
    const { commandIds } = parse(UndoBody, req.body)
    return orgs.undo(orgId, me.id, commandIds)
  })

  // ─── files (attachments) ───
  app.get<{ Params: { id: string } }>('/api/files/:id', async (req, reply) => {
    const { orgId, me } = await requireUser(req)
    const id = req.params.id
    const url = `/api/files/${id}`
    const snap = await orgs.snapshot(orgId)
    const { canSeeIdea } = await import('../../src/lib/calc')
    const idea = snap.data.ideas.find((i) => i.attachments?.some((a) => (a as { url?: string }).url === url))
    if (!idea || !canSeeIdea(me, idea)) throw new HttpError(404, 'File not found')
    const f = (await db.query('select name, type, bytes from files where org_id = $1 and id = $2', [orgId, id])).rows[0]
    if (!f) throw new HttpError(404, 'File not found')
    reply.header('Content-Type', f.type || 'application/octet-stream')
    reply.header('Content-Disposition', `inline; filename="${String(f.name).replace(/[^\w.\- ]/g, '_')}"`)
    return reply.send(f.bytes)
  })

  // ─── public supplier capability form (no login; the emailed token is the key) ───
  const byToken = async (token: string) => {
    const snap = await orgs.snapshot(config.ORG_ID)
    const idea = snap.data.ideas.find((i) => i.evaluation?.supplier?.token === token)
    return idea?.evaluation?.supplier ? { idea, sc: idea.evaluation.supplier } : null
  }
  app.get<{ Params: { token: string } }>('/api/public/supplier-check/:token', async (req) => {
    publicLimit(req.ip)
    const hit = await byToken(req.params.token)
    if (!hit) throw new HttpError(404, 'This link is not valid')
    const { sc } = hit
    // only what the email itself showed — never Amber prices, volumes or other suppliers
    return { supplierName: sc.supplierName, contactName: sc.contactName, item: sc.item, spec: sc.spec, requiredBy: sc.requiredBy, status: sc.status,
      response: sc.response ? { contactName: sc.response.contactName, respondedAt: sc.response.respondedAt } : undefined }
  })
  app.post<{ Params: { token: string } }>('/api/public/supplier-check/:token', async (req) => {
    publicLimit(req.ip)
    const r = parse(SupplierResponse, req.body)
    const hit = await byToken(req.params.token)
    if (!hit) throw new HttpError(404, 'This link is not valid')
    if (hit.sc.status !== 'Sent') throw new HttpError(409, 'This request was already answered')
    const out = await orgs.run(config.ORG_ID, null, 'respondSupplierCheck', [req.params.token, { ...r, respondedAt: new Date().toISOString() }], randomUUID(), { system: true })
    return { ok: out.result === true }
  })

  // ─── the web app (production: one server for API + UI) ───
  const dist = path.join(ROOT, 'dist')
  if (config.SERVE_STATIC && fs.existsSync(path.join(dist, 'index.html'))) {
    const TYPES: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp' }
    const index = fs.readFileSync(path.join(dist, 'index.html'))
    app.get('/*', async (req, reply) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
      const file = path.join(dist, rel)
      if (rel && file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        reply.header('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
        if (rel.startsWith('assets/')) reply.header('Cache-Control', 'public, max-age=31536000, immutable')
        return reply.send(fs.readFileSync(file))
      }
      if (rel.startsWith('api/')) throw new HttpError(404, 'Not found')
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(index)
    })
  }

  app.decorate('orgs', orgs)
  return app
}
