# COIN — Cost Optimisation & Innovation Network

**In-app name: COIN (Cost Optimisation & Innovation Network).** This is a front-end-only demo for Amber Enterprises India Ltd., built from *COIN — Scope of Work v1.0 (Oct 1, 2026)*.

- **No backend.** Every idea, approval, ledger entry, campaign, notification, email and setting is kept in the browser's `localStorage` (key `coin-cost-innovation-hub-v15`).
- **Port 8742.** Uses `--strictPort`, so it won't quietly move to 5173 or another common port.

## Run

```bash
npm install
npm run dev        # http://localhost:8742
npm test           # workflow rules + demo seed (Vitest)
```

To serve a production build: `npm run build`, then `npm run preview` (also on port 8742).

## Demo logins

There are ten sign-in IDs and every one uses the password **`coin@2026`**. The login page asks for the workspace first —
**Innovation Network** (ideas, workshops, approval) or **Cost Optimisation** (execution, MRN, verification) — and shows the
sign-in form only after one of the two cards is picked; **Change** goes back. People do not sign in: whoever is behind an ID
types their name and employee ID on the form, on the workshop event and at sign-off. Suppliers do not sign in either: they
reach COIN through a campaign's unique link.

| ID | Email | Role |
|---|---|---|
| R&D, DQA, Quality, Process, Production, Finance, Sourcing, HR | `rnd@`, `dqa@`, `quality@`, `process@`, `production@`, `finance@`, `sourcing@`, `hr@` | Idea Submitter and Workshop Owner for their own department |
| Management ID | `management@` | Management: approves, allocates the KPI and signs; can step in at every stage |
| Execution Manager ID | `execution@` | Execution Manager: sees and runs every execution started, from every department |

Emails end in `@ambergroupindia.com`. The Finance ID is also the Finance Verifier. To restore the original seed data, use
**User menu → Reset demo data**.

## Five-stage workflow (every idea)

An idea stays with its submitter's department until the workshop closes (supplier ideas go to Sourcing). Stages 1 to 3 sit in
Innovation Network (IN), stages 4 and 5 in Cost Optimisation (CO).

| # | Stage | Workspace | Role | Sign-in ID | What happens |
|---|---|---|---|---|---|
| 1 | Idea submitted | IN | Idea Submitter | Any department ID | Capture My Idea: the person, the scope, the parts or supplier |
| 2 | Workshop / event creation | IN | Workshop Owner | The idea's department ID, one owner per workshop | Numbered steps with the current one highlighted: create the event, technical feasibility, commercial evaluation (from ₹ 5 L), close the event with Follow-up or Go ahead |
| 3 | Management approval & KPI allocation | IN | Management | Management ID | Commercial assessment, supplier alignment, budget, KPI and timeline, signed and locked |
| 4 | Execution started | CO | Execution Manager | Execution Manager ID | Execution Hub: NPD / PAP milestones, month by month savings from MRN. The department watches, view only |
| 5 | Verification | CO | Finance Verifier | Finance ID | The locked timeline ends, COIN moves the idea here, Finance verifies against the MRN |

**My queue** (`/queue`) lists what is waiting for the signed-in ID, with how long each has waited and its SLA state. A
workshop row shows its step, for example `2/4 Technical feasibility`, and the button is named after that step. The Management
ID also sees every open item. **Workshops** (`/workshops`) lists stage 2, and **Who does what** on that page and on the
sign-in card maps each stage to its role and opens it.

A dropped or rejected idea stays dropped; a fresh attempt is a new idea.

## Colour themes

Every colour comes from one palette (`src/lib/theme.ts`): eight palettes generate full OKLCH ramps written to the
Tailwind colour variables. **Indigo Twilight** is the default; the palette button in the header switches live and the
choice is kept per browser.

## Workspaces and modules

After sign-in the Home page shows the COIN coin mark, the headline KPI row and the two workspaces. A click anywhere on a
workspace card opens it (LENS / PROOF / TRACE open their own page inside CO); in the sidebar the **CO | IN** switch opens
the other workspace in one click and **Overview** (or the amber logo) returns to this page.

The headline KPI row — **Pipeline · In execution · Implemented · Realised (MRN)** — is the same four tiles on the Home,
the IN dashboard and the CO dashboard, for every role. Employees and suppliers count their own ideas and the tiles open
My Ideas; everyone else counts the ideas they can see and the tiles open the register, Execution Hub or Savings proof.

- **CO · Cost Optimisation** — **LENS** (Linked Evidence of Negotiation and Savings → dashboard), **PROOF** (Part-linked Realisation and Optimisation Output Framework → `/proof`), **TRACE** (Transition-linked Realisation of Actual Cost Evidence → Execution Hub).
- **IN · Innovation Network** — "Enter the world of ideas": ideas, campaigns, team feasibility check, department evaluation and department approval.

Both dashboards show internal ideas (by commodity, department, individual) against external supplier ideas (Tier 1, Tier 2, via campaigns); Advanced analytics holds the idea portfolio, SLA watch, implementation pipeline and execution health.

| # | Module | Workspace | Route |
|---|---|---|---|
| M1 | Dashboard + Advanced analytics (role-based) | CO, IN | `/` |
| M2 | Idea Register / My Ideas (board gated by the stage forms) | IN (Verification list in CO) | `/ideas`, `/my-ideas` |
| M3 | Submit Idea (steps A–E, fixed summary) | IN | `/submit` |
| M4 | Idea 360 | both | `/ideas/:id`, plus a side panel |
| — | Supplier capability check / public supplier form | IN / public | `/ideas/:id/supplier-check`, `/supplier-form/:token` |
| M7 | Campaigns — supplier email outreach via Supplier Portal | IN | `/campaigns` |
| M8 | Execution Hub (TRACE) — Execution started → Verification | CO | `/execution` |
| M9 | Savings proof (PROOF) — part-wise plan vs actual from MRN | CO | `/proof` |
| — | NPD development master (read-only, synced from VMS) | both | `/npd` |
| M10 | MIS — reports & KPIs scoped to the workspace | both | `/reports` |
| M12 | Admin & Masters | IN | `/admin` |
| — | Scope & Methodology | both | `/scope` |

COIN has no savings targets.

## Savings methodology (Section 4)

- **Saving / unit** = P(baseline) − P(new)
- **Annualised impact** = (P(baseline) − P(new)) × Q(last FY MRN)
- **Realised** = (P(baseline) − P(approved)) × Q(MRN after effective date)

Idea `COIN-FY27-FAS-0012` reproduces the worked example from Section 4:

- Price drops from ₹ 4.20 to ₹ 3.85 on 24,00,000 units, a saving of ₹ 0.35 per unit.
- Annualised impact is ₹ 8.40 lakh.
- It goes live on 1 October, so ₹ 4.20 lakh is committed this FY and ₹ 4.20 lakh carries over to the next.
- Its signed lock is 6 months from 1 October, so the locked target is also ₹ 4.20 lakh.

## Stack

| Area | Library |
|---|---|
| App and build | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS v4 |
| Animation | `motion`, `@number-flow/react` (animated KPI tickers) |
| Charts and icons | Recharts, lucide-react |
| State | Zustand with `localStorage` persistence |
| Export | SheetJS (Excel), jsPDF + autotable (PDF) |
| Celebration | canvas-confetti |
