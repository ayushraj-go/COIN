// One-screen layout helpers for the people homes (Submitter / Supplier / Evaluator).
// At xl (≥1280px) the home grid is sized to exactly the space left inside <main>, and lists
// show as many fixed-height rows as fit their card — no page scroll, no inner scrollbars.
// Below xl everything falls back to normal document flow.
import { useEffect, useLayoutEffect, useState } from 'react'

const XL = 1280
const isXl = () => typeof window !== 'undefined' && window.innerWidth >= XL

/** Height (px) from the element's top edge to the bottom of <main>'s padded content (xl only, else null). Pass the returned callback as `ref`. */
export function useFitHeight<T extends HTMLElement = HTMLDivElement>(min = 460) {
  const [el, setEl] = useState<T | null>(null)
  const [h, setH] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!el) return
    const main = el.closest('main') as HTMLElement | null
    const calc = () => {
      if (!isXl() || !main) { setH(null); return }
      // offsetTop chain ignores entrance transforms (motion y-offsets)
      let top = 0
      let n: HTMLElement | null = el
      while (n && n !== main && main.contains(n)) { top += n.offsetTop; n = n.offsetParent as HTMLElement | null }
      // bottom padding of main's content wrapper (the direct child of <main> holding the grid)
      let wrap: HTMLElement | null = el
      while (wrap && wrap.parentElement !== main) wrap = wrap.parentElement
      const padB = wrap ? parseFloat(getComputedStyle(wrap).paddingBottom) || 0 : 0
      const next = Math.max(min, Math.floor(main.clientHeight - top - padB))
      setH((p) => (p === next ? p : next))
    }
    calc()
    const ro = new ResizeObserver(calc)
    if (main) ro.observe(main)
    window.addEventListener('resize', calc)
    const t = window.setTimeout(calc, 450)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc); window.clearTimeout(t) }
  }, [el, min])
  return [setEl, h] as const
}

/** How many fixed-height rows fit in the measured box (xl only; `fallback` otherwise). Pass the returned callback as `ref`.
 *  When `total` rows don't all fit, `reserve` px are kept free for a "+N more" line rendered inside the same box. */
export function useRowsFit<T extends HTMLElement = HTMLDivElement>(rowH: number, fallback: number, min = 1, total = 0, reserve = 28) {
  const [el, setEl] = useState<T | null>(null)
  const [n, setN] = useState(fallback)
  useEffect(() => {
    if (!el) return
    const calc = () => {
      let next = fallback
      if (isXl()) {
        const h = el.clientHeight + 0.5
        next = Math.floor(h / rowH)
        if (total > next) next = Math.floor((h - reserve) / rowH)
        next = Math.max(min, next)
      }
      setN((p) => (p === next ? p : next))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [el, rowH, fallback, min, total, reserve])
  return [setEl, n] as const
}
