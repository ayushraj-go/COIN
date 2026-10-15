# Department role ladder + queues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six roles with their own work (Employee → Team lead → Department lead → Department head → Execution owner → Finance verifier), department-named stages 3–4, a "My queue" per role, 40 department demo accounts with a department picker on login, and Indigo Twilight as the default palette.

**Architecture:** One pure routing module (`ladderOf` / `stageAssignee` in `src/lib/workflow.ts`) decides who acts at each stage; permissions (`ideaPerms`), visibility (`canSeeIdea`), "waiting on", queues, notifications and the seed all call it, so they cannot disagree. Stage 4 is stored as `Approval` and shown as `<dept> approval` through the existing `stageLabel`.

**Tech Stack:** Vite 6, React 18, TypeScript (non-strict), Tailwind v4, zustand 5 (persisted), vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-department-roles-design.md`

## Global Constraints

- Front end only — localStorage, no backend.
- Departments: R&D, DQA, Quality, Process, Production, Finance, Sourcing, HR (8). Supplier / Management / Sourcing Excellence ideas route to Sourcing.
- Roles: `submitter` (label Employee), `teamlead`, `deptlead`, `depthead`, `execowner`, `finance` (label Finance verifier); `head` and `admin` override every stage; `buyer`, `lead`, `mgmt`, `supplier` stay.
- Stage names stored: `Idea submitted`, `Team feasibility check`, `Evaluation`, `Approval`, `Execution started`, `Verification`; stages 3–4 display as `<dept> evaluation` / `<dept> approval`.
- Nobody clears the feasibility check of their own idea (override users excepted).
- Verify-with-exception stays Sourcing Head only.
- Storage key `coin-cost-innovation-hub-v8`; older keys removed on load; reset deterministic.
- Default palette `indigo` (Indigo Twilight).
- Ask before pushing to `main`.

## Review Focus

- A department role holder must not act on another department's idea (e.g. R&D team lead on an HR idea) — perms test per role × foreign department.
- The team lead who submitted an idea: the feasibility step must route to the department lead, not dead-end — `stageAssignee` test.
- Supplier-submitted ideas (department `Supplier`) must route to Sourcing at every stage — `ladderOf` test.
- Old persisted state (v7) must not crash: key bump removes it — store load test via seed determinism + manual reload check.
- An execution reassigned to another owner (`idea.ownerId`) must move to that person's queue — queue test.

---

### Task 1: Indigo Twilight default

**Files:** Modify `src/lib/theme.ts` (`DEFAULT_PALETTE`), `src/lib/theme.test.ts`.

- [ ] Change `export const DEFAULT_PALETTE = 'amber-navy'` to `'indigo'`; add test `expect(DEFAULT_PALETTE).toBe('indigo')`.
- [ ] `npx vitest run src/lib/theme.test.ts` → pass. Commit.

### Task 2: Roles, departments, 40 demo accounts, routing

**Files:** Modify `src/lib/types.ts` (RoleKey + `'teamlead' | 'deptlead' | 'depthead' | 'execowner'`, Department + `'HR'`, drop `'feasibility' | 'techeval'`), `src/lib/masters.ts` (USERS_DEFAULT, DEMO_LOGINS → `DEMO_DIRECTORY`), `src/lib/nav.ts` (PERMS, ROLE_LABEL, primaryRole), `src/lib/workflow.ts` (EVAL_DEPTS + HR, `ladderOf`, `stageAssignee`). Test: `src/lib/roles.test.ts`.

**Interfaces — Produces:**
```ts
export const DEPARTMENTS = ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance', 'Sourcing', 'HR'] as const
export interface Ladder { dept: string; teamLead?: string; deptLead?: string; deptHead?: string; execOwner?: string; verifier?: string }
export function ladderOf(dept: string, commodity: string, users: User[]): Ladder
/** user id expected to act at `stage` (undefined for Draft / closed stages) */
export function stageAssignee(idea: Idea, stage: string, users: User[]): string | undefined
```
Rules: within `dept`, pick the first active user holding the role; in Sourcing prefer the holder whose `commodities` include the idea's commodity (team lead = commodity lead, execution owner = commodity buyer). Verifier = first `finance` user. Feasibility: if the team lead is the submitter → department lead. Execution: `idea.ownerId` wins when set.

People (new ids in brackets, existing ids keep their names):
| Dept | Employee | Team lead | Dept lead | Dept head | Execution owner |
|---|---|---|---|---|---|
| R&D | u-sub1 Neha Verma | [u-rd-tl] Arvind Rao | u-eval1 Dr. Priya Nair | [u-rd-head] Dr. Sameer Kulkarni | [u-rd-exec] Rahul Jain |
| DQA | u-sub5 Tanvi Gupta | [u-dqa-tl] Pooja Nambiar | u-eval2 Amit Saxena | [u-dqa-head] Rajiv Bhalla | [u-dqa-exec] Sandeep Rawat |
| Quality | u-sub3 Farah Khan | [u-qa-tl] Mohit Arora | u-eval3 Ritu Malhotra | [u-qa-head] Anil Deshmukh | [u-qa-exec] Kavya Reddy |
| Process | u-sub4 Harish Menon | [u-pe-tl] Nitin Chawla | u-eval4 Karan Bhatia | [u-pe-head] Manoj Pillai | [u-pe-exec] Siddharth Bose |
| Production | u-sub2 Vivek Chauhan | [u-pr-tl] Gurmeet Singh | [u-pr-lead] Deepika Sharma | u-eval5 Suresh Yadav | [u-pr-exec] Ravi Teja |
| Finance | [u-fi-emp] Ankita Jain | [u-fi-tl] Prakash Iyer | [u-fi-lead] Shalini Gupta | [u-fi-head] Vinod Agarwal | [u-fi-exec] Rohit Kapoor |
| Sourcing | [u-so-emp] Aditi Sharma | u-lead1/2/3 (commodity) | [u-so-lead] Ashok Menon | u-head Girish Saluja | u-buyer1…7 (commodity) |
| HR | [u-hr-emp] Simran Kaur | [u-hr-tl] Varun Malhotra | [u-hr-lead] Neelam Saxena | [u-hr-head] Lata Krishnan | [u-hr-exec] Imtiaz Ali |
Verifier: u-fin Meera Iyer (`finance`). Admin u-admin, Management u-mgmt, suppliers unchanged.

- [ ] **Step 1: failing tests** (`src/lib/roles.test.ts`):
```ts
import { describe, it, expect } from 'vitest'
import { USERS_DEFAULT } from './masters'
import { ladderOf, stageAssignee } from './workflow'
import { STAGE } from './masters'
const idea = (o: any) => ({ id: 'X', department: 'R&D', commodity: 'CMP', submitterId: 'u-sub1', stage: STAGE.feasibility, ...o })
describe('role ladder', () => {
  it('every department has all five roles', () => {
    for (const d of ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance', 'Sourcing', 'HR']) {
      const l = ladderOf(d, 'CMP', USERS_DEFAULT)
      expect([l.teamLead, l.deptLead, l.deptHead, l.execOwner].every(Boolean), d).toBe(true)
    }
  })
  it('routes each stage to the right person', () => {
    const i = idea({}) as any
    expect(stageAssignee(i, STAGE.feasibility, USERS_DEFAULT)).toBe('u-rd-tl')
    expect(stageAssignee(i, STAGE.evaluation, USERS_DEFAULT)).toBe('u-eval1')
    expect(stageAssignee(i, STAGE.approval, USERS_DEFAULT)).toBe('u-rd-head')
    expect(stageAssignee(i, STAGE.execution, USERS_DEFAULT)).toBe('u-rd-exec')
    expect(stageAssignee(i, STAGE.verification, USERS_DEFAULT)).toBe('u-fin')
  })
  it('Sourcing uses the commodity lead and buyer; supplier ideas go to Sourcing', () => {
    const i = idea({ department: 'Supplier', commodity: 'CMP', submitterId: 'u-sup2' }) as any
    expect(stageAssignee(i, STAGE.feasibility, USERS_DEFAULT)).toBe('u-lead2')
    expect(stageAssignee(i, STAGE.execution, USERS_DEFAULT)).toBe('u-buyer3')
    expect(stageAssignee(i, STAGE.approval, USERS_DEFAULT)).toBe('u-head')
  })
  it('a team lead never checks their own idea; a reassigned owner wins', () => {
    expect(stageAssignee(idea({ submitterId: 'u-rd-tl' }) as any, STAGE.feasibility, USERS_DEFAULT)).toBe('u-eval1')
    expect(stageAssignee(idea({ ownerId: 'u-qa-exec' }) as any, STAGE.execution, USERS_DEFAULT)).toBe('u-qa-exec')
  })
})
```
- [ ] **Step 2:** run → FAIL (`ladderOf` not exported).
- [ ] **Step 3:** implement types, users, `ladderOf`, `stageAssignee`, PERMS (feasibility `['teamlead','head','admin']`, techeval `['deptlead','head','admin']`, approve `['depthead','head','admin']`, execute `['execowner','buyer','lead','head','admin']`, submit adds `teamlead,deptlead,depthead,execowner,finance`), ROLE_LABEL (Employee, Team lead, Department lead, Department head, Execution owner, Finance verifier), `primaryRole` order `admin, head, depthead, deptlead, teamlead, execowner, finance, mgmt, lead, buyer, supplier, submitter`.
- [ ] **Step 4:** run → PASS; `npx tsc --noEmit` and fix every reference to removed roles (`feasibility`, `techeval`). Commit.

### Task 3: Stage 4 = `<dept> approval`, permissions, visibility, store actions

**Files:** `src/lib/masters.ts` (`STAGE.approval = 'Approval'`, SLA rule names), `src/lib/workflow.ts` (`stageLabel` for Approval), `src/lib/calc.ts` (`canSeeIdea`), `src/pages/idea/model.ts` (`ideaPerms`, `waitingOn`), `src/store/useStore.ts` (onEnterStage approvals = one `<dept> head` level; `approve` single level + override; `createExecution` owner = `stageAssignee(…execution)`; evaluation notifications to the department lead; key v8), every literal `'Sourcing approval'`. Test: `src/lib/roles.test.ts` (perms + visibility).

- [ ] **Step 1: failing tests** — append:
```ts
import { ideaPerms } from '../pages/idea/model'
import { canSeeIdea } from './calc'
const U = (id: string) => USERS_DEFAULT.find((u) => u.id === id)!
const at = (stage: string, o: any = {}) => ({ ...idea({ stage, bucket: stage === STAGE.execution ? 'In Execution' : stage === STAGE.verification ? 'Implemented' : 'Pipeline', approvals: [{ level: 'R&D head', approverId: 'u-rd-head' }], execution: { status: 'In Execution', milestones: [] }, evaluation: { dept: 'R&D' }, ...o }) }) as any
describe('who may act', () => {
  it('each role acts only at its own stage, in its own department', () => {
    expect(ideaPerms(U('u-rd-tl'), at(STAGE.feasibility)).feasibilityCheck).toBe(true)
    expect(ideaPerms(U('u-hr-tl'), at(STAGE.feasibility)).feasibilityCheck).toBe(false)
    expect(ideaPerms(U('u-rd-tl'), at(STAGE.evaluation)).evaluate).toBe(false)
    expect(ideaPerms(U('u-eval1'), at(STAGE.evaluation)).evaluate).toBe(true)
    expect(ideaPerms(U('u-hr-lead'), at(STAGE.evaluation)).evaluate).toBe(false)
    expect(ideaPerms(U('u-rd-head'), at(STAGE.approval)).approve).toBe(true)
    expect(ideaPerms(U('u-qa-head'), at(STAGE.approval)).approve).toBe(false)
    expect(ideaPerms(U('u-rd-exec'), at(STAGE.execution)).handOver).toBe(true)
    expect(ideaPerms(U('u-hr-exec'), at(STAGE.execution)).handOver).toBe(false)
    expect(ideaPerms(U('u-fin'), at(STAGE.verification)).verify).toBe(true)
    expect(ideaPerms(U('u-rd-head'), at(STAGE.verification)).verify).toBe(false)
  })
  it('employees never act; Sourcing Head and Admin override', () => {
    for (const s of [STAGE.feasibility, STAGE.evaluation, STAGE.approval]) {
      const p = ideaPerms(U('u-sub1'), at(s, { submitterId: 'u-sub4' }))
      expect(p.feasibilityCheck || p.evaluate || p.approve).toBe(false)
      for (const o of ['u-head', 'u-admin']) { const q = ideaPerms(U(o), at(s)); expect(q.feasibilityCheck || q.evaluate || q.approve, `${o} ${s}`).toBe(true) }
    }
  })
  it('department roles see their department, employees only their own', () => {
    expect(canSeeIdea(U('u-rd-tl'), at(STAGE.evaluation))).toBe(true)
    expect(canSeeIdea(U('u-hr-tl'), at(STAGE.evaluation))).toBe(false)
    expect(canSeeIdea(U('u-sub4'), at(STAGE.evaluation))).toBe(false)
  })
})
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement. `ideaPerms` core:
```ts
const dept = ideaDept(idea)                    // evaluation?.dept ?? evalDeptOf(idea.department)
const override = hasRole(me, 'head', 'admin')
const inDept = me.department === dept
const feasibilityCheck = pipeline && stage === STAGE.feasibility && (override || (hasRole(me, 'teamlead') && inDept && idea.submitterId !== me.id) || (stageAssignee(idea, stage, users) === me.id))
const evaluate = pipeline && stage === STAGE.evaluation && (override || (hasRole(me, 'deptlead') && inDept))
const approve = pipeline && stage === STAGE.approval && (override || (hasRole(me, 'depthead') && inDept))
const executor = override || idea.ownerId === me.id || (hasRole(me, 'execowner') && inDept)
const verify = stage === STAGE.verification && !idea.verification?.verifiedAt && (override || hasRole(me, 'finance'))
```
`canSeeIdea`: department roles (`teamlead|deptlead|depthead|execowner`) see ideas whose `ideaDept` equals their department; keep the rest.
- [ ] **Step 4:** run all tests; update `workflow.store.test.ts` expectations that used `u-eval1` as evaluator of any dept / `feasibility` role. Commit.

