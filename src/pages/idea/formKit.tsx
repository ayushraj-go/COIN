// Building blocks shared by the stage dialogs (department evaluation and department approval):
// a titled section, a figure card, a key–value row and a pass / warn / fail mark.
import React from 'react'
import { Icon, InfoTip, cn } from '../../components/ui'

/** Section with a title row */
export function Block({ title, icon, hint, children, right }: { title: string; icon: string; hint?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg grid place-items-center bg-brand-50 text-brand-700 shrink-0"><Icon name={icon} size={14} /></span>
          <div className="min-w-0"><div className="text-[13.5px] font-semibold text-ink">{title}</div>{hint && <div className="block-hint text-[11.5px] text-muted">{hint}</div>}</div>
        </div>
        {right}
      </div>
      <div className="px-3.5 pb-3.5">{children}</div>
    </section>
  )
}
export function Kpi({ label, value, tone, tip, sub }: { label: string; value: React.ReactNode; tone?: 'good' | 'bad'; tip?: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 min-w-0">
      <div className="text-[11px] font-medium text-muted flex items-center gap-1 truncate">{label}{tip && <InfoTip title={label}>{tip}</InfoTip>}</div>
      <div className={cn('text-[16px] font-bold num truncate', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>
      {sub && <div className="kpi-sub text-[11px] text-muted truncate">{sub}</div>}
    </div>
  )
}
export const Kv = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 py-1 border-b border-dashed border-line last:border-0 text-[12.5px]"><span className="text-muted">{k}</span><span className="text-ink font-medium min-w-0 break-words">{v}</span></div>
)
export const Mark = ({ ok, warn }: { ok: boolean; warn?: boolean }) => (
  <span className={cn('h-5 w-5 rounded-full grid place-items-center text-white shrink-0', ok ? 'bg-emerald-600' : warn ? 'bg-orange-400' : 'bg-red-500')}><Icon name={ok ? 'Check' : warn ? 'Minus' : 'X'} size={11} strokeWidth={3} /></span>
)

