// COIN — core domain types (Scope of Work v1.0)

export type RoleKey =
  | 'submitter'
  | 'supplier'
  | 'buyer'
  | 'lead'
  | 'head'
  | 'finance'
  | 'mgmt'
  | 'admin'
  // department ladder (stages 2–5); every department has one of each
  | 'teamlead'
  | 'deptlead'
  | 'depthead'
  | 'execowner'

export type Department = 'R&D' | 'DQA' | 'Quality' | 'Process' | 'Production' | 'Sourcing' | 'Finance' | 'HR' | 'Management' | 'Sourcing Excellence' | 'Supplier'

export type BuyingType = 'Direct' | 'Indirect'
export type IdeaScope = 'Open' | 'Part-specific'
export type SavingsType = 'Hard' | 'Cost avoidance' | 'One-time'
export type RouteKey = 'Commercial' | 'Supplier change' | 'Technical' | 'Internal' | 'To be confirmed'
export type LeverGroup = 'Commercial' | 'Supply base' | 'Engineering' | 'Logistics & packing' | 'Operational'
export type Bucket = 'Draft' | 'Pipeline' | 'In Execution' | 'Implemented' | 'Dropped'
export type Health = 'On track' | 'At risk' | 'Delayed'

export interface User {
  id: string
  name: string
  employeeId: string
  email: string
  password: string
  roles: RoleKey[]
  department: Department
  plant: string
  designation: string
  commodities: string[] // commodity codes mapped; empty + org-wide role = all
  supplierCode?: string
  avatarColor: string
  active: boolean
}

export interface Lever {
  id: string
  group: LeverGroup
  name: string
  savingsType: string // 'Hard' | 'One-time' | 'Hard / Avoidance' ...
  defaultSavingsType: SavingsType
  route: RouteKey
  evaluator: string // '—' | 'R&D' | 'R&D + DQA' ...
  npdSample: string // 'No' | 'Yes' | 'Yes (supplier qualification)' | 'Trial only' | 'To be confirmed'
  icon: string // lucide icon name
  active: boolean
}

export interface Category { id: string; name: string; buyingType: BuyingType }
export interface Commodity { code: string; name: string; categoryId: string; target: number /* FY target ₹ */; buyerId: string; leadId: string; addressableSpend: number }
export interface Plant { id: string; name: string; bu: string }

export interface Supplier {
  code: string
  name: string
  commodities: string[]
  contactEmail: string
  contactName: string
  city: string
  spend: number // last FY spend ₹
  tier?: 'Tier 1' | 'Tier 2'
}

export interface Part {
  code: string
  description: string
  uom: string
  commodity: string
  supplierCode: string
  lbp: number | null // last buying price
  poPrice: number
  lastFyMrnQty: number
  plant: string
}

export interface IdeaPart {
  partCode: string
  description: string
  uom: string
  currentSupplier: string // "V10021 · Sunrise Fasteners"
  baselinePrice: number
  baselineSource: 'LBP' | 'PO price' | 'Quoted' | 'Override'
  baselineOverrideReason?: string
  newPrice: number
  approvedPrice?: number
  annualVolume: number
  volumeSource: 'MRN FY26' | 'Forecast' | 'Override'
  volumeOverrideReason?: string
}

export interface Attachment { id: string; name: string; size: number; type: string; dataUrl?: string; /** api mode: stored on the server, served from this link */ url?: string; uploadedAt: string; by: string }

export interface ActivityEntry {
  id: string
  at: string
  userId: string
  userName: string
  action: string
  field?: string
  oldValue?: string
  newValue?: string
  remarks?: string
}

export interface StageHistory {
  stage: string
  enteredAt: string
  exitedAt?: string
  by?: string
  action?: string
  remarks?: string
}

export type RiskLevel = 'Low' | 'Medium' | 'High'
export interface RiskItem { key: string; label: string; level: RiskLevel; costAtRisk: number; note?: string }

export interface Comment { id: string; at: string; userId: string; userName: string; text: string; mentions: string[] }

export interface Milestone { id: string; name: string; dueDate: string; doneDate?: string; note?: string }

export interface Execution {
  ownerId: string
  startDate: string
  targetDate: string
  originalTargetDate: string
  phasing: { Q1: number; Q2: number; Q3: number; Q4: number }
  milestones: Milestone[]
  slippage: { at: string; by: string; oldDate: string; newDate: string; reason: string }[]
  progress: number
  notes: { at: string; by: string; text: string }[]
  status: 'In Execution' | 'Done' | 'Dropped'
  effectiveDate?: string
  approvedPrice?: number
}

export interface Feasibility {
  requestedAt: string
  supplierCode: string
  respondedAt?: string
  respondedBy?: string
  feasible?: boolean
  offeredPrice?: number
  leadTimeDays?: number
  moq?: number
  remarks?: string
  onBehalf?: boolean
}

