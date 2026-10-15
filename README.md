# COIN — Cost Optimisation & Innovation Network

**In-app name: Cost Innovation Hub.** This is a front-end-only demo for Amber Enterprises India Ltd., built from *COIN — Scope of Work v1.0 (Oct 1, 2026)*.

- **No backend.** Every idea, approval, ledger entry, campaign, notification, email and setting is kept in the browser's `localStorage` (key `coin-cost-innovation-hub-v7`).
- **Port 8742.** Uses `--strictPort`, so it won't quietly move to 5173 or another common port.

## Run

```bash
npm install
npm run dev        # http://localhost:8742
npm test           # workflow rules + demo seed (Vitest)
```

To serve a production build: `npm run build`, then `npm run preview` (also on port 8742).

## Demo logins

Every persona uses the password **`coin@2026`**. The login page's quick demo tiles (Sourcing Head, Admin) both sign in as the Sourcing Head, who can act on every stage.

| Role | User | Email |
|---|---|---|
| Sourcing Head | Girish Saluja | girish.saluja@ambergroupindia.com |
| Commodity Lead (Metals) | Sanjay Kapoor | sanjay.kapoor@ambergroupindia.com |
| Commodity Buyer (Fasteners & Steel) | Arjun Mehta | arjun.mehta@ambergroupindia.com |
| Technical Evaluator (R&D) | Dr. Priya Nair | dr.priya.nair@ambergroupindia.com |
| Finance Controller | Meera Iyer | meera.iyer@ambergroupindia.com |
| Management | Rajesh Khanna | rajesh.khanna@ambergroupindia.com |
| Submitter (R&D) | Neha Verma | neha.verma@ambergroupindia.com |
| Supplier (Sunrise Fasteners) | Rakesh Gupta | rakesh.gupta@sunrisefasteners.in |
| Admin | Nikhil Agarwal | nikhil.agarwal@ambergroupindia.com |

You can also sign in with the employee ID (for example `AEL-03108`). To restore the original seed data, use **User menu → Reset demo data**.

## Six-stage workflow (every idea)

| # | Stage | Workspace | What happens |
|---|---|---|---|
| 1 | Idea submitted | IN | Submission form (steps A–E) |
| 2 | Team feasibility check | IN | Feasibility team: technically feasible? cost valid? duplicate / conflict? Go / No-go |
| 3 | *Dept* evaluation (submitter's department, e.g. R&D evaluation) | IN | Detailed cost-benefit, risk assessment, supplier capability check (email + public form, no Amber data; skipped below ₹ 5 L) |
| 4 | Sourcing approval | IN | Commercial assessment, supplier alignment, signed budget + timeline lock (target = annualised × months ÷ 12) |
| 5 | Execution started | CO | Execution Hub: NPD / PAP milestones, CO date, first MRN at the new price, plan vs actual from MRN |
| 6 | Verification | CO | Business side checks MRN at the approved price, Finance validation and the locked target → Verified |

A dropped or rejected idea stays dropped — a fresh attempt is a new idea. The Home page shows a **six-stage walkthrough**: one demo idea at each stage with every form filled in up to that stage.

## Workspaces and modules

After sign-in the Home page shows the COIN coin mark, KPI tiles and the two workspaces:

- **CO · Cost Optimisation** — **LENS** (Linked Evidence of Negotiation and Savings → dashboard), **PROOF** (Part-linked Realisation and Optimisation Output Framework → `/proof`), **TRACE** (Transition-linked Realisation of Actual CI Evidence → Execution Hub).
- **IN · Innovation Network** — "Enter the world of ideas": ideas, campaigns, feasibility, evaluation and sourcing approval.

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
