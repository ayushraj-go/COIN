// Top of the signed-in user's queue, shown first on their dashboard
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { stageLabel } from '../../lib/workflow'
import { ideaAnnualised } from '../../lib/calc'
import { inrShort } from '../../lib/format'
import { Button, Icon, cn } from '../../components/ui'
import { ACTION_META, waitingText } from './model'
import { useMyQueue } from './useQueue'

const XL_COLS: Record<number, string> = { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4' }

export function QueuePeek({ className }: { className?: string }) {
  const q = useMyQueue()
  const nav = useNavigate()
  const openIdea = useStore((s) => s.openIdea)
  if (!q.mine.length) return null
  const top = q.mine.slice(0, 4)
  const breached = q.mine.filter((r) => r.sla === 'breach').length
  return (
    <section className={cn('card overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[10px] grid place-items-center bg-accent-50 text-accent-600"><Icon name="Inbox" size={15} /></span>
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Waiting for you <span className="text-muted font-medium num">· {q.mine.length}</span></h3>
            <p className="text-[11.5px] text-muted">{breached ? <><b className="text-red-700 num">{breached}</b> beyond SLA · </> : null}oldest first after SLA breaches</p>
          </div>
        </div>
        <Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => nav('/queue')}>Open my queue</Button>
      </div>
      <div className={cn('grid grid-cols-1 md:grid-cols-2 border-t border-line', XL_COLS[top.length])}>
        {top.map((r, k) => (
          <button key={r.idea.id} onClick={() => openIdea(r.idea.id)}
            className={cn('text-left px-5 py-3.5 hover:bg-brand-50/60 transition-colors border-line', k > 0 && 'md:border-l', k > 1 && 'border-t md:border-t-0', k === 2 && 'md:border-l-0 xl:border-l', k > 1 && 'xl:border-t-0')}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700"><Icon name={ACTION_META[r.action].icon} size={13} />{stageLabel(r.idea, r.idea.stage)}</span>
              <span className={cn('text-[11px] font-semibold num', r.sla === 'breach' ? 'text-red-700' : r.sla === 'due' ? 'text-amber-700' : 'text-muted')}>{waitingText(r.waitingHours)}</span>
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-ink line-clamp-2 leading-snug">{r.idea.title}</div>
            <div className="mt-1 text-[11.5px] text-muted truncate"><span className="font-mono">{r.idea.id}</span> · {inrShort(ideaAnnualised(r.idea))}</div>
          </button>
        ))}
      </div>
    </section>
  )
}
