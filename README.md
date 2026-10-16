# COIN — Cost Optimisation & Innovation Network

**In-app name: Cost Innovation Hub.** Built for Amber Enterprises India Ltd. from *COIN — Scope of Work v1.0 (Oct 1, 2026)*.

COIN runs in two modes from the same code:

| Mode | Where the data lives | Who checks the role ladder | Used for |
|---|---|---|---|
| **api** (`VITE_DATA_MODE=api`) | PostgreSQL, through the COIN API server | the server, on every action | real development, AWS later |
| **local** (no setting) | the browser's `localStorage` | the browser | the Vercel demo |

The workflow rules are written once (`src/domain/engine.ts`) and run in both places. Port 8742 (web) uses `--strictPort`.

## Run — full product (API + PostgreSQL)

Needs Node 20+ and PostgreSQL 16–18 installed (the binaries only; no admin password needed).

```bash
npm install
cp .env.example .env     # then set a database password in DATABASE_URL / TEST_DATABASE_URL
npm run db:init          # creates a COIN-only PostgreSQL in .pgdata (port 5433) with databases coin + coin_test
npm run db:seed          # schema + demo data (55 accounts, password = SEED_PASSWORD)
npm run dev:api          # API on http://localhost:8787
npm run dev              # web app on http://localhost:8742 (forwards /api to the API)
```

`npm run dev:all` starts the database, the API and the web app in one terminal. After a reboot run `npm run db:start`.

| Command | What it does |
|---|---|
| `npm run db:start` / `db:stop` / `db:status` / `db:psql` | the local PostgreSQL cluster |
| `npm run db:migrate` | apply new files in `db/migrations` |
| `npm run db:seed` | re-create the organisation with the demo data (wipes it) |
| `npm run db:reset` | drop every table, migrate and seed |
| `npm test` | workflow rules, permissions, visibility, and the API against `coin_test` |
| `npm run qa`, then `npm run qa:report` | Chrome drives every role through the real screens → `qa-output/COIN_QA_Workbook.xlsx` and `COIN_User_Story.pdf` |
| `npm run build` + `npm run build:api` + `npm start` | production: one Node process serves the API and the web app (`SERVE_STATIC=true`) |

### How the server works

- **Sign-in**: email or employee ID + password (scrypt hashes, never sent back). The session is an httpOnly cookie; it
  ends after `SESSION_HOURS` or the organisation's idle timeout, and when Admin deactivates the person or sets a new
  password. Only failed sign-ins are rate-limited. One-click demo accounts exist only while `DEMO_LOGIN=true`.
- **Reading**: `GET /api/bootstrap` sends exactly what the person may see — their department's ideas, their own
  notifications, a scrubbed user directory; a supplier gets only its own vendor record, parts and submissions.
  The app polls `GET /api/version` every 5 s and reloads when someone else changed something.
- **Changing**: every action is `POST /api/commands/<name>`. The server checks the policy (`src/domain/policies.ts`,
  the department ladder), runs the shared engine on the organisation's data under a database lock (no two people
  overwrite each other), writes only what changed, and audits it in `command_log` with the rows as they were.
  Refused actions return 403 / 409 with the reason; a repeated command id is not run twice.
- **Undo**: the 5-second undo asks the server to put back the rows of the person's own action, unless someone changed
  them since.
- **Emails** are written to the `emails` table (the outbox, shown in the app). `EMAIL_DRIVER=smtp` + `SMTP_URL` also
  sends them (AWS SES SMTP works).
- **Supplier capability form**: the emailed link opens `/supplier-form/<token>` with no login; the public endpoints
  show only what the email asked and accept one answer.
- **Files**: attachments are stored in the `files` table and served only to people who can see the idea.

### Configuration (`.env`)

See `.env.example`. Never commit `.env`. For anything beyond local development set `DEMO_LOGIN=false`, give every
account its own password, `COOKIE_SECURE=true` behind HTTPS, and a real `APP_URL`.

### AWS later

`Dockerfile` builds one image (API + web app); point `DATABASE_URL` at RDS PostgreSQL and run it on ECS / App Runner
behind HTTPS. `docker-compose.yml` runs the same thing locally with a PostgreSQL container.

