// COIN — Cost Optimisation & Innovation Network: Scope of Work (v2.0, 01 Oct 2026).
// Describes the current build. Used by the Scope & Methodology page, tooltips, reports and admin screens.
import { NPD_COMMODITIES, NPD_SOURCE, NPD_SPOC_COLUMNS, PAYMENT_METHODS, VENDOR_GROUPS } from './npd'

/** Which workspace a part of the document belongs to */
export type DocSpace = 'CO' | 'IN' | 'Both'

export const DOC_META = {
  title: 'COIN — Cost Optimisation & Innovation Network: Scope of Work',
  version: 'v2.0',
  status: 'for review',
  date: '01 Oct 2026',
  author: '@Bagish',
  table: [
    ['Client', 'Amber Enterprises India Ltd.'],
    ['Product', 'COIN — Cost Optimisation & Innovation Network (in-app name: Cost Innovation Hub)'],
    ['Business owner', 'Sourcing / Procurement'],
    ['Document', 'Scope of Work, v2.0 for review — describes the current build'],
    ['Prepared by', 'Vagish Kumar Mishra, Genessence'],
    ['Financial year', 'April to March; quarters Q1 (Apr–Jun) to Q4 (Jan–Mar)'],
  ] as [string, string][],
}

export const PURPOSE = [
  "COIN is the single system Amber's Sourcing team uses to capture, value, approve, execute and prove every cost-reduction idea, from submission to realised savings.",
  'The product is organised as two workspaces. CO (Cost Optimisation) holds execution, everything after approval: implementation through NPD, PAP or internal change, due dates, realised savings from actual MRN, Finance validation, price leakage and the monthly report. IN (Innovation Network) is the idea network: suppliers, Sourcing, R&D, DQA, Quality, Process and Production raise ideas, Sourcing validates and approves them, and supplier campaigns feed the portfolio.',
  'The portal covers both direct buying (BOM materials and components) and indirect buying.',
]

/** The two workspaces chosen after login (Purpose and Modules sections) */
export const WORKSPACES: { code: 'CO' | 'IN'; name: string; covers: string; pages: string; icon: string; color: string }[] = [
  { code: 'CO', name: 'Cost Optimisation', covers: 'Execution, after approval', pages: 'Dashboard · Execution Hub · Implemented ideas · NPD master · realised savings, Finance validation and price leakage', icon: 'Calculator', color: '#0f9f8a' },
  { code: 'IN', name: 'Innovation Network', covers: 'The idea network, up to approval', pages: 'Idea Register · My Ideas · Submit Idea · Feasibility Requests and Workshops (suppliers) · Campaigns · NPD master · Admin & Masters', icon: 'Network', color: '#2459e0' },
]
export const WORKSPACE_NOTE =
  'After login every user sees the four status cards (Pipeline, In Execution, Implemented, Dropped) and chooses a workspace. The sidebar shows only that workspace\'s pages: Scope & Methodology sits at the top under Overview, MIS is pinned at the bottom, and the workspace badge in the sidebar header switches between CO and IN.'

export const PROBLEM_INTRO =
  'Sourcing runs cost reduction across every commodity, but ideas have been chased through Excel trackers, emails and review meetings, so savings are hard to track and harder to defend.'

export const OBJECTIVES = [
  'Capture 100% of cost-reduction ideas, direct and indirect, in one system of record.',
  'Value every idea in rupees using one Finance-accepted method.',
  'Show Pipeline, In Execution, Implemented and Dropped ideas with their savings at all times.',
  'Make supplier participation measurable, commodity by commodity.',
  'Give every approved idea an owner, a due date and a reminder schedule until it is done or dropped with a reason.',
  'Remove manual MIS preparation through the automated monthly report.',
]

export const PROBLEMS: { problem: string; impact: string; solution: string }[] = [
  { problem: 'Ideas from suppliers, R&D, Quality and Production have no single entry point', impact: 'Good ideas are lost; the same idea is raised twice', solution: 'One submission form for all internal users and suppliers, with a duplicate check on idea name and commodity' },
  { problem: 'Each buyer calculates savings differently', impact: 'Savings numbers get challenged in management and Finance reviews', solution: 'One savings rule: baseline from last buying price, volume from last FY MRN, realisation from actual MRN' },
  { problem: 'Technical ideas (VA/VE, material change) stall between Sourcing, R&D and DQA', impact: 'Savings slip to the next FY', solution: 'Category-based routing, stage SLAs, and a direct hand-off to the NPD platform for sampling' },
  { problem: 'No view of pipeline vs committed vs realised', impact: 'Management cannot see how much saving is realised, committed or still in the pipeline', solution: 'Four status cards on entry and one-screen dashboards in both workspaces' },
  { problem: 'Supplier workshops are run but outputs are not followed up', impact: 'Supplier-led innovation is not systematic', solution: 'Commodity-wise email campaigns, replies through the Supplier Portal, tracked reply rate and conversion to ideas' },
  { problem: 'Execution depends on individual follow-up', impact: 'Approved ideas go quiet; drops are never explained', solution: 'Execution Hub with owners, due dates, a reminder schedule, health badges and mandatory drop reasons' },
  { problem: 'Monthly MIS is prepared manually', impact: 'Time lost every month; numbers differ by author', solution: 'Auto-generated monthly Cost Optimisation Report emailed to management' },
]

export const ROLES_INTRO =
  'COIN has nine roles; one person can hold more than one (a Commodity Lead is also a Submitter), and a user sees only the commodities mapped to them unless the role is organisation-wide.'

export const ROLES: { key: string; role: string; who: string; job: string; visibility: string }[] = [
  { key: 'submitter', role: 'Submitter', who: 'Any employee: R&D, DQA, Quality, Process, Production, Sourcing', job: 'Submits ideas, tracks own ideas, answers queries', visibility: 'Own ideas' },
  { key: 'supplier', role: 'Supplier', who: 'Registered vendor user from the vendor master', job: 'Submits ideas with gain-share, answers workshop invites, confirms feasibility and offered price', visibility: 'Own ideas and feasibility requests' },
  { key: 'buyer', role: 'Commodity Buyer', who: 'Sourcing executive owning a commodity', job: 'Validates incoming ideas, confirms baseline, runs supplier campaigns, owns execution', visibility: 'Mapped commodities' },
  { key: 'techeval', role: 'Technical Evaluator', who: 'R&D, DQA, Quality, Process (by category)', job: 'Technical go / no-go, validation plan', visibility: 'Ideas routed to them' },
  { key: 'lead', role: 'Commodity Lead', who: 'Senior buyer / commodity manager', job: 'Approves within limit, runs workshops and campaigns, reviews commodity funnel', visibility: 'Mapped commodities' },
  { key: 'head', role: 'Sourcing Head', who: 'Vertical Head / Head of Sourcing', job: 'Approves above limit, reviews buyers and commodity funnels', visibility: 'All' },
  { key: 'finance', role: 'Finance Controller', who: 'Finance / Costing', job: 'Reviews realised savings awaiting validation; reads dashboards and MIS', visibility: 'All (read) + validation' },
  { key: 'mgmt', role: 'Management', who: 'CXO, Plant Head, BU Head', job: 'Dashboards and monthly report', visibility: 'All (read only)' },
  { key: 'admin', role: 'Admin', who: 'Sourcing Excellence / IT', job: 'Masters, users, approval matrix, rules, templates, settings, demo data', visibility: 'All' },
]

