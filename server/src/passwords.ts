// Password hashing with Node's built-in scrypt — no native modules, so it runs the same on Windows, Linux and AWS.
// Stored as  scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, len, opts, (e, k) => (e ? rej(e) : res(k))))

const N = 16384, R = 8, P = 1, LEN = 32

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, LEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Password rule for accounts set by Admin */
export const passwordProblem = (pw: string) => (pw.length < 8 ? 'at least 8 characters' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'letters and digits' : null)
