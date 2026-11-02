// Test helper — takes a submitted idea through stage 2: an event, both forms, and the Go ahead that sends it to management.
import { useStore } from './useStore'
import { ideaAnnualised } from '../lib/calc'
import { EVALUATION_MIN, ideaDept } from '../lib/workflow'

const st = () => useStore.getState()
const idea = (id: string) => st().ideas.find((i) => i.id === id)!

/** Runs as whoever is signed in — the department ID, or the Management ID */
export function throughWorkshop(id: string) {
  const dept = ideaDept(idea(id))
  const ev = st().createWorkshopEvent(id, { date: '2026-11-10', time: '11:00', venue: 'Noida', points: ['Workable?'], attendees: [dept], spoc: { name: 'Test SPOC', email: 'spoc@ambergroupindia.com' } })
  st().recordFeasibility(id, { technical: 'Yes', cost: 'Valid', conflict: 'None', decision: 'Go', departments: [dept] })
  if (ideaAnnualised(idea(id)) >= EVALUATION_MIN) st().recordEvaluation(id, 'Recommend', 'ok')
  return st().closeWorkshopEvent(id, ev, { notes: 'ok', closedBy: 'Test SPOC', outcome: 'Go ahead' })
}