// Permission matrix (✓ = allowed, — = not allowed) — mirrors PERMS in lib/nav
export const PERM_COLS = ['Submitter', 'Supplier', 'Buyer', 'Tech Eval', 'Comm. Lead', 'Sourcing Head', 'Finance', 'Mgmt', 'Admin']
export const PERMISSION_MATRIX: { action: string; key: string; cells: string[] }[] = [
  { action: 'Submit idea', key: 'submit', cells: ['✓', '✓', '✓', '✓', '✓', '✓', '—', '—', '—'] },
  { action: 'Validate idea / edit baseline', key: 'validate', cells: ['—', '—', '✓', '—', '✓', '✓', '—', '—', '—'] },
  { action: 'Confirm feasibility and offered price', key: 'feasibility', cells: ['—', '✓', '✓ (on behalf)', '—', '—', '—', '—', '—', '—'] },
  { action: 'Technical evaluation', key: 'techeval', cells: ['—', '—', '—', '✓', '—', '—', '—', '—', '—'] },
  { action: 'Approve (within value slab)', key: 'approve', cells: ['—', '—', '—', '—', '✓', '✓', '—', '—', '—'] },
  { action: 'Update execution, mark done / drop', key: 'execute', cells: ['—', '—', '✓', '—', '✓', '✓', '—', '—', '—'] },
  { action: 'Review savings to validate', key: 'financeValidate', cells: ['—', '—', '—', '—', '—', '—', '✓', '—', '—'] },
  { action: 'Run campaigns / workshops', key: 'campaign', cells: ['—', '—', '✓', '—', '✓', '✓', '—', '—', '✓'] },
  { action: 'View dashboards and MIS', key: 'view', cells: ['Own', 'Own', 'Commodity', 'Routed', 'Commodity', 'All', 'All', 'All', 'All'] },
  { action: 'Manage masters, users', key: 'masters', cells: ['—', '—', '—', '—', '—', '—', '—', '—', '✓'] },
]

export const METHOD_INTRO =
  "Every idea is valued with one rule: price delta per unit × volume, where the baseline comes from the last buying price and volume comes from MRN data, so every buyer's number is calculated the same way."

export const DEFINITIONS: [string, string][] = [
  ['Idea', 'A proposal that reduces the landed cost of a part, commodity, supplier relationship or process'],
  ['Open idea', 'Tagged to a commodity only, no part code (e.g. "move Cu tube sourcing to a regional mill")'],
  ['Part-specific idea', 'Linked to one or more part codes (e.g. "reduce gauge on a condenser bracket")'],
  ['Supplier idea', 'Raised for one supplier; part codes are optional, otherwise it is valued by an estimate'],
  ['Category', 'The idea type chosen from the idea category master; it decides the route'],
  ['Commodity group', 'The grouping of commodities (Metals, Electricals, Plastics, Packing, Logistics…); set automatically from the commodity'],
  ['Baseline price', 'Last buying price (LBP) of the part; if none, current PO price; for a new part, the quoted price (same rule as the Price Approval Portal)'],
  ['New price', 'Estimated at submission; replaced by the approved revised price at implementation'],
  ['Annual volume', 'Quantity received in the last full FY, from MRN; if no history, a forecast volume entered by the buyer and flagged'],
  ['Annualised impact', 'Full-year saving at the new price and annual volume'],
  ['Committed saving', 'Saving expected inside the current FY, phased by quarter from the implementation date'],
  ['Realised saving', 'Saving actually earned: price delta × MRN quantity received after the effective date'],
  ['Carry-over', 'Part of the annualised impact that falls in the next FY'],
]

export const FORMULAS: { name: string; expr: string }[] = [
  { name: 'Saving per unit', expr: 'P(baseline) − P(new)' },
  { name: 'Annualised impact', expr: '(P(baseline) − P(new)) × Q(last FY MRN)' },
  { name: 'Committed in FY', expr: 'Annualised impact × months live in FY ÷ 12' },
  { name: 'Realised (FY to date)', expr: '(P(baseline) − P(approved)) × Q(MRN after effective date)' },
]

export const WORKED_EXAMPLE =
  'Worked example: a fastener idea cuts the price from ₹ 4.20 to ₹ 3.85 on 24,00,000 units received last FY. Saving per unit is ₹ 0.35 and annualised impact is ₹ 8.40 lakh. If it goes live on 1 October, the FY commits about ₹ 4.20 lakh (six months) and ₹ 4.20 lakh carries over to next FY.'

export const SAVINGS_CLASS_NOTE =
  'Each idea takes its classification from the default of its category; it is not entered on the form.'
export const SAVINGS_TYPES: { type: string; examples: string; counts: string }[] = [
  { type: 'Hard saving', examples: 'Negotiation, value engineering, alternate material, localisation', counts: 'Yes' },
  { type: 'Cost avoidance', examples: 'Resisting an RM or forex-driven increase', counts: 'No — reported separately' },
  { type: 'One-time saving', examples: 'Payment-term gain, a one-off freight benefit', counts: 'No — reported separately' },
]

export const CREDIBILITY_RULES = [
  'Baseline and volume are auto-filled; a submitter or buyer can override them only with a mandatory reason, and every override is logged.',
  'Savings move from Committed to Realised only from actual MRN data, never from manual entry.',
  'Realised savings are reported as validated only after Finance validation (configurable on / off in Admin).',
  'An idea spanning several part codes stores price, volume and saving per part code and rolls them up.',
]

export const LEVER_INTRO =
  "The category chosen on the form decides the idea's route: commercial ideas skip R&D and sampling, while technical ideas must pass R&D evaluation and an NPD sample before the price can change."
export const LEVER_FOOTNOTE =
  'All categories roll up to Total Productivity in reports. The idea category master is admin-configurable: a new category, its group, route, evaluator and NPD sample rule can be added without code changes.'
export const LEVER_SPLIT_NOTE =
  'Alternate material substitution (technical route) and Alternate supplier (supplier-change route) are separate categories because they follow different routes and evaluators.'

export const ROUTES_TABLE: { route: string; stages: string }[] = [
  { route: 'Commercial', stages: 'Buyer validation → Supplier confirmation → Approval → Price revision in PAP → Implemented' },
  { route: 'Supplier change', stages: 'Buyer validation → New supplier feasibility → DQA qualification → Approval → NPD sample → Price / source change in PAP → Implemented' },
  { route: 'Technical', stages: 'Buyer validation → Supplier feasibility → R&D evaluation (+DQA/Quality) → Approval → NPD ECN up to sample approval → Price revision in PAP → Implemented' },
  { route: 'Internal', stages: 'Buyer validation → Owning department evaluation → Approval → Execution → Implemented' },
]

