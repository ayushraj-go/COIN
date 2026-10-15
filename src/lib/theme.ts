// COIN colour themes — every colour in the app comes from one palette.
// A palette names a handful of base colours; full 50–950 ramps are generated in OKLCH and written as CSS variables
// (Tailwind's --color-* tokens), so utility classes, inline styles and chart fills all follow the active palette.
import { create } from 'zustand'

type Rgb = [number, number, number]
const hexToRgb = (h: string): Rgb => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] }
const toHex = (c: Rgb) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360]
}

function fromOklch(L: number, C: number, H: number): Rgb | null {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb: Rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return rgb.every((v) => v >= -0.0005 && v <= 1.0005) ? (rgb.map(gam) as Rgb) : null
}

/** In-gamut colour at lightness L and hue H, with as much of chroma C as sRGB allows */
export function oklchHex(L: number, C: number, H: number): string {
  let lo = 0, hi = C, best = fromOklch(L, 0, H)!
  if (fromOklch(L, C, H)) return toHex(fromOklch(L, C, H)!)
  for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; const c = fromOklch(L, mid, H); if (c) { best = c; lo = mid } else hi = mid }
  return toHex(best)
}

export const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export type Stop = (typeof STOPS)[number]
const L_AT: Record<Stop, number> = { 50: 0.975, 100: 0.942, 200: 0.89, 300: 0.815, 400: 0.715, 500: 0.625, 600: 0.548, 700: 0.482, 800: 0.415, 900: 0.35, 950: 0.27 }
const C_AT: Record<Stop, number> = { 50: 0.07, 100: 0.14, 200: 0.27, 300: 0.46, 400: 0.7, 500: 0.88, 600: 1, 700: 0.98, 800: 0.92, 900: 0.84, 950: 0.72 }

/** 50–950 ramp from one base colour: the base sets hue and peak chroma; each stop has a fixed lightness */
export function ramp(base: string): Record<Stop, string> {
  const [, C, H] = toOklch(base)
  return Object.fromEntries(STOPS.map((s) => [s, oklchHex(L_AT[s], C * C_AT[s], H)])) as Record<Stop, string>
}

export interface Palette {
  key: string
  name: string
  blurb: string
  brand: string // primary hue (navy / blue / …)
  accent: string // Amber red — highlights, CO workspace
  neutral: string // tint of the grey ramp
  success: string
  warning: string
  danger: string
  cats: [string, string, string, string, string] // categorical series (lever groups, avatars, chart series)
  canvas: string
  sidebar: 'dark' | 'light'
  sidebarBg?: string
  /** exact colours for individual stops, e.g. { 'brand-950': '#0a1b44' } */
  fix?: Record<string, string>
}

export const PALETTES: Palette[] = [
  { key: 'amber-navy', name: 'Amber Navy', blurb: 'Deep corporate navy, Amber red highlights, navy sidebar',
    brand: '#1f3f99', accent: '#e11d2e', neutral: '#5f6f8c', success: '#12946b', warning: '#d9891a', danger: '#d92d3a',
    cats: ['#138a8a', '#2f7fc1', '#5560c4', '#8a5cc2', '#c2417a'], canvas: '#f4f6fa', sidebar: 'dark', sidebarBg: '#0b1d47', fix: { 'brand-950': '#0b1d47' } },
  { key: 'midnight', name: 'Midnight Cobalt', blurb: 'Ink-black sidebar, bright cobalt blue, crisp red',
    brand: '#2554d9', accent: '#e5243b', neutral: '#6b7280', success: '#10a37f', warning: '#e09b12', danger: '#e5243b',
    cats: ['#0ea5a4', '#3b9ae1', '#6e62e5', '#a35ce0', '#db4a8b'], canvas: '#f6f7f9', sidebar: 'dark', sidebarBg: '#0b1120' },
  { key: 'royal', name: 'Royal Light', blurb: 'White sidebar, vivid royal blue, Amber red',
    brand: '#1f4fd1', accent: '#e31b23', neutral: '#64748b', success: '#16a34a', warning: '#f59e0b', danger: '#dc2626',
    cats: ['#0d9488', '#0284c7', '#4f46e5', '#7c3aed', '#db2777'], canvas: '#f7f8fb', sidebar: 'light', sidebarBg: '#ffffff' },
  { key: 'graphite', name: 'Graphite & Crimson', blurb: 'Near-monochrome graphite with a bold crimson accent',
    brand: '#34435a', accent: '#c8102e', neutral: '#6b7280', success: '#2f855a', warning: '#c0892e', danger: '#c8102e',
    cats: ['#4a7c8c', '#5b7db1', '#7a6fb0', '#9c6b98', '#b5656b'], canvas: '#f5f5f6', sidebar: 'dark', sidebarBg: '#14181f' },
  { key: 'ocean', name: 'Deep Ocean', blurb: 'Calm ocean blue with a coral-red accent',
    brand: '#0f5c8c', accent: '#e4483d', neutral: '#5f7380', success: '#13917a', warning: '#e0962b', danger: '#d6453a',
    cats: ['#1b9aaa', '#3e7cb1', '#6c6ab8', '#9a6fb0', '#d16c8b'], canvas: '#f3f7f9', sidebar: 'dark', sidebarBg: '#0b2d45' },
  { key: 'indigo', name: 'Indigo Twilight', blurb: 'Rich indigo with a rose-red accent',
    brand: '#4338ca', accent: '#e11d48', neutral: '#6b6f86', success: '#0e9f6e', warning: '#e89b15', danger: '#e11d48',
    cats: ['#0d9488', '#0ea5e9', '#7c3aed', '#c026d3', '#db2777'], canvas: '#f6f6fb', sidebar: 'dark', sidebarBg: '#1e1b4b' },
  { key: 'ivory', name: 'Ivory Heritage', blurb: 'Warm ivory canvas, classic navy, brick red',
    brand: '#1c3a78', accent: '#b8322a', neutral: '#78716c', success: '#3f7d58', warning: '#c28a2c', danger: '#b8322a',
    cats: ['#4d7c78', '#4f6d9a', '#7c6a9c', '#9b6a7f', '#a0704a'], canvas: '#faf7f2', sidebar: 'light', sidebarBg: '#f3eee5' },
  { key: 'arctic', name: 'Arctic White', blurb: 'All-white and minimal, navy type, red only where it matters',
    brand: '#173a8a', accent: '#e11d2e', neutral: '#64748b', success: '#059669', warning: '#d97706', danger: '#dc2626',
    cats: ['#0d9488', '#0284c7', '#4f46e5', '#7c3aed', '#db2777'], canvas: '#ffffff', sidebar: 'light', sidebarBg: '#fbfcfd' },
]
export const DEFAULT_PALETTE = 'indigo'

