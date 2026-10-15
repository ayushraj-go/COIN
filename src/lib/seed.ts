import type { Campaign, EmailLog, Execution, Idea, IdeaPart, LedgerEntry, Notification, Part, RiskItem, RiskLevel, RouteKey, SupplierCheck, User } from './types'
import { COMMODITIES_DEFAULT, LEVERS_DEFAULT, MILESTONE_TEMPLATES, PARTS_DEFAULT, ROUTE_STAGES, STAGE, SUPPLIERS_DEFAULT, USERS_DEFAULT, DROP_REASONS, LAKH, CATEGORIES_DEFAULT, PLANTS_DEFAULT, RISK_FACTORS } from './masters'
import { addDays, fyMonths, iso, parse, ymOf, addMonthsYm, today } from './format'
import { approvalLevels, bucketFor, ideaAnnualised, phaseByQuarter, committedInFy } from './calc'
import { addMonthsIso, evalDeptOf, lockTarget, milestoneSchedule, needsSupplierCheck, planVsActual, supplierCapabilityEmail, SUPPLIER_SPEC_BY_GROUP } from './workflow'

// deterministic RNG so the demo portfolio is stable
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let rnd = mulberry32(20261001)
const r = (a: number, b: number) => a + rnd() * (b - a)
const ri = (a: number, b: number) => Math.floor(r(a, b + 1))
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const chance = (p: number) => rnd() < p

const FY = 'FY27'
// The demo "today" follows the real date (never before 1 Oct 2026); MRN realisation is posted up to last month
const TODAY = iso(today()) < '2026-10-01' ? '2026-10-01' : iso(today())
const LAST_REALISED = addMonthsYm(ymOf(TODAY), -1) < '2026-08' ? '2026-08' : addMonthsYm(ymOf(TODAY), -1)

const LEVER_PCT: Record<string, [number, number]> = {
  L01: [1.5, 4], L02: [0.4, 0.9], L03: [1, 2.5], L04: [2, 5], L05: [4, 9], L06: [8, 16], L07: [3, 7], L08: [2, 4],
  L09: [5, 12], L10: [4, 10], L11: [6, 14], L12: [3, 7], L13: [2, 5], L14: [5, 12], L15: [6, 15], L16: [3, 8], L17: [5, 10], L18: [4, 10],
}
const COMMODITY_LEVERS: Record<string, string[]> = {
  CUT: ['L01', 'L03', 'L04', 'L05', 'L07', 'L09', 'L10', 'L12', 'L17', 'L01', 'L03'],
  ALU: ['L01', 'L03', 'L04', 'L05', 'L09', 'L11', 'L13', 'L17'],
  STL: ['L01', 'L04', 'L05', 'L07', 'L09', 'L10', 'L11', 'L12', 'L13'],
  FAS: ['L01', 'L05', 'L07', 'L09', 'L11', 'L13', 'L04'],
  CMP: ['L01', 'L03', 'L04', 'L05', 'L06', 'L09', 'L10', 'L01', 'L08'],
  PCB: ['L01', 'L03', 'L05', 'L06', 'L09', 'L10', 'L11', 'L06'],
  MOT: ['L01', 'L05', 'L06', 'L09', 'L11', 'L10'],
  HAR: ['L01', 'L05', 'L07', 'L09', 'L11', 'L12'],
  PLM: ['L01', 'L04', 'L05', 'L07', 'L09', 'L11', 'L12', 'L16', 'L17'],
  RES: ['L01', 'L03', 'L04', 'L05', 'L11'],
  COR: ['L01', 'L05', 'L07', 'L15', 'L15'],
  EPS: ['L01', 'L05', 'L15', 'L11'],
  FRT: ['L14', 'L14', 'L01', 'L04', 'L18'],
  MRO: ['L01', 'L04', 'L16', 'L18', 'L02'],
  FAC: ['L01', 'L02', 'L16', 'L18'],
}
const IDEAS_PER_COMMODITY: Record<string, number> = { CUT: 14, ALU: 10, STL: 11, FAS: 9, CMP: 13, PCB: 11, MOT: 8, HAR: 7, PLM: 9, RES: 7, COR: 6, EPS: 5, FRT: 8, MRO: 5, FAC: 5 }

const TITLES: Record<string, string[]> = {
  L01: ['Annual rate renegotiation for {part}', 'Index-linked price reset on {part} with {supplier}', 'Should-price based negotiation for {part}'],
  L02: ['Extend payment terms from 45 to 75 days with {supplier}', 'Early-payment discount programme with {supplier}'],
  L03: ['Fix forex conversion at quarterly average for {part}', 'Resist USD-linked increase on {part} via INR invoicing'],
  L04: ['Consolidate {commodity} volumes across plants with {supplier}', 'Volume bundling of {part} for tiered pricing'],
  L05: ['Develop {alt} as alternate source for {part}', 'Second-source {part} (same drawing) from {alt}'],
  L06: ['Localise imported {part}', 'Localise key sub-component of {part} with Indian vendor'],
  L07: ['Regionalise {part} supply closer to {plant} plant', 'Shift {part} to regional mill near {plant}'],
  L08: ['Strategic masking of {commodity} spend in joint negotiation'],
  L09: ['VA/VE: reduce gauge on {part}', 'VA/VE: remove non-functional feature on {part}', 'Redesign {part} to cut material weight'],
  L10: ['Cost engineering teardown of {part}', 'Should-cost driven redesign of {part}'],
  L11: ['Substitute alternate grade in {part}', 'Replace coating system on {part} with lower-cost equivalent', 'Alternate material for {part}'],
  L12: ['Correct oversize dimension on {part}', 'Optimise blank size for {part}'],
  L13: ['Relax non-critical tolerance on {part}', 'Tolerance rationalisation for {part}'],
  L14: ['Shift {part} lane to backhaul loading', 'Milk-run consolidation for {part}', 'Mode shift to rail for {part}'],
  L15: ['Reduce board ply for {part}', 'Lower EPS density for {part} after drop test', 'Returnable packaging for {part}'],
  L16: ['Reduce brazing cycle time on {part} line', 'Cut changeover loss on {part} line'],
  L17: ['Sell {commodity} scrap at LME-linked rate', 'Segregate {commodity} scrap at source to lift realisation'],
  L18: ['Automate {part} monitoring with IoT meters', 'Digitise {part} ordering via e-catalogue'],
}
const CURRENT: Record<string, string> = {
  L01: 'Price last revised 14 months ago on an old RM index; no benchmarking against peer vendors.',
  L02: 'Standard 45-day credit; supplier offers better price or terms on longer tenor.',
  L03: 'Supplier invoices at spot USD rate on dispatch date, passing forex volatility to Amber.',
  L04: 'Volumes split across 3 vendors and 4 plants with no tier pricing.',
  L05: 'Single-source from incumbent; no competitive tension on price or capacity.',
  L06: 'Component imported with 11% duty, freight and 10-week lead time.',
  L07: 'Supplied from a mill 1,400 km away; freight and inventory carry high.',
  L08: 'Spend negotiated in isolation per plant and per BU.',
  L09: 'Part designed with safety margin beyond functional need; gauge / weight not optimised.',
  L10: 'Teardown shows supplier process cost ~9% above should-cost.',
  L11: 'Current grade / coating specified historically; cheaper equivalents qualified in the market.',
  L12: 'Blank / part dimension larger than drawing requirement, adding material cost.',
  L13: 'Tight tolerance on non-critical feature forces secondary machining.',
  L14: 'One-way FTL movement with empty return legs.',
  L15: 'Packing over-designed vs. current drop-test and stacking needs.',
  L16: 'Cycle time and changeover losses above benchmark on the line.',
  L17: 'Mixed scrap sold at a flat rate without LME linkage.',
  L18: 'Manual monitoring and ordering; no data for optimisation.',
}
const PROPOSED: Record<string, string> = {
  L01: 'Renegotiate using the latest RM index, peer quotes and volume outlook for FY27.',
  L02: 'Move to 75-day terms or take early-payment discount funded by working capital.',
  L03: 'Fix conversion at quarterly average RBI reference rate; invoice in INR.',
  L04: 'Consolidate volumes with the best-cost vendor against a tiered price schedule.',
  L05: 'Qualify an alternate vendor on the same drawing; DQA to run supplier qualification.',
  L06: 'Develop Indian source; R&D + DQA validation and NPD sampling.',
  L07: 'Develop regional source to cut freight and inventory days.',
  L08: 'Mask combined spend and negotiate as a single strategic buy (route to be confirmed).',
  L09: 'Reduce gauge / remove feature after FEA and validation; release ECN through NPD.',
  L10: 'Apply should-cost model; redesign process routing with supplier.',
  L11: 'Substitute the alternate grade / coating after R&D + Quality validation.',
  L12: 'Correct dimension to drawing nominal; revise blank size.',
  L13: 'Relax tolerance on the non-critical feature; eliminate secondary operation.',
  L14: 'Use backhaul / milk-run loads and renegotiate lane rates.',
  L15: 'Revise packing standard after Quality + Process trial.',
  L16: 'Optimise process parameters and SMED to cut cycle time.',
  L17: 'Sell segregated scrap on LME-linked contract.',
  L18: 'Deploy IoT metering / e-catalogue to remove waste.',
}

const ALT_SUPPLIER_NEW = ['Metro Precision Components', 'Ganga Industrial Works', 'Deccan Engineering Co.', 'Bharat Alloy Castings', 'Shree Balaji Polymers', 'Unique Pack Solutions']

