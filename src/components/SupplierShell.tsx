// Amber-branded frame for the public supplier pages (capability form, supplier portal): no login and no app shell —
// the Amber logo, what the page is, a secure-link note, and a footer that says where the answer goes.
import type { ReactNode } from 'react'
import { AmberMark, AmberWordmark } from './Logo'
import { Icon, cn } from './ui'

export function SupplierShell({ title, subtitle, children, width = 840 }: { title: string; subtitle: string; children: ReactNode; width?: number }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-slate-50)]">
      <div className="h-1 bg-gradient-to-r from-[#1b2f63] via-[#2a4a9c] to-[#d7192d]" />
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-line">
        <div className="mx-auto px-4 h-16 flex items-center gap-3" style={{ maxWidth: width }}>
          <AmberWordmark size={28} />
          <span className="h-8 w-px bg-line shrink-0" />
          <div className="leading-tight min-w-0">
            <div className="text-[14px] font-bold text-ink truncate">{title}</div>
            <div className="text-[11.5px] text-muted truncate">{subtitle}</div>
          </div>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-semibold border border-emerald-200 shrink-0"><Icon name="LockKeyhole" size={12} />Secure link · no login</span>
        </div>
      </header>
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#1b2f63]/[.08] to-transparent pointer-events-none" />
        <main className="relative mx-auto px-4 py-6 sm:py-8" style={{ maxWidth: width }}>{children}</main>
      </div>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto px-4 py-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted" style={{ maxWidth: width }}>
          <AmberMark size={16} /><span className="font-semibold text-ink-2">Amber Enterprises India Ltd.</span><span>· Sourcing</span>
          <span className="sm:ml-auto">Your answer goes to Amber Sourcing only — it carries no commitment.</span>
        </div>
      </footer>
    </div>
  )
}

/** A numbered section of a supplier form */
export function FormStep({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-start gap-3">
        <span className={cn('h-7 w-7 rounded-full grid place-items-center text-[12.5px] font-bold shrink-0 transition-colors', done ? 'bg-emerald-600 text-white' : 'bg-[#1b2f63] text-white')}>{done ? <Icon name="Check" size={14} strokeWidth={3} /> : n}</span>
        <div className="min-w-0"><h2 className="text-[15px] font-bold text-ink leading-tight">{title}</h2>{hint && <p className="text-[12px] text-muted mt-0.5">{hint}</p>}</div>
      </div>
      <div className="sm:pl-10 grid gap-3">{children}</div>
    </section>
  )
}

/** One fact about the request, with an icon */
export function Fact({ icon, label, children, wide }: { icon: string; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-line bg-white px-3.5 py-2.5 flex items-start gap-2.5 min-w-0', wide && 'sm:col-span-2')}>
      <span className="h-8 w-8 rounded-lg grid place-items-center bg-[#1b2f63]/[.06] text-[#1b2f63] shrink-0"><Icon name={icon} size={15} /></span>
      <div className="min-w-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div><div className="text-[13.5px] text-ink font-semibold leading-snug break-words">{children}</div></div>
    </div>
  )
}
