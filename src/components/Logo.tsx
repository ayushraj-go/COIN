import { cn } from './ui'

/** Amber mark — red star with swoosh (logo only colour) */
export function AmberMark({ size = 30, className, tone = 'dark' }: { size?: number; className?: string; tone?: 'dark' | 'light' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label="Amber">
      <defs>
        <linearGradient id="amberRed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0303f" />
          <stop offset="100%" stopColor="#b8101f" />
        </linearGradient>
        <linearGradient id="amberNavy" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1b2f63" />
          <stop offset="100%" stopColor="#23408a" />
        </linearGradient>
      </defs>
      <path d="M26 2 L31.2 17.6 L47 18.2 L34.4 27.8 L39 43.6 L26 34.2 L13 43.6 L17.6 27.8 L5 18.2 L20.8 17.6 Z" fill="url(#amberRed)" />
      <path d="M2 40 C 12 30, 24 22, 44 8" fill="none" stroke={tone === 'light' ? '#0c1130' : '#ffffff'} strokeWidth="5" strokeLinecap="round" />
      <path d="M2 40 C 12 30, 24 22, 44 8" fill="none" stroke={tone === 'light' ? '#ffffff' : 'url(#amberNavy)'} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function AmberWordmark({ size = 30, className, tone = 'dark' }: { size?: number; className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 select-none', className)}>
      <AmberMark size={size} tone={tone} />
      <span className={cn('font-extrabold tracking-[-0.04em] leading-none', tone === 'light' ? 'text-white' : 'text-[#1b2f63]')} style={{ fontSize: size * 0.86, fontFamily: 'var(--font-display)' }}>amber</span>
    </span>
  )
}

/** Amber lock-up with product name — "COIN · Cost Innovation Hub" */
export function ProductLockup({ size = 30, compact, className }: { size?: number; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 min-w-0', className)}>
      <AmberWordmark size={size} />
      {!compact && (
        <>
          <span className="h-9 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
          <div className="leading-tight min-w-0">
            <div className="text-[15px] font-bold text-ink tracking-tight truncate">COIN · Cost Innovation Hub</div>
            <div className="text-[9.5px] font-semibold tracking-[.22em] text-muted uppercase truncate">Capture · Value · Approve · Execute · Prove</div>
          </div>
        </>
      )}
    </div>
  )
}