## Run — browser-only demo (what Vercel serves)

Set `VITE_DATA_MODE=local` (or remove it from `.env`) and run `npm run dev`. Every idea, approval, ledger entry,
campaign, notification, email and setting is then kept in the browser's `localStorage` (key
`coin-cost-innovation-hub-v8`). Vercel builds without a `.env`, so the live demo stays in this mode.

## Demo logins

Every seeded account uses the password **`coin@2026`** (`SEED_PASSWORD` in api mode). On the login page pick a **department**, then one of its five roles; the
cross-functional row has the Finance verifier, Sourcing Head, Admin, Management and a Supplier. The user menu's
**Switch demo persona** uses the same picker. You can also sign in with the email or employee ID (for example `AEL-03108`).

| Department | Employee | Team lead | Department lead | Department head | Execution owner |
|---|---|---|---|---|---|
| R&D | Neha Verma | Arvind Rao | Dr. Priya Nair | Dr. Sameer Kulkarni | Rahul Jain |
| DQA | Tanvi Gupta | Pooja Nambiar | Amit Saxena | Rajiv Bhalla | Sandeep Rawat |
| Quality | Farah Khan | Mohit Arora | Ritu Malhotra | Anil Deshmukh | Kavya Reddy |
| Process | Harish Menon | Nitin Chawla | Karan Bhatia | Manoj Pillai | Siddharth Bose |
| Production | Vivek Chauhan | Gurmeet Singh | Deepika Sharma | Suresh Yadav | Ravi Teja |
| Finance | Ankita Jain | Prakash Iyer | Shalini Gupta | Vinod Agarwal | Rohit Kapoor |
| Sourcing | Aditi Sharma | commodity leads (Sanjay Kapoor, Anita Sharma, Deepak Joshi) | Ashok Menon | Girish Saluja | commodity buyers |
| HR | Simran Kaur | Varun Malhotra | Neelam Saxena | Lata Krishnan | Imtiaz Ali |

Cross-functional: **Meera Iyer** (Finance verifier — stage 6), **Girish Saluja** (Sourcing Head — can act at every stage),
**Nikhil Agarwal** (Admin — can act at every stage), **Rajesh Khanna** (Management), **Rakesh Gupta** (Supplier).
Emails follow `first.last@ambergroupindia.com`. To restore the original seed data, use **User menu → Reset demo data**.

## Six-stage workflow (every idea)

The department is the submitter's department (supplier ideas go to Sourcing). Each stage is done by one role of that
department; a team lead never clears their own idea (the department lead does).

| # | Stage | Workspace | Who | What happens |
|---|---|---|---|---|
| 1 | Idea submitted | IN | Employee | Submission form (steps A–E) |
| 2 | Team feasibility check | IN | Team lead | Technically feasible? cost valid? duplicate / conflict? Go / No-go |
| 3 | *Dept* evaluation (e.g. R&D evaluation) | IN | Department lead | Cost-benefit, risk assessment, supplier capability check (email + public form, no Amber data; skipped below ₹ 5 L) |
| 4 | *Dept* approval (e.g. R&D approval) | IN | Department head | Commercial assessment, supplier alignment, signed budget + timeline lock (target = annualised × months ÷ 12) |
| 5 | Execution started | CO | Execution owner | Execution Hub: NPD / PAP milestones, CO date, first MRN at the new price, plan vs actual from MRN |
| 6 | Verification | CO | Finance verifier | MRN at the approved price, Finance validation and the locked target → Verified |

**My queue** (`/queue`) lists the ideas waiting for the signed-in person, with how long each has waited and its SLA
state; every dashboard opens with the top of that queue. Sourcing Head and Admin also get an **All pending** tab.

A dropped or rejected idea stays dropped — a fresh attempt is a new idea. The Home page shows a **six-stage walkthrough**: one demo idea at each stage with every form filled in up to that stage.

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

- **CO · Cost Optimisation** — **LENS** (Linked Evidence of Negotiation and Savings → dashboard), **PROOF** (Part-linked Realisation and Optimisation Output Framework → `/proof`), **TRACE** (Transition-linked Realisation of Actual CI Evidence → Execution Hub).
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
