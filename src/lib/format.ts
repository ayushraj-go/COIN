// INR with lakh / crore formatting (Section 15) + FY calendar helpers (April–March)

const inFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inFmt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const num = (n: number, d = 0) =>
  n == null || isNaN(n) ? '—' : d ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : inFmt.format(n)

/** ₹ 24,00,000 */
export const inr = (n: number) => (n == null || isNaN(n) ? '—' : `₹ ${inFmt.format(Math.round(n))}`)
/** ₹ 4.20 — unit prices */
export const inrPrice = (n: number) => (n == null || isNaN(n) ? '—' : `₹ ${inFmt2.format(n)}`)

/** Compact lakh / crore: ₹ 12.45 Cr, ₹ 8.40 L, ₹ 45,000 */
export function inrShort(n: number, digits = 2): string {
  if (n == null || isNaN(n)) return '—'
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 1e7) return `${sign}₹ ${(a / 1e7).toFixed(digits)} Cr`
  if (a >= 1e5) return `${sign}₹ ${(a / 1e5).toFixed(digits)} L`
  return `${sign}₹ ${inFmt.format(Math.round(a))}`
}
/** value in crore number */
export const toCr = (n: number) => n / 1e7
export const toLakh = (n: number) => n / 1e5
export const lakhLabel = (n: number) => `₹ ${(n / 1e5).toFixed(2)} lakh`

export const pct = (n: number, d = 1) => (n == null || !isFinite(n) ? '—' : `${n.toFixed(d)}%`)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const iso = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const parse = (s: string) => {
  if (!s) return new Date(NaN)
  if (s.length === 10) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
  return new Date(s)
}
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const todayIso = () => iso(today())
export const nowIso = () => new Date().toISOString()

export function fmtDate(s?: string) {
  if (!s) return '—'
  const d = parse(s)
  if (isNaN(+d)) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export function fmtDateShort(s?: string) {
  if (!s) return '—'
  const d = parse(s)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
}
export function fmtDateTime(s?: string) {
  if (!s) return '—'
  const d = new Date(s)
  return `${fmtDate(iso(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function timeAgo(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const d = Math.floor(diff / 86400)
  if (d < 30) return `${d}d ago`
  return fmtDate(s.slice(0, 10))
}

/** '2026-08' → 'Aug 2026' */
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` }
export const monthLong = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_LONG[m - 1]} ${y}` }
export const monthShort = (ym: string) => MONTHS[Number(ym.split('-')[1]) - 1]
export const ymOf = (s: string) => s.slice(0, 7)
export const addMonthsYm = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── FY calendar: April–March; FY27 = Apr 2026 – Mar 2027 ─────────────────────
export function fyOf(s: string | Date): string {
  const d = typeof s === 'string' ? parse(s) : s
  const y = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear()
  return `FY${String(y).slice(2)}`
}
export const fyStartYear = (fy: string) => 2000 + Number(fy.slice(2)) - 1
export const fyStart = (fy: string) => `${fyStartYear(fy)}-04-01`
export const fyEnd = (fy: string) => `${fyStartYear(fy) + 1}-03-31`
export const fyLabel = (fy: string) => `${fy} (Apr ${fyStartYear(fy)} – Mar ${fyStartYear(fy) + 1})`
export const nextFy = (fy: string) => `FY${String(Number(fy.slice(2)) + 1).padStart(2, '0')}`
export const prevFy = (fy: string) => `FY${String(Number(fy.slice(2)) - 1).padStart(2, '0')}`
export function fyMonths(fy: string): string[] {
  const y = fyStartYear(fy)
  return Array.from({ length: 12 }, (_, i) => addMonthsYm(`${y}-04`, i))
}
/** Q1 (Apr–Jun) … Q4 (Jan–Mar) */
export function quarterOf(s: string | Date): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const d = typeof s === 'string' ? parse(s) : s
  const m = d.getMonth()
  if (m >= 3 && m <= 5) return 'Q1'
  if (m >= 6 && m <= 8) return 'Q2'
  if (m >= 9 && m <= 11) return 'Q3'
  return 'Q4'
}
export const QUARTER_MONTHS: Record<string, string> = { Q1: 'Apr–Jun', Q2: 'Jul–Sep', Q3: 'Oct–Dec', Q4: 'Jan–Mar' }
export function quarterStart(q: string, fy: string) {
  const y = fyStartYear(fy)
  return { Q1: `${y}-04-01`, Q2: `${y}-07-01`, Q3: `${y}-10-01`, Q4: `${y + 1}-01-01` }[q] as string
}
export function quarterEnd(q: string, fy: string) {
  const y = fyStartYear(fy)
  return { Q1: `${y}-06-30`, Q2: `${y}-09-30`, Q3: `${y}-12-31`, Q4: `${y + 1}-03-31` }[q] as string
}

export function daysBetween(a: string | Date, b: string | Date) {
  const da = typeof a === 'string' ? parse(a.slice(0, 10)) : a
  const db = typeof b === 'string' ? parse(b.slice(0, 10)) : b
  return Math.round((+db - +da) / 86400000)
}
export function workingDaysBetween(a: string | Date, b: string | Date) {
  const da = typeof a === 'string' ? parse(a.slice(0, 10)) : new Date(a)
  const db = typeof b === 'string' ? parse(b.slice(0, 10)) : new Date(b)
  if (db <= da) return 0
  let n = 0
  const d = new Date(da)
  while (d < db) {
    d.setDate(d.getDate() + 1)
    const w = d.getDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}
export function addDays(s: string, n: number) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export function addWorkingDays(s: string, n: number) {
  const d = parse(s)
  let k = 0
  while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++ }
  return iso(d)
}
/** 3rd working day of a month (realisation run) */
export function thirdWorkingDay(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  let k = 0
  while (true) { if (d.getDay() !== 0 && d.getDay() !== 6) { k++; if (k === 3) return iso(d) } d.setDate(d.getDate() + 1) }
}

export const initials = (name: string) => name.replace(/^Dr\.\s*/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
export const sum = (arr: number[]) => arr.reduce((a, b) => a + (b || 0), 0)
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