// ─── the Submit Idea form, as built ────────────────────────────────
export const FORM_INTRO =
  'The form has 26 numbered fields, but a submitter types only about 8 of them: the rest are auto-filled from login, part master, LBP and MRN, or shown only when relevant.'
export const FORM_LAYOUT =
  'Layout: collapsible steps A–E on the left and a fixed savings summary panel on the right that recalculates as the user types. Only step A is open at first; step E appears only for supplier logins. The draft saves automatically.'

export const FORM_FIELDS: { n: number; card: string; field: string; type: string; req: string; source: string }[] = [
  { n: 1, card: 'A. Classification', field: 'Submitter name, employee ID', type: 'Auto', req: 'Yes', source: 'From login (vendor code for a supplier)' },
  { n: 2, card: 'A. Classification', field: 'Department', type: 'Auto', req: 'Yes', source: 'From login (R&D, DQA, Quality, Process, Production, Sourcing)' },
  { n: 3, card: 'A. Classification', field: 'Plant / BU', type: 'Dropdown', req: 'Yes', source: "Defaults to the user's plant" },
  { n: 4, card: 'A. Classification', field: 'Buying type', type: 'Toggle', req: 'Yes', source: 'Direct / Indirect; follows the commodity' },
  { n: 5, card: 'A. Classification', field: 'Commodity', type: 'Dropdown', req: 'Yes', source: 'Grouped by commodity group; sets the commodity group and buying type automatically' },
  { n: 6, card: 'A. Classification', field: 'Category', type: 'Dropdown with icons', req: 'Yes', source: 'Idea category master; shows the route, evaluator and NPD sample rule' },
  { n: 7, card: 'A. Classification', field: 'Idea scope', type: 'Toggle', req: 'Yes', source: 'Open idea / Part-specific / Supplier; Supplier opens a supplier picker filtered to the commodity' },
  { n: 8, card: 'A. Classification', field: 'Campaign / workshop', type: 'Dropdown', req: 'No', source: 'Live campaigns; auto-set when opened from a campaign link' },
  { n: 9, card: 'B. Idea details', field: 'Idea name', type: 'Text, 100 chars', req: 'Yes', source: 'Duplicate check runs on idea name + commodity' },
  { n: 10, card: 'B. Idea details', field: 'Current state', type: 'Text', req: 'Yes', source: 'How it is done / bought today' },
  { n: 11, card: 'B. Idea details', field: 'Proposed change', type: 'Text', req: 'Yes', source: 'What changes' },
  { n: 12, card: 'B. Idea details', field: 'Evidence', type: 'Text + tags', req: 'No', source: 'Trial, quote, benchmark, drawing' },
  { n: 13, card: 'B. Idea details', field: 'Attachments', type: 'Multi-file', req: 'No', source: 'Images, PDF, drawings, quotes; up to 10 files, 10 MB each' },
  { n: 14, card: 'C. Parts', field: 'Part code(s)', type: 'Multi-select search', req: 'If part-specific', source: 'ERP part master; optional for a supplier idea and limited to that supplier\'s parts' },
  { n: 15, card: 'C. Parts', field: 'Part description, UoM', type: 'Auto', req: '—', source: 'From part master' },
  { n: 16, card: 'C. Parts', field: 'Current supplier(s)', type: 'Auto', req: '—', source: 'From last PO / MRN, vendor code + name' },
  { n: 17, card: 'C. Parts', field: 'Proposed supplier', type: 'Search', req: 'If supplier category', source: 'Shown for supply-base categories; vendor master or a new supplier by name' },
  { n: 18, card: 'D. Expected impact', field: 'Baseline price / unit (₹)', type: 'Auto, editable', req: 'Yes', source: 'LBP rule (see Definitions); override needs a reason' },
  { n: 19, card: 'D. Expected impact', field: 'Expected new price / unit (₹)', type: 'Number', req: 'Yes', source: 'Per part code' },
  { n: 20, card: 'D. Expected impact', field: 'Annual volume', type: 'Auto, editable', req: 'Yes', source: 'Last FY MRN, else forecast (flagged); override needs a reason' },
  { n: 21, card: 'D. Expected impact', field: 'Saving / unit and %', type: 'Calculated', req: '—', source: 'Live' },
  { n: 22, card: 'D. Expected impact', field: 'Annualised impact (₹)', type: 'Calculated', req: '—', source: 'Live, per part + total' },
  { n: 23, card: 'D. Expected impact', field: 'Expected implementation quarter', type: 'Dropdown', req: 'Yes', source: 'Q1–Q4 of current or next FY; past quarters disabled' },
  { n: 24, card: 'D. Expected impact', field: 'Estimate (₹ lakh)', type: 'Number', req: 'If no part codes', source: 'Open ideas and supplier ideas without parts; marked "Estimate"' },
  { n: 25, card: 'E. Supplier only', field: 'Gain-share % offered to Amber', type: 'Number', req: 'No', source: 'Shown only for supplier logins' },
  { n: 26, card: 'E. Supplier only', field: 'Validity of offer', type: 'Date', req: 'No', source: 'Shown only for supplier logins; today or later' },
]

export const FORM_BEHAVIOUR = [
  'Steps fold: only A is open at first; when the open step\'s required fields are complete it closes and the next one opens. A click on a step header toggles it, and "Expand all" opens every step. A closed step shows a one-line summary and its missing-field count.',
  'Selecting a category shows the route strip (e.g. Buyer → R&D → Approval → NPD sample → PAP) with the evaluator and NPD sample rule.',
  'Selecting a part code fills description, UoM, supplier, baseline and volume in place, with a "from LBP" / "from MRN FY26" tag.',
  'Similar existing ideas appear inline as the idea name is typed, with a match % and a "view" link.',
  'The summary panel shows annualised impact, saving %, saving per unit, the per-part split, committed this FY vs carry-over, the approval route and "what happens next". It stays in view and never needs scrolling; on a phone it becomes a bottom bar.',
  'Actions: Save draft (also Ctrl + S), Submit for validation, Cancel (keep or discard the draft). After submit, the user lands on the idea page showing its ID (COIN-FY27-FAS-0012) and a live status tracker.',
]

