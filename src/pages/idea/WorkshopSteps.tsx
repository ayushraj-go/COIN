// The workshop as numbered steps: what is done, and the one thing to do now. Anyone behind a department ID can finish it from here.
import { Icon, cn } from '../../components/ui'
import type { WorkshopStep, WorkshopStepKey } from '../../lib/workflow'

export function WorkshopStepper({ steps, compact, canClose, onOpen }: { steps: WorkshopStep[]; compact?: boolean; canClose: boolean; onOpen: (key: WorkshopStepKey) => void }) {
  return (
    <ol className={cn('grid gap-2', compact ? 'grid-cols-1' : steps.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3')}>
      {steps.map((s, i) => (
        <li key={s.key} className="min-w-0">
          <button type="button" aria-current={s.now ? 'step' : undefined} disabled={s.key === 'close' && !canClose} onClick={() => onOpen(s.key)}
            className={cn('w-full h-full rounded-xl border px-3 py-2 flex items-start gap-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              s.now ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand-500)_16%,transparent)]' : s.done ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50' : 'border-line bg-white hover:border-slate-300')}>
            <span className={cn('h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0', s.done ? 'bg-emerald-600 text-white' : s.now ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>
              {s.done ? <Icon name="Check" size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              {s.now && <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-700">Do this now</span>}
              <span className={cn('block text-[12.5px] font-semibold leading-tight', s.done ? 'text-ink-2' : 'text-ink')}>{s.label}</span>
              <span className="block text-[11px] text-muted leading-snug mt-0.5">{s.hint}</span>
            </span>
            {s.now && <Icon name="ArrowRight" size={15} className="text-brand-700 shrink-0 mt-1" />}
          </button>
        </li>
      ))}
    </ol>
  )
}

/** One line for the lists: step 2 of 4, and what it is */
export function NextStep({ steps }: { steps: WorkshopStep[] }) {
  const at = steps.findIndex((s) => s.now)
  if (at < 0) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap">
      <span className="h-5 min-w-5 px-1 rounded-full bg-brand-600 text-white grid place-items-center text-[10.5px] font-bold num">{at + 1}/{steps.length}</span>
      <span className="font-semibold text-brand-700">{steps[at].label}</span>
    </span>
  )
}
