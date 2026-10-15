# COIN — six-stage workflow, CO execution & verification, new home and dashboards

Date: 2026-10-15 · Status: approved by Ayush Raj in chat (design message of 15 Oct) · Front-end only (localStorage, no backend)

## Goal

Every idea is traced from submission to verified savings through one six-stage flow. The Sourcing Head can
demo every form end-to-end from one login. Dashboards answer "where do ideas come from" (internal vs external)
and "are we hitting the locked target" (plan vs actual from MRN).

## 1. Workflow

| # | Stage | Workspace | Who acts |
|---|---|---|---|
| 1 | Idea submitted | IN | Submitter — submission form unchanged |
| 2 | Team feasibility check | IN | Feasibility team (role per department) |
| 3 | **{Submitter's department} evaluation** (e.g. "R&D evaluation", "Quality evaluation") | IN | Evaluator of that department |
| 4 | Sourcing approval | IN | Commodity Lead / Sourcing Head (approval matrix) |
| 5 | Execution started | CO | Owner, in the Execution Hub |
| 6 | Verification | CO | Business side (Sourcing Head / Finance) confirms target achieved |

- Canonical stored stage names: `Team feasibility check`, `Evaluation`, `Sourcing approval`, `Execution started`, `Verification`.
  The evaluation label shown everywhere is `<dept> evaluation`, from the submitter's department:
  R&D, DQA, Quality, Process, Production, Finance keep their own name; Sourcing, Sourcing Excellence, Supplier,
  Management map to **Sourcing**.
- "Implemented" stays the bucket / KPI name; the last stage reads **Verification**. An idea reaches the
  Verification stage when execution is handed over; it ends **Verified** (`verification.verifiedAt`).
- Dropped / rejected ideas stay dropped forever; a fresh attempt is a new idea.
- The Sourcing Head can act on every stage. Quick demo login offers Sourcing Head and Admin, both open the Sourcing Head.

## 2. Stage forms

### Stage 2 — Team feasibility check
New role `feasibility` ("Feasibility team") per department (Sourcing buyers/leads, R&D, Quality, DQA, Process, Production members).
One check per idea, recorded with reviewer, department and date:
1. **Technically feasible** — Yes / No + note.
2. **Cost valid** — Valid / Not valid; shows entered baseline & new price vs LBP / PO; flags new price ≥ baseline or saving > 40 %.
3. **Duplicate / conflict** — None / Duplicate of an idea / Conflicts with an idea or project; similar ideas suggested automatically.
4. **Decision** — Go / No-go. No-go drops the idea ("Not feasible").
Plus "Departments consulted" chips. Go → stage 3.

### Stage 3 — Evaluation
1. **Detailed cost-benefit analysis** — per-part baseline / new / saving per unit / % / volume / annualised; one-time investment;
   net saving; payback; committed this FY vs carry-over; quarter phasing; evaluator ticks "CBA verified".
2. **Risk assessment** — Quality, Supply continuity, Customer / OEM approval, Tooling & lead time, Price volatility; each
   Low / Medium / High + ₹ cost at risk; overall rating = highest; total ₹ at risk.
3. **Supplier capability check** — own page `/ideas/:id/supplier-check`:
   pick supplier, pre-built template (editable), send → email in outbox with a link to a public form `/supplier-form/:token` (no login).
   The email carries **no Amber data** (no prices, volumes, current supplier, savings): generic item description, specification
   summary, required-by date only. Supplier answers: can supply (Yes / Partly / No), meets specification, monthly capacity,
   lead time, optional indicative price, certifications, remarks, contact. Response shows on the idea.
4. **Minimum saving threshold ₹ 5 lakh** — below it the supplier check is skipped and marked
   "Skipped — below minimum saving threshold".
Decision: Recommend → stage 4 · Reject → dropped · Send back → stage 2.

### Stage 4 — Sourcing approval
1. **Commercial assessment** — summary of CBA + risk, marked complete.
2. **Supplier alignment & confirmation** — supplier form result (or "skipped below threshold").
3. **Budget + timeline lock** — budget ₹, timeline months (default 6), start date, target saving for the period
   = annualised × months ÷ 12 (e.g. ₹ 12 L over 6 months); signed on a signature pad with name and date.
Approval matrix levels stay (Lead ≤ ₹ 50 L, + Sourcing Head above). Final approval moves the idea to CO.
Kanban / board: moving past Sourcing approval is blocked until the lock is signed.

### Stage 5 — Execution started (CO)
- Execution Hub lives in CO only.
- Shows NPD request / status, change-over (CO) date, MRN link ("ERP MRN feed — future link"; demo MRN ledger until then).
- Milestones: route-specific (NPD sample, PAP price…) then **First MRN at new price → Implementation confirmed → Handed for verification**.
  First MRN sets the effective date; MRN savings count from then.
- **Plan vs actual**: plan = locked target spread evenly over the timeline; actual = MRN savings by month;
  projection at current run-rate ("Month 1: ₹ 1.4 L vs ₹ 2 L planned · at this run-rate ₹ 8.4 L of ₹ 12 L").
- "Handed for verification" (Mark Done: effective date + approved price) moves the idea to stage 6.

### Stage 6 — Verification (CO)
Checklist: MRN at approved price (no leakage), Finance validated entries, realised vs locked target achieved.
Verify → Verified (by, date, remarks). Not achieved → back to Execution started with a reason.

## 3. Workspaces, home and dashboards

- IN = stages 1–4 (Idea Register, Submit, Campaigns, board up to Sourcing approval).
- CO = stages 5–6: Dashboard (**LENS**), **PROOF** page (part-wise plan vs actual from MRN), Execution Hub (**TRACE**),
  Verified ideas list.
- **Home after login** (page only, sidebar unchanged): greeting, COIN coin logo with ₹ in the centre, CO-style KPI tiles,
  Cost Optimisation card with LENS (Linked Evidence of Negotiation and Savings), PROOF (Part-linked Realisation and Optimisation
  Output Framework), TRACE (Transition-linked Realisation of Actual CI Evidence) — each opens its CO screen; Innovation Network
  card "Enter the world of ideas · Amber Cost Optimisation and Innovation Network".
- **IN dashboard**: CO-style KPI tiles (Pipeline · In execution · Implemented · Dropped); body = **Internal ideas** (by commodity,
  by department, by individual) and **External ideas** (supplier ideas Tier 1 / Tier 2, plus supplier ideas via campaigns KPI).
  Values = count + ₹ annualised.
- **CO dashboard (LENS)**: CO KPI tiles; same internal / external split with committed and MRN-realised ₹.
- **Advanced analytics**: IN gets Idea portfolio + SLA watch (plus existing cards); CO gets Implementation pipeline +
  Execution health (plus existing cards).
- Supplier master gets `tier: 'Tier 1' | 'Tier 2'`; seed has more supplier-submitted ideas.

## 4. Look
Navy blue, white and Amber red (Amber logo); gold accents removed. Status colours keep meaning (green done, orange in
progress, red late).

## 5. Demo data
- Storage key bumped (fresh seed). Portfolio of ~130 ideas re-seeded on the new stages with stage records.
- **Six showcase ideas**, one per stage, every form filled up to that stage:
  S1 just submitted (awaiting feasibility) · S2 feasibility done (awaiting evaluation) · S3 evaluation done incl. supplier form
  response (awaiting sourcing approval) · S4 approved with signed lock (execution early) · S5 first MRN + implementation
  confirmed, handed for verification · S6 verified.

## Out of scope
Real email sending, real ERP MRN feed, real authentication — all simulated in the browser.
