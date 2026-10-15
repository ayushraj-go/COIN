import { describe, it, expect } from 'vitest'
import { PALETTES, STOPS, paletteVars, ramp, toOklch, paletteByKey, DEFAULT_PALETTE } from './theme'

describe('colour themes', () => {
  it('ramps run light to dark and keep the base hue', () => {
    const r = ramp('#1f3f99')
    const L = STOPS.map((s) => toOklch(r[s])[0])
    for (let k = 1; k < L.length; k++) expect(L[k]).toBeLessThan(L[k - 1])
    expect(Math.abs(toOklch(r[600])[2] - toOklch('#1f3f99')[2])).toBeLessThan(6)
    expect(Object.values(r).every((h) => /^#[0-9a-f]{6}$/.test(h))).toBe(true)
  })
  it('every palette defines the same tokens', () => {
    const keys = Object.keys(paletteVars(PALETTES[0])).sort()
    for (const p of PALETTES) expect(Object.keys(paletteVars(p)).sort(), p.key).toEqual(keys)
    for (const k of ['--color-brand-700', '--color-accent-500', '--color-slate-500', '--color-emerald-600', '--color-teal-600', '--color-canvas', '--sb-bg', '--sb-active-fg']) expect(keys).toContain(k)
  })
  it('the Amber red accent stays red in every palette', () => {
    for (const p of PALETTES) {
      const h = toOklch(paletteVars(p)['--color-accent-500'])[2]
      expect(h > 345 || h < 40, `${p.key} accent hue ${h}`).toBe(true)
    }
  })
  it('unknown keys fall back to the default palette', () => {
    expect(paletteByKey('nope').key).toBe(DEFAULT_PALETTE)
    expect(PALETTES.length).toBeGreaterThanOrEqual(6)
    expect(DEFAULT_PALETTE).toBe('indigo') // Indigo Twilight — chosen by Ayush
  })
})
