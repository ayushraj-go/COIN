// Server configuration from the environment (.env in the repo root for local development).
// Every setting is validated at start-up so a typo fails fast instead of at the first request.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const envFile = path.join(ROOT, '.env')
// real environment variables win over .env (process.loadEnvFile never overwrites)
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const bool = (d: boolean) => z.enum(['true', 'false', '1', '0', '']).optional().transform((v) => (v == null || v === '' ? d : v === 'true' || v === '1'))

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  APP_URL: z.string().url().default('http://localhost:8742'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see .env.example)'),
  TEST_DATABASE_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ORG_ID: z.string().default('amber'),
  ORG_NAME: z.string().default('Amber Enterprises India Ltd'),
  DEMO_LOGIN: bool(false),
  SEED_PASSWORD: z.string().min(6).default('coin@2026'),
  EMAIL_DRIVER: z.enum(['outbox', 'smtp']).default('outbox'),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('COIN <coin@ambergroupindia.com>'),
  SUPPLIER_PORTAL_URL: z.string().optional(),
  COOKIE_SECURE: bool(false),
  SESSION_HOURS: z.coerce.number().positive().default(12),
  SERVE_STATIC: bool(false),
})

export type Config = z.infer<typeof Env>

export function loadConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  const r = Env.safeParse({ ...process.env, ...overrides })
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid configuration — ${msg}`)
  }
  return r.data
}
