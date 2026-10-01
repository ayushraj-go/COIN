// Campaign workspace — calm, neutral building blocks (tabs, KPI strip, flow stepper, pills, pager, funnel bar).
// Neutral surfaces first; brand blue only for the active / primary element, teal only for replies.
import React from 'react'
import { motion } from 'motion/react'
import { useStore } from '../../store/useStore'
import { timeAgo } from '../../lib/format'
import { Icon, cn } from '../../components/ui'

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function LineTabs({ tabs, value, onChange, right }: { tabs: { key: string; label: string; count?: number; dot?: boolean }[]; value: string; onChange: (k: string) => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-b border-line mb-4">
      <div className="flex items-center gap-5 min-w-0">
        {tabs.map((t) => {
          const on = t.key === value
          return (
            <button key={t.key} type="button" onClick={() => onChange(t.key)}
              className={cn('relative h-10 inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap transition-colors', on ? 'text-ink font-semibold' : 'text-muted hover:text-ink font-medium')}>
              {t.label}
              {t.count != null && (
                <span className={cn('min-w-[20px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold grid place-items-center num', on ? 'bg-ink text-white' : 'bg-slate-100 text-ink-2')}>{t.count}</span>
              )}
              {t.dot && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
              {on && <motion.span layoutId="cmp-line-tab" className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-ink" />}
            </button>
          )
        })}
      </div>
      {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  )
}

// ─── Segmented (neutral) ──────────────────────────────────────────────────────
export function Seg<T extends string>({ options, value, onChange }: { options: { key: T; label: React.ReactNode; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-line">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" onClick={() => onChange(o.key)}
            className={cn('h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap', on ? 'bg-white text-ink shadow-[0_1px_2px_rgb(16_24_40/.08)]' : 'text-muted hover:text-ink')}>
            {o.label}
            {o.count != null && <span className={cn('text-[11px] num', on ? 'text-ink-2' : 'text-muted')}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Pills ────────────────────────────────────────────────────────────────────
export type PillTone = 'neutral' | 'live' | 'blue' | 'amber' | 'red' | 'teal' | 'muted'
const PILL: Record<PillTone, string> = {
  neutral: 'bg-white text-ink-2 border-line',
  muted: 'bg-slate-50 text-muted border-line',
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  teal: 'bg-accent-50 text-accent-700 border-accent-100',
  blue: 'bg-brand-50 text-brand-700 border-brand-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}
const DOT: Record<PillTone, string> = { neutral: 'bg-slate-400', muted: 'bg-slate-300', live: 'bg-emerald-500', teal: 'bg-accent-500', blue: 'bg-brand-600', amber: 'bg-amber-500', red: 'bg-red-500' }
export function Pill({ tone = 'neutral', dot, icon, children, className, title }: { tone?: PillTone; dot?: boolean; icon?: string; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md border text-[11.5px] font-medium whitespace-nowrap', PILL[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} />}
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  )
}
/** "via Supplier Portal" provenance tag — every supplier response carries it */
export const PortalTag = () => <Pill tone="muted" icon="ExternalLink">via Supplier Portal</Pill>

// ─── Supplier Portal connection indicator ─────────────────────────────────────
export function PortalIndicator({ onSync }: { onSync?: () => void }) {
  const syncAt = useStore((s) => s.supplierPortalSyncAt)
  return (
    <span className="inline-flex items-center gap-2 h-8 pl-2.5 pr-1 rounded-lg border border-line bg-white text-[12px] text-ink-2 whitespace-nowrap">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
      <span><b className="font-semibold text-ink">Supplier Portal</b><span className="text-muted"> · connected · last sync {syncAt ? timeAgo(syncAt) : 'just now'}</span></span>
      {onSync ? (
        <button type="button" onClick={onSync} title="Sync now" className="h-6 w-6 grid place-items-center rounded-md text-muted hover:bg-slate-100 hover:text-ink"><Icon name="RefreshCw" size={13} /></button>
      ) : <span className="w-1" />}
    </span>
  )
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
export interface Kpi { label: string; value: React.ReactNode; sub?: React.ReactNode; tip?: string }
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className={cn('card grid grid-cols-2 md:grid-cols-3 gap-px !bg-line overflow-hidden', items.length === 4 ? 'md:grid-cols-4' : items.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-6')}>
      {items.map((k) => (
        <div key={k.label} title={k.tip} className="bg-white px-4 py-3 min-w-0">
          <div className="text-[12px] text-muted truncate">{k.label}</div>
          <div className="text-[22px] leading-tight font-semibold text-ink num tracking-[-0.01em] mt-0.5">{k.value}</div>
          {k.sub != null && <div className="text-[11.5px] text-muted truncate mt-0.5">{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Flow stepper — the six-step supplier innovation flow ─────────────────────
export interface FlowStep { label: string; value: number; caption: string; onClick?: () => void; tip?: string }
export function FlowStepper({ steps, title, note }: { steps: FlowStep[]; title: string; note?: React.ReactNode }) {
  return (
    <div className="card px-4 pt-3 pb-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[12.5px] font-semibold text-ink">{title}</span>
        {note && <span className="text-[11.5px] text-muted truncate">{note}</span>}
      </div>
      <ol className="grid grid-cols-3 lg:grid-cols-6 gap-y-3">
        {steps.map((s, i) => {
          const reached = s.value > 0
          const Comp: any = s.onClick ? 'button' : 'div'
          return (
            <li key={s.label} className="relative min-w-0">
              {/* connector */}
              {i < steps.length - 1 && <span className={cn('absolute top-[9px] left-[22px] right-1 h-px', reached && steps[i + 1].value > 0 ? 'bg-brand-300' : 'bg-line')} />}
              <Comp type={s.onClick ? 'button' : undefined} onClick={s.onClick} title={s.tip} className={cn('relative block w-full text-left pr-3', s.onClick && 'group')}>
                <span className={cn('relative z-[1] h-[19px] w-[19px] rounded-full grid place-items-center text-[10.5px] font-semibold border', reached ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-line text-muted')}>{i + 1}</span>
                <span className={cn('block mt-1.5 text-[12px] font-medium text-ink-2 truncate', s.onClick && 'group-hover:text-ink group-hover:underline underline-offset-2')}>{s.label}</span>
                <span className="block text-[18px] leading-tight font-semibold text-ink num">{s.value}</span>
                <span className="block text-[11.5px] text-muted truncate">{s.caption}</span>
              </Comp>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ─── Pager ────────────────────────────────────────────────────────────────────
export function usePaged<T>(rows: T[], size: number, page: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(page, pages - 1)
  return { slice: rows.slice(p * size, p * size + size), pages, page: p, from: rows.length ? p * size + 1 : 0, to: Math.min(rows.length, p * size + size), total: rows.length }
}
export function Pager({ page, pages, from, to, total, onPage, noun = 'items', className }: { page: number; pages: number; from: number; to: number; total: number; onPage: (p: number) => void; noun?: string; className?: string }) {
  if (total === 0) return null
  return (
    <div className={cn('flex items-center gap-2 text-[12px] text-muted', className)}>
      <span className="num">{from}–{to} of {total} {noun}</span>
      {pages > 1 && (
        <span className="ml-auto inline-flex items-center gap-1">
          <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="h-7 w-7 grid place-items-center rounded-md border border-line bg-white text-ink-2 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none" aria-label="Previous page"><Icon name="ChevronLeft" size={14} /></button>
          <span className="px-1.5 num text-ink-2">{page + 1} / {pages}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="h-7 w-7 grid place-items-center rounded-md border border-line bg-white text-ink-2 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none" aria-label="Next page"><Icon name="ChevronRight" size={14} /></button>
        </span>
      )}
    </div>
  )
}

// ─── Funnel bar — sent → opened → replied → ideas → approved ──────────────────
export const FUNNEL_COLORS = { opened: '#cbd5e1', replied: '#33c6aa', ideas: '#5e93fb', approved: '#1d47c0' }
export function FunnelBar({ sent, opened, replied, ideas, approved, compact }: { sent: number; opened: number; replied: number; ideas: number; approved: number; compact?: boolean }) {
  const w = (n: number) => `${sent ? Math.min(100, (n / sent) * 100) : 0}%`
  const segs: [string, number, string][] = [['Opened', opened, FUNNEL_COLORS.opened], ['Replied', replied, FUNNEL_COLORS.replied], ['Ideas', ideas, FUNNEL_COLORS.ideas], ['Approved', approved, FUNNEL_COLORS.approved]]
  return (
    <div className="min-w-0">
      <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
        {segs.map(([k, n, c]) => <motion.span key={k} initial={{ width: 0 }} animate={{ width: w(n) }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="absolute left-0 top-0 bottom-0 rounded-full" style={{ background: c }} />)}
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-center gap-x-2.5 text-[11.5px] text-muted num whitespace-nowrap">
          <span><b className="font-semibold text-ink">{sent}</b> sent</span>
          <span><b className="font-semibold text-ink">{opened}</b> opened</span>
          <span><b className="font-semibold text-accent-700">{replied}</b> replied</span>
          <span><b className="font-semibold text-ink">{ideas}</b> ideas</span>
          <span><b className="font-semibold text-ink">{approved}</b> approved</span>
        </div>
      )}
    </div>
  )
}

/** Neutral section card: title row + optional actions, no coloured icon tile */
export function Panel({ title, sub, actions, children, className, pad = true }: { title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('card min-w-0 flex flex-col', className)}>
      {(title || actions) && (
        <header className="flex items-center gap-2 px-4 h-11 border-b border-line shrink-0">
          <div className="min-w-0 flex items-baseline gap-2">
            {title && <h3 className="text-[13px] font-semibold text-ink truncate">{title}</h3>}
            {sub && <span className="text-[11.5px] text-muted truncate">{sub}</span>}
          </div>
          {actions && <div className="ml-auto flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1 min-h-0', pad && 'p-4')}>{children}</div>
    </section>
  )
}

/** Small text link-button */
export function LinkBtn({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-ink-2 hover:bg-slate-100 hover:text-ink">
      {children}{icon && <Icon name={icon} size={13} />}
    </button>
  )
}

/** Tri-state checkbox */
export function Check({ state, onChange, label }: { state: boolean | 'mixed'; onChange: () => void; label?: string }) {
  return (
    <span role="checkbox" tabIndex={0} aria-checked={state === 'mixed' ? 'mixed' : state} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange() }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onChange() } }}
      className={cn('h-4 w-4 rounded-[4px] border grid place-items-center shrink-0 transition-colors cursor-pointer', state ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 hover:border-slate-400')}>
      {state === 'mixed' ? <span className="h-[2px] w-2 bg-white rounded" /> : state ? <Icon name="Check" size={11} strokeWidth={3} /> : null}
    </span>
  )
}
