// Demo sign-in — on the login page ("Quick demo access") and in the user menu ("Switch department ID").
// One ID per department and the Central ID: nobody signs in as a person, and no cross-functional accounts.
import { useStore } from '../store/useStore'
import { Avatar, Icon, cn } from './ui'

export function PersonaPicker({ onPick, currentUserId, compact }: { onPick: (userId: string, label: string) => void; currentUserId?: string | null; compact?: boolean }) {
  const ids = useStore((s) => s.users).filter((u) => u.active !== false)
  return (
    <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
      {ids.map((u) => {
        const me = u.id === currentUserId
        return (
          <button key={u.id} type="button" onClick={() => onPick(u.id, u.name)} title={u.email}
            className={cn('flex items-center gap-2 rounded-xl border px-2 h-[40px] text-left transition-all min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
              me ? 'bg-brand-50 border-brand-300' : 'bg-white border-black/[.07] hover:border-brand-300 hover:shadow-[0_8px_20px_-14px_rgb(15_27_51/.45)]')}>
            <Avatar name={u.department} color={u.avatarColor} size={24} />
            <span className="min-w-0 flex-1 text-[11.5px] font-semibold text-ink leading-tight truncate">{u.department}</span>
            {me && <Icon name="Check" size={13} className="text-brand-700 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}
