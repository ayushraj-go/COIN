// Each browser tab keeps its own sign-in (who, which workspace, filters) while the demo data is shared through
// localStorage; a tab running an older build reloads when a newer one opens.
import { describe, it, expect } from 'vitest'
import { LAST_SESSION_KEY, SESSION_KEY, isNewerBuild, mergePersisted, persistedPart, readSession, writeSession } from './session'

const fakeStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('per-tab sign-in', () => {
  it('the shared data never carries who is signed in, the workspace, the filters or UI-only state', () => {
    const p = persistedPart({ ideas: [1], userId: 'u-head', space: 'CO', filters: { fy: 'FY27' }, lastActivity: 5, drawerIdeaId: 'x', searchOpen: true, celebrate: 2, toasts: [1], navCollapsed: true, act: () => 1 })
    expect(Object.keys(p).sort()).toEqual(['ideas', 'navCollapsed'])
  })
  it('a tab reads its own sign-in first, a new tab starts as the last person signed in, otherwise signed out', () => {
    const tab = fakeStorage(), shared = fakeStorage()
    expect(readSession(tab, shared).userId).toBeNull()
    writeSession(tab, shared, { userId: 'u-so-emp', space: 'IN', filters: null, lastActivity: 1 })
    expect(readSession(fakeStorage(), shared).userId).toBe('u-so-emp')
    writeSession(tab, shared, { userId: 'u-lead2', space: null, filters: null, lastActivity: 2 })
    const other = fakeStorage(); other.setItem(SESSION_KEY, JSON.stringify({ userId: 'u-so-emp' }))
    expect(readSession(other, shared).userId).toBe('u-so-emp')
    expect(readSession(tab, shared).userId).toBe('u-lead2')
  })
  it('signing out clears this tab and the default for new tabs', () => {
    const tab = fakeStorage(), shared = fakeStorage()
    writeSession(tab, shared, { userId: 'u-head', space: null, filters: null, lastActivity: 1 })
    writeSession(tab, shared, { userId: null, space: null, filters: null, lastActivity: 2 })
    expect(tab.getItem(SESSION_KEY)).toBeNull()
    expect(shared.getItem(LAST_SESSION_KEY)).toBeNull()
  })
  it('loading shared data keeps this tab’s sign-in even when older saved data still has one', () => {
    const current = { userId: 'u-lead2', space: 'IN', filters: { fy: 'FY27' }, lastActivity: 9, ideas: [] as number[], act: () => 1 }
    const merged = mergePersisted({ userId: 'u-head', space: 'CO', filters: { fy: 'All' }, ideas: [7] }, current) as typeof current
    expect(merged.userId).toBe('u-lead2'); expect(merged.space).toBe('IN'); expect(merged.filters).toEqual({ fy: 'FY27' })
    expect(merged.ideas).toEqual([7])
    expect(typeof merged.act).toBe('function')
  })
})

describe('build check across tabs', () => {
  it('only a newer build makes a tab reload', () => {
    expect(isNewerBuild('200', '100')).toBe(true)
    expect(isNewerBuild('100', '200')).toBe(false)
    expect(isNewerBuild('100', '100')).toBe(false)
    expect(isNewerBuild(null, '100')).toBe(false)
  })
})
