// Submit Idea — collapsible form step (accordion). Collapsed: letter, title, one-line summary and completion state.
import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Icon, cn } from '../../components/ui'

export interface SectionState { required: number; missing: number }

export function FormSection({ letter, title, subtitle, icon, open, onToggle, summary, state, extra, children }: {
  letter: string; title: string; subtitle: React.ReactNode; icon: string; open: boolean; onToggle: () => void
  summary: React.ReactNode; state: SectionState; extra?: React.ReactNode; children: React.ReactNode
}) {
  const complete = state.required > 0 && state.missing === 0
  return (
    <section className={cn('card min-w-0 transition-colors', open && 'border-[#d0d5dd]')} data-section={letter}>
      <div className="flex items-center gap-2 pr-3">
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-1 py-3 text-left rounded-xl focus-ring">
          <span className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0 text-[13px] font-bold border',
            complete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : open ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-ink-2 border-line')}>
            {complete && !open ? <Icon name="Check" size={15} /> : letter}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <Icon name={icon} size={14} className="text-[#98a2b3] shrink-0" />
              <span className="text-[13.5px] font-semibold text-ink truncate">{title}</span>
            </span>
            <span className="block text-[11.5px] text-muted truncate">{open ? subtitle : summary}</span>
          </span>
          {state.missing > 0 ? (
            <span className="shrink-0 inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-medium border border-amber-200 bg-amber-50 text-amber-700 num">
              {state.missing} missing
            </span>
          ) : complete ? (
            <span className="shrink-0 inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Icon name="CircleCheck" size={12} />Complete
            </span>
          ) : (
            <span className="shrink-0 text-[11.5px] text-muted">Optional</span>
          )}
          <Icon name="ChevronDown" size={16} className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open && extra && <div className="flex items-center gap-1.5 shrink-0">{extra}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            className="px-5 pb-5 pt-1 border-t border-line/70">
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
