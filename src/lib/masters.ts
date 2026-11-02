import type { Category, Commodity, Lever, LeverGroup, Part, Plant, RouteKey, Supplier, User, ApprovalRule, EmailTemplate, SlaRule } from './types'
import { DROP_REASONS_DEFAULT, SLA_DEFAULTS } from './scope'

export const CR = 1_00_00_000
export const LAKH = 1_00_000

// ─── Section 5: Cost innovation type (lever) master ───────────────────────────
export const LEVERS_DEFAULT: Lever[] = [
  { id: 'L01', group: 'Commercial', name: 'Negotiation', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Commercial', evaluator: '—', npdSample: 'No', icon: 'Handshake', active: true },
  { id: 'L02', group: 'Commercial', name: 'Payment terms improvement', savingsType: 'One-time', defaultSavingsType: 'One-time', route: 'Commercial', evaluator: '—', npdSample: 'No', icon: 'CalendarClock', active: true },
  { id: 'L03', group: 'Commercial', name: 'Forex determination', savingsType: 'Hard / Avoidance', defaultSavingsType: 'Hard', route: 'Commercial', evaluator: '—', npdSample: 'No', icon: 'ArrowLeftRight', active: true },
  { id: 'L04', group: 'Commercial', name: 'Volume control / consolidation', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Commercial', evaluator: '—', npdSample: 'No', icon: 'Layers', active: true },
  { id: 'L05', group: 'Supply base', name: 'Alternate supplier (same drawing)', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Supplier change', evaluator: 'DQA', npdSample: 'Yes (supplier qualification)', icon: 'Users', active: true },
  { id: 'L06', group: 'Supply base', name: 'Localisation', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D + DQA', npdSample: 'Yes', icon: 'MapPin', active: true },
  { id: 'L07', group: 'Supply base', name: 'Regionalisation', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Supplier change', evaluator: 'DQA', npdSample: 'Yes', icon: 'Map', active: true },
  { id: 'L08', group: 'Supply base', name: 'Strategic masking', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'To be confirmed', evaluator: 'To be confirmed', npdSample: 'To be confirmed', icon: 'EyeOff', active: true },
  { id: 'L09', group: 'Engineering', name: 'Value engineering', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D', npdSample: 'Yes', icon: 'Lightbulb', active: true },
  { id: 'L10', group: 'Engineering', name: 'Cost engineering', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D', npdSample: 'Yes', icon: 'Calculator', active: true },
  { id: 'L11', group: 'Engineering', name: 'Alternate material substitution', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D + Quality', npdSample: 'Yes', icon: 'FlaskConical', active: true },
  { id: 'L12', group: 'Engineering', name: 'Dimensional correction', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D', npdSample: 'Yes', icon: 'Ruler', active: true },
  { id: 'L13', group: 'Engineering', name: 'Tolerance update', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D + Quality', npdSample: 'Yes', icon: 'SlidersHorizontal', active: true },
  { id: 'L14', group: 'Logistics & packing', name: 'Freight optimisation', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Commercial', evaluator: '—', npdSample: 'No', icon: 'Truck', active: true },
  { id: 'L15', group: 'Logistics & packing', name: 'Packing standard improvement', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'Quality + Process', npdSample: 'Trial only', icon: 'Package', active: true },
  { id: 'L16', group: 'Operational', name: 'Process optimisation', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Internal', evaluator: 'Process', npdSample: 'No', icon: 'Workflow', active: true },
  { id: 'L17', group: 'Operational', name: 'Scrap management', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Internal', evaluator: 'Production', npdSample: 'No', icon: 'Recycle', active: true },
  { id: 'L18', group: 'Operational', name: 'Digitisation & automation', savingsType: 'Hard / Avoidance', defaultSavingsType: 'Hard', route: 'Internal', evaluator: 'Process', npdSample: 'No', icon: 'Cpu', active: true },
]

// Distinct icon + tint per lever group (Section 14)
export const LEVER_GROUP_STYLE: Record<LeverGroup, { color: string; soft: string; text: string; icon: string }> = {
  Commercial: { color: 'var(--color-violet-600)', soft: 'var(--color-violet-50)', text: 'var(--color-violet-700)', icon: 'Handshake' },
  'Supply base': { color: 'var(--color-teal-600)', soft: 'var(--color-teal-50)', text: 'var(--color-teal-700)', icon: 'Factory' },
  Engineering: { color: 'var(--color-indigo-600)', soft: 'var(--color-indigo-50)', text: 'var(--color-indigo-700)', icon: 'Cog' },
  'Logistics & packing': { color: 'var(--color-sky-600)', soft: 'var(--color-sky-50)', text: 'var(--color-sky-700)', icon: 'Truck' },
  Operational: { color: 'var(--color-pink-600)', soft: 'var(--color-pink-50)', text: 'var(--color-pink-700)', icon: 'Settings2' },
}

// COIN workflow — every idea, on every route, runs the same five stages:
// Idea submitted → Workshop / event creation → Management approval & KPI allocation → Execution started → Verification.
// Stages 1–3 live in IN (Cost Innovation), 4–5 in CO (Cost Optimisation). Stage 2 holds the workshop event, the technical
// feasibility form and the commercial evaluation form; Go ahead on the event sends the idea to stage 3.
export const STAGE = {
  submitted: 'Idea submitted',
  feasibility: 'Workshop / event creation',
  approval: 'Management approval & KPI allocation',
  execution: 'Execution started',
  verification: 'Verification',
} as const
/** Stages an idea moves through after submission (the tracker adds "Idea submitted" in front) */
export const WORKFLOW_STAGES: string[] = [STAGE.feasibility, STAGE.approval, STAGE.execution, STAGE.verification]
export const TRACKER_STAGES: string[] = [STAGE.submitted, ...WORKFLOW_STAGES]
/** IN = stages up to management approval; CO = Execution started and Verification */
export const IN_STAGES: string[] = [STAGE.feasibility, STAGE.approval]
export const CO_STAGE_NAMES: string[] = [STAGE.execution, STAGE.verification]
export const ROUTE_STAGES: Record<RouteKey, string[]> = {
  Commercial: WORKFLOW_STAGES,
  'Supplier change': WORKFLOW_STAGES,
  Technical: WORKFLOW_STAGES,
  Internal: WORKFLOW_STAGES,
  'To be confirmed': WORKFLOW_STAGES,
}

// Labels for stage chips
export const STAGE_SHORT: Record<string, string> = { ...Object.fromEntries(TRACKER_STAGES.map((s) => [s, s])), [STAGE.feasibility]: 'Workshop / event', [STAGE.approval]: 'Management approval' }
/** The line under a stage name on the tracker */
export const STAGE_NOTE: Record<string, string> = { [STAGE.feasibility]: 'Technical feasibility and commercial feasibility check' }

// Stages that carry an SLA rule (Section 12)
export const STAGE_SLA_KEY: Record<string, string> = {
  [STAGE.feasibility]: STAGE.feasibility,
  [STAGE.approval]: STAGE.approval,
}

export const FEASIBILITY_STAGES: string[] = [STAGE.feasibility]

/** Risk assessment factors at evaluation (each Low / Medium / High with ₹ cost at risk) */
export const RISK_FACTORS: { key: string; label: string; hint: string }[] = [
  { key: 'quality', label: 'Quality', hint: 'Field failure, warranty or spec deviation' },
  { key: 'supply', label: 'Supply continuity', hint: 'Single source, capacity or ramp-up' },
  { key: 'oem', label: 'Customer / OEM approval', hint: 'Customer PPAP or approval needed' },
  { key: 'tooling', label: 'Tooling & lead time', hint: 'New tool, trial or long lead time' },
  { key: 'price', label: 'Price volatility', hint: 'Commodity / forex linked price' },
]

/** Technical evaluator(s) named on the idea category — shown as reference in the category / route master */
export const rndDeptFor = (evaluator?: string) =>
  !evaluator || evaluator === '—' || evaluator === 'To be confirmed' ? 'R&D' : evaluator.includes('R&D') ? evaluator : `R&D + ${evaluator}`

/** Execution started — route-specific steps first, then the three steps every idea closes with */
export const FINAL_MILESTONES = ['First MRN at new price', 'Implementation confirmed', 'Handed for verification'] as const
export const MILESTONE_TEMPLATES: Record<RouteKey, string[]> = {
  Technical: ['NPD ECN raised', 'NPD sample approved', 'PAP price approved', ...FINAL_MILESTONES],
  'Supplier change': ['NPD sample approved', 'Source change approved in PAP', ...FINAL_MILESTONES],
  Commercial: ['PAP revision request raised', 'PAP price approved', ...FINAL_MILESTONES],
  Internal: ['Execution plan signed off', 'Trial run', ...FINAL_MILESTONES],
  'To be confirmed': ['PAP revision request raised', 'PAP price approved', ...FINAL_MILESTONES],
}

export const DEPARTMENTS = ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance', 'Sourcing', 'HR']
export const EVIDENCE_TAGS = ['Trial', 'Quote', 'Benchmark', 'Drawing']

export const PLANTS_DEFAULT: Plant[] = [
  { id: 'RJP', name: 'Rajpura', bu: 'RAC' },
  { id: 'DDN', name: 'Dehradun', bu: 'RAC' },
  { id: 'JHJ', name: 'Jhajjar', bu: 'RAC' },
  { id: 'SRC', name: 'Sri City', bu: 'RAC' },
  { id: 'PUN', name: 'Pune (Ranjangaon)', bu: 'Components' },
  { id: 'NDA', name: 'Noida', bu: 'Electronics' },
  { id: 'GNO', name: 'Greater Noida', bu: 'Components' },
]

export const CATEGORIES_DEFAULT: Category[] = [
  { id: 'MET', name: 'Metals', buyingType: 'Direct' },
  { id: 'ELE', name: 'Electricals', buyingType: 'Direct' },
  { id: 'PLA', name: 'Plastics', buyingType: 'Direct' },
  { id: 'PKG', name: 'Packing', buyingType: 'Direct' },
  { id: 'LOG', name: 'Logistics', buyingType: 'Indirect' },
  { id: 'MRO', name: 'MRO & Consumables', buyingType: 'Indirect' },
  { id: 'SRV', name: 'Services & Facilities', buyingType: 'Indirect' },
  { id: 'CHE', name: 'Chemicals & Gases', buyingType: 'Direct' },
  { id: 'CAP', name: 'Tooling & Capex', buyingType: 'Indirect' },
]

/** Sourcing commodity master — from the "npd data" sheet (Development SPOC · Sourcing Corporate). The SPOC named for a
 *  commodity is its team lead: kept as master data; ideas are handled by the Sourcing ID.
 *  The six gases / oils without a code in the sheet carry a short made-up code (O2, N2, HEL, CO2, PNO, LPG). */
type CommodityRow = [code: string, name: string, categoryId: string, leadId: string]
const COMMODITY_ROWS: CommodityRow[] = [
  ['AA', 'Aluminium', 'MET', 'u-lead1'],
  ['AH', 'FG-PLC', 'PLA', 'u-lead3'],
  ['AI', 'FG-SMC', 'PLA', 'u-lead3'],
  ['AJ', 'Steel', 'MET', 'u-lead4'],
  ['AO', 'Compressor', 'ELE', 'u-lead2'],
  ['AP', 'Motor', 'ELE', 'u-lead2'],
  ['AS', 'Sticker & Label', 'PKG', 'u-lead5'],
  ['AT', 'Remote', 'ELE', 'u-lead6'],
  ['AU', 'Foam', 'PLA', 'u-lead7'],
  ['AV', 'EPS', 'PKG', 'u-lead3'],
  ['AX', 'Brass Parts', 'MET', 'u-lead6'],
  ['AY', 'Capacitor', 'ELE', 'u-lead6'],
  ['AZ', 'Cross Flow Fan', 'PLA', 'u-lead3'],
  ['BB', 'Fan', 'PLA', 'u-lead3'],
  ['BC', 'Gas', 'CHE', 'u-lead2'],
  ['BD', 'Hardware', 'MET', 'u-lead7'],
  ['BF', 'Poly Bag', 'PKG', 'u-lead5'],
  ['BG', 'Rear Grill', 'PLA', 'u-lead7'],
  ['BH', 'Hardware Other', 'MET', 'u-lead7'],
  ['BI', 'Rubber Parts', 'PLA', 'u-lead6'],
  ['BJ', 'Service Valve', 'MET', 'u-lead6'],
  ['BK', 'Tape', 'PKG', 'u-lead5'],
  ['BL', 'Wire', 'ELE', 'u-lead6'],
  ['BN', 'Bolt', 'MET', 'u-lead7'],
  ['BO', 'Brazing Rod', 'MET', 'u-lead1'],
  ['BP', 'Carton Box', 'PKG', 'u-lead5'],
  ['BQ', 'Chemical', 'CHE', 'u-lead8'],
  ['BR', 'FG-Copper Tubing', 'MET', 'u-lead3'],
  ['BS', 'Powder', 'CHE', 'u-lead3'],
  ['BT', 'Terminal Block', 'ELE', 'u-lead7'],
  ['BU', 'Packing Material', 'PKG', 'u-lead5'],
  ['BV', 'Copper Tube', 'MET', 'u-lead1'],
  ['BW', 'Plastic Granules', 'PLA', 'u-lead9'],
  ['BX', 'General', 'SRV', 'u-lead8'],
  ['BY', 'Printing & Stationery', 'PKG', 'u-lead5'],
  ['BZ', 'Electrical & Electronics Store & Spares', 'MRO', 'u-lead8'],
  ['CA', 'Mechanical', 'MRO', 'u-lead8'],
  ['CB', 'Plastic Grinding', 'PLA', 'u-lead3'],
  ['CM', 'Oil & Lubricants', 'MRO', 'u-lead8'],
  ['CO', 'Tools & Die', 'CAP', 'u-lead10'],
  ['CT', 'EPS Assembly', 'PKG', 'u-lead3'],
  ['CV', 'Controller', 'ELE', 'u-lead11'],
  ['CW', 'Display PCB', 'ELE', 'u-lead11'],
  ['CX', 'Blower', 'ELE', 'u-lead3'],
  ['CZ', 'Lab Equipments', 'CAP', 'u-lead8'],
  ['DB', 'Brazing Ring-Imp', 'MET', 'u-lead1'],
  ['DG', 'RM-Aluminium', 'MET', 'u-lead1'],
  ['DP', 'Capillary Tube', 'MET', 'u-lead1'],
  ['DR', 'Louver/Stepping Motor', 'ELE', 'u-lead2'],
  ['DT', 'Main PCB', 'ELE', 'u-lead2'],
  ['DV', 'Master Batch', 'PLA', 'u-lead9'],
  ['DW', 'Glass', 'MRO', 'u-lead8'],
  ['DX', 'PCB', 'ELE', 'u-lead2'],
  ['DY', 'Gas AC', 'CHE', 'u-lead2'],
  ['DZ', 'Compressor-Cust', 'ELE', 'u-lead2'],
  ['EA', 'Compressor-Imp', 'ELE', 'u-lead2'],
  ['EB', 'Controller IDU-Cust', 'ELE', 'u-lead11'],
  ['EC', 'Controller ODU-Cust', 'ELE', 'u-lead11'],
  ['ED', 'Controller WAC-Cust', 'ELE', 'u-lead11'],
  ['EF', 'Controller IDU', 'ELE', 'u-lead11'],
  ['EG', 'Controller IDU-Imp', 'ELE', 'u-lead11'],
  ['EH', 'Controller ODU-Imp', 'ELE', 'u-lead11'],
  ['EI', 'Controller WAC-Imp', 'ELE', 'u-lead11'],
  ['EJ', 'Controller WAC', 'ELE', 'u-lead11'],
  ['EK', 'Copper Part RM-Cust', 'MET', 'u-lead1'],
  ['EL', 'FG-Electrical And Electronics Parts', 'ELE', 'u-lead2'],
  ['EM', 'Copper Tube-Imp', 'MET', 'u-lead1'],
  ['EN', 'Copper Capillary Tube RM', 'MET', 'u-lead1'],
  ['EO', 'Copper Capillary Tube BOP', 'MET', 'u-lead1'],
  ['EQ', 'Display PCB IDU-Cust', 'ELE', 'u-lead11'],
  ['ER', 'Electrical And Electronics Parts RM', 'ELE', 'u-lead2'],
  ['ES', 'Display PCB IDU', 'ELE', 'u-lead11'],
  ['ET', 'Display PCB IDU-Imp', 'ELE', 'u-lead11'],
  ['EU', 'Display PCB WAC-Imp', 'ELE', 'u-lead11'],
  ['EV', 'Display PCB WAC', 'ELE', 'u-lead11'],
  ['EW', 'Electrical And Electronics Parts RM-Cust', 'ELE', 'u-lead2'],
  ['EX', 'Electrical And Electronics Parts RM-Imp', 'ELE', 'u-lead2'],
  ['EY', 'Remote-Cust', 'ELE', 'u-lead6'],
  ['EZ', 'Remote-Imp', 'ELE', 'u-lead6'],
  ['FA', 'Sleeve', 'PLA', 'u-lead7'],
  ['FB', 'Insulation Tube', 'PLA', 'u-lead7'],
  ['FC', 'Jacket', 'PLA', 'u-lead7'],
  ['FE', 'Rubber Part RM', 'PLA', 'u-lead6'],
  ['FF', 'Aluminium Parts RM', 'MET', 'u-lead3'],
  ['FG', 'Copper Part RM', 'MET', 'u-lead3'],
  ['FI', 'Plastic Part RM', 'PLA', 'u-lead3'],
  ['FJ', 'Sheet Metal Part RM', 'MET', 'u-lead3'],
  ['FK', 'Motor-Cust', 'ELE', 'u-lead2'],
  ['FL', 'Filter', 'PLA', 'u-lead3'],
  ['FM', 'Wire-Cust', 'ELE', 'u-lead6'],
  ['FO', 'Aluminium Strip-Imp', 'MET', 'u-lead1'],
  ['FP', 'Aluminium Brazing Filler-Imp', 'MET', 'u-lead1'],
  ['FQ', 'Aluminium Pipe-Imp', 'MET', 'u-lead1'],
  ['FR', 'Aluminium Foil-Imp', 'MET', 'u-lead1'],
  ['FS', 'Brass Part-Imp', 'MET', 'u-lead6'],
  ['FT', 'Brazing Rod-Imp', 'MET', 'u-lead1'],
  ['FU', 'Cross Flow Fan-Imp', 'PLA', 'u-lead3'],
  ['FV', 'Moulding RM', 'PLA', 'u-lead9'],
  ['FW', 'Louver/Stepping Motor-Imp', 'ELE', 'u-lead2'],
  ['FX', 'Motor-Imp', 'ELE', 'u-lead2'],
  ['FY', 'Plastic Part RM-Imp', 'PLA', 'u-lead9'],
  ['FZ', 'Service Valve-Imp', 'MET', 'u-lead6'],
  ['GA', 'Battery', 'ELE', 'u-lead8'],
  ['GB', 'Putty', 'CHE', 'u-lead8'],
  ['GD', 'Edge Angle', 'PKG', 'u-lead5'],
  ['GE', 'Corrugated Separator', 'PKG', 'u-lead5'],
  ['GF', 'P.P Band', 'PKG', 'u-lead8'],
  ['GG', 'Staple Pin', 'PKG', 'u-lead8'],
  ['GH', 'Wiring Diagram Sticker', 'PKG', 'u-lead5'],
  ['GI', 'Strip Sticker', 'PKG', 'u-lead5'],
  ['GJ', 'SOWM Label', 'PKG', 'u-lead5'],
  ['GK', 'Ribbon', 'PKG', 'u-lead5'],
  ['GL', 'Rating Label Sticker', 'PKG', 'u-lead5'],
  ['GM', 'Manual', 'PKG', 'u-lead5'],
  ['GN', 'Logo Sticker', 'PKG', 'u-lead5'],
  ['GO', 'Escutcheon Sticker', 'PKG', 'u-lead5'],
  ['GP', 'BEE Label Sticker', 'PKG', 'u-lead5'],
  ['GR', 'IDU Front Grill', 'PLA', 'u-lead3'],
  ['GS', 'ODU Fan Guard', 'PLA', 'u-lead3'],
  ['GT', 'IDU Drain Hose', 'PLA', 'u-lead3'],
  ['GU', 'WAC Front Grill', 'PLA', 'u-lead3'],
  ['GV', 'Master Batch-Cust', 'PLA', 'u-lead9'],
  ['GW', 'Plastic Granules-Cust', 'PLA', 'u-lead9'],
  ['GY', 'Aluminium Foil-Local', 'MET', 'u-lead1'],
  ['GZ', 'Internal EPS', 'PKG', 'u-lead3'],
  ['HA', 'Copper Tube Plain Domestic', 'MET', 'u-lead1'],
  ['HB', 'Copper Tube IGT Domestic', 'MET', 'u-lead1'],
  ['HC', 'Copper Tube Plain-Imp', 'MET', 'u-lead1'],
  ['HD', 'Copper Tube IGT-Imp', 'MET', 'u-lead1'],
  ['HE', 'Copper Capillary Tube', 'MET', 'u-lead1'],
  ['HF', 'Tool & Die Parts', 'CAP', 'u-lead10'],
  ['HL', 'Fixed Asset', 'CAP', 'u-lead6'],
  ['O2', 'O2', 'MRO', 'u-lead8'],
  ['N2', 'N2', 'MRO', 'u-lead8'],
  ['HEL', 'Helium', 'MRO', 'u-lead8'],
  ['CO2', 'CO2', 'MRO', 'u-lead8'],
  ['PNO', 'Punching Oil', 'MRO', 'u-lead8'],
  ['LPG', 'LPG', 'MRO', 'u-lead8'],
]
/** Each team lead's commodities are bought by one of the demo commodity buyers (the execution owners) */
const BUYER_OF_LEAD: Record<string, string> = {
  'u-lead1': 'u-buyer2', 'u-lead2': 'u-buyer3', 'u-lead3': 'u-buyer5', 'u-lead4': 'u-buyer1', 'u-lead5': 'u-buyer6', 'u-lead6': 'u-buyer4',
  'u-lead7': 'u-buyer1', 'u-lead8': 'u-buyer7', 'u-lead9': 'u-buyer5', 'u-lead10': 'u-buyer7', 'u-lead11': 'u-buyer4',
}
/** FY target and addressable spend (sample figures) for the commodities the demo ideas, parts and suppliers use; buyer where it differs */
const COMMODITY_SAMPLE: Record<string, { target: number; spend: number; buyerId?: string }> = {
  BV: { target: 25.5 * CR, spend: 2450 * CR }, AA: { target: 13 * CR, spend: 1120 * CR }, AJ: { target: 9.5 * CR, spend: 860 * CR },
  BN: { target: 3 * CR, spend: 145 * CR }, AO: { target: 24 * CR, spend: 2980 * CR }, DX: { target: 11 * CR, spend: 1340 * CR, buyerId: 'u-buyer4' },
  AP: { target: 7 * CR, spend: 780 * CR }, BL: { target: 4 * CR, spend: 410 * CR }, FI: { target: 5.5 * CR, spend: 520 * CR },
  BW: { target: 5 * CR, spend: 610 * CR }, BP: { target: 2.5 * CR, spend: 190 * CR }, AV: { target: 1.5 * CR, spend: 120 * CR, buyerId: 'u-buyer6' },
  BX: { target: 5 * CR, spend: 540 * CR }, CM: { target: 2 * CR, spend: 160 * CR }, CA: { target: 1.5 * CR, spend: 210 * CR },
}
export const COMMODITIES_DEFAULT: Commodity[] = COMMODITY_ROWS.map(([code, name, categoryId, leadId]) => {
  const s = COMMODITY_SAMPLE[code]
  return { code, name, categoryId, leadId, buyerId: s?.buyerId ?? BUYER_OF_LEAD[leadId], target: s?.target ?? 0, addressableSpend: s?.spend ?? 0 }
})
const leadCodes = (leadId: string) => COMMODITIES_DEFAULT.filter((c) => c.leadId === leadId).map((c) => c.code)
const buyerCodes = (buyerId: string) => COMMODITIES_DEFAULT.filter((c) => c.buyerId === buyerId).map((c) => c.code)

const COLORS = ['#b8142a', '#2f4a9a', '#0f9f6e', '#ec8a1c', '#7c3aed', '#0d9488', '#db2777', '#0284c7', '#4f46e5', '#ca8a04', '#059669', '#9333ea']
const pw = 'coin@2026'
let ci = 0
const u = (id: string, name: string, employeeId: string, roles: User['roles'], department: User['department'], designation: string, commodities: string[], plant = 'RJP', extra: Partial<User> = {}): User => ({
  id, name, employeeId, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@ambergroupindia.com`, password: pw, roles, department, plant, designation, commodities, avatarColor: COLORS[ci++ % COLORS.length], active: true, ...extra,
})

/** One sign-in per department, plus the Central ID. A department ID raises ideas, runs the workshop (stage 2) and owns the
 *  execution (stage 4); whoever is behind it types their name and employee ID on the form. Central signs stage 3; Finance verifies stage 5. */
const departmentId = (id: string, department: User['department'], email: string, employeeId: string, plant: string, roles: User['roles'] = [], commodities: string[] = []) =>
  u(id, `${department} department`, employeeId, ['submitter', 'teamlead', 'deptlead', 'execowner', ...roles], department, `${department} department ID`, commodities, plant, { email })
const SIGN_IN_IDS: User[] = [
  departmentId('id-rd', 'R&D', 'rnd@ambergroupindia.com', 'ID-RND', 'RJP'),
  departmentId('id-dqa', 'DQA', 'dqa@ambergroupindia.com', 'ID-DQA', 'RJP'),
  departmentId('id-quality', 'Quality', 'quality@ambergroupindia.com', 'ID-QUA', 'DDN'),
  departmentId('id-process', 'Process', 'process@ambergroupindia.com', 'ID-PRO', 'JHJ'),
  departmentId('id-production', 'Production', 'production@ambergroupindia.com', 'ID-PRD', 'RJP'),
  departmentId('id-finance', 'Finance', 'finance@ambergroupindia.com', 'ID-FIN', 'NDA', ['finance']),
  departmentId('id-sourcing', 'Sourcing', 'sourcing@ambergroupindia.com', 'ID-SRC', 'NDA', ['buyer', 'lead'], COMMODITIES_DEFAULT.map((c) => c.code)),
  departmentId('id-hr', 'HR', 'hr@ambergroupindia.com', 'ID-HR', 'NDA'),
  u('id-central', 'Central ID', 'ID-CEN', ['admin'], 'Central', 'Central ID — management approval and admin', [], 'NDA', { email: 'central@ambergroupindia.com' }),
]

/** People on record: their names stay on existing ideas and in the commodity masters, but they do not sign in. Suppliers reach COIN
 *  through the unique link in a campaign email. */
const ON_RECORD: User[] = [
  // R&D
  u('u-sub1', 'Neha Verma', 'AEL-20417', ['submitter'], 'R&D', 'Senior Engineer, R&D', [], 'RJP'),
  u('u-rd-tl', 'Arvind Rao', 'AEL-15203', ['teamlead', 'submitter'], 'R&D', 'Team Lead — Thermal Systems, R&D', [], 'RJP'),
  u('u-eval1', 'Dr. Priya Nair', 'AEL-09331', ['deptlead', 'submitter'], 'R&D', 'Chief Engineer, R&D', [], 'RJP'),
  u('u-rd-head', 'Dr. Sameer Kulkarni', 'AEL-04187', ['depthead', 'submitter'], 'R&D', 'Head of R&D', [], 'NDA'),
  u('u-rd-exec', 'Rahul Jain', 'AEL-18822', ['execowner', 'submitter'], 'R&D', 'Project Engineer — R&D implementation', [], 'RJP'),
  // DQA
  u('u-sub5', 'Tanvi Gupta', 'AEL-20744', ['submitter'], 'DQA', 'DQA Engineer', [], 'RJP'),
  u('u-dqa-tl', 'Pooja Nambiar', 'AEL-15318', ['teamlead', 'submitter'], 'DQA', 'Team Lead, DQA Lab', [], 'RJP'),
  u('u-eval2', 'Amit Saxena', 'AEL-09876', ['deptlead', 'submitter'], 'DQA', 'Manager, DQA', [], 'RJP'),
  u('u-dqa-head', 'Rajiv Bhalla', 'AEL-04290', ['depthead', 'submitter'], 'DQA', 'Head of DQA', [], 'NDA'),
  u('u-dqa-exec', 'Sandeep Rawat', 'AEL-18901', ['execowner', 'submitter'], 'DQA', 'DQA Engineer — validation owner', [], 'RJP'),
  // Quality
  u('u-sub3', 'Farah Khan', 'AEL-20631', ['submitter'], 'Quality', 'Quality Engineer', [], 'SRC'),
  u('u-qa-tl', 'Mohit Arora', 'AEL-15420', ['teamlead', 'submitter'], 'Quality', 'Team Lead, Supplier Quality', [], 'DDN'),
  u('u-eval3', 'Ritu Malhotra', 'AEL-10021', ['deptlead', 'submitter'], 'Quality', 'Manager, Quality', [], 'DDN'),
  u('u-qa-head', 'Anil Deshmukh', 'AEL-04355', ['depthead', 'submitter'], 'Quality', 'Head of Quality', [], 'NDA'),
  u('u-qa-exec', 'Kavya Reddy', 'AEL-18977', ['execowner', 'submitter'], 'Quality', 'Quality Engineer — implementation owner', [], 'SRC'),
  // Process
  u('u-sub4', 'Harish Menon', 'AEL-20702', ['submitter'], 'Process', 'Process Engineer', [], 'PUN'),
  u('u-pe-tl', 'Nitin Chawla', 'AEL-15511', ['teamlead', 'submitter'], 'Process', 'Team Lead, Process Engineering', [], 'JHJ'),
  u('u-eval4', 'Karan Bhatia', 'AEL-10288', ['deptlead', 'submitter'], 'Process', 'Manager, Process Engineering', [], 'JHJ'),
  u('u-pe-head', 'Manoj Pillai', 'AEL-04412', ['depthead', 'submitter'], 'Process', 'Head of Process Engineering', [], 'NDA'),
  u('u-pe-exec', 'Siddharth Bose', 'AEL-19033', ['execowner', 'submitter'], 'Process', 'Process Engineer — line changes', [], 'PUN'),
  // Production
  u('u-sub2', 'Vivek Chauhan', 'AEL-20588', ['submitter'], 'Production', 'Shift Engineer, Production', [], 'JHJ'),
  u('u-pr-tl', 'Gurmeet Singh', 'AEL-15602', ['teamlead', 'submitter'], 'Production', 'Shift Lead, Production', [], 'RJP'),
  u('u-pr-lead', 'Deepika Sharma', 'AEL-10377', ['deptlead', 'submitter'], 'Production', 'Manager, Production Planning', [], 'RJP'),
  u('u-eval5', 'Suresh Yadav', 'AEL-10412', ['depthead', 'submitter'], 'Production', 'Production Head, Rajpura', [], 'RJP'),
  u('u-pr-exec', 'Ravi Teja', 'AEL-19108', ['execowner', 'submitter'], 'Production', 'Production Engineer — implementation', [], 'SRC'),
  // Finance
  u('u-fi-emp', 'Ankita Jain', 'AEL-20815', ['submitter'], 'Finance', 'Executive, Costing', [], 'NDA'),
  u('u-fi-tl', 'Prakash Iyer', 'AEL-15688', ['teamlead', 'submitter'], 'Finance', 'Team Lead, Costing', [], 'NDA'),
  u('u-fi-lead', 'Shalini Gupta', 'AEL-10466', ['deptlead', 'submitter'], 'Finance', 'Manager, Finance', [], 'NDA'),
  u('u-fi-head', 'Vinod Agarwal', 'AEL-03377', ['depthead', 'submitter'], 'Finance', 'Head of Finance', [], 'NDA'),
  u('u-fi-exec', 'Rohit Kapoor', 'AEL-19177', ['execowner', 'submitter'], 'Finance', 'Finance Executive — implementation owner', [], 'NDA'),
  u('u-fin', 'Meera Iyer', 'AEL-05562', ['finance'], 'Finance', 'Finance Controller — savings verification', [], 'NDA'),
  // Sourcing — the 11 commodity team leads from the "npd data" sheet, kept with the commodity buyers as master data
  u('u-so-emp', 'Aditi Sharma', 'AEL-20877', ['submitter'], 'Sourcing', 'Executive, Sourcing', [], 'NDA'),
  u('u-lead1', 'Shubham Verma', 'AEL-07215', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Copper, Aluminium & Brazing', leadCodes('u-lead1'), 'RJP'),
  u('u-lead2', 'Ashutosh Sharma', 'AEL-07544', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Compressor, Motors, PCB & Gas', leadCodes('u-lead2'), 'NDA'),
  u('u-lead3', 'Rakesh Kumar', 'AEL-07698', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Plastic Parts, Fans, Grills & EPS', leadCodes('u-lead3'), 'DDN'),
  u('u-lead4', 'Rohit Gandhi', 'AEL-07702', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Steel', leadCodes('u-lead4'), 'RJP'),
  u('u-lead5', 'Pallav Roy', 'AEL-07719', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Packing, Labels & Stickers', leadCodes('u-lead5'), 'JHJ'),
  u('u-lead6', 'Abhishek Sharma', 'AEL-07733', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Remote, Wire, Brass, Rubber & Valves', leadCodes('u-lead6'), 'NDA'),
  u('u-lead7', 'Manish Kumar', 'AEL-07746', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Hardware, Bolts, Foam & Insulation', leadCodes('u-lead7'), 'RJP'),
  u('u-lead8', 'Karan Nanda', 'AEL-07758', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Indirect, Chemicals & Gases', leadCodes('u-lead8'), 'NDA'),
  u('u-lead9', 'Sandeep Agarwal', 'AEL-07761', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Plastic Granules & Master Batch', leadCodes('u-lead9'), 'DDN'),
  u('u-lead10', 'Raghuvendra', 'AEL-07774', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Tools & Dies', leadCodes('u-lead10'), 'RJP'),
  u('u-lead11', 'Satya Vijay', 'AEL-07789', ['lead', 'teamlead', 'submitter'], 'Sourcing', 'Team Lead — Controllers & Display PCBs', leadCodes('u-lead11'), 'NDA'),
  u('u-so-lead', 'Ashok Menon', 'AEL-06120', ['deptlead', 'submitter'], 'Sourcing', 'Senior Manager, Sourcing', [], 'NDA'),
  u('u-head', 'Girish Saluja', 'AEL-03108', ['head', 'depthead', 'submitter'], 'Sourcing', 'Head of Sourcing', [], 'NDA'),
  u('u-buyer1', 'Arjun Mehta', 'AEL-11873', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — Steel, Hardware & Bolts', buyerCodes('u-buyer1'), 'RJP'),
  u('u-buyer2', 'Kavita Rao', 'AEL-11902', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — Copper & Aluminium', buyerCodes('u-buyer2'), 'DDN'),
  u('u-buyer3', 'Rohan Desai', 'AEL-12011', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — Compressor & Motors', buyerCodes('u-buyer3'), 'SRC'),
  u('u-buyer4', 'Sneha Kulkarni', 'AEL-12167', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — PCB, Controllers & Wire', buyerCodes('u-buyer4'), 'NDA'),
  u('u-buyer5', 'Imran Sheikh', 'AEL-12230', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — Plastics', buyerCodes('u-buyer5'), 'DDN'),
  u('u-buyer6', 'Pooja Bansal', 'AEL-12388', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — Packing', buyerCodes('u-buyer6'), 'JHJ'),
  u('u-buyer7', 'Manish Tiwari', 'AEL-12415', ['buyer', 'execowner', 'submitter'], 'Sourcing', 'Commodity Buyer — Indirect & Tooling', buyerCodes('u-buyer7'), 'NDA'),
  // HR
  u('u-hr-emp', 'Simran Kaur', 'AEL-20932', ['submitter'], 'HR', 'Executive, HR', [], 'NDA'),
  u('u-hr-tl', 'Varun Malhotra', 'AEL-15744', ['teamlead', 'submitter'], 'HR', 'Team Lead, HR Operations', [], 'NDA'),
  u('u-hr-lead', 'Neelam Saxena', 'AEL-10533', ['deptlead', 'submitter'], 'HR', 'Manager, HR', [], 'NDA'),
  u('u-hr-head', 'Lata Krishnan', 'AEL-03455', ['depthead', 'submitter'], 'HR', 'Head of HR', [], 'NDA'),
  u('u-hr-exec', 'Imtiaz Ali', 'AEL-19260', ['execowner', 'submitter'], 'HR', 'HR Executive — admin and facilities', [], 'RJP'),
  // cross-functional
  u('u-mgmt', 'Rajesh Khanna', 'AEL-00112', ['mgmt'], 'Management', 'Chief Operating Officer', [], 'NDA'),
  u('u-admin', 'Nikhil Agarwal', 'AEL-12440', ['admin'], 'Sourcing Excellence', 'Manager, Sourcing Excellence', [], 'NDA'),
  // suppliers
  u('u-sup1', 'Rakesh Gupta', 'V10021', ['supplier'], 'Supplier', 'Key Account Manager, Sunrise Fasteners Pvt Ltd', ['BN'], 'RJP', { supplierCode: 'V10021', email: 'rakesh.gupta@sunrisefasteners.in' }),
  u('u-sup2', 'Lakshmi Narayan', 'V10007', ['supplier'], 'Supplier', 'Sales Head, Coolmax Compressors India', ['AO'], 'SRC', { supplierCode: 'V10007', email: 'lakshmi@coolmaxindia.com' }),
  u('u-sup3', 'Gurpreet Sandhu', 'V10005', ['supplier'], 'Supplier', 'Director, Shakti Steel Processors', ['AJ'], 'RJP', { supplierCode: 'V10005', email: 'gurpreet@shaktisteel.in' }),
  u('u-sup4', 'Ankit Jain', 'V10009', ['supplier'], 'Supplier', 'Business Head, Circuitek Electronics', ['DX'], 'NDA', { supplierCode: 'V10009', email: 'ankit.jain@circuitek.in' }),
]

export const USERS_DEFAULT: User[] = [...SIGN_IN_IDS, ...ON_RECORD.map((x) => ({ ...x, active: false }))]

export const SUPPLIERS_DEFAULT: Supplier[] = [
  { code: 'V10001', name: 'Kiran Copper Tubes Pvt Ltd', commodities: ['BV'], contactEmail: 'sales@kirancopper.in', contactName: 'Mahesh Kiran', city: 'Silvassa', spend: 1480 * CR },
  { code: 'V10002', name: 'Northstar Metal Mills', commodities: ['BV', 'AA'], contactEmail: 'kam@northstarmetal.in', contactName: 'Ravi Northey', city: 'Bhiwadi', spend: 965 * CR },
  { code: 'V10003', name: 'Alfa Foils & Fins Ltd', commodities: ['AA'], contactEmail: 'orders@alfafoils.in', contactName: 'Sunita Alva', city: 'Pune', spend: 640 * CR },
  { code: 'V10004', name: 'Greenline Aluminium', commodities: ['AA'], contactEmail: 'sales@greenlineal.in', contactName: 'Prakash Green', city: 'Hosur', spend: 310 * CR },
  { code: 'V10005', name: 'Shakti Steel Processors', commodities: ['AJ'], contactEmail: 'gurpreet@shaktisteel.in', contactName: 'Gurpreet Sandhu', city: 'Faridabad', spend: 520 * CR },
  { code: 'V10006', name: 'Tricity Coil Centre', commodities: ['AJ'], contactEmail: 'coil@tricitycoil.in', contactName: 'Harjeet Mann', city: 'Ludhiana', spend: 290 * CR },
  { code: 'V10007', name: 'Coolmax Compressors India', commodities: ['AO'], contactEmail: 'lakshmi@coolmaxindia.com', contactName: 'Lakshmi Narayan', city: 'Chennai', spend: 1820 * CR },
  { code: 'V10008', name: 'Rotary Cool Systems', commodities: ['AO'], contactEmail: 'sales@rotarycool.in', contactName: 'Venkat Rao', city: 'Sri City', spend: 1040 * CR },
  { code: 'V10009', name: 'Circuitek Electronics', commodities: ['DX'], contactEmail: 'ankit.jain@circuitek.in', contactName: 'Ankit Jain', city: 'Noida', spend: 760 * CR },
  { code: 'V10010', name: 'Nova PCB Solutions', commodities: ['DX'], contactEmail: 'bd@novapcb.in', contactName: 'Shweta Nair', city: 'Bengaluru', spend: 480 * CR },
  { code: 'V10011', name: 'Dynamo Motors Pvt Ltd', commodities: ['AP'], contactEmail: 'sales@dynamomotors.in', contactName: 'K. Selvam', city: 'Coimbatore', spend: 430 * CR },
  { code: 'V10012', name: 'Vega BLDC Drives', commodities: ['AP'], contactEmail: 'info@vegabldc.in', contactName: 'Aditya Vega', city: 'Pune', spend: 290 * CR },
  { code: 'V10013', name: 'Linkwire Harness Systems', commodities: ['BL'], contactEmail: 'kam@linkwire.in', contactName: 'Rahul Link', city: 'Gurugram', spend: 240 * CR },
  { code: 'V10014', name: 'Omkar Cables', commodities: ['BL'], contactEmail: 'sales@omkarcables.in', contactName: 'Omkar Patil', city: 'Manesar', spend: 150 * CR },
  { code: 'V10015', name: 'Polymould Industries', commodities: ['FI'], contactEmail: 'sales@polymould.in', contactName: 'Nitin Arora', city: 'Dehradun', spend: 310 * CR },
  { code: 'V10016', name: 'Apex Plastomers', commodities: ['FI'], contactEmail: 'apex@plastomers.in', contactName: 'Simran Kaur', city: 'Baddi', spend: 180 * CR },
  { code: 'V10017', name: 'Resinova Polymers', commodities: ['BW'], contactEmail: 'trade@resinova.in', contactName: 'Hemant Shah', city: 'Vadodara', spend: 560 * CR },
  { code: 'V10018', name: 'Boxcraft Packaging', commodities: ['BP'], contactEmail: 'orders@boxcraft.in', contactName: 'Jaspreet Gill', city: 'Rajpura', spend: 140 * CR },
  { code: 'V10019', name: 'Thermopack EPS', commodities: ['AV'], contactEmail: 'sales@thermopack.in', contactName: 'Rajiv Thomas', city: 'Jhajjar', spend: 95 * CR },
  { code: 'V10020', name: 'Swiftline Logistics', commodities: ['BX'], contactEmail: 'ops@swiftline.in', contactName: 'Arvind Swift', city: 'Delhi NCR', spend: 310 * CR },
  { code: 'V10021', name: 'Sunrise Fasteners Pvt Ltd', commodities: ['BN'], contactEmail: 'rakesh.gupta@sunrisefasteners.in', contactName: 'Rakesh Gupta', city: 'Ludhiana', spend: 86 * CR },
  { code: 'V10022', name: 'Precision Bolt Works', commodities: ['BN'], contactEmail: 'sales@precisionbolt.in', contactName: 'Jignesh Patel', city: 'Rajkot', spend: 44 * CR },
  { code: 'V10023', name: 'RoadRunner Freight Carriers', commodities: ['BX'], contactEmail: 'bookings@roadrunner.in', contactName: 'Sukhwinder Brar', city: 'Ludhiana', spend: 180 * CR },
  { code: 'V10024', name: 'Toolkart Industrial Supplies', commodities: ['CM'], contactEmail: 'b2b@toolkart.in', contactName: 'Neeraj Kart', city: 'Noida', spend: 120 * CR },
  { code: 'V10025', name: 'Facilitas Services', commodities: ['CA'], contactEmail: 'contracts@facilitas.in', contactName: 'Maria D\'Souza', city: 'Gurugram', spend: 150 * CR },
].map((x) => ({ ...x, tier: x.spend >= 500 * CR && x.code !== 'V10005' ? 'Tier 1' : 'Tier 2' }) as Supplier)

type PartRow = [string, string, string, string, number | null, number, number]
// code, description, uom, supplier, LBP (null = no LBP → PO price), PO price, last FY MRN qty
const PART_ROWS: Record<string, PartRow[]> = {
  BN: [
    ['3100045612', 'Hex flange bolt M6×16, Zn-Ni', 'Nos', 'V10021', 4.2, 4.25, 2400000],
    ['3100045688', 'Self-tapping screw 4.2×13, pan head', 'Nos', 'V10021', 0.62, 0.63, 18500000],
    ['3100045701', 'Condenser bracket rivet Ø4.8', 'Nos', 'V10022', 1.1, 1.12, 6200000],
    ['3100045733', 'Nylock nut M8, Zn plated', 'Nos', 'V10022', 2.35, 2.4, 3100000],
  ],
  BV: [
    ['3200011204', 'Copper tube Ø9.52 × 0.35 IGT', 'Kg', 'V10001', 862, 868, 1850000],
    ['3200011215', 'Copper tube Ø7.00 × 0.28 IGT', 'Kg', 'V10001', 874, 880, 2100000],
    ['3200011240', 'Copper tube Ø12.7 plain, LWC', 'Kg', 'V10002', 845, 850, 640000],
    ['3200011277', 'Hairpin bend Ø7 mm, pre-formed', 'Nos', 'V10002', 14.8, 15.0, 9500000],
  ],
  AA: [
    ['3300021005', 'Hydrophilic fin stock 0.095 mm', 'Kg', 'V10003', 318, 321, 3800000],
    ['3300021019', 'Aluminium fin stock 0.105 mm, blue', 'Kg', 'V10004', 322, 325, 1200000],
    ['3300021044', 'Al header pipe Ø16 mm', 'Nos', 'V10003', 46, 46.5, 900000],
  ],
  AJ: [
    ['3400031110', 'CRCA sheet 0.8 mm, IS 513', 'Kg', 'V10005', 72.5, 73.2, 9200000],
    ['3400031126', 'GI sheet 1.0 mm, Z120', 'Kg', 'V10006', 78.4, 79.0, 6800000],
    ['3400031151', 'Pre-painted GI 0.6 mm, white', 'Kg', 'V10005', 96.2, 97.0, 2400000],
    ['3400031187', 'Condenser side bracket, 1.2 mm', 'Nos', 'V10006', 38.5, 39.0, 1450000],
  ],
  AO: [
    ['3500040012', 'Rotary compressor 1.5 TR R32 inverter', 'Nos', 'V10007', 7850, 7900, 820000],
    ['3500040027', 'Rotary compressor 1.0 TR R32 fixed', 'Nos', 'V10008', 6420, 6480, 540000],
    ['3500040039', 'Rotary compressor 2.0 TR R410A', 'Nos', 'V10007', 9960, 10020, 210000],
  ],
  DX: [
    ['3600050101', 'Outdoor inverter PCBA 1.5 TR', 'Nos', 'V10009', 2380, 2400, 760000],
    ['3600050118', 'Indoor display PCB assembly', 'Nos', 'V10010', 186, 188, 1500000],
    ['3600050125', 'Remote control PCB', 'Nos', 'V10009', null, 58, 2100000],
  ],
  AP: [
    ['3700060210', 'BLDC indoor fan motor 40 W', 'Nos', 'V10012', 1120, 1130, 980000],
    ['3700060224', 'PSC outdoor fan motor 60 W', 'Nos', 'V10011', 890, 896, 640000],
    ['3700060233', 'Swing stepper motor 12 V', 'Nos', 'V10011', 62, 62.5, 1650000],
  ],
  BL: [
    ['3800070301', 'Indoor unit wiring harness', 'Nos', 'V10013', 118, 119, 1600000],
    ['3800070318', 'Power cord 3-core 1.5 sq mm', 'Nos', 'V10014', 142, 143, 1450000],
    ['3800070329', 'Interconnect cable 4-core, 5 m', 'Nos', 'V10013', 386, 390, 700000],
  ],
  FI: [
    ['3900080405', 'IDU front panel, ABS', 'Nos', 'V10015', 312, 315, 1100000],
    ['3900080417', 'ODU base pan, PP', 'Nos', 'V10016', 184, 186, 950000],
    ['3900080428', 'Horizontal louver set', 'Nos', 'V10015', 42, 42.4, 1300000],
  ],
  BW: [
    ['4000090501', 'ABS resin HI-121', 'Kg', 'V10017', 168, 170, 5200000],
    ['4000090512', 'PP copolymer, talc-filled', 'Kg', 'V10017', 112, 113, 4300000],
  ],
  BP: [
    ['4100100601', '5-ply corrugated box, IDU', 'Nos', 'V10018', 96, 97, 1250000],
    ['4100100614', '7-ply corrugated box, ODU', 'Nos', 'V10018', 168, 170, 1100000],
  ],
  AV: [
    ['4200110701', 'EPS top / bottom set, IDU', 'Set', 'V10019', 74, 75, 1250000],
    ['4200110716', 'EPS corner set, ODU', 'Set', 'V10019', null, 118, 1100000],
  ],
  BX: [
    ['9100000801', 'FTL freight Rajpura → Mumbai, 32 ft MXL', 'Trip', 'V10020', 68000, 68000, 1450],
    ['9100000815', 'FTL freight Sri City → Delhi, 32 ft MXL', 'Trip', 'V10023', 112000, 112000, 820],
  ],
  CM: [
    ['9200000901', 'Brazing rod 15% Ag', 'Kg', 'V10024', 7800, 7850, 18500],
    ['9200000914', 'Nitrogen gas cylinder, 7 m³', 'Nos', 'V10024', 480, 485, 42000],
  ],
  CA: [
    ['9300001001', 'Plant housekeeping services, Rajpura', 'Month', 'V10025', 1850000, 1850000, 84],
    ['9300001012', 'Compressed air generation (energy)', 'kWh', 'V10025', 8.4, 8.4, 6400000],
  ],
}

export const PARTS_DEFAULT: Part[] = Object.entries(PART_ROWS).flatMap(([commodity, rows], i) =>
  rows.map(([code, description, uom, supplierCode, lbp, poPrice, qty], j) => ({
    code, description, uom, commodity, supplierCode, lbp, poPrice, lastFyMrnQty: qty,
    plant: PLANTS_DEFAULT[(i + j) % 4].id,
  })),
)

export const APPROVAL_RULES_DEFAULT: ApprovalRule[] = [
  { id: 'AR1', condition: 'Opportunity cost up to ₹ X lakh', approver: 'Commodity Lead', thresholdLakh: 50, kind: 'value' },
  { id: 'AR2', condition: 'Opportunity cost above ₹ X lakh', approver: 'Commodity Lead → Sourcing Head', thresholdLakh: 50, kind: 'value' },
  { id: 'AR3', condition: 'Any idea with one-time investment above ₹ Y lakh', approver: '+ Sourcing Head', thresholdLakh: 25, kind: 'investment' },
]

// SLA per workflow stage (Section 12 values, mapped onto the five-stage flow)
export const SLA_RULES_DEFAULT: SlaRule[] = [
  { stage: STAGE.feasibility, slaDays: 15, reminderDay: 12, escalateTo: 'Central ID', escalateDay: 16 },
  { stage: STAGE.approval, slaDays: 3, reminderDay: 2, escalateTo: 'Central ID', escalateDay: 4 },
  ...SLA_DEFAULTS.filter((r) => r.stage === 'Finance validation').map((r) => ({ ...r })),
]
export const DROP_REASONS = DROP_REASONS_DEFAULT

export const EMAIL_TEMPLATES_DEFAULT: EmailTemplate[] = [
  { id: 'T01', name: 'Idea submitted', subject: 'COIN · New idea {{ideaId}} in {{commodity}}', body: 'Dear {{recipient}},\n\nA new cost-reduction idea "{{title}}" has been submitted in {{commodity}} with an estimated opportunity cost of {{impact}}.\n\nPlease complete the team feasibility check within 5 working days.\n\n— COIN · Cost Innovation Hub' },
  { id: 'T02', name: 'Feasibility request', subject: 'COIN · Feasibility requested for {{ideaId}}', body: 'Dear {{recipient}},\n\nAmber Sourcing requests your feasibility and offered price for idea "{{title}}". Use the secure link below (valid 7 days).\n\n{{secureLink}}\n\n— COIN · Cost Innovation Hub' },
  { id: 'T03', name: 'Pending approval', subject: 'COIN · Approval pending: {{ideaId}}', body: 'Dear {{recipient}},\n\nIdea "{{title}}" ({{impact}}) is awaiting your approval. SLA: 3 working days.\n\n— COIN' },
  { id: 'T04', name: 'Workshop invitation', subject: 'COIN · Invitation: {{campaign}}', body: 'Dear {{recipient}},\n\nYou are invited to the supplier improvement workshop "{{campaign}}" on {{date}} at {{venue}}. Please bring cost-reduction ideas for {{commodity}}.\n\n— Amber Sourcing' },
  { id: 'T05', name: 'Implementation reminder', subject: 'COIN · Reminder: {{ideaId}} due {{targetDate}}', body: 'Dear {{recipient}},\n\nIdea "{{title}}" is due for implementation on {{targetDate}}. Please update progress in the Execution Hub.\n\n— COIN' },
  { id: 'T06', name: 'Monthly Cost Optimisation Report', subject: 'COIN — Cost Optimisation Report, {{month}}', body: 'PFA, Cost Optimisation Report\n\nRealised to date: {{realised}}\nMonth\'s realised saving: {{monthRealised}}\n\nOpen live dashboard: {{link}}' },
]

export function leverById(levers: Lever[], id: string) {
  return levers.find((l) => l.id === id)
}
export function stagesFor(route: RouteKey) {
  return ROUTE_STAGES[route] ?? ROUTE_STAGES.Commercial
}

// ─── Supplier outreach by email — seed templates, sent batches and Supplier Portal responses ───
import type { OutreachBatch, SupplierEmailTemplate, SupplierResponse } from './types'

/** Placeholders a supplier-facing template can use */
export const SUPPLIER_TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'supplierName', label: 'Supplier name' },
  { key: 'contactName', label: 'Contact person' },
  { key: 'commodity', label: 'Commodity' },
  { key: 'workshopDate', label: 'Workshop date' },
  { key: 'replyBy', label: 'Reply-by date' },
  { key: 'portalLink', label: 'Supplier Portal link' },
  { key: 'senderName', label: 'Sender name' },
]

export const SUPPLIER_EMAIL_TEMPLATES_DEFAULT: SupplierEmailTemplate[] = [
  {
    id: 'ST01', name: 'Improvement workshop invitation', purpose: "Invite a commodity's suppliers to a cost-improvement workshop",
    subject: 'Amber · Supplier improvement workshop — {{commodity}} on {{workshopDate}}',
    body: 'Dear {{contactName}},\n\nAmber Enterprises invites {{supplierName}} to our supplier improvement workshop for {{commodity}} on {{workshopDate}}.\n\nWe will share our cost-reduction priorities for the commodity and would like to hear your ideas — design, material, process, packing or logistics changes that lower total cost.\n\nPlease confirm attendance and pre-register your ideas on the Amber Supplier Portal:\n{{portalLink}}\n\nRegards,\n{{senderName}}\nAmber Sourcing',
  },
  {
    id: 'ST02', name: 'Submit your ideas — commodity drive', purpose: 'Ask suppliers to submit open or part-specific ideas for a commodity',
    subject: 'Amber · Submit your cost-reduction ideas for {{commodity}} by {{replyBy}}',
    body: 'Dear {{contactName}},\n\nAmber Sourcing is running a commodity-wise idea drive for {{commodity}}. We invite {{supplierName}} to submit your ideas through the Amber Supplier Portal:\n\n• Open idea — any improvement not tied to a specific part\n• Specific parts — a proposal against one or more Amber part numbers\n\nSubmit here by {{replyBy}}: {{portalLink}}\n\nApproved ideas move to NPD for sample development and validation. Gain-share terms apply as per your supply agreement.\n\nRegards,\n{{senderName}}\nAmber Sourcing',
  },
  {
    id: 'ST03', name: 'Reminder', purpose: 'Gentle reminder to suppliers who have not yet responded',
    subject: 'Reminder · Your ideas for {{commodity}} are due {{replyBy}}',
    body: 'Dear {{contactName}},\n\nThis is a reminder that ideas for the {{commodity}} drive are due by {{replyBy}}. We have not yet received a submission from {{supplierName}}.\n\nIt only takes a few minutes on the Amber Supplier Portal: {{portalLink}}\n\nRegards,\n{{senderName}}\nAmber Sourcing',
  },
]

export const OUTREACH_BATCHES_DEFAULT: OutreachBatch[] = [
  { id: 'OB-003', templateId: 'ST02', templateName: 'Submit your ideas — commodity drive', commodities: ['FI', 'BW', 'BP'], recipients: ['V10015', 'V10016', 'V10017', 'V10018'], recipientCount: 4, replyBy: '2026-10-15', sentAt: '2026-09-24T04:45:00.000Z', sentBy: 'u-buyer5', sentByName: 'Imran Sheikh' },
  { id: 'OB-002', templateId: 'ST02', templateName: 'Submit your ideas — commodity drive', commodities: ['BV', 'AA'], recipients: ['V10001', 'V10002', 'V10003', 'V10004'], recipientCount: 4, replyBy: '2026-10-10', sentAt: '2026-09-18T06:00:00.000Z', sentBy: 'u-buyer2', sentByName: 'Kavita Rao' },
  { id: 'OB-001', templateId: 'ST01', templateName: 'Improvement workshop invitation', commodities: ['BN'], recipients: ['V10021', 'V10022'], recipientCount: 2, workshopDate: '2026-09-26', sentAt: '2026-09-12T05:30:00.000Z', sentBy: 'u-buyer1', sentByName: 'Arjun Mehta' },
]

export const SUPPLIER_RESPONSES_DEFAULT: SupplierResponse[] = [
  { id: 'SR-1009', source: 'Supplier Portal', portalRef: 'SP-26-0423', supplierCode: 'V10004', commodity: 'AA', type: 'Idea', scope: 'Specific parts', partCodes: ['3300021019'], subject: 'Switch blue fin coating to hydrophilic grade 0.100 mm', body: 'Our hydrophilic 0.100 mm grade matches the heat-transfer performance of the current blue 0.105 mm stock at a lower gauge. Sample coils are available for trial.', estSavingLakh: 58, receivedAt: '2026-10-01T04:30:00.000Z', status: 'New', batchId: 'OB-002' },
  { id: 'SR-1006', source: 'Supplier Portal', portalRef: 'SP-26-0420', supplierCode: 'V10015', commodity: 'FI', type: 'Idea', scope: 'Specific parts', partCodes: ['3900080405'], subject: 'Hot-runner conversion for IDU front panel tool', body: 'Converting the 2-cavity cold-runner tool to hot-runner removes ~38 g runner per shot and cuts cycle time by 6 s. One-time tooling investment of ₹ 9.5 lakh, payback under 5 months.', estSavingLakh: 27, receivedAt: '2026-09-30T07:55:00.000Z', status: 'New', batchId: 'OB-003' },
  { id: 'SR-1001', source: 'Supplier Portal', portalRef: 'SP-26-0412', supplierCode: 'V10001', commodity: 'BV', type: 'Idea', scope: 'Specific parts', partCodes: ['3200011215'], subject: 'Reduce wall thickness of Ø7.00 IGT tube from 0.28 to 0.25 mm', body: 'We have qualified a 0.25 mm inner-grooved tube on our new drawing line with the same burst-pressure margin. Weight saving is about 9% per metre. We can provide samples within 3 weeks for your R&D validation.', estSavingLakh: 118, receivedAt: '2026-09-29T08:12:00.000Z', status: 'New', batchId: 'OB-002' },
  { id: 'SR-1004', source: 'Supplier Portal', portalRef: 'SP-26-0417', supplierCode: 'V10002', commodity: 'BV', type: 'Problem', scope: 'Specific parts', partCodes: ['3200011240'], subject: 'Frequent drawing revisions on Ø12.7 LWC tube', body: 'We received three drawing revisions in the last quarter for the same part without an ECN reference, causing rework of ~2 MT. Requesting a single frozen revision and ECN communication.', receivedAt: '2026-09-28T06:20:00.000Z', status: 'New', batchId: 'OB-002' },
  { id: 'SR-1002', source: 'Supplier Portal', portalRef: 'SP-26-0415', supplierCode: 'V10003', commodity: 'AA', type: 'Idea', scope: 'Open idea', subject: 'Coil-width rationalisation across fin stock SKUs', body: 'Amber currently buys fin stock in 7 slit widths. Consolidating to 4 widths reduces our slitting scrap and changeover time; we can pass on ₹ 4/kg.', estSavingLakh: 42, receivedAt: '2026-09-27T11:40:00.000Z', status: 'Under review', batchId: 'OB-002' },
  { id: 'SR-1003', source: 'Supplier Portal', portalRef: 'SP-26-0409', supplierCode: 'V10021', commodity: 'BN', type: 'Idea', scope: 'Specific parts', partCodes: ['3100045612'], subject: 'Replace Zn-Ni plating with Zn-flake coating on M6 flange bolt', body: 'Zn-flake meets the 720 h salt-spray requirement at lower cost and removes hydrogen-embrittlement risk. Proposed at ₹ 3.95 vs current ₹ 4.20.', estSavingLakh: 6, receivedAt: '2026-09-26T13:05:00.000Z', status: 'Converted to idea', batchId: 'OB-001' },
  { id: 'SR-1005', source: 'Supplier Portal', portalRef: 'SP-26-0402', supplierCode: 'V10018', commodity: 'BP', type: 'Complaint', scope: 'Open idea', subject: 'Payment delays beyond agreed 60-day terms', body: 'Invoices for July and August are outstanding beyond 75 days. This affects our kraft paper procurement and our ability to hold prices.', receivedAt: '2026-09-25T09:30:00.000Z', status: 'Under review', batchId: 'OB-003' },
  { id: 'SR-1007', source: 'Supplier Portal', portalRef: 'SP-26-0398', supplierCode: 'V10017', commodity: 'BW', type: 'Idea', scope: 'Open idea', subject: 'Bulk silo delivery instead of 25 kg bags for PP copolymer', body: 'For the Dehradun and Rajpura plants, moving to bulk tanker delivery with a silo saves bag cost and handling loss. We can support silo installation on a shared-cost basis.', estSavingLakh: 33, receivedAt: '2026-09-24T10:10:00.000Z', status: 'New', batchId: 'OB-003' },
  { id: 'SR-1008', source: 'Supplier Portal', portalRef: 'SP-26-0391', supplierCode: 'V10022', commodity: 'BN', type: 'Problem', scope: 'Specific parts', partCodes: ['3100045733'], subject: 'Forecast variance on M8 Nylock nut schedules', body: 'Monthly schedules vary by more than ±40% versus the forecast shared, leading to excess inventory at our end. Requesting a 3-month rolling firm schedule.', receivedAt: '2026-09-22T05:45:00.000Z', status: 'Closed', batchId: 'OB-001' },
]

// ─── Campaign workspace — email campaign types (wizard step 1) ───
import type { OutreachKind } from './types'
export const OUTREACH_KINDS: { key: OutreachKind; icon: string; desc: string; templateId: string }[] = [
  { key: 'Supplier idea drive', icon: 'Lightbulb', desc: 'Ask a commodity’s suppliers to submit open or part-specific ideas', templateId: 'ST02' },
  { key: 'Improvement workshop', icon: 'Presentation', desc: 'Invite suppliers to a cost-improvement workshop with Amber', templateId: 'ST01' },
  { key: 'Reminder', icon: 'BellRing', desc: 'Nudge suppliers who have not replied yet', templateId: 'ST03' },
]
