# COIN six-stage workflow, CO execution & verification, new home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every idea runs Idea submitted → Team feasibility check → {Dept} evaluation → Sourcing approval → Execution started → Verification, with a real form at each stage, a supplier capability form page, plan-vs-actual tracking in CO, and a new navy/red home and dashboards.

**Architecture:** Pure workflow rules live in a new `src/lib/workflow.ts` (unit-tested with Vitest). The zustand store (`src/store/useStore.ts`, persisted to localStorage) gains stage records on `Idea` (`feasibilityCheck`, `evaluation`, `lock`, `verification`) and actions that write them. UI forms are modals/panels under `src/pages/idea/`, two new pages (`SupplierCheck`, public `SupplierForm`), a `Proof` page in CO, and reworked home/dashboard components.

**Tech Stack:** Vite 6, React 18, TypeScript (non-strict), Tailwind v4 tokens in `src/index.css`, zustand 5 persist, recharts, motion, lucide icons; Vitest (new, dev only).

**Spec:** `docs/superpowers/specs/2026-10-15-coin-six-stage-workflow-design.md`

## Global Constraints

- Front-end only: no backend, no network calls; all data in localStorage (zustand persist). Emails are written to the in-app outbox only.
- Stage names (stored): `Team feasibility check`, `Evaluation`, `Sourcing approval`, `Execution started`, `Verification`; tracker shows `Idea submitted` first. Evaluation label = `<dept> evaluation` from the **submitter's department**; Sourcing / Sourcing Excellence / Supplier / Management map to `Sourcing`.
- Minimum saving threshold for the supplier capability check: **₹ 5,00,000 annualised** (below → skipped, "Skipped — below minimum saving threshold").
- Lock target saving = annualised × timeline months ÷ 12; default timeline **6 months**.
- Supplier capability email must contain **no Amber data**: no part codes, prices, volumes, current supplier names, savings.
- IN workspace = stages 1–4; CO workspace = stages 5–6; Execution Hub is CO-only.
- Dropped / rejected ideas never return.
- Sourcing Head can act at every stage; quick demo logins stay Sourcing Head + Admin → Sourcing Head.
- Palette: navy blue, white, Amber red (#d7192d); status colours keep meaning (green done, orange in progress, red late).
- Storage key bumps to `coin-cost-innovation-hub-v7`.

## Review Focus

1. Browser still holds v6 (or older) data → app must load the fresh v7 seed without crashing (old keys removed).
2. Supplier form opened with an unknown or already-answered token → friendly "link not valid / already answered" screen, never a blank page.
3. Open ideas (no part codes, estimate only) at evaluation, lock and plan-vs-actual → CBA uses the estimate, no `NaN` / `₹ 0` placeholders.
4. Kanban drag that skips a stage form (e.g. Evaluation → Execution started without a signed lock) → move blocked with a reason naming the missing form.
5. Evaluator edits the supplier email and types a price or part code → warning listing the leaked items before Send.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/workflow.ts` (new) | Stage constants re-export, `evalDeptOf`, `stageLabel`, `needsSupplierCheck`, `costFlags`, `overallRisk`, `riskTotal`, `lockTarget`, `addMonthsIso`, `supplierCapabilityEmail`, `amberDataLeaks`, `planVsActual`, `sourceBreakdown` |
| `src/lib/workflow.test.ts` (new) | Vitest unit tests for the above |
| `src/lib/types.ts` | `FeasibilityCheck`, `RiskItem`, `SupplierCheck`, `Evaluation`, `ApprovalLock`, `Verification`; `Idea` fields; `Supplier.tier`; role `feasibility` |
| `src/lib/masters.ts` | `STAGE` (6 stages), `WORKFLOW_STAGES`, `TRACKER_STAGES`, milestone templates + `FINAL_MILESTONES`, SLA rules, supplier tiers, feasibility role on users, `RISK_FACTORS` |
| `src/lib/calc.ts` | `bucketFor` (Verification → Implemented), visibility by evaluation dept |
| `src/lib/seed.ts` | Dynamic demo date, stage records for the portfolio, external ideas, six showcase ideas, ledger from first MRN |
| `src/store/useStore.ts` | New actions: `recordFeasibility`, `saveEvaluation`, `sendSupplierCheck`, `respondSupplierCheck`, `skipSupplierCheck`, `recordEvaluation`, `signLock`, `approve` (lock-aware), `handOverForVerification`, `verifyIdea`, `returnToExecution`; key v7 |
| `src/pages/idea/model.ts` | Permissions per stage, `waitingOn`, Kanban groups + gating |
| `src/pages/idea/StageForms.tsx` (new) | `FeasibilityCheckModal`, `EvaluationModal` (CBA / Risk / Supplier tabs), `SourcingApprovalModal` with `SignaturePad` |
| `src/pages/idea/StagePanels.tsx` (new) | Read-only panels on the idea page: feasibility, evaluation, sourcing approval/lock, verification |
| `src/pages/idea/PlanVsActual.tsx` (new) | Plan vs actual chart + projection line (idea and portfolio) |
| `src/pages/SupplierCheck.tsx` (new) | `/ideas/:id/supplier-check` — pick supplier, template, leak guard, send, response |
| `src/pages/SupplierForm.tsx` (new) | `/supplier-form/:token` — public vendor form (no login, no app shell) |
| `src/pages/Proof.tsx` (new) | CO **PROOF** — part-wise plan vs actual from MRN |
| `src/pages/ExecutionHub.tsx` | CO **TRACE** — stage segment (Execution started / Verification / Verified), CO date, MRN link, plan vs actual in expanded row, hand-over + verify |
| `src/components/Logo.tsx` | `CoinMark` (coin with ₹) |
| `src/components/KpiTile.tsx` (new) | Shared CO-style `KpiTile` |
| `src/pages/home/Sources.tsx` (new) | Internal (commodity / department / individual) vs External (Tier 1 / Tier 2 / via campaigns) card |
| `src/pages/Entry.tsx`, `src/pages/home/SourcingHome.tsx`, `src/pages/co/CoHome.tsx` | New home + dashboards, cards moved to Advanced analytics |
| `src/index.css` + hex sweep | Navy / white / Amber red palette |

---

## Phase 1 — Workflow and stage forms

### Task 1: Vitest + pure workflow module

**Files:** Create `src/lib/workflow.ts`, `src/lib/workflow.test.ts`; Modify `package.json` (devDependency `vitest`, script `"test": "vitest run"`).

**Interfaces — Produces:**
```ts
export const SUPPLIER_CHECK_MIN = 5_00_000
export const EVAL_DEPTS = ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance'] as const
export function evalDeptOf(department?: string): string            // 'R&D' | … | 'Sourcing'
export function stageLabel(idea: Pick<Idea, 'department'>, stage: string): string // 'Evaluation' → 'R&D evaluation'
export function needsSupplierCheck(annual: number): boolean        // annual >= SUPPLIER_CHECK_MIN
export function costFlags(idea: Idea, parts: Part[]): string[]
export function overallRisk(risks: RiskItem[]): RiskLevel          // highest level, 'Low' when empty
export function riskTotal(risks: RiskItem[]): number
export function lockTarget(annual: number, months: number): number // annual * months / 12
export function addMonthsIso(isoDate: string, months: number): string
export function supplierCapabilityEmail(i: { supplierName: string; contactName: string; item: string; spec: string; requiredBy: string; link: string; sender: string }): { subject: string; body: string }
export function amberDataLeaks(text: string, idea: Idea, suppliers: Supplier[]): string[]
export function planVsActual(a: { target: number; months: number; startDate: string; ledger: { month: string; realised: number }[]; lastActualMonth: string }): { rows: { month: string; plan: number; planCum: number; actual: number | null; actualCum: number | null }[]; actualToDate: number; planToDate: number; runRate: number; projected: number; onTrack: boolean; elapsed: number }
export function sourceBreakdown(ideas: Idea[], suppliers: Supplier[], value: (i: Idea) => number): { internal: { count: number; value: number; byCommodity: Seg[]; byDepartment: Seg[]; byIndividual: Seg[] }; external: { count: number; value: number; tier1: Seg; tier2: Seg; viaCampaign: Seg } }
// Seg = { key: string; label: string; count: number; value: number; ids: string[] }
```

- [ ] **Step 1: Install Vitest** — `npm i -D vitest@^2` and add `"test": "vitest run"` to `package.json` scripts.
- [ ] **Step 2: Write the failing tests** (`src/lib/workflow.test.ts`):
```ts
import { describe, it, expect } from 'vitest'
import { evalDeptOf, stageLabel, needsSupplierCheck, overallRisk, riskTotal, lockTarget, addMonthsIso, supplierCapabilityEmail, amberDataLeaks, planVsActual, sourceBreakdown } from './workflow'

describe('evaluation department', () => {
  it('uses the submitter department', () => { expect(evalDeptOf('Quality')).toBe('Quality'); expect(stageLabel({ department: 'R&D' }, 'Evaluation')).toBe('R&D evaluation') })
  it('maps sourcing-side departments to Sourcing', () => { for (const d of ['Sourcing', 'Sourcing Excellence', 'Supplier', 'Management', undefined]) expect(evalDeptOf(d)).toBe('Sourcing') })
  it('leaves other stage names alone', () => expect(stageLabel({ department: 'R&D' }, 'Sourcing approval')).toBe('Sourcing approval'))
})
describe('thresholds and lock', () => {
  it('supplier check from ₹ 5 lakh up', () => { expect(needsSupplierCheck(499999)).toBe(false); expect(needsSupplierCheck(500000)).toBe(true) })
  it('lock target = annual × months ÷ 12', () => expect(lockTarget(24_00_000, 6)).toBe(12_00_000))
  it('adds months to an ISO date', () => expect(addMonthsIso('2026-10-01', 6)).toBe('2027-04-01'))
})
describe('risk', () => {
  it('overall = highest level, total = Σ cost at risk', () => {
    const r = [{ key: 'q', label: 'Quality', level: 'Low', costAtRisk: 10000 }, { key: 's', label: 'Supply', level: 'High', costAtRisk: 50000 }] as any
    expect(overallRisk(r)).toBe('High'); expect(riskTotal(r)).toBe(60000); expect(overallRisk([])).toBe('Low')
  })
})
describe('supplier capability email', () => {
  const idea: any = { parts: [{ partCode: '3100045612', baselinePrice: 4.2, newPrice: 3.85, annualVolume: 2400000, currentSupplier: 'V10021 · Sunrise Fasteners Pvt Ltd' }], openEstimateLakh: 0, scope: 'Part-specific' }
  const sup: any[] = [{ code: 'V10021', name: 'Sunrise Fasteners Pvt Ltd' }]
  it('generated email has no Amber data', () => {
    const e = supplierCapabilityEmail({ supplierName: 'Metro Precision', contactName: 'Ravi', item: 'Hex flange bolt M6×16', spec: 'Trivalent Zn with sealer, 240 h salt spray', requiredBy: '2026-12-31', link: 'https://x/supplier-form/t1', sender: 'Sourcing team' })
    expect(amberDataLeaks(`${e.subject}\n${e.body}`, idea, sup)).toEqual([])
  })
  it('flags part codes, prices, volumes and current supplier', () => {
    const leaks = amberDataLeaks('Part 3100045612 at ₹ 4.20, 24,00,000 Nos from Sunrise Fasteners Pvt Ltd', idea, sup)
    expect(leaks.length).toBeGreaterThanOrEqual(3)
  })
})
describe('plan vs actual', () => {
  it('₹ 12 L over 6 months, ₹ 1.4 L in month 1 → projected ₹ 8.4 L, behind plan', () => {
    const p = planVsActual({ target: 12_00_000, months: 6, startDate: '2026-09-01', ledger: [{ month: '2026-09', realised: 1_40_000 }], lastActualMonth: '2026-09' })
    expect(p.rows).toHaveLength(6); expect(p.rows[0].plan).toBe(2_00_000); expect(p.actualToDate).toBe(1_40_000)
    expect(Math.round(p.projected)).toBe(8_40_000); expect(p.onTrack).toBe(false); expect(p.rows[1].actual).toBeNull()
  })
  it('zero target never divides by zero', () => { const p = planVsActual({ target: 0, months: 6, startDate: '2026-09-01', ledger: [], lastActualMonth: '2026-09' }); expect(p.projected).toBe(0); expect(p.onTrack).toBe(true) })
})
describe('source breakdown', () => {
  it('splits internal vs external and tiers', () => {
    const ideas: any[] = [
      { id: 'a', isSupplierSubmission: false, commodity: 'FAS', department: 'R&D', submitterId: 'u1', submitterName: 'Neha' },
      { id: 'b', isSupplierSubmission: true, supplierCode: 'V1', commodity: 'FAS', department: 'Supplier', submitterId: 'u2', submitterName: 'Rakesh', campaignId: 'CMP-003' },
      { id: 'c', isSupplierSubmission: true, supplierCode: 'V2', commodity: 'CMP', department: 'Supplier', submitterId: 'u3', submitterName: 'Lakshmi' },
    ]
    const s = sourceBreakdown(ideas, [{ code: 'V1', tier: 'Tier 2' }, { code: 'V2', tier: 'Tier 1' }] as any, () => 100)
    expect(s.internal.count).toBe(1); expect(s.external.count).toBe(2)
    expect(s.external.tier1.count).toBe(1); expect(s.external.tier2.count).toBe(1); expect(s.external.viaCampaign.count).toBe(1)
    expect(s.internal.byDepartment[0]).toMatchObject({ key: 'R&D', count: 1, value: 100 })
  })
})
```
- [ ] **Step 3: Run `npx vitest run src/lib/workflow.test.ts`** — expected FAIL (module not found).
- [ ] **Step 4: Implement `src/lib/workflow.ts`** with the signatures above. Key rules: `amberDataLeaks` checks every part code, every baseline / new / approved price formatted as `4.2`, `4.20`, `₹ 4.20`, annual volumes in Indian and plain grouping (`2400000`, `24,00,000`, `2,400,000`), current supplier names / codes, and the word `₹` followed by digits. `planVsActual`: months = `max(1, months)`, plan per month = target / months; actual for months ≤ `lastActualMonth` (null after); `elapsed` = months with actual ≠ null; `runRate` = actualToDate / max(1, elapsed); `projected` = elapsed ? runRate × months : 0; `onTrack` = target === 0 || actualToDate ≥ planToDate × 0.95.
- [ ] **Step 5: Run tests** — expected PASS. **Step 6: Commit** `feat: pure workflow rules with tests`.

### Task 2: Types and masters

**Files:** Modify `src/lib/types.ts`, `src/lib/masters.ts`.

**Interfaces — Produces:**
```ts
export interface FeasibilityCheck { technical: 'Yes' | 'No'; technicalNote?: string; cost: 'Valid' | 'Not valid'; costNote?: string; conflict: 'None' | 'Duplicate' | 'Conflict'; conflictWith?: string; conflictNote?: string; decision: 'Go' | 'No-go'; departments: string[]; remarks?: string; by: string; byDept: string; at: string }
export type RiskLevel = 'Low' | 'Medium' | 'High'
export interface RiskItem { key: string; label: string; level: RiskLevel; costAtRisk: number; note?: string }
export interface SupplierCheck { status: 'Not sent' | 'Sent' | 'Responded' | 'Skipped'; token?: string; supplierCode?: string; supplierName?: string; contactName?: string; email?: string; subject?: string; body?: string; sentAt?: string; sentBy?: string; item?: string; spec?: string; requiredBy?: string; skippedReason?: string; response?: { canSupply: 'Yes' | 'Partly' | 'No'; meetsSpec: 'Yes' | 'With deviation' | 'No'; capacityPerMonth?: string; leadTimeDays?: number; indicativePrice?: number; certifications?: string; remarks?: string; contactName: string; respondedAt: string } }
export interface Evaluation { dept: string; cbaVerified?: boolean; cbaNote?: string; risks?: RiskItem[]; riskRemarks?: string; supplier?: SupplierCheck; decision?: 'Recommend' | 'Reject'; remarks?: string; by?: string; at?: string }
export interface ApprovalLock { commercialOk: boolean; supplierAligned: 'Confirmed' | 'Skipped' | 'Not confirmed'; budget: number; timelineMonths: number; startDate: string; endDate: string; targetSaving: number; signatureName: string; signatureData?: string; signedAt: string; signedBy: string }
export interface Verification { handedAt?: string; handedBy?: string; mrnAtApproved?: boolean; financeValidated?: boolean; targetAchieved?: boolean; realisedAtVerification?: number; targetAtVerification?: number; verifiedAt?: string; verifiedBy?: string; remarks?: string; returnedAt?: string; returnReason?: string }
// Idea += feasibilityCheck?, evaluation?, lock?, verification?, coDate?: string, showcase?: number
// Supplier += tier?: 'Tier 1' | 'Tier 2'; RoleKey += 'feasibility'
// masters: STAGE = { submitted, feasibility, evaluation: 'Evaluation', approval, execution, verification: 'Verification' }
// WORKFLOW_STAGES = [feasibility, evaluation, approval, execution, verification]; TRACKER_STAGES = [submitted, ...]
// FINAL_MILESTONES = ['First MRN at new price', 'Implementation confirmed', 'Handed for verification']
// RISK_FACTORS = [{ key: 'quality', label: 'Quality' }, { key: 'supply', label: 'Supply continuity' }, { key: 'oem', label: 'Customer / OEM approval' }, { key: 'tooling', label: 'Tooling & lead time' }, { key: 'price', label: 'Price volatility' }]
```
- [ ] Step 1: Add the types; remove `TechEval` usage from `Idea` (replace `techEval` with `evaluation`).
- [ ] Step 2: masters — new `STAGE`, stage lists, `STAGE_SLA_KEY` (feasibility / evaluation / approval), SLA rules (Team feasibility check 5 wd, Evaluation 10 wd, Sourcing approval 3 wd, Finance validation 5 wd), milestone templates = route steps + `FINAL_MILESTONES`, supplier `tier` (Tier 1 for spend ≥ ₹ 500 Cr or the four OEM-critical suppliers; Sunrise Fasteners V10021 and Shakti Steel V10005 Tier 2), `feasibility` role on buyers, leads and one member of R&D / Quality / DQA / Process / Production, ROLE_LABEL `Feasibility team`.
- [ ] Step 3: `npx tsc --noEmit -p .` — fix every compile error the type change surfaces (listed in Task 3–5). Commit with Task 3.

### Task 3: Store actions

**Files:** Modify `src/store/useStore.ts`, `src/lib/calc.ts`.

**Interfaces — Produces (Actions):**
```ts
recordFeasibility: (id: string, c: Omit<FeasibilityCheck, 'by' | 'byDept' | 'at'>) => void      // Go → Evaluation; No-go → dropIdea('Not feasible')
saveEvaluation: (id: string, patch: Partial<Evaluation>) => void                                   // draft save, stays in stage
sendSupplierCheck: (id: string, s: { supplierCode?: string; supplierName: string; contactName: string; email: string; item: string; spec: string; requiredBy: string; subject: string; body: string }) => string // returns token, logs email
respondSupplierCheck: (token: string, r: NonNullable<SupplierCheck['response']>) => boolean       // false when token unknown / already answered
skipSupplierCheck: (id: string) => void                                                            // only below SUPPLIER_CHECK_MIN
recordEvaluation: (id: string, decision: 'Recommend' | 'Reject', remarks?: string) => void        // Recommend → Sourcing approval; Reject → reject()
signLock: (id: string, lock: Omit<ApprovalLock, 'signedAt' | 'signedBy'>) => void
approve: (id: string, remarks?: string) => void        // Sourcing Head clears all pending levels; final level requires idea.lock
handOverForVerification: (id: string, effectiveDate: string, approvedPrices: Record<string, number>) => void // replaces markDone; stage → Verification
verifyIdea: (id: string, v: { mrnAtApproved: boolean; financeValidated: boolean; targetAchieved: boolean; remarks?: string }) => void
returnToExecution: (id: string, reason: string) => void
```
- [ ] Step 1: `submitIdea` → stage `Team feasibility check`; `onEnterStage(Evaluation)` creates `evaluation = { dept: evalDeptOf(idea.department), supplier: needsSupplierCheck(annual) ? { status: 'Not sent' } : { status: 'Skipped', skippedReason: 'Below minimum saving threshold (₹ 5 L)' } }` and notifies evaluators of that dept (head always).
- [ ] Step 2: `createExecution` uses `idea.lock` (start / end / months) and route milestones incl. `FINAL_MILESTONES`; `toggleMilestone('First MRN at new price')` sets `execution.effectiveDate` to the done date.
- [ ] Step 3: `bucketFor`: `Verification` → `Implemented`; `canSeeIdea`: evaluators see ideas whose `evaluation.dept` = their department.
- [ ] Step 4: `realiseMonth` (seed) counts ideas with `execution.effectiveDate` in `In Execution` or `Implemented`.
- [ ] Step 5: Persist key `coin-cost-innovation-hub-v7`; add v6 to removed keys; `settings.lastRealisationMonth` from seed.
- [ ] Step 6: tsc clean, `npm test` green. Commit `feat: six-stage store actions`.

### Task 4: Seed

**Files:** Modify `src/lib/seed.ts`.
- [ ] Demo "today" = real today (not before 2026-10-01); last realised month = month before today (not before 2026-08).
- [ ] Portfolio ideas get stage records for every stage they passed: feasibility check (Go), evaluation (CBA verified, 5 risks, supplier check responded or skipped < ₹ 5 L), lock (6 months default, signed by approver), verification (handed; ~60 % verified) — and ledger from first MRN.
- [ ] Supplier submissions chance 0.4 for the four supplier users' commodities.
- [ ] Six showcase ideas (`showcase: 1…6`), commodity FAS/CMP/STL/PCB/ALU/CUT, one per stage, all forms filled up to their stage; S3 has a responded supplier form, S4 a signed lock, S5 first MRN + implementation confirmed + handed for verification, S6 verified with ledger meeting the target.
- [ ] Commit `feat: seed six-stage records and showcase ideas`.

### Task 5: Model, tracker, permissions, board

**Files:** Modify `src/pages/idea/model.ts`, `StageTracker.tsx`, `ActionBar.tsx`, `Kanban.tsx`, `src/components/ui.tsx` (`StageBadge` label), `src/lib/nav.ts`.
- [ ] `ideaPerms` → `feasibilityCheck` (stage 2, roles feasibility/buyer/lead/head), `evaluate` (stage 3, techeval of `evaluation.dept` or lead/buyer in scope when dept = Sourcing, or head), `approve` (stage 4, approval matrix; head always), `handOver` / `verify` / `returnToExecution` (stage 5/6, execute rights / head / finance).
- [ ] Tracker labels via `stageLabel`; last node `Verification` shows `Verified ✓` or `Pending`.
- [ ] `STAGE_GROUPS`: feasibility · evaluation · approval · execution (CO) · verification (CO) · dropped. `kanbanMove` gates: into Evaluation needs `feasibilityCheck.decision === 'Go'`; into Sourcing approval needs `evaluation.decision === 'Recommend'`; into Execution started needs `lock` + all approvals; into Verification needs effective date (first MRN); reasons name the form.
- [ ] Nav: Execution Hub `spaces: ['CO']`; `spaceForPath('/execution' | '/proof')` → `CO`; CO items: Dashboard (LENS), PROOF, Execution Hub (TRACE), Verification list.
- [ ] tsc clean. Commit.

### Task 6: Stage forms and pages

**Files:** Create `src/pages/idea/StageForms.tsx`, `src/pages/idea/StagePanels.tsx`, `src/pages/SupplierCheck.tsx`, `src/pages/SupplierForm.tsx`; Modify `ActionBar.tsx`, `Idea360.tsx`, `IdeaDrawer.tsx`, `src/App.tsx`.
- [ ] `FeasibilityCheckModal`: 4 questions (radio cards), cost flags from `costFlags`, duplicates from `duplicateCandidates`, departments-consulted chips, decision Go / No-go, remarks required on No-go.
- [ ] `EvaluationModal` tabs: **Cost-benefit** (per-part table, investment, net, payback, committed vs carry-over, quarter phasing, CBA verified tick) · **Risk** (5 factors × Low/Medium/High + ₹ at risk + note; overall + total) · **Supplier check** (status; button to `/ideas/:id/supplier-check`; skipped notice below ₹ 5 L) · **Decision** (Recommend / Reject / Send back).
- [ ] `SupplierCheck` page: supplier picker (commodity suppliers + "other vendor" email), item / spec / required-by fields prefilled without Amber data, template subject/body generated by `supplierCapabilityEmail` and editable, live `amberDataLeaks` warning, Send → toast + outbox, "Open supplier form" link (new tab), response card when answered.
- [ ] `SupplierForm` (route outside `AppShell` and login): neutral vendor page, request summary, form fields, submit → thank-you; invalid / answered token screens.
- [ ] `SourcingApprovalModal`: commercial assessment summary (CBA, overall risk, ₹ at risk), supplier alignment (response / skipped), budget + timeline (months chips 3/6/9/12) + start date + computed end date + target saving, `SignaturePad` (canvas, clear) + typed name + date, approve.
- [ ] Idea page: replace Feasibility/TechEval/Approvals panels with `StagePanels` (four cards), drawer shows compact versions.
- [ ] Browser check every form on the showcase ideas. Commit.

## Phase 2 — CO execution, plan vs actual, verification

### Task 7: Execution Hub (TRACE) and verification

**Files:** Modify `src/pages/ExecutionHub.tsx`, `src/pages/exec/ExecModals.tsx`, `src/pages/idea/Panels.tsx`; Create `src/pages/idea/PlanVsActual.tsx`.
- [ ] Hub stage segment: Execution started · Verification · Verified; KPI cards add "Awaiting verification".
- [ ] Expanded row: plan vs actual chart (`planVsActual`), CO date (editable), MRN link ("ERP MRN feed — future link"), NPD status.
- [ ] `MarkDoneModal` → "Hand over for verification" (effective date = first MRN, approved price per part) → `handOverForVerification`; ticking the "Handed for verification" milestone opens it.
- [ ] `VerificationModal`: three checks pre-computed from ledger (MRN at approved price / no leakage, Finance validated, realised ≥ prorated target), remarks, Verify or Return to execution (reason required).
- [ ] Idea page Execution card shows plan vs actual + CO date + MRN link. Commit.

### Task 8: PROOF page

**Files:** Create `src/pages/Proof.tsx`; Modify `src/App.tsx`, `src/lib/nav.ts`.
- [ ] Portfolio plan vs actual (sum of locked plans by month vs MRN actual) with projection; part-wise table: part, description, idea, supplier, baseline, approved price, MRN qty, realised, leakage, plan to date, variance; filters via FilterBar; Excel export. Commit.

## Phase 3 — Look, home and dashboards

### Task 9: Palette and coin logo
- [ ] `index.css`: brand scale navy (50 #f2f4fa … 600 #223c86, 700 #1b316f, 900 #13234b), accent scale Amber red (500 #d7192d), gold scale → steel blue, gradients (`bg-brand-grad`, `bg-hero`, `text-brand-grad`) navy/red.
- [ ] Sweep hard-coded blues/golds (`#2459e0`, `#2f5bc6`, `#4470d6`, `#3b74f2`, `#2850b0`, `#bf8f3f`, `#a07433`, rgb shadow `36 89 224`, `47 91 198`) to the new palette.
- [ ] `CoinMark` SVG (reeded edge, navy face, Amber red ring, white ₹). Commit.

### Task 10: KPI tiles and dashboards
- [ ] Extract `KpiTile` to `src/components/KpiTile.tsx`; `CoKpis` uses it; new `InKpis` (Pipeline hero · In execution · Implemented · Dropped) and `HomeKpis` (Pipeline · In execution · Implemented · Realised hero).
- [ ] `SourcesCard` (Internal: by commodity / department / individual; External: Tier 1 / Tier 2 / via campaigns) using `sourceBreakdown`; IN value = annualised, CO value = committed + realised.
- [ ] IN dashboard = InKpis + SourcesCard; IN advanced = Portfolio + SLA watch + existing. CO dashboard = CoKpis + SourcesCard + portfolio plan vs actual; CO advanced = Implementation pipeline + Execution health + existing. Commit.

### Task 11: Home
- [ ] Greeting with `CoinMark`, `HomeKpis`, CO card with LENS / PROOF / TRACE blocks (acronym, full form, live stat, click opens `/` CO dashboard, `/proof`, `/execution` in CO), IN card "Enter the world of ideas · Amber Cost Optimisation and Innovation Network", six-stage walkthrough strip (showcase ideas). Commit.

### Task 12: Verify, document, ship, run locally
- [ ] `npm test`, `npx tsc --noEmit -p .`, `npm run build`.
- [ ] Browser: walk the six showcase ideas and every form at 1440 and 375 widths; route sweep for console errors.
- [ ] README + Scope page notes on the six stages; commit; push to `main` (Vercel); start the local dev server on port 8742 for the user.
