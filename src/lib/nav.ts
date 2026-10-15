// Section 8 — navigation by role; Section 3 — permission matrix
import type { RoleKey, User } from './types'

export type PermKey = 'submit' | 'validate' | 'feasibility' | 'techeval' | 'approve' | 'execute' | 'financeValidate' | 'campaign' | 'masters' | 'viewAll'
export const PERMS: Record<PermKey, RoleKey[]> = {
  submit: ['submitter', 'supplier', 'buyer', 'lead', 'head', 'teamlead', 'deptlead', 'depthead', 'execowner'],
  validate: ['buyer', 'lead', 'head', 'admin', 'teamlead'],
  feasibility: ['teamlead', 'head', 'admin'],
  techeval: ['deptlead', 'head', 'admin'],
  approve: ['depthead', 'head', 'admin'],
  execute: ['execowner', 'buyer', 'lead', 'head', 'admin'],
  financeValidate: ['finance'],
  campaign: ['buyer', 'lead', 'head', 'admin'],
  masters: ['admin'],
  viewAll: ['head', 'finance', 'mgmt', 'admin'],
}
export const can = (u: User | null | undefined, p: PermKey) => !!u && u.roles.some((r) => PERMS[p].includes(r))

export type Space = 'IN' | 'CO'
/** spaces: which workspace shows the item (omitted = both); pinned items sit at the bottom of the sidebar in every workspace */
export interface NavItem { key: string; label: string; path: string; icon: string; roles: RoleKey[]; module?: string; section: string; spaces?: Space[]; pinned?: boolean }
const ALL: RoleKey[] = ['submitter', 'supplier', 'buyer', 'lead', 'head', 'finance', 'mgmt', 'admin', 'teamlead', 'deptlead', 'depthead', 'execowner']
const LADDER: RoleKey[] = ['teamlead', 'deptlead', 'depthead', 'execowner']
export const NAV: NavItem[] = [
  { key: 'home', label: 'Dashboard', path: '/', icon: 'LayoutDashboard', roles: ALL, module: 'M1', section: 'Overview' },
  { key: 'queue', label: 'My queue', path: '/queue', icon: 'Inbox', roles: ['teamlead', 'deptlead', 'depthead', 'execowner', 'finance', 'head', 'admin'], section: 'Overview' },
  { key: 'scope', label: 'Scope & Methodology', path: '/scope', icon: 'BookOpenText', roles: ALL, section: 'Overview' },
  // IN — Innovation Network: ideas up to approval
  { key: 'register', label: 'Idea Register', path: '/ideas', icon: 'Table2', roles: ['buyer', 'lead', 'head', 'admin', ...LADDER], module: 'M2', section: 'Ideas', spaces: ['IN'] },
  { key: 'myideas', label: 'My Ideas', path: '/my-ideas', icon: 'Lightbulb', roles: ['submitter', 'supplier'], module: 'M2', section: 'Ideas', spaces: ['IN'] },
  { key: 'submit', label: 'Submit Idea', path: '/submit', icon: 'CirclePlus', roles: ['submitter', 'supplier', 'buyer', 'lead', 'head', ...LADDER], module: 'M3', section: 'Ideas', spaces: ['IN'] },
  { key: 'workshops', label: 'Workshops', path: '/workshops', icon: 'Presentation', roles: ['supplier'], module: 'M6', section: 'Supplier', spaces: ['IN'] },
  { key: 'campaigns', label: 'Campaigns', path: '/campaigns', icon: 'Megaphone', roles: ['buyer', 'lead', 'head', 'admin'], module: 'M7', section: 'Network', spaces: ['IN'] },
  { key: 'admin', label: 'Admin & Masters', path: '/admin', icon: 'Settings2', roles: ['admin'], module: 'M12', section: 'System', spaces: ['IN'] },
  // CO — Cost Optimisation: implementation after approval
  // CO — stages 5–6: Execution started (TRACE) and Verification, with part-wise savings proof (PROOF)
  { key: 'execution', label: 'Execution Hub', path: '/execution', icon: 'Rocket', roles: ['buyer', 'lead', 'head', 'admin', 'execowner', 'depthead', 'finance'], module: 'M8', section: 'Implementation', spaces: ['CO'] },
  { key: 'proof', label: 'Savings proof', path: '/proof', icon: 'BadgeIndianRupee', roles: ['buyer', 'lead', 'head', 'finance', 'mgmt', 'admin', ...LADDER], module: 'M9', section: 'Implementation', spaces: ['CO'] },
  { key: 'implemented', label: 'Verification', path: '/ideas?bucket=Implemented', icon: 'ShieldCheck', roles: ['buyer', 'lead', 'head', 'finance', 'mgmt', 'admin', ...LADDER], section: 'Implementation', spaces: ['CO'] },
  // NPD development master (read-only, synced from VMS) — both workspaces
  { key: 'npd', label: 'NPD master', path: '/npd', icon: 'FlaskConical', roles: ['buyer', 'lead', 'head', 'finance', 'mgmt', 'admin', ...LADDER], section: 'Masters' },
  // pinned at the bottom in every workspace (Scope & Methodology sits at the top under Overview)
  { key: 'reports', label: 'MIS', path: '/reports', icon: 'ChartColumnBig', roles: ['buyer', 'lead', 'head', 'finance', 'mgmt', 'admin', 'deptlead', 'depthead'], module: 'M10', section: 'Pinned', pinned: true },
]
export const navFor = (u: User | null) => (u ? NAV.filter((n) => n.roles.some((r) => u.roles.includes(r))) : [])
/** Items for a workspace. Before a workspace is chosen only Home (the CO / IN chooser) plus the pinned items are offered */
export const navForSpace = (u: User | null, space: Space | null) => {
  const all = navFor(u)
  if (!space) return all.filter((n) => n.key === 'home' || n.key === 'queue' || n.key === 'scope' || n.pinned).map((n) => (n.key === 'home' ? { ...n, label: 'Home', icon: 'House' } : n))
  return all.filter((n) => n.pinned || !n.spaces || n.spaces.includes(space))
}
/** Which workspace a deep link belongs to (used when a page is opened before a workspace is chosen) */
export const spaceForPath = (path: string): Space | null => {
  if (path === '/' || path.startsWith('/scope') || path.startsWith('/reports') || path.startsWith('/queue')) return null
  if (path.startsWith('/execution') || path.startsWith('/proof')) return 'CO'
  if (path.startsWith('/npd')) return null
  return 'IN'
}
export const ROLE_LABEL: Record<RoleKey, string> = { submitter: 'Employee', supplier: 'Supplier', buyer: 'Commodity Buyer', lead: 'Commodity Lead', head: 'Sourcing Head', finance: 'Finance verifier', mgmt: 'Management', admin: 'Admin', teamlead: 'Team lead', deptlead: 'Department lead', depthead: 'Department head', execowner: 'Execution owner' }
export const primaryRole = (u: User): RoleKey => (['admin', 'head', 'depthead', 'deptlead', 'teamlead', 'execowner', 'finance', 'mgmt', 'lead', 'buyer', 'supplier', 'submitter'] as RoleKey[]).find((r) => u.roles.includes(r)) ?? 'submitter'