// ─── Modules (IDs match the badges shown in the app) ──────────────────────────
export const MODULES_INTRO = 'The portal is delivered as ten modules across the two workspaces; the sidebar shows each user only the pages their role needs.'
export const MODULES: { id: string; name: string; tag: DocSpace; space: string; screens: string; scope: string; path: string }[] = [
  { id: 'M1', name: 'Entry and dashboards', tag: 'Both', space: 'CO and IN', screens: 'Entry screen, workspace dashboards, role homes', scope: 'Four status cards and the CO / IN choice; per workspace a one-screen Dashboard and an Advanced analytics view; own homes for Submitter, Supplier and Technical Evaluator in IN', path: '/' },
  { id: 'M4', name: 'Idea 360 page and side panel', tag: 'Both', space: 'CO and IN', screens: 'Single idea view', scope: 'Stage tracker, value card (estimated vs approved vs realised), part-wise savings, attachments, comments with @mentions, activity log, NPD and PAP request chips; action bar for Validate, feasibility, Go / No-go, Approve / Reject, Send back, Request info, Reassign, Mark Done and Drop', path: '/ideas/:id' },
  { id: 'M10', name: 'MIS', tag: 'Both', space: 'Pinned in CO and IN', screens: 'Report library, KPI library, monthly mailer, scheduled emails', scope: '12 standard reports with filter bar and Excel / PDF export; monthly management mailer', path: '/reports' },
  { id: 'M8', name: 'Execution Hub', tag: 'CO', space: 'CO', screens: 'Execution dashboard', scope: 'Approved ideas with owner, due date, quarter phasing, milestones, reminder schedule, health, Done / Drop and slippage log', path: '/execution' },
  { id: 'NPD', name: 'NPD development master', tag: 'CO', space: 'CO (also listed in IN)', screens: 'Read-only master', scope: 'Commodity codes, development SPOC per plant / product line, DQA SPOC, performance and reliability testing days, vendor groups and payment methods — synced from VMS', path: '/npd' },
  { id: 'M2', name: 'Idea Register / My Ideas', tag: 'IN', space: 'IN (Implemented ideas view in CO)', screens: 'Table + Kanban', scope: 'Filter bar, saved views, quick filters as chips, Kanban by stage with drag to move (permission-checked), Excel export, ageing badge on each row', path: '/ideas' },
  { id: 'M3', name: 'Submit Idea', tag: 'IN', space: 'IN', screens: 'Collapsible form', scope: 'Collapsible steps A–E, fixed summary panel, duplicate check, route preview, campaign pre-fill, auto-saved draft', path: '/submit' },
  { id: 'M6', name: 'Supplier workspace', tag: 'IN', space: 'IN', screens: 'Supplier home, Feasibility Requests, Workshops', scope: 'Submit ideas with gain-share; answer feasibility with offered price, lead time and MOQ through a 7-day secure link; accept or decline workshop invites', path: '/feasibility' },
  { id: 'M7', name: 'Campaigns', tag: 'IN', space: 'IN', screens: 'Dashboard, Workshops & drives, Supplier responses, Email templates', scope: 'Supplier email campaigns through a four-step wizard; replies from the Supplier Portal converted into ideas; workshops with attendance and auto-invites; template add / edit', path: '/campaigns' },
  { id: 'M12', name: 'Admin & Masters', tag: 'IN', space: 'IN', screens: 'Settings', scope: 'Commodity group, commodity, idea category, route, department, plant, user–role–commodity mapping, vendor and part masters, approval matrix, drop reasons, SLA and reminder rules, email templates, FY calendar, settings, audit trail, data backup and reset', path: '/admin' },
]

export const NAV_BY_ROLE: { role: string; coNav: string; inNav: string }[] = [
  { role: 'Submitter', coNav: '—', inNav: 'My Ideas · Submit Idea' },
  { role: 'Supplier', coNav: '—', inNav: 'My Ideas · Submit Idea · Feasibility Requests · Workshops' },
  { role: 'Technical Evaluator', coNav: 'NPD master', inNav: 'My Ideas · Submit Idea · NPD master' },
  { role: 'Buyer / Commodity Lead / Sourcing Head', coNav: 'Execution Hub · Implemented ideas · NPD master · MIS', inNav: 'Idea Register · Submit Idea · Campaigns · NPD master · MIS' },
  { role: 'Finance / Management', coNav: 'Implemented ideas · NPD master · MIS', inNav: 'NPD master · MIS' },
  { role: 'Admin', coNav: 'Execution Hub · Implemented ideas · NPD master · MIS', inNav: 'Idea Register · Campaigns · NPD master · Admin & Masters · MIS' },
]
export const NAV_NOTE = 'Every role also has Dashboard and Scope & Methodology at the top of both workspaces.'

export const APPROVAL_NOTE = 'The ₹ X threshold is to be confirmed by Amber.'
export const APPROVAL_MATRIX_DOC: [string, string][] = [
  ['Up to ₹ X lakh', 'Commodity Lead'],
  ['Above ₹ X lakh', 'Commodity Lead → Sourcing Head'],
]

// ─── Supplier campaigns (IN) ────────────────────────────────────────
export const CAMPAIGN_FLOW: { step: string; detail: string; icon: string }[] = [
  { step: 'Auto-email', detail: "Template email to a commodity's vendors", icon: 'Send' },
  { step: 'Improvement workshop', detail: 'Optional workshop with Amber', icon: 'Presentation' },
  { step: 'Commodity-wise', detail: 'One drive per commodity code', icon: 'Boxes' },
  { step: 'Submit ideas', detail: 'Open or specific parts, via the Supplier Portal', icon: 'Lightbulb' },
  { step: 'Approval', detail: 'Normal route and approval matrix', icon: 'Stamp' },
  { step: 'NPD till sample stage', detail: 'Technical ideas go to NPD up to sample approval', icon: 'TestTubes' },
]
export const CAMPAIGN_POINTS = [
  'Suppliers do not log into COIN for campaigns: they receive an email and reply through the external Supplier Portal. Each reply is shown in COIN marked "via Supplier Portal", with type (idea, problem, complaint), scope (open idea or specific parts) and status (New, Under review, Converted to idea, Closed).',
  'Dashboard: emails sent, suppliers reached, replies received, reply rate and ideas converted, a "sent vs replies" chart of the last 8 campaigns, recent campaigns, latest replies and upcoming workshops.',
  'New campaign wizard in four steps: Details (name, type — supplier idea drive, improvement workshop or reminder — workshop date, reply-by date), Recipients (commodity codes, then vendors), Email (template with live preview), Review & send.',
  'Email templates: a gallery with add, edit and duplicate; placeholders such as {{supplierName}}, {{commodity}}, {{workshopDate}}, {{portalLink}} and {{replyBy}} are filled per vendor.',
  'Workshops & drives: campaigns and workshops with commodity, dates, venue, invited suppliers and internal invitees; launching sends the invites, and attendance, idea yield and conversion are tracked.',
  'A reply of type idea can be converted with one click: the Submit Idea form opens pre-filled and the reply is marked "Converted to idea".',
]

// ─── NPD development master (CO) ──────────────────────────────────────────────
const npdWithSpoc = NPD_COMMODITIES.filter((c) => Object.keys(c.spoc).length > 0).length
const npdWithDays = NPD_COMMODITIES.filter((c) => c.perfDays != null || c.relDays != null).length
const importGroups = VENDOR_GROUPS.filter((g) => g.kind === 'Import').length
export const NPD_INTRO =
  `The NPD development master is imported from the ${NPD_SOURCE.system} (Vendor Management System) extract "${NPD_SOURCE.file}" and shown read-only on the NPD master page. It is maintained in ${NPD_SOURCE.system} and cannot be edited in COIN. Ideas on an NPD route use it to find the development SPOC and the testing schedule up to the sample stage.`