// ─── Six-stage workflow records (stage 2 → 6) ────────────────────────────────
/** Stage 2 — Team feasibility check: four checks by the feasibility team */
export interface FeasibilityCheck {
  technical: 'Yes' | 'No'
  technicalNote?: string
  cost: 'Valid' | 'Not valid'
  costNote?: string
  conflict: 'None' | 'Duplicate' | 'Conflict'
  conflictWith?: string
  conflictNote?: string
  decision: 'Go' | 'No-go'
  departments: string[]
  remarks?: string
  by: string
  byDept: string
  at: string
}

/** Stage 3 — supplier capability check (email + public form, no Amber data) */
export interface SupplierCheck {
  status: 'Not sent' | 'Sent' | 'Responded' | 'Skipped'
  token?: string
  supplierCode?: string
  supplierName?: string
  contactName?: string
  email?: string
  subject?: string
  body?: string
  sentAt?: string
  sentBy?: string
  item?: string
  spec?: string
  requiredBy?: string
  skippedReason?: string
  response?: {
    canSupply: 'Yes' | 'Partly' | 'No'
    meetsSpec: 'Yes' | 'With deviation' | 'No'
    capacityPerMonth?: string
    leadTimeDays?: number
    indicativePrice?: number
    certifications?: string
    remarks?: string
    contactName: string
    respondedAt: string
  }
}

/** Stage 3 — <dept> evaluation: cost-benefit, risk, supplier capability, decision */
export interface Evaluation {
  dept: string
  cbaVerified?: boolean
  cbaNote?: string
  risks?: RiskItem[]
  riskRemarks?: string
  supplier?: SupplierCheck
  decision?: 'Recommend' | 'Reject'
  remarks?: string
  by?: string
  at?: string
}

/** Stage 4 — <dept> approval: commercial assessment, supplier alignment, signed budget + timeline lock */
export interface ApprovalLock {
  commercialOk: boolean
  supplierAligned: 'Confirmed' | 'Skipped' | 'Not confirmed'
  budget: number
  timelineMonths: number
  startDate: string
  endDate: string
  targetSaving: number
  signatureName: string
  signatureData?: string
  signedAt: string
  signedBy: string
}

/** Stage 6 — Verification: business side confirms the target was achieved */
export interface Verification {
  handedAt?: string
  handedBy?: string
  mrnAtApproved?: boolean
  financeValidated?: boolean
  targetAchieved?: boolean
  realisedAtVerification?: number
  targetAtVerification?: number
  verifiedAt?: string
  verifiedBy?: string
  remarks?: string
  returnedAt?: string
  returnReason?: string
}

export interface Idea {
  id: string // COIN-FY27-FAS-0012
  seq: number
  fy: string // FY27
  title: string
  currentState: string
  proposedChange: string
  evidence: string
  evidenceTags: string[]
  attachments: Attachment[]

  submitterId: string
  submitterName: string
  employeeId: string
  department: string
  plant: string
  buyingType: BuyingType
  categoryId: string
  commodity: string // commodity code
  leverId: string
  scope: IdeaScope
  campaignId?: string

  parts: IdeaPart[]
  proposedSupplier?: { code?: string; name: string; isNew: boolean }
  savingsType: SavingsType
  oneTimeInvestment: number
  expectedQuarter: string // "Q3 FY27"
  openEstimateLakh?: number
  gainSharePct?: number
  offerValidity?: string
  isSupplierSubmission: boolean
  supplierCode?: string

  route: RouteKey
  stage: string
  bucket: Bucket
  stageEnteredAt: string
  createdAt: string
  submittedAt?: string
  approvedAt?: string
  implementedAt?: string
  droppedAt?: string
  dropReason?: string
  dropRemarks?: string
  dropStage?: string

  buyerId: string
  ownerId?: string
  approvals: { level: string; approverId?: string; decision?: 'Approved' | 'Rejected'; at?: string; remarks?: string }[]
  stageHistory: StageHistory[]
  activity: ActivityEntry[]
  comments: Comment[]
  feasibility?: Feasibility
  feasibilityCheck?: FeasibilityCheck
  evaluation?: Evaluation
  lock?: ApprovalLock
  verification?: Verification
  /** Change-over (CO) date — when the new price / part / source cuts in on the line */
  coDate?: string
  /** Demo walkthrough idea 1–6 (one per stage) */
  showcase?: number
  execution?: Execution
  npdRequestId?: string
  npdStatus?: 'Not raised' | 'ECN raised' | 'Sample submitted' | 'Sample approved' | 'Sample failed'
  papRequestId?: string
  papStatus?: 'Not raised' | 'Raised' | 'Price approved' | 'Rejected'
  infoRequested?: boolean
  locked?: boolean
}