### Task 4: Seed — departments, authorship, v8

**Files:** `src/lib/seed.ts`, `src/lib/seed.test.ts`.
- Submitters drawn from all 8 departments (employees + some leads); FAC/FRT/MRO ideas lean to HR/Finance submitters.
- Each stage record authored via `ladderOf(evalDept, commodity, users)`: feasibility `teamLead` (deptLead if submitter), evaluation `deptLead`, approvals `[{ level: '<dept> head', approverId: deptHead }]`, lock signer `deptHead`, execution `ownerId = execOwner`, verification `verifiedBy = 'Meera Iyer'`.
- Showcase ideas: S1 R&D, S2 Quality, S3 HR (FAC), S4 Finance? keep commodities; at least three departments.
- [ ] **Step 1: failing test** (seed.test.ts):
```ts
it('every stage record is authored by the department ladder', () => {
  const name = (id?: string) => USERS_DEFAULT.find((u) => u.id === id)?.name
  for (const i of seed.ideas.filter((x) => x.lock)) {
    const l = ladderOf(i.evaluation!.dept, i.commodity, USERS_DEFAULT)
    expect(i.evaluation!.by, i.id).toBe(name(l.deptLead))
    expect(i.lock!.signedBy, i.id).toBe(name(l.deptHead))
    expect(i.approvals[0].level, i.id).toBe(`${i.evaluation!.dept} head`)
  }
  const depts = new Set(seed.ideas.map((i) => i.evaluation?.dept).filter(Boolean))
  expect(depts.size).toBe(8)
})
```
- [ ] **Step 2–4:** fail → implement → pass; seed determinism test still green. Commit.

