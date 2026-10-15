// Demo persona picker — pick a department, then one of its five ladder roles; cross-functional accounts below.
// Used on the login page and in the user menu ("Switch demo persona").
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { CROSS_LOGINS, LADDER_ROLES } from '../lib/masters'
import { DEPARTMENTS, personaFor } from '../lib/workflow'
import { Avatar, Icon, cn } from './ui'

const DEPT_ICON: Record<string, string> = { 'R&D': 'FlaskConical', DQA: 'Microscope', Quality: 'BadgeCheck', Process: 'Cog', Production: 'Factory', Finance: 'Landmark', Sourcing: 'Handshake', HR: 'UsersRound' }

export function PersonaPicker({ onPick, currentUserId, compact }: { onPick: (userId: string, label: string) => void; currentUserId?: string | null; compact?: boolean }) {
  const users = useStore((s) => s.users)
  const current = users.find((u) => u.id === currentUserId)
  const [dept, setDept] = useState<string>(current && (DEPARTMENTS as readonly string[]).includes(current.department) ? current.department : 'R&D')
  const tile = 'group flex items-center gap-2 rounded-xl border text-left transition-all min-w-0'
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1">
        {DEPARTMENTS.map((d) => (
          <button key={d} type="button" onClick={() => setDept(d)}
            className={cn('inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11.5px] font-semibold border transition-colors',
              d === dept ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-line text-ink-2 hover:border-brand-300 hover:text-brand-700')}>
            <Icon name={DEPT_ICON[d] ?? 'Building2'} size={12} />{d}
          </button>
        ))}
      </div>
      <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {LADDER_ROLES.map((r, k) => {
          const id = personaFor(dept, r.key, users)
          const u = users.find((x) => x.id === id)
          if (!u) return null
          const me = u.id === currentUserId
          return (
            <button key={r.key} type="button" onClick={() => onPick(u.id, `${u.name} · ${dept} ${r.label.toLowerCase()}`)} title={`${r.label} — ${r.duty}`}
              className={cn(tile, 'px-2 py-1.5', me ? 'bg-brand-50 border-brand-200' : 'bg-[var(--color-slate-50)] border-transparent hover:bg-white hover:border-[var(--color-slate-200)] hover:shadow-[0_6px_16px_-10px_rgb(15_27_51/.35)]', !compact && k === 4 && 'sm:col-span-2')}>
              <span className="relative shrink-0"><Avatar name={u.name} color={u.avatarColor} size={26} /><span className="absolute -bottom-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-white border border-line text-[9px] font-bold text-brand-700 grid place-items-center num">{k + 1}</span></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-semibold text-ink leading-tight truncate">{r.label}</span>
                <span className="block text-[10.5px] text-muted truncate leading-tight mt-px">{compact ? `${u.name} · ${r.duty}` : u.name}</span>
              </span>
              {me && <Icon name="Check" size={14} className="text-brand-700 shrink-0" />}
            </button>
          )
        })}
      </div>
      <div>
        <div className="text-[10.5px] font-semibold text-muted mb-1">Cross-functional</div>
        <div className="flex flex-wrap gap-1.5">
          {CROSS_LOGINS.map((c) => {
            const u = users.find((x) => x.id === c.userId)
            if (!u) return null
            const me = u.id === currentUserId
            return (
              <button key={c.userId} type="button" onClick={() => onPick(u.id, `${u.name} · ${c.role}`)} title={`${c.role} — ${c.blurb}`}
                className={cn(tile, 'pl-1 pr-2.5 py-1', me ? 'bg-brand-50 border-brand-200' : 'bg-white border-line hover:border-brand-300')}>
                <Avatar name={u.name} color={u.avatarColor} size={20} />
                <span className="text-[11px] font-semibold text-ink whitespace-nowrap">{c.role}</span>
                {me && <Icon name="Check" size={12} className="text-brand-700" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