export const NPD_CONTENTS: [string, string][] = [
  ['Commodity codes', `${NPD_COMMODITIES.length} codes with names; ${npdWithSpoc} have SPOCs assigned`],
  ['Development SPOC', NPD_SPOC_COLUMNS.filter((c) => c.group === 'Development SPOC').map((c) => (c.plant === 'Corporate' || c.plant === 'All plants' ? c.label : `${c.label} ${c.plant}`)).join(' · ')],
  ['DQA SPOC', 'One DQA SPOC per commodity, for all plants'],
  ['Testing days', `Performance and reliability testing days per commodity; ${npdWithDays} of ${NPD_COMMODITIES.length} codes carry them in the current extract`],
  ['Vendor groups', `${VENDOR_GROUPS.length} groups: ${VENDOR_GROUPS.length - importGroups} domestic, ${importGroups} import`],
  ['Payment methods', PAYMENT_METHODS.join(' · ')],
]
export const NPD_USE = [
  "On a Technical or Supplier-change idea, the NPD sample stage takes the development SPOC for the idea's plant / product line and commodity, and the DQA SPOC for sample approval.",
  'Performance and reliability testing days set the expected duration up to sample approval, which the owner uses for milestones and the due date.',
  `The master is refreshed from ${NPD_SOURCE.system}; the page shows the last sync time. Corrections are made in ${NPD_SOURCE.system}, not in COIN.`,
]

// ─── Execution and realisation (CO) ─────────────────────────────────────
export const EXECUTION_INTRO =
  'Every approved idea enters the Execution Hub with an owner, a start date equal to its approval date and a due date of 31 March, and stays there until it is marked Done or Dropped with a reason.'
export const EXECUTION_RECORD: [string, string][] = [
  ['Idea owner', 'Commodity Buyer by default; reassignable by Commodity Lead'],
  ['Start date', 'Auto = approval date'],
  ['Due date', 'Default 31 March of current FY; editable, each change needs a reason and is logged as slippage'],
  ['Quarter phasing', 'Owner enters expected saving per quarter (Q1–Q4); the system pre-fills from due date and annualised impact'],
  ['Milestones', 'Generated from the route, e.g. Technical: Supplier sample → NPD ECN raised → Sample approved → PAP price approved → First MRN at new price'],
  ['Linked requests', 'NPD request ID and PAP request ID, status synced'],
  ['Health', 'On track / At risk (milestone overdue) / Delayed (due date passed), shown as a coloured badge'],
]
export const EXECUTION_SCREEN = [
  'Top strip: ideas in execution (count, ₹ committed), due this month, overdue, at risk, done this month, dropped this month. The filter bar narrows every view.',
  'Main view toggles between a table and a quarter timeline (each idea as a bar from start to due date, milestones as dots); the table shows the next reminder date for each idea.',
  'Row actions: Update progress, Add milestone note, Change due date (reason logged), Mark Done, Drop, Reassign.',
  'Mark Done needs the effective date and the approved new price (auto-pulled from PAP when linked).',
  'Drop needs a reason code and remarks; the committed value is removed from committed savings and the drop is counted in its month.',
  'Side cards list recently done / dropped ideas and the slippage log.',
]
export const DROP_REASONS_DEFAULT = [
  'Supplier not feasible',
  'Sample failed (R&D / DQA)',
  'Customer / OEM approval not received',
  'Price not agreed',
  'Volume dropped or part discontinued',
  'Investment not approved',
  'Duplicate idea',
  'Superseded by another idea',
  'Other (remarks mandatory)',
]
export const REALISATION_CYCLE = [
  "On the 3rd working day of each month, COIN takes the previous month's MRN quantity and price for every implemented part code.",
  'It computes realised saving per part as (baseline − approved price) × MRN quantity and posts it to the realisation ledger.',
  'It flags exceptions: MRN price above the approved new price (price leakage), no MRN received, or volume below 50% of plan.',
  "Finance validates or queries each idea's month; validated amounts are reported as realised savings.",
  'The monthly Cost Optimisation Report is generated and emailed.',
  'At FY close (31 March), open ideas roll into the next FY with a new due date, and carry-over is booked.',
]
export const REALISATION_IN_APP = [
  'CO Dashboard: the "Realised savings" tile splits validated from pending, and the implementation pipeline card charts realised savings by month (Finance validated vs pending validation).',
  'IN Dashboard for Finance: the "Savings to validate" card lists pending months with their SLA, the exceptions found and any lines queried back to buyers.',
  'CO Advanced analytics: savings trend, realisation rate (realised ÷ committed) and quarter phasing.',
  'MIS: report 11 "Realisation & leakage" and report 12 "FY closure & carry-over"; the Monthly mailer tab sends the report manually and keeps the sent history.',
  'Idea 360: the value card shows estimated vs approved vs realised for the idea.',
]
export const REALISATION_DEMO_NOTE =
  'In this build the realisation ledger is pre-loaded with demo MRN data. Posting a month and the Finance validate / query action are not run from a screen; the validation status is shown everywhere above.'
export const LEAKAGE_NOTE =
  'Price leakage (paying above the agreed new price) is shown on the Execution Hub and the CO dashboards, because a saving that is agreed but not paid at the new price is not a saving.'

