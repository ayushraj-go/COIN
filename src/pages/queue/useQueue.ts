// My queue for the signed-in user, recomputed when ideas, users or the SLA master change
import { useMemo } from 'react'
import { useMe, useStore } from '../../store/useStore'
import { queueFor } from './model'

export function useMyQueue() {
  const me = useMe()
  const ideas = useStore((s) => s.ideas)
  const users = useStore((s) => s.users)
  const rules = useStore((s) => s.slaRules)
  return useMemo(() => (me ? queueFor(me, ideas, users, Date.now(), rules) : { mine: [], team: [], all: [] }), [me, ideas, users, rules])
}
