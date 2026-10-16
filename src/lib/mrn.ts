// MRN engine — how stage 5 turns material receipts into savings.
// · Monthly forecast: the forecast a year ÷ 12 × the month's season index (the AC season from the last-FY MRN pattern;
//   indirect buying is flat). The locked target is the sum over the locked window, signed month by month.
// · Claim rules: an MRN receipt counts for an idea only when the part is in the idea, the vendor is the approved
//   supplier, the receipt is on or after the savings start and the price billed is below the baseline. Each receipt
//   counts once: when two ideas cover the same part it goes to the idea whose PO it was received against (the PO PAP
//   revised), else the idea whose approved price it was billed at, else the idea approved first. Everything else is
//   kept with the reason it was not counted.
// · Saving = (baseline − price billed) × quantity received; billing above the approved price is leakage and lowers it.
import type { Idea, IdeaPart, LedgerEntry, MrnLine, MrnReason } from './types'
import { addMonthsYm, sum, ymOf } from './format'
import { planVsActual } from './workflow'
import { inLockWindow } from './workflow'
import { STAGE } from './masters'

/** AC season index by calendar month (Jan … Dec): peak Jan–May, monsoon low Jul–Sep; averages 1 over the year */
export const SEASON_RAC = [1.15, 1.3, 1.4, 1.35, 1.2, 0.9, 0.7, 0.65, 0.7, 0.8, 0.85, 1.0]
const FLAT = Array(12).fill(1) as number[]
/** Season profile for an idea: direct buying follows production (the AC season), indirect buying is flat */
export const seasonProfile = (idea: Pick<Idea, 'buyingType'>) => (idea.buyingType === 'Indirect' ? FLAT : SEASON_RAC)
const monthIdx = (ym: string) => Number(ym.slice(5, 7)) - 1

/** Forecast for each month of a window: forecast a year ÷ 12 × the month's season index */
export function monthlyForecast(annual: number, startDate: string, months: number, profile: number[]) {
  const n = Math.max(1, Math.round(months || 1))
  const start = ymOf(startDate)
  return Array.from({ length: n }, (_, k) => { const month = addMonthsYm(start, k); return { month, amount: (annual / 12) * profile[monthIdx(month)] } })
}
/** The locked target for a window: the sum of its monthly forecasts */
export const windowTarget = (annual: number, startDate: string, months: number, profile: number[]) => sum(monthlyForecast(annual, startDate, months, profile).map((m) => m.amount))

/** The monthly plan of a lock: as signed, or (older locks) the target spread over the window by the season */
export function lockPlan(idea: Pick<Idea, 'buyingType' | 'lock'>): number[] {
  const lock = idea.lock
  if (!lock) return []
  const n = Math.max(1, Math.round(lock.timelineMonths || 1))
  if (lock.monthlyPlan?.length === n) return lock.monthlyPlan
  const w = monthlyForecast(1, lock.startDate, n, seasonProfile(idea)).map((m) => m.amount)
  const total = sum(w) || 1
  return w.map((x) => (lock.targetSaving * x) / total)
}

/** Plan vs MRN actual for one locked idea, on its monthly plan */
export function ideaPlan(idea: Idea, ledger: LedgerEntry[], lastActualMonth: string) {
  const lock = idea.lock!
  return planVsActual({ target: lock.targetSaving, months: lock.timelineMonths, startDate: lock.startDate, ledger: ledger.filter((l) => l.ideaId === idea.id && inLockWindow(lock, l.month)), lastActualMonth, plan: lockPlan(idea) })
}

/** The supplier whose receipts carry the saving: the proposed supplier of a supplier-change idea, else the current one */
export function approvedSupplierCode(idea: Pick<Idea, 'route' | 'proposedSupplier'>, part: Pick<IdeaPart, 'currentSupplier'>) {
  if (idea.route === 'Supplier change' && idea.proposedSupplier) return idea.proposedSupplier.code ?? `NEW:${idea.proposedSupplier.name}`
  return part.currentSupplier.split(' · ')[0]
}