// ─── KPIs (ids are referenced by dashboards and reports) ──────────
export const KPIS: { id: string; group: string; kpi: string; formula: string; cut: string }[] = [
  { id: 'A2', group: 'A. Savings', kpi: 'Savings % of spend', formula: 'Realised savings ÷ addressable spend', cut: 'Commodity, commodity group' },
  { id: 'A3', group: 'A. Savings', kpi: 'Pipeline value', formula: 'Σ annualised impact of ideas in Pipeline', cut: 'Commodity, category' },
  { id: 'A4', group: 'A. Savings', kpi: 'Committed value', formula: 'Σ FY-phased saving of ideas In Execution', cut: 'Quarter, commodity' },
  { id: 'A5', group: 'A. Savings', kpi: 'Realised value', formula: 'Σ MRN-based saving (FY to date)', cut: 'Month, commodity, supplier' },
  { id: 'A9', group: 'A. Savings', kpi: 'Carry-over', formula: 'Annualised impact falling beyond 31 March', cut: 'Commodity' },
  { id: 'B1', group: 'B. Funnel', kpi: 'Ideas by stage', formula: 'Count and ₹ per stage', cut: 'All' },
  { id: 'B2', group: 'B. Funnel', kpi: 'Conversion rate', formula: 'Implemented ÷ submitted (and each stage-to-stage step)', cut: 'Category, commodity' },
  { id: 'B3', group: 'B. Funnel', kpi: 'Drop rate and reasons', formula: 'Dropped ÷ submitted; top reasons, month-wise', cut: 'Reason, stage, commodity' },
  { id: 'B4', group: 'B. Funnel', kpi: 'Idea ageing', formula: 'Days in current stage; count beyond SLA', cut: 'Stage, owner' },
  { id: 'C1', group: 'C. Speed', kpi: 'Idea-to-approval cycle time', formula: 'Avg days submission → approval', cut: 'Category, route' },
  { id: 'C2', group: 'C. Speed', kpi: 'Approval-to-implementation cycle time', formula: 'Avg days approval → Done', cut: 'Category, route' },
  { id: 'C3', group: 'C. Speed', kpi: 'Stage bottleneck', formula: 'Avg days per stage (R&D, NPD sample, PAP)', cut: 'Stage' },
  { id: 'D1', group: 'D. Execution', kpi: 'On-time implementation %', formula: 'Done by original due date ÷ Done', cut: 'Buyer, commodity' },
  { id: 'D2', group: 'D. Execution', kpi: 'Overdue value', formula: '₹ committed on ideas past due date', cut: 'Buyer' },
  { id: 'D3', group: 'D. Execution', kpi: 'Realisation rate', formula: 'Realised ÷ committed for the period', cut: 'Commodity, buyer' },
  { id: 'D4', group: 'D. Execution', kpi: 'Price leakage', formula: '₹ lost where MRN price > approved new price', cut: 'Supplier, part' },
  { id: 'E1', group: 'E. Mix', kpi: 'Savings by category', formula: 'Share of realised saving per category (flags heavy dependence on negotiation)', cut: 'Category' },
  { id: 'E2', group: 'E. Mix', kpi: 'Structural savings share', formula: '(VA/VE + material + localisation) ÷ total realised', cut: 'Commodity' },
  { id: 'F1', group: 'F. Network', kpi: 'Supplier participation %', formula: 'Top-N suppliers by spend who submitted ≥ 1 idea ÷ N', cut: 'Commodity' },
  { id: 'F2', group: 'F. Network', kpi: 'Idea yield per campaign / workshop', formula: 'Ideas, ₹ value and conversion per campaign', cut: 'Campaign' },
  { id: 'F3', group: 'F. Network', kpi: 'Ideas by department', formula: 'Count and ₹ by submitting department', cut: 'Department' },
]
export const KPI_INTRO =
  `COIN tracks ${KPIS.length} KPIs in six groups; the first group measures savings in the pipeline, committed and realised, and the other five explain how ideas move and deliver.`
export const STRUCTURAL_NOTE =
  'Structural savings share matters because negotiated savings rarely repeat next year, while engineering and localisation savings keep paying; a healthy portfolio grows this share every year.'

// ─── dashboards, MIS and the monthly mailer ───────────────────────
export const DASHBOARDS_INTRO =
  'Each workspace opens on a Dashboard that fits one screen, with an "Advanced analytics" pill for depth. Submitter, Supplier and Technical Evaluator get their own home in IN. Dashboards have no filter bar: they show the user\'s own scope, and every card drills down to the ideas behind it.'
export const DASHBOARDS: { space: string; view: string; who: string; contents: string }[] = [
  { space: 'Entry', view: 'After login', who: 'All roles', contents: 'Four status cards (Pipeline, In Execution, Implemented, Dropped — count and ₹) and the choice of CO or IN, each with its headline numbers' },
  { space: 'CO', view: 'Dashboard', who: 'All roles', contents: 'Implementation KPIs (In Execution ₹ committed, Implemented ₹ annualised, Realised FY to date with validated / pending, Overdue / at risk); implementation pipeline (NPD sample → PAP price / source → internal execution → implemented) with realised savings by month; execution health with the next due and overdue list' },
  { space: 'CO', view: 'Advanced analytics', who: 'All roles', contents: 'Savings trend by month; realisation; quarter phasing; implementation by category; top implemented ideas; commodity overview with realised savings and price leakage' },
  { space: 'IN', view: 'Dashboard', who: 'Buyer, Commodity Lead, Sourcing Head, Admin, Finance, Management', contents: 'Four status cards; Idea portfolio donut with a Value / Ideas toggle; SLA watch by review stage (Finance sees Savings to validate instead). Management also gets a Monthly report button' },
  { space: 'IN', view: 'Advanced analytics', who: 'Same roles', contents: 'Savings trend by month; funnel by stage; top 5 ideas by value; category mix; commodity overview (top 6); contributor leaderboard, or the realisation card for Finance or when the leaderboard is hidden' },
  { space: 'IN', view: 'Submitter home', who: 'Submitter', contents: 'My ideas by status (count and ₹); submit-idea banner; my recent ideas with live stage tracker, conversion and realised to date; My actions; open campaigns' },
  { space: 'IN', view: 'Supplier home', who: 'Supplier', contents: 'Workshop invites, feasibility requests, my ideas and average gain-share offered; my ideas with status; workshop invites (accept, decline, submit an idea); pending feasibility requests' },
  { space: 'IN', view: 'Evaluator home', who: 'Technical Evaluator', contents: 'Awaiting evaluation, beyond SLA, evaluated by me, go rate and average turnaround; ideas routed to my department sorted by SLA; my evaluated ideas; ideas I submitted' },
]

export const REPORTS_INTRO =
  'MIS holds twelve standard reports for every audience, a KPI library, the monthly mailer and the scheduled-email list; the Monthly Cost Optimisation Report goes to management automatically, with no manual MIS.'
export const REPORTS: { n: number; key: string; name: string; audience: string; visuals: string; frequency: string }[] = [
  { n: 1, key: 'home', name: 'Sourcing summary', audience: 'Sourcing team', visuals: 'Savings summary, funnel, monthly savings trend', frequency: 'Live' },
  { n: 2, key: 'bridge', name: 'Savings bridge', audience: 'Sourcing Head, Management', visuals: 'Waterfall: realised → committed → pipeline → total tracked', frequency: 'Live / monthly' },
  { n: 3, key: 'commodity', name: 'Commodity scorecard', audience: 'Commodity Leads', visuals: 'Realised, committed, pipeline, conversion per commodity', frequency: 'Live' },
  { n: 4, key: 'buyer', name: 'Buyer scorecard', audience: 'Sourcing Head', visuals: 'Realised, committed, on-time %, overdue ₹, ageing per buyer', frequency: 'Live / monthly' },
  { n: 5, key: 'supplier', name: 'Supplier innovation scorecard', audience: 'Sourcing, supplier reviews', visuals: 'Ideas, value, conversion, gain-share, leakage per supplier', frequency: 'Quarterly' },
  { n: 6, key: 'lever', name: 'Category mix', audience: 'Sourcing Head', visuals: 'Realised savings by category; structural share trend', frequency: 'Monthly' },
  { n: 7, key: 'execution', name: 'Execution Hub dashboard', audience: 'Owners, Leads', visuals: 'Timeline, health badges, due / overdue', frequency: 'Live' },
  { n: 8, key: 'drops', name: 'Drop analysis', audience: 'Sourcing Head', visuals: 'Month-wise drops by reason and stage', frequency: 'Monthly' },
  { n: 9, key: 'ageing', name: 'Ageing & SLA breach', audience: 'Commodity Leads', visuals: 'Ideas beyond SLA by stage and owner', frequency: 'Weekly' },
  { n: 10, key: 'campaign', name: 'Campaign effectiveness', audience: 'Sourcing Excellence', visuals: 'Yield, value, conversion per campaign / workshop', frequency: 'Per campaign' },
  { n: 11, key: 'leakage', name: 'Realisation & leakage', audience: 'Finance, Sourcing Head', visuals: 'Committed vs realised, Finance validation status, price leakage by supplier', frequency: 'Monthly' },
  { n: 12, key: 'closure', name: 'FY closure & carry-over', audience: 'Management, Finance', visuals: 'FY realised and committed savings, carry-over into next FY', frequency: 'Annual' },
]
export const REPORTS_NOTE = 'Every chart is clickable through to the idea list behind it, and every report exports to Excel and PDF with the active filters from the MIS filter bar.'
export const MAILER: [string, string][] = [
  ['Trigger', 'Automatically after the monthly realisation run (3rd working day), or sent manually from MIS → Monthly mailer'],
  ['Recipients', 'Configurable management distribution list; each Commodity Lead also receives a commodity cut'],
  ['Subject', 'COIN — Cost Optimisation Report, <Month YYYY>'],
  ['Body', '"PFA, Cost Optimisation Report" + 4 headline numbers: realised to date, committed (remaining), pipeline, month\'s realised saving'],
  ['Attachments', 'PDF summary (savings bridge, commodity table, top 10 ideas, drops with reasons) + Excel detail'],
  ['Link', "Opens the live dashboard with the same month's filter"],
]

