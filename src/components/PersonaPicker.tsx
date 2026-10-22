// Demo persona picker — on the login page ("Quick demo access") and in the user menu ("Switch demo persona").
// Three tabs: Sourcing (the department set up in full — its team lead depends on the commodity, so the 11 commodity
// team leads open in their own searchable list), the other departments (one ladder each) and the cross-functional accounts.
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { User } from '../lib/types'
import { useStore } from '../store/useStore'
import { CROSS_LOGINS, LADDER_ROLES } from '../lib/masters'
import { DEPARTMENTS, personaFor } from '../lib/workflow'
import { Avatar, Icon, cn } from './ui'

const SOURCING = 'Sourcing'
const OTHER_DEPTS = DEPARTMENTS.filter((d) => d !== SOURCING)
type Tab = 'sourcing' | 'depts' | 'cross'
type Pick = (userId: string, label: string) => void

/** One account: avatar with its stage number, role, name — the whole tile signs in */
function Tile({ u, role, sub, step, active, onClick, chevron, wide, title }: { u?: User; role: string; sub: string; step?: number; active?: boolean; onClick: () => void; chevron?: boolean; wide?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn('group relative flex items-center gap-2.5 rounded-xl border px-2.5 h-[46px] text-left transition-all min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
        active ? 'bg-brand-50 border-brand-300' : 'bg-white border-black/[.07] hover:border-brand-300 hover:shadow-[0_8px_20px_-14px_rgb(15_27_51/.45)]', wide && 'sm:col-span-2')}>
      <span className="relative shrink-0">
        {u ? <Avatar name={u.name} color={u.avatarColor} size={28} /> : <span className="h-7 w-7 rounded-full grid place-items-center bg-brand-600 text-white"><Icon name="UsersRound" size={14} /></span>}
        {step != null && <span className="absolute -bottom-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-white border border-black/10 text-[9px] font-bold text-brand-700 grid place-items-center num">{step}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-ink leading-tight truncate">{role}</span>
        <span className="block text-[11px] text-muted leading-tight truncate mt-0.5">{sub}</span>
      </span>
      {active ? <Icon name="Check" size={14} className="text-brand-700 shrink-0" />
        : chevron ? <Icon name="ChevronRight" size={15} className="text-muted group-hover:text-brand-700 shrink-0 transition-colors" /> : null}
    </button>
  )
}

