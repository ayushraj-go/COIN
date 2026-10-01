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
  Commercial: { color: '#7c3aed', soft: '#f5f3ff', text: '#6d28d9', icon: 'Handshake' },
  'Supply base': { color: '#0d9488', soft: '#f0fdfa', text: '#0f766e', icon: 'Factory' },
  Engineering: { color: '#4f46e5', soft: '#eef2ff', text: '#4338ca', icon: 'Cog' },
  'Logistics & packing': { color: '#0284c7', soft: '#f0f9ff', text: '#0369a1', icon: 'Truck' },
  Operational: { color: '#db2777', soft: '#fdf2f8', text: '#be185d', icon: 'Settings2' },
}

// Section 6: the four routes (stage sequence after submission)
export const ROUTE_STAGES: Record<RouteKey, string[]> = {
  Commercial: ['Buyer validation', 'Supplier confirmation', 'Approval', 'Price revision in PAP', 'Implemented'],
  'Supplier change': ['Buyer validation', 'New supplier feasibility', 'DQA qualification', 'Approval', 'NPD sample', 'Price / source change in PAP', 'Implemented'],
  Technical: ['Buyer validation', 'Supplier feasibility', 'R&D evaluation (+DQA/Quality)', 'Approval', 'NPD ECN up to sample approval', 'Price revision in PAP', 'Implemented'],
  Internal: ['Buyer validation', 'Owning department evaluation', 'Approval', 'Execution', 'Implemented'],
  'To be confirmed': ['Buyer validation', 'Supplier confirmation', 'Approval', 'Price revision in PAP', 'Implemented'],
}

// Short labels for the route strip on the submission form
export const STAGE_SHORT: Record<string, string> = {
  'Buyer validation': 'Buyer',
  'Supplier confirmation': 'Supplier',
  'New supplier feasibility': 'New supplier',
  'Supplier feasibility': 'Supplier',
  'DQA qualification': 'DQA',
  'R&D evaluation (+DQA/Quality)': 'R&D',
  'Owning department evaluation': 'Dept eval',
  Approval: 'Approval',
  'NPD sample': 'NPD sample',
  'NPD ECN up to sample approval': 'NPD sample',
  'Price revision in PAP': 'PAP',
  'Price / source change in PAP': 'PAP',
  Execution: 'Execution',
  Implemented: 'Implemented',
}

// Stages that map to each SLA rule (Section 12)
export const STAGE_SLA_KEY: Record<string, string> = {
  'Buyer validation': 'Buyer validation',
  'Supplier confirmation': 'Supplier feasibility',
  'Supplier feasibility': 'Supplier feasibility',
  'New supplier feasibility': 'Supplier feasibility',
  'R&D evaluation (+DQA/Quality)': 'Technical evaluation',
  'DQA qualification': 'Technical evaluation',
  'Owning department evaluation': 'Technical evaluation',
  Approval: 'Approval',
}

export const FEASIBILITY_STAGES = ['Supplier confirmation', 'Supplier feasibility', 'New supplier feasibility']
export const EVALUATION_STAGES = ['R&D evaluation (+DQA/Quality)', 'DQA qualification', 'Owning department evaluation']

export const MILESTONE_TEMPLATES: Record<RouteKey, string[]> = {
  Technical: ['Supplier sample', 'NPD ECN raised', 'Sample approved', 'PAP price approved', 'First MRN at new price'],
  'Supplier change': ['DQA qualification closed', 'NPD sample', 'Sample approved', 'Source change approved in PAP', 'First MRN at new price'],
  Commercial: ['PAP revision request raised', 'PAP price approved', 'First MRN at new price'],
  Internal: ['Execution plan signed off', 'Trial run', 'Implemented on line', 'First month saving verified'],
  'To be confirmed': ['PAP revision request raised', 'PAP price approved', 'First MRN at new price'],
}

export const DEPARTMENTS = ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Sourcing']
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
]