// ─── emails, reminders and escalations ────────────────────────────
export const NOTIF_INTRO =
  'COIN sends an email at the hand-offs that leave the system — to the buyer, to suppliers and to management — and measures every review stage against an SLA, so reminders and escalations are visible on screen.'
export const NOTIF_TRIGGERS: { trigger: string; recipient: string; channel: string; timing: string; space: DocSpace; critical?: boolean }[] = [
  { trigger: 'Monthly Cost Optimisation Report', recipient: 'Management list; commodity cut to each Commodity Lead', channel: 'Email + PDF and Excel', timing: 'After the monthly realisation run (3rd working day), or sent manually', space: 'CO' },
  { trigger: 'New idea submitted', recipient: 'Commodity Buyer of the commodity', channel: 'Email', timing: 'On submission', space: 'IN' },
  { trigger: 'Feasibility requested', recipient: 'Supplier contact', channel: 'Email with 7-day secure link', timing: 'When the idea reaches a supplier confirmation or feasibility stage', space: 'IN' },
  { trigger: 'Campaign / workshop invitation', recipient: 'Invited suppliers and internal invitees', channel: 'Email', timing: 'When a workshop or drive is launched', space: 'IN' },
  { trigger: 'Supplier campaign email', recipient: 'Vendors chosen in the New campaign wizard', channel: 'Email from the chosen template, personalised per vendor', timing: 'On send; reminder campaigns use the Reminder template', space: 'IN' },
]
export const REMINDERS_ON_SCREEN: { text: string; space: DocSpace }[] = [
  { text: "The Execution Hub shows each idea's next implementation reminder: every 15 days, weekly in the last 30 days before the due date, and the day after the due date then weekly.", space: 'CO' },
  { text: 'Overdue and at-risk executions are counted on the CO Dashboard and the Execution Hub, with the committed ₹ exposed.', space: 'CO' },
  { text: 'SLA watch (IN Dashboard) and My actions show each idea in a review stage as Within SLA, Reminder due, Breached or Escalated, from the stage SLA rules below.', space: 'IN' },
]
export const SLA_DEFAULTS: { stage: string; slaDays: number; reminderDay: number; escalateTo: string; escalateDay: number }[] = [
  { stage: 'Buyer validation', slaDays: 5, reminderDay: 4, escalateTo: 'Commodity Lead', escalateDay: 6 },
  { stage: 'Supplier feasibility', slaDays: 7, reminderDay: 5, escalateTo: 'Buyer', escalateDay: 8 },
  { stage: 'Technical evaluation', slaDays: 10, reminderDay: 8, escalateTo: "Evaluator's HOD + Commodity Lead", escalateDay: 11 },
  { stage: 'Approval', slaDays: 3, reminderDay: 2, escalateTo: 'Sourcing Head', escalateDay: 4 },
  { stage: 'Finance validation', slaDays: 5, reminderDay: 4, escalateTo: 'Finance Head', escalateDay: 6 },
]
export const NOTIF_FOOTNOTE =
  'Reminder and escalation dates are calculated and shown on screen; this build does not send them as separate emails. In the demo every email is written to the in-app email log rather than delivered.'

// ─── integrations ─────────────────────────────────────────────────
export const INTEGRATION_INTRO =
  'COIN reads prices, volumes and vendors from existing systems rather than asking users to type them, and it hands technical ideas to NPD and price changes to PAP so no workflow is duplicated.'
export const INTEGRATIONS: { system: string; data: string; direction: string; use: string; space: DocSpace }[] = [
  { system: 'ERP', data: 'Part master, UoM, commodity mapping', direction: 'Into COIN', use: 'Part search, auto-fill', space: 'Both' },
  { system: 'ERP', data: 'MRN quantity, price, supplier, date', direction: 'Into COIN', use: 'Annual volume (last FY) and monthly realisation', space: 'Both' },
  { system: 'ERP', data: 'Open PO price', direction: 'Into COIN', use: 'Baseline when no LBP exists', space: 'IN' },
  { system: 'VMS (Vendor Management System)', data: 'NPD development master: commodity codes, development and DQA SPOCs, testing days, vendor groups, payment methods ("npd data.xlsx")', direction: 'Into COIN', use: 'Read-only NPD master; SPOC and testing schedule for NPD-route ideas', space: 'CO' },
  { system: 'VMS (Vendor Management System)', data: 'Vendor code, name, commodity, contact email', direction: 'Into COIN', use: 'Supplier selection, campaign recipients, workshop invites', space: 'IN' },
  { system: 'Price Approval Portal (PAP)', data: 'Price revision request and its approval', direction: 'Both ways', use: 'COIN raises the request; approved price closes the idea', space: 'CO' },
  { system: 'Price Approval Portal (PAP)', data: 'Last buying price', direction: 'Into COIN', use: 'Baseline price', space: 'IN' },
  { system: 'NPD Platform', data: 'ECN / NCD request for technical ideas', direction: 'Out of COIN', use: 'Sampling and validation', space: 'CO' },
  { system: 'NPD Platform', data: 'Sample status (submitted, approved, failed)', direction: 'Into COIN', use: 'Execution milestones', space: 'CO' },
  { system: 'Supplier Portal (external)', data: 'Supplier replies: ideas, problems, complaints', direction: 'Into COIN', use: 'Campaign responses shown "via Supplier Portal"; Sync now', space: 'IN' },
  { system: 'Email (SMTP)', data: 'Monthly report, idea and feasibility emails, campaign emails, invitations', direction: 'Out of COIN', use: 'Communication', space: 'Both' },
  { system: 'Single sign-on / AD', data: 'Employee identity, department, plant', direction: 'Into COIN', use: 'Login and auto-fill', space: 'Both' },
]
export const INTEGRATION_FALLBACK =
  'If an interface is not ready at go-live, COIN accepts a monthly Excel upload for MRN and LBP in the same format, so realisation is never blocked.'