export interface Campaign {
  id: string
  name: string
  type: 'Campaign' | 'Workshop'
  commodity: string
  categoryId: string
  startDate: string
  endDate: string
  workshopDate?: string
  venue?: string
  suppliers: string[] // supplier codes
  internalInvitees: string[] // user ids
  targetIdeas: number
  targetValue: number // ₹
  status: 'Draft' | 'Live' | 'Closed'
  description: string
  attendance: Record<string, 'Invited' | 'Accepted' | 'Declined' | 'Attended'>
  summary?: string
  createdBy: string
  createdAt: string
  invitesSentAt?: string
}

export interface LedgerEntry {
  id: string
  ideaId: string
  partCode: string
  supplierCode: string
  month: string // YYYY-MM
  mrnQty: number
  plannedQty: number
  mrnPrice: number
  baseline: number
  approvedPrice: number
  realised: number
  leakage: number
  exceptions: ('Price leakage' | 'No MRN received' | 'Volume below 50% of plan')[]
  financeStatus: 'Pending' | 'Validated' | 'Queried'
  financeRemarks?: string
  financeBy?: string
  financeAt?: string
  postedAt: string
}

export interface Notification {
  id: string
  userId: string // recipient
  at: string
  title: string
  body: string
  trigger: string
  channel: string
  ideaId?: string
  link?: string
  read: boolean
  severity: 'info' | 'success' | 'warning' | 'danger'
}

export interface EmailLog {
  id: string
  at: string
  to: string[]
  subject: string
  body: string
  template: string
  attachments?: string[]
}

export interface SlaRule { stage: string; slaDays: number; reminderDay: number; escalateTo: string; escalateDay: number }

export interface ApprovalRule { id: string; condition: string; approver: string; thresholdLakh: number | null; kind: 'value' | 'investment' }

export interface EmailTemplate { id: string; name: string; subject: string; body: string }

export interface SavedView { id: string; name: string; userId: string; filters: Record<string, any>; columns: string[] }

export interface Settings {
  financeValidation: boolean
  xThresholdLakh: number
  yThresholdLakh: number
  fyStartMonth: number // 4 = April
  currentFy: string
  reapprovalPct: number
  sessionTimeoutMin: number
  mailerRecipients: string[]
  leaderboardVisible: boolean
  density: 'compact' | 'comfortable'
  lastRealisationMonth: string // YYYY-MM
}

export interface EmailPrefs { mutedTriggers: string[]; dailyDigest: boolean }

export interface Filters {
  fy: string
  quarter: string // 'All' | 'Q1'..'Q4'
  plant: string
  categoryId: string
  commodity: string
  buyerId: string
  leverId: string
  buyingType: string
}

// ─── Supplier outreach by email (suppliers never log in; they reply via the external Supplier Portal) ───
export interface SupplierEmailTemplate {
  id: string
  name: string
  purpose: string // one-line description shown in the list
  subject: string // supports {{supplierName}} {{contactName}} {{commodity}} {{workshopDate}} {{portalLink}} {{replyBy}} {{senderName}}
  body: string
  updatedAt?: string
  updatedBy?: string
}

export interface OutreachBatch {
  id: string
  templateId: string
  templateName: string
  commodities: string[] // commodity codes
  recipients: string[] // supplier codes
  recipientCount: number
  workshopDate?: string
  replyBy?: string
  sentAt: string
  sentBy: string // user id
  sentByName: string
}

export type SupplierResponseType = 'Idea' | 'Problem' | 'Complaint'
export type SupplierResponseStatus = 'New' | 'Under review' | 'Converted to idea' | 'Closed'

export interface SupplierResponse {
  id: string
  source: 'Supplier Portal'
  portalRef: string // reference id in the external portal
  supplierCode: string
  commodity: string // commodity code
  type: SupplierResponseType
  scope: 'Open idea' | 'Specific parts'
  partCodes?: string[]
  subject: string
  body: string
  estSavingLakh?: number
  receivedAt: string
  status: SupplierResponseStatus
  batchId?: string
  ideaId?: string
  updatedAt?: string
  updatedBy?: string
}

// Submit Idea — "Supplier" idea scope (appended; merges into the Idea interface above).
// `scope` stays 'Part-specific' (parts entered) or 'Open' (estimate only) so every calculation is unchanged.
export interface Idea {
  /** Vendor code the idea targets when it was raised with scope "Supplier" */
  scopeSupplierCode?: string
}

// Campaign workspace — an outreach batch is an email campaign (appended; merges into OutreachBatch above).
export type OutreachKind = 'Supplier idea drive' | 'Improvement workshop' | 'Reminder'
export interface OutreachBatch {
  /** Campaign name given in the New campaign wizard (older batches derive one from template + commodities) */
  name?: string
  /** Campaign type chosen in the wizard */
  kind?: OutreachKind
}
