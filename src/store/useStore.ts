import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ApprovalRule, Attachment, Campaign, Category, Commodity, EmailLog, EmailPrefs, EmailTemplate, Filters, Idea, LedgerEntry, Lever,
  Notification, Part, Plant, RoleKey, SavedView, Settings, SlaRule, Supplier, User,
} from '../lib/types'
import {
  APPROVAL_RULES_DEFAULT, CATEGORIES_DEFAULT, COMMODITIES_DEFAULT, DEPARTMENTS, DROP_REASONS, EMAIL_TEMPLATES_DEFAULT, LEVERS_DEFAULT,
  MILESTONE_TEMPLATES, PARTS_DEFAULT, PLANTS_DEFAULT, ROUTE_STAGES, SLA_RULES_DEFAULT, SUPPLIERS_DEFAULT, USERS_DEFAULT, LAKH, EVALUATION_STAGES, STAGE, rndDeptFor,
} from '../lib/masters'
import { buildSeed, realiseMonth } from '../lib/seed'
import { addDays, fyEnd, monthLong, nowIso, todayIso, uid, addMonthsYm, fyOf, inrShort } from '../lib/format'
import { approvalLevels, bucketFor, ideaAnnualised, phaseByQuarter, summarise } from '../lib/calc'
import type { OutreachBatch, OutreachKind, SupplierEmailTemplate, SupplierResponse, SupplierResponseStatus } from '../lib/types'
import { OUTREACH_BATCHES_DEFAULT, SUPPLIER_EMAIL_TEMPLATES_DEFAULT, SUPPLIER_RESPONSES_DEFAULT } from '../lib/masters'

export interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; undo?: () => void; at: number }

const DEFAULT_FILTERS: Filters = { fy: 'FY27', quarter: 'All', plant: 'All', categoryId: 'All', commodity: 'All', buyerId: 'All', leverId: 'All', buyingType: 'All' }

const DEFAULT_SETTINGS: Settings = {
  financeValidation: true, xThresholdLakh: 50, yThresholdLakh: 25, fyStartMonth: 4, currentFy: 'FY27', reapprovalPct: 5,
  sessionTimeoutMin: 30, mailerRecipients: ['cxo-list@ambergroupindia.com', 'rajesh.khanna@ambergroupindia.com', 'girish.saluja@ambergroupindia.com'],
  leaderboardVisible: true, density: 'compact', lastRealisationMonth: '2026-08',
}

interface State {
  // session
  userId: string | null
  lastActivity: number
  // masters
  users: User[]
  levers: Lever[]
  categories: Category[]
  commodities: Commodity[]
  plants: Plant[]
  departments: string[]
  suppliers: Supplier[]
  parts: Part[]
  dropReasons: string[]
  slaRules: SlaRule[]
  approvalRules: ApprovalRule[]
  emailTemplates: EmailTemplate[]
  settings: Settings
  buyerTargets: Record<string, number> // buyerId → ₹ FY target
  plantTargets: Record<string, number>
  // transactions
  ideas: Idea[]
  campaigns: Campaign[]
  ledger: LedgerEntry[]
  notifications: Notification[]
  emails: EmailLog[]
  savedViews: SavedView[]
  emailPrefs: Record<string, EmailPrefs>
  fyClosed: Record<string, boolean>
  // supplier outreach by email (suppliers reply via the external Supplier Portal)
  supplierTemplates: SupplierEmailTemplate[]
  outreachBatches: OutreachBatch[]
  supplierResponses: SupplierResponse[]
  supplierPortalSyncAt: string
  // ui
  filters: Filters
  navCollapsed: boolean
  /** Workspace chosen on the entry screen after login: null = chooser, 'IN' = Innovation Network (ideas), 'CO' = Cost Optimisation (implementation) */
  space: 'IN' | 'CO' | null
  drawerIdeaId: string | null
  searchOpen: boolean
  celebrate: number
  toasts: Toast[]
}

interface Actions {
  login: (emailOrId: string, password: string) => boolean
  loginAs: (userId: string) => void
  logout: () => void
  touch: () => void
  setFilters: (f: Partial<Filters>) => void
  resetFilters: () => void
  toggleNav: () => void
  setSpace: (s: 'IN' | 'CO' | null) => void
  setDensity: (d: 'compact' | 'comfortable') => void
  openIdea: (id: string | null) => void
  setSearchOpen: (v: boolean) => void
  toast: (message: string, type?: Toast['type'], undo?: () => void) => void
  dismissToast: (id: string) => void

  saveDraft: (draft: Partial<Idea>, existingId?: string) => string
  submitIdea: (draft: Partial<Idea>, existingId?: string) => string
  updateIdea: (id: string, patch: Partial<Idea>, action?: string, remarks?: string) => void
  deleteDraft: (id: string) => void
  advance: (id: string, action: string, remarks?: string) => void
  validateIdea: (id: string, remarks?: string) => void
  respondFeasibility: (id: string, r: { feasible: boolean; offeredPrice?: number; leadTimeDays?: number; moq?: number; remarks?: string; onBehalf?: boolean }) => void
  techEvaluate: (id: string, decision: 'Go' | 'No-go', validationPlan: string, remarks?: string) => void
  approve: (id: string, remarks?: string) => void
  reject: (id: string, remarks: string) => void
  sendBack: (id: string, remarks: string) => void
  requestInfo: (id: string, remarks: string) => void
  reassign: (id: string, userId: string, remarks: string) => void
  moveToStage: (id: string, stage: string, remarks?: string) => void
  addComment: (id: string, text: string) => void
  addAttachments: (id: string, atts: Attachment[]) => void
  overrideBaseline: (id: string, partCode: string, field: 'baselinePrice' | 'annualVolume', value: number, reason: string) => void

  updateExecution: (id: string, patch: Partial<NonNullable<Idea['execution']>>, reason?: string) => void
  toggleMilestone: (id: string, milestoneId: string, note?: string) => void
  addExecutionNote: (id: string, text: string) => void
  markDone: (id: string, effectiveDate: string, approvedPrices: Record<string, number>) => void
  dropIdea: (id: string, reason: string, remarks: string) => void
  syncNpdPap: (id: string, patch: Partial<Pick<Idea, 'npdStatus' | 'papStatus'>>) => void

  runRealisation: (month?: string) => { month: string; rows: number; leakage: number }
  uploadMrn: (rows: { ideaId: string; partCode: string; month: string; mrnQty: number; mrnPrice: number }[]) => number
  financeValidate: (ids: string[], remarks?: string) => void
  financeQuery: (ids: string[], remarks: string) => void
  sendMonthlyReport: (month: string, manual: boolean) => void
  bookFyClosure: (fy: string) => void

