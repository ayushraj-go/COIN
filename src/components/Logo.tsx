import { useId } from 'react'
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

/** COIN mark — a navy coin with a reeded edge, an Amber red ring and ₹ in the middle */
export function CoinMark({ size = 40, className, spin }: { size?: number; className?: string; spin?: boolean }) {
  const id = useId().replace(/:/g, '')
  const ticks = Array.from({ length: 56 }, (_, k) => (k * 360) / 56)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn(spin && 'coin-spin', className)} role="img" aria-label="COIN">
      <defs>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3a56a8" /><stop offset="55%" stopColor="#1b316f" /><stop offset="100%" stopColor="#0f1d42" /></linearGradient>
        <radialGradient id={`${id}f`} cx="38%" cy="32%" r="75%"><stop offset="0%" stopColor="#3459b8" /><stop offset="60%" stopColor="#1f3a80" /><stop offset="100%" stopColor="#13234b" /></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${id}e)`} />
      {ticks.map((a) => <line key={a} x1="32" y1="2.4" x2="32" y2="5.6" stroke="#ffffff" strokeOpacity=".28" strokeWidth="1.1" transform={`rotate(${a} 32 32)`} />)}
      <circle cx="32" cy="32" r="25.6" fill="none" stroke="#d7192d" strokeWidth="2.6" />
      <circle cx="32" cy="32" r="23.4" fill={`url(#${id}f)`} />
      <path d="M32 9.2 l1.15 2.35 2.6.38-1.88 1.83.44 2.58L32 15.12l-2.31 1.22.44-2.58-1.88-1.83 2.6-.38z" fill="#d7192d" />
      <text x="32" y="33.5" textAnchor="middle" dominantBaseline="middle" fontSize="27" fontWeight="800" fill="#ffffff" fontFamily="'Segoe UI', 'Noto Sans', 'Plus Jakarta Sans', sans-serif">₹</text>
      <ellipse cx="24" cy="19" rx="11" ry="5.5" fill="#ffffff" opacity=".13" transform="rotate(-28 24 19)" />
    </svg>
  )
}
