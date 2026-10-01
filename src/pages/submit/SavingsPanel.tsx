// Section 7 — sticky savings summary panel (recalculates as the user types)
import { motion, AnimatePresence } from 'motion/react'
import type { Lever } from '../../lib/types'
import { Icon, InfoTip, Money, Tooltip, cn } from '../../components/ui'
import { fmtDate, inrPrice, inrShort, QUARTER_MONTHS } from '../../lib/format'
import { FORMULAS } from '../../lib/scope'
import { RouteStrip, RouteBadge } from './widgets'

export interface PartCalc { partCode: string; description: string; uom: string; unit: number; pct: number; annual: number; hasNew: boolean }
export interface SavingsCalc {
  isOpen: boolean
  rows: PartCalc[]
  annual: number
  pct: number | null
  committed: number
  carry: number
  monthsInFy: number
  goLive: string
  quarter: string
  levels: string[]
}

const F = (name: string) => FORMULAS.find((f) => f.name === name)?.expr
export const tone = (v: number) => (v > 0 ? '#0f9f6e' : v < 0 ? '#e0364f' : '#64748b')

export function PctBadge({ pct, dark }: { pct: number | null; dark?: boolean }) {
  if (pct == null) return null
  const pos = pct > 0, neg = pct < 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 h-[22px] px-1.5 rounded-md text-[11.5px] font-bold num',
      dark ? (pos ? 'bg-emerald-400/15 text-emerald-300' : neg ? 'bg-red-400/15 text-red-300' : 'bg-white/10 text-slate-300') : pos ? 'bg-emerald-50 text-emerald-700' : neg ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500')}>
      <Icon name={pos ? 'TrendingUp' : neg ? 'TrendingDown' : 'Minus'} size={11} />
      {Math.abs(pct).toFixed(2)}%
    </span>
  )
}

const MAX_ROWS = 3 // keeps the sticky panel short enough to never need its own scrollbar