  createCampaign: (c: Omit<Campaign, 'id' | 'createdAt' | 'createdBy' | 'attendance' | 'status'> & { status?: Campaign['status'] }) => string
  updateCampaign: (id: string, patch: Partial<Campaign>) => void
  launchCampaign: (id: string) => void
  setAttendance: (id: string, code: string, status: Campaign['attendance'][string]) => void

  notify: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  setEmailPrefs: (userId: string, prefs: EmailPrefs) => void
  saveView: (v: Omit<SavedView, 'id'>) => void
  deleteView: (id: string) => void

  upsert: <K extends 'levers' | 'categories' | 'commodities' | 'plants' | 'users' | 'suppliers' | 'parts' | 'emailTemplates' | 'approvalRules' | 'slaRules'>(key: K, item: any, idKey?: string) => void
  remove: (key: 'levers' | 'categories' | 'commodities' | 'plants' | 'users' | 'suppliers' | 'parts' | 'emailTemplates', id: string, idKey?: string) => void
  setList: (key: 'dropReasons' | 'departments', list: string[]) => void
  updateSettings: (patch: Partial<Settings>) => void
  setBuyerTarget: (buyerId: string, value: number) => void
  setPlantTarget: (plant: string, value: number) => void
  resetDemo: () => void

  // supplier outreach by email
  saveSupplierTemplate: (t: Omit<SupplierEmailTemplate, 'id' | 'updatedAt' | 'updatedBy'> & { id?: string }) => string
  sendOutreach: (o: { templateId: string; commodities: string[]; workshopDate?: string; replyBy?: string; /** explicit supplier codes (wizard) — defaults to every supplier of the commodities */ recipients?: string[]; name?: string; kind?: OutreachKind }) => OutreachBatch | null
  setSupplierResponseStatus: (id: string, status: SupplierResponseStatus, ideaId?: string) => void
  syncSupplierPortal: () => void
}

export type Store = State & Actions

function freshData() {
  const s = buildSeed()
  const buyerTargets: Record<string, number> = {}
  for (const c of COMMODITIES_DEFAULT) buyerTargets[c.buyerId] = (buyerTargets[c.buyerId] || 0) + c.target
  const total = COMMODITIES_DEFAULT.reduce((a, c) => a + c.target, 0)
  const plantShare: Record<string, number> = { RJP: 0.26, DDN: 0.18, JHJ: 0.12, SRC: 0.16, PUN: 0.1, NDA: 0.12, GNO: 0.06 }
  const plantTargets = Object.fromEntries(Object.entries(plantShare).map(([k, v]) => [k, Math.round(total * v)]))
  return {
    users: USERS_DEFAULT, levers: LEVERS_DEFAULT, categories: CATEGORIES_DEFAULT, commodities: COMMODITIES_DEFAULT, plants: PLANTS_DEFAULT,
    departments: DEPARTMENTS, suppliers: SUPPLIERS_DEFAULT, parts: PARTS_DEFAULT, dropReasons: DROP_REASONS, slaRules: SLA_RULES_DEFAULT,
    approvalRules: APPROVAL_RULES_DEFAULT, emailTemplates: EMAIL_TEMPLATES_DEFAULT, settings: DEFAULT_SETTINGS, buyerTargets, plantTargets,
    ideas: s.ideas, campaigns: s.campaigns, ledger: s.ledger, notifications: s.notifications, emails: s.emails,
    savedViews: [
      { id: 'sv-1', name: 'High value > ₹ 1 Cr', userId: '*', filters: { minValue: 1e7 }, columns: [] },
      { id: 'sv-2', name: 'Technical route in Pipeline', userId: '*', filters: { route: 'Technical', bucket: 'Pipeline' }, columns: [] },
      { id: 'sv-3', name: 'Supplier ideas', userId: '*', filters: { supplierOnly: true }, columns: [] },
    ] as SavedView[],
    emailPrefs: {} as Record<string, EmailPrefs>, fyClosed: {} as Record<string, boolean>,
    supplierTemplates: SUPPLIER_EMAIL_TEMPLATES_DEFAULT, outreachBatches: OUTREACH_BATCHES_DEFAULT, supplierResponses: SUPPLIER_RESPONSES_DEFAULT,
    supplierPortalSyncAt: nowIso(),
  }
}

