// COIN = Cost Optimisation & Innovation Network, so CO is Cost Optimisation and IN is the Innovation Network.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { SPACE_META } from '../pages/reports/space'
import { WORKSPACES } from './scope'

const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '/index.html', '!/src/lib/naming.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('workspace names', () => {
  it('reads every source file', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })
  it('never says Cost Innovation, in any case or across a line break', () => {
    expect(Object.keys(sources).filter((f) => /cost(\s|<[^>]*>|&nbsp;)*innovation/i.test(sources[f]))).toEqual([])
  })
  it('has no CI symbol left', () => {
    expect(Object.keys(sources).filter((f) => /\bCI\b/.test(sources[f]))).toEqual([])
  })
  it('calls stage 3 Management, never the Central ID', () => {
    expect(Object.keys(sources).filter((f) => /Central ID|central@|id-central/.test(sources[f]))).toEqual([])
  })
  it('names the Execution Manager ID wherever it lists who sees everything', () => {
    // the no-access page and the MIS gate explain who sees all: Finance, Management and the Execution Manager
    for (const f of ['src/pages/Idea360.tsx', 'src/pages/Reports.tsx']) {
      const key = Object.keys(sources).find((k) => k.endsWith(f.replace('src/', '')) || k.endsWith(f))!
      const line = sources[key].split('\n').find((l) => /Management ID/.test(l) && /desc=/.test(l)) ?? ''
      expect(line, f).toMatch(/Execution Manager ID/)
    }
  })
  it('calls IN the Innovation Network', () => {
    expect(SPACE_META.IN.name).toBe('Innovation Network')
    expect(WORKSPACES.find((w) => w.code === 'IN')?.name).toBe('Innovation Network')
  })
})
