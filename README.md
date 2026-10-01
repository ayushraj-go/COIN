# COIN — Cost Optimisation & Innovation Network

**In-app name: Cost Innovation Hub.** This is a front-end-only demo for Amber Enterprises India Ltd., built from *COIN — Scope of Work v1.0 (Oct 1, 2026)*.

- **No backend.** Every idea, approval, ledger entry, campaign, notification, email and setting is kept in the browser's `localStorage` (key `coin-cost-innovation-hub-v4`).
- **Port 8742.** Uses `--strictPort`, so it won't quietly move to 5173 or another common port.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:8742
```

To serve a production build: `npm run build`, then `npm run preview` (also on port 8742).

## Demo logins

Every persona uses the password **`coin@2026`**. The login page also has one-click persona tiles, and the user menu has **Switch demo persona**.

| Role | User | Email |
|---|---|---|
| Sourcing Head | Vikram Singh | vikram.singh@ambergroupindia.com |
| Commodity Lead (Metals) | Sanjay Kapoor | sanjay.kapoor@ambergroupindia.com |
| Commodity Buyer (Fasteners & Steel) | Arjun Mehta | arjun.mehta@ambergroupindia.com |
| Technical Evaluator (R&D) | Dr. Priya Nair | dr.priya.nair@ambergroupindia.com |
| Finance Controller | Meera Iyer | meera.iyer@ambergroupindia.com |
| Management | Rajesh Khanna | rajesh.khanna@ambergroupindia.com |
| Submitter (R&D) | Neha Verma | neha.verma@ambergroupindia.com |
| Supplier (Sunrise Fasteners) | Rakesh Gupta | rakesh.gupta@sunrisefasteners.in |
| Admin | Nikhil Agarwal | nikhil.agarwal@ambergroupindia.com |

You can also sign in with the employee ID (for example `AEL-03108`). To restore the original seed data, use **User menu → Reset demo data**.

## Workspaces and modules

After sign-in everyone sees the four status cards (Pipeline, In Execution, Implemented, Dropped) and picks a workspace:

- **CO · Cost Optimisation** — execution after approval: NPD / PAP / internal implementation, due dates, realised savings, finance validation, leakage.
- **IN · Innovation Network** — the overall idea network: ideas, suppliers, campaigns, validation and approval.

| # | Module | Workspace | Route |
|---|---|---|---|
| M1 | Dashboard + Advanced analytics (role-based) | CO, IN | `/` |
| M2 | Idea Register / My Ideas | IN (Implemented ideas in CO) | `/ideas`, `/my-ideas` |
| M3 | Submit Idea (steps A–E, fixed summary) | IN | `/submit` |
| M4 | Idea 360 | both | `/ideas/:id`, plus a side panel |
| M6 | Supplier workspace | IN | `/feasibility`, `/workshops` |
| M7 | Campaigns — supplier email outreach via Supplier Portal | IN | `/campaigns` |
| M8 | Execution Hub | CO | `/execution` |
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
