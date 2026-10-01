// Section 7 — submission form model: typed inputs are kept as strings so partial entry never breaks the live maths.
import type { Attachment, BuyingType, Idea, IdeaPart, IdeaScope, Lever, Part, Supplier, User } from '../../lib/types'

/** Form-level scope. "Supplier" is persisted as `scopeSupplierCode` + scope 'Part-specific' (with parts) or 'Open' (estimate only). */
export type FormScope = IdeaScope | 'Supplier'

export interface FormPart {
  partCode: string
  description: string
  uom: string
  commodity: string
  supplierCode: string
  currentSupplier: string
  autoBaseline: number
  autoBaselineSource: 'LBP' | 'PO price'
  baselinePrice: string
  baselineOverrideReason: string
  newPrice: string
  autoVolume: number
  annualVolume: string
  volumeOverrideReason: string
}

export interface FormState {
  plant: string
  buyingType: BuyingType
  categoryId: string
  commodity: string
  leverId: string
  scope: FormScope
  /** vendor code chosen when scope is "Supplier" */
  scopeSupplierCode: string
  campaignId: string
  title: string
  currentState: string
  proposedChange: string
  evidence: string
  evidenceTags: string[]
  attachments: Attachment[]
  parts: FormPart[]
  proposedSupplier: { code?: string; name: string; isNew: boolean } | null
  expectedQuarter: string
  openEstimateLakh: string
  gainSharePct: string
  offerValidity: string
}

