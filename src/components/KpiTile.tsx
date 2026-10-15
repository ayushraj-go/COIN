// KPI tile — one design for the Home, Innovation Network and Cost Optimisation dashboards.
// Label row (icon + label + info), a big value, a caption, and an optional monthly sparkline and 3-month trend chip.
import React, { useId } from 'react'
import { Icon, InfoTip, cn } from './ui'

/** Tiny area sparkline; values are plotted as given (one point per month) */
export function Spark({ values, color, className, hero }: { values: number[]; color: string; className?: string; hero?: boolean }) {
  const id = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const max = Math.max(...values), min = Math.min(0, ...values)
  const span = max - min || 1
  const pts = values.map((v, k) => [(k / (values.length - 1)) * 100, 26 - ((v - min) / span) * 22] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const stroke = hero ? '#ffffff' : color
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn('h-8 w-full overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={hero ? 0.28 : 0.2} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${line} 100,28`} fill={`url(#sp${id})`} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** ▲ / ▼ change chip — last 3 months against the 3 before */
export function TrendChip({ delta, hero, goodWhenUp = true }: { delta: number | null | undefined; hero?: boolean; goodWhenUp?: boolean }) {
  if (delta == null || !Number.isFinite(delta)) return null
  const up = delta >= 0
  const good = up === goodWhenUp
  return (
    <span title="Last 3 months vs the 3 months before"
      className={cn('inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full text-[11px] font-semibold num',
        hero ? 'bg-white/15 text-white' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      <Icon name={up ? 'TrendingUp' : 'TrendingDown'} size={11} />{Math.abs(delta) >= 100 ? Math.round(Math.abs(delta)) : Math.abs(delta).toFixed(0)}%
    </span>
  )
}

export function KpiTile({ label, icon, color = 'var(--color-brand-600)', tip, onClick, hero, spark, delta, goodWhenUp, children }: {
  label: string; icon: string; color?: string; tip: React.ReactNode; onClick: () => void; hero?: boolean
  spark?: number[]; delta?: number | null; goodWhenUp?: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={cn('group relative overflow-hidden text-left rounded-2xl p-4 pb-3.5 h-full w-full flex flex-col transition-all duration-200 focus-ring',
        hero ? 'bg-hero text-white shadow-[0_18px_38px_-22px_color-mix(in_srgb,var(--color-brand-950)_90%,transparent)] hover:-translate-y-px'
          : 'card hover:-translate-y-px hover:shadow-[0_14px_30px_-22px_color-mix(in_srgb,var(--color-brand-900)_55%,transparent)]')}>
      {hero && <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-accent-500" />}
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className="h-8 w-8 rounded-[10px] grid place-items-center shrink-0"
            style={hero ? { background: 'rgb(255 255 255 / .12)', color: '#fff' } : { background: `color-mix(in srgb, ${color} 9%, transparent)`, color }}>
            <Icon name={icon} size={15} />
          </span>
          <span className={cn('text-[12.5px] font-semibold truncate', hero ? 'text-white/85' : 'text-ink-2')}>{label}</span>
          <span onClick={(e) => e.stopPropagation()} className={hero ? '[&_svg]:text-white/60' : undefined}><InfoTip title={label}>{tip}</InfoTip></span>
        </span>
        {delta != null ? <TrendChip delta={delta} hero={hero} goodWhenUp={goodWhenUp} />
          : <Icon name="ArrowUpRight" size={15} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5', hero ? 'text-white/60' : 'text-muted')} />}
      </div>
      <div className="relative mt-3 flex-1">{children}</div>
      {spark && spark.length > 1 && <Spark values={spark} color={color} hero={hero} className="relative mt-2 -mb-1" />}
    </button>
  )
}

/** Big number + caption line used inside a tile */
export function TileValue({ value, unit, sub, hero }: { value: React.ReactNode; unit?: React.ReactNode; sub?: React.ReactNode; hero?: boolean }) {
  return (
    <>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={cn('text-[27px] leading-none font-bold tracking-[-0.02em]', hero ? 'text-white' : 'text-ink')}>{value}</span>
        {unit && <span className={cn('text-[11.5px] font-medium', hero ? 'text-white/70' : 'text-muted')}>{unit}</span>}
      </div>
      {sub && <div className={cn('text-[11.5px] mt-1.5 truncate', hero ? 'text-white/80' : 'text-muted')}>{sub}</div>}
    </>
  )
}