/** Tailwind colour families and which palette colour drives each */
const FAMILIES: [string[], (p: Palette) => string][] = [
  [['brand', 'blue'], (p) => p.brand],
  [['accent', 'rose'], (p) => p.accent],
  [['slate', 'gray', 'gold'], (p) => p.neutral],
  [['emerald', 'green'], (p) => p.success],
  [['amber', 'orange'], (p) => p.warning],
  [['red'], (p) => p.danger],
  [['teal', 'cyan'], (p) => p.cats[0]],
  [['sky'], (p) => p.cats[1]],
  [['indigo'], (p) => p.cats[2]],
  [['violet', 'purple'], (p) => p.cats[3]],
  [['pink'], (p) => p.cats[4]],
]

export function paletteVars(p: Palette): Record<string, string> {
  const v: Record<string, string> = {}
  for (const [names, pick] of FAMILIES) {
    const r = ramp(pick(p))
    for (const n of names) for (const s of STOPS) v[`--color-${n}-${s}`] = p.fix?.[`${n}-${s}`] ?? r[s]
  }
  const n = (s: Stop) => v[`--color-slate-${s}`]
  Object.assign(v, {
    '--color-canvas': p.canvas,
    '--color-surface': '#ffffff',
    '--color-line': n(200),
    '--color-ink': n(950),
    '--color-ink-2': n(700),
    '--color-muted': n(500),
    '--color-nav': n(50),
    '--color-nav-2': n(100),
    '--color-amber-red': v['--color-accent-500'],
    // workflow buckets and health
    '--color-pipeline': 'var(--color-brand-500)',
    '--color-pipeline-soft': 'var(--color-brand-50)',
    '--color-exec': 'var(--color-amber-500)',
    '--color-exec-soft': 'var(--color-amber-50)',
    '--color-done': 'var(--color-emerald-600)',
    '--color-done-soft': 'var(--color-emerald-50)',
    '--color-dropped': 'var(--color-slate-400)',
    '--color-dropped-soft': 'var(--color-slate-100)',
    '--color-risk': 'var(--color-red-500)',
    '--color-risk-soft': 'var(--color-red-50)',
  })
  const dark = p.sidebar === 'dark'
  const sb = p.sidebarBg ?? (dark ? v['--color-brand-950'] : '#ffffff')
  Object.assign(v, dark ? {
    '--sb-bg': sb, '--sb-fg': 'rgb(255 255 255 / .86)', '--sb-muted': 'rgb(255 255 255 / .5)', '--sb-icon': 'rgb(255 255 255 / .62)',
    '--sb-hover': 'rgb(255 255 255 / .07)', '--sb-active-bg': 'rgb(255 255 255 / .12)', '--sb-active-fg': '#ffffff',
    '--sb-border': 'rgb(255 255 255 / .09)', '--sb-card': 'rgb(255 255 255 / .07)', '--sb-card-fg': '#ffffff', '--sb-card-sub': 'rgb(255 255 255 / .6)',
  } : {
    '--sb-bg': sb, '--sb-fg': n(700), '--sb-muted': n(400), '--sb-icon': n(500),
    '--sb-hover': 'color-mix(in srgb, var(--color-brand-500) 7%, transparent)', '--sb-active-bg': 'color-mix(in srgb, var(--color-brand-500) 11%, transparent)', '--sb-active-fg': v['--color-brand-800'],
    '--sb-border': n(200), '--sb-card': '#ffffff', '--sb-card-fg': n(950), '--sb-card-sub': n(500),
  })
  v['--sb-indicator'] = v['--color-accent-500']
  return v
}

export const paletteByKey = (key: string | null | undefined) => PALETTES.find((p) => p.key === key) ?? PALETTES.find((p) => p.key === DEFAULT_PALETTE)!

const STORAGE_KEY = 'coin-palette'
function readSaved(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PALETTE } catch { return DEFAULT_PALETTE }
}

export function applyPalette(key: string) {
  const p = paletteByKey(key)
  const root = document.documentElement
  for (const [k, val] of Object.entries(paletteVars(p))) root.style.setProperty(k, val)
  root.dataset.sidebar = p.sidebar
  root.dataset.palette = p.key
}

export const usePalette = create<{ key: string; set: (key: string) => void }>((set) => ({
  key: readSaved(),
  set: (key) => {
    try { localStorage.setItem(STORAGE_KEY, key) } catch { /* private mode — theme still applies for this visit */ }
    applyPalette(key)
    set({ key })
  },
}))

/** apply the saved palette before the first render */
export function initPalette() { applyPalette(readSaved()) }