export function PersonaPicker({ onPick, currentUserId, compact }: { onPick: Pick; currentUserId?: string | null; compact?: boolean }) {
  const users = useStore((s) => s.users)
  const current = users.find((u) => u.id === currentUserId)
  const isCross = !!current && CROSS_LOGINS.some((c) => c.userId === current.id)
  const [tab, setTab] = useState<Tab>(isCross ? 'cross' : current && OTHER_DEPTS.includes(current.department as never) ? 'depts' : 'sourcing')
  const [dept, setDept] = useState<string>(current && OTHER_DEPTS.includes(current.department as never) ? current.department : OTHER_DEPTS[0])
  const [leadsOpen, setLeadsOpen] = useState(false)
  const leads = users.filter((u) => u.active !== false && u.department === SOURCING && u.roles.includes('teamlead'))
  const grid = cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'sourcing', label: 'Sourcing', icon: 'Handshake' },
    { key: 'depts', label: 'Departments', icon: 'Building2' },
    { key: 'cross', label: 'Cross-functional', icon: 'Network' },
  ]
  const ladder = (d: string) => LADDER_ROLES.map((r, k) => ({ r, k, u: users.find((x) => x.id === personaFor(d, r.key, users)) }))
  const myLead = leads.find((u) => u.id === currentUserId)

  return (
    <div className="flex flex-col gap-2.5">
      {/* tabs */}
      <div className="grid grid-cols-3 p-0.5 rounded-xl bg-black/[.04]" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setLeadsOpen(false) }}
            className={cn('relative h-8 rounded-[10px] text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors min-w-0',
              tab === t.key ? 'text-brand-800' : 'text-ink-2 hover:text-ink')}>
            {tab === t.key && <motion.span layoutId={compact ? 'pp-tab-c' : 'pp-tab'} className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_3px_rgb(15_27_51/.12)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative inline-flex items-center gap-1.5 truncate"><Icon name={t.icon} size={13} />{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab + (leadsOpen ? '-leads' : '') + (tab === 'depts' ? dept : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
          {tab === 'sourcing' && !leadsOpen && (
            <div className={grid}>
              {ladder(SOURCING).map(({ r, k, u }) => r.key === 'teamlead'
                ? <Tile key={r.key} step={k + 1} role="Team lead" sub={myLead ? myLead.name : `${leads.length} leads · by commodity`} active={!!myLead} chevron onClick={() => setLeadsOpen(true)} />
                : u && <Tile key={r.key} u={u} step={k + 1} role={r.label} sub={u.name} active={u.id === currentUserId} wide={!compact && k === 4}
                    onClick={() => onPick(u.id, `${u.name} · Sourcing ${r.label.toLowerCase()}`)} />)}
            </div>
          )}
          {tab === 'sourcing' && leadsOpen && <CommodityLeads leads={leads} currentUserId={currentUserId} onPick={onPick} onBack={() => setLeadsOpen(false)} compact={compact} />}

          {tab === 'depts' && (
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Icon name="Building2" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"
                  className="w-full h-8 pl-8 pr-8 rounded-lg border border-black/[.08] bg-white text-[12px] font-semibold text-ink appearance-none outline-none focus:border-brand-300 cursor-pointer">
                  {OTHER_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <Icon name="ChevronDown" size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
              <div className={grid}>
                {ladder(dept).map(({ r, k, u }) => u && <Tile key={r.key} u={u} step={k + 1} role={r.label} sub={u.name} active={u.id === currentUserId} wide={!compact && k === 4}
                  onClick={() => onPick(u.id, `${u.name} · ${dept} ${r.label.toLowerCase()}`)} />)}
              </div>
            </div>
          )}

          {tab === 'cross' && (
            <div className={grid}>
              {CROSS_LOGINS.map((c, k) => {
                const u = users.find((x) => x.id === c.userId)
                return u && <Tile key={c.userId} u={u} role={c.role} title={c.blurb} sub={u.name} active={u.id === currentUserId} wide={!compact && k === CROSS_LOGINS.length - 1 && CROSS_LOGINS.length % 2 === 1}
                  onClick={() => onPick(u.id, `${u.name} · ${c.role}`)} />
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Sourcing stage 2 — the team lead depends on the idea's commodity: every commodity team lead, searchable by commodity */
function CommodityLeads({ leads, currentUserId, onPick, onBack, compact }: { leads: User[]; currentUserId?: string | null; onPick: Pick; onBack: () => void; compact?: boolean }) {
  const commodities = useStore((s) => s.commodities)
  const [q, setQ] = useState('')
  const k = q.trim().toLowerCase()
  const nameOf = (code: string) => commodities.find((c) => c.code === code)?.name ?? code
  const rows = useMemo(() => leads.map((u) => {
    const hits = k ? u.commodities.filter((c) => c.toLowerCase() === k || nameOf(c).toLowerCase().includes(k)) : []
    return { u, hits, show: !k || u.name.toLowerCase().includes(k) || hits.length > 0 }
  }).filter((r) => r.show), [leads, k, commodities]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onBack} aria-label="Back to Sourcing roles" title="Back"
          className="h-8 w-8 shrink-0 rounded-lg border border-black/[.08] bg-white grid place-items-center text-ink-2 hover:text-brand-700 hover:border-brand-300 transition-colors">
          <Icon name="ChevronLeft" size={15} />
        </button>
        <div className="relative flex-1 min-w-0">
          <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team lead for which commodity? e.g. Wire, Copper Tube"
            aria-label="Find a team lead by commodity"
            onKeyDown={(e) => { if (e.key === 'Enter' && rows.length === 1) onPick(rows[0].u.id, `${rows[0].u.name} · Sourcing team lead`) }}
            className="w-full h-8 pl-8 pr-2 rounded-lg border border-black/[.08] bg-white text-[12px] outline-none focus:border-brand-300" />
        </div>
      </div>
      <div className={cn('grid gap-1', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {rows.map(({ u, hits }) => {
          const me = u.id === currentUserId
          return (
            <button key={u.id} type="button" onClick={() => onPick(u.id, `${u.name} · Sourcing team lead`)}
              title={`Team lead for ${u.commodities.length} commodities: ${u.commodities.map(nameOf).join(', ')}`}
              className={cn('group flex items-center gap-2 rounded-lg border px-2 h-[38px] text-left transition-all min-w-0',
                me ? 'bg-brand-50 border-brand-300' : 'bg-white border-black/[.07] hover:border-brand-300 hover:shadow-[0_6px_16px_-12px_rgb(15_27_51/.45)]')}>
              <Avatar name={u.name} color={u.avatarColor} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-semibold text-ink leading-tight truncate">{u.name}</span>
                <span className={cn('block text-[10.5px] leading-tight truncate mt-px', hits.length ? 'text-brand-700 font-medium' : 'text-muted')}>
                  {hits.length ? hits.slice(0, 2).map(nameOf).join(', ') + (hits.length > 2 ? ` +${hits.length - 2}` : '') : `${u.commodities.length} ${u.commodities.length === 1 ? 'commodity' : 'commodities'}`}
                </span>
              </span>
              {me && <Icon name="Check" size={13} className="text-brand-700 shrink-0" />}
            </button>
          )
        })}
        {!rows.length && <div className="text-[11.5px] text-muted px-1 py-2 sm:col-span-2">No team lead looks after “{q}”.</div>}
      </div>
    </div>
  )
}