/** The PO line an idea's new price is received against — the PO revised through PAP (demo: derived from the idea) */
export function ideaPoNo(idea: Pick<Idea, 'id'>, part: Pick<IdeaPart, 'partCode'>) {
  let h = 2166136261
  for (const c of `${idea.id}|${part.partCode}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return `45${String((h >>> 0) % 100000000).padStart(8, '0')}`
}

/** Ideas whose receipts are tracked: approved and locked, in execution or verification (not dropped) */
export const liveForMrn = (i: Idea) => !!i.lock && !!i.execution && i.bucket !== 'Dropped' && (i.stage === STAGE.execution || i.stage === STAGE.verification || i.stage === 'Implemented')

/** Apply the claim rules to receipts; returns every line with its status, the idea it counts for or the reason it does not */
export function claimMrn(lines: MrnLine[], ideas: Idea[]): MrnLine[] {
  const live = ideas.filter(liveForMrn).sort((a, b) => (a.approvedAt ?? '').localeCompare(b.approvedAt ?? ''))
  const byPart = new Map<string, Idea[]>()
  for (const i of live) for (const p of i.parts) byPart.set(p.partCode, [...(byPart.get(p.partCode) ?? []), i])
  return lines.map((l) => {
    const cands = byPart.get(l.partCode) ?? []
    if (!cands.length) return { ...l, status: 'Not claimed', ideaId: undefined, reason: 'No live idea for this part' }
    let reason: MrnReason | undefined
    const ok: { i: Idea; po: boolean; gap: number }[] = []
    for (const i of cands) {
      const p = i.parts.find((x) => x.partCode === l.partCode)!
      const why: MrnReason | undefined = l.supplierCode !== approvedSupplierCode(i, p) ? 'Other supplier'
        : l.date < i.lock!.startDate ? 'Before the savings start'
          : l.price >= p.baselinePrice ? 'Old price billed' : undefined
      if (!why) ok.push({ i, po: !!l.poNo && l.poNo === ideaPoNo(i, p), gap: Math.abs(l.price - (p.approvedPrice ?? p.newPrice)) })
      else reason ??= why
    }
    if (!ok.length) return { ...l, status: 'Not claimed', ideaId: undefined, reason }
    // one receipt, one idea: the PO it was received against, else the closest approved price, else approved first (cands are in that order)
    const best = ok.slice().sort((a, b) => Number(b.po) - Number(a.po) || a.gap - b.gap)[0]
    return { ...l, status: 'Claimed', ideaId: best.i.id, reason: undefined }
  })
}

/** Ledger entries for one month from its claimed receipts — one per idea and part. A full monthly read also records
 *  "No MRN received" for every live part inside its window with nothing claimed; an upload touches only what it carries. */
export function ledgerForMonth(month: string, lines: MrnLine[], ideas: Idea[], o: { full: boolean; postedAt: string }): LedgerEntry[] {
  const claimed = lines.filter((l) => l.month === month && l.status === 'Claimed' && l.ideaId)
  const out: LedgerEntry[] = []
  for (const i of ideas.filter(liveForMrn)) {
    const lock = i.lock!
    for (const p of i.parts) {
      const mine = claimed.filter((l) => l.ideaId === i.id && l.partCode === p.partCode)
      if (!mine.length && !(o.full && month >= ymOf(lock.startDate) && inLockWindow(lock, month))) continue
      const approved = p.approvedPrice ?? p.newPrice
      const qty = sum(mine.map((l) => l.qty))
      const plannedQty = Math.round((p.annualVolume / 12) * seasonProfile(i)[monthIdx(month)])
      const leakage = sum(mine.map((l) => Math.max(0, l.price - approved) * l.qty))
      const exceptions: LedgerEntry['exceptions'] = []
      if (leakage > 0) exceptions.push('Price leakage')
      if (qty === 0) exceptions.push('No MRN received')
      else if (qty < plannedQty * 0.5) exceptions.push('Volume below 50% of plan')
      out.push({
        id: `LG-${i.id}-${p.partCode}-${month}`, ideaId: i.id, partCode: p.partCode, supplierCode: approvedSupplierCode(i, p), month,
        mrnQty: qty, plannedQty, mrnPrice: qty ? sum(mine.map((l) => l.price * l.qty)) / qty : approved, baseline: p.baselinePrice, approvedPrice: approved,
        realised: sum(mine.map((l) => (p.baselinePrice - l.price) * l.qty)), leakage, exceptions, financeStatus: 'Pending', postedAt: o.postedAt, mrnIds: mine.map((l) => l.id),
      })
    }
  }
  return out
}

/** Each idea's MRN volume runs at its own steady pace against plan (demo feed): most at or a little above plan, some
 *  slightly below, a few well short — so the monthly forecast vs MRN view shows ideas on track and ideas falling behind */
export function mrnPace(id: string) {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const u = ((h >>> 0) % 1000) / 1000
  return u < 0.6 ? 1.03 + (u / 0.6) * 0.15 : u < 0.8 ? 0.88 + (u - 0.6) * 0.45 : 0.45 + (u - 0.8) * 1.5
}

/** Demo ERP feed: the MRN receipts of one month for every part of the tracked ideas. Receipts at the old price before the
 *  new price is live, some from the outgoing supplier while a supplier change settles, and the odd bill above the approved
 *  price — so the claim rules have real work to do. `newPriceFrom` says from when an idea is billed at the new price. */
export function simulateMrnMonth(ideas: Idea[], month: string, rng: () => number, o: { newPriceFrom: (i: Idea) => string | undefined; seq?: number; exact?: (i: Idea) => boolean }): MrnLine[] {
  const out: MrnLine[] = []
  let seq = o.seq ?? 0
  const yymm = month.slice(2, 4) + month.slice(5, 7)
  const dim = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const day = (d: number) => `${month}-${String(Math.max(1, Math.min(dim, d))).padStart(2, '0')}`
  const push = (i: Idea, p: IdeaPart, qty: number, price: number, supplierCode: string, d: number) => {
    if (qty <= 0) return
    seq++
    // the outgoing supplier delivers against its own (old) PO; the approved supplier against the PO PAP revised
    const po = supplierCode === approvedSupplierCode(i, p) ? ideaPoNo(i, p) : ideaPoNo({ id: `OLD:${supplierCode}` }, p)
    out.push({ id: `5${yymm}${String(seq).padStart(5, '0')}`, date: day(d), month, plant: i.plant, partCode: p.partCode, supplierCode, qty, price, poNo: po, source: 'ERP feed', status: 'Not claimed' })
  }
  for (const i of ideas.filter(liveForMrn)) {
    const lock = i.lock!
    if (month < ymOf(lock.startDate)) continue
    const from = o.newPriceFrom(i) // date the new price is billed from, if at all
    const exact = o.exact?.(i)
    for (const p of i.parts) {
      const approved = p.approvedPrice ?? p.newPrice
      const target = (p.annualVolume / 12) * seasonProfile(i)[monthIdx(month)] * (exact ? 1.05 : mrnPace(i.id) * (0.9 + rng() * 0.2))
      const roll = exact ? 1 : rng()
      if (roll < 0.01) continue // no receipt this month
      const qty = Math.round(roll < 0.025 ? target * 0.35 : target)
      const k = Math.max(2, Math.min(4, Math.round(qty / Math.max(1, (p.annualVolume / 12) * 0.35))))
      const switchDay = from && ymOf(from) === month ? Number(from.slice(8, 10)) : from && ymOf(from) < month ? 0 : 99
      // a supplier change settles over its first two months: part of the volume still comes from the outgoing supplier
      const firstMonths = from && month <= addMonthsYm(ymOf(from), 1)
      const outgoing = i.route === 'Supplier change' && firstMonths && !exact ? Math.round(qty * (0.15 + rng() * 0.15)) : 0
      const currentCode = p.currentSupplier.split(' · ')[0]
      const newCode = approvedSupplierCode(i, p)
      if (outgoing) push(i, p, outgoing, p.baselinePrice, currentCode, 4 + Math.floor(rng() * 8))
      const rest = qty - outgoing
      for (let j = 0; j < k; j++) {
        const d = Math.round(((j + 0.5) / k) * dim)
        const q = j === k - 1 ? rest - Math.round(rest / k) * (k - 1) : Math.round(rest / k)
        const atNew = d >= switchDay
        const leak = atNew && !exact && rng() < 0.06
        const price = !atNew ? p.baselinePrice : leak ? +(approved * (1.01 + rng() * 0.04)).toFixed(approved > 100 ? 1 : 2) : approved
        push(i, p, q, price, atNew ? newCode : (i.route === 'Supplier change' ? currentCode : newCode), d)
      }
    }
  }
  return out
}

/** The layout of an MRN extract upload (one receipt a row) */
export const MRN_CSV_HEADER = 'MRN No,GRN Date,Plant,Part Code,Vendor Code,Qty,Rate,PO No'
const COLS: Record<string, string[]> = {
  id: ['mrn no', 'mrn', 'mrn number', 'grn no'], date: ['grn date', 'mrn date', 'date', 'receipt date'], plant: ['plant'],
  partCode: ['part code', 'part', 'material', 'item code'], supplierCode: ['vendor code', 'vendor', 'supplier code', 'supplier'],
  qty: ['qty', 'quantity', 'received qty'], price: ['rate', 'price', 'unit price'], poNo: ['po no', 'po', 'po number'],
}
const isoDate = (s: string) => {
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}
/** Read an MRN extract (CSV); bad rows are reported, not guessed */
export function parseMrnCsv(text: string): { lines: MrnLine[]; errors: string[] } {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map((r) => r.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
  if (!rows.length) return { lines: [], errors: ['The file is empty'] }
  const head = rows[0].map((h) => h.toLowerCase())
  const col = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))])) as Record<keyof typeof COLS, number>
  const missing = Object.entries(col).filter(([k, v]) => v < 0 && k !== 'poNo' && k !== 'plant').map(([k]) => k)
  if (missing.length) return { lines: [], errors: [`Missing columns: ${missing.join(', ')} — expected ${MRN_CSV_HEADER}`] }
  const lines: MrnLine[] = [], errors: string[] = []
  rows.slice(1).forEach((r, k) => {
    const n = k + 2
    const date = isoDate(r[col.date] ?? '')
    const qty = Number(r[col.qty]), price = Number(r[col.price])
    if (!r[col.id] || !r[col.partCode] || !r[col.supplierCode]) return errors.push(`Row ${n}: MRN number, part code and vendor code are required`)
    if (!date) return errors.push(`Row ${n}: date "${r[col.date]}" — use YYYY-MM-DD or DD-MM-YYYY`)
    if (!(qty > 0) || !(price > 0)) return errors.push(`Row ${n}: quantity and rate must be numbers above 0`)
    lines.push({ id: r[col.id], date, month: date.slice(0, 7), plant: col.plant >= 0 ? r[col.plant] ?? '' : '', partCode: r[col.partCode], supplierCode: r[col.supplierCode], qty, price, poNo: col.poNo >= 0 ? r[col.poNo] ?? '' : '', source: 'Upload', status: 'Not claimed' })
  })
  return { lines, errors }
}
