// M3 — Submit Idea (Section 7): collapsible form steps + sticky live savings panel; draft saves automatically.
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { BuyingType, Part, User } from '../lib/types'
import { useMe, useStore } from '../store/useStore'
import { can } from '../lib/nav'
import { EVIDENCE_TAGS, LAKH, LEVER_GROUP_STYLE } from '../lib/masters'
import { DEFINITIONS, OUT_OF_SCOPE } from '../lib/scope'
import { approvalLevels, committedInFy, duplicateCandidates, fyMonthsFrom, partAnnualised, savingPct, savingPerUnit, visibleIdeas } from '../lib/calc'
import { fyStartYear, inrPrice, inrShort, nextFy, nowIso, num, prevFy, quarterEnd, quarterStart, QUARTER_MONTHS, sum, timeAgo, todayIso } from '../lib/format'
import { Avatar, Badge, BucketBadge, Button, Card, Chip, EmptyState, Field, Icon, InfoTip, Modal, Money, PageHeader, Segmented, SourceTag, Tooltip, cn } from '../components/ui'
import {
  baselineOverridden, blankForm, fromIdea, fromPart, hasText, isEmptyDraft, isEstimateScope, isSupplierLever, showsProposedSupplier, takesParts, toIdeaPart, toNum, toPayload, volumeOverridden,
  type FormPart, type FormScope, type FormState,
} from './submit/form'
import { Attachments, LeverSelect, PartSearch, RouteBadge, RouteStrip, ScopeSupplierPicker, SupplierSearch } from './submit/widgets'
import { PctBadge, SavingsHero, SavingsPanelBody, tone, type PartCalc, type SavingsCalc } from './submit/SavingsPanel'
import { FIELDS, sectionOfError, type SectionKey } from './submit/fields'
import { FormSection, type SectionState } from './submit/Section'

// Field label with its number
function L({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-4 min-w-4 px-1 rounded bg-slate-100 text-[10px] font-bold text-slate-500 grid place-items-center num">{n}</span>
      {children}
    </span>
  )
}
const Auto = ({ children = 'Auto' }: { children?: React.ReactNode }) => <SourceTag color="#0284c7">{children}</SourceTag>
const Calc = () => <SourceTag color="#7c3aed">Calculated · live</SourceTag>

/** Field wrapper that marks itself for "scroll to first error" */
function FX(props: React.ComponentProps<typeof Field>) {
  const { className, ...rest } = props
  return <div data-err={props.error ? 'true' : undefined} className={cn('min-w-0', className)}><Field {...rest} /></div>
}
const noWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()
const NOSPIN = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
const SCOPE_LABEL: Record<FormScope, string> = { Open: 'Open idea', 'Part-specific': 'Part-specific', Supplier: 'Supplier' }
const AUTO_ADVANCE_MS = 600

export default function SubmitIdea() {
  const me = useMe()
  const [params] = useSearchParams()
  if (!me) return null
  if (!can(me, 'submit')) {
    return <Card><EmptyState icon="Lock" title="Your role does not submit ideas" desc="Submit idea is available to Submitters, Suppliers, Buyers, Technical Evaluators, Commodity Leads and the Sourcing Head (Section 3 permission matrix)." /></Card>
  }
  const draft = params.get('draft')
  const campaign = params.get('campaign')
  return <SubmitForm key={`${draft ?? ''}|${campaign ?? ''}`} me={me} draftParam={draft} campaignParam={campaign} />
}

type FieldStatus = 'typed' | 'auto' | 'hidden' | 'empty'

