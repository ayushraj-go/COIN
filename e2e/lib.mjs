// QA harness: a real Chrome driving the real app against the real API + PostgreSQL.
// Each step = what the user does, what should happen, what happened, PASS / FAIL, and a screenshot.
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))

export class Qa {
  constructor({ base, api, outDir, width = 1536, height = 864 }) {
    this.base = base; this.api = api; this.outDir = outDir
    this.size = { width, height }
    this.steps = []        // every step of every journey
    this.issues = []       // problems found while testing
    this.consoleErrors = []
    this.n = 0
    this.role = ''; this.journey = ''
    fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true })
  }

  async start() {
    if (!CHROME) throw new Error('Chrome not found — set CHROME_PATH')
    // Chrome occasionally fails to start (updates, a busy machine) — try a few times before giving up
    for (let k = 1; ; k++) {
      try { this.browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--lang=en-GB'] }); break }
      catch (e) { if (k >= 4) throw e; console.log(`Chrome did not start (attempt ${k}) — retrying`); await sleep(3000) }
    }
    await this.newPage()
  }
  async newPage() {
    if (this.page) await this.page.close().catch(() => undefined)
    // a fresh incognito-like context per person: separate cookies, separate session
    if (this.ctx) await this.ctx.close().catch(() => undefined)
    this.ctx = await this.browser.createBrowserContext()
    this.page = await this.ctx.newPage()
    await this.page.setViewport({ ...this.size, deviceScaleFactor: 1 })
    this.page.on('pageerror', (e) => this.consoleErrors.push({ journey: this.journey, role: this.role, url: this.page.url(), text: `page error: ${String(e).slice(0, 300)}` }))
    this.page.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      if (/status of 40[1349]|Failed to load resource/.test(t)) return // refused actions are part of the tests
      this.consoleErrors.push({ journey: this.journey, role: this.role, url: this.page.url(), text: t.slice(0, 300) })
    })
    return this.page
  }
  async stop() { await this.browser?.close() }

  /** Group the following steps */
  section(journey, role) { this.journey = journey; this.role = role }

  async shot(label) {
    const file = `${String(++this.n).padStart(3, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}.jpg`
    await sleep(350)
    await this.page.screenshot({ path: path.join(this.outDir, 'shots', file), type: 'jpeg', quality: 78 })
    return file
  }

  /**
   * One test step. `fn` performs it; `check` returns the actual result (a string) or throws.
   * The step passes when nothing throws. A screenshot is taken after the step (also when it fails).
   */
  async step(action, expected, fn, check, opts = {}) {
    const rec = { n: this.steps.length + 1, journey: this.journey, role: this.role, action, expected, actual: '', status: 'PASS', shot: null, url: '' }
    try {
      await fn?.()
      rec.actual = (await check?.()) ?? 'As expected'
    } catch (e) {
      rec.status = 'FAIL'
      rec.actual = String(e?.message ?? e).slice(0, 400)
      this.issues.push({ journey: this.journey, role: this.role, step: action, problem: rec.actual })
    }
    rec.url = this.page.url().replace(this.base, '')
    if (opts.shot !== false) {
      try { rec.shot = await this.shot(`${this.role}-${action}`) } catch { /* page closed */ }
    }
    this.steps.push(rec)
    console.log(`${rec.status === 'PASS' ? '✓' : '✗'} [${this.role}] ${action}${rec.status === 'FAIL' ? ` — ${rec.actual}` : ''}`)
    return rec.status === 'PASS'
  }

  // ─── browser helpers ─────────────────────────────────────────────────────
  async goto(p, wait = 1200) { await this.page.goto(this.base + p, { waitUntil: 'networkidle0' }); await sleep(wait) }

  /** click the first visible, enabled control whose text contains (or equals) `text` — optionally inside the open dialog */
  async click(text, { exact = false, dialog = false, nth = 0, wait = 600, within } = {}) {
    const ok = await this.page.evaluate(({ text, exact, dialog, nth, within }) => {
      const roots = dialog ? [...document.querySelectorAll('[role="dialog"]')] : within ? [...document.querySelectorAll(within)] : [document]
      const root = roots[roots.length - 1]
      if (!root) return 'no dialog open'
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
      const els = [...root.querySelectorAll('button, a, [role="button"], [role="tab"], label, summary')]
        .filter((el) => { const t = norm(el.innerText || el.textContent); return exact ? t === text : t.includes(text) })
        .filter((el) => el.offsetParent !== null && !el.disabled && el.getAttribute('aria-disabled') !== 'true')
      const el = els[nth]
      if (!el) return `"${text}" not found${dialog ? ' in the dialog' : ''}`
      el.scrollIntoView({ block: 'center' })
      el.click()
      return true
    }, { text, exact, dialog, nth, within })
    if (ok !== true) throw new Error(ok)
    await sleep(wait)
  }
  async isEnabled(text, { dialog = false } = {}) {
    return this.page.evaluate(({ text, dialog }) => {
      const roots = dialog ? [...document.querySelectorAll('[role="dialog"]')] : [document]
      const root = roots[roots.length - 1]
      const el = [...(root?.querySelectorAll('button') ?? [])].find((b) => (b.innerText || '').replace(/\s+/g, ' ').trim().includes(text))
      return el ? !el.disabled : null
    }, { text, dialog })
  }
  /** type into the input / textarea matched by a CSS selector (inside the dialog when asked) */
  async type(selector, value, { dialog = false, clear = true } = {}) {
    const scope = dialog ? '[role="dialog"] ' : ''
    const handles = await this.page.$$(scope + selector)
    const h = handles[handles.length - 1]
    if (!h) throw new Error(`field ${selector} not found`)
    await h.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await h.click({ clickCount: 3 })
    if (clear) await this.page.keyboard.press('Backspace')
    await h.type(String(value), { delay: 0 })
    await sleep(150)
  }
  async typeByPlaceholder(ph, value, opts = {}) { return this.type(`[placeholder*="${ph}"]`, value, opts) }
  async select(selector, value, { dialog = false } = {}) {
    const scope = dialog ? '[role="dialog"] ' : ''
    const r = await this.page.select(scope + selector, value)
    if (!r.length) throw new Error(`option ${value} not available in ${selector}`)
    await sleep(300)
  }
  /** mark the input / textarea / select of the form field whose label contains `label` (first match) */
  async markField(label, { dialog = false, tag = 'input, textarea, select' } = {}) {
    const ok = await this.page.evaluate(({ label, dialog, tag }) => {
      document.querySelectorAll('[data-qa-in]').forEach((e) => e.removeAttribute('data-qa-in'))
      const root = dialog ? [...document.querySelectorAll('[role="dialog"]')].pop() : document
      const lab = [...(root?.querySelectorAll('.label') ?? [])].find((l) => (l.innerText || '').replace(/\s+/g, ' ').includes(label))
      const el = lab?.parentElement?.querySelector(tag)
      if (!el) return false
      el.setAttribute('data-qa-in', '1'); el.scrollIntoView({ block: 'center' }); return true
    }, { label, dialog, tag })
    if (!ok) throw new Error(`field "${label}" not found`)
    return '[data-qa-in="1"]'
  }
  /** type into the field with this label */
  async fill(label, value, opts = {}) { await this.type(await this.markField(label, opts), value) }
  /** set an <input> value the way React notices (dates, numbers) */
  async setValue(selector, value) {
    const ok = await this.page.evaluate(({ selector, value }) => {
      const el = [...document.querySelectorAll(selector)].pop()
      if (!el) return false
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, { selector, value })
    if (!ok) throw new Error(`field ${selector} not found`)
    await sleep(200)
  }
  async setField(label, value, opts = {}) { await this.setValue(await this.markField(label, opts), value) }
  async checkbox(selector = '[role="dialog"] input[type="checkbox"]', on = true) {
    const ok = await this.page.evaluate(({ selector, on }) => { const el = [...document.querySelectorAll(selector)][0]; if (!el) return false; if (el.checked !== on) el.click(); return true }, { selector, on })
    if (!ok) throw new Error(`checkbox ${selector} not found`)
    await sleep(200)
  }
  /** choose `value` in the <select> that has an option whose text contains `hasOption` */
  async selectWhere(hasOption, value, { dialog = false } = {}) {
    const ok = await this.page.evaluate(({ hasOption, dialog }) => {
      document.querySelectorAll('[data-qa-sel]').forEach((e) => e.removeAttribute('data-qa-sel'))
      const root = dialog ? [...document.querySelectorAll('[role="dialog"]')].pop() : document
      const sel = [...(root?.querySelectorAll('select') ?? [])].find((s) => [...s.options].some((o) => o.text.includes(hasOption)))
      if (!sel) return false
      sel.setAttribute('data-qa-sel', '1'); sel.scrollIntoView({ block: 'center' }); return true
    }, { hasOption, dialog })
    if (!ok) throw new Error(`no list with "${hasOption}"`)
    await this.select('[data-qa-sel="1"]', value)
  }
  async text() { return this.page.evaluate(() => document.body.innerText) }
  async expectText(t, { timeout = 6000 } = {}) {
    const end = Date.now() + timeout
    while (Date.now() < end) { if ((await this.text()).includes(t)) return `"${t}" shown`; await sleep(250) }
    throw new Error(`"${t}" not shown`)
  }
  async expectNoText(t) { if ((await this.text()).includes(t)) throw new Error(`"${t}" is shown but should not be`); return `"${t}" not shown` }
  async toast() { await sleep(400); return this.page.evaluate(() => [...document.querySelectorAll('[role="status"], .toast, [data-toast]')].map((e) => e.innerText).join(' | ')) }

  /** draw a signature on the first canvas in the dialog */
  async sign() {
    const c = await this.page.$('[role="dialog"] canvas')
    if (!c) throw new Error('signature pad not found')
    await c.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    const b = await c.boundingBox()
    const m = this.page.mouse
    await m.move(b.x + 20, b.y + b.height * 0.6); await m.down()
    for (let k = 0; k <= 24; k++) await m.move(b.x + 20 + k * 9, b.y + b.height * (0.6 - 0.3 * Math.sin(k / 3)), { steps: 2 })
    await m.up(); await sleep(200)
  }

  // ─── sign-in ─────────────────────────────────────────────────────────────
  async signInWithPassword(login, password) {
    await this.newPage()
    await this.goto('/login', 800)
    await this.type('input:not([type="password"]):not([type="checkbox"])', login)
    await this.type('input[type="password"]', password)
    await this.click('Sign in', { exact: true, wait: 2200 })
  }
  /** sign in as a seeded person with the password (every seeded account shares SEED_PASSWORD) */
  async as(email, password = process.env.SEED_PASSWORD || 'coin@2026') {
    await this.signInWithPassword(email, password)
    if (this.page.url().includes('/login')) throw new Error(`sign-in failed for ${email}`)
  }
}

// ─── direct API access for checks (what the database really holds) ────────────
export class Api {
  constructor(base) { this.base = base; this.cookies = new Map() }
  async login(email, password = process.env.SEED_PASSWORD || 'coin@2026') {
    const r = await fetch(`${this.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: email, password }) })
    if (!r.ok) throw new Error(`API login ${email}: ${r.status}`)
    const c = r.headers.get('set-cookie').split(';')[0]
    this.cookies.set(email, c)
    return c
  }
  async get(email, p) {
    const c = this.cookies.get(email) ?? (await this.login(email))
    const r = await fetch(`${this.base}${p}`, { headers: { cookie: c } })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  async cmd(email, name, ...args) {
    const c = this.cookies.get(email) ?? (await this.login(email))
    const r = await fetch(`${this.base}/api/commands/${name}`, { method: 'POST', headers: { cookie: c, 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  async data(email) { return (await this.get(email, '/api/bootstrap')).body.data }
  async idea(email, id) { return (await this.data(email)).ideas.find((i) => i.id === id) }
}
