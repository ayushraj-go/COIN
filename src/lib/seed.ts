import type { Campaign, EmailLog, Execution, Idea, IdeaPart, LedgerEntry, Notification, Part, RouteKey, User } from './types'
import { COMMODITIES_DEFAULT, LEVERS_DEFAULT, MILESTONE_TEMPLATES, PARTS_DEFAULT, ROUTE_STAGES, SUPPLIERS_DEFAULT, USERS_DEFAULT, DROP_REASONS, LAKH, CATEGORIES_DEFAULT, PLANTS_DEFAULT } from './masters'
import { addDays, fyMonths, iso, parse, ymOf, addMonthsYm } from './format'
import { bucketFor, ideaAnnualised, phaseByQuarter, committedInFy } from './calc'

// deterministic RNG so the demo portfolio is stable
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261001)
const r = (a: number, b: number) => a + rnd() * (b - a)
const ri = (a: number, b: number) => Math.floor(r(a, b + 1))
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const chance = (p: number) => rnd() < p

const FY = 'FY27'
const LAST_REALISED = '2026-08'
const TODAY = '2026-10-01'

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
    route, stage: 'Buyer validation', bucket: 'Pipeline', stageEnteredAt: dt(createdAt), createdAt: dt(createdAt, 9, 30), submittedAt: t === 'Draft' ? undefined : dt(createdAt, 9, 45),
    buyerId: c.buyerId, approvals: [], stageHistory: [], activity: [], comments: [],
  }
  void annualPreview

  const log = (at: string, userId: string, action: string, extra: Partial<Idea['activity'][0]> = {}) =>
    idea.activity.push({ id: `a-${idea.activity.length}-${id}`, at, userId, userName: userById(userId)?.name ?? 'System', action, ...extra })

  log(dt(createdAt, 9, 30), submitterId, 'Created idea (draft)')
  if (t === 'Draft') { idea.stage = 'Draft'; idea.bucket = 'Draft'; idea.stageHistory = [{ stage: 'Draft', enteredAt: dt(createdAt) }]; return idea }
  log(dt(createdAt, 9, 45), submitterId, 'Submitted for validation', { field: 'stage', oldValue: 'Draft', newValue: 'Buyer validation' })

  // decide final stage index
  const ai = routeStages.indexOf('Approval')
  let finalIdx: number
  if (opts.stageOverride) finalIdx = routeStages.indexOf(opts.stageOverride)
  else if (t === 'Pipeline') finalIdx = ri(0, ai)
  else if (t === 'In Execution') finalIdx = ri(ai + 1, routeStages.length - 2)
  else if (t === 'Implemented') finalIdx = routeStages.length - 1
  else finalIdx = ri(0, t === 'Rejected' ? ai : routeStages.length - 2)

  let cursor = createdAt
  const lead = c.leadId
  for (let s = 0; s <= finalIdx; s++) {
    const stage = routeStages[s]
    const enteredAt = dt(cursor, 10 + (s % 6), 15)
    const isLast = s === finalIdx
    const dur = t === 'Pipeline' && isLast ? 0 : stage === 'Approval' ? ri(1, 4) : stage.includes('PAP') ? ri(5, 14) : stage.includes('NPD') || stage === 'Execution' ? ri(12, 30) : ri(2, 9)
    const who = stage === 'Buyer validation' ? c.buyerId : stage === 'Approval' ? lead : stage.includes('evaluation') || stage.includes('qualification') ? evaluatorFor(lever.evaluator) : stage.includes('feasibility') || stage.includes('confirmation') ? c.buyerId : c.buyerId
    idea.stageHistory.push({ stage, enteredAt })
    if (!isLast || t === 'Implemented' || t === 'Dropped' || t === 'Rejected') {
      // stage completed (or the terminal stage)
      if (!isLast) {
        const exit = addDays(cursor, dur)
        idea.stageHistory[idea.stageHistory.length - 1].exitedAt = dt(exit, 16)
        idea.stageHistory[idea.stageHistory.length - 1].by = userById(who).name
        idea.stageHistory[idea.stageHistory.length - 1].action = stage === 'Approval' ? 'Approved' : 'Completed'
        log(dt(exit, 16), who, stage === 'Approval' ? 'Approved' : `Completed ${stage}`, { field: 'stage', oldValue: stage, newValue: routeStages[s + 1] })
        if (stage === 'Approval') idea.approvedAt = dt(exit, 16)
        cursor = exit
      }
    }
    if (stage === 'Buyer validation' && (!isLast || t !== 'Pipeline')) log(enteredAt, c.buyerId, 'Baseline confirmed from LBP; volume from MRN FY26')
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

  // feasibility / tech eval records
  const fStageIdx = routeStages.findIndex((s) => s.includes('feasibility') || s.includes('confirmation'))
  if (fStageIdx >= 0 && finalIdx >= fStageIdx) {
    const done = finalIdx > fStageIdx
    const supCode = idea.proposedSupplier?.code ?? chosen[0]?.supplierCode ?? altSup?.code ?? 'V10021'
    idea.feasibility = {
      requestedAt: idea.stageHistory[fStageIdx].enteredAt, supplierCode: supCode,
      ...(done ? { respondedAt: idea.stageHistory[fStageIdx].exitedAt, respondedBy: users.find((u) => u.supplierCode === supCode)?.name ?? 'Supplier (secure link)', feasible: true, offeredPrice: ideaParts[0]?.newPrice, leadTimeDays: ri(14, 60), moq: ri(1, 20) * 1000, remarks: 'Feasible; price valid for 6 months.' } : {}),
    }
  }
  const eStageIdx = routeStages.findIndex((s) => s.includes('evaluation') || s.includes('qualification'))
  if (eStageIdx >= 0 && finalIdx >= eStageIdx) {
    const done = finalIdx > eStageIdx
    idea.techEval = { evaluatorDept: lever.evaluator === '—' ? 'R&D' : lever.evaluator, ...(done ? { decision: 'Go', validationPlan: 'Lab validation (salt spray / thermal cycling) + 200-unit pilot build; field audit after 30 days.', at: idea.stageHistory[eStageIdx].exitedAt, by: userById(evaluatorFor(lever.evaluator)).name } : {}) }
  } else if (EVAL_ROUTED(lever.route) && finalIdx >= 0) {
    idea.techEval = { evaluatorDept: lever.evaluator }
  }

  // approvals
  const annual = ideaAnnualised(idea)
  const needsHead = annual > 50 * LAKH || idea.oneTimeInvestment > 25 * LAKH
  idea.approvals = [{ level: 'Commodity Lead', approverId: lead }, ...(needsHead ? [{ level: 'Sourcing Head', approverId: 'u-head' }] : [])]
  if (idea.approvedAt) idea.approvals = idea.approvals.map((a) => ({ ...a, decision: 'Approved' as const, at: idea.approvedAt, remarks: 'Approved — baseline and volume verified.' }))

  idea.bucket = bucketFor(route, cur)

  // execution record
  if (idea.approvedAt) {
    const approvedDay = idea.approvedAt.slice(0, 10)
    let targetDate = '2027-03-31'
    if (chance(0.55)) targetDate = pick(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2026-10-31', '2026-09-15'])
    if (t === 'Implemented') targetDate = addDays(approvedDay, ri(30, 90))
    const ms = MILESTONE_TEMPLATES[route].map((name, k, arr) => {
      const due = addDays(approvedDay, Math.round(((+parse(targetDate) - +parse(approvedDay)) / 86400000) * ((k + 1) / arr.length)))
      return { id: `m-${id}-${k}`, name, dueDate: due, doneDate: undefined as string | undefined }
    })
    let effectiveDate: string | undefined
    if (t === 'Implemented') {
      effectiveDate = addDays(approvedDay, ri(4, 35))
      if (effectiveDate > '2026-08-20') effectiveDate = addDays('2026-05-01', ri(0, 80))
      if (effectiveDate < approvedDay) effectiveDate = addDays(approvedDay, 5)
      ms.forEach((m) => (m.doneDate = m.dueDate < effectiveDate! ? m.dueDate : effectiveDate))
    } else {
      ms.forEach((m) => { if (m.dueDate < TODAY && chance(0.75)) m.doneDate = addDays(m.dueDate, ri(-3, 4)) })
    }
    const annualA = ideaAnnualised(idea)
    const goLive = effectiveDate ?? targetDate
    const exec: Execution = {
      ownerId: c.buyerId, startDate: approvedDay, targetDate, originalTargetDate: targetDate,
      phasing: phaseByQuarter(annualA, goLive < '2026-04-01' ? '2026-04-01' : goLive, FY), milestones: ms, slippage: [],
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
    if (['Technical', 'Supplier change'].includes(route)) {
      idea.npdRequestId = `NPD-ECN-${26000 + ri(100, 999)}`
      idea.npdStatus = t === 'Implemented' ? 'Sample approved' : pick(['ECN raised', 'Sample submitted', 'Sample approved'])
    }
    idea.papRequestId = `PAP-${ri(40000, 49999)}`
    idea.papStatus = t === 'Implemented' ? 'Price approved' : cur.includes('PAP') ? 'Raised' : 'Not raised'
    if (t === 'Implemented') {
      idea.implementedAt = dt(effectiveDate!, 15)
      idea.parts = idea.parts.map((p) => ({ ...p, approvedPrice: +(p.newPrice * r(0.985, 1.02)).toFixed(p.newPrice > 100 ? 1 : 2) }))
      exec.approvedPrice = idea.parts[0]?.approvedPrice
      idea.locked = true
      log(dt(effectiveDate!, 15), c.buyerId, 'Marked Done — Implemented', { field: 'stage', oldValue: routeStages[routeStages.length - 2], newValue: 'Implemented' })
    }
  }

  if (t === 'Dropped' || t === 'Rejected') {
    const at = addDays(cursor, ri(2, 12))
    idea.dropStage = cur
    idea.stage = t === 'Rejected' ? 'Rejected' : 'Dropped'
    idea.bucket = 'Dropped'
    idea.droppedAt = dt(at, 14)
    idea.dropReason = t === 'Rejected' ? 'Price not agreed' : pick(DROP_REASONS.slice(0, 8))
    idea.dropRemarks = t === 'Rejected' ? 'Rejected at approval — saving not commensurate with qualification risk.' : pick(['Supplier withdrew after RM increase.', 'Sample failed salt-spray at 96 h.', 'OEM customer did not approve the change.', 'Volume moved to new platform.', 'Superseded by consolidated negotiation idea.'])
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
function EVAL_ROUTED(route: RouteKey) { return route === 'Technical' || route === 'Internal' || route === 'Supplier change' }

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
      const supplierCode = supplierUser && chance(0.3) ? supplierUser.supplierCode : undefined
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
    commodity: 'FAS', leverId: 'L11', target: 'In Execution', stageOverride: 'Price revision in PAP', createdAt: '2026-06-18', supplierCode: 'V10021', campaignId: undefined, seq: 12,
    title: 'Switch M6×16 flange bolt plating from Zn-Ni to trivalent Zn with sealer',
    partsOverride: [{ partCode: fasPart.code, description: fasPart.description, uom: 'Nos', currentSupplier: 'V10021 · Sunrise Fasteners Pvt Ltd', baselinePrice: 4.2, baselineSource: 'LBP', newPrice: 3.85, annualVolume: 2400000, volumeSource: 'MRN FY26' }],
  })
  we.currentState = 'Hex flange bolt M6×16 is Zn-Ni plated (720 h salt spray) although the application on the ODU base needs only 240 h; bought at ₹ 4.20 (LBP).'
  we.proposedChange = 'Move to trivalent Zn plating with sealer (meets 240 h spec). Sunrise Fasteners offers ₹ 3.85 with 30% gain-share on further RM benefits.'
  we.evidence = 'Salt-spray trial passed 312 h at DQA lab; supplier quote attached.'
  we.evidenceTags = ['Trial', 'Quote']
  we.gainSharePct = 30
  we.oneTimeInvestment = 0
  we.execution!.targetDate = '2026-10-01'
  we.execution!.originalTargetDate = '2026-10-01'
  we.execution!.slippage = []
  we.execution!.phasing = phaseByQuarter(8.4 * LAKH, '2026-10-01', FY)
  we.expectedQuarter = 'Q3 FY27'
  we.npdStatus = 'Sample approved'
  we.papStatus = 'Raised'
  we.plant = 'RJP'
  ideas.push(we)
  void committedInFy
  return ideas
}

// ─── Realisation ledger (Section 9) ───────────────────────────────────────────
export function realiseMonth(ideas: Idea[], month: string, rng: () => number = rnd): LedgerEntry[] {
  const out: LedgerEntry[] = []
  for (const i of ideas) {
    if (i.bucket !== 'Implemented' || !i.execution?.effectiveDate) continue
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
  for (const m of fyMonths(FY).filter((m) => m <= LAST_REALISED)) {
    const rows = realiseMonth(ideas, m)
    rows.forEach((row) => {
      if (m <= '2026-07') {
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
  const pipe = ideas.filter((i) => i.stage === 'Buyer validation')
  for (const i of pipe.slice(0, 12)) push(i.buyerId, `New idea in ${i.commodity}`, `${i.id} · ${i.title}`, 'Idea submitted in my commodity', 'info', i.id, ri(1, 70))
  for (const i of ideas.filter((x) => x.stage === 'Approval').slice(0, 10)) i.approvals.forEach((a) => a.approverId && push(a.approverId, 'Pending approval', `${i.id} · ${i.title}`, 'Pending approval', 'warning', i.id, ri(1, 40)))
  for (const i of ideas.filter((x) => x.stage.includes('evaluation') || x.stage.includes('qualification')).slice(0, 10)) push(evaluatorFor(LEVERS_DEFAULT.find((l) => l.id === i.leverId)!.evaluator), 'Technical evaluation requested', `${i.id} · ${i.title}`, 'Technical evaluation requested', 'info', i.id, ri(2, 90))
  for (const i of ideas.filter((x) => x.feasibility && !x.feasibility.respondedAt).slice(0, 8)) { const u = users.find((uu) => uu.supplierCode === i.feasibility!.supplierCode); if (u) push(u.id, 'Feasibility requested', `${i.id} · ${i.title} — respond with offered price, lead time, MOQ`, 'Feasibility requested', 'warning', i.id, ri(3, 60)) }
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
  const ideas = seedIdeas()
  const ledger = seedLedger(ideas)
  return { ideas, ledger, campaigns: seedCampaigns(), notifications: seedNotifications(ideas), emails: seedEmails(), lastRealisationMonth: LAST_REALISED }
}
export type Seed = ReturnType<typeof buildSeed>
export const SEED_USERS: User[] = USERS_DEFAULT
void iso
