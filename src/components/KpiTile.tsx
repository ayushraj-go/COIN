// CO-style KPI tile — one design for the Home, Innovation Network and Cost Optimisation dashboards.
import React from 'react'
import { Icon, InfoTip, cn } from './ui'

export function KpiTile({ label, icon, color, tip, onClick, hero, children }: { label: string; icon: string; color: string; tip: React.ReactNode; onClick: () => void; hero?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn('group relative overflow-hidden text-left rounded-xl p-4 h-full w-full transition-all duration-200 focus-ring',
        hero ? 'bg-hero text-white shadow-[0_14px_32px_-18px_rgb(19_35_75/.85)] hover:shadow-[0_18px_36px_-16px_rgb(19_35_75/.9)]' : 'card hover:border-brand-200 hover:shadow-[0_10px_26px_-18px_rgb(15_27_51/.35)]')}>
      {hero && <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />}
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={hero ? { background: 'rgb(255 255 255 / .16)', color: '#fff' } : { background: `${color}14`, color }}><Icon name={icon} size={14} /></span>
          <span className={cn('text-[12.5px] font-semibold truncate', hero ? 'text-white/90' : 'text-ink-2')}>{label}</span>
          <span onClick={(e) => e.stopPropagation()} className={hero ? '[&_svg]:text-white/70' : undefined}><InfoTip title={label}>{tip}</InfoTip></span>
        </span>
        <Icon name="ArrowUpRight" size={14} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5', hero ? 'text-white/70' : 'text-muted')} />
      </div>
      <div className="relative mt-2.5">{children}</div>
    </button>
  )
}

/** Big number + caption line used inside a tile */
export function TileValue({ value, unit, sub, hero }: { value: React.ReactNode; unit?: React.ReactNode; sub?: React.ReactNode; hero?: boolean }) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className={cn('text-[24px] leading-none font-bold tracking-tight', hero ? 'text-white' : 'text-ink')}>{value}</span>
        {unit && <span className={cn('text-[11.5px]', hero ? 'text-white/80' : 'text-muted')}>{unit}</span>}
      </div>
      {sub && <div className={cn('text-[11.5px] mt-1.5 truncate', hero ? 'text-white/85' : 'text-muted')}>{sub}</div>}
    </>
  )
}
