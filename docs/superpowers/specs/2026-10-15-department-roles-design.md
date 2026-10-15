# COIN — department role ladder, role queues and colour themes

Date: 2026-10-15 · Branch: `feat/six-stage-workflow` · Front end only (localStorage, no backend)

## What Ayush asked for (his words, condensed)

1. Colours: "not exactly this navy … go through all the colour palettes and give me screenshots, I will choose."
2. Quick login must offer many accounts again, not only Sourcing Head and Admin.
3. Six roles, each with its own work: every employee submits; the **team lead** does the team feasibility check;
   the **department lead** does the evaluation; the **department head** does the approval; execution and verification
   are done by other people.
4. The stage tracker is department-wise: an R&D idea reads *Idea submitted → Team feasibility check → R&D evaluation →
   R&D approval → Execution started → Verification*; Finance, HR and the rest read the same with their department name.
5. Every role sees the list of ideas waiting for its action ("each role has a queue").

Answers to the follow-up questions:

| Question | Answer |
|---|---|
| Who executes (stage 5) and verifies (stage 6)? | An execution owner from the submitter's department executes; **Finance** verifies |
| "Every idea has its own working hour" | Each role has a queue — ideas waiting for that person, with how long each has waited |
| Can Sourcing Head and Admin still act everywhere? | Yes — strict roles for everyone else, both can override |
| Which departments? | R&D, DQA, Quality, Process, Production, Finance, Sourcing, and a new **HR** — 8 departments |

## 1. Colour themes (built, awaiting the choice)

- Every colour in the app now comes from one palette: `src/lib/theme.ts` names a handful of base colours per palette and
  generates 50–950 ramps in OKLCH, written to the Tailwind `--color-*` variables at start-up. All 678 hard-coded hex
  values were moved to these variables, so classes, inline styles and chart fills follow the palette.
- Eight palettes: Amber Navy, Midnight Cobalt, Royal Light, Graphite & Crimson, Deep Ocean, Indigo Twilight,
  Ivory Heritage, Arctic White. The header has a palette button to switch live; the choice is kept per browser.
- **After Ayush picks one, it becomes the default** (`DEFAULT_PALETTE`). The picker stays so others can try the rest.

## 2. The six roles

| # | Stage (IN / CO) | Role | Who, for an idea from department D |
|---|---|---|---|
| 1 | Idea submitted (IN) | **Employee** | anyone; Draft → submit |
| 2 | Team feasibility check (IN) | **Team lead** | team lead of D (Sourcing: the commodity lead of the idea's commodity) |
| 3 | *D* evaluation (IN) | **Department lead** | department lead of D — cost-benefit, risk, supplier check (≥ ₹ 5 L) |
| 4 | *D* approval (IN) | **Department head** | department head of D — commercial assessment, supplier confirmation, budget + timeline lock, signature |
| 5 | Execution started (CO) | **Execution owner** | execution owner of D (Sourcing: the commodity buyer) |
| 6 | Verification (CO) | **Verifier** | Finance controller |

- D = `evalDeptOf(submitter's department)`; supplier ideas and Management / Sourcing Excellence ideas go to **Sourcing**.
- **Override:** Sourcing Head and Admin can act at every stage (shown as "acting as override" in the activity log).
- Nobody clears the feasibility check of their own idea; if the team lead is the submitter, the idea is routed to the
  department lead (override users excepted).
- **Stage 4 is renamed** from "Sourcing approval" to "Approval" (stored) and shown as "*D* approval" — like stage 3.
  One approval level: the department head of D. The value-based approval matrix (Commodity Lead → Sourcing Head) is
  retired; the admin screen shows the new ladder instead.

### Role keys

New `RoleKey`s: `teamlead`, `deptlead`, `depthead`, `execowner`. `submitter` is labelled **Employee**.
Retired: `feasibility`, `techeval` (folded into `teamlead` / `deptlead`). Kept: `buyer`, `lead` (Sourcing commodity
scope for campaigns, workshops and supplier ideas), `finance` (Verifier), `head`, `admin`, `mgmt`, `supplier`.

### Routing — one pure function

`stageAssignee(idea, stage, users)` in `src/lib/workflow.ts` returns the user id expected to act:
team lead / department lead / department head / execution owner of D (commodity-matched inside Sourcing; `idea.ownerId`
wins for execution after a reassignment), and the Finance verifier for stage 6. Used by permissions, "waiting on",
queues and notifications, so all four always agree.

### Permissions (`ideaPerms`)

| Action | Allowed for |
|---|---|
| Team feasibility check | `teamlead` of D, not on their own idea · override |
| Evaluation (CBA, risk, supplier check) | `deptlead` of D · override |
| Approval + lock signature | `depthead` of D · override |
| Execution (milestones, hand over, drop, NPD/PAP sync) | `execowner` of D, or the reassigned owner · override |
| Verification (verify, verify with exception, return) | `finance` · override (exception still Sourcing Head only) |
| Send back / request info | whoever may act at the current stage |

### Visibility (`canSeeIdea`)

Head, Finance, Management, Admin: everything. Department roles: every idea of their department. Buyers / leads: their
commodities (as today). Employees: their own ideas. Suppliers: their own supplier code.

## 3. Queues — "My queue"

- New page **My queue** (`/queue`) in both workspaces, with a count badge in the sidebar.
- `queueFor(me, ideas)`: ideas where `stageAssignee` is me, or where I hold the stage role for that department —
  each row: idea, stage (department label), waiting since (days + hours since `stageEnteredAt`), SLA state
  (on time / due / breached, from the SLA master), value, and the action button (opens the stage form).
- Override users see two tabs: **Assigned to me** and **All pending** (every stage, grouped).
- Every role's home shows the top of their queue first; the dashboards follow underneath (department-scoped by visibility).

## 4. Demo accounts and quick login

- 8 departments × 5 roles (Employee, Team lead, Department lead, Department head, Execution owner) = 40 accounts, plus
  Finance verifier, Sourcing Head, Admin, Management and four suppliers. Existing people keep their names
  (e.g. Neha Verma = R&D employee, Dr. Priya Nair = R&D department lead, Suresh Yadav = Production head,
  Girish Saluja = Sourcing department head + override); the rest are new.
- Login page: **department chips** → five role tiles for that department, plus a "Cross-functional" row
  (Finance verifier, Sourcing Head, Admin, Management, Supplier). Each tile says what that role does.
- The user menu's "Switch demo persona" uses the same picker.

## 5. Seed data

- Ideas spread across all 8 departments (indirect / HR ideas such as canteen, travel and staffing contracts included).
- Every stage record is authored by the right person: feasibility by the team lead, evaluation by the department lead,
  lock signed by the department head, execution owned by the execution owner, verification by Finance.
- The six-stage walkthrough stays (one idea per stage) and uses at least three different departments.
- Storage key bumps to `coin-cost-innovation-hub-v8` (fresh seed; v7 removed on load). Reset stays deterministic.

## 6. Testing

- Unit tests: `stageAssignee` per department, Sourcing commodity matching, supplier ideas → Sourcing, own-idea re-route;
  `ideaPerms` per role (each role can act only at its stage and department; override acts everywhere; employee never);
  `canSeeIdea` for department roles; `queueFor` (assigned vs all pending); seed authorship per stage; reset determinism.
- Browser: sign in as each of the six roles from quick login, open My queue, act on one idea at that stage;
  walk one HR idea from submission to verification by switching personas; check all eight palettes render.

## Out of scope

Backend, real email, real SSO; per-team (sub-department) structures beyond one team lead per department
(Sourcing keeps commodity leads as its team leads).
