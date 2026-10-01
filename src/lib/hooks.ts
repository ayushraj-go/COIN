import { useMemo } from 'react'
import { useStore, useMe } from '../store/useStore'
import { applyFilters, summarise, visibleIdeas } from './calc'
import type { Idea } from './types'

/** Ideas the current user may see (role + commodity scope, Section 3) */
export function useVisibleIdeas(): Idea[] {
  const me = useMe()
  const ideas = useStore((s) => s.ideas)
  return useMemo(() => (me ? visibleIdeas(me, ideas) : []), [me, ideas])
}

/** Visible ideas with the global filter bar applied (FY, quarter, plant, category, commodity, buyer, lever, direct/indirect) */
export function useFilteredIdeas(): Idea[] {
  const vis = useVisibleIdeas()
  const filters = useStore((s) => s.filters)
  const commodities = useStore((s) => s.commodities)
  return useMemo(() => applyFilters(vis, filters, commodities), [vis, filters, commodities])
}

/** FY target in scope of the active filters (commodity / category / buyer / plant) */
export function useScopedTarget(): number {
  const { commodities, filters, buyerTargets, plantTargets, users, userId } = useStore()
  const me = users.find((u) => u.id === userId)
  return useMemo(() => {
    if (filters.buyerId !== 'All') return buyerTargets[filters.buyerId] ?? 0
    if (filters.plant !== 'All') return plantTargets[filters.plant] ?? 0
    let list = commodities
    if (filters.commodity !== 'All') list = list.filter((c) => c.code === filters.commodity)
    else if (filters.categoryId !== 'All') list = list.filter((c) => c.categoryId === filters.categoryId)
    else if (me && !me.roles.some((r) => ['head', 'finance', 'mgmt', 'admin'].includes(r)) && me.commodities.length) list = list.filter((c) => me.commodities.includes(c.code))
    if (filters.buyingType !== 'All') {
      const cats = useStore.getState().categories.filter((c) => c.buyingType === filters.buyingType).map((c) => c.id)
      list = list.filter((c) => cats.includes(c.categoryId))
    }
    return list.reduce((a, c) => a + c.target, 0)
  }, [commodities, filters, buyerTargets, plantTargets, me])
}

/** KPI group A summary for the filtered scope */
export function useSummary() {
  const ideas = useFilteredIdeas()
  const ledger = useStore((s) => s.ledger)
  const settings = useStore((s) => s.settings)
  const fy = useStore((s) => s.filters.fy)
  const target = useScopedTarget()
  return useMemo(() => summarise(ideas, ledger, target, fy === 'All' ? settings.currentFy : fy, settings.financeValidation, settings.lastRealisationMonth), [ideas, ledger, target, fy, settings])
}
