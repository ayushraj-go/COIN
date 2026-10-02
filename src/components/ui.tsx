import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import * as Icons from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { motion, AnimatePresence } from 'motion/react'
import type { Bucket, Health } from '../lib/types'
import { BUCKET_STYLE, HEALTH_STYLE } from '../lib/calc'
import { LEVER_GROUP_STYLE } from '../lib/masters'
import { useStore } from '../store/useStore'
import { initials } from '../lib/format'
import { exportExcel } from '../lib/export'

export const cn = (...a: any[]) => clsx(...a)

// ─── Icon by name (lever master stores icon names) ────────────────────────────
export function Icon({ name, size = 16, className, style, strokeWidth = 2 }: { name: string; size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }) {
  const C = (Icons as any)[name] ?? Icons.Circle
  return <C size={size} className={className} style={style} strokeWidth={strokeWidth} />
}

// ─── Layout primitives ────────────────────────────────────────────────────────
/** fit: the title block shrinks (subtitle truncates) so the actions stay on the title row instead of wrapping below it */
export function PageHeader({ title, subtitle, actions, icon, badge, fit }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: string; badge?: React.ReactNode; fit?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', fit ? 'mb-4' : 'mb-5')}>
      <div className={cn('flex items-center gap-3 min-w-0', fit && 'flex-[1_1_340px]')}>
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-white border border-line text-brand-600 grid place-items-center shadow-[0_4px_12px_-6px_rgb(15_27_51/.25)] shrink-0">
            <Icon name={icon} size={18} strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] leading-tight font-bold tracking-[-0.02em] text-ink truncate">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className={cn('text-[12.5px] text-muted mt-0.5', fit ? 'truncate' : 'line-clamp-1')} title={fit && typeof subtitle === 'string' ? subtitle : undefined}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className={cn('flex flex-wrap items-center', fit ? 'gap-1.5 shrink-0' : 'gap-2')}>{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className, bodyClass, pad = true, icon, onClick, style }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; bodyClass?: string; pad?: boolean; icon?: string; onClick?: () => void; style?: React.CSSProperties
}) {
  return (
    <section className={cn('card flex flex-col min-w-0', onClick && 'cursor-pointer hover:border-[#d0d5dd] transition-colors', className)} onClick={onClick} style={style}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0 bg-brand-50 text-brand-600"><Icon name={icon} size={14} strokeWidth={2} /></span>}
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold text-ink truncate">{title}</h3>
              {subtitle && <p className="text-[11.5px] text-muted truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(pad && 'px-5 pb-5', !title && pad && 'pt-5', 'flex-1 min-h-0', bodyClass)}>{children}</div>
    </section>
  )
}

/** Magic-UI style spotlight card — radial glow follows the cursor */
export function SpotlightCard({ children, className, color = 'rgb(36 89 224 / .10)', onClick }: { children: React.ReactNode; className?: string; color?: string; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`)
        ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      className={cn('group relative overflow-hidden card transition-colors duration-200 hover:border-[#d0d5dd]', onClick && 'cursor-pointer', className)}
    >
      
      <div className="relative">{children}</div>
    </div>
  )
}

/** Animated conic border beam for hero surfaces */
export function BorderBeam({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 rounded-[inherit] [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude] p-px', className)}>
      <div className="absolute -inset-[100%] animate-[spin_6s_linear_infinite]" style={{ background: 'conic-gradient(from 0deg, transparent 0 290deg, #a6b3ff 320deg, #4470d6 340deg, #d4a85a 355deg, transparent 360deg)' }} />
    </div>
  )
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'dark'
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, children, className, loading, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'xs' | 'sm' | 'md' | 'lg'; icon?: string; iconRight?: string; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-brand-grad text-white hover:brightness-110 shadow-[0_6px_16px_-8px_rgb(36_89_224/.75)] border border-brand-700/30',
    secondary: 'bg-white text-ink-2 border border-[#d0d5dd] hover:bg-[#f9fafb] hover:text-ink shadow-[0_1px_2px_rgb(16_24_40/.05)]',
    ghost: 'text-ink-2 hover:bg-[#f2f4f7] hover:text-ink border border-transparent',
    danger: 'bg-white text-[#d02a45] border border-[#f6c9d1] hover:bg-[#fff1f3] hover:border-[#efa9b6]',
    success: 'bg-gradient-to-br from-accent-400 to-accent-600 text-white hover:brightness-110 border border-accent-600/30 shadow-[0_6px_16px_-8px_rgb(11_138_119/.7)]',
    outline: 'bg-transparent text-brand-700 border border-brand-200 hover:bg-brand-50',
    dark: 'bg-[#101828] text-white hover:bg-[#1d2939] border border-[#101828] shadow-[0_1px_2px_rgb(16_24_40/.08)]',
  }
  const s = { xs: 'h-7 px-2 text-[12px] gap-1 rounded-md', sm: 'h-8 px-2.5 text-[12.5px] gap-1.5 rounded-lg', md: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-lg', lg: 'h-10 px-4 text-[13.5px] gap-2 rounded-lg' }[size]
  return (
    <button {...rest} disabled={rest.disabled || loading} className={cn('inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none focus-ring', v[variant], s, className)}>
      {loading ? <Icons.Loader2 size={14} className="animate-spin" /> : icon ? <Icon name={icon} size={size === 'xs' ? 13 : 15} /> : null}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  )
}
export function IconButton({ icon, title, onClick, className, active, badge }: { icon: string; title?: string; onClick?: (e: React.MouseEvent) => void; className?: string; active?: boolean; badge?: number }) {
  return (
    <button title={title} onClick={onClick} className={cn('relative h-8 w-8 grid place-items-center rounded-lg text-muted hover:bg-[#f2f4f7] hover:text-ink transition focus-ring', active && 'bg-[#f2f4f7] text-ink', className)}>
      <Icon name={icon} size={16} />
      {!!badge && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#e0364f] text-white text-[10px] font-bold grid place-items-center ring-2 ring-white">{badge > 99 ? '99+' : badge}</span>}
    </button>
  )
}

// ─── Badges & chips ───────────────────────────────────────────────────────────
export function Badge({ children, color = '#64748b', soft, className, dot, icon }: { children: React.ReactNode; color?: string; soft?: string; className?: string; dot?: boolean; icon?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap border', className)} style={{ color, background: soft ?? `${color}12`, borderColor: `${color}24` }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
export const BucketBadge = ({ bucket }: { bucket: Bucket }) => { const s = BUCKET_STYLE[bucket]; return <Badge color={s.color} soft={s.soft} dot>{s.label}</Badge> }
export const HealthBadge = ({ health }: { health: Health }) => { const s = HEALTH_STYLE[health]; return <Badge color={s.color} soft={s.soft} icon={health === 'On track' ? 'CircleCheck' : health === 'At risk' ? 'TriangleAlert' : 'Clock3'}>{health}</Badge> }
export function StageBadge({ stage, bucket }: { stage: string; bucket: Bucket }) {
  const s = BUCKET_STYLE[bucket]
  return <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />{stage}</span>
}
export function LeverChip({ leverId, compact }: { leverId: string; compact?: boolean }) {
  const lever = useStore((s) => s.levers.find((l) => l.id === leverId))
  if (!lever) return null
  const g = LEVER_GROUP_STYLE[lever.group]
  return (
    <span className="inline-flex items-center gap-1.5 h-[22px] pl-1 pr-2 rounded-md text-[11.5px] font-medium whitespace-nowrap max-w-[160px] min-w-0" style={{ background: g.soft, color: g.text }} title={`${lever.group} · ${lever.name}`}>
      <span className="h-4 w-4 rounded grid place-items-center shrink-0" style={{ background: g.color, color: '#fff' }}><Icon name={lever.icon} size={10} strokeWidth={2.5} /></span>
      <span className="truncate">{compact ? lever.name.split(' ')[0] : lever.name}</span>
    </span>
  )
}
export function SavingsTypeBadge({ type }: { type: string }) {
  const c = type === 'Hard' ? '#0f9f6e' : type === 'Cost avoidance' ? '#0284c7' : '#7c3aed'
  return <Badge color={c}>{type}</Badge>
}
export function SlaPill({ state, left, working }: { state: string; left: number; working: number }) {
  if (state === 'none') return <span className="text-[11.5px] text-muted">—</span>
  const map: Record<string, [string, string]> = { ok: ['#0f9f6e', `${left}d left`], due: ['#ec8a1c', `${left}d left`], breach: ['#e0364f', `${-left}d over`], escalated: ['#a3143a', `Escalated · ${-left}d`] }
  const [c, l] = map[state] ?? ['#64748b', '']
  return <Badge color={c} icon={state === 'ok' ? 'Timer' : state === 'due' ? 'AlarmClock' : 'Siren'}>{l}</Badge>
}
export function AgeBadge({ days }: { days: number }) {
  const c = days > 20 ? '#e0364f' : days > 10 ? '#ec8a1c' : '#64748b'
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 h-5 rounded" style={{ color: c, background: `${c}12` }}><Icons.Hourglass size={10} />{days}d</span>
}

// ─── Avatars ──────────────────────────────────────────────────────────────────
export function Avatar({ name, color = '#2f5bc6', size = 28, ring }: { name: string; color?: string; size?: number; ring?: boolean }) {
  return (
    <span className={cn('inline-grid place-items-center rounded-full font-bold text-white shrink-0 select-none', ring && 'ring-2 ring-white')} style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, ${color}cc)` }} title={name}>
      {initials(name)}
    </span>
  )
}
export function UserChip({ userId, size = 22 }: { userId?: string; size?: number }) {
  const u = useStore((s) => s.users.find((x) => x.id === userId))
  if (!u) return <span className="text-muted">—</span>
  return <span className="inline-flex items-center gap-1.5 min-w-0"><Avatar name={u.name} color={u.avatarColor} size={size} /><span className="truncate text-[12.5px]">{u.name}</span></span>
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────
export function Tooltip({ content, children, side = 'top', className }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom'; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLSpanElement>(null)
  const show = () => {
    const r = ref.current!.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: side === 'top' ? r.top - 8 : r.bottom + 8 })
    setOpen(true)
  }
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={() => setOpen(false)} className={cn('inline-flex', className)}>
      {children}
      {open && createPortal(
        <div className="fixed z-[200] pointer-events-none animate-fade-in" style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})` }}>
          <div className="max-w-[300px] rounded-xl glass-strong text-ink text-[11.5px] leading-snug px-3 py-2 shadow-[0_12px_32px_-12px_rgb(14_19_48/.35)] ring-1 ring-brand-100">{content}</div>
        </div>, document.body)}
    </span>
  )
}
/** Hover tooltip explaining a KPI / formula (Section 14) */
export function InfoTip({ title, formula, children }: { title?: string; formula?: string; children?: React.ReactNode }) {
  return (
    <Tooltip content={<div>{title && <div className="font-semibold mb-0.5">{title}</div>}{formula && <div className="font-mono text-[10.5px] text-brand-700 bg-brand-50 rounded px-1.5 py-0.5 mt-0.5">{formula}</div>}{children && <div className="mt-1 text-muted">{children}</div>}</div>}>
      <Icons.Info size={12.5} className="text-[#a3a9c2] hover:text-brand-600 cursor-help transition-colors" />
    </Tooltip>
  )
}

// ─── KPI cards with sparklines & count-up ─────────────────────────────────────
export function Sparkline({ data, color = '#2f5bc6', height = 28, width = 96, fill = true }: { data: number[]; color?: string; height?: number; width?: number; fill?: boolean }) {
  if (!data?.length) return null
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * width, height - 2 - ((v - min) / (max - min || 1)) * (height - 4)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const id = useMemo(() => `sg${Math.random().toString(36).slice(2, 8)}`, [])
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="[stroke-dasharray:400] [stroke-dashoffset:400] animate-[dash_1.2s_ease-out_forwards]" style={{ animationName: 'none', strokeDasharray: 'none', strokeDashoffset: 0 }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.6} fill={color} />
    </svg>
  )
}

/** Animated ₹ value — lakh/crore aware */
export function Money({ value, className, digits = 2, unit }: { value: number; className?: string; digits?: number; unit?: 'Cr' | 'L' | 'auto' }) {
  const a = Math.abs(value || 0)
  const u = unit && unit !== 'auto' ? unit : a >= 1e7 ? 'Cr' : a >= 1e5 ? 'L' : ''
  const v = u === 'Cr' ? value / 1e7 : u === 'L' ? value / 1e5 : value
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      ₹&nbsp;<NumberFlow value={Number.isFinite(v) ? v : 0} format={{ minimumFractionDigits: u ? digits : 0, maximumFractionDigits: u ? digits : 0 }} locales="en-IN" />
      {u && <span className="ml-0.5 text-[0.72em] font-semibold opacity-70">{u}</span>}
    </span>
  )
}
export function Count({ value, className, suffix, digits = 0 }: { value: number; className?: string; suffix?: string; digits?: number }) {
  return <span className={cn('num', className)}><NumberFlow value={Number.isFinite(value) ? value : 0} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} locales="en-IN" />{suffix}</span>
}

export function KpiCard({ label, value, money = true, suffix, digits, sub, delta, spark, color = '#2f5bc6', icon, tip, formula, onClick, active, className }: {
  label: string; value: number; money?: boolean; suffix?: string; digits?: number; sub?: React.ReactNode; delta?: number; spark?: number[]; color?: string; icon?: string; tip?: string; formula?: string; onClick?: () => void; active?: boolean; className?: string
}) {
  return (
    <SpotlightCard onClick={onClick} color={`${color}1c`} className={cn('p-4 min-w-0', active && 'ring-2 ring-offset-1', className)}>
      <div style={active ? ({ ['--tw-ring-color' as any]: color } as any) : undefined} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <Icon name={icon} size={14} className="shrink-0 text-[#98a2b3]" />}
          <span className="text-[12px] font-medium text-muted truncate">{label}</span>
          {(tip || formula) && <InfoTip title={label} formula={formula}>{tip}</InfoTip>}
        </div>
        {delta != null && (
          <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold rounded px-1', delta >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50')}>
            {delta >= 0 ? <Icons.TrendingUp size={11} /> : <Icons.TrendingDown size={11} />}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 mt-3">
        <div className="min-w-0">
          <div className="text-[22px] leading-none font-bold tracking-[-0.02em] text-ink font-display">
            {money ? <Money value={value} /> : <Count value={value} suffix={suffix} digits={digits} />}
          </div>
          {sub && <div className="text-[11.5px] text-muted mt-1.5 truncate">{sub}</div>}
        </div>
        {spark && <Sparkline data={spark} color={color} />}
      </div>
      {active && <div className="absolute left-0 right-0 bottom-0 h-0.5" style={{ background: color }} />}
    </SpotlightCard>
  )
}

// ─── Gauge: FY target vs landing ──────────────────────────────────────────────
export function Gauge({ value, max, marker, label, sub, size = 220, color = '#0f9f6e' }: { value: number; max: number; marker?: number; label?: React.ReactNode; sub?: React.ReactNode; size?: number; color?: string }) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2
  const frac = Math.max(0, Math.min(1, value / (max || 1)))
  const arc = (f: number) => { const a = Math.PI * (1 - f); return [cx + r * Math.cos(a), cy - r * Math.sin(a)] }
  const [ex, ey] = arc(frac)
  const mk = marker != null ? arc(Math.max(0, Math.min(1, marker / (max || 1)))) : null
  const [draw, setDraw] = useState(0)
  useEffect(() => { const t = setTimeout(() => setDraw(1), 60); return () => clearTimeout(t) }, [])
  const len = Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 26 }}>
      <svg width={size} height={size / 2 + 12} className="overflow-visible">
        <defs>
          <linearGradient id="gaugeG" x1="0" x2="1"><stop offset="0%" stopColor="#e0364f" /><stop offset="55%" stopColor="#ec8a1c" /><stop offset="100%" stopColor={color} /></linearGradient>
        </defs>
        <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="#eceef6" strokeWidth={16} strokeLinecap="round" />
        <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="url(#gaugeG)" strokeWidth={16} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - frac * draw)} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }} />
        {mk && <g><line x1={mk[0]} y1={mk[1]} x2={cx + (mk[0] - cx) * 0.78} y2={cy + (mk[1] - cy) * 0.78} stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" /></g>}
        <circle cx={ex} cy={ey} r={draw ? 6 : 0} fill="#fff" stroke={color} strokeWidth={3} style={{ transition: 'r .4s .9s' }} />
      </svg>
      <div className="absolute inset-x-0 text-center" style={{ top: size / 2 - 38 }}>
        <div className="text-[24px] font-bold tracking-tight text-ink leading-none">{label}</div>
        {sub && <div className="text-[11.5px] text-muted mt-1">{sub}</div>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, color = '#2f5bc6', height = 6, className, bg = '#eceef6' }: { value: number; color?: string; height?: number; className?: string; bg?: string }) {
  return (
    <div className={cn('w-full rounded-full overflow-hidden', className)} style={{ height, background: bg }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full" style={{ background: color }} />
    </div>
  )
}

// ─── Tabs & segmented ─────────────────────────────────────────────────────────
export function Tabs({ tabs, value, onChange, className, layoutId = 'tabs' }: { tabs: { key: string; label: React.ReactNode; count?: number; icon?: string }[]; value: string; onChange: (k: string) => void; className?: string; layoutId?: string }) {
  return (
    <div className={cn('no-scrollbar flex items-center gap-1 border-b border-line overflow-x-auto overflow-y-hidden', className)}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={cn('relative h-10 px-2.5 text-[13px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors', value === t.key ? 'text-brand-700 font-semibold' : 'text-muted hover:text-ink')}>
          {t.icon && <Icon name={t.icon} size={14} />}
          {t.label}
          {t.count != null && <span className={cn('min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold grid place-items-center transition-colors', value === t.key ? 'bg-brand-grad text-white' : 'bg-brand-50 text-brand-700')}>{t.count}</span>}
          {value === t.key && <motion.span layoutId={layoutId} className="absolute left-1 right-1 bottom-0 h-[2px] rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  )
}
export function Segmented({ options, value, onChange, size = 'md' }: { options: { key: string; label: React.ReactNode; icon?: string }[]; value: string; onChange: (k: string) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-brand-50/80 border border-brand-100">
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)} className={cn('relative flex items-center gap-1.5 font-medium rounded-md transition-colors', size === 'sm' ? 'h-7 px-2.5 text-[12px] rounded-md' : 'h-8 px-3 text-[12.5px] rounded-md', value === o.key ? 'text-brand-700' : 'text-muted hover:text-ink')}>
          {value === o.key && <motion.span layoutId={`seg-${options.map((x) => x.key).join('')}`} className="absolute inset-0 bg-white rounded-md shadow-[0_1px_2px_rgb(16_24_40/.1)]" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
          <span className="relative flex items-center gap-1.5">{o.icon && <Icon name={o.icon} size={13} />}{o.label}</span>
        </button>
      ))}
    </div>
  )
}
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('inline-flex items-center gap-2 select-none', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-[#d0d5dd]')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {label && <span className="text-[13px] text-ink-2">{label}</span>}
    </label>
  )
}
export function Chip({ active, children, onClick, onRemove, color }: { active?: boolean; children: React.ReactNode; onClick?: () => void; onRemove?: () => void; color?: string }) {
  return (
    <span onClick={onClick} className={cn('inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-medium border cursor-pointer transition-colors select-none', active ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-ink-2 border-line hover:bg-[#f9fafb]')} style={active && color ? { background: `${color}12`, borderColor: `${color}40`, color } : undefined}>
      {children}
      {onRemove && <Icons.X size={12} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onRemove() }} />}
    </span>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────
export function Field({ label, required, hint, children, className, tag, error }: { label: React.ReactNode; required?: boolean; hint?: React.ReactNode; children: React.ReactNode; className?: string; tag?: React.ReactNode; error?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="label justify-between"><span className="flex items-center gap-1">{label}{required && <span className="text-brand-600">*</span>}</span>{tag}</div>
      {children}
      {error ? <div className="text-[11.5px] text-red-600 mt-1">{error}</div> : hint ? <div className="text-[11.5px] text-muted mt-1">{hint}</div> : null}
    </div>
  )
}
export function SourceTag({ children, color = '#a07433' }: { children: React.ReactNode; color?: string }) {
  return <span className="text-[10.5px] font-medium px-1.5 py-px rounded whitespace-nowrap" style={{ color, background: `${color}14` }}>{children}</span>
}

// ─── Overlays ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', icon }: { open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: string }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-3 sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#101828]/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }} className={cn('relative w-full bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgb(16_24_40/.25)] flex flex-col max-h-[90vh] overflow-hidden', w)}>
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-line">
              <div className="flex items-center gap-3">
                {icon && <div className="h-9 w-9 rounded-lg border border-line text-brand-600 grid place-items-center"><Icon name={icon} size={17} /></div>}
                <div><h3 className="text-[15px] font-semibold text-ink">{title}</h3>{subtitle && <p className="text-[12px] text-muted mt-0.5">{subtitle}</p>}</div>
              </div>
              <IconButton icon="X" onClick={onClose} />
            </div>
            <div className="px-5 py-4 overflow-y-auto">{children}</div>
            {footer && <div className="px-5 py-3 border-t border-line bg-[#f7f8fc] flex items-center justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
export function Drawer({ open, onClose, children, width = 640, title, subtitle, actions }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number; title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#101828]/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', duration: 0.45, bounce: 0.08 }} className="absolute right-0 top-0 bottom-0 bg-canvas shadow-2xl flex flex-col w-full" style={{ maxWidth: width }}>
            {(title || actions) && (
              <div className="relative flex items-start justify-between gap-3 px-5 py-3.5 bg-white border-b border-line">
                <div className="min-w-0"><div className="text-[15px] font-bold text-ink truncate">{title}</div>{subtitle && <div className="text-[12px] text-muted truncate">{subtitle}</div>}</div>
                <div className="flex items-center gap-1.5 shrink-0">{actions}<IconButton icon="X" onClick={onClose} /></div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Confirm / remarks prompt — remarks mandatory on negative actions (Section 8, M5) */
export function RemarksModal({ open, onClose, onConfirm, title, subtitle, required = true, confirmLabel = 'Confirm', variant = 'primary', icon = 'MessageSquareText', children, placeholder = 'Add remarks…' }: {
  open: boolean; onClose: () => void; onConfirm: (remarks: string) => void; title: string; subtitle?: string; required?: boolean; confirmLabel?: string; variant?: BtnVariant; icon?: string; children?: React.ReactNode; placeholder?: string
}) {
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText('') }, [open])
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} icon={icon} size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={variant} disabled={required && !text.trim()} onClick={() => { onConfirm(text.trim()); onClose() }}>{confirmLabel}</Button></>}>
      {children}
      <Field label="Remarks" required={required}><textarea autoFocus className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} /></Field>
    </Modal>
  )
}

// ─── Empty & loading states ───────────────────────────────────────────────────
export function EmptyState({ icon = 'Inbox', title, desc, action, className }: { icon?: string; title: string; desc?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-10 px-6', className)}>
      <div className="relative mb-3">
        
        <div className="relative h-11 w-11 rounded-[10px] border border-line bg-white grid place-items-center text-muted shadow-[0_1px_2px_rgb(16_24_40/.05)]"><Icon name={icon} size={20} /></div>
      </div>
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {desc && <div className="text-[12.5px] text-muted mt-1 max-w-sm">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) { return <div className={cn('skeleton rounded-md', className)} style={style} /> }
/** Show skeleton for a brief moment on mount (skeleton loaders instead of blank screens) */
export function useWarmup(ms = 350) {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), ms); return () => clearTimeout(t) }, [ms])
  return ready
}
export function SkeletonGrid({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}</div>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
    </div>
  )
}

// ─── Stagger container (fade-and-rise entrance) ───────────────────────────────
export function Stagger({ children, className, delay = 0.04 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: delay } } }}>
      {React.Children.map(children, (c) => (c ? <motion.div className="min-w-0" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', duration: 0.5, bounce: 0.1 } } }}>{c}</motion.div> : null))}
    </motion.div>
  )
}

// ─── Generic data table: sort, column chooser, density toggle, export ─────────
export interface Column<T> { key: string; label: React.ReactNode; render?: (row: T) => React.ReactNode; value?: (row: T) => any; align?: 'left' | 'right' | 'center'; width?: number | string; hidden?: boolean; exportLabel?: string; sticky?: boolean }
export function DataTable<T>({ rows, columns, onRowClick, rowKey, exportName, toolbar, maxHeight = 560, empty, selectable, selected, onSelect, footer, dense }: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (r: T) => void; rowKey: (r: T) => string; exportName?: string; toolbar?: React.ReactNode; maxHeight?: number | string; empty?: React.ReactNode; selectable?: boolean; selected?: Set<string>; onSelect?: (s: Set<string>) => void; footer?: React.ReactNode; dense?: boolean
}) {
  const density = useStore((s) => s.settings.density)
  const setDensity = useStore((s) => s.setDensity)
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.hidden).map((c) => c.key)))
  const [chooser, setChooser] = useState(false)
  const [page, setPage] = useState(1)
  const per = 100
  const visible = columns.filter((c) => !hidden.has(c.key))
  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.value ?? ((r: any) => r[col.key])
    return [...rows].sort((a, b) => { const va = get(a), vb = get(b); return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir })
  }, [rows, sort, columns])
  const paged = sorted.slice(0, page * per)
  const allSel = selectable && rows.length > 0 && rows.every((r) => selected?.has(rowKey(r)))
  const doExport = () => {
    const data = sorted.map((r) => Object.fromEntries(visible.map((c) => [c.exportLabel ?? (typeof c.label === 'string' ? c.label : c.key), c.value ? c.value(r) : (r as any)[c.key]])))
    exportExcel(exportName || 'COIN_export', [{ name: 'Data', rows: data }])
  }
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">{toolbar}</div>
        <div className="flex items-center gap-1.5 relative">
          <span className="text-[12px] text-muted mr-1 num">{rows.length.toLocaleString('en-IN')} rows</span>
          <Segmented size="sm" value={density} onChange={(k) => setDensity(k as any)} options={[{ key: 'compact', label: '', icon: 'Rows4' }, { key: 'comfortable', label: '', icon: 'Rows3' }]} />
          <Button size="sm" icon="Columns3" onClick={() => setChooser((v) => !v)}>Columns</Button>
          {exportName && <Button size="sm" icon="FileSpreadsheet" onClick={doExport}>Excel</Button>}
          {chooser && (
            <div className="absolute right-0 top-10 z-30 w-60 card shadow-xl p-2 animate-pop" onMouseLeave={() => setChooser(false)}>
              <div className="text-[10.5px] font-bold uppercase tracking-[.1em] text-muted px-2 py-1">Column chooser</div>
              <div className="max-h-72 overflow-y-auto">
                {columns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer text-[12.5px]">
                    <input type="checkbox" className="accent-brand-600" checked={!hidden.has(c.key)} onChange={() => setHidden((h) => { const n = new Set(h); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n })} />
                    {c.exportLabel ?? c.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className={cn('tbl', (density === 'comfortable' && !dense) && 'comfortable')}>
          <thead>
            <tr>
              {selectable && <th style={{ width: 36 }}><input type="checkbox" className="accent-brand-600" checked={!!allSel} onChange={() => onSelect?.(allSel ? new Set() : new Set(rows.map(rowKey)))} /></th>}
              {visible.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align }} className="cursor-pointer select-none hover:text-ink" onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                  <span className="inline-flex items-center gap-1">{c.label}{sort?.key === c.key && (sort.dir === 1 ? <Icons.ArrowUp size={11} /> : <Icons.ArrowDown size={11} />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const k = rowKey(r)
              return (
                <tr key={k} className={cn(onRowClick && 'clickable', selected?.has(k) && 'bg-brand-50/50')} onClick={() => onRowClick?.(r)}>
                  {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-brand-600" checked={!!selected?.has(k)} onChange={() => { const n = new Set(selected); n.has(k) ? n.delete(k) : n.add(k); onSelect?.(n) }} /></td>}
                  {visible.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render ? c.render(r) : String((r as any)[c.key] ?? '—')}</td>)}
                </tr>
              )
            })}
          </tbody>
          {footer}
        </table>
        {!rows.length && (empty ?? <EmptyState title="Nothing to show" desc="Try clearing a filter." />)}
        {paged.length < sorted.length && <div className="p-3 text-center"><Button size="sm" onClick={() => setPage((p) => p + 1)}>Load more ({sorted.length - paged.length})</Button></div>}
      </div>
    </div>
  )
}

// ─── Stat row (label / value) ─────────────────────────────────────────────────
export function Stat({ label, value, className, tone }: { label: React.ReactNode; value: React.ReactNode; className?: string; tone?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[12px] font-medium text-muted truncate">{label}</div>
      <div className="text-[14px] font-bold text-ink mt-0.5 truncate num" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  )
}
export function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3 py-1.5 border-b border-dashed border-[#e3e6f0] last:border-0 text-[12.5px]"><span className="text-muted shrink-0">{k}</span><span className="font-medium text-ink text-right min-w-0">{v}</span></div>
}