// ─── UI/UX ────────────────────────────────────────────────────────
export const UI_INTRO =
  'COIN should feel like a working cockpit for buyers: dense, colourful where colour carries meaning, and responsive to every click, not a pale form floating in empty space.'
export const UI_PRINCIPLES: { area: string; principle: string }[] = [
  { area: 'Two workspaces', principle: 'CO for execution after approval, IN for the idea network; the sidebar shows one workspace at a time, with a switcher in its header' },
  { area: 'One-screen dashboards', principle: 'The Dashboard pill fits a laptop screen with no inner scrolling; deeper charts sit under Advanced analytics' },
  { area: 'Forms', principle: 'Collapsible steps with a fixed summary panel; fields appear only when relevant' },
  { area: 'Live feedback', principle: 'Savings recalculate as the user types, with a % badge and colour for positive or negative saving' },
  { area: 'Type and density', principle: '13–14 px body, 12 px labels, 36 px inputs; compact or comfortable tables set in Admin' },
]
export const UI_COLOURS: [string, string][] = [
  ['Pipeline', 'Blue'],
  ['In Execution', 'Amber / orange'],
  ['Implemented', 'Green'],
  ['Dropped', 'Grey'],
  ['Overdue / leakage / negative saving', 'Red'],
  ['Category groups', 'Distinct icon + tint per group (Commercial, Supply base, Engineering, Logistics & packing, Operational)'],
]
export const UI_LAYOUT = [
  'Spacing on an 8 px grid; card padding 16 px; gap between cards 12–16 px. No section taller than its content.',
  'Content uses the full width; tables and dashboards never sit in a narrow centre column.',
  'Compact table rows with a compact / comfortable setting.',
  'Collapsible left navigation with icons, so power users gain screen width.',
]
export const UI_INTERACTIVITY = [
  'Status cards show count, ₹ and a 3-month trend; a click opens the ideas behind them.',
  'Every chart segment drills down to the ideas behind it.',
  'Kanban board with drag-and-drop stage moves (permission-checked).',
  'Side-panel review: open an idea from any list without losing your place.',
  'Execution Hub row actions for progress, due date (with reason), quarter phasing and owner.',
  'Live stage tracker on each idea (stepper with dates and who acted).',
  'Global search (Ctrl + K) across ideas, parts, suppliers, campaigns and pages.',
  'Toasts for every action, with undo on non-final actions.',
  'Skeleton loaders instead of blank screens; empty states with a clear next action (e.g. "No ideas yet — submit the first idea for Fasteners").',
  'A subtle celebration when an idea is marked Implemented, and a contributor leaderboard in IN Advanced analytics to reward participation.',
  'Hover tooltips explaining every KPI and formula.',
]
export const UI_RESPONSIVE =
  'Screens reflow down to phone width: dashboards become single-column cards, and the submission form keeps its savings summary in a bottom bar, so approvers and suppliers can act from their phones.'

// ─── NFRs ─────────────────────────────────────────────────────────
export const NFRS: [string, string][] = [
  ['Access control', 'Role- and commodity-based access; suppliers see only their own ideas and requests'],
  ['Audit trail', 'Every create, stage change, value edit, override, date change and approval logged with user, time, old and new value'],
  ['Data integrity', 'Approved values are locked; changes after approval need a change reason and re-approval above a set %'],
  ['Performance', 'Pages load within 2 seconds for up to 5,000 ideas per FY; dashboards within 3 seconds'],
  ['Availability', '99.5% during business hours'],
  ['Attachments', 'Up to 10 files per idea, 10 MB each; images, PDF, Excel, CAD-export PDF'],
  ['Financial year', 'April–March, configurable; reports switch FY and quarter from one selector'],
  ['Currency and units', 'INR with lakh / crore formatting; part-level UoM from part master'],
  ['Export', 'Every list and report exports to Excel; reports to PDF'],
  ['Browser and device', 'Latest Chrome and Edge; responsive down to 375 px for approvals and supplier actions'],
  ['Backup', 'Daily backup with 30-day retention'],
  ['Security', 'HTTPS only; supplier links are time-bound; session timeout after 30 minutes of inactivity'],
  ['Demo data', "The demo keeps all data in the browser's localStorage (zustand persist): changes survive a reload but stay on that browser. \"Reset demo data\" in the user menu and in Admin → Data restores the seed; Admin → Data also exports and imports a full backup."],
]

// ─── Out of scope, assumptions, decisions ───────────────────────────────────────────────────────────────
export const OUT_OF_SCOPE = [
  'Settlement or payment of supplier gain-share (captured as a field only).',
  'Should-cost modelling; existing cost engines can be linked in a later phase.',
  'Reward or incentive payout processing (leaderboard only).',
  'The Supplier Portal itself; COIN reads the replies it collects.',
  'Changes to NPD or PAP workflows beyond the integration touchpoints listed under Integrations.',
  'Spend analytics beyond what is needed for savings % of spend.',
]
export const ASSUMPTIONS = [
  'ERP provides MRN, part master and PO price through an interface or a monthly extract.',
  'VMS is the single source of vendor codes, contact emails and the NPD development master.',
  'The external Supplier Portal collects supplier replies and makes them available to COIN.',
  'Cost avoidance and one-time savings are tracked but reported separately from hard savings.',
  'Finance validation of realised savings is switched on at go-live.',
  'The demo build stores data in the browser (localStorage) and logs emails instead of sending them; production uses a server database and SMTP.',
]
export const DECISIONS: { n: number; decision: string; proposed: string }[] = [
  { n: 1, decision: 'Meaning and route of the "Strategic masking" category', proposed: 'To be defined by Sourcing' },
  { n: 2, decision: 'Finance validation before realised savings are reported', proposed: 'Yes' },
  { n: 3, decision: 'Baseline rule for parts with no LBP and new parts', proposed: 'Current PO price; quoted price for new parts' },
  { n: 4, decision: 'Approval threshold ₹ X (above it the Sourcing Head also approves)', proposed: 'To be set by Sourcing Head' },
  { n: 5, decision: 'Cost avoidance counted in realised savings', proposed: 'No, reported separately' },
  { n: 6, decision: 'Supplier access route', proposed: 'Campaign replies through the Supplier Portal; time-bound secure links for feasibility' },
  { n: 7, decision: 'Who can submit ideas', proposed: 'All employees + registered suppliers' },
  { n: 8, decision: 'Plant / BU split for reports', proposed: 'Yes' },
  { n: 9, decision: 'Leaderboard visible to all users', proposed: 'Yes, top 10 contributors per quarter' },
  { n: 10, decision: 'Stage SLAs (Emails, reminders and escalations)', proposed: 'As proposed' },
]