export const COMMODITIES_DEFAULT: Commodity[] = [
  { code: 'CUT', name: 'Copper tube (Cu)', categoryId: 'MET', target: 25.5 * CR, buyerId: 'u-buyer2', leadId: 'u-lead1', addressableSpend: 2450 * CR },
  { code: 'ALU', name: 'Aluminium fin stock (Al)', categoryId: 'MET', target: 13 * CR, buyerId: 'u-buyer2', leadId: 'u-lead1', addressableSpend: 1120 * CR },
  { code: 'STL', name: 'Steel sheet (CRCA / GI)', categoryId: 'MET', target: 9.5 * CR, buyerId: 'u-buyer1', leadId: 'u-lead1', addressableSpend: 860 * CR },
  { code: 'FAS', name: 'Fasteners', categoryId: 'MET', target: 3 * CR, buyerId: 'u-buyer1', leadId: 'u-lead1', addressableSpend: 145 * CR },
  { code: 'CMP', name: 'Compressor', categoryId: 'ELE', target: 24 * CR, buyerId: 'u-buyer3', leadId: 'u-lead2', addressableSpend: 2980 * CR },
  { code: 'PCB', name: 'PCB / PCBA', categoryId: 'ELE', target: 11 * CR, buyerId: 'u-buyer4', leadId: 'u-lead2', addressableSpend: 1340 * CR },
  { code: 'MOT', name: 'Motors (BLDC / PSC)', categoryId: 'ELE', target: 7 * CR, buyerId: 'u-buyer3', leadId: 'u-lead2', addressableSpend: 780 * CR },
  { code: 'HAR', name: 'Wiring harness & cables', categoryId: 'ELE', target: 4 * CR, buyerId: 'u-buyer4', leadId: 'u-lead2', addressableSpend: 410 * CR },
  { code: 'PLM', name: 'Plastic moulded parts', categoryId: 'PLA', target: 5.5 * CR, buyerId: 'u-buyer5', leadId: 'u-lead3', addressableSpend: 520 * CR },
  { code: 'RES', name: 'Engineering resins (ABS / PP)', categoryId: 'PLA', target: 5 * CR, buyerId: 'u-buyer5', leadId: 'u-lead3', addressableSpend: 610 * CR },
  { code: 'COR', name: 'Corrugated boxes', categoryId: 'PKG', target: 2.5 * CR, buyerId: 'u-buyer6', leadId: 'u-lead3', addressableSpend: 190 * CR },
  { code: 'EPS', name: 'EPS / thermocol', categoryId: 'PKG', target: 1.5 * CR, buyerId: 'u-buyer6', leadId: 'u-lead3', addressableSpend: 120 * CR },
  { code: 'FRT', name: 'Freight & logistics', categoryId: 'LOG', target: 5 * CR, buyerId: 'u-buyer7', leadId: 'u-lead3', addressableSpend: 540 * CR },
  { code: 'MRO', name: 'MRO & consumables', categoryId: 'MRO', target: 2 * CR, buyerId: 'u-buyer7', leadId: 'u-lead3', addressableSpend: 160 * CR },
  { code: 'FAC', name: 'Facility & utilities', categoryId: 'SRV', target: 1.5 * CR, buyerId: 'u-buyer7', leadId: 'u-lead3', addressableSpend: 210 * CR },
]