export const toNum = (s: string | number | undefined | null) => {
  if (s == null) return 0
  const n = typeof s === 'number' ? s : Number(String(s).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}
export const hasText = (s?: string) => !!s && s.trim().length > 0
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9

export const baselineOverridden = (p: FormPart) => hasText(p.baselinePrice) && !same(toNum(p.baselinePrice), p.autoBaseline)
export const volumeOverridden = (p: FormPart) => hasText(p.annualVolume) && !same(toNum(p.annualVolume), p.autoVolume)

export function supplierLabel(code: string, suppliers: Supplier[]) {
  const s = suppliers.find((x) => x.code === code)
  return `${code} · ${s?.name ?? 'Unknown vendor'}`
}

/** Selecting a part code fills description, UoM, supplier, baseline (LBP rule) and volume (last FY MRN) in place */
export function fromPart(p: Part, suppliers: Supplier[]): FormPart {
  const baseline = p.lbp ?? p.poPrice
  return {
    partCode: p.code, description: p.description, uom: p.uom, commodity: p.commodity, supplierCode: p.supplierCode,
    currentSupplier: supplierLabel(p.supplierCode, suppliers),
    autoBaseline: baseline, autoBaselineSource: p.lbp != null ? 'LBP' : 'PO price', baselinePrice: String(baseline), baselineOverrideReason: '',
    newPrice: '', autoVolume: p.lastFyMrnQty, annualVolume: String(p.lastFyMrnQty), volumeOverrideReason: '',
  }
}

/** Form part → stored IdeaPart. In `live` mode an empty new price counts as "no change" so the panel shows ₹ 0, never "—". */
export function toIdeaPart(p: FormPart, live = false): IdeaPart {
  const base = toNum(p.baselinePrice)
  const newP = hasText(p.newPrice) ? toNum(p.newPrice) : live ? base : 0
  const bo = baselineOverridden(p), vo = volumeOverridden(p)
  return {
    partCode: p.partCode, description: p.description, uom: p.uom, currentSupplier: p.currentSupplier,
    baselinePrice: base, baselineSource: bo ? 'Override' : p.autoBaselineSource, baselineOverrideReason: bo ? p.baselineOverrideReason.trim() || undefined : undefined,
    newPrice: newP, annualVolume: toNum(p.annualVolume), volumeSource: vo ? 'Override' : p.autoVolume > 0 ? 'MRN FY26' : 'Forecast',
    volumeOverrideReason: vo ? p.volumeOverrideReason.trim() || undefined : undefined,
  }
}

export function blankForm(me: User, currentFy: string): FormState {
  return {
    plant: me.plant, buyingType: 'Direct', categoryId: '', commodity: '', leverId: '', scope: 'Part-specific', scopeSupplierCode: '', campaignId: '',
    title: '', currentState: '', proposedChange: '', evidence: '', evidenceTags: [], attachments: [], parts: [], proposedSupplier: null,
    expectedQuarter: `Q3 ${currentFy}`, openEstimateLakh: '', gainSharePct: '', offerValidity: '',
  }
}

/** Resume a saved draft (?draft=ID) */
export function fromIdea(i: Idea, partsMaster: Part[], suppliers: Supplier[]): FormState {
  const unset: string[] = (i as any).draftUnset ?? []
  return {
    plant: i.plant, buyingType: i.buyingType, categoryId: unset.includes('categoryId') ? '' : i.categoryId ?? '', commodity: unset.includes('commodity') ? '' : i.commodity ?? '',
    leverId: unset.includes('leverId') ? '' : i.leverId ?? '', scope: i.scopeSupplierCode ? 'Supplier' : i.scope, scopeSupplierCode: i.scopeSupplierCode ?? '',
    campaignId: i.campaignId ?? '', title: i.title ?? '', currentState: i.currentState ?? '', proposedChange: i.proposedChange ?? '', evidence: i.evidence ?? '',
    evidenceTags: i.evidenceTags ?? [], attachments: i.attachments ?? [],
    parts: (i.parts ?? []).map((ip) => {
      const m = partsMaster.find((p) => p.code === ip.partCode)
      const auto = m ? fromPart(m, suppliers) : null
      return {
        partCode: ip.partCode, description: ip.description, uom: ip.uom, commodity: m?.commodity ?? i.commodity, supplierCode: ip.currentSupplier.split(' · ')[0],
        currentSupplier: ip.currentSupplier,
        autoBaseline: auto?.autoBaseline ?? ip.baselinePrice, autoBaselineSource: auto?.autoBaselineSource ?? (ip.baselineSource === 'PO price' ? 'PO price' : 'LBP'),
        baselinePrice: String(ip.baselinePrice), baselineOverrideReason: ip.baselineOverrideReason ?? '',
        newPrice: ip.newPrice ? String(ip.newPrice) : '',
        autoVolume: auto?.autoVolume ?? ip.annualVolume, annualVolume: String(ip.annualVolume), volumeOverrideReason: ip.volumeOverrideReason ?? '',
      }
    }),
    proposedSupplier: i.proposedSupplier ?? null,
    expectedQuarter: i.expectedQuarter, openEstimateLakh: i.openEstimateLakh != null ? String(i.openEstimateLakh) : '',
    gainSharePct: i.gainSharePct != null ? String(i.gainSharePct) : '', offerValidity: i.offerValidity ?? '',
  }
}

export const isSupplierLever = (l?: Lever | null) => !!l && (l.route === 'Supplier change' || /locali[sz]ation/i.test(l.name))
export const showsProposedSupplier = (l?: Lever | null) => !!l && (isSupplierLever(l) || l.group === 'Supply base')

/** Open ideas, and supplier ideas without part codes, are valued by the rough ₹ lakh estimate */
export const isEstimateScope = (f: Pick<FormState, 'scope' | 'parts'>) => f.scope === 'Open' || (f.scope === 'Supplier' && f.parts.length === 0)
/** Part rows are entered for part-specific and supplier ideas */
export const takesParts = (f: Pick<FormState, 'scope'>) => f.scope !== 'Open'

/** Payload for store.saveDraft / store.submitIdea */
export function toPayload(f: FormState, me: User, lever: Lever | undefined, buyerId: string | undefined): Partial<Idea> {
  const isSupplier = me.roles.includes('supplier')
  const estimate = isEstimateScope(f)
  const parts = estimate ? [] : f.parts.map((p) => toIdeaPart(p))
  const scopeSupplier = f.scope === 'Supplier' && f.scopeSupplierCode ? f.scopeSupplierCode : undefined
  const payload: Partial<Idea> = {
    plant: f.plant, buyingType: f.buyingType, categoryId: f.categoryId || undefined, commodity: f.commodity || undefined, leverId: f.leverId || undefined,
    route: lever?.route, scope: (estimate ? 'Open' : 'Part-specific') as IdeaScope, scopeSupplierCode: scopeSupplier, campaignId: f.campaignId || undefined,
    title: f.title.slice(0, 100), currentState: f.currentState, proposedChange: f.proposedChange, evidence: f.evidence, evidenceTags: f.evidenceTags,
    attachments: f.attachments, parts,
    proposedSupplier: showsProposedSupplier(lever) && f.proposedSupplier ? f.proposedSupplier : undefined,
    // savings type is no longer asked — it always follows the lever default; one-time investment is no longer captured
    savingsType: lever?.defaultSavingsType ?? 'Hard', oneTimeInvestment: 0, expectedQuarter: f.expectedQuarter,
    openEstimateLakh: estimate && hasText(f.openEstimateLakh) ? toNum(f.openEstimateLakh) : undefined,
    gainSharePct: isSupplier && hasText(f.gainSharePct) ? toNum(f.gainSharePct) : undefined,
    offerValidity: isSupplier && f.offerValidity ? f.offerValidity : undefined,
    isSupplierSubmission: isSupplier,
    supplierCode: isSupplier ? me.supplierCode : scopeSupplier ?? f.proposedSupplier?.code ?? f.parts[0]?.supplierCode,
    buyerId,
  }
  // identity keys must never be blanked out on an existing record; the store fills placeholders for a new
  // draft, so remember which ones the submitter has not chosen yet (restored as empty on resume)
  for (const k of ['categoryId', 'commodity', 'leverId', 'route', 'buyerId'] as const) if (payload[k] === undefined) delete payload[k]
  ;(payload as any).draftUnset = [!f.categoryId && 'categoryId', !f.commodity && 'commodity', !f.leverId && 'leverId'].filter(Boolean)
  return payload
}

export const isEmptyDraft = (f: FormState) =>
  !hasText(f.title) && !hasText(f.currentState) && !hasText(f.proposedChange) && !hasText(f.evidence) && !f.parts.length && !f.attachments.length && !f.leverId
