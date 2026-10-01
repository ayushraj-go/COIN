// M1 — home: workspace chooser (Entry), CO implementation dashboard, or the role-based IN dashboards
import { useMe, useStore } from '../store/useStore'
import { primaryRole } from '../lib/nav'
import SourcingHome from './home/SourcingHome'
import SubmitterHome from './home/SubmitterHome'
import SupplierHome from './home/SupplierHome'
import EvaluatorHome from './home/EvaluatorHome'
import Entry from './Entry'
import CoHome from './co/CoHome'

export default function Home() {
  const me = useMe()
  const space = useStore((s) => s.space)
  if (!me) return null
  if (!space) return <Entry />
  if (space === 'CO') return <CoHome />
  const role = primaryRole(me)
  if (role === 'supplier') return <SupplierHome />
  if (role === 'techeval') return <EvaluatorHome />
  if (role === 'submitter') return <SubmitterHome />
  return <SourcingHome key={role} variant={role === 'finance' ? 'finance' : role === 'mgmt' ? 'mgmt' : 'sourcing'} />
}
