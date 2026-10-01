// MIS by workspace. CO (Cost Optimisation) = execution and realisation after approval; IN (Innovation Network) = ideas, pipeline,
// funnel, suppliers, campaigns, approvals and SLAs. Every report and every KPI carries the workspace it belongs to.
import { KPIS } from '../../lib/scope'

export type Space = 'IN' | 'CO'
/** CO leads everywhere */
export const SPACE_ORDER: Space[] = ['CO', 'IN']
export const SPACE_META: Record<Space, { name: string; color: string; tagline: string }> = {
  CO: { name: 'Cost Optimisation', color: '#0f9f8a', tagline: 'Execution and realisation: implementation, due dates and slippage, realised savings from MRN, Finance validation, price leakage' },
  IN: { name: 'Innovation Network', color: '#2459e0', tagline: 'Ideas, pipeline and funnel, suppliers, campaigns, approvals and SLAs' },
}

export interface MisReport {
  key: string
  space: Space
  /** Number within its workspace */
  n: number
  name: string
  audience: string
  visuals: string
  frequency: string
}

type Def = Omit<MisReport, 'n' | 'space'>
const CO_DEFS: Def[] = [
  { key: 'home', name: 'Savings summary', audience: 'Sourcing team', visuals: 'Realised and committed savings, monthly realised trend, top ideas in execution and implemented', frequency: 'Live' },
  { key: 'bridge', name: 'Savings bridge', audience: 'Sourcing Head, Management', visuals: 'Waterfall: realised → committed → pipeline → total tracked', frequency: 'Live / monthly' },
  { key: 'execution', name: 'Execution Hub dashboard', audience: 'Owners, Leads', visuals: 'Timeline, health badges, due / overdue', frequency: 'Live' },
  { key: 'leakage', name: 'Realisation & leakage', audience: 'Finance, Sourcing Head', visuals: 'Committed vs realised, Finance validation status, price leakage by supplier', frequency: 'Monthly' },
  { key: 'commodity', name: 'Commodity scorecard', audience: 'Commodity Leads', visuals: 'Realised, committed, realisation rate and price leakage per commodity', frequency: 'Live' },
  { key: 'buyer', name: 'Buyer scorecard', audience: 'Sourcing Head', visuals: 'Realised, committed, on-time %, overdue ₹ and realisation rate per buyer', frequency: 'Live / monthly' },
  { key: 'lever', name: 'Category mix', audience: 'Sourcing Head', visuals: 'Realised savings by category; structural share trend', frequency: 'Monthly' },
  { key: 'closure', name: 'FY closure & carry-over', audience: 'Management, Finance', visuals: 'FY realised and committed savings, carry-over into next FY', frequency: 'Annual' },
]
const IN_DEFS: Def[] = [
  { key: 'home', name: 'Idea portfolio summary', audience: 'Sourcing team', visuals: 'Ideas by bucket, stage-to-stage funnel, monthly idea inflow, top pipeline ideas', frequency: 'Live' },
  { key: 'commodity', name: 'Commodity scorecard', audience: 'Commodity Leads', visuals: 'Ideas, pipeline value, conversion and SLA breaches per commodity', frequency: 'Live' },
  { key: 'buyer', name: 'Buyer scorecard', audience: 'Sourcing Head', visuals: 'Ideas, pipeline value, conversion, ageing and SLA breaches per buyer', frequency: 'Live / monthly' },
  { key: 'supplier', name: 'Supplier innovation scorecard', audience: 'Sourcing, supplier reviews', visuals: 'Ideas, value, conversion, gain-share and feasibility response per supplier', frequency: 'Quarterly' },
  { key: 'campaign', name: 'Campaign effectiveness', audience: 'Sourcing Excellence', visuals: 'Yield, value, conversion per campaign / workshop', frequency: 'Per campaign' },
  { key: 'ageing', name: 'Ageing & SLA breach', audience: 'Commodity Leads', visuals: 'Ideas beyond SLA by stage and owner', frequency: 'Weekly' },
  { key: 'drops', name: 'Drop analysis', audience: 'Sourcing Head', visuals: 'Month-wise drops by reason and stage', frequency: 'Monthly' },
]
export const MIS_REPORTS: Record<Space, MisReport[]> = {
  CO: CO_DEFS.map((d, k) => ({ ...d, space: 'CO', n: k + 1 })),
  IN: IN_DEFS.map((d, k) => ({ ...d, space: 'IN', n: k + 1 })),
}
/** Workspaces a report key appears in (CO first) */
export const spacesOfReport = (key: string): Space[] => SPACE_ORDER.filter((s) => MIS_REPORTS[s].some((r) => r.key === key))
export const findReport = (key: string, space: Space) => MIS_REPORTS[space].find((r) => r.key === key)

/** KPI → workspace. C3 (stage bottleneck) is in both: IN reads review stages, CO reads NPD sample, execution and PAP stages. */
export const KPI_SPACES: Record<string, Space[]> = {
  A2: ['CO'], A3: ['IN'], A4: ['CO'], A5: ['CO'], A9: ['CO'],
  B1: ['IN'], B2: ['IN'], B3: ['IN'], B4: ['IN'],
  C1: ['IN'], C2: ['CO'], C3: ['CO', 'IN'],
  D1: ['CO'], D2: ['CO'], D3: ['CO'], D4: ['CO'],
  E1: ['CO'], E2: ['CO'],
  F1: ['IN'], F2: ['IN'], F3: ['IN'],
}
export const kpisOf = (space: Space) => KPIS.filter((k) => (KPI_SPACES[k.id] ?? ['CO', 'IN']).includes(space))

export const KPI_INTRO_BY_SPACE: Record<Space, string> = {
  CO: 'Cost Optimisation KPIs measure what approved ideas deliver: committed and realised savings, carry-over, on-time implementation, overdue value, realisation rate, price leakage and the category mix of realised savings.',
  IN: 'Innovation Network KPIs measure the idea network: pipeline value, ideas by stage, conversion, drops, ageing against SLA, review speed and how widely suppliers, campaigns and departments contribute.',
}
export const LIB_INTRO_BY_SPACE: Record<Space, string> = {
  CO: 'Execution and realisation reports for everything after approval. The Monthly Cost Optimisation Report goes to management automatically after each realisation run.',
  IN: 'Idea network reports: the portfolio and funnel, commodity and buyer scorecards on ideas, suppliers, campaigns, SLA ageing and drops.',
}

/** Stages that belong to CO for the C3 stage-bottleneck cut */
export const CO_STAGES = ['NPD sample', 'NPD ECN up to sample approval', 'Execution', 'Price revision in PAP', 'Price / source change in PAP']