### Task 5: My queue

**Files:** Create `src/pages/queue/model.ts`, `src/pages/Queue.tsx`, `src/pages/queue/QueuePeek.tsx`; modify `src/App.tsx` (route `/queue`), `src/lib/nav.ts` (item "My queue", both spaces, badge), `src/pages/home/SourcingHome.tsx`, `src/pages/co/CoHome.tsx` (peek on top), `src/pages/Home.tsx` (EvaluatorHome retired → SourcingHome). Test: `src/pages/queue/model.test.ts`.

**Produces:**
```ts
export type QueueAction = 'feasibility' | 'evaluate' | 'approve' | 'execute' | 'verify'
export interface QueueRow { idea: Idea; action: QueueAction; assignedToMe: boolean; waitingHours: number; slaDays?: number; sla: 'ok' | 'due' | 'breach' }
export function queueFor(me: User, ideas: Idea[], users: User[], now?: number): { mine: QueueRow[]; all: QueueRow[] }
```
`mine` = rows where `stageAssignee === me.id` or the role-and-department rule allows the action (not override); `all` (override users) = every idea at stages 2–6 still open. Sorted by SLA breach first, then waiting time.
- [ ] **Step 1: failing test**:
```ts
it('queues follow the ladder', () => {
  const s = buildSeed(); const U = (id: string) => s.users.find((u) => u.id === id)!
  const tl = queueFor(U('u-rd-tl'), s.ideas, s.users)
  expect(tl.mine.length).toBeGreaterThan(0)
  expect(tl.mine.every((r) => r.action === 'feasibility' && r.idea.evaluation?.dept !== 'HR')).toBe(true)
  const fin = queueFor(U('u-fin'), s.ideas, s.users)
  expect(fin.mine.every((r) => r.action === 'verify')).toBe(true)
  expect(queueFor(U('u-sub1'), s.ideas, s.users).mine).toEqual([])
  expect(queueFor(U('u-head'), s.ideas, s.users).all.length).toBeGreaterThan(fin.mine.length)
})
```
- [ ] **Step 2–4:** fail → implement page (table: idea, stage label, waiting "3 d 4 h", SLA badge, value, "Open" action that opens the idea at its stage form) → pass. Commit.

### Task 6: Login + persona picker by department

**Files:** `src/pages/Login.tsx`, `src/components/AppShell.tsx` (UserMenu), new `src/components/PersonaPicker.tsx`.
- Department chips (8) → five role tiles (avatar, name, role, one-line duty) → sign in. "Cross-functional" row: Finance verifier, Sourcing Head, Admin, Management, Supplier.
- User menu "Switch demo persona" renders the same picker (compact).
- [ ] Implement, `tsc`, browser check each role signs in to its home with its queue. Commit.

### Task 7: Clean-up, verification, run locally

- Admin approval-matrix copy → department head approval; README role table; remove `EvaluatorHome` if unused.
- `npm test`, `tsc`, `vite build`; browser: six personas each act once; one HR idea walked 1→6 by switching personas; palette default Indigo.
- Commit; leave dev server on 8742.
