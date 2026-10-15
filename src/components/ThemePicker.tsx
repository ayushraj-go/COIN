// Colour theme picker (header): every palette previewed as a mini app — sidebar, primary, accent and canvas.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PALETTES, paletteVars, usePalette, type Palette } from '../lib/theme'
import { Icon, cn } from './ui'

function Preview({ p }: { p: Palette }) {
  const v = paletteVars(p)
  return (
    <span className="flex h-12 w-[74px] shrink-0 overflow-hidden rounded-md border" style={{ borderColor: v['--color-slate-200'], background: p.canvas }}>
      <span className="w-[18px] h-full flex flex-col gap-[3px] p-[3px]" style={{ background: v['--sb-bg'], borderRight: `1px solid ${p.sidebar === 'light' ? v['--color-slate-200'] : 'transparent'}` }}>
        <span className="h-[3px] rounded-full" style={{ background: v['--color-accent-500'] }} />
        <span className="h-[3px] rounded-full opacity-60" style={{ background: p.sidebar === 'dark' ? '#fff' : v['--color-slate-400'] }} />
        <span className="h-[3px] rounded-full opacity-60" style={{ background: p.sidebar === 'dark' ? '#fff' : v['--color-slate-400'] }} />
      </span>
      <span className="flex-1 p-[4px] flex flex-col gap-[3px]">
        <span className="flex gap-[3px]">
          <span className="h-[14px] flex-1 rounded-[3px]" style={{ background: v['--color-brand-950'] }} />
          <span className="h-[14px] flex-1 rounded-[3px] bg-white border" style={{ borderColor: v['--color-slate-200'] }} />
        </span>
        <span className="h-[4px] rounded-full" style={{ background: `linear-gradient(90deg, ${v['--color-brand-600']} 70%, ${v['--color-accent-500']} 70%)` }} />
        <span className="h-[4px] w-2/3 rounded-full" style={{ background: v['--color-brand-300'] }} />
      </span>
    </span>
  )
}

export function ThemePicker() {
  const key = usePalette((s) => s.key)
  const set = usePalette((s) => s.set)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Colour theme"
        className="h-9 w-9 rounded-lg grid place-items-center text-ink-2 hover:bg-slate-100 transition-colors">
        <Icon name="Palette" size={17} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute right-0 top-11 z-50 w-[360px] max-w-[calc(100vw-24px)] card shadow-2xl p-2">
            <div className="px-2 pt-1 pb-2">
              <div className="text-[13px] font-bold text-ink">Colour theme</div>
              <div className="text-[11.5px] text-muted">Applies to every screen; saved on this browser.</div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-1">
              {PALETTES.map((p) => (
                <button key={p.key} onClick={() => set(p.key)}
                  className={cn('flex items-center gap-3 rounded-lg p-1.5 text-left transition-colors', p.key === key ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50')}>
                  <Preview p={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink">{p.name}</span>
                    <span className="block text-[11px] text-muted leading-snug">{p.blurb}</span>
                  </span>
                  {p.key === key && <Icon name="Check" size={15} className="text-brand-700 shrink-0 mr-1" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
