// M12 — Admin & Masters: category, commodity, lever, route, department, plant, user–role–commodity mapping, vendor & part masters,
// approval matrix, drop reasons, SLA and reminder rules, email templates, FY calendar, settings, audit trail, data
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Badge, Icon, SkeletonGrid, useWarmup, cn } from '../components/ui'
import { useStore, useMe, hasRole } from '../store/useStore'
import { MODULES } from '../lib/scope'
import { AdminRO } from './admin/common'
import { CategoryAdmin, CommodityAdmin, LeverAdmin, RouteAdmin, DepartmentAdmin, PlantAdmin, UserAdmin, VendorAdmin, PartAdmin } from './admin/masters'
import { ApprovalAdmin, DropReasonsAdmin, SlaAdmin, TemplatesAdmin, CalendarAdmin, SettingsAdmin, AuditAdmin, DataAdmin } from './admin/rules'

interface Sec { key: string; label: string; icon: string; group: string; C: React.ComponentType; count?: (s: ReturnType<typeof useStore.getState>) => number }
const SECTIONS: Sec[] = [
  { key: 'category', label: 'Commodity group', icon: 'FolderTree', group: 'Masters', C: CategoryAdmin, count: (s) => s.categories.length },
  { key: 'commodity', label: 'Commodity', icon: 'Boxes', group: 'Masters', C: CommodityAdmin, count: (s) => s.commodities.length },
  { key: 'lever', label: 'Idea category', icon: 'SlidersHorizontal', group: 'Masters', C: LeverAdmin, count: (s) => s.levers.length },
  { key: 'route', label: 'Route', icon: 'Route', group: 'Masters', C: RouteAdmin, count: () => 4 },
  { key: 'department', label: 'Department', icon: 'Building2', group: 'Masters', C: DepartmentAdmin, count: (s) => s.departments.length },
  { key: 'plant', label: 'Plant / BU', icon: 'Factory', group: 'Masters', C: PlantAdmin, count: (s) => s.plants.length },
  { key: 'users', label: 'Users', icon: 'UserCog', group: 'Masters', C: UserAdmin, count: (s) => s.users.length },
  { key: 'vendors', label: 'Vendor master', icon: 'Store', group: 'Masters', C: VendorAdmin, count: (s) => s.suppliers.length },
  { key: 'parts', label: 'Part master', icon: 'Package', group: 'Masters', C: PartAdmin, count: (s) => s.parts.length },
  { key: 'approval', label: 'Approval matrix', icon: 'GitBranch', group: 'Rules', C: ApprovalAdmin, count: (s) => s.approvalRules.length },
  { key: 'drops', label: 'Drop reasons', icon: 'CircleX', group: 'Rules', C: DropReasonsAdmin, count: (s) => s.dropReasons.length },
  { key: 'sla', label: 'SLA & reminder rules', icon: 'Timer', group: 'Rules', C: SlaAdmin, count: (s) => s.slaRules.length },
  { key: 'templates', label: 'Email templates', icon: 'Mails', group: 'Rules', C: TemplatesAdmin, count: (s) => s.emailTemplates.length },
  { key: 'calendar', label: 'FY calendar', icon: 'CalendarRange', group: 'Rules', C: CalendarAdmin },
  { key: 'settings', label: 'Settings', icon: 'Settings2', group: 'System', C: SettingsAdmin },
  { key: 'audit', label: 'Audit trail', icon: 'History', group: 'System', C: AuditAdmin },
  { key: 'data', label: 'Data', icon: 'Database', group: 'System', C: DataAdmin },
]

export default function Admin() {
  const me = useMe()
  const isAdmin = hasRole(me, 'admin')
  const [sp, setSp] = useSearchParams()
  const key = sp.get('s') ?? 'category'
  const sec = SECTIONS.find((s) => s.key === key) ?? SECTIONS[0]
  const go = (k: string) => setSp((p) => { const n = new URLSearchParams(p); n.set('s', k); return n }, { replace: true })
  const state = useStore()
  const ready = useWarmup(220)
  const groups = [...new Set(SECTIONS.map((s) => s.group))]
  const mod = MODULES.find((m) => m.id === 'M12')!
  const C = sec.C
  return (
    <AdminRO.Provider value={!isAdmin}>
      <PageHeader icon="Settings2" title="Admin & Masters" badge={<Badge color="#2f5bc6">M12</Badge>} subtitle={mod.scope}
        actions={isAdmin ? <Badge color="#0f9f6e" icon="ShieldCheck">Admin · full edit access</Badge> : <Badge color="#64748b" icon="Lock">Read-only</Badge>} />
      {!isAdmin && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50/70 px-4 py-3 mb-3">
          <Icon name="Lock" size={16} className="text-gold-600 mt-0.5" />
          <div className="text-[12.5px] text-ink-2"><b className="text-ink">Read-only view.</b> Masters, users, the approval matrix and settings are managed by the Admin (Sourcing Excellence / IT). Contact your administrator to request a change.</div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-3 items-start">
        {/* Mobile section picker */}
        <select className="input lg:hidden" value={sec.key} onChange={(e) => go(e.target.value)} aria-label="Admin section">
          {groups.map((g) => <optgroup key={g} label={g}>{SECTIONS.filter((s) => s.group === g).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>)}
        </select>
        <nav className="hidden lg:block w-[232px] shrink-0 sticky top-0 card rounded-2xl p-2 bg-white/85 backdrop-blur" aria-label="Admin sections">
          {groups.map((g) => (
            <div key={g} className="mb-1.5 last:mb-0">
              <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[.12em] text-muted">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => {
                const on = s.key === sec.key
                return (
                  <button key={s.key} onClick={() => go(s.key)} className={cn('relative w-full flex items-center gap-2.5 h-9 px-2.5 rounded-xl text-[12.5px] font-medium transition-colors', on ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-slate-50 hover:text-ink')}>
                    {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-600" />}
                    <Icon name={s.icon} size={15} className={on ? 'text-brand-600' : 'text-muted'} />
                    <span className="flex-1 text-left truncate">{s.label}</span>
                    {s.count && <span className={cn('text-[10.5px] font-bold num px-1.5 rounded-md', on ? 'bg-white text-brand-700' : 'text-muted')}>{s.count(state)}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 mb-2">
            <Icon name={sec.icon} size={16} className="text-brand-600" />
            <h2 className="text-[15px] font-bold text-ink">{sec.label}</h2>
            <span className="text-[11.5px] text-muted">· {sec.group}</span>
          </div>
          {!ready ? <SkeletonGrid rows={1} /> : <C key={sec.key} />}
        </div>
      </div>
    </AdminRO.Provider>
  )
}