/** localStorage that never throws: on quota errors it drops the e-mail / notification logs (demo-only history) and retries */
const safeStorage: Storage = {
  get length() { try { return localStorage.length } catch { return 0 } },
  key: (i) => { try { return localStorage.key(i) } catch { return null } },
  clear: () => { try { localStorage.clear() } catch { /* ignore */ } },
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v) } catch {
      try {
        const o = JSON.parse(v)
        if (o?.state) { o.state.emails = (o.state.emails ?? []).slice(0, 50); o.state.notifications = (o.state.notifications ?? []).slice(0, 50) }
        localStorage.setItem(k, JSON.stringify(o))
      } catch { /* storage full or blocked — keep working in memory */ }
    }
  },
}
// Earlier builds stored data under older keys; clear them so the demo always starts from the current data model
try { ['coin-cost-innovation-hub-v1', 'coin-cost-innovation-hub-v2', 'coin-cost-innovation-hub-v3', 'coin-cost-innovation-hub-v4', 'coin-cost-innovation-hub-v5'].forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const me = () => get().users.find((u) => u.id === get().userId)!
      const now = () => nowIso()
      const logEntry = (action: string, extra: Partial<Idea['activity'][0]> = {}) => {
        const u = me()
        return { id: uid('a'), at: now(), userId: u?.id ?? 'system', userName: u?.name ?? 'System', action, ...extra }
      }
      const patchIdea = (id: string, fn: (i: Idea) => Idea) => set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? fn(i) : i)) }))
      const getIdea = (id: string) => get().ideas.find((i) => i.id === id)!
      const commodityOf = (code: string) => get().commodities.find((c) => c.code === code)
      const leverOf = (id: string) => get().levers.find((l) => l.id === id)!
      const push = (n: Omit<Notification, 'id' | 'at' | 'read'>) => get().notify(n)
      const email = (to: string[], subject: string, body: string, template: string, attachments?: string[]) =>
        set((s) => ({ emails: [{ id: uid('e'), at: now(), to, subject, body, template, attachments }, ...s.emails] }))
      const userEmail = (id: string) => get().users.find((u) => u.id === id)?.email ?? id

      const evaluatorIds = (dept: string) => get().users.filter((u) => u.roles.includes('techeval') && dept.includes(u.department)).map((u) => u.id)

      /** entry side-effects when an idea lands on a stage */
      const onEnterStage = (idea: Idea, stage: string): Idea => {
        const lever = leverOf(idea.leverId)
        let next = { ...idea }
        if (EVALUATION_STAGES.includes(stage)) {
          const dept = rndDeptFor(lever.evaluator)
          next.techEval = { evaluatorDept: dept }
          for (const uidv of evaluatorIds(dept)) push({ userId: uidv, title: 'R&D approval requested', body: `${idea.id} · ${idea.title}`, trigger: 'Technical evaluation requested', channel: 'In-app + email', ideaId: idea.id, link: `/ideas/${idea.id}`, severity: 'info' })
        }
        if (stage === STAGE.approval) {
          const s = get().settings
          const levels = approvalLevels(ideaAnnualised(idea), idea.oneTimeInvestment, s.xThresholdLakh, s.yThresholdLakh)
          const lead = commodityOf(idea.commodity)?.leadId
          next.approvals = levels.map((l) => ({ level: l, approverId: l === 'Commodity Lead' ? lead : 'u-head' }))
          const first = next.approvals[0]
          if (first?.approverId) push({ userId: first.approverId, title: 'Pending approval', body: `${idea.id} · ${idea.title} · ${inrShort(ideaAnnualised(idea))}`, trigger: 'Pending approval', channel: 'In-app + email', ideaId: idea.id, link: `/ideas/${idea.id}`, severity: 'warning' })
        }
        return next
      }

      const createExecution = (idea: Idea): Idea => {
        const fy = get().settings.currentFy
        const start = todayIso()
        const target = fyEnd(fy)
        const annual = ideaAnnualised(idea)
        const tpl = MILESTONE_TEMPLATES[idea.route] ?? MILESTONE_TEMPLATES.Commercial
        // NPD sample and PAP price revision are tracked inside "Execution started"
        const npd = tpl.some((m) => m.includes('NPD'))
        const pap = tpl.some((m) => m.includes('PAP'))
        const span = Math.max(30, (new Date(target).getTime() - new Date(start).getTime()) / 86400000)
        return {
          ...idea,
          approvedAt: now(),
          ownerId: idea.buyerId,
          locked: true,
          ...(npd ? { npdRequestId: idea.npdRequestId ?? `NPD-ECN-${Math.floor(26000 + Math.random() * 999)}`, npdStatus: idea.npdStatus ?? 'ECN raised' } : {}),
          ...(pap ? { papRequestId: idea.papRequestId ?? `PAP-${Math.floor(40000 + Math.random() * 9999)}`, papStatus: idea.papStatus ?? 'Raised' } : {}),
          execution: {
            ownerId: idea.buyerId, startDate: start, targetDate: target, originalTargetDate: target,
            phasing: phaseByQuarter(annual, target, fy), // pre-filled; owner edits
            milestones: tpl.map((name, k) => ({ id: uid('m'), name, dueDate: addDays(start, Math.round((span * (k + 1)) / tpl.length)) })),
            slippage: [], progress: 0, notes: [], status: 'In Execution',
          },
        }
      }

      const moveTo = (idea: Idea, stage: string, action: string, remarks?: string): Idea => {
        const t = now()
        const history = idea.stageHistory.map((h, k) => (k === idea.stageHistory.length - 1 && !h.exitedAt ? { ...h, exitedAt: t, by: me()?.name, action, remarks } : h))
        let next: Idea = {
          ...idea, stage, bucket: bucketFor(idea.route, stage), stageEnteredAt: t, infoRequested: false,
          stageHistory: [...history, { stage, enteredAt: t }],
          activity: [...idea.activity, logEntry(action, { field: 'stage', oldValue: idea.stage, newValue: stage, remarks })],
        }
        next = onEnterStage(next, stage)
        return next
      }

      return {
        userId: null,
        lastActivity: Date.now(),
        ...freshData(),
        filters: DEFAULT_FILTERS,
        navCollapsed: false,
        space: null,
        drawerIdeaId: null,
        searchOpen: false,
        celebrate: 0,
        toasts: [],

        login: (emailOrId, password) => {
          const k = emailOrId.trim().toLowerCase()
          const u = get().users.find((x) => x.active && (x.email.toLowerCase() === k || x.employeeId.toLowerCase() === k || x.id === k))
          if (!u || u.password !== password) return false
          set({ userId: u.id, lastActivity: Date.now(), filters: DEFAULT_FILTERS, space: null })
          return true
        },
        loginAs: (userId) => set({ userId, lastActivity: Date.now(), filters: DEFAULT_FILTERS, drawerIdeaId: null, space: null }),
        logout: () => set({ userId: null, drawerIdeaId: null, space: null }),
        touch: () => set({ lastActivity: Date.now() }),
        setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
        resetFilters: () => set({ filters: DEFAULT_FILTERS }),
        toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
        setSpace: (space) => set({ space }),
        setDensity: (d) => set((s) => ({ settings: { ...s.settings, density: d } })),
        openIdea: (id) => set({ drawerIdeaId: id }),
        setSearchOpen: (v) => set({ searchOpen: v }),
        toast: (message, type = 'success', undo) => {
          const id = uid('t')
          set((s) => ({ toasts: [...s.toasts, { id, message, type, undo, at: Date.now() }] }))
          setTimeout(() => get().dismissToast(id), undo ? 5000 : 3800)
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        // ─── Ideas ────────────────────────────────────────────────────────────
        saveDraft: (draft, existingId) => {
          const u = me()
          if (existingId) {
            patchIdea(existingId, (i) => ({ ...i, ...draft, activity: i.activity }))
            return existingId
          }
          const id = `DRAFT-${uid('d').slice(2, 8).toUpperCase()}`
          const lever = leverOf(draft.leverId ?? 'L01')
          const idea: Idea = {
            id, seq: 0, fy: get().settings.currentFy, title: '', currentState: '', proposedChange: '', evidence: '', evidenceTags: [], attachments: [],
            submitterId: u.id, submitterName: u.name, employeeId: u.employeeId, department: u.department, plant: u.plant, buyingType: 'Direct', categoryId: 'MET', commodity: 'FAS',
            leverId: lever.id, scope: 'Part-specific', parts: [], savingsType: lever.defaultSavingsType, oneTimeInvestment: 0, expectedQuarter: `Q3 ${get().settings.currentFy}`,
            isSupplierSubmission: u.roles.includes('supplier'), supplierCode: u.supplierCode, route: lever.route, stage: 'Draft', bucket: 'Draft',
            stageEnteredAt: now(), createdAt: now(), buyerId: 'u-buyer1', approvals: [], stageHistory: [{ stage: 'Draft', enteredAt: now() }],
            activity: [logEntry('Created idea (draft)')], comments: [], ...draft,
          } as Idea
          set((s) => ({ ideas: [idea, ...s.ideas] }))
          return id
        },
        submitIdea: (draft, existingId) => {
          const s = get()
          const u = me()
          const lever = leverOf(draft.leverId!)
          const commodity = commodityOf(draft.commodity!)!
          const fy = s.settings.currentFy
          const seqs = s.ideas.filter((i) => i.commodity === commodity.code && i.fy === fy).map((i) => i.seq)
          const seq = (seqs.length ? Math.max(...seqs) : 0) + 1
          const id = `COIN-${fy}-${commodity.code}-${String(seq).padStart(4, '0')}`
          const base: Idea = existingId ? s.ideas.find((i) => i.id === existingId)! : ({} as Idea)
          const t = now()
          let idea: Idea = {
            ...base,
            attachments: [], evidenceTags: [], comments: [], approvals: [], parts: [],
            ...draft,
            id, seq, fy, route: lever.route, buyerId: commodity.buyerId,
            submitterId: base.submitterId ?? u.id, submitterName: base.submitterName ?? u.name, employeeId: base.employeeId ?? u.employeeId, department: base.department ?? u.department,
            isSupplierSubmission: u.roles.includes('supplier'), supplierCode: u.supplierCode ?? draft.supplierCode,
            stage: STAGE.feasibility, bucket: 'Pipeline', stageEnteredAt: t, createdAt: base.createdAt ?? t, submittedAt: t,
            stageHistory: [{ stage: 'Draft', enteredAt: base.createdAt ?? t, exitedAt: t, by: u.name, action: 'Idea submitted' }, { stage: STAGE.feasibility, enteredAt: t }],
            activity: [...(base.activity ?? []), ...(existingId ? [] : [logEntry('Created idea')]), logEntry('Idea submitted', { field: 'stage', oldValue: 'Draft', newValue: STAGE.feasibility })],
          } as Idea
          if (idea.parts.some((p) => p.baselineOverrideReason || p.volumeOverrideReason)) {
            idea.parts.forEach((p) => {
              if (p.baselineOverrideReason) idea.activity.push(logEntry('Baseline override', { field: `baseline ${p.partCode}`, newValue: String(p.baselinePrice), remarks: p.baselineOverrideReason }))
              if (p.volumeOverrideReason) idea.activity.push(logEntry('Volume override', { field: `volume ${p.partCode}`, newValue: String(p.annualVolume), remarks: p.volumeOverrideReason }))
            })
          }
          set((st) => ({ ideas: [idea, ...st.ideas.filter((i) => i.id !== existingId)] }))
          push({ userId: commodity.buyerId, title: `New idea in ${commodity.name}`, body: `${id} · ${idea.title}`, trigger: 'Idea submitted in my commodity', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'info' })
          email([userEmail(commodity.buyerId)], `COIN · New idea ${id} in ${commodity.name}`, idea.title, 'Idea submitted')
          if (idea.campaignId) idea = { ...idea }
          return id
        },
        updateIdea: (id, patch, action, remarks) =>
          patchIdea(id, (i) => {
            const changes = Object.keys(patch).filter((k) => JSON.stringify((i as any)[k]) !== JSON.stringify((patch as any)[k]))
            const entries = action ? [logEntry(action, { remarks, field: changes.join(', ') })] : changes.map((k) => logEntry('Edited', { field: k, oldValue: String((i as any)[k] ?? ''), newValue: String((patch as any)[k] ?? ''), remarks }))
            return { ...i, ...patch, activity: [...i.activity, ...entries] }
          }),
        deleteDraft: (id) => set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) })),
        advance: (id, action, remarks) => {
          const i = getIdea(id)
          const stages = ROUTE_STAGES[i.route]
          const idx = stages.indexOf(i.stage)
          if (idx < 0 || idx >= stages.length - 1) return
          const nextStage = stages[idx + 1]
          patchIdea(id, (x) => {
            let n = moveTo(x, nextStage, action, remarks)
            if (x.stage === STAGE.approval) n = createExecution(n)
            return n
          })
        },
        validateIdea: (id, remarks) => {
          get().advance(id, 'Team feasibility check completed — baseline confirmed', remarks)
          get().toast(`${id} cleared team feasibility — sent for R&D approval`)
        },
        respondFeasibility: (id, r) => {
          const u = me()
          patchIdea(id, (i) => ({
            ...i,
            feasibility: { ...(i.feasibility ?? { requestedAt: now(), supplierCode: u.supplierCode ?? '' }), respondedAt: now(), respondedBy: u.name + (r.onBehalf ? ' (on behalf)' : ''), feasible: r.feasible, offeredPrice: r.offeredPrice, leadTimeDays: r.leadTimeDays, moq: r.moq, remarks: r.remarks, onBehalf: r.onBehalf },
            parts: r.offeredPrice && i.parts.length === 1 ? [{ ...i.parts[0], newPrice: r.offeredPrice }] : i.parts,
            activity: [...i.activity, logEntry(r.feasible ? 'Feasibility confirmed' : 'Feasibility declined', { remarks: `Offered ₹ ${r.offeredPrice ?? '—'} · lead time ${r.leadTimeDays ?? '—'} d · MOQ ${r.moq ?? '—'}${r.remarks ? ' · ' + r.remarks : ''}` })],
          }))
          void r
        },
        techEvaluate: (id, decision, validationPlan, remarks) => {
          const u = me()
          patchIdea(id, (i) => ({ ...i, techEval: { ...(i.techEval ?? { evaluatorDept: u.department }), decision, validationPlan, at: now(), by: u.name }, activity: [...i.activity, logEntry(`Technical evaluation: ${decision}`, { remarks: validationPlan || remarks })] }))
          if (decision === 'Go') get().advance(id, 'R&D approved', remarks)
          else get().reject(id, remarks || 'R&D not approved')
        },
        approve: (id, remarks) => {
          const u = me()
          const i = getIdea(id)
          const approvals = [...i.approvals]
          const k = approvals.findIndex((a) => !a.decision)
          if (k >= 0) approvals[k] = { ...approvals[k], approverId: u.id, decision: 'Approved', at: now(), remarks }
          const pending = approvals.find((a) => !a.decision)
          patchIdea(id, (x) => ({ ...x, approvals, activity: [...x.activity, logEntry(`Approved (${approvals[k]?.level ?? 'Approver'})`, { remarks })] }))
          if (pending) {
            if (pending.approverId) push({ userId: pending.approverId, title: 'Pending approval', body: `${id} · ${i.title} · ${inrShort(ideaAnnualised(i))}`, trigger: 'Pending approval', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'warning' })
          } else {
            get().advance(id, 'Approved', remarks)
            ;[i.submitterId, i.buyerId].forEach((uidv) => push({ userId: uidv, title: 'Idea approved', body: `${id} · ${i.title} entered the Execution Hub`, trigger: 'Approved / rejected', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'success' }))
          }
        },
        reject: (id, remarks) => {
          const i = getIdea(id)
          patchIdea(id, (x) => {
            const n = moveTo(x, 'Rejected', 'Rejected', remarks)
            return { ...n, bucket: 'Dropped', dropStage: x.stage, droppedAt: now(), dropReason: 'Rejected', dropRemarks: remarks, approvals: x.approvals.map((a) => (!a.decision ? { ...a, decision: 'Rejected' as const, at: now(), remarks } : a)) }
          })
          ;[i.submitterId, i.buyerId].forEach((uidv) => push({ userId: uidv, title: 'Idea rejected', body: `${id} · ${remarks}`, trigger: 'Approved / rejected', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'danger' }))
        },
        sendBack: (id, remarks) => {
          const i = getIdea(id)
          // R&D approval and Sourcing approval send an idea back to the Team feasibility check for rework
          const atStart = i.stage === STAGE.feasibility
          patchIdea(id, (x) => (atStart ? { ...x, infoRequested: true, activity: [...x.activity, logEntry('Sent back to submitter', { remarks })] } : { ...moveTo(x, STAGE.feasibility, 'Sent back to Team feasibility check', remarks), infoRequested: false }))
          push({ userId: i.submitterId, title: 'Idea sent back', body: `${id} · ${remarks}`, trigger: 'Idea sent back / more info requested', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'warning' })
        },
        requestInfo: (id, remarks) => {
          const i = getIdea(id)
          patchIdea(id, (x) => ({ ...x, infoRequested: true, activity: [...x.activity, logEntry('More info requested', { remarks })], comments: [...x.comments, { id: uid('c'), at: now(), userId: me().id, userName: me().name, text: `@${i.submitterName} ${remarks}`, mentions: [i.submitterId] }] }))
          push({ userId: i.submitterId, title: 'More info requested', body: `${id} · ${remarks}`, trigger: 'Idea sent back / more info requested', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'warning' })
        },
        reassign: (id, userId, remarks) => {
          const i = getIdea(id)
          const to = get().users.find((u) => u.id === userId)
          patchIdea(id, (x) => ({
            ...x, buyerId: x.bucket === 'Pipeline' ? userId : x.buyerId, ownerId: userId,
            execution: x.execution ? { ...x.execution, ownerId: userId } : x.execution,
            approvals: x.stage === STAGE.approval ? x.approvals.map((a) => (!a.decision ? { ...a, approverId: userId } : a)) : x.approvals,
            activity: [...x.activity, logEntry('Reassigned', { field: 'owner', oldValue: get().users.find((u) => u.id === (i.ownerId ?? i.buyerId))?.name, newValue: to?.name, remarks })],
          }))
          push({ userId, title: 'Idea reassigned to you', body: `${id} · ${i.title}`, trigger: 'Reassigned', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'info' })
        },
        moveToStage: (id, stage, remarks) => {
          const i = getIdea(id)
          if (stage === 'Implemented') { get().markDone(id, todayIso(), Object.fromEntries(i.parts.map((p) => [p.partCode, p.newPrice]))); return }
          patchIdea(id, (x) => {
            let n = moveTo(x, stage, `Moved on Kanban to ${stage}`, remarks)
            if (bucketFor(x.route, x.stage) === 'Pipeline' && n.bucket === 'In Execution' && !x.execution) n = createExecution(n)
            return n
          })
        },
        addComment: (id, text) => {
          const mentions = get().users.filter((u) => text.includes('@' + u.name)).map((u) => u.id)
          patchIdea(id, (i) => ({ ...i, comments: [...i.comments, { id: uid('c'), at: now(), userId: me().id, userName: me().name, text, mentions }] }))
          mentions.forEach((m) => push({ userId: m, title: `${me().name} mentioned you`, body: `${id}: ${text.slice(0, 90)}`, trigger: '@mention', channel: 'In-app', ideaId: id, link: `/ideas/${id}`, severity: 'info' }))
        },
        addAttachments: (id, atts) => patchIdea(id, (i) => ({ ...i, attachments: [...i.attachments, ...atts].slice(0, 10), activity: [...i.activity, logEntry(`Added ${atts.length} attachment(s)`)] })),
        overrideBaseline: (id, partCode, field, value, reason) =>
          patchIdea(id, (i) => {
            const p = i.parts.find((x) => x.partCode === partCode)!
            const old = p[field]
            return {
              ...i,
              parts: i.parts.map((x) => (x.partCode === partCode ? { ...x, [field]: value, ...(field === 'baselinePrice' ? { baselineSource: 'Override', baselineOverrideReason: reason } : { volumeSource: 'Override', volumeOverrideReason: reason }) } : x)),
              activity: [...i.activity, logEntry(field === 'baselinePrice' ? 'Baseline override' : 'Volume override', { field: `${field} ${partCode}`, oldValue: String(old), newValue: String(value), remarks: reason })],
            }
          }),

        // ─── Execution Hub ────────────────────────────────────────────────────
        updateExecution: (id, patch, reason) =>
          patchIdea(id, (i) => {
            if (!i.execution) return i
            const ex = { ...i.execution, ...patch }
            const act: Idea['activity'] = []
            if (patch.targetDate && patch.targetDate !== i.execution.targetDate) {
              ex.slippage = [...i.execution.slippage, { at: now(), by: me().name, oldDate: i.execution.targetDate, newDate: patch.targetDate, reason: reason || 'Not specified' }]
              act.push(logEntry('Target date changed (slippage logged)', { field: 'targetDate', oldValue: i.execution.targetDate, newValue: patch.targetDate, remarks: reason }))
            }
            if (patch.ownerId && patch.ownerId !== i.execution.ownerId) act.push(logEntry('Owner changed', { field: 'owner', oldValue: get().users.find((u) => u.id === i.execution!.ownerId)?.name, newValue: get().users.find((u) => u.id === patch.ownerId)?.name, remarks: reason }))
            if (patch.phasing) act.push(logEntry('Quarter phasing updated', { field: 'phasing', oldValue: JSON.stringify(i.execution.phasing), newValue: JSON.stringify(patch.phasing) }))
            if (patch.progress != null && patch.progress !== i.execution.progress) act.push(logEntry('Progress updated', { field: 'progress', oldValue: `${i.execution.progress}%`, newValue: `${patch.progress}%` }))
            return { ...i, ownerId: ex.ownerId, execution: ex, activity: [...i.activity, ...act] }
          }),
        toggleMilestone: (id, mid, note) =>
          patchIdea(id, (i) => {
            if (!i.execution) return i
            const ms = i.execution.milestones.map((m) => (m.id === mid ? { ...m, doneDate: m.doneDate ? undefined : todayIso(), note: note ?? m.note } : m))
            const m = ms.find((x) => x.id === mid)!
            const progress = Math.round((ms.filter((x) => x.doneDate).length / ms.length) * 100)
            return { ...i, execution: { ...i.execution, milestones: ms, progress }, activity: [...i.activity, logEntry(m.doneDate ? `Milestone done: ${m.name}` : `Milestone reopened: ${m.name}`, { remarks: note })] }
          }),
        addExecutionNote: (id, text) => patchIdea(id, (i) => (i.execution ? { ...i, execution: { ...i.execution, notes: [...i.execution.notes, { at: now(), by: me().name, text }] }, activity: [...i.activity, logEntry('Milestone note added', { remarks: text })] } : i)),
        markDone: (id, effectiveDate, prices) => {
          patchIdea(id, (i) => {
            const stages = ROUTE_STAGES[i.route]
            let n = i.stage === 'Implemented' ? i : moveTo(i, 'Implemented', 'Marked Done — Implemented', `Effective ${effectiveDate}`)
            if (!n.execution) n = createExecution(n)
            n = {
              ...n, implementedAt: now(), papStatus: 'Price approved', npdStatus: n.npdRequestId ? 'Sample approved' : n.npdStatus,
              parts: n.parts.map((p) => ({ ...p, approvedPrice: prices[p.partCode] ?? p.newPrice })),
              execution: { ...n.execution!, status: 'Done', effectiveDate, approvedPrice: Object.values(prices)[0], progress: 100, milestones: n.execution!.milestones.map((m) => ({ ...m, doneDate: m.doneDate ?? effectiveDate })) },
            }
            void stages
            return n
          })
          const i = getIdea(id)
          ;[i.submitterId, i.buyerId].forEach((uidv) => push({ userId: uidv, title: '🎉 Idea implemented', body: `${id} · ${i.title}`, trigger: 'Implemented', channel: 'In-app', ideaId: id, link: `/ideas/${id}`, severity: 'success' }))
          set((s) => ({ celebrate: s.celebrate + 1 }))
        },
        dropIdea: (id, reason, remarks) => {
          const i = getIdea(id)
          patchIdea(id, (x) => {
            const n = moveTo(x, 'Dropped', `Dropped — ${reason}`, remarks)
            return { ...n, bucket: 'Dropped', dropStage: x.stage, droppedAt: now(), dropReason: reason, dropRemarks: remarks, execution: x.execution ? { ...x.execution, status: 'Dropped' } : x.execution }
          })
          push({ userId: i.submitterId, title: 'Idea dropped', body: `${id} · ${reason}`, trigger: 'Dropped', channel: 'In-app + email', ideaId: id, link: `/ideas/${id}`, severity: 'danger' })
        },
        syncNpdPap: (id, patch) => {
          const i = getIdea(id)
          patchIdea(id, (x) => ({ ...x, ...patch, activity: [...x.activity, logEntry('Status synced from NPD / PAP', { field: Object.keys(patch).join(', '), newValue: Object.values(patch).join(', ') })] }))
          if (patch.npdStatus) push({ userId: i.ownerId ?? i.buyerId, title: `NPD sample ${patch.npdStatus.toLowerCase()}`, body: `${id} · ${i.npdRequestId}`, trigger: 'NPD sample approved / failed', channel: 'In-app', ideaId: id, link: `/ideas/${id}`, severity: patch.npdStatus === 'Sample failed' ? 'danger' : 'success' })
          if (patch.papStatus === 'Price approved') push({ userId: i.ownerId ?? i.buyerId, title: 'PAP price approved', body: `${id} · ${i.papRequestId}`, trigger: 'PAP price approved', channel: 'In-app', ideaId: id, link: `/ideas/${id}`, severity: 'success' })
        },

        // ─── Savings realisation ──────────────────────────────────────────────
        runRealisation: (month) => {
          const s = get()
          const m = month ?? addMonthsYm(s.settings.lastRealisationMonth, 1)
          const rows = realiseMonth(s.ideas, m, Math.random).map((r) => ({ ...r, postedAt: now() }))
          const existing = new Set(s.ledger.map((l) => l.id))
          const fresh = rows.filter((r) => !existing.has(r.id))
          const leakage = fresh.reduce((a, r) => a + r.leakage, 0)
          set((st) => ({ ledger: [...st.ledger, ...fresh], settings: { ...st.settings, lastRealisationMonth: m > st.settings.lastRealisationMonth ? m : st.settings.lastRealisationMonth } }))
          push({ userId: 'u-fin', title: 'Savings to validate', body: `${monthLong(m)} realisation posted — ${fresh.length} entries awaiting validation`, trigger: 'Savings to validate', channel: 'In-app + email', link: '/execution', severity: 'warning' })
          if (leakage > 0) {
            const affected = new Set(fresh.filter((r) => r.leakage > 0).map((r) => s.ideas.find((i) => i.id === r.ideaId)))
            affected.forEach((i) => {
              if (!i) return
              push({ userId: i.buyerId, title: 'Price leakage detected', body: `${i.id} · MRN price above approved new price (${monthLong(m)})`, trigger: 'Price leakage detected', channel: 'Email', ideaId: i.id, link: '/execution', severity: 'danger' })
              const lead = commodityOf(i.commodity)?.leadId
              if (lead) push({ userId: lead, title: 'Price leakage detected', body: `${i.id} · ${monthLong(m)}`, trigger: 'Price leakage detected', channel: 'Email', ideaId: i.id, link: '/execution', severity: 'danger' })
            })
          }
          get().sendMonthlyReport(m, false)
          return { month: m, rows: fresh.length, leakage }
        },
        uploadMrn: (rows) => {
          const s = get()
          let n = 0
          const entries: LedgerEntry[] = []
          for (const r of rows) {
            const i = s.ideas.find((x) => x.id === r.ideaId)
            const p = i?.parts.find((x) => x.partCode === r.partCode)
            if (!i || !p) continue
            const approved = p.approvedPrice ?? p.newPrice
            const planned = Math.round(p.annualVolume / 12)
            const leakage = Math.max(0, r.mrnPrice - approved) * r.mrnQty
            const ex: LedgerEntry['exceptions'] = []
            if (leakage > 0) ex.push('Price leakage')
            if (r.mrnQty === 0) ex.push('No MRN received')
            else if (r.mrnQty < planned * 0.5) ex.push('Volume below 50% of plan')
            entries.push({ id: `LG-${i.id}-${p.partCode}-${r.month}`, ideaId: i.id, partCode: p.partCode, supplierCode: p.currentSupplier.split(' · ')[0], month: r.month, mrnQty: r.mrnQty, plannedQty: planned, mrnPrice: r.mrnPrice, baseline: p.baselinePrice, approvedPrice: approved, realised: (p.baselinePrice - approved) * r.mrnQty, leakage, exceptions: ex, financeStatus: 'Pending', postedAt: now() })
            n++
          }
          const ids = new Set(entries.map((e) => e.id))
          set((st) => ({ ledger: [...st.ledger.filter((l) => !ids.has(l.id)), ...entries] }))
          return n
        },
        financeValidate: (ids, remarks) => {
          const set2 = new Set(ids)
          set((s) => ({ ledger: s.ledger.map((l) => (set2.has(l.id) ? { ...l, financeStatus: 'Validated', financeBy: me().name, financeAt: now(), financeRemarks: remarks ?? l.financeRemarks } : l)) }))
        },
        financeQuery: (ids, remarks) => {
          const set2 = new Set(ids)
          const s = get()
          set((st) => ({ ledger: st.ledger.map((l) => (set2.has(l.id) ? { ...l, financeStatus: 'Queried', financeBy: me().name, financeAt: now(), financeRemarks: remarks } : l)) }))
          const ideaIds = new Set(s.ledger.filter((l) => set2.has(l.id)).map((l) => l.ideaId))
          ideaIds.forEach((iid) => { const i = s.ideas.find((x) => x.id === iid); if (i) push({ userId: i.buyerId, title: 'Finance query on realised saving', body: `${iid} · ${remarks}`, trigger: 'Finance query', channel: 'In-app + email', ideaId: iid, link: '/execution', severity: 'warning' }) })
        },
        sendMonthlyReport: (month, manual) => {
          const s = get()
          const fy = fyOf(month + '-01')
          const sum = summarise(s.ideas.filter((i) => i.fy === fy), s.ledger, 0, fy, s.settings.financeValidation, s.settings.lastRealisationMonth)
          const monthRealised = s.ledger.filter((l) => l.month === month).reduce((a, l) => a + l.realised, 0)
          const body = `PFA, Cost Optimisation Report\n\nRealised to date: ${inrShort(sum.realisedCounting)}\nCommitted: ${inrShort(sum.remainingCommitted)}\nPipeline: ${inrShort(sum.pipeline)}\nMonth's realised saving: ${inrShort(monthRealised)}`
          email(s.settings.mailerRecipients, `COIN — Cost Optimisation Report, ${monthLong(month)}`, body, 'Monthly Cost Optimisation Report', [`COIN_Report_${month}.pdf`, `COIN_Detail_${month}.xlsx`])
          const leads = [...new Set(s.commodities.map((c) => c.leadId))]
          leads.forEach((l) => email([userEmail(l)], `COIN — Cost Optimisation Report, ${monthLong(month)} (commodity cut)`, body, 'Monthly Cost Optimisation Report'))
          ;['u-mgmt', 'u-head'].forEach((uidv) => push({ userId: uidv, title: 'Monthly Cost Optimisation Report', body: `COIN — Cost Optimisation Report, ${monthLong(month)} ${manual ? 'sent manually by Sourcing Head' : 'emailed after realisation run'}`, trigger: 'Monthly Cost Optimisation Report', channel: 'Email + attachments', link: '/reports', severity: 'success' }))
        },
        // Section 9 step 6 — at FY close open ideas roll into the next FY with a new target date and carry-over is booked
        bookFyClosure: (fy) => {
          const nfy = `FY${String(Number(fy.slice(2)) + 1).padStart(2, '0')}`
          const newTarget = fyEnd(nfy)
          set((s) => ({
            fyClosed: { ...s.fyClosed, [fy]: true },
            ideas: s.ideas.map((i) => {
              if (i.fy !== fy || i.execution?.status !== 'In Execution') return i
              const reason = `FY closure — rolled into ${nfy}; carry-over booked`
              return {
                ...i,
                execution: { ...i.execution, targetDate: newTarget, slippage: [...i.execution.slippage, { at: now(), by: me()?.name ?? 'System', oldDate: i.execution.targetDate, newDate: newTarget, reason }] },
                activity: [...i.activity, logEntry(`Rolled into ${nfy} at FY closure`, { field: 'targetDate', oldValue: i.execution.targetDate, newValue: newTarget, remarks: reason })],
              }
            }),
          }))
          ;['u-head', 'u-fin', 'u-mgmt'].forEach((u) => push({ userId: u, title: `${fy} closure booked`, body: `Open ideas rolled into ${nfy} with due date ${newTarget}; carry-over booked`, trigger: 'FY closure', channel: 'In-app + email', link: '/execution', severity: 'info' }))
        },

        // ─── Campaigns ────────────────────────────────────────────────────────
        createCampaign: (c) => {
          const id = `CMP-${String(get().campaigns.length + 1).padStart(3, '0')}`
          set((s) => ({ campaigns: [{ ...c, id, status: c.status ?? 'Draft', attendance: {}, createdBy: me().id, createdAt: now() } as Campaign, ...s.campaigns] }))
          return id
        },
        updateCampaign: (id, patch) => set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
        launchCampaign: (id) => {
          const c = get().campaigns.find((x) => x.id === id)!
          const sups = get().suppliers.filter((s) => c.suppliers.includes(s.code))
          email(sups.map((s) => s.contactEmail), `COIN · Invitation: ${c.name}`, `You are invited to "${c.name}"${c.workshopDate ? ' on ' + c.workshopDate : ''}.`, 'Workshop invitation')
          c.internalInvitees.forEach((u) => email([userEmail(u)], `COIN · Invitation: ${c.name}`, c.description, 'Workshop invitation'))
          sups.forEach((s) => { const u = get().users.find((x) => x.supplierCode === s.code); if (u) push({ userId: u.id, title: 'Workshop invitation', body: `${c.name}${c.workshopDate ? ' · ' + c.workshopDate : ''}`, trigger: 'Workshop invitation', channel: 'Email', link: '/workshops', severity: 'info' }) })
          c.internalInvitees.forEach((u) => push({ userId: u, title: 'Campaign invitation', body: c.name, trigger: 'Workshop invitation', channel: 'Email', link: `/campaigns/${c.id}`, severity: 'info' }))
          set((s) => ({ campaigns: s.campaigns.map((x) => (x.id === id ? { ...x, status: 'Live', invitesSentAt: now(), attendance: Object.fromEntries(x.suppliers.map((k) => [k, x.attendance[k] ?? 'Invited'])) } : x)) }))
        },
        setAttendance: (id, code, status) => set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, attendance: { ...c.attendance, [code]: status } } : c)) })),

        // ─── Supplier outreach by email ───────────────────────────────────────
        saveSupplierTemplate: (t) => {
          const list = get().supplierTemplates ?? SUPPLIER_EMAIL_TEMPLATES_DEFAULT
          const id = t.id ?? `ST${String(list.length + 1).padStart(2, '0')}-${uid('t').slice(2, 6)}`
          const item: SupplierEmailTemplate = { ...t, id, updatedAt: now(), updatedBy: me()?.name ?? 'System' }
          set({ supplierTemplates: list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? item : x)) : [...list, item] })
          return id
        },
        sendOutreach: ({ templateId, commodities, workshopDate, replyBy, recipients, name, kind }) => {
          const s = get()
          const tpl = (s.supplierTemplates ?? SUPPLIER_EMAIL_TEMPLATES_DEFAULT).find((x) => x.id === templateId)
          const sups = recipients ? s.suppliers.filter((x) => recipients.includes(x.code)) : outreachRecipients(s.suppliers, commodities)
          if (!tpl || !sups.length) return null
          const u = me()
          const t = now()
          const batchId = `OB-${String((s.outreachBatches ?? []).length + 1).padStart(3, '0')}-${uid('b').slice(2, 5)}`
          const mails: EmailLog[] = sups.map((sup) => {
            const vars = supplierTemplateVars(sup, commodities, s.commodities, { workshopDate, replyBy, senderName: u?.name })
            return { id: uid('e'), at: t, to: [sup.contactEmail], subject: renderSupplierTemplate(tpl.subject, vars), body: renderSupplierTemplate(tpl.body, vars), template: `Supplier outreach · ${tpl.name}` }
          })
          const batch: OutreachBatch = {
            id: batchId, templateId: tpl.id, templateName: tpl.name, commodities, recipients: sups.map((x) => x.code), recipientCount: sups.length,
            name: name?.trim() || undefined, kind, workshopDate: workshopDate || undefined, replyBy: replyBy || undefined, sentAt: t, sentBy: u?.id ?? 'system', sentByName: u?.name ?? 'System',
          }
          set((st) => ({ emails: [...mails, ...st.emails], outreachBatches: [batch, ...(st.outreachBatches ?? [])] }))
          return batch
        },
        setSupplierResponseStatus: (id, status, ideaId) =>
          set((s) => ({ supplierResponses: (s.supplierResponses ?? []).map((r) => (r.id === id ? { ...r, status, ideaId: ideaId ?? r.ideaId, updatedAt: now(), updatedBy: me()?.name } : r)) })),
        syncSupplierPortal: () => set({ supplierPortalSyncAt: now() }),

        // ─── Notifications ────────────────────────────────────────────────────
        notify:(n) => set((s) => ({ notifications: [{ ...n, id: uid('n'), at: now(), read: false }, ...s.notifications] })),
        markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => (n.userId === s.userId ? { ...n, read: true } : n)) })),
        setEmailPrefs: (userId, prefs) => set((s) => ({ emailPrefs: { ...s.emailPrefs, [userId]: prefs } })),
        saveView: (v) => set((s) => ({ savedViews: [...s.savedViews, { ...v, id: uid('sv') }] })),
        deleteView: (id) => set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id) })),

        // ─── Admin ────────────────────────────────────────────────────────────
        upsert: (key, item, idKey = 'id') =>
          set((s) => {
            const list = (s as any)[key] as any[]
            const exists = list.some((x) => x[idKey] === item[idKey])
            return { [key]: exists ? list.map((x) => (x[idKey] === item[idKey] ? { ...x, ...item } : x)) : [...list, item] } as any
          }),
        remove: (key, id, idKey = 'id') => set((s) => ({ [key]: ((s as any)[key] as any[]).filter((x) => x[idKey] !== id) } as any)),
        setList: (key, list) => set({ [key]: list } as any),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        setBuyerTarget: (b, v) => set((s) => ({ buyerTargets: { ...s.buyerTargets, [b]: v } })),
        setPlantTarget: (p, v) => set((s) => ({ plantTargets: { ...s.plantTargets, [p]: v } })),
        resetDemo: () => set({ ...freshData(), filters: DEFAULT_FILTERS, drawerIdeaId: null }),
      }
    },
    {
      name: 'coin-cost-innovation-hub-v6',
      version: 6,
      storage: createJSONStorage(() => safeStorage),
      // Saved data from an older build may miss newer fields: start from the fresh seed and overlay what was saved,
      // so a demo never crashes on a missing list or setting. Anything that is not an array/object of the right shape is ignored.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        const out: Record<string, unknown> = { ...current }
        for (const [k, v] of Object.entries(p)) {
          const cur = (current as unknown as Record<string, unknown>)[k]
          if (typeof cur === 'function' || v === undefined) continue
          if (Array.isArray(cur)) { if (Array.isArray(v)) out[k] = v; continue }
          if (cur && typeof cur === 'object') { if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(cur as object), ...(v as object) }; continue }
          out[k] = v
        }
        return out as unknown as Store
      },
      partialize: (s) => {
        const { toasts, drawerIdeaId, searchOpen, celebrate, ...rest } = s as any
        void toasts; void drawerIdeaId; void searchOpen; void celebrate
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as any
      },
    },
  ),
)