const users = USERS_DEFAULT
const submitterPool = ['u-sub1', 'u-sub2', 'u-sub3', 'u-sub4', 'u-sub5', 'u-eval1', 'u-eval2', 'u-eval3', 'u-eval4', 'u-eval5']
const userById = (id: string) => users.find((u) => u.id === id)!

function supName(code: string) { return SUPPLIERS_DEFAULT.find((s) => s.code === code)?.name ?? code }

function mkPart(p: Part, lever: string, share: number, pctRange: [number, number]): IdeaPart {
  const baseline = p.lbp ?? p.poPrice
  const pctv = r(pctRange[0] * 1.3, pctRange[1] * 1.3) / 100
  const newPrice = +(baseline * (1 - pctv)).toFixed(baseline > 100 ? 1 : 2)
  let vol = Math.round(p.lastFyMrnQty * share)
  const cap = r(2.5, 9) * 1e7
  const ann = (baseline - newPrice) * vol
  if (ann > cap) vol = Math.round(vol * (cap / ann))
  return {
    partCode: p.code, description: p.description, uom: p.uom,
    currentSupplier: `${p.supplierCode} · ${supName(p.supplierCode)}`,
    baselinePrice: baseline, baselineSource: p.lbp != null ? 'LBP' : 'PO price',
    newPrice, annualVolume: vol, volumeSource: 'MRN FY26',
  }
}

const seqByCommodity: Record<string, number> = {}
function nextSeq(c: string) {
  seqByCommodity[c] = (seqByCommodity[c] || 0) + 1
  if (c === 'FAS' && seqByCommodity[c] === 12) seqByCommodity[c]++
  return seqByCommodity[c]
}

function dt(date: string, h = 10, m = 0) { const d = parse(date); d.setHours(h, m); return d.toISOString() }

function evaluatorFor(evaluator: string) {
  if (evaluator.startsWith('R&D')) return 'u-eval1'
  if (evaluator.startsWith('DQA')) return 'u-eval2'
  if (evaluator.startsWith('Quality')) return 'u-eval3'
  if (evaluator.startsWith('Process')) return 'u-eval4'
  if (evaluator.startsWith('Production')) return 'u-eval5'
  return 'u-eval1'
}

type Target = 'Draft' | 'Pipeline' | 'In Execution' | 'Implemented' | 'Dropped' | 'Rejected'

