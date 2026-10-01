import { useStore } from '../store/useStore'
import { Icon, cn } from './ui'
import type { Filters } from '../lib/types'

/** One labelled select pill — shrinks with the row so every filter fits on a single line */
function Sel({ k, label, options, grow = 1, value, onChange }: { k: keyof Filters; label: string; options: [string, string][]; grow?: number; value: string; onChange: (k: keyof Filters, v: string) => void }) {
  const on = value !== 'All' && k !== 'fy'
  const current = options.find(([v]) => v === value)?.[1] ?? value
  return (
    <label title={`${label}: ${current}`} className={cn('group relative flex items-center h-8 min-w-[140px] md:min-w-0 rounded-lg text-[12.5px] transition-colors ring-1 ring-inset shadow-[0_1px_2px_rgb(16_24_40/.04)]',
      on ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-[#d0d5dd] hover:bg-[#f9fafb]')}
      style={{ flex: `${grow} 1 0` }}>
      
      <span className={cn('pl-2.5 pr-1 text-[12px] font-normal whitespace-nowrap', on ? 'text-brand-600' : 'text-[#98a2b3]')}>{label}</span>
      <select value={value} onChange={(e) => onChange(k, e.target.value)} className={cn('appearance-none bg-transparent pr-6 pl-0.5 h-full font-medium outline-none cursor-pointer flex-1 min-w-0 w-0 truncate', on ? 'text-brand-800' : 'text-ink')}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Icon name="ChevronDown" size={13} className={cn('absolute right-1.5 pointer-events-none transition-colors', on ? 'text-brand-500' : 'text-[#98a2b3]')} />
    </label>
  )
}

/** Global filters: FY, quarter, plant, category, commodity, buyer, lever, direct/indirect (M1) — all reports switch FY and quarter from one selector */
export function FilterBar({ className, compact }: { className?: string; compact?: boolean }) {
  const { filters, setFilters, resetFilters, plants, categories, commodities, users, levers } = useStore()
  const buyers = users.filter((u) => u.roles.includes('buyer'))
  const comms = filters.categoryId === 'All' ? commodities : commodities.filter((c) => c.categoryId === filters.categoryId)
  const active = Object.entries(filters).filter(([k, v]) => k !== 'fy' && v !== 'All').length
  const set = (k: keyof Filters, v: string) => setFilters({ [k]: v } as any)
  const p = (k: keyof Filters) => ({ k, value: filters[k] as string, onChange: set })
  return (
    <div className={cn('flex flex-wrap md:flex-nowrap items-center gap-2 min-w-0 w-full', className)}>
      <Sel {...p('fy')} label="FY" grow={0.75} options={[['FY27', 'FY27'], ['FY26', 'FY26'], ['FY28', 'FY28']]} />
      <Sel {...p('quarter')} label="Qtr" grow={0.8} options={[['All', 'All'], ['Q1', 'Q1 Apr–Jun'], ['Q2', 'Q2 Jul–Sep'], ['Q3', 'Q3 Oct–Dec'], ['Q4', 'Q4 Jan–Mar']]} />
      <Sel {...p('plant')} label="Plant" grow={1.15} options={[['All', 'All'], ...plants.map((pl) => [pl.id, `${pl.name} · ${pl.bu}`] as [string, string])]} />
      <Sel {...p('categoryId')} label="Group" grow={1.2} options={[['All', 'All'], ...categories.map((c) => [c.id, c.name] as [string, string])]} />
      <Sel {...p('commodity')} label="Commodity" grow={1.3} options={[['All', 'All'], ...comms.map((c) => [c.code, c.name] as [string, string])]} />
      {!compact && <Sel {...p('buyerId')} label="Buyer" grow={1.05} options={[['All', 'All'], ...buyers.map((b) => [b.id, b.name] as [string, string])]} />}
      {!compact && <Sel {...p('leverId')} label="Category" grow={1.1} options={[['All', 'All'], ...levers.map((l) => [l.id, `${l.name}`] as [string, string])]} />}
      <Sel {...p('buyingType')} label="Type" grow={0.8} options={[['All', 'All'], ['Direct', 'Direct'], ['Indirect', 'Indirect']]} />
      {active > 0 && (
        <button onClick={resetFilters} className="h-8 shrink-0 px-2.5 rounded-lg text-[12px] font-semibold text-brand-700 hover:bg-brand-50 flex items-center gap-1 transition-colors">
          <Icon name="X" size={13} /> Clear {active}
        </button>
      )}
    </div>
  )
}