export function SavingsPanelBody({ c, lever, currentFy, nextFyLabel, leadName, headName, xLakh, hasCommodity }: {
  c: SavingsCalc; lever?: Lever; currentFy: string; nextFyLabel: string; leadName?: string; headName?: string; xLakh: number; hasCommodity: boolean
}) {
  const cPct = c.annual ? Math.max(0, Math.min(100, (c.committed / c.annual) * 100)) : 0
  const [q, fy] = c.quarter.split(' ')
  const needsHead = c.levels.includes('Sourcing Head')
  const headReason = `Annualised impact above ₹ X = ${xLakh} lakh`
  const shown = c.rows.slice(0, MAX_ROWS)
  const more = c.rows.length - shown.length
  return (
    <div className="divide-y divide-line">
      {/* per-part breakdown (fields 21–22) */}
      {!c.isOpen && (
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Per part code</span>
            <InfoTip title="Saving per unit and annualised impact" formula={`${F('Saving per unit')}  ·  ${F('Annualised impact')}`}>An idea spanning several part codes stores price, volume and saving per part code and rolls them up.</InfoTip>
          </div>
          {!c.rows.length && <div className="text-[12px] text-muted py-2">Add a part code to see saving / unit, % and annualised impact per part.</div>}
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {shown.map((r) => (
                <motion.div key={r.partCode} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono font-semibold text-ink text-[11.5px]">{r.partCode}</span>
                    <span className="block text-muted truncate text-[11px]">{r.hasNew ? `${inrPrice(r.unit)} / ${r.uom} saving` : 'Enter the expected new price'}</span>
                  </span>
                  {r.hasNew && <PctBadge pct={r.pct} />}
                  <span className="w-[86px] text-right font-bold num" style={{ color: tone(r.annual) }}>{inrShort(r.annual)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {more > 0 && <div className="text-[11px] text-muted mt-1">+ {more} more part{more === 1 ? '' : 's'} — see card D</div>}
          {c.rows.length > 1 && (
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-dashed border-slate-200 text-[12.5px]">
              <span className="font-semibold text-ink-2">Total annualised impact</span>
              <span className="font-bold num" style={{ color: tone(c.annual) }}>{inrShort(c.annual)}</span>
            </div>
          )}
        </div>
      )}

      {/* committed this FY vs carry-over (from expected implementation quarter) */}
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">Committed vs carry-over
            <InfoTip title="Committed saving (in-FY)" formula="Annualised impact × months live in FY ÷ 12">Saving expected inside the current FY, phased from the implementation date. Carry-over is the part of the annualised impact that falls in the next FY. {q} {fy} ({QUARTER_MONTHS[q]}): {c.monthsInFy.toFixed(1)} of 12 months fall in {currentFy}.</InfoTip>
          </span>
          <span className="text-[11px] text-muted">Go-live {fmtDate(c.goLive)}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
          <motion.div className="h-full bg-emerald-500" initial={false} animate={{ width: `${cPct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
          <motion.div className="h-full bg-slate-400" initial={false} animate={{ width: `${c.annual ? 100 - cPct : 0}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Committed this FY ({currentFy})</div>
            <div className="text-[13.5px] font-bold num" style={{ color: tone(c.committed) }}>{inrShort(c.committed)}</div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-sm bg-slate-400" />Carry-over to {nextFyLabel}</div>
            <div className="text-[13.5px] font-bold num text-ink-2">{inrShort(c.carry)}</div>
          </div>
        </div>
      </div>

      {/* approval route preview (approval matrix, ₹ X / ₹ Y) */}
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">Approval route
            <InfoTip title="Approval matrix (configurable)">Up to ₹ X lakh: Commodity Lead. Above ₹ X lakh: Commodity Lead → Sourcing Head. Currently X = {xLakh}.</InfoTip>
          </span>
          <span className="text-[11px] text-muted">X = ₹ {xLakh} L</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-slate-50 border border-line text-[12px]"><Icon name="UserCheck" size={13} className="text-brand-600" /><b className="font-semibold">Commodity Lead</b>{leadName && <span className="text-muted">· {leadName}</span>}</span>
          <AnimatePresence>
            {needsHead && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="inline-flex items-center gap-1.5">
                <Icon name="ArrowRight" size={12} className="text-slate-400" />
                <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-brand-50 border border-brand-200 text-[12px] text-brand-800"><Icon name="ShieldCheck" size={13} /><b className="font-semibold">Sourcing Head</b>{headName && <span className="opacity-70">· {headName}</span>}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="text-[11px] text-muted mt-1.5">{needsHead ? headReason : hasCommodity ? `Within ₹ ${xLakh} lakh — Commodity Lead approves` : 'Choose a commodity to see the approver'}</div>
      </div>

      {/* route strip from the lever (shown as "Category" on the form) — dropped on short screens so the panel always fits */}
      <div className="px-4 py-2.5 [@media(max-height:820px)]:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">What happens next</span>
          {lever && <RouteBadge route={lever.route} />}
        </div>
        {lever ? (
          <>
            <RouteStrip route={lever.route} compact />
            <div className="text-[11px] text-muted mt-1.5">Evaluator {lever.evaluator} · NPD sample {lever.npdSample}</div>
          </>
        ) : <div className="text-[12px] text-muted">Choose a category to see the route the idea will take.</div>}
      </div>
    </div>
  )
}

export function SavingsHero({ c, singleUnit }: { c: SavingsCalc; singleUnit?: PartCalc }) {
  const col = (v: number | null | undefined) => (v == null ? '#0f172a' : v > 0 ? '#0f9f6e' : v < 0 ? '#e0364f' : '#0f172a')
  return (
    <div className="shrink-0 px-4 pt-3 pb-3 border-b border-line bg-brand-50/40">
      <div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-brand-700"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>Savings summary</span>
          <span className="text-[10.5px] text-muted">Recalculates as you type</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[12px] text-ink-2 font-medium">Annualised impact</span>
          {c.isOpen && <Tooltip content="Rough annual impact entered for an open idea — marked Estimate"><span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold-50 text-gold-700 border border-gold-200">Estimate</span></Tooltip>}
          <InfoTip title="Annualised impact" formula={F('Annualised impact')}>Full-year saving at the new price and annual volume.</InfoTip>
        </div>
        <div className="flex items-end gap-2.5 mt-1">
          <span className="text-[26px] leading-none font-extrabold tracking-tight transition-colors duration-300" style={{ color: col(c.annual) }}><Money value={c.annual} /></span>
          <span className="mb-1"><PctBadge pct={c.pct} /></span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="rounded-lg bg-white border border-line px-2.5 py-1.5">
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">Saving / unit</div>
            <div className="text-[14px] font-bold num mt-0.5" style={{ color: singleUnit ? col(singleUnit.unit) : '#0f172a' }}>
              {c.isOpen ? '—' : singleUnit ? `${inrPrice(singleUnit.unit)} / ${singleUnit.uom}` : c.rows.length > 1 ? `${c.rows.length} parts · see below` : '₹ 0.00'}
            </div>
          </div>
          <div className="rounded-lg bg-white border border-line px-2.5 py-1.5">
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">Saving %</div>
            <div className="text-[14px] font-bold num mt-0.5" style={{ color: col(c.pct) }}>{c.pct == null ? 'Estimate' : `${c.pct.toFixed(2)}%`}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