/** Evaluator for the submitter's department (stage 3); Sourcing ideas are evaluated by the commodity lead */
const EVALUATOR_BY_DEPT: Record<string, string> = { 'R&D': 'u-eval1', DQA: 'u-eval2', Quality: 'u-eval3', Process: 'u-eval4', Production: 'u-eval5', Finance: 'u-fin' }
const LEVEL_FRAC: Record<RiskLevel, [number, number]> = { Low: [0, 0.015], Medium: [0.015, 0.05], High: [0.05, 0.1] }
function makeRisks(annual: number, levels?: RiskLevel[]): RiskItem[] {
  return RISK_FACTORS.map((f, k) => {
    const level: RiskLevel = levels?.[k] ?? (chance(0.6) ? 'Low' : chance(0.75) ? 'Medium' : 'High')
    const [a, b] = LEVEL_FRAC[level]
    return { key: f.key, label: f.label, level, costAtRisk: Math.round((annual * r(a, b)) / 1000) * 1000, note: level === 'Low' ? undefined : f.hint }
  })
}
const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`
function capabilityRequest(id: string, seq: number, sup: { code?: string; name: string; contactName: string; contactEmail: string }, item: string, spec: string, requiredBy: string, sentAt: string, sentBy: string): SupplierCheck {
  const token = `${id.slice(-8)}-s${seq}`.toLowerCase()
  const mail = supplierCapabilityEmail({ supplierName: sup.name, contactName: sup.contactName, item, spec, requiredBy, link: `/supplier-form/${token}`, sender: `${sentBy}, Amber Sourcing` })
  return { status: 'Sent', token, supplierCode: sup.code, supplierName: sup.name, contactName: sup.contactName, email: sup.contactEmail, item, spec, requiredBy, sentAt, sentBy, subject: mail.subject, body: mail.body }
}

function buildIdea(opts: {
  commodity: string; leverId: string; target: Target; stageOverride?: string; createdAt?: string; submitterId?: string; supplierCode?: string; campaignId?: string; seq?: number; partsOverride?: IdeaPart[]; title?: string
}): Idea {
  const c = COMMODITIES_DEFAULT.find((x) => x.code === opts.commodity)!
  const cat = CATEGORIES_DEFAULT.find((x) => x.id === c.categoryId)!
  const lever = LEVERS_DEFAULT.find((l) => l.id === opts.leverId)!
  const route: RouteKey = lever.route
  const routeStages = ROUTE_STAGES[route]
  const parts = PARTS_DEFAULT.filter((p) => p.commodity === c.code)
  const isOpen = !opts.partsOverride && opts.target !== 'Implemented' && opts.target !== 'In Execution' && (lever.id === 'L08' || lever.id === 'L17' || (chance(0.12) && lever.id !== 'L05'))
  const nParts = isOpen ? 0 : Math.min(parts.length, chance(0.25) ? 2 : 1)
  const chosen = [...parts].sort(() => rnd() - 0.5).slice(0, nParts)
  const share = +r(0.6, 1).toFixed(2)
  const ideaParts = opts.partsOverride ?? chosen.map((p) => mkPart(p, lever.id, share, LEVER_PCT[lever.id]))
  const plant = chosen[0]?.plant ?? pick(PLANTS_DEFAULT).id

  const supplierSub = opts.supplierCode ? users.find((u) => u.supplierCode === opts.supplierCode) : undefined
  const submitterId = opts.submitterId ?? supplierSub?.id ?? (chance(0.45) ? c.buyerId : chance(0.2) ? c.leadId : pick(submitterPool))
  const sub = userById(submitterId)
  const partName = chosen[0]?.description ?? c.name
  const altSup = SUPPLIERS_DEFAULT.find((s) => s.commodities.includes(c.code) && s.code !== chosen[0]?.supplierCode)
  const altName = altSup?.name ?? pick(ALT_SUPPLIER_NEW)
  const title = (opts.title ?? pick(TITLES[lever.id]))
    .replace('{part}', partName).replace('{supplier}', supName(chosen[0]?.supplierCode ?? altSup?.code ?? '')).replace('{alt}', altName)
    .replace('{plant}', PLANTS_DEFAULT.find((p) => p.id === plant)?.name ?? 'Rajpura').replace('{commodity}', c.name.split(' (')[0])
    .slice(0, 100)

  // timeline
  const t = opts.target
  const windows: Record<Target, [string, string]> = {
    Implemented: ['2026-04-01', '2026-06-10'], 'In Execution': ['2026-04-12', '2026-08-25'], Pipeline: ['2026-07-10', '2026-09-29'],
    Dropped: ['2026-04-08', '2026-08-20'], Rejected: ['2026-05-01', '2026-08-30'], Draft: ['2026-09-20', '2026-09-30'],
  }
  const [wa, wb] = windows[t]
  const span = (+parse(wb) - +parse(wa)) / 86400000
  const createdAt = opts.createdAt ?? addDays(wa, Math.floor(rnd() * span))

  const seq = opts.seq ?? nextSeq(c.code)
  const id = `COIN-${FY}-${c.code}-${String(seq).padStart(4, '0')}`
  const annualPreview = ideaAnnualised({ parts: ideaParts, scope: isOpen ? 'Open' : 'Part-specific', openEstimateLakh: 0 })
  const openEstimate = isOpen ? +(c.addressableSpend * r(0.002, 0.009) / LAKH).toFixed(1) : undefined

  let savingsType = lever.defaultSavingsType
  if (lever.savingsType.includes('Avoidance') && chance(0.35)) savingsType = 'Cost avoidance'

  const idea: Idea = {
    id, seq, fy: FY, title,
    currentState: CURRENT[lever.id], proposedChange: PROPOSED[lever.id],
    evidence: pick(['Supplier quote received and benchmarked against 2 peers.', 'Trial on 200 units completed at Rajpura; no field issue.', 'Benchmark with competitor teardown attached.', 'Drawing mark-up shared with R&D.', 'Quote and cost break-up attached.']),
    evidenceTags: [pick(['Quote', 'Trial', 'Benchmark', 'Drawing'])].concat(chance(0.4) ? [pick(['Quote', 'Drawing'])] : []).filter((v, i, a) => a.indexOf(v) === i),
    attachments: chance(0.6) ? [{ id: `att-${id}-1`, name: pick(['supplier_quote.pdf', 'drawing_rev_C.pdf', 'benchmark.xlsx', 'trial_report.pdf']), size: ri(80, 2400) * 1024, type: 'application/pdf', uploadedAt: dt(createdAt), by: sub.name }] : [],
    submitterId, submitterName: sub.name, employeeId: sub.employeeId, department: sub.department, plant,
    buyingType: cat.buyingType, categoryId: c.categoryId, commodity: c.code, leverId: lever.id,
    scope: isOpen ? 'Open' : 'Part-specific', campaignId: opts.campaignId,
    parts: ideaParts,
    proposedSupplier: lever.route === 'Supplier change' || lever.id === 'L06' ? { code: altSup?.code, name: altName, isNew: !altSup } : undefined,
    savingsType, oneTimeInvestment: ['L06', 'L09', 'L10', 'L11', 'L15', 'L18', 'L16'].includes(lever.id) ? Math.round(r(1, 38)) * LAKH : chance(0.2) ? Math.round(r(0.5, 4)) * LAKH : 0,
    expectedQuarter: `${pick(['Q2', 'Q3', 'Q3', 'Q4'])} ${FY}`,
    openEstimateLakh: openEstimate,
    gainSharePct: supplierSub ? pick([20, 25, 30, 40]) : undefined,
    offerValidity: supplierSub ? addDays(createdAt, 120) : undefined,
    isSupplierSubmission: !!supplierSub, supplierCode: supplierSub?.supplierCode ?? chosen[0]?.supplierCode,
    route, stage: STAGE.feasibility, bucket: 'Pipeline', stageEnteredAt: dt(createdAt), createdAt: dt(createdAt, 9, 30), submittedAt: t === 'Draft' ? undefined : dt(createdAt, 9, 45),
    buyerId: c.buyerId, approvals: [], stageHistory: [], activity: [], comments: [],
  }
  void annualPreview

  const log = (at: string, userId: string, action: string, extra: Partial<Idea['activity'][0]> = {}) =>
    idea.activity.push({ id: `a-${idea.activity.length}-${id}`, at, userId, userName: userById(userId)?.name ?? 'System', action, ...extra })

  log(dt(createdAt, 9, 30), submitterId, 'Created idea (draft)')
  if (t === 'Draft') { idea.stage = 'Draft'; idea.bucket = 'Draft'; idea.stageHistory = [{ stage: 'Draft', enteredAt: dt(createdAt) }]; return idea }
  log(dt(createdAt, 9, 45), submitterId, 'Idea submitted', { field: 'stage', oldValue: 'Draft', newValue: STAGE.feasibility })

  // decide final stage index — 0 Team feasibility check · 1 Evaluation · 2 Approval · 3 Execution started · 4 Verification
  const ai = routeStages.indexOf(STAGE.approval)
  let finalIdx: number
  if (opts.stageOverride) finalIdx = routeStages.indexOf(opts.stageOverride)
  else if (t === 'Pipeline') finalIdx = ri(0, ai)
  else if (t === 'In Execution') finalIdx = ai + 1
  else if (t === 'Implemented') finalIdx = routeStages.length - 1
  else if (t === 'Rejected') finalIdx = ri(1, ai)
  else finalIdx = ri(0, routeStages.length - 2)

  const evalDept = evalDeptOf(sub.department)
  const evaluatorId = EVALUATOR_BY_DEPT[evalDept] ?? c.leadId
  let cursor = createdAt
  const lead = c.leadId
  for (let s = 0; s <= finalIdx; s++) {
    const stage = routeStages[s]
    const enteredAt = dt(cursor, 10 + (s % 6), 15)
    const isLast = s === finalIdx
    const dur = t === 'Pipeline' && isLast ? 0 : stage === STAGE.approval ? ri(1, 4) : stage === STAGE.evaluation ? ri(3, 10) : stage === STAGE.execution ? ri(20, 60) : ri(2, 7)
    const who = stage === STAGE.approval ? lead : stage === STAGE.evaluation ? evaluatorId : c.buyerId
    idea.stageHistory.push({ stage, enteredAt })
    if (!isLast) {
      const exit = addDays(cursor, dur)
      const h = idea.stageHistory[idea.stageHistory.length - 1]
      h.exitedAt = dt(exit, 16)
      h.by = userById(who).name
      h.action = stage === STAGE.approval ? 'Approved · lock signed' : stage === STAGE.evaluation ? 'Recommended' : stage === STAGE.feasibility ? 'Go' : stage === STAGE.execution ? 'Handed for verification' : 'Completed'
      // the Execution started → Verification step is logged as the hand-over with its own date below
      if (stage !== STAGE.execution) log(dt(exit, 16), who, stage === STAGE.feasibility ? 'Team feasibility check — Go' : stage === STAGE.evaluation ? `${evalDept} evaluation — recommended` : 'Sourcing approval — approved', { field: 'stage', oldValue: stage, newValue: routeStages[s + 1] })
      if (stage === STAGE.approval) idea.approvedAt = dt(exit, 16)
      cursor = exit
    }
    if (stage === STAGE.feasibility && (!isLast || t !== 'Pipeline')) log(enteredAt, c.buyerId, 'Baseline confirmed from LBP; volume from MRN FY26')
  }

  // Pipeline — for ageing realism push some current stages back in time
  const cur = routeStages[finalIdx]
  idea.stage = cur
  idea.stageEnteredAt = idea.stageHistory[idea.stageHistory.length - 1].enteredAt
  if (t === 'Pipeline') {
    // most pipeline ideas entered their current stage recently; ~28% are ageing / beyond SLA
    const back = chance(0.72) ? addDays(TODAY, -ri(0, 5)) : addDays(TODAY, -ri(7, 16))
    const stamp = back > cursor ? back : cursor
    const h = idea.stageHistory
    idea.stageEnteredAt = dt(stamp, 11)
    h[h.length - 1].enteredAt = dt(stamp, 11)
    if (h.length > 1) h[h.length - 2].exitedAt = dt(stamp, 10)
  }

  const annual = ideaAnnualised(idea)
  const terminal = t === 'Dropped' || t === 'Rejected'

  // Stage 2 — team feasibility check (four checks)
  if (finalIdx >= 1 || (terminal && finalIdx === 0)) {
    const passed = finalIdx >= 1
    const extra = ['R&D', 'Quality', 'DQA', 'Production', 'Finance'].filter(() => chance(0.35))
    idea.feasibilityCheck = {
      technical: passed || chance(0.5) ? 'Yes' : 'No', cost: passed ? 'Valid' : 'Not valid', costNote: passed ? 'Baseline matches LBP; new price within the quote' : 'Baseline above latest LBP; quote to be refreshed',
      conflict: 'None', decision: passed ? 'Go' : 'No-go', departments: ['Sourcing', ...(extra.length ? extra : ['R&D'])],
      remarks: passed ? 'Feasible; baseline and volume confirmed.' : 'Not feasible at the quoted cost.',
      by: userById(c.buyerId).name, byDept: 'Sourcing', at: idea.stageHistory[0].exitedAt ?? dt(cursor, 15),
    }
  }

  // Stage 3 — <dept> evaluation: cost-benefit, risk, supplier capability, decision
  if (finalIdx >= 1) {
    const done = finalIdx > 1
    const alt = SUPPLIERS_DEFAULT.find((x) => x.code === idea.proposedSupplier?.code) ?? SUPPLIERS_DEFAULT.find((x) => x.commodities.includes(c.code) && x.code !== chosen[0]?.supplierCode) ?? SUPPLIERS_DEFAULT.find((x) => x.commodities.includes(c.code))
    let supplier: SupplierCheck
    if (!needsSupplierCheck(annual)) supplier = { status: 'Skipped', skippedReason: 'Below minimum saving threshold (₹ 5 L)' }
    else {
      const state = done ? 'Responded' : pick(['Not sent', 'Sent', 'Responded'] as const)
      const entered = idea.stageHistory[1].enteredAt.slice(0, 10)
      const sentDay = addDays(entered, 1) < TODAY ? addDays(entered, 1) : addDays(TODAY, -1)
      if (state === 'Not sent' || !alt) supplier = { status: 'Not sent' }
      else {
        supplier = capabilityRequest(id, seq, alt, chosen[0]?.description ?? c.name.split(' (')[0], SUPPLIER_SPEC_BY_GROUP[lever.group], addDays(createdAt, 120), dt(sentDay, 11), userById(evaluatorId).name)
        if (state === 'Responded') supplier = { ...supplier, status: 'Responded', response: { canSupply: chance(0.8) ? 'Yes' : 'Partly', meetsSpec: chance(0.8) ? 'Yes' : 'With deviation', capacityPerMonth: `${ri(2, 20) * 10} ${chosen[0]?.uom === 'Kg' ? 'MT' : 'k Nos'} per month`, leadTimeDays: ri(21, 75), certifications: 'IATF 16949 · ISO 14001', remarks: 'Can start trial lots within 4 weeks of PO.', contactName: alt.contactName, respondedAt: dt(addDays(sentDay, ri(1, 3)), 15) } }
      }
    }
    const risky = done || chance(0.5)
    idea.evaluation = {
      dept: evalDept, cbaVerified: done || chance(0.5), cbaNote: done ? 'Part-wise saving, payback and phasing verified against LBP and MRN FY26.' : undefined,
      risks: risky ? makeRisks(annual) : undefined, riskRemarks: risky ? 'Risks acceptable with sample validation and a phased cut-over.' : undefined,
      supplier, decision: done ? 'Recommend' : undefined, remarks: done ? 'Recommended — cost-benefit verified, risks acceptable.' : undefined,
      by: done ? userById(evaluatorId).name : undefined, at: done ? idea.stageHistory[1].exitedAt : undefined,
    }
  }

  // approvals
  const needsHead = annual > 50 * LAKH || idea.oneTimeInvestment > 25 * LAKH
  idea.approvals = [{ level: 'Commodity Lead', approverId: lead }, ...(needsHead ? [{ level: 'Sourcing Head', approverId: 'u-head' }] : [])]
  if (idea.approvedAt) idea.approvals = idea.approvals.map((a) => ({ ...a, decision: 'Approved' as const, at: idea.approvedAt, remarks: 'Approved — lock signed.' }))

  idea.bucket = bucketFor(route, cur)

  // Stage 4 — budget + timeline lock (savings start = expected first MRN at the new price)
  if (idea.approvedAt) {
    const approvedDay = idea.approvedAt.slice(0, 10)
    const months = pick([3, 6, 6, 6, 9, 12])
    const leadMonths = route === 'Technical' || route === 'Supplier change' ? 2 : 1
    const startDate = firstOfMonth(addMonthsIso(approvedDay, leadMonths))
    const signer = needsHead ? 'u-head' : lead
    idea.lock = {
      commercialOk: true, supplierAligned: idea.evaluation?.supplier?.status === 'Responded' ? 'Confirmed' : idea.evaluation?.supplier?.status === 'Skipped' ? 'Skipped' : 'Not confirmed',
      budget: idea.oneTimeInvestment || Math.round((annual * 0.02) / 1000) * 1000, timelineMonths: months, startDate, endDate: addMonthsIso(startDate, months),
      targetSaving: lockTarget(annual, months), signatureName: userById(signer).name, signedAt: idea.approvedAt, signedBy: userById(signer).name,
    }
  }

  // Stage 5 — execution record from the lock
  if (idea.approvedAt && idea.lock) {
    const approvedDay = idea.approvedAt.slice(0, 10)
    const L = idea.lock
    const targetDate = L.endDate
    const tpl = MILESTONE_TEMPLATES[route]
    const due = milestoneSchedule(approvedDay, L.startDate, L.endDate, tpl)
    const ms = tpl.map((name, k) => ({ id: `m-${id}-${k}`, name, dueDate: due[k], doneDate: undefined as string | undefined }))
    let effectiveDate: string | undefined
    let handedAt: string | undefined
    if (t === 'Implemented') {
      effectiveDate = addDays(L.startDate, ri(0, 9))
      if (ymOf(effectiveDate) > LAST_REALISED) effectiveDate = `${LAST_REALISED}-0${ri(1, 9)}`
      if (effectiveDate < approvedDay) effectiveDate = addDays(approvedDay, 5)
      handedAt = addDays(effectiveDate, ri(25, 70))
      if (handedAt >= TODAY) handedAt = addDays(TODAY, -ri(2, 9))
      if (handedAt <= effectiveDate) handedAt = addDays(effectiveDate, 3)
      const eff = effectiveDate, hand = handedAt
      ms.forEach((m) => (m.doneDate = m.name === 'First MRN at new price' ? eff : m.name === 'Handed for verification' ? hand : m.name === 'Implementation confirmed' ? (addDays(eff, 20) < hand ? addDays(eff, 20) : hand) : m.dueDate < eff ? m.dueDate : eff))
      const exH = idea.stageHistory.find((h) => h.stage === STAGE.execution)
      if (exH) exH.exitedAt = dt(hand, 15)
      const vH = idea.stageHistory.find((h) => h.stage === STAGE.verification)
      if (vH) vH.enteredAt = dt(hand, 15)
      idea.stageEnteredAt = dt(hand, 15)
    } else {
      // route steps done when due; first MRN once the savings start has passed; never handed over while in execution
      ms.forEach((m) => {
        if (m.name === 'Handed for verification' || m.dueDate >= TODAY) return
        if (m.name === 'First MRN at new price') { if (chance(0.8)) m.doneDate = addDays(m.dueDate, ri(0, 6)) < TODAY ? addDays(m.dueDate, ri(0, 6)) : addDays(TODAY, -1); return }
        if (m.name === 'Implementation confirmed') { if (ms.find((x) => x.name === 'First MRN at new price')?.doneDate && chance(0.7)) m.doneDate = m.dueDate; return }
        if (chance(0.8)) m.doneDate = addDays(m.dueDate, ri(-3, 4))
      })
      effectiveDate = ms.find((m) => m.name === 'First MRN at new price')?.doneDate
    }
    const exec: Execution = {
      ownerId: c.buyerId, startDate: approvedDay, targetDate, originalTargetDate: targetDate,
      phasing: phaseByQuarter(annual, L.startDate < '2026-04-01' ? '2026-04-01' : L.startDate, FY), milestones: ms, slippage: [],
      progress: t === 'Implemented' ? 100 : Math.round((ms.filter((m) => m.doneDate).length / ms.length) * 100),
      notes: [], status: t === 'Implemented' ? 'Done' : t === 'Dropped' ? 'Dropped' : 'In Execution', effectiveDate,
    }
    // slippage on some
    if (t === 'In Execution' && chance(0.18)) {
      const orig = addDays(targetDate, -ri(30, 75))
      exec.originalTargetDate = orig
      exec.slippage.push({ at: dt(addDays(orig, -5) < TODAY ? addDays(orig, -5) : addDays(TODAY, -ri(3, 20))), by: userById(c.buyerId).name, oldDate: orig, newDate: targetDate, reason: pick(['NPD sample re-submission required', 'Supplier tooling delayed', 'PAP approval pending with plant finance', 'Customer / OEM approval awaited']) })
    }
    idea.execution = exec
    idea.ownerId = c.buyerId
    idea.coDate = effectiveDate ?? L.startDate
    // NPD sample and PAP price revision are milestones inside "Execution started"
    const npdMs = ms.find((m) => m.name.includes('NPD sample'))
    const papMs = ms.find((m) => m.name.includes('PAP'))
    if (npdMs) {
      idea.npdRequestId = `NPD-ECN-${26000 + ri(100, 999)}`
      idea.npdStatus = t === 'Implemented' || npdMs.doneDate ? 'Sample approved' : pick(['ECN raised', 'Sample submitted'])
    }
    if (papMs) {
      idea.papRequestId = `PAP-${ri(40000, 49999)}`
      idea.papStatus = t === 'Implemented' || papMs.doneDate ? 'Price approved' : 'Raised'
    }
    if (effectiveDate) idea.parts = idea.parts.map((p) => ({ ...p, approvedPrice: +(p.newPrice * r(0.985, 1.02)).toFixed(p.newPrice > 100 ? 1 : 2) }))
    if (t === 'Implemented') {
      idea.implementedAt = dt(handedAt!, 15)
      exec.approvedPrice = idea.parts[0]?.approvedPrice
      idea.locked = true
      log(dt(handedAt!, 15), c.buyerId, 'Handed for verification', { field: 'stage', oldValue: STAGE.execution, newValue: STAGE.verification, remarks: `First MRN at the new price ${effectiveDate}` })
      idea.verification = { handedAt: dt(handedAt!, 15), handedBy: userById(c.buyerId).name }
      const verifiedOn = addDays(handedAt!, ri(3, 25))
      if (chance(0.6) && verifiedOn < TODAY) {
        idea.verification = { ...idea.verification, verifiedAt: dt(verifiedOn, 12), verifiedBy: 'Girish Saluja', mrnAtApproved: true, financeValidated: true, targetAchieved: true, remarks: 'MRN at the approved price; savings on plan for the period.' }
        const vH = idea.stageHistory.find((h) => h.stage === STAGE.verification)
        if (vH) Object.assign(vH, { exitedAt: dt(verifiedOn, 12), by: 'Girish Saluja', action: 'Verified' })
        log(dt(verifiedOn, 12), 'u-head', 'Verified — target achieved')
      }
    }
  }

  if (t === 'Dropped' || t === 'Rejected') {
    const at = addDays(cursor, ri(2, 12))
    idea.dropStage = cur
    idea.stage = t === 'Rejected' ? 'Rejected' : 'Dropped'
    idea.bucket = 'Dropped'
    idea.droppedAt = dt(at, 14)
    idea.dropReason = t === 'Rejected' ? 'Price not agreed' : finalIdx === 0 ? 'Not feasible' : pick(DROP_REASONS.slice(0, 8))
    if (t === 'Rejected' && idea.evaluation && finalIdx === 1) idea.evaluation = { ...idea.evaluation, decision: 'Reject', remarks: 'Saving not commensurate with qualification risk.', by: userById(evaluatorId).name, at: dt(at, 14) }
    idea.dropRemarks = t === 'Rejected' ? `Rejected at ${finalIdx === 1 ? `${evalDept} evaluation` : 'sourcing approval'} — saving not commensurate with qualification risk.` : pick(['Supplier withdrew after RM increase.', 'Sample failed salt-spray at 96 h.', 'OEM customer did not approve the change.', 'Volume moved to new platform.', 'Superseded by consolidated negotiation idea.'])
    idea.stageHistory.push({ stage: idea.stage, enteredAt: idea.droppedAt, by: userById(c.buyerId).name, action: t, remarks: idea.dropRemarks })
    idea.stageEnteredAt = idea.droppedAt
    if (idea.execution) idea.execution.status = 'Dropped'
    log(idea.droppedAt, t === 'Rejected' ? lead : c.buyerId, t === 'Rejected' ? 'Rejected' : `Dropped — ${idea.dropReason}`, { remarks: idea.dropRemarks })
  }

  if (chance(0.35)) {
    idea.comments.push({ id: `c-${id}-1`, at: dt(addDays(createdAt, 2), 12), userId: c.buyerId, userName: userById(c.buyerId).name, text: `@${userById(submitterId).name} please attach the latest supplier quote and drawing revision.`, mentions: [submitterId] })
    if (chance(0.6)) idea.comments.push({ id: `c-${id}-2`, at: dt(addDays(createdAt, 3), 15), userId: submitterId, userName: userById(submitterId).name, text: 'Attached. Quote is valid till end of quarter.', mentions: [] })
  }
  return idea
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export function seedCampaigns(): Campaign[] {
  const att = (codes: string[], states: Campaign['attendance'][string][]) => Object.fromEntries(codes.map((c, i) => [c, states[i % states.length]]))
  return [
    { id: 'CMP-001', name: 'Compressor cost-down summit FY27', type: 'Workshop', commodity: 'CMP', categoryId: 'ELE', startDate: '2026-07-01', endDate: '2026-07-31', workshopDate: '2026-07-16', venue: 'Amber Noida HQ, Board Room 2', suppliers: ['V10007', 'V10008'], internalInvitees: ['u-buyer3', 'u-lead2', 'u-eval1', 'u-eval2'], targetIdeas: 12, targetValue: 12 * 1e7, status: 'Closed', description: 'Joint cost-down workshop with compressor partners covering VA/VE, localisation of sub-components and forex mechanisms.', attendance: att(['V10007', 'V10008'], ['Attended', 'Attended']), summary: '14 ideas captured; 5 approved in 3 weeks; motor-winding localisation and shell gauge VE taken to NPD.', createdBy: 'u-lead2', createdAt: '2026-06-10T09:00:00.000Z', invitesSentAt: '2026-06-12T10:00:00.000Z' },
    { id: 'CMP-002', name: 'Metals VA/VE sprint — Copper & Aluminium', type: 'Campaign', commodity: 'CUT', categoryId: 'MET', startDate: '2026-08-15', endDate: '2026-10-31', suppliers: ['V10001', 'V10002', 'V10003', 'V10004'], internalInvitees: ['u-buyer2', 'u-lead1', 'u-eval1', 'u-eval3', 'u-sub4'], targetIdeas: 15, targetValue: 10 * 1e7, status: 'Live', description: 'Sprint to cut copper and aluminium intensity per TR: tube wall thickness, fin density, hairpin optimisation, scrap LME linkage.', attendance: att(['V10001', 'V10002', 'V10003', 'V10004'], ['Accepted', 'Accepted', 'Invited', 'Accepted']), createdBy: 'u-lead1', createdAt: '2026-08-05T09:00:00.000Z', invitesSentAt: '2026-08-06T10:00:00.000Z' },
    { id: 'CMP-003', name: 'Fasteners supplier improvement workshop', type: 'Workshop', commodity: 'FAS', categoryId: 'MET', startDate: '2026-09-20', endDate: '2026-10-20', workshopDate: '2026-10-08', venue: 'Amber Rajpura Plant, Training Hall', suppliers: ['V10021', 'V10022'], internalInvitees: ['u-buyer1', 'u-lead1', 'u-eval2', 'u-sub2'], targetIdeas: 8, targetValue: 1.2 * 1e7, status: 'Live', description: 'Plating, standardisation and packaging ideas for fasteners; suppliers to bring 3 ideas each with gain-share offers.', attendance: att(['V10021', 'V10022'], ['Accepted', 'Invited']), createdBy: 'u-buyer1', createdAt: '2026-09-15T09:00:00.000Z', invitesSentAt: '2026-09-16T10:00:00.000Z' },
    { id: 'CMP-004', name: 'Packing sustainability challenge', type: 'Campaign', commodity: 'COR', categoryId: 'PKG', startDate: '2026-05-01', endDate: '2026-06-30', suppliers: ['V10018', 'V10019'], internalInvitees: ['u-buyer6', 'u-lead3', 'u-eval3', 'u-eval4'], targetIdeas: 6, targetValue: 1.5 * 1e7, status: 'Closed', description: 'Reduce packing material and move to returnable packaging for high-runner models.', attendance: att(['V10018', 'V10019'], ['Attended', 'Attended']), summary: '7 ideas; ply reduction and EPS density trials cleared; returnable packaging parked for FY28.', createdBy: 'u-lead3', createdAt: '2026-04-20T09:00:00.000Z', invitesSentAt: '2026-04-22T10:00:00.000Z' },
    { id: 'CMP-005', name: 'Electronics localisation drive', type: 'Campaign', commodity: 'PCB', categoryId: 'ELE', startDate: '2026-09-01', endDate: '2026-12-15', suppliers: ['V10009', 'V10010'], internalInvitees: ['u-buyer4', 'u-lead2', 'u-eval1', 'u-eval2'], targetIdeas: 10, targetValue: 6 * 1e7, status: 'Live', description: 'Localise imported ICs, relays and connectors on inverter PCBAs with R&D + DQA validation.', attendance: att(['V10009', 'V10010'], ['Accepted', 'Accepted']), createdBy: 'u-lead2', createdAt: '2026-08-25T09:00:00.000Z', invitesSentAt: '2026-08-26T10:00:00.000Z' },
    { id: 'CMP-006', name: 'Indirect spend hackathon', type: 'Campaign', commodity: 'FRT', categoryId: 'LOG', startDate: '2026-11-01', endDate: '2026-11-30', suppliers: ['V10020', 'V10023', 'V10024', 'V10025'], internalInvitees: ['u-buyer7', 'u-lead3', 'u-eval4', 'u-sub2'], targetIdeas: 10, targetValue: 2 * 1e7, status: 'Draft', description: 'Freight backhaul, MRO catalogue buying and utilities automation ideas.', attendance: {}, createdBy: 'u-lead3', createdAt: '2026-09-28T09:00:00.000Z' },
  ]
}

// ─── Ideas ────────────────────────────────────────────────────────────────────
export function seedIdeas(): Idea[] {
  const ideas: Idea[] = []
  const mix: Target[] = ['Pipeline', 'Implemented', 'Pipeline', 'In Execution', 'Implemented', 'In Execution', 'Pipeline', 'Implemented', 'Dropped', 'In Execution', 'Pipeline', 'Implemented', 'In Execution', 'Rejected']
  const campaignFor: Record<string, string> = { CMP: 'CMP-001', CUT: 'CMP-002', ALU: 'CMP-002', FAS: 'CMP-003', COR: 'CMP-004', EPS: 'CMP-004', PCB: 'CMP-005' }
  for (const c of COMMODITIES_DEFAULT) {
    const n = IDEAS_PER_COMMODITY[c.code]
    for (let k = 0; k < n; k++) {
      const leverId = pick(COMMODITY_LEVERS[c.code])
      let target = mix[(k + c.code.charCodeAt(0)) % mix.length]
      const supplierUser = users.find((u) => u.roles.includes('supplier') && u.commodities.includes(c.code))
      const supplierCode = supplierUser && chance(0.4) ? supplierUser.supplierCode : undefined
      const campaignId = campaignFor[c.code] && chance(0.4) ? campaignFor[c.code] : undefined
      if (campaignId === 'CMP-003' && target === 'Implemented') target = 'Pipeline'
      ideas.push(buildIdea({ commodity: c.code, leverId, target, supplierCode, campaignId }))
    }
  }
  // Drafts
  ideas.push(buildIdea({ commodity: 'STL', leverId: 'L09', target: 'Draft', submitterId: 'u-sub1' }))
  ideas.push(buildIdea({ commodity: 'PLM', leverId: 'L16', target: 'Draft', submitterId: 'u-sub1' }))

  // Worked example (Section 4): fastener ₹ 4.20 → ₹ 3.85 on 24,00,000 units, live 1 October → ₹ 8.40 L annual, ₹ 4.20 L committed, ₹ 4.20 L carry-over
  const fasPart = PARTS_DEFAULT.find((p) => p.code === '3100045612')!
  const we = buildIdea({
    commodity: 'FAS', leverId: 'L11', target: 'In Execution', stageOverride: STAGE.execution, createdAt: '2026-06-18', supplierCode: 'V10021', campaignId: undefined, seq: 12,
    title: 'Switch M6×16 flange bolt plating from Zn-Ni to trivalent Zn with sealer',
    partsOverride: [{ partCode: fasPart.code, description: fasPart.description, uom: 'Nos', currentSupplier: 'V10021 · Sunrise Fasteners Pvt Ltd', baselinePrice: 4.2, baselineSource: 'LBP', newPrice: 3.85, annualVolume: 2400000, volumeSource: 'MRN FY26' }],
  })
  we.currentState = 'Hex flange bolt M6×16 is Zn-Ni plated (720 h salt spray) although the application on the ODU base needs only 240 h; bought at ₹ 4.20 (LBP).'
  we.proposedChange = 'Move to trivalent Zn plating with sealer (meets 240 h spec). Sunrise Fasteners offers ₹ 3.85 with 30% gain-share on further RM benefits.'
  we.evidence = 'Salt-spray trial passed 312 h at DQA lab; supplier quote attached.'
  we.evidenceTags = ['Trial', 'Quote']
  we.gainSharePct = 30
  we.oneTimeInvestment = 0
  // locked savings period: live 1 October for 6 months → ₹ 4.20 L target (= the FY27 committed value)
  we.lock = { ...we.lock!, startDate: '2026-10-01', timelineMonths: 6, endDate: '2027-04-01', targetSaving: lockTarget(8.4 * LAKH, 6), budget: 50_000 }
  we.execution!.targetDate = '2027-04-01'
  we.execution!.originalTargetDate = '2027-04-01'
  we.execution!.slippage = []
  we.execution!.phasing = phaseByQuarter(8.4 * LAKH, '2026-10-01', FY)
  we.expectedQuarter = 'Q3 FY27'
  // NPD ECN, sample and PAP price done; first MRN at ₹ 3.85 on 1 October — MRN realisation starts with October
  const weDue = milestoneSchedule(we.execution!.startDate, '2026-10-01', '2027-04-01', MILESTONE_TEMPLATES.Technical)
  const weDone = ['2026-08-18', '2026-09-08', '2026-09-29', '2026-10-01']
  we.execution!.milestones = we.execution!.milestones.map((m, k) => ({ ...m, dueDate: weDue[k] ?? m.dueDate, doneDate: weDone[k] }))
  we.execution!.effectiveDate = '2026-10-01'
  we.execution!.progress = Math.round((4 / we.execution!.milestones.length) * 100)
  we.parts = we.parts.map((p) => ({ ...p, approvedPrice: 3.85 }))
  we.coDate = '2026-10-01'
  we.npdRequestId = we.npdRequestId ?? 'NPD-ECN-26418'
  we.npdStatus = 'Sample approved'
  we.papRequestId = we.papRequestId ?? 'PAP-44120'
  we.papStatus = 'Price approved'
  we.plant = 'RJP'
  ideas.push(we)
  ideas.push(...buildShowcase())
  void committedInFy
  return ideas
}

// ─── Six-stage walkthrough: one idea per stage, every form filled up to that stage ─────────────────
interface ShowSpec {
  n: number; commodity: string; leverId: string; submitterId: string; title: string; current: string; proposed: string; evidence: string
  partCode: string; newPrice: number; volume: number; investment: number; months: number; alt?: string; risks: RiskLevel[]
  response?: { canSupply: 'Yes' | 'Partly' | 'No'; meetsSpec: 'Yes' | 'With deviation' | 'No'; capacity: string; lead: number; price?: number; certs: string; remarks: string }
}
function buildShowcase(): Idea[] {
  const buyerOf = (code: string) => COMMODITIES_DEFAULT.find((c) => c.code === code)!.buyerId
  const specs: ShowSpec[] = [
    { n: 1, commodity: 'CMP', leverId: 'L06', submitterId: 'u-sub1', title: 'Localise the terminal cover and discharge muffler of the 1.5 TR inverter compressor',
      current: 'Terminal cover and discharge muffler of the 1.5 TR inverter compressor come with the imported compressor kit; their landed cost moves with USD.',
      proposed: 'Localise both sub-components with an Indian moulder and press shop; the compressor maker fits the local parts from Q4.',
      evidence: 'R&D teardown and should-cost done; two local vendors shortlisted.', partCode: '3500040012', newPrice: 7775, volume: 120000, investment: 18 * LAKH, months: 6, risks: ['Medium', 'High', 'Medium', 'High', 'Low'] },
    { n: 2, commodity: 'STL', leverId: 'L12', submitterId: 'u-sub3', title: 'Cut the condenser side bracket from a drawing-nominal blank',
      current: 'The condenser side bracket is cut from an oversize blank; about 6 % offcut goes to scrap.', proposed: 'Correct the blank to drawing nominal and nest two brackets per strip.',
      evidence: 'Trial of 500 pieces at the Jhajjar press shop; fitment OK.', partCode: '3400031187', newPrice: 38.2, volume: 1450000, investment: 0, months: 6, risks: ['Low', 'Low', 'Low', 'Low', 'Low'] },
    { n: 3, commodity: 'ALU', leverId: 'L11', submitterId: 'u-eval1', title: 'Hydrophilic 0.100 mm fin stock in place of 0.105 mm blue fin',
      current: 'Indoor coils use 0.105 mm blue-coated fin stock.', proposed: 'Move to 0.100 mm hydrophilic fin stock with the same heat-transfer performance at a lower gauge.',
      evidence: 'Thermal performance test on a 1.5 TR coil passed at the R&D lab; vendor quote attached.', partCode: '3300021019', newPrice: 316, volume: 600000, investment: 0, months: 6, alt: 'V10003', risks: ['Medium', 'Low', 'Medium', 'Low', 'Medium'],
      response: { canSupply: 'Yes', meetsSpec: 'Yes', capacity: '120 MT per month', lead: 30, price: 0, certs: 'IATF 16949 · ISO 14001', remarks: 'Hydrophilic 0.100 mm grade is in regular production; trial coils in 3 weeks.' } },
    { n: 4, commodity: 'PCB', leverId: 'L05', submitterId: buyerOf('PCB'), title: 'Second source for the indoor display PCB assembly',
      current: 'The indoor display PCB assembly is single-sourced; the price has not moved in 18 months.', proposed: 'Develop an alternate source on the same drawing; split volume 60 / 40 after PPAP.',
      evidence: 'Capability audit and quote completed; sample lot planned.', partCode: '3600050118', newPrice: 184.4, volume: 1500000, investment: 4 * LAKH, months: 6, alt: 'V10009', risks: ['Medium', 'Low', 'Medium', 'Medium', 'Low'],
      response: { canSupply: 'Yes', meetsSpec: 'Yes', capacity: '180 k assemblies per month', lead: 45, certs: 'IATF 16949 · IPC-A-610 class 2', remarks: 'SMT line capacity reserved from December.' } },
    { n: 5, commodity: 'CUT', leverId: 'L09', submitterId: 'u-sub4', title: 'Shorter hairpin bend leg length on 7 mm coils',
      current: 'Pre-formed hairpin bends carry 4 mm extra leg length that is trimmed after expansion.', proposed: 'Order hairpins at the trimmed length; the supplier passes on the copper saving.',
      evidence: 'Expansion trial on line 3 passed; no leak at 45 bar.', partCode: '3200011277', newPrice: 14.5, volume: 8000000, investment: 2 * LAKH, months: 3, alt: 'V10001', risks: ['Low', 'Low', 'Medium', 'Low', 'Medium'],
      response: { canSupply: 'Yes', meetsSpec: 'Yes', capacity: '900 k pieces per month', lead: 21, certs: 'IATF 16949', remarks: 'Can supply trimmed-length hairpins from the existing die set.' } },
    { n: 6, commodity: 'MOT', leverId: 'L01', submitterId: buyerOf('MOT'), title: 'Annual rate reset for the BLDC indoor fan motor',
      current: 'The BLDC 40 W fan motor is bought at the FY26 rate; copper and magnet indices have since eased.', proposed: 'Index-linked rate reset with the current supplier for FY27.',
      evidence: 'Should-cost and index workings attached.', partCode: '3700060210', newPrice: 1117.5, volume: 980000, investment: 0, months: 3, alt: 'V10011', risks: ['Low', 'Low', 'Low', 'Low', 'Medium'],
      response: { canSupply: 'Partly', meetsSpec: 'Yes', capacity: '40 k motors per month', lead: 60, certs: 'IATF 16949', remarks: 'Can take up to 40 % of the volume from Q4.' } },
  ]

  return specs.map((sp) => {
    const c = COMMODITIES_DEFAULT.find((x) => x.code === sp.commodity)!
    const lever = LEVERS_DEFAULT.find((l) => l.id === sp.leverId)!
    const part = PARTS_DEFAULT.find((x) => x.code === sp.partCode)!
    const baseline = part.lbp ?? part.poPrice
    const ip: IdeaPart = { partCode: part.code, description: part.description, uom: part.uom, currentSupplier: `${part.supplierCode} · ${supName(part.supplierCode)}`, baselinePrice: baseline, baselineSource: part.lbp != null ? 'LBP' : 'PO price', newPrice: sp.newPrice, annualVolume: sp.volume, volumeSource: 'MRN FY26' }

    // dates for this stage, counted back from today (S5 / S6 from the last realised month so MRN data exists)
    const back = (k: number) => addDays(TODAY, -k)
    const D: Record<string, string> = {}
    if (sp.n <= 4) {
      const plan: Record<number, number[]> = { 1: [2], 2: [12, 6], 3: [30, 24, 5], 4: [62, 55, 40, 12] }
      const [sub, feas, ev, appr] = plan[sp.n]
      D.submitted = back(sub); if (feas != null) D.feas = back(feas); if (ev != null) D.eval = back(ev); if (appr != null) D.approved = back(appr)
      if (sp.n === 4) D.start = firstOfMonth(addMonthsIso(D.approved, 2))
    } else {
      D.start = `${addMonthsYm(LAST_REALISED, sp.n === 5 ? -2 : -4)}-01`
      D.approved = addDays(D.start, -24); D.eval = addDays(D.approved, -9); D.feas = addDays(D.eval, -14); D.submitted = addDays(D.feas, -6)
      const end = addMonthsIso(D.start, sp.months)
      D.handed = addDays(end, sp.n === 5 ? 4 : 3) < TODAY ? addDays(end, sp.n === 5 ? 4 : 3) : addDays(TODAY, -1)
      if (sp.n === 6) D.verified = addDays(D.handed, 6) < TODAY ? addDays(D.handed, 6) : TODAY
    }

    const idea = buildIdea({ commodity: sp.commodity, leverId: sp.leverId, target: 'Pipeline', stageOverride: STAGE.feasibility, createdAt: D.submitted, submitterId: sp.submitterId, partsOverride: [ip], title: sp.title })
    const id = idea.id
    idea.showcase = sp.n
    idea.currentState = sp.current; idea.proposedChange = sp.proposed; idea.evidence = sp.evidence; idea.evidenceTags = ['Trial', 'Quote']
    idea.oneTimeInvestment = sp.investment; idea.campaignId = undefined; idea.plant = part.plant; idea.supplierCode = part.supplierCode
    idea.isSupplierSubmission = false; idea.gainSharePct = undefined; idea.offerValidity = undefined
    idea.attachments = [{ id: `att-${id}-1`, name: sp.n % 2 ? 'trial_report.pdf' : 'supplier_quote.pdf', size: 860 * 1024, type: 'application/pdf', uploadedAt: dt(D.submitted), by: idea.submitterName }]
    const altSup = sp.alt ? SUPPLIERS_DEFAULT.find((x) => x.code === sp.alt) : undefined
    idea.proposedSupplier = lever.route === 'Supplier change' && altSup ? { code: altSup.code, name: altSup.name, isNew: false } : undefined
    const annual = ideaAnnualised(idea)
    const evalDept = evalDeptOf(idea.department)
    const evaluatorId = EVALUATOR_BY_DEPT[evalDept] ?? c.leadId
    const name = (u: string) => userById(u).name
    const act: Idea['activity'] = []
    const log = (at: string, userId: string, action: string, extra: Partial<Idea['activity'][0]> = {}) => act.push({ id: `a-${act.length}-${id}`, at, userId, userName: userId === 'supplier' ? `${altSup?.contactName} (${altSup?.name})` : name(userId), action, ...extra })
    log(dt(D.submitted, 9, 30), sp.submitterId, 'Created idea (draft)')
    log(dt(D.submitted, 9, 45), sp.submitterId, 'Idea submitted', { field: 'stage', oldValue: 'Draft', newValue: STAGE.feasibility })
    const hist: Idea['stageHistory'] = [{ stage: STAGE.feasibility, enteredAt: dt(D.submitted, 9, 45) }]
    const close = (at: string, by: string, action: string, next: string) => { Object.assign(hist[hist.length - 1], { exitedAt: at, by: name(by), action }); hist.push({ stage: next, enteredAt: at }) }

    // Stage 2 — team feasibility check
    if (sp.n >= 2) {
      idea.feasibilityCheck = { technical: 'Yes', technicalNote: 'Fits the current process; no new tooling beyond what the idea lists.', cost: 'Valid', costNote: `Baseline matches LBP; ${((1 - sp.newPrice / baseline) * 100).toFixed(1)} % saving is within the quote.`, conflict: 'None', decision: 'Go', departments: ['Sourcing', evalDept === 'Sourcing' ? 'Finance' : evalDept, 'Production'], remarks: 'Feasible — send for evaluation.', by: name(c.buyerId), byDept: 'Sourcing', at: dt(D.feas, 16) }
      log(dt(D.feas, 16), c.buyerId, 'Team feasibility check — Go', { remarks: 'Technically feasible · cost valid · no duplicate / conflict' })
      close(dt(D.feas, 16), c.buyerId, 'Go', STAGE.evaluation)
      const skipped = !needsSupplierCheck(annual)
      idea.evaluation = { dept: evalDept, cbaVerified: false, supplier: skipped ? { status: 'Skipped', skippedReason: 'Below minimum saving threshold (₹ 5 L)' } : { status: 'Not sent' } }
    }
    // Stage 3 — evaluation completed
    if (sp.n >= 3 && altSup && sp.response) {
      const sentDay = addDays(D.feas, 3), respDay = addDays(D.feas, 6)
      const req = capabilityRequest(id, idea.seq, altSup, part.description, SUPPLIER_SPEC_BY_GROUP[lever.group], addMonthsIso(D.eval, 3), dt(sentDay, 11), name(evaluatorId))
      const r = sp.response
      idea.evaluation = {
        dept: evalDept, cbaVerified: true, cbaNote: 'Part-wise saving, payback and phasing verified against LBP and MRN FY26.',
        risks: makeRisks(annual, sp.risks), riskRemarks: 'Risks covered by the validation plan and a phased cut-over.',
        supplier: { ...req, status: 'Responded', response: { canSupply: r.canSupply, meetsSpec: r.meetsSpec, capacityPerMonth: r.capacity, leadTimeDays: r.lead, indicativePrice: r.price || undefined, certifications: r.certs, remarks: r.remarks, contactName: altSup.contactName, respondedAt: dt(respDay, 15) } },
        decision: 'Recommend', remarks: 'Recommended — cost-benefit verified, risks acceptable.', by: name(evaluatorId), at: dt(D.eval, 16),
      }
      log(dt(sentDay, 11), evaluatorId, `Supplier capability request sent to ${altSup.name}`, { remarks: altSup.contactEmail })
      log(dt(respDay, 15), 'supplier', `Supplier capability response — can supply: ${r.canSupply}`, { remarks: `Meets spec: ${r.meetsSpec} · lead time ${r.lead} d · capacity ${r.capacity}` })
      log(dt(D.eval, 15), evaluatorId, 'Evaluation — cost-benefit analysis and risk assessment saved')
      log(dt(D.eval, 16), evaluatorId, `${evalDept} evaluation — recommended`, { field: 'stage', oldValue: STAGE.evaluation, newValue: STAGE.approval })
      close(dt(D.eval, 16), evaluatorId, 'Recommended', STAGE.approval)
    }
    // Stage 4 — sourcing approval + signed lock
    const levels = approvalLevels(annual, sp.investment, 50, 25)
    idea.approvals = levels.map((l) => ({ level: l, approverId: l === 'Commodity Lead' ? c.leadId : 'u-head' }))
    if (sp.n >= 4) {
      const signer = levels.includes('Sourcing Head') ? 'u-head' : c.leadId
      idea.lock = { commercialOk: true, supplierAligned: idea.evaluation?.supplier?.status === 'Responded' ? 'Confirmed' : 'Skipped', budget: sp.investment || 50_000, timelineMonths: sp.months, startDate: D.start, endDate: addMonthsIso(D.start, sp.months), targetSaving: lockTarget(annual, sp.months), signatureName: name(signer), signedAt: dt(D.approved, 15), signedBy: name(signer) }
      idea.approvals = idea.approvals.map((a) => ({ ...a, approverId: signer === 'u-head' ? 'u-head' : a.approverId, decision: 'Approved' as const, at: dt(D.approved, 16), remarks: 'Approved — budget and timeline locked.' }))
      idea.approvedAt = dt(D.approved, 16)
      log(dt(D.approved, 15), signer, 'Budget & timeline lock signed', { remarks: `${sp.months} months · target ${(idea.lock.targetSaving / LAKH).toFixed(1)} L` })
      log(dt(D.approved, 16), signer, 'Sourcing approval — approved', { field: 'stage', oldValue: STAGE.approval, newValue: STAGE.execution })
      close(dt(D.approved, 16), signer, 'Approved · lock signed', STAGE.execution)
      // Stage 5 — execution started
      const L = idea.lock
      const tpl = MILESTONE_TEMPLATES[lever.route]
      const due = milestoneSchedule(D.approved, L.startDate, L.endDate, tpl)
      const ms = tpl.map((m, k) => ({ id: `m-${id}-${k}`, name: m, dueDate: due[k], doneDate: undefined as string | undefined }))
      if (sp.n >= 5) {
        ms.forEach((m) => (m.doneDate = m.name === 'First MRN at new price' ? L.startDate : m.name === 'Implementation confirmed' ? addDays(L.startDate, 20) : m.name === 'Handed for verification' ? D.handed : m.dueDate))
        idea.parts = idea.parts.map((x) => ({ ...x, approvedPrice: x.newPrice }))
      } else ms.forEach((m) => { if (m.dueDate < TODAY && !FINAL.includes(m.name)) m.doneDate = m.dueDate })
      const effectiveDate = sp.n >= 5 ? L.startDate : undefined
      idea.execution = {
        ownerId: c.buyerId, startDate: D.approved, targetDate: L.endDate, originalTargetDate: L.endDate, phasing: phaseByQuarter(annual, L.startDate < '2026-04-01' ? '2026-04-01' : L.startDate, FY),
        milestones: ms, slippage: [], progress: Math.round((ms.filter((m) => m.doneDate).length / ms.length) * 100), notes: [{ at: dt(addDays(D.approved, 2), 11), by: name(c.buyerId), text: 'Kick-off held with the supplier; NPD and PAP owners named.' }],
        status: sp.n >= 5 ? 'Done' : 'In Execution', effectiveDate, approvedPrice: sp.n >= 5 ? sp.newPrice : undefined,
      }
      idea.ownerId = c.buyerId
      idea.locked = true
      idea.coDate = L.startDate
      if (tpl.some((m) => m.includes('NPD'))) { idea.npdRequestId = `NPD-ECN-${26500 + sp.n}`; idea.npdStatus = sp.n >= 5 ? 'Sample approved' : 'ECN raised' }
      if (tpl.some((m) => m.includes('PAP'))) { idea.papRequestId = `PAP-${45100 + sp.n}`; idea.papStatus = sp.n >= 5 ? 'Price approved' : 'Raised' }
    }
    // Stage 6 — verification
    if (sp.n >= 5) {
      idea.implementedAt = dt(D.handed, 15)
      idea.verification = { handedAt: dt(D.handed, 15), handedBy: name(c.buyerId) }
      log(dt(idea.lock!.startDate, 12), c.buyerId, 'Milestone done: First MRN at new price')
      log(dt(D.handed, 15), c.buyerId, 'Handed for verification', { field: 'stage', oldValue: STAGE.execution, newValue: STAGE.verification, remarks: `First MRN at the new price ${idea.lock!.startDate}` })
      close(dt(D.handed, 15), c.buyerId, 'Handed for verification', STAGE.verification)
    }
    if (sp.n === 6) {
      idea.verification = { ...idea.verification, verifiedAt: dt(D.verified, 12), verifiedBy: 'Girish Saluja', mrnAtApproved: true, financeValidated: true, targetAchieved: true, remarks: 'MRN at the approved price for every month; target for the locked period achieved.' }
      Object.assign(hist[hist.length - 1], { exitedAt: dt(D.verified, 12), by: 'Girish Saluja', action: 'Verified' })
      log(dt(D.verified, 12), 'u-head', 'Verified — target achieved')
    }
    idea.stageHistory = hist
    idea.activity = act
    idea.stage = hist[hist.length - 1].stage
    idea.stageEnteredAt = hist[hist.length - 1].enteredAt
    idea.bucket = bucketFor(idea.route, idea.stage)
    return idea
  })
}
const FINAL = ['First MRN at new price', 'Implementation confirmed', 'Handed for verification']

// ─── Realisation ledger (Section 9) ───────────────────────────────────────────
export function realiseMonth(ideas: Idea[], month: string, rng: () => number = rnd): LedgerEntry[] {
  const out: LedgerEntry[] = []
  for (const i of ideas) {
    if ((i.bucket !== 'Implemented' && i.bucket !== 'In Execution') || !i.execution?.effectiveDate) continue
    if (ymOf(i.execution.effectiveDate) > month) continue
    for (const p of i.parts) {
      const approved = p.approvedPrice ?? p.newPrice
      const planned = Math.round(p.annualVolume / 12)
      const eff = i.execution.effectiveDate
      let frac = 1
      if (ymOf(eff) === month) { const d = parse(eff); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); frac = (dim - d.getDate() + 1) / dim }
      const roll = rng()
      let qty = Math.round(planned * frac * (0.72 + rng() * 0.5))
      if (roll < 0.03) qty = 0
      else if (roll < 0.08) qty = Math.round(planned * frac * 0.35)
      const leak = rng() < 0.08
      const mrnPrice = leak ? +(approved * (1 + 0.01 + rng() * 0.04)).toFixed(approved > 100 ? 1 : 2) : approved
      const realised = (p.baselinePrice - approved) * qty
      const leakage = Math.max(0, mrnPrice - approved) * qty
      const exceptions: LedgerEntry['exceptions'] = []
      if (leakage > 0) exceptions.push('Price leakage')
      if (qty === 0) exceptions.push('No MRN received')
      else if (qty < planned * frac * 0.5) exceptions.push('Volume below 50% of plan')
      out.push({
        id: `LG-${i.id}-${p.partCode}-${month}`, ideaId: i.id, partCode: p.partCode, supplierCode: p.currentSupplier.split(' · ')[0], month,
        mrnQty: qty, plannedQty: Math.round(planned * frac), mrnPrice, baseline: p.baselinePrice, approvedPrice: approved,
        realised, leakage, exceptions, financeStatus: 'Pending', postedAt: new Date(parse(addMonthsYm(month, 1) + '-05')).toISOString(),
      })
    }
  }
  return out
}

export function seedLedger(ideas: Idea[]): LedgerEntry[] {
  const out: LedgerEntry[] = []
  const showcase = new Set(ideas.filter((i) => (i.showcase ?? 0) >= 5).map((i) => i.id))
  for (const m of fyMonths(FY).filter((m) => m <= LAST_REALISED)) {
    const rows = realiseMonth(ideas, m)
    rows.forEach((row) => {
      if (showcase.has(row.ideaId)) {
        // walkthrough ideas: MRN 5 % above plan at the approved price, validated by Finance
        row.mrnQty = Math.round(row.plannedQty * 1.05)
        row.mrnPrice = row.approvedPrice
        row.realised = (row.baseline - row.approvedPrice) * row.mrnQty
        row.leakage = 0
        row.exceptions = []
        row.financeStatus = 'Validated'
        row.financeBy = 'Meera Iyer'
        row.financeAt = row.postedAt
        return
      }
      if (m < LAST_REALISED) {
        const q = rnd() < 0.05
        row.financeStatus = q ? 'Queried' : 'Validated'
        row.financeBy = 'Meera Iyer'
        row.financeAt = row.postedAt
        if (q) row.financeRemarks = 'MRN quantity mismatch with GRN register — please confirm.'
      }
    })
    out.push(...rows)
  }
  return out
}

export function seedNotifications(ideas: Idea[]): Notification[] {
  const n: Notification[] = []
  let k = 0
  const push = (userId: string, title: string, body: string, trigger: string, severity: Notification['severity'], ideaId?: string, hoursAgo = 2, read = false) =>
    n.push({ id: `n-${k++}`, userId, at: new Date(Date.now() - hoursAgo * 3600000).toISOString(), title, body, trigger, channel: 'In-app + email', ideaId, link: ideaId ? `/ideas/${ideaId}` : undefined, read, severity })
  const pipe = ideas.filter((i) => i.stage === STAGE.feasibility)
  for (const i of pipe.slice(0, 12)) push(i.buyerId, `New idea in ${i.commodity}`, `${i.id} · ${i.title}`, 'Idea submitted in my commodity', 'info', i.id, ri(1, 70))
  for (const i of ideas.filter((x) => x.stage === STAGE.approval).slice(0, 10)) i.approvals.forEach((a) => a.approverId && push(a.approverId, 'Pending approval', `${i.id} · ${i.title}`, 'Pending approval', 'warning', i.id, ri(1, 40)))
  for (const i of ideas.filter((x) => x.stage === STAGE.evaluation).slice(0, 10)) push(EVALUATOR_BY_DEPT[i.evaluation?.dept ?? ''] ?? 'u-head', `${i.evaluation?.dept ?? 'Department'} evaluation requested`, `${i.id} · ${i.title}`, 'Technical evaluation requested', 'info', i.id, ri(2, 90))
  push('u-sup1', 'Workshop invitation', 'Fasteners supplier improvement workshop · 08 Oct 2026, Rajpura', 'Workshop invitation', 'info', undefined, 330)
  push('u-fin', 'Savings to validate', 'August 2026 realisation posted — entries awaiting Finance validation', 'Savings to validate', 'warning', undefined, 20)
  push('u-lead1', 'Price leakage detected', 'MRN price above approved new price on 2 parts in Metals (Aug 2026)', 'Price leakage detected', 'danger', undefined, 26)
  push('u-buyer1', 'Price leakage detected', 'MRN price above approved new price on Fasteners / Steel (Aug 2026)', 'Price leakage detected', 'danger', undefined, 26)
  push('u-head', 'Monthly Cost Optimisation Report', 'COIN — Cost Optimisation Report, August 2026 was emailed to the management list', 'Monthly Cost Optimisation Report', 'success', undefined, 620, true)
  push('u-mgmt', 'Monthly Cost Optimisation Report', 'COIN — Cost Optimisation Report, August 2026 is ready', 'Monthly Cost Optimisation Report', 'success', undefined, 620)
  for (const i of ideas.filter((x) => x.execution?.status === 'In Execution' && x.execution.targetDate < TODAY).slice(0, 6)) push(i.ownerId!, 'Target date passed', `${i.id} · target ${i.execution!.targetDate}`, 'Target date passed', 'danger', i.id, ri(10, 200))
  for (const i of ideas.filter((x) => x.execution?.status === 'In Execution').slice(0, 6)) push(i.ownerId!, 'Implementation reminder', `${i.id} · update progress in Execution Hub`, 'Implementation reminder', 'info', i.id, ri(20, 300), chance(0.5))
  for (const i of ideas.filter((x) => x.submitterId === 'u-sub1').slice(0, 3)) push('u-sub1', 'Idea status update', `${i.id} moved to ${i.stage}`, 'Approved / rejected', 'success', i.id, ri(5, 100))
  return n.sort((a, b) => (a.at < b.at ? 1 : -1))
}

export function seedEmails(): EmailLog[] {
  return [
    { id: 'e-1', at: '2026-09-04T09:00:00.000Z', to: ['cxo-list@ambergroupindia.com', 'rajesh.khanna@ambergroupindia.com'], subject: 'COIN — Cost Optimisation Report, August 2026', body: 'PFA, Cost Optimisation Report', template: 'Monthly Cost Optimisation Report', attachments: ['COIN_Report_Aug-2026.pdf', 'COIN_Detail_Aug-2026.xlsx'] },
    { id: 'e-2', at: '2026-09-16T10:00:00.000Z', to: ['rakesh.gupta@sunrisefasteners.in', 'sales@precisionbolt.in'], subject: 'COIN · Invitation: Fasteners supplier improvement workshop', body: 'You are invited…', template: 'Workshop invitation' },
  ]
}

export function buildSeed() {
  // restart the random sequence and ID counters so "Reset demo data" restores exactly the same dataset and IDs
  rnd = mulberry32(20261001)
  for (const k of Object.keys(seqByCommodity)) delete seqByCommodity[k]
  const ideas = seedIdeas()
  const ledger = seedLedger(ideas)
  return { ideas, ledger, campaigns: seedCampaigns(), notifications: seedNotifications(ideas), emails: seedEmails(), lastRealisationMonth: LAST_REALISED }
}
export type Seed = ReturnType<typeof buildSeed>
export const SEED_USERS: User[] = USERS_DEFAULT
void iso