function SubmitForm({ me, draftParam, campaignParam }: { me: User; draftParam: string | null; campaignParam: string | null }) {
  const nav = useNavigate()
  const levers = useStore((s) => s.levers)
  const categories = useStore((s) => s.categories)
  const commodities = useStore((s) => s.commodities)
  const plants = useStore((s) => s.plants)
  const suppliers = useStore((s) => s.suppliers)
  const partsMaster = useStore((s) => s.parts)
  const campaigns = useStore((s) => s.campaigns)
  const ideas = useStore((s) => s.ideas)
  const users = useStore((s) => s.users)
  const settings = useStore((s) => s.settings)
  const toast = useStore((s) => s.toast)
  const openIdea = useStore((s) => s.openIdea)
  const isSupplier = me.roles.includes('supplier')
  const currentFy = settings.currentFy
  const lastFy = prevFy(currentFy)

  // ─── initial state: ?draft=ID resumes, ?campaign=ID pre-fills ─────────────────
  const init = useMemo(() => {
    const s = useStore.getState()
    let form = blankForm(me, s.settings.currentFy)
    let draftId: string | null = null
    let missing = false
    const auto = new Set<number>()
    const typed = new Set<number>()
    if (draftParam) {
      const d = s.ideas.find((i) => i.id === draftParam && i.stage === 'Draft' && i.submitterId === me.id)
      if (d) {
        form = fromIdea(d, s.parts, s.suppliers)
        draftId = d.id
        const f = form
        const filled: [number, boolean][] = [[5, !!f.commodity], [6, !!f.leverId], [8, !!f.campaignId], [9, hasText(f.title)], [10, hasText(f.currentState)], [11, hasText(f.proposedChange)],
          [12, hasText(f.evidence) || f.evidenceTags.length > 0], [13, f.attachments.length > 0], [14, f.parts.length > 0], [17, !!f.proposedSupplier], [18, f.parts.some(baselineOverridden)],
          [19, f.parts.some((p) => hasText(p.newPrice))], [20, f.parts.some(volumeOverridden)], [24, hasText(f.openEstimateLakh)], [25, hasText(f.gainSharePct)], [26, !!f.offerValidity]]
        filled.forEach(([n, v]) => v && typed.add(n))
        if (f.plant !== me.plant) typed.add(3)
      } else missing = true
    }
    let fromCampaign = null as null | (typeof s.campaigns)[number]
    if (!draftId && campaignParam) {
      const c = s.campaigns.find((x) => x.id === campaignParam)
      if (c) {
        fromCampaign = c
        const cat = s.categories.find((x) => x.id === c.categoryId)
        form = { ...form, campaignId: c.id, categoryId: c.categoryId, commodity: c.commodity, buyingType: cat?.buyingType ?? 'Direct' }
        auto.add(8); auto.add(5)
      }
    }
    if (!draftId && !form.commodity && isSupplier && me.commodities.length) {
      const cm = s.commodities.find((c) => c.code === me.commodities[0])
      const cat = s.categories.find((x) => x.id === cm?.categoryId)
      if (cm && cat) { form = { ...form, commodity: cm.code, categoryId: cat.id, buyingType: cat.buyingType }; auto.add(5) }
    }
    return { form, draftId, missing, auto, typed, fromCampaign }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [form, setForm] = useState<FormState>(init.form)
  const [typed, setTyped] = useState<Set<number>>(init.typed)
  const [draftId, setDraftId] = useState<string | null>(init.draftId)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [openSet, setOpenSet] = useState<Set<SectionKey>>(() => new Set<SectionKey>(['A']))
  const [, setTick] = useState(0)

  const formRef = useRef(form); formRef.current = form
  const draftRef = useRef<string | null>(init.draftId)
  const dirtyRef = useRef(false)
  const doneRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const advancedRef = useRef<Set<SectionKey>>(new Set())

  useEffect(() => { if (init.missing) toast(`Draft ${draftParam} was not found — starting a new idea`, 'warning') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 20000); return () => clearInterval(t) }, [])

  const update = useCallback((patch: Partial<FormState>, fields: number[] = []) => {
    setForm((f) => ({ ...f, ...patch }))
    if (fields.length) setTyped((t) => { const n = new Set(t); fields.forEach((x) => n.add(x)); return n })
    dirtyRef.current = true
    setDirty(true)
  }, [])

  // ─── derived masters ──────────────────────────────────────────────────────────
  const lever = levers.find((l) => l.id === form.leverId)
  const commodity = commodities.find((c) => c.code === form.commodity)
  const plant = plants.find((p) => p.id === form.plant)
  const lead = users.find((u) => u.id === commodity?.leadId)
  const buyer = users.find((u) => u.id === commodity?.buyerId)
  const head = users.find((u) => u.id === 'u-head') ?? users.find((u) => u.roles.includes('head'))
  const myCommodities = isSupplier && me.commodities.length ? commodities.filter((c) => me.commodities.includes(c.code)) : commodities
  // every commodity, grouped by its commodity category — groups matching the buying type first
  const commodityGroups = categories
    .map((cat) => ({ cat, items: myCommodities.filter((c) => c.categoryId === cat.id) }))
    .filter((g) => g.items.length)
    .sort((a, b) => Number(b.cat.buyingType === form.buyingType) - Number(a.cat.buyingType === form.buyingType))
  const isOpen = form.scope === 'Open'
  const isSupplierScope = form.scope === 'Supplier'
  const partsMode = takesParts(form)
  const estimate = isEstimateScope(form)
  const scopeSupplierPool = isSupplier ? suppliers.filter((s) => s.code === me.supplierCode) : suppliers
  const scopeSupplier = isSupplierScope ? suppliers.find((s) => s.code === form.scopeSupplierCode) : undefined
  const myParts = isSupplier ? partsMaster.filter((p) => p.supplierCode === me.supplierCode) : partsMaster
  const partPool = scopeSupplier ? myParts.filter((p) => p.supplierCode === scopeSupplier.code) : myParts
  const campaignOptions = campaigns.filter((c) => (c.status === 'Live' || c.id === form.campaignId) && (!isSupplier || (me.supplierCode && c.suppliers.includes(me.supplierCode))))
  const selCampaign = campaigns.find((c) => c.id === form.campaignId)
  const showSupplierField = showsProposedSupplier(lever)
  const supplierRequired = isSupplierLever(lever)

  // ─── live savings maths (Section 4) ───────────────────────────────────────────
  const calc: SavingsCalc = useMemo(() => {
    const live = form.parts.map((fp) => ({ fp, ip: toIdeaPart(fp, true) }))
    const rows: PartCalc[] = live.map(({ fp, ip }) => ({ partCode: fp.partCode, description: fp.description, uom: fp.uom, unit: savingPerUnit(ip), pct: savingPct(ip), annual: partAnnualised(ip), hasNew: hasText(fp.newPrice) }))
    const annual = estimate ? toNum(form.openEstimateLakh) * LAKH : sum(rows.map((r) => r.annual))
    const baseSpend = sum(live.map((x) => x.ip.baselinePrice * x.ip.annualVolume))
    const pct = estimate ? null : baseSpend ? (annual / baseSpend) * 100 : 0
    const [q, qfy] = form.expectedQuarter.split(' ')
    const goLive = quarterStart(q, qfy)
    const committed = committedInFy(annual, goLive, currentFy)
    return {
      isOpen: estimate, rows: estimate ? [] : rows, annual, pct, committed, carry: annual - committed,
      monthsInFy: fyMonthsFrom(goLive, currentFy), goLive, quarter: form.expectedQuarter, levels: approvalLevels(annual, 0, settings.xThresholdLakh, settings.yThresholdLakh),
    }
  }, [form.parts, form.openEstimateLakh, form.expectedQuarter, estimate, currentFy, settings.xThresholdLakh, settings.yThresholdLakh])

  // ─── duplicate check on idea name + commodity ─────────────────────────────────
  const dTitle = useDeferredValue(form.title)
  const dupePool = useMemo(() => (isSupplier ? visibleIdeas(me, ideas) : ideas), [isSupplier, me, ideas])
  const dupes = useMemo(() => (dTitle.trim().length >= 4 ? duplicateCandidates(dupePool, dTitle, form.commodity, draftId ?? undefined) : []), [dTitle, dupePool, form.commodity, draftId])

  // ─── ID preview (COIN-FY27-FAS-0012) ──────────────────────────────────────────
  const idPreview = useMemo(() => {
    if (!form.commodity) return null
    const seqs = ideas.filter((i) => i.commodity === form.commodity && i.fy === currentFy).map((i) => i.seq)
    return `COIN-${currentFy}-${form.commodity}-${String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(4, '0')}`
  }, [ideas, form.commodity, currentFy])

  // ─── validation ───────────────────────────────────────────────────────────────
  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    const f = form
    if (!f.plant) e.plant = 'Select the plant / BU'
    if (!f.commodity) e.commodity = 'Select a commodity'
    if (!f.leverId) e.lever = 'Choose a category'
    if (f.scope === 'Supplier' && !f.scopeSupplierCode) e.scopeSupplier = 'Choose the supplier this idea is for'
    if (!hasText(f.title)) e.title = 'Idea name is required'
    else if (f.title.length > 100) e.title = 'Idea name must be 100 characters or fewer'
    if (!hasText(f.currentState)) e.currentState = 'Describe how it is done / bought today'
    if (!hasText(f.proposedChange)) e.proposedChange = 'Describe what changes'
    if (f.scope === 'Part-specific' && !f.parts.length) e.parts = 'Add at least one part code for a part-specific idea'
    if (takesParts(f)) {
      f.parts.forEach((p) => {
        if (toNum(p.baselinePrice) <= 0) e[`base:${p.partCode}`] = 'Baseline price is required'
        if (!hasText(p.newPrice)) e[`new:${p.partCode}`] = 'Enter the expected new price'
        else if (toNum(p.newPrice) <= 0) e[`new:${p.partCode}`] = 'Must be greater than ₹ 0'
        if (toNum(p.annualVolume) <= 0) e[`vol:${p.partCode}`] = 'Annual volume is required'
        if (baselineOverridden(p) && !hasText(p.baselineOverrideReason)) e[`baseReason:${p.partCode}`] = 'Override needs a reason'
        if (volumeOverridden(p) && !hasText(p.volumeOverrideReason)) e[`volReason:${p.partCode}`] = 'Override needs a reason'
      })
    }
    if (isEstimateScope(f) && toNum(f.openEstimateLakh) <= 0) e.openEstimate = f.scope === 'Supplier' ? 'Add part codes in C, or enter a rough annual impact in ₹ lakh' : 'Enter a rough annual impact in ₹ lakh'
    if (supplierRequired && !f.proposedSupplier) e.proposedSupplier = 'Proposed supplier is required for a supplier category'
    if (!f.expectedQuarter) e.quarter = 'Select the expected implementation quarter'
    if (isSupplier && hasText(f.gainSharePct) && (toNum(f.gainSharePct) < 0 || toNum(f.gainSharePct) > 100)) e.gainShare = 'Enter a percentage between 0 and 100'
    if (isSupplier && f.offerValidity && f.offerValidity < todayIso()) e.offerValidity = 'Validity must be today or a future date'
    return e
  }, [form, supplierRequired, isSupplier])
  const err = (k: string) => (showErrors ? errors[k] : undefined)

  // ─── accordion steps ──────────────────────────────────────────────────────────
  const order: SectionKey[] = isSupplier ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D']
  const sectionStates: Record<SectionKey, SectionState> = useMemo(() => {
    const missing = (k: SectionKey) => Object.keys(errors).filter((e) => sectionOfError(e) === k).length
    const required: Record<SectionKey, number> = {
      A: 3 + (form.scope === 'Supplier' ? 1 : 0), // plant, commodity, category (+ supplier)
      B: 3, // idea name, current state, proposed change
      C: (form.scope === 'Part-specific' ? 1 : 0) + (supplierRequired ? 1 : 0),
      D: 1 + (isEstimateScope(form) ? 1 : form.parts.length * 3), // quarter + estimate or per-part baseline / new price / volume
      E: 0,
    }
    return { A: { required: required.A, missing: missing('A') }, B: { required: required.B, missing: missing('B') }, C: { required: required.C, missing: missing('C') }, D: { required: required.D, missing: missing('D') }, E: { required: required.E, missing: missing('E') } }
  }, [errors, form, supplierRequired])
  const allOpen = order.every((k) => openSet.has(k))
  const toggleSection = (k: SectionKey) => setOpenSet((s) => (s.size === 1 && s.has(k) ? new Set<SectionKey>() : new Set<SectionKey>([k])))
  const openOnly = (k: SectionKey) => setOpenSet(new Set<SectionKey>([k]))
  const toggleAll = () => setOpenSet(allOpen ? new Set<SectionKey>() : new Set<SectionKey>(order))

  // auto-advance: once the single open step is complete, collapse it and open the next one (debounced, once per step)
  const accRef = useRef({ openSet, sectionStates, order }); accRef.current = { openSet, sectionStates, order }
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      const { openSet: open, sectionStates: st, order: ord } = accRef.current
      if (open.size !== 1) return
      const cur = [...open][0]
      const s = st[cur]
      if (advancedRef.current.has(cur) || s.required === 0 || s.missing > 0) return
      const next = ord[ord.indexOf(cur) + 1]
      if (!next) return
      advancedRef.current.add(cur)
      setOpenSet(new Set<SectionKey>([next]))
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [form, dirty])

  // ─── draft autosave (debounced 1.2 s) ─────────────────────────────────────────
  const persistDraft = useCallback((fromUnmount = false) => {
    const f = formRef.current
    const s = useStore.getState()
    const lv = s.levers.find((l) => l.id === f.leverId)
    const cm = s.commodities.find((c) => c.code === f.commodity)
    const payload = toPayload(f, me, lv, cm?.buyerId)
    const id = s.saveDraft(payload, draftRef.current ?? undefined)
    if (!draftRef.current) {
      draftRef.current = id
      if (!fromUnmount) {
        setDraftId(id)
        if (window.location.pathname === '/submit') window.history.replaceState(window.history.state, '', `/submit?draft=${id}`)
      }
    }
    if (!fromUnmount) { setSavedAt(nowIso()); setPending(false) }
    return id
  }, [me])

  useEffect(() => {
    if (!dirty || doneRef.current) return
    setPending(true)
    const t = setTimeout(() => persistDraft(), 1200)
    timerRef.current = t
    return () => clearTimeout(t)
  }, [form, dirty, persistDraft])

  const persistRef = useRef(persistDraft); persistRef.current = persistDraft
  useEffect(() => () => {
    clearTimeout(timerRef.current)
    if (dirtyRef.current && !doneRef.current && !isEmptyDraft(formRef.current)) persistRef.current(true)
  }, [])

  const saveNow = useCallback(() => {
    if (isEmptyDraft(formRef.current) && !draftRef.current) { toast('Nothing to save yet — start with an idea name or a category', 'info'); return }
    clearTimeout(timerRef.current)
    const id = persistDraft()
    toast(`Draft saved · ${id}`, 'success')
  }, [persistDraft, toast])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [saveNow])

  const leave = () => { const idx = (window.history.state as any)?.idx; if (typeof idx === 'number' && idx > 0) nav(-1); else nav('/') }

  // ─── actions ─────────────────────────────────────────────────────────────────
  const submit = () => {
    setShowErrors(true)
    const keys = Object.keys(errors)
    if (keys.length) {
      const n = keys.length
      toast(`${n} field${n === 1 ? ' needs' : 's need'} attention before submitting`, 'error')
      setSheet(false)
      setOpenSet(new Set<SectionKey>(keys.map(sectionOfError)))
      setTimeout(() => document.querySelector('[data-err="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
      return
    }
    clearTimeout(timerRef.current)
    doneRef.current = true
    const payload = toPayload(form, me, lever, commodity?.buyerId)
    const id = useStore.getState().submitIdea(payload, draftRef.current ?? undefined)
    toast(`${id} submitted for validation — sent to ${buyer?.name ?? 'the Commodity Buyer'}`, 'success')
    nav(`/ideas/${id}`)
  }
  const cancel = () => {
    const empty = isEmptyDraft(form)
    if (empty) {
      clearTimeout(timerRef.current)
      doneRef.current = true
      if (draftRef.current) useStore.getState().deleteDraft(draftRef.current)
      leave()
      return
    }
    if (dirty || draftRef.current) { setCancelOpen(true); return }
    doneRef.current = true
    leave()
  }

  // ─── field handlers ──────────────────────────────────────────────────────────
  const setBuyingType = (bt: BuyingType) => {
    const keep = categories.find((c) => c.id === commodity?.categoryId)?.buyingType === bt
    update({ buyingType: bt, ...(keep ? {} : { categoryId: '', commodity: '' }) }, [4])
  }
  /** The commodity decides the commodity category (categoryId) and the buying type */
  const setCommodity = (code: string) => {
    const cm = commodities.find((c) => c.code === code)
    const cat = categories.find((c) => c.id === cm?.categoryId)
    const sup = suppliers.find((s) => s.code === form.scopeSupplierCode)
    const keepSupplier = !cm || !sup || sup.commodities.includes(cm.code)
    update({ commodity: code, categoryId: cm?.categoryId ?? '', ...(cat ? { buyingType: cat.buyingType } : {}), ...(keepSupplier ? {} : { scopeSupplierCode: '' }) }, [5])
  }
  const setLever = (id: string) => update({ leverId: id }, [6])
  const setScope = (k: FormScope) => {
    const patch: Partial<FormState> = { scope: k }
    if (k === 'Supplier' && isSupplier && me.supplierCode && !form.scopeSupplierCode) patch.scopeSupplierCode = me.supplierCode
    update(patch, [7])
  }
  const addPart = (p: Part) => {
    const patch: Partial<FormState> = { parts: [...form.parts, fromPart(p, suppliers)] }
    if (!form.commodity) {
      const cm = commodities.find((c) => c.code === p.commodity)
      const cat = categories.find((c) => c.id === cm?.categoryId)
      if (cm && cat) Object.assign(patch, { commodity: cm.code, categoryId: cat.id, buyingType: cat.buyingType })
    }
    update(patch, [14])
  }
  const removePart = (code: string) => {
    const prev = form.parts
    update({ parts: prev.filter((p) => p.partCode !== code) })
    toast(`Removed part ${code}`, 'info', () => update({ parts: prev }))
  }
  const setPart = (code: string, patch: Partial<FormPart>, field?: number) => update({ parts: form.parts.map((p) => (p.partCode === code ? { ...p, ...patch } : p)) }, field ? [field] : [])

  // ─── "You typed N of 26 fields" ───────────────────────────────────────────────
  const hasValue: Record<number, boolean> = {
    3: !!form.plant, 4: true, 5: !!form.commodity, 6: !!form.leverId, 7: true, 8: !!form.campaignId, 9: hasText(form.title), 10: hasText(form.currentState),
    11: hasText(form.proposedChange), 12: hasText(form.evidence) || form.evidenceTags.length > 0, 13: form.attachments.length > 0, 14: partsMode && form.parts.length > 0,
    17: showSupplierField && !!form.proposedSupplier, 18: partsMode && form.parts.some(baselineOverridden), 19: partsMode && form.parts.some((p) => hasText(p.newPrice)),
    20: partsMode && form.parts.some(volumeOverridden), 23: true, 24: estimate && hasText(form.openEstimateLakh),
    25: isSupplier && hasText(form.gainSharePct), 26: isSupplier && !!form.offerValidity,
  }
  const hasParts = partsMode && form.parts.length > 0
  const statusOf = (n: number): FieldStatus => {
    if (typed.has(n) && hasValue[n]) return 'typed'
    if ([25, 26].includes(n) && !isSupplier) return 'hidden'
    if (n === 24 && !estimate) return 'hidden'
    if (n === 17 && !showSupplierField) return 'hidden'
    if (isOpen && [14, 15, 16, 18, 19, 20, 21, 22].includes(n)) return 'hidden'
    if ([1, 2, 3].includes(n)) return 'auto'
    if ([15, 16, 18, 20, 21, 22].includes(n)) return hasParts ? 'auto' : 'empty'
    if ([5, 8].includes(n) && init.auto.has(n) && hasValue[n]) return 'auto'
    if ([4, 7, 23].includes(n)) return 'auto'
    return hasValue[n] ? 'typed' : 'empty'
  }
  const quarterOptions = [currentFy, nextFy(currentFy)].flatMap((fy) => (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
    const y = q === 'Q4' ? fyStartYear(fy) + 1 : fyStartYear(fy)
    return { value: `${q} ${fy}`, label: `${q} ${fy} · ${QUARTER_MONTHS[q]} ${y}`, past: quarterEnd(q, fy) < todayIso() }
  }))
  const leverStyle = lever ? LEVER_GROUP_STYLE[lever.group] : null
  const savedLabel = savedAt ? ((Date.now() - new Date(savedAt).getTime()) / 1000 < 60 ? 'just now' : timeAgo(savedAt)) : null
  const singleUnit = !estimate && calc.rows.length === 1 ? calc.rows[0] : undefined

  // one-line summaries for collapsed steps
  const summaries: Record<SectionKey, string> = {
    A: [commodity ? `${commodity.name} · ${commodity.code}` : 'No commodity yet', lever?.name ?? 'No category yet',
      isSupplierScope ? `Supplier${scopeSupplier ? ` · ${scopeSupplier.name}` : ''}` : SCOPE_LABEL[form.scope], plant?.name].filter(Boolean).join('  ·  '),
    B: [hasText(form.title) ? form.title : 'No idea name yet', form.attachments.length ? `${form.attachments.length} attachment${form.attachments.length === 1 ? '' : 's'}` : ''].filter(Boolean).join('  ·  '),
    C: isOpen ? 'Open idea — no part codes' : [form.parts.length ? `${form.parts.length} part${form.parts.length === 1 ? '' : 's'}: ${form.parts.slice(0, 3).map((p) => p.partCode).join(', ')}${form.parts.length > 3 ? '…' : ''}` : isSupplierScope ? 'No part codes — valued by estimate' : 'No part codes yet',
      form.proposedSupplier ? `Proposed ${form.proposedSupplier.name}` : ''].filter(Boolean).join('  ·  '),
    D: `${estimate ? (hasText(form.openEstimateLakh) ? `Estimate ${inrShort(calc.annual)}` : 'No estimate yet') : `Annualised ${inrShort(calc.annual)}`}  ·  ${form.expectedQuarter}`,
    E: [hasText(form.gainSharePct) ? `Gain-share ${form.gainSharePct}%` : '', form.offerValidity ? `Valid to ${form.offerValidity}` : ''].filter(Boolean).join('  ·  ') || 'Optional — gain-share and offer validity',
  }

  const draftStatus = (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted whitespace-nowrap">
      {pending ? <><Icon name="Loader2" size={13} className="animate-spin" />Saving draft…</>
        : savedLabel ? <><Icon name="CircleCheck" size={13} className="text-emerald-600" />Draft saved · {savedLabel}</>
          : <><Icon name="FileClock" size={13} />Draft saves automatically</>}
    </span>
  )

  const panelBody = (
    <SavingsPanelBody c={calc} lever={lever} currentFy={currentFy} nextFyLabel={nextFy(currentFy)} leadName={lead?.name} headName={head?.name}
      xLakh={settings.xThresholdLakh} hasCommodity={!!commodity} />
  )

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader2
        draftId={draftId} draftStatus={draftStatus}
        onCancel={cancel} onSave={saveNow} allOpen={allOpen} onToggleAll={toggleAll}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {init.fromCampaign && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex flex-wrap items-center gap-3">
              <span className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 grid place-items-center"><Icon name={init.fromCampaign.type === 'Workshop' ? 'Presentation' : 'Megaphone'} size={16} /></span>
              <div className="min-w-[200px] flex-1">
                <div className="text-[13px] font-semibold text-ink truncate">Submitting for {init.fromCampaign.name}</div>
                <div className="text-[11.5px] text-muted">{init.fromCampaign.type} · {init.fromCampaign.id} · campaign and commodity were set from the campaign link</div>
              </div>
              <span className="hidden sm:inline-flex"><Badge color="#ec8a1c" icon="Link2">Campaign pre-fill</Badge></span>
            </motion.div>
          )}

          {/* ─── A. Classification ─────────────────────────────────────────── */}
          <FormSection letter="A" title="Classification" subtitle="Fields 1–8 · who, where, and the category that decides the route" icon="Tags"
            open={openSet.has('A')} onToggle={() => toggleSection('A')} summary={summaries.A} state={sectionStates.A}
            extra={<Auto>{[1, 2, 3].filter((n) => statusOf(n) === 'auto').length + (init.auto.has(8) ? 1 : 0)} auto</Auto>}>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-3 rounded-lg bg-slate-50/80 border border-line px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={me.name} color={me.avatarColor} size={34} />
                  <div className="min-w-0">
                    <div className="label !mb-0.5 justify-between"><L n={1}>Submitter name, employee ID</L></div>
                    <div className="text-[13.5px] font-semibold text-ink truncate">{me.name}</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="label !mb-0.5 gap-2">{isSupplier ? 'Vendor code' : 'Employee ID'} <Auto>Auto · from login</Auto></div>
                  <div className="text-[13.5px] font-semibold text-ink num">{me.employeeId}</div>
                </div>
                <div className="min-w-0">
                  <div className="label !mb-0.5 gap-2"><L n={2}>Department</L><Auto>Auto · from login</Auto></div>
                  <div className="text-[13.5px] font-semibold text-ink truncate">{me.department}{isSupplier && <span className="text-muted font-normal"> · {suppliers.find((s) => s.code === me.supplierCode)?.name}</span>}</div>
                </div>
              </div>

              <FX className="col-span-12 sm:col-span-6 xl:col-span-4" label={<L n={3}>Plant / BU</L>} required error={err('plant')} tag={!typed.has(3) ? <Tooltip content="Defaults to your plant from login"><Auto /></Tooltip> : undefined}>
                <select className="input" value={form.plant} onChange={(e) => update({ plant: e.target.value }, [3])}>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id}) · {p.bu}</option>)}
                </select>
              </FX>
              <FX className="col-span-12 sm:col-span-6 xl:col-span-3" label={<L n={4}>Buying type</L>} required>
                <Segmented value={form.buyingType} onChange={(k) => setBuyingType(k as BuyingType)} size="sm" options={[{ key: 'Direct', label: 'Direct', icon: 'Boxes' }, { key: 'Indirect', label: 'Indirect', icon: 'Truck' }]} />
              </FX>
              <FX className="col-span-12 xl:col-span-5" label={<L n={5}>Commodity</L>} required error={err('commodity')}
                tag={init.auto.has(5) && !typed.has(5) && form.commodity ? <Auto /> : undefined}
                hint={commodity ? `Commodity group: ${categories.find((c) => c.id === commodity.categoryId)?.name ?? '—'} (set automatically)` : undefined}>
                <select className={cn('input', err('commodity') && '!border-red-400')} value={form.commodity} onChange={(e) => setCommodity(e.target.value)}>
                  <option value="">Select a commodity…</option>
                  {commodityGroups.map(({ cat, items }) => (
                    <optgroup key={cat.id} label={`${cat.name} · ${cat.buyingType}`}>
                      {items.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}
                    </optgroup>
                  ))}
                </select>
              </FX>

              <FX className="col-span-12 xl:col-span-6" label={<L n={6}>Category</L>} required error={err('lever')} tag={lever ? <RouteBadge route={lever.route} /> : undefined}>
                <LeverSelect levers={levers} value={form.leverId} onChange={setLever} error={!!err('lever')} placeholder="Choose a category" />
              </FX>
              <FX className="col-span-12 sm:col-span-6 xl:col-span-6" label={<L n={7}>Idea scope</L>} required
                hint={isOpen ? 'Tagged to commodity only' : isSupplierScope ? 'Raised for one supplier — part codes optional' : 'Linked to one or more part codes'}>
                <Segmented value={form.scope} onChange={(k) => setScope(k as FormScope)} size="sm" options={[
                  { key: 'Open', label: <span className="whitespace-nowrap">Open idea</span> },
                  { key: 'Part-specific', label: <span className="whitespace-nowrap">Part-specific</span> },
                  { key: 'Supplier', label: <span className="whitespace-nowrap">Supplier</span> },
                ]} />
              </FX>
              <AnimatePresence initial={false}>
                {isSupplierScope && (
                  <motion.div key="scope-supplier" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="col-span-12 sm:col-span-6 min-w-0">
                    <FX label="Supplier" required error={err('scopeSupplier')}
                      tag={<span className="text-[11px] text-muted">{commodity ? `Suppliers of ${commodity.name}` : 'All suppliers'}</span>}>
                      <ScopeSupplierPicker suppliers={scopeSupplierPool} commodity={form.commodity} value={form.scopeSupplierCode}
                        onChange={(code) => update({ scopeSupplierCode: code }, [7])} error={!!err('scopeSupplier')} />
                    </FX>
                  </motion.div>
                )}
              </AnimatePresence>
              <FX className="col-span-12 sm:col-span-6" label={<L n={8}>Campaign / workshop</L>} tag={init.auto.has(8) && form.campaignId === init.fromCampaign?.id ? <Tooltip content="Auto-set when opened from a campaign link"><Auto /></Tooltip> : undefined}
                hint={selCampaign ? `${selCampaign.type} · ${selCampaign.status}` : 'Optional'}>
                <select className="input" value={form.campaignId} onChange={(e) => update({ campaignId: e.target.value }, [8])}>
                  <option value="">None</option>
                  {campaignOptions.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}
                </select>
              </FX>

              <AnimatePresence initial={false}>
                {lever && leverStyle && (
                  <motion.div key="route" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="col-span-12 overflow-hidden">
                    <div className="rounded-lg border px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ background: leverStyle.soft, borderColor: `${leverStyle.color}33` }}>
                      <span className="flex items-center gap-2 text-[12px] font-semibold shrink-0" style={{ color: leverStyle.text }}>
                        <Icon name="Route" size={14} />Route the idea will take
                      </span>
                      <RouteStrip route={lever.route} />
                      <span className="text-[11.5px] text-muted ml-auto">Evaluator {lever.evaluator} · NPD sample {lever.npdSample}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FormSection>

          {/* ─── B. Idea details ────────────────────────────────────────────── */}
          <FormSection letter="B" title="Idea details" subtitle="Fields 9–13 · what it is, today vs proposed, and the proof" icon="NotebookPen"
            open={openSet.has('B')} onToggle={() => toggleSection('B')} summary={summaries.B} state={sectionStates.B}>
            <div className="grid grid-cols-12 gap-3">
              <FX className="col-span-12" label={<L n={9}>Idea name</L>} required error={err('title')}
                tag={<span className={cn('text-[11px] font-semibold num', form.title.length > 90 ? 'text-amber-600' : 'text-muted')}>{form.title.length} / 100 characters</span>}>
                <input className={cn('input', err('title') && '!border-red-400')} maxLength={100} value={form.title} onChange={(e) => update({ title: e.target.value }, [9])}
                  placeholder="Idea name, e.g. Reduce gauge on condenser side bracket from 1.2 mm to 1.0 mm" />
              </FX>
              <AnimatePresence initial={false}>
                {dupes.length > 0 && (
                  <motion.div key="dupes" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="col-span-12 overflow-hidden -mt-1">
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70">
                      <div className="flex items-center gap-2 px-3 pt-2 pb-1 text-[12px] font-semibold text-amber-800">
                        <Icon name="CopyCheck" size={14} />Similar existing ideas ({dupes.length}) — duplicate check on idea name + commodity
                      </div>
                      {dupes.map(({ idea, score }) => (
                        <div key={idea.id} className="flex items-center gap-3 px-3 py-1.5 border-t border-amber-100 text-[12.5px]">
                          <span className="font-mono text-[11.5px] text-ink-2 shrink-0 hidden sm:inline">{idea.id}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{idea.title}</span>
                          <span className="hidden md:inline-flex"><BucketBadge bucket={idea.bucket} /></span>
                          <span className="text-[11px] font-semibold text-amber-700 num shrink-0">{Math.round(Math.min(1, score) * 100)}% match</span>
                          <button type="button" onClick={() => openIdea(idea.id)} className="text-[12px] font-semibold text-brand-700 hover:underline shrink-0">view</button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <FX className="col-span-12 md:col-span-6" label={<L n={10}>Current state</L>} required error={err('currentState')}>
                <textarea className={cn('input', err('currentState') && '!border-red-400')} rows={3} value={form.currentState} onChange={(e) => update({ currentState: e.target.value }, [10])} placeholder="How it is done / bought today" />
              </FX>
              <FX className="col-span-12 md:col-span-6" label={<L n={11}>Proposed change</L>} required error={err('proposedChange')}>
                <textarea className={cn('input', err('proposedChange') && '!border-red-400')} rows={3} value={form.proposedChange} onChange={(e) => update({ proposedChange: e.target.value }, [11])} placeholder="What changes" />
              </FX>
              <FX className="col-span-12 lg:col-span-6" label={<L n={12}>Evidence</L>} tag={<span className="text-[11px] text-muted">Optional</span>}>
                <textarea className="input" rows={2} value={form.evidence} onChange={(e) => update({ evidence: e.target.value }, [12])} placeholder="Trial result, supplier quote, benchmark or drawing reference" />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {EVIDENCE_TAGS.map((t) => {
                    const on = form.evidenceTags.includes(t)
                    return (
                      <Chip key={t} active={on} onClick={() => update({ evidenceTags: on ? form.evidenceTags.filter((x) => x !== t) : [...form.evidenceTags, t] }, [12])}>
                        <Icon name={t === 'Trial' ? 'FlaskConical' : t === 'Quote' ? 'Receipt' : t === 'Benchmark' ? 'Scale' : 'DraftingCompass'} size={12} />{t}
                      </Chip>
                    )
                  })}
                </div>
              </FX>
              <FX className="col-span-12 lg:col-span-6" label={<L n={13}>Attachments</L>} tag={<span className="text-[11px] text-muted">Optional</span>}>
                <Attachments value={form.attachments} onChange={(a) => update({ attachments: a }, [13])} me={me} />
              </FX>
            </div>
          </FormSection>

          {/* ─── C. Parts ───────────────────────────────────────────────────── */}
          <FormSection letter="C" title="Parts" subtitle="Fields 14–17 · part master fills description, UoM and supplier in place" icon="Boxes"
            open={openSet.has('C')} onToggle={() => toggleSection('C')} summary={summaries.C} state={sectionStates.C}
            extra={!isOpen ? <span className="text-[11.5px] text-muted num">{form.parts.length} part{form.parts.length === 1 ? '' : 's'}</span> : <Badge color="#64748b">Open idea</Badge>}>
            {isOpen ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 flex flex-wrap items-center gap-3">
                <Icon name="Info" size={16} className="text-sky-600" />
                <div className="flex-1 min-w-[200px] text-[12.5px] text-ink-2"><b>Open idea</b> — {DEFINITIONS.find((d) => d[0] === 'Open idea')?.[1]}. Give a rough annual estimate in step D.</div>
                <Button size="sm" variant="outline" icon="Boxes" onClick={() => setScope('Part-specific')}>Make it part-specific</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {isSupplierScope && (
                  <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-[12px] text-ink-2 flex items-center gap-2">
                    <Icon name="Factory" size={14} className="text-teal-700 shrink-0" />
                    {scopeSupplier
                      ? <span>Supplier idea for <b>{scopeSupplier.name}</b> — part codes are optional. Add this supplier's parts to value the idea per part, or leave empty and give an estimate in step D.</span>
                      : <span>Supplier idea — choose the supplier in step A. Part codes are optional.</span>}
                  </div>
                )}
                <FX label={<L n={14}>Part code(s)</L>} required={form.scope === 'Part-specific'} error={err('parts')} tag={<SourceTag color="#64748b">{isSupplierScope ? 'Optional · multi-select search' : 'Multi-select search'}</SourceTag>}>
                  <PartSearch parts={partPool} commodity={form.commodity} selected={form.parts.map((p) => p.partCode)} onPick={addPart}
                    restrictNote={isSupplier ? 'Showing parts you supply to Amber' : scopeSupplier ? `Showing parts supplied by ${scopeSupplier.name}` : undefined} />
                </FX>
                {form.parts.length > 0 ? (
                  <div className="rounded-lg border border-line overflow-hidden">
                    <div className="hidden md:grid grid-cols-[150px_minmax(0,1.5fr)_minmax(0,1fr)_32px] gap-3 px-3 h-8 items-center bg-slate-50 border-b border-line text-[11.5px] font-semibold text-muted">
                      <span>Part code</span>
                      <span className="flex items-center gap-1.5"><L n={15}>Part description, UoM</L><Tooltip content="From part master"><Auto /></Tooltip></span>
                      <span className="flex items-center gap-1.5"><L n={16}>Current supplier(s)</L><Tooltip content="From last PO / MRN, vendor code + name"><Auto /></Tooltip></span>
                      <span />
                    </div>
                    <AnimatePresence initial={false}>
                      {form.parts.map((p) => (
                        <motion.div key={p.partCode} layout initial={{ opacity: 0, backgroundColor: '#fff1f2' }} animate={{ opacity: 1, backgroundColor: '#ffffff' }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
                          className="grid grid-cols-[1fr_32px] md:grid-cols-[150px_minmax(0,1.5fr)_minmax(0,1fr)_32px] gap-x-3 gap-y-1 px-3 py-2 items-center border-b border-slate-100 last:border-0">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[12.5px] font-semibold text-ink">{p.partCode}</span>
                            {form.commodity && p.commodity !== form.commodity && <Tooltip content="This part belongs to a different commodity than the one selected"><SourceTag color="#ec8a1c">{p.commodity}</SourceTag></Tooltip>}
                            {scopeSupplier && p.supplierCode !== scopeSupplier.code && <Tooltip content="This part is bought from a different supplier than the one this idea is for"><SourceTag color="#ec8a1c">Other supplier</SourceTag></Tooltip>}
                          </span>
                          <button type="button" onClick={() => removePart(p.partCode)} className="md:hidden justify-self-end h-7 w-7 rounded-md grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50"><Icon name="X" size={14} /></button>
                          <span className="min-w-0 col-span-2 md:col-span-1">
                            <span className="block text-[12.5px] text-ink truncate">{p.description}</span>
                            <span className="block text-[11px] text-muted">UoM {p.uom}</span>
                          </span>
                          <span className="min-w-0 col-span-2 md:col-span-1 text-[12.5px] text-ink-2 truncate">{p.currentSupplier}</span>
                          <button type="button" onClick={() => removePart(p.partCode)} className="hidden md:grid h-7 w-7 rounded-md place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove part"><Icon name="X" size={14} /></button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 px-4 py-4 text-center text-[12.5px] text-muted">
                    No part code yet — search the ERP part master above; description, UoM, supplier, baseline and volume fill in automatically.
                  </div>
                )}
              </div>
            )}
            {showSupplierField && (
              <FX className="mt-3" label={<L n={17}>Proposed supplier</L>} required={supplierRequired} error={err('proposedSupplier')}
                tag={<span className="text-[11px] text-muted">{supplierRequired ? 'Required for a supplier category' : 'Optional'}</span>}>
                <SupplierSearch suppliers={suppliers} commodity={form.commodity} value={form.proposedSupplier} onChange={(v) => update({ proposedSupplier: v }, [17])}
                  exclude={form.parts.map((p) => p.supplierCode)} error={!!err('proposedSupplier')} />
              </FX>
            )}
          </FormSection>

          {/* ─── D. Expected impact ─────────────────────────────────────────── */}
          <FormSection letter="D" title="Expected impact" subtitle="Fields 18–24 · one rule: price delta per unit × volume" icon="IndianRupee"
            open={openSet.has('D')} onToggle={() => toggleSection('D')} summary={summaries.D} state={sectionStates.D}
            extra={<InfoTip title="Baseline price">Last buying price (LBP) of the part; if none, current PO price; for a new part, the quoted price (same rule as the Price Approval Portal). Baseline and volume are auto-filled; an override needs a mandatory reason and is logged.</InfoTip>}>
            {partsMode && (
              form.parts.length ? (
                <div className="rounded-lg border border-line overflow-hidden mb-3">
                  <div className="hidden lg:grid grid-cols-[minmax(0,0.85fr)_0.95fr_0.95fr_1.15fr_0.85fr_0.95fr] gap-3 px-3 py-2 bg-slate-50 border-b border-line text-[11.5px] leading-tight font-semibold text-muted items-end">
                    <span>Part</span>
                    <span><L n={18}>Baseline price / unit (₹)</L></span>
                    <span><L n={19}>Expected new price / unit (₹)</L></span>
                    <span><L n={20}>Annual volume</L></span>
                    <span className="text-right"><L n={21}>Saving / unit and %</L></span>
                    <span className="text-right"><L n={22}>Annualised impact (₹)</L></span>
                  </div>
                  {form.parts.map((p) => {
                    const row = calc.rows.find((r) => r.partCode === p.partCode)!
                    const bo = baselineOverridden(p), vo = volumeOverridden(p)
                    return (
                      <div key={p.partCode} className="px-3 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,0.85fr)_0.95fr_0.95fr_1.15fr_0.85fr_0.95fr] gap-3 items-start">
                          <div className="col-span-2 lg:col-span-1 min-w-0 lg:pt-2">
                            <div className="font-mono text-[12.5px] font-semibold text-ink">{p.partCode}</div>
                            <div className="text-[11.5px] text-muted truncate">{p.description}</div>
                          </div>
                          <div data-err={err(`base:${p.partCode}`) || err(`baseReason:${p.partCode}`) ? 'true' : undefined} className="min-w-0">
                            <div className="lg:hidden"><div className="label"><L n={18}>Baseline price / unit (₹)</L></div></div>
                            <div className="relative">
                              <input type="number" inputMode="decimal" min={0} step="any" onWheel={noWheel} className={cn(NOSPIN, 'input num !pr-8', bo && '!border-amber-300 !bg-amber-50/40', err(`base:${p.partCode}`) && '!border-red-400')}
                                value={p.baselinePrice} onChange={(e) => setPart(p.partCode, { baselinePrice: e.target.value }, 18)} />
                              {bo && <button type="button" title="Restore auto-filled baseline" onClick={() => setPart(p.partCode, { baselinePrice: String(p.autoBaseline), baselineOverrideReason: '' })} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-amber-600 hover:bg-amber-100"><Icon name="RotateCcw" size={12} /></button>}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              {bo ? <SourceTag color="#ec8a1c">Override · auto {inrPrice(p.autoBaseline)}</SourceTag> : <SourceTag>{p.autoBaselineSource === 'LBP' ? 'from LBP' : 'from PO price'}</SourceTag>}
                            </div>
                            {err(`base:${p.partCode}`) && <div className="text-[11.5px] text-red-600 mt-1">{err(`base:${p.partCode}`)}</div>}
                          </div>
                          <div data-err={err(`new:${p.partCode}`) ? 'true' : undefined} className="min-w-0">
                            <div className="lg:hidden"><div className="label"><L n={19}>Expected new price / unit (₹)</L></div></div>
                            <input type="number" inputMode="decimal" min={0} step="any" onWheel={noWheel} placeholder="0.00" className={cn(NOSPIN, 'input num', err(`new:${p.partCode}`) && '!border-red-400')}
                              value={p.newPrice} onChange={(e) => setPart(p.partCode, { newPrice: e.target.value }, 19)} />
                            <div className="mt-1 text-[11px] text-muted">{hasText(p.newPrice) ? `${inrPrice(toNum(p.newPrice))} / ${p.uom}` : 'Per part code'}</div>
                            {err(`new:${p.partCode}`) && <div className="text-[11.5px] text-red-600">{err(`new:${p.partCode}`)}</div>}
                          </div>
                          <div data-err={err(`vol:${p.partCode}`) || err(`volReason:${p.partCode}`) ? 'true' : undefined} className="min-w-0">
                            <div className="lg:hidden"><div className="label"><L n={20}>Annual volume</L></div></div>
                            <div className="relative">
                              <input type="number" inputMode="numeric" min={0} step="1" onWheel={noWheel} className={cn(NOSPIN, 'input num !pr-12', vo && '!border-amber-300 !bg-amber-50/40', err(`vol:${p.partCode}`) && '!border-red-400')}
                                value={p.annualVolume} onChange={(e) => setPart(p.partCode, { annualVolume: e.target.value }, 20)} />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted">{p.uom}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              {vo ? <SourceTag color="#ec8a1c">Override · MRN {num(p.autoVolume)}</SourceTag> : p.autoVolume > 0 ? <SourceTag>from MRN {lastFy}</SourceTag> : <SourceTag color="#ec8a1c">Forecast · flagged</SourceTag>}
                              {vo && <button type="button" onClick={() => setPart(p.partCode, { annualVolume: String(p.autoVolume), volumeOverrideReason: '' })} className="text-[11px] font-semibold text-amber-700 hover:underline">Restore</button>}
                            </div>
                            {err(`vol:${p.partCode}`) && <div className="text-[11.5px] text-red-600 mt-1">{err(`vol:${p.partCode}`)}</div>}
                          </div>
                          <div className="min-w-0 lg:text-right lg:pt-1.5">
                            <div className="lg:hidden"><div className="label"><L n={21}>Saving / unit and %</L></div></div>
                            <div className="text-[13.5px] font-bold num" style={{ color: tone(row?.unit ?? 0) }}>{inrPrice(row?.unit ?? 0)}</div>
                            <div className="mt-0.5 flex lg:justify-end"><PctBadge pct={row?.pct ?? 0} /></div>
                          </div>
                          <div className="min-w-0 lg:text-right lg:pt-1.5">
                            <div className="lg:hidden"><div className="label"><L n={22}>Annualised impact (₹)</L></div></div>
                            <div className="text-[14px] font-extrabold" style={{ color: tone(row?.annual ?? 0) }}><Money value={row?.annual ?? 0} /></div>
                            <div className="text-[10.5px] text-muted mt-0.5">{inrPrice(row?.unit ?? 0)} × {num(toNum(p.annualVolume))}</div>
                          </div>
                        </div>
                        <AnimatePresence initial={false}>
                          {(bo || vo) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5">
                                {bo && (
                                  <Field label={<span className="flex items-center gap-1.5"><Icon name="PenLine" size={12} className="text-amber-600" />Reason for baseline override</span>} required error={err(`baseReason:${p.partCode}`)}>
                                    <input className={cn('input', err(`baseReason:${p.partCode}`) && '!border-red-400')} value={p.baselineOverrideReason} onChange={(e) => setPart(p.partCode, { baselineOverrideReason: e.target.value })} placeholder="Mandatory — every override is logged" />
                                  </Field>
                                )}
                                {vo && (
                                  <Field label={<span className="flex items-center gap-1.5"><Icon name="PenLine" size={12} className="text-amber-600" />Reason for volume override</span>} required error={err(`volReason:${p.partCode}`)}>
                                    <input className={cn('input', err(`volReason:${p.partCode}`) && '!border-red-400')} value={p.volumeOverrideReason} onChange={(e) => setPart(p.partCode, { volumeOverrideReason: e.target.value })} placeholder="Mandatory — every override is logged" />
                                  </Field>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border-t border-line">
                    <span className="text-[12px] font-semibold text-ink-2 flex items-center gap-1.5"><Calc />Total annualised impact · {form.parts.length} part{form.parts.length === 1 ? '' : 's'}</span>
                    <span className="text-[16px] font-extrabold" style={{ color: tone(calc.annual) }}><Money value={calc.annual} /></span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 mb-3 text-[12.5px] text-muted flex flex-wrap items-center gap-2">
                  <Icon name="ArrowUp" size={14} />
                  <span className="flex-1 min-w-[200px]">{isSupplierScope
                    ? 'No part codes — enter a rough estimate below, or add this supplier\'s part codes in step C to value it per part.'
                    : 'Add part codes in step C — baseline price (LBP rule) and annual volume (last FY MRN) fill in per part.'}</span>
                  <button type="button" onClick={() => openOnly('C')} className="text-[12px] font-semibold text-brand-700 hover:underline">Go to parts</button>
                </div>
              )
            )}
            <div className="grid grid-cols-12 gap-3">
              {estimate && (
                <FX className="col-span-12 md:col-span-6" label={<L n={24}>{isOpen ? 'Estimate for open ideas' : 'Estimate for this supplier idea'}</L>} required error={err('openEstimate')} tag={<SourceTag color="#ec8a1c">Estimate</SourceTag>}
                  hint={hasText(form.openEstimateLakh) ? `Rough annual impact ${inrShort(toNum(form.openEstimateLakh) * LAKH)}` : 'Rough annual impact in ₹ lakh'}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">₹</span>
                    <input type="number" inputMode="decimal" min={0} step="any" onWheel={noWheel} className={cn(NOSPIN, 'input num !pl-7 !pr-14', err('openEstimate') && '!border-red-400')} value={form.openEstimateLakh} onChange={(e) => update({ openEstimateLakh: e.target.value }, [24])} placeholder="0.0" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted">lakh</span>
                  </div>
                </FX>
              )}
              <FX className="col-span-12 md:col-span-6" label={<L n={23}>Expected implementation quarter</L>} required error={err('quarter')}>
                <select className="input" value={form.expectedQuarter} onChange={(e) => update({ expectedQuarter: e.target.value }, [23])}>
                  {quarterOptions.map((o) => <option key={o.value} value={o.value} disabled={o.past}>{o.label}{o.past ? ' (passed)' : ''}</option>)}
                </select>
              </FX>
            </div>
          </FormSection>

          {/* ─── E. Supplier only ───────────────────────────────────────────── */}
          {isSupplier && (
            <FormSection letter="E" title="Supplier only" subtitle="Fields 25–26 · shown only for supplier submissions" icon="Handshake"
              open={openSet.has('E')} onToggle={() => toggleSection('E')} summary={summaries.E} state={sectionStates.E}
              extra={<InfoTip title="Out of scope">{OUT_OF_SCOPE[0]}</InfoTip>}>
              <div className="grid grid-cols-12 gap-3">
                <FX className="col-span-12 sm:col-span-6" label={<L n={25}>Gain-share % offered to Amber</L>} error={err('gainShare')} tag={<span className="text-[11px] text-muted">Optional</span>} hint="Share of further benefits offered to Amber">
                  <div className="relative">
                    <input type="number" inputMode="decimal" min={0} max={100} step="any" onWheel={noWheel} className={cn(NOSPIN, 'input num !pr-8', err('gainShare') && '!border-red-400')} value={form.gainSharePct} onChange={(e) => update({ gainSharePct: e.target.value }, [25])} placeholder="e.g. 30" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted">%</span>
                  </div>
                </FX>
                <FX className="col-span-12 sm:col-span-6" label={<L n={26}>Validity of offer</L>} error={err('offerValidity')} tag={<span className="text-[11px] text-muted">Optional</span>} hint="Date until which the offered price holds">
                  <input type="date" min={todayIso()} className={cn('input', err('offerValidity') && '!border-red-400')} value={form.offerValidity} onChange={(e) => update({ offerValidity: e.target.value }, [26])} />
                </FX>
              </div>
            </FormSection>
          )}
        </div>

        {/* ─── sticky savings summary panel (stays in view; never scrolls on its own) ─── */}
        <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start min-w-0">
          {/* exactly one screen tall: the summary never needs scrolling and Submit is always visible */}
          <div className="card overflow-hidden flex flex-col lg:max-h-[calc(100vh-5.5rem)]">
            <SavingsHero c={calc} singleUnit={singleUnit} />
            <div className="flex-1 min-h-0 overflow-hidden">{panelBody}</div>
            <div className="shrink-0 px-4 py-3 bg-[#f9fafb] border-t border-line space-y-1.5">
              <Button variant="primary" size="lg" icon="Send" className="w-full" onClick={submit}>Submit for validation</Button>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                <span className="font-mono">{idPreview ?? 'COIN-FY27-···-····'}</span>
                <span className="truncate">{buyer ? `Goes to ${buyer.name}` : 'Goes to the Commodity Buyer'}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── mobile: sticky bottom summary bar ───────────────────────────────── */}
      {createPortal(
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-[60]">
          <AnimatePresence>
            {sheet && (
              <>
                <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/15" onClick={() => setSheet(false)} />
                <motion.div key="sh" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', duration: 0.4, bounce: 0.08 }} className="fixed inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl pb-[76px]">
                  <SavingsHero c={calc} singleUnit={singleUnit} />
                  {panelBody}
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <div className="relative z-10 bg-white border-t border-line px-3 py-2.5 flex items-center gap-3 shadow-[0_-8px_24px_-12px_rgb(15_23_42/.25)]">
            <button type="button" onClick={() => setSheet((v) => !v)} className="flex-1 min-w-0 text-left">
              <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">Annualised impact{calc.isOpen && ' · Estimate'}<Icon name={sheet ? 'ChevronDown' : 'ChevronUp'} size={12} /></span>
              <span className="flex items-center gap-2">
                <span className="text-[18px] font-extrabold" style={{ color: tone(calc.annual) }}><Money value={calc.annual} /></span>
                <PctBadge pct={calc.pct} />
              </span>
              <span className="block text-[11px] text-muted truncate">Committed {inrShort(calc.committed)} · {form.expectedQuarter}</span>
            </button>
            <Button variant="primary" icon="Send" onClick={submit}>Submit</Button>
          </div>
        </div>,
        document.body,
      )}

      {/* ─── cancel confirmation ─────────────────────────────────────────────── */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Leave this idea?" icon="FileClock" size="sm"
        subtitle={draftRef.current ? `Draft ${draftRef.current} is saved automatically` : 'Your changes have not been saved as a draft yet'}
        footer={<>
          <Button variant="danger" icon="Trash2" onClick={() => { clearTimeout(timerRef.current); doneRef.current = true; if (draftRef.current) useStore.getState().deleteDraft(draftRef.current); setCancelOpen(false); toast('Draft discarded', 'info'); leave() }}>Discard draft</Button>
          <Button onClick={() => setCancelOpen(false)}>Continue editing</Button>
          <Button variant="primary" icon="Save" onClick={() => { clearTimeout(timerRef.current); persistDraft(); doneRef.current = true; setCancelOpen(false); toast(`Draft kept · ${draftRef.current} — resume it from My Ideas`, 'success'); leave() }}>Keep draft &amp; leave</Button>
        </>}>
        <p className="text-[13px] text-ink-2">Keep the draft to finish later — it stays in My Ideas with status Draft — or discard it permanently.</p>
        {(form.title || form.parts.length > 0) && (
          <div className="mt-3 rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12.5px]">
            <div className="font-semibold text-ink truncate">{form.title || 'Unnamed idea'}</div>
            <div className="text-muted">{form.parts.length} part{form.parts.length === 1 ? '' : 's'} · annualised {inrShort(calc.annual)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PageHeader2({ draftId, draftStatus, onCancel, onSave, allOpen, onToggleAll }: { draftId: string | null; draftStatus: React.ReactNode; onCancel: () => void; onSave: () => void; allOpen: boolean; onToggleAll: () => void }) {
  return (
    <PageHeader icon="CirclePlus" title="Submit Idea" fit
      badge={draftId ? <Badge color="#64748b" icon="FileClock">{draftId}</Badge> : <Badge color="#4470d6" dot>New idea</Badge>}
      subtitle="Fill the steps in order — each one folds away when complete — while the savings summary on the right recalculates as you type"
      actions={<>
        <span className="hidden sm:inline-flex mr-1">{draftStatus}</span>
        <Button size="sm" variant="ghost" icon={allOpen ? 'ChevronsDownUp' : 'ChevronsUpDown'} onClick={onToggleAll}>{allOpen ? 'Collapse all' : 'Expand all'}</Button>
        <Button size="sm" variant="ghost" icon="X" onClick={onCancel}>Cancel</Button>
        <Tooltip content="Ctrl + S"><Button size="sm" icon="Save" onClick={onSave}>Save draft</Button></Tooltip>
      </>} />
  )
}