// ─── Selectors / hooks ────────────────────────────────────────────────────────
export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.userId) ?? null)
export const hasRole = (u: User | null, ...roles: RoleKey[]) => !!u && u.roles.some((r) => roles.includes(r))
export const userName = (id?: string) => useStore.getState().users.find((u) => u.id === id)?.name ?? '—'
export const LAKH_ = LAKH

// ─── Supplier outreach helpers (pure) ─────────────────────────────────────────
/** Commodity name without the "(Cu)" style suffix — used in outreach summaries */
export const commodityShort = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '')
/** External Supplier Portal deep link — suppliers never log into COIN */
export const supplierPortalLink = (supplierCode: string, commodities: string[]) =>
  `https://supplier-portal.coin.amber/submit?s=${supplierCode}&c=${commodities.join(',')}`
/** Every supplier whose commodities include at least one of the chosen codes */
export function outreachRecipients(suppliers: Supplier[], commodities: string[]) {
  return suppliers.filter((s) => s.commodities.some((c) => commodities.includes(c)))
}
/** Placeholder values for one supplier; commodity = the supplier's commodities within the chosen set */
export function supplierTemplateVars(sup: Supplier, chosen: string[], commodities: Commodity[], extra: { workshopDate?: string; replyBy?: string; senderName?: string } = {}): Record<string, string> {
  const mine = sup.commodities.filter((c) => chosen.includes(c))
  const names = (mine.length ? mine : chosen).map((c) => commodityShort(commodities.find((x) => x.code === c)?.name ?? c))
  const fmt = (d?: string) => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return isNaN(+x) ? d : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  return {
    supplierName: sup.name, contactName: sup.contactName, commodity: names.join(' & '),
    workshopDate: fmt(extra.workshopDate) || 'the scheduled date', replyBy: fmt(extra.replyBy) || 'the due date',
    portalLink: supplierPortalLink(sup.code, mine.length ? mine : chosen), senderName: extra.senderName ?? 'Amber Sourcing',
  }
}
/** Replace {{placeholder}} tokens; unknown tokens are left as-is */
export function renderSupplierTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

// Keep several open tabs in step: when another tab saves, reload the saved state here instead of overwriting it later
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === 'coin-cost-innovation-hub-v6') void useStore.persist.rehydrate() })
}