const COLORS = ['#bf8f3f', '#4470d6', '#0f9f6e', '#ec8a1c', '#7c3aed', '#0d9488', '#db2777', '#0284c7', '#4f46e5', '#ca8a04', '#059669', '#9333ea']
const pw = 'coin@2026'
let ci = 0
const u = (id: string, name: string, employeeId: string, roles: User['roles'], department: User['department'], designation: string, commodities: string[], plant = 'RJP', extra: Partial<User> = {}): User => ({
  id, name, employeeId, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@ambergroupindia.com`, password: pw, roles, department, plant, designation, commodities, avatarColor: COLORS[ci++ % COLORS.length], active: true, ...extra,
})

export const USERS_DEFAULT: User[] = [
  u('u-sub1', 'Neha Verma', 'AEL-20417', ['submitter'], 'R&D', 'Senior Engineer, R&D', [], 'RJP'),
  u('u-sup1', 'Rakesh Gupta', 'V10021', ['supplier'], 'Supplier', 'Key Account Manager, Sunrise Fasteners Pvt Ltd', ['FAS'], 'RJP', { supplierCode: 'V10021', email: 'rakesh.gupta@sunrisefasteners.in' }),
  u('u-buyer1', 'Arjun Mehta', 'AEL-11873', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — Fasteners & Steel', ['FAS', 'STL'], 'RJP'),
  u('u-eval1', 'Dr. Priya Nair', 'AEL-09331', ['techeval', 'submitter'], 'R&D', 'Chief Engineer, R&D', [], 'RJP'),
  u('u-lead1', 'Sanjay Kapoor', 'AEL-07215', ['lead', 'submitter'], 'Sourcing', 'Commodity Lead — Metals', ['CUT', 'ALU', 'STL', 'FAS'], 'RJP'),
  u('u-head', 'Vikram Singh', 'AEL-03108', ['head', 'submitter'], 'Sourcing', 'Head of Sourcing', [], 'NDA'),
  u('u-fin', 'Meera Iyer', 'AEL-05562', ['finance'], 'Finance', 'Finance Controller — Costing', [], 'NDA'),
  u('u-mgmt', 'Rajesh Khanna', 'AEL-00112', ['mgmt'], 'Management', 'Chief Operating Officer', [], 'NDA'),
  u('u-admin', 'Nikhil Agarwal', 'AEL-12440', ['admin'], 'Sourcing Excellence', 'Manager, Sourcing Excellence', [], 'NDA'),
  // additional buyers & leads
  u('u-buyer2', 'Kavita Rao', 'AEL-11902', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — Copper & Aluminium', ['CUT', 'ALU'], 'DDN'),
  u('u-buyer3', 'Rohan Desai', 'AEL-12011', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — Compressor & Motors', ['CMP', 'MOT'], 'SRC'),
  u('u-buyer4', 'Sneha Kulkarni', 'AEL-12167', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — PCB & Harness', ['PCB', 'HAR'], 'NDA'),
  u('u-buyer5', 'Imran Sheikh', 'AEL-12230', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — Plastics', ['PLM', 'RES'], 'DDN'),
  u('u-buyer6', 'Pooja Bansal', 'AEL-12388', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — Packing', ['COR', 'EPS'], 'JHJ'),
  u('u-buyer7', 'Manish Tiwari', 'AEL-12415', ['buyer', 'submitter'], 'Sourcing', 'Commodity Buyer — Indirect', ['FRT', 'MRO', 'FAC'], 'NDA'),
  u('u-lead2', 'Anita Sharma', 'AEL-07544', ['lead', 'submitter'], 'Sourcing', 'Commodity Lead — Electricals', ['CMP', 'PCB', 'MOT', 'HAR'], 'NDA'),
  u('u-lead3', 'Deepak Joshi', 'AEL-07698', ['lead', 'submitter'], 'Sourcing', 'Commodity Lead — Plastics, Packing & Indirect', ['PLM', 'RES', 'COR', 'EPS', 'FRT', 'MRO', 'FAC'], 'DDN'),
  u('u-eval2', 'Amit Saxena', 'AEL-09876', ['techeval', 'submitter'], 'DQA', 'Manager, DQA', [], 'RJP'),
  u('u-eval3', 'Ritu Malhotra', 'AEL-10021', ['techeval', 'submitter'], 'Quality', 'Manager, Quality', [], 'DDN'),
  u('u-eval4', 'Karan Bhatia', 'AEL-10288', ['techeval', 'submitter'], 'Process', 'Manager, Process Engineering', [], 'JHJ'),
  u('u-eval5', 'Suresh Yadav', 'AEL-10412', ['techeval', 'submitter'], 'Production', 'Production Head, Rajpura', [], 'RJP'),
  u('u-sub2', 'Vivek Chauhan', 'AEL-20588', ['submitter'], 'Production', 'Shift Engineer, Production', [], 'JHJ'),
  u('u-sub3', 'Farah Khan', 'AEL-20631', ['submitter'], 'Quality', 'Quality Engineer', [], 'SRC'),
  u('u-sub4', 'Harish Menon', 'AEL-20702', ['submitter'], 'Process', 'Process Engineer', [], 'PUN'),
  u('u-sub5', 'Tanvi Gupta', 'AEL-20744', ['submitter'], 'DQA', 'DQA Engineer', [], 'RJP'),
  u('u-sup2', 'Lakshmi Narayan', 'V10007', ['supplier'], 'Supplier', 'Sales Head, Coolmax Compressors India', ['CMP'], 'SRC', { supplierCode: 'V10007', email: 'lakshmi@coolmaxindia.com' }),
  u('u-sup3', 'Gurpreet Sandhu', 'V10005', ['supplier'], 'Supplier', 'Director, Shakti Steel Processors', ['STL'], 'RJP', { supplierCode: 'V10005', email: 'gurpreet@shaktisteel.in' }),
  u('u-sup4', 'Ankit Jain', 'V10009', ['supplier'], 'Supplier', 'Business Head, Circuitek Electronics', ['PCB'], 'NDA', { supplierCode: 'V10009', email: 'ankit.jain@circuitek.in' }),
]

// Demo login tiles — one per role (hard-coded, password coin@2026)
export const DEMO_LOGINS: { userId: string; role: string; blurb: string }[] = [
  { userId: 'u-head', role: 'Sourcing Head', blurb: 'All data · approves above limit · MIS' },
  { userId: 'u-lead1', role: 'Commodity Lead', blurb: 'Metals · approvals · workshops' },
  { userId: 'u-buyer1', role: 'Commodity Buyer', blurb: 'Fasteners & Steel · validation · execution' },
  { userId: 'u-eval1', role: 'Technical Evaluator', blurb: 'R&D go / no-go · validation plan' },
  { userId: 'u-fin', role: 'Finance Controller', blurb: 'Validates realised savings' },
  { userId: 'u-mgmt', role: 'Management', blurb: 'Dashboards & monthly report' },
  { userId: 'u-sub1', role: 'Submitter', blurb: 'R&D employee · own ideas' },
  { userId: 'u-sup1', role: 'Supplier', blurb: 'Sunrise Fasteners · feasibility & workshops' },
  { userId: 'u-admin', role: 'Admin', blurb: 'Masters · users · approval matrix' },
]

export const SUPPLIERS_DEFAULT: Supplier[] = [
  { code: 'V10001', name: 'Kiran Copper Tubes Pvt Ltd', commodities: ['CUT'], contactEmail: 'sales@kirancopper.in', contactName: 'Mahesh Kiran', city: 'Silvassa', spend: 1480 * CR },
  { code: 'V10002', name: 'Northstar Metal Mills', commodities: ['CUT', 'ALU'], contactEmail: 'kam@northstarmetal.in', contactName: 'Ravi Northey', city: 'Bhiwadi', spend: 965 * CR },
  { code: 'V10003', name: 'Alfa Foils & Fins Ltd', commodities: ['ALU'], contactEmail: 'orders@alfafoils.in', contactName: 'Sunita Alva', city: 'Pune', spend: 640 * CR },
  { code: 'V10004', name: 'Greenline Aluminium', commodities: ['ALU'], contactEmail: 'sales@greenlineal.in', contactName: 'Prakash Green', city: 'Hosur', spend: 310 * CR },
  { code: 'V10005', name: 'Shakti Steel Processors', commodities: ['STL'], contactEmail: 'gurpreet@shaktisteel.in', contactName: 'Gurpreet Sandhu', city: 'Faridabad', spend: 520 * CR },
  { code: 'V10006', name: 'Tricity Coil Centre', commodities: ['STL'], contactEmail: 'coil@tricitycoil.in', contactName: 'Harjeet Mann', city: 'Ludhiana', spend: 290 * CR },
  { code: 'V10007', name: 'Coolmax Compressors India', commodities: ['CMP'], contactEmail: 'lakshmi@coolmaxindia.com', contactName: 'Lakshmi Narayan', city: 'Chennai', spend: 1820 * CR },
  { code: 'V10008', name: 'Rotary Cool Systems', commodities: ['CMP'], contactEmail: 'sales@rotarycool.in', contactName: 'Venkat Rao', city: 'Sri City', spend: 1040 * CR },
  { code: 'V10009', name: 'Circuitek Electronics', commodities: ['PCB'], contactEmail: 'ankit.jain@circuitek.in', contactName: 'Ankit Jain', city: 'Noida', spend: 760 * CR },
  { code: 'V10010', name: 'Nova PCB Solutions', commodities: ['PCB'], contactEmail: 'bd@novapcb.in', contactName: 'Shweta Nair', city: 'Bengaluru', spend: 480 * CR },
  { code: 'V10011', name: 'Dynamo Motors Pvt Ltd', commodities: ['MOT'], contactEmail: 'sales@dynamomotors.in', contactName: 'K. Selvam', city: 'Coimbatore', spend: 430 * CR },
  { code: 'V10012', name: 'Vega BLDC Drives', commodities: ['MOT'], contactEmail: 'info@vegabldc.in', contactName: 'Aditya Vega', city: 'Pune', spend: 290 * CR },
  { code: 'V10013', name: 'Linkwire Harness Systems', commodities: ['HAR'], contactEmail: 'kam@linkwire.in', contactName: 'Rahul Link', city: 'Gurugram', spend: 240 * CR },
  { code: 'V10014', name: 'Omkar Cables', commodities: ['HAR'], contactEmail: 'sales@omkarcables.in', contactName: 'Omkar Patil', city: 'Manesar', spend: 150 * CR },
  { code: 'V10015', name: 'Polymould Industries', commodities: ['PLM'], contactEmail: 'sales@polymould.in', contactName: 'Nitin Arora', city: 'Dehradun', spend: 310 * CR },
  { code: 'V10016', name: 'Apex Plastomers', commodities: ['PLM'], contactEmail: 'apex@plastomers.in', contactName: 'Simran Kaur', city: 'Baddi', spend: 180 * CR },
  { code: 'V10017', name: 'Resinova Polymers', commodities: ['RES'], contactEmail: 'trade@resinova.in', contactName: 'Hemant Shah', city: 'Vadodara', spend: 560 * CR },
  { code: 'V10018', name: 'Boxcraft Packaging', commodities: ['COR'], contactEmail: 'orders@boxcraft.in', contactName: 'Jaspreet Gill', city: 'Rajpura', spend: 140 * CR },
  { code: 'V10019', name: 'Thermopack EPS', commodities: ['EPS'], contactEmail: 'sales@thermopack.in', contactName: 'Rajiv Thomas', city: 'Jhajjar', spend: 95 * CR },
  { code: 'V10020', name: 'Swiftline Logistics', commodities: ['FRT'], contactEmail: 'ops@swiftline.in', contactName: 'Arvind Swift', city: 'Delhi NCR', spend: 310 * CR },
  { code: 'V10021', name: 'Sunrise Fasteners Pvt Ltd', commodities: ['FAS'], contactEmail: 'rakesh.gupta@sunrisefasteners.in', contactName: 'Rakesh Gupta', city: 'Ludhiana', spend: 86 * CR },
  { code: 'V10022', name: 'Precision Bolt Works', commodities: ['FAS'], contactEmail: 'sales@precisionbolt.in', contactName: 'Jignesh Patel', city: 'Rajkot', spend: 44 * CR },
  { code: 'V10023', name: 'RoadRunner Freight Carriers', commodities: ['FRT'], contactEmail: 'bookings@roadrunner.in', contactName: 'Sukhwinder Brar', city: 'Ludhiana', spend: 180 * CR },
  { code: 'V10024', name: 'Toolkart Industrial Supplies', commodities: ['MRO'], contactEmail: 'b2b@toolkart.in', contactName: 'Neeraj Kart', city: 'Noida', spend: 120 * CR },
  { code: 'V10025', name: 'Facilitas Services', commodities: ['FAC'], contactEmail: 'contracts@facilitas.in', contactName: 'Maria D\'Souza', city: 'Gurugram', spend: 150 * CR },
]

type PartRow = [string, string, string, string, number | null, number, number]
// code, description, uom, supplier, LBP (null = no LBP → PO price), PO price, last FY MRN qty
const PART_ROWS: Record<string, PartRow[]> = {
  FAS: [
    ['3100045612', 'Hex flange bolt M6×16, Zn-Ni', 'Nos', 'V10021', 4.2, 4.25, 2400000],
    ['3100045688', 'Self-tapping screw 4.2×13, pan head', 'Nos', 'V10021', 0.62, 0.63, 18500000],
    ['3100045701', 'Condenser bracket rivet Ø4.8', 'Nos', 'V10022', 1.1, 1.12, 6200000],
    ['3100045733', 'Nylock nut M8, Zn plated', 'Nos', 'V10022', 2.35, 2.4, 3100000],
  ],
  CUT: [
    ['3200011204', 'Copper tube Ø9.52 × 0.35 IGT', 'Kg', 'V10001', 862, 868, 1850000],
    ['3200011215', 'Copper tube Ø7.00 × 0.28 IGT', 'Kg', 'V10001', 874, 880, 2100000],
    ['3200011240', 'Copper tube Ø12.7 plain, LWC', 'Kg', 'V10002', 845, 850, 640000],
    ['3200011277', 'Hairpin bend Ø7 mm, pre-formed', 'Nos', 'V10002', 14.8, 15.0, 9500000],
  ],
  ALU: [
    ['3300021005', 'Hydrophilic fin stock 0.095 mm', 'Kg', 'V10003', 318, 321, 3800000],
    ['3300021019', 'Aluminium fin stock 0.105 mm, blue', 'Kg', 'V10004', 322, 325, 1200000],
    ['3300021044', 'Al header pipe Ø16 mm', 'Nos', 'V10003', 46, 46.5, 900000],
  ],
  STL: [
    ['3400031110', 'CRCA sheet 0.8 mm, IS 513', 'Kg', 'V10005', 72.5, 73.2, 9200000],
    ['3400031126', 'GI sheet 1.0 mm, Z120', 'Kg', 'V10006', 78.4, 79.0, 6800000],
    ['3400031151', 'Pre-painted GI 0.6 mm, white', 'Kg', 'V10005', 96.2, 97.0, 2400000],
    ['3400031187', 'Condenser side bracket, 1.2 mm', 'Nos', 'V10006', 38.5, 39.0, 1450000],
  ],
  CMP: [
    ['3500040012', 'Rotary compressor 1.5 TR R32 inverter', 'Nos', 'V10007', 7850, 7900, 820000],
    ['3500040027', 'Rotary compressor 1.0 TR R32 fixed', 'Nos', 'V10008', 6420, 6480, 540000],
    ['3500040039', 'Rotary compressor 2.0 TR R410A', 'Nos', 'V10007', 9960, 10020, 210000],
  ],
  PCB: [
    ['3600050101', 'Outdoor inverter PCBA 1.5 TR', 'Nos', 'V10009', 2380, 2400, 760000],
    ['3600050118', 'Indoor display PCB assembly', 'Nos', 'V10010', 186, 188, 1500000],
    ['3600050125', 'Remote control PCB', 'Nos', 'V10009', null, 58, 2100000],
  ],
  MOT: [
    ['3700060210', 'BLDC indoor fan motor 40 W', 'Nos', 'V10012', 1120, 1130, 980000],
    ['3700060224', 'PSC outdoor fan motor 60 W', 'Nos', 'V10011', 890, 896, 640000],
    ['3700060233', 'Swing stepper motor 12 V', 'Nos', 'V10011', 62, 62.5, 1650000],
  ],
  HAR: [
    ['3800070301', 'Indoor unit wiring harness', 'Nos', 'V10013', 118, 119, 1600000],
    ['3800070318', 'Power cord 3-core 1.5 sq mm', 'Nos', 'V10014', 142, 143, 1450000],
    ['3800070329', 'Interconnect cable 4-core, 5 m', 'Nos', 'V10013', 386, 390, 700000],
  ],
  PLM: [
    ['3900080405', 'IDU front panel, ABS', 'Nos', 'V10015', 312, 315, 1100000],
    ['3900080417', 'ODU base pan, PP', 'Nos', 'V10016', 184, 186, 950000],
    ['3900080428', 'Horizontal louver set', 'Nos', 'V10015', 42, 42.4, 1300000],
  ],
  RES: [
    ['4000090501', 'ABS resin HI-121', 'Kg', 'V10017', 168, 170, 5200000],
    ['4000090512', 'PP copolymer, talc-filled', 'Kg', 'V10017', 112, 113, 4300000],
  ],
  COR: [
    ['4100100601', '5-ply corrugated box, IDU', 'Nos', 'V10018', 96, 97, 1250000],
    ['4100100614', '7-ply corrugated box, ODU', 'Nos', 'V10018', 168, 170, 1100000],
  ],
  EPS: [
    ['4200110701', 'EPS top / bottom set, IDU', 'Set', 'V10019', 74, 75, 1250000],
    ['4200110716', 'EPS corner set, ODU', 'Set', 'V10019', null, 118, 1100000],
  ],
  FRT: [
    ['9100000801', 'FTL freight Rajpura → Mumbai, 32 ft MXL', 'Trip', 'V10020', 68000, 68000, 1450],
    ['9100000815', 'FTL freight Sri City → Delhi, 32 ft MXL', 'Trip', 'V10023', 112000, 112000, 820],
  ],
  MRO: [
    ['9200000901', 'Brazing rod 15% Ag', 'Kg', 'V10024', 7800, 7850, 18500],
    ['9200000914', 'Nitrogen gas cylinder, 7 m³', 'Nos', 'V10024', 480, 485, 42000],
  ],
  FAC: [
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
  { id: 'AR1', condition: 'Annualised impact up to ₹ X lakh', approver: 'Commodity Lead', thresholdLakh: 50, kind: 'value' },
  { id: 'AR2', condition: 'Annualised impact above ₹ X lakh', approver: 'Commodity Lead → Sourcing Head', thresholdLakh: 50, kind: 'value' },
  { id: 'AR3', condition: 'Any idea with one-time investment above ₹ Y lakh', approver: '+ Sourcing Head', thresholdLakh: 25, kind: 'investment' },
]

export const SLA_RULES_DEFAULT: SlaRule[] = SLA_DEFAULTS.map((s) => ({ ...s }))
export const DROP_REASONS = DROP_REASONS_DEFAULT

export const EMAIL_TEMPLATES_DEFAULT: EmailTemplate[] = [
  { id: 'T01', name: 'Idea submitted', subject: 'COIN · New idea {{ideaId}} in {{commodity}}', body: 'Dear {{recipient}},\n\nA new cost-reduction idea "{{title}}" has been submitted in {{commodity}} with an estimated annualised impact of {{impact}}.\n\nPlease validate it within 5 working days.\n\n— COIN · Cost Innovation Hub' },
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
  { id: 'OB-003', templateId: 'ST02', templateName: 'Submit your ideas — commodity drive', commodities: ['PLM', 'RES', 'COR'], recipients: ['V10015', 'V10016', 'V10017', 'V10018'], recipientCount: 4, replyBy: '2026-10-15', sentAt: '2026-09-24T04:45:00.000Z', sentBy: 'u-buyer5', sentByName: 'Imran Sheikh' },
  { id: 'OB-002', templateId: 'ST02', templateName: 'Submit your ideas — commodity drive', commodities: ['CUT', 'ALU'], recipients: ['V10001', 'V10002', 'V10003', 'V10004'], recipientCount: 4, replyBy: '2026-10-10', sentAt: '2026-09-18T06:00:00.000Z', sentBy: 'u-buyer2', sentByName: 'Kavita Rao' },
  { id: 'OB-001', templateId: 'ST01', templateName: 'Improvement workshop invitation', commodities: ['FAS'], recipients: ['V10021', 'V10022'], recipientCount: 2, workshopDate: '2026-09-26', sentAt: '2026-09-12T05:30:00.000Z', sentBy: 'u-buyer1', sentByName: 'Arjun Mehta' },
]

export const SUPPLIER_RESPONSES_DEFAULT: SupplierResponse[] = [
  { id: 'SR-1009', source: 'Supplier Portal', portalRef: 'SP-26-0423', supplierCode: 'V10004', commodity: 'ALU', type: 'Idea', scope: 'Specific parts', partCodes: ['3300021019'], subject: 'Switch blue fin coating to hydrophilic grade 0.100 mm', body: 'Our hydrophilic 0.100 mm grade matches the heat-transfer performance of the current blue 0.105 mm stock at a lower gauge. Sample coils are available for trial.', estSavingLakh: 58, receivedAt: '2026-10-01T04:30:00.000Z', status: 'New', batchId: 'OB-002' },
  { id: 'SR-1006', source: 'Supplier Portal', portalRef: 'SP-26-0420', supplierCode: 'V10015', commodity: 'PLM', type: 'Idea', scope: 'Specific parts', partCodes: ['3900080405'], subject: 'Hot-runner conversion for IDU front panel tool', body: 'Converting the 2-cavity cold-runner tool to hot-runner removes ~38 g runner per shot and cuts cycle time by 6 s. One-time tooling investment of ₹ 9.5 lakh, payback under 5 months.', estSavingLakh: 27, receivedAt: '2026-09-30T07:55:00.000Z', status: 'New', batchId: 'OB-003' },
  { id: 'SR-1001', source: 'Supplier Portal', portalRef: 'SP-26-0412', supplierCode: 'V10001', commodity: 'CUT', type: 'Idea', scope: 'Specific parts', partCodes: ['3200011215'], subject: 'Reduce wall thickness of Ø7.00 IGT tube from 0.28 to 0.25 mm', body: 'We have qualified a 0.25 mm inner-grooved tube on our new drawing line with the same burst-pressure margin. Weight saving is about 9% per metre. We can provide samples within 3 weeks for your R&D validation.', estSavingLakh: 118, receivedAt: '2026-09-29T08:12:00.000Z', status: 'New', batchId: 'OB-002' },
  { id: 'SR-1004', source: 'Supplier Portal', portalRef: 'SP-26-0417', supplierCode: 'V10002', commodity: 'CUT', type: 'Problem', scope: 'Specific parts', partCodes: ['3200011240'], subject: 'Frequent drawing revisions on Ø12.7 LWC tube', body: 'We received three drawing revisions in the last quarter for the same part without an ECN reference, causing rework of ~2 MT. Requesting a single frozen revision and ECN communication.', receivedAt: '2026-09-28T06:20:00.000Z', status: 'New', batchId: 'OB-002' },
  { id: 'SR-1002', source: 'Supplier Portal', portalRef: 'SP-26-0415', supplierCode: 'V10003', commodity: 'ALU', type: 'Idea', scope: 'Open idea', subject: 'Coil-width rationalisation across fin stock SKUs', body: 'Amber currently buys fin stock in 7 slit widths. Consolidating to 4 widths reduces our slitting scrap and changeover time; we can pass on ₹ 4/kg.', estSavingLakh: 42, receivedAt: '2026-09-27T11:40:00.000Z', status: 'Under review', batchId: 'OB-002' },
  { id: 'SR-1003', source: 'Supplier Portal', portalRef: 'SP-26-0409', supplierCode: 'V10021', commodity: 'FAS', type: 'Idea', scope: 'Specific parts', partCodes: ['3100045612'], subject: 'Replace Zn-Ni plating with Zn-flake coating on M6 flange bolt', body: 'Zn-flake meets the 720 h salt-spray requirement at lower cost and removes hydrogen-embrittlement risk. Proposed at ₹ 3.95 vs current ₹ 4.20.', estSavingLakh: 6, receivedAt: '2026-09-26T13:05:00.000Z', status: 'Converted to idea', batchId: 'OB-001' },
  { id: 'SR-1005', source: 'Supplier Portal', portalRef: 'SP-26-0402', supplierCode: 'V10018', commodity: 'COR', type: 'Complaint', scope: 'Open idea', subject: 'Payment delays beyond agreed 60-day terms', body: 'Invoices for July and August are outstanding beyond 75 days. This affects our kraft paper procurement and our ability to hold prices.', receivedAt: '2026-09-25T09:30:00.000Z', status: 'Under review', batchId: 'OB-003' },
  { id: 'SR-1007', source: 'Supplier Portal', portalRef: 'SP-26-0398', supplierCode: 'V10017', commodity: 'RES', type: 'Idea', scope: 'Open idea', subject: 'Bulk silo delivery instead of 25 kg bags for PP copolymer', body: 'For the Dehradun and Rajpura plants, moving to bulk tanker delivery with a silo saves bag cost and handling loss. We can support silo installation on a shared-cost basis.', estSavingLakh: 33, receivedAt: '2026-09-24T10:10:00.000Z', status: 'New', batchId: 'OB-003' },
  { id: 'SR-1008', source: 'Supplier Portal', portalRef: 'SP-26-0391', supplierCode: 'V10022', commodity: 'FAS', type: 'Problem', scope: 'Specific parts', partCodes: ['3100045733'], subject: 'Forecast variance on M8 Nylock nut schedules', body: 'Monthly schedules vary by more than ±40% versus the forecast shared, leading to excess inventory at our end. Requesting a 3-month rolling firm schedule.', receivedAt: '2026-09-22T05:45:00.000Z', status: 'Closed', batchId: 'OB-001' },
]

// ─── Campaign workspace — email campaign types (wizard step 1) ───
import type { OutreachKind } from './types'
export const OUTREACH_KINDS: { key: OutreachKind; icon: string; desc: string; templateId: string }[] = [
  { key: 'Supplier idea drive', icon: 'Lightbulb', desc: 'Ask a commodity’s suppliers to submit open or part-specific ideas', templateId: 'ST02' },
  { key: 'Improvement workshop', icon: 'Presentation', desc: 'Invite suppliers to a cost-improvement workshop with Amber', templateId: 'ST01' },
  { key: 'Reminder', icon: 'BellRing', desc: 'Nudge suppliers who have not replied yet', templateId: 'ST03' },
]
