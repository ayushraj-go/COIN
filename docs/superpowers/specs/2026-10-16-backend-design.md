# COIN backend — design and plan

Branch `feat/backend` (from `main` at be45832). Written 2026-10-16.

## Intent

COIN has been a front-end demo: every browser keeps its own copy of the data in localStorage, so an idea submitted on one
laptop never reaches the team lead on another, and the role ladder is enforced only by the screens. Ayush wants to start
real product development — Amber first, launch on AWS later — while the Vercel demo keeps working. Success is: a local
PostgreSQL database and an API server that own all data, every role sees and does exactly what the ladder allows (checked
on the server, not the browser), nothing important is hard-coded, and the whole journey is proven role by role with an
Excel QA workbook and a PDF user story full of screenshots.

## Goals

- Real database (PostgreSQL 18 on the laptop now; RDS on AWS later) with a schema, migrations and a seed.
- `.env` configuration for the server and the client; `.env.example` committed, `.env` never committed.
- API server that owns all writes, runs the existing (tested) workflow rules, authorises every command against the
  department ladder and returns only what the caller may see.
- Real sign-in: email / employee id + password (scrypt hashes), server sessions in httpOnly cookies, session timeout
  enforced on the server; one-click demo sign-in only when `DEMO_LOGIN=true`.
- Emails go to an outbox table (shown in the app); a real SMTP / AWS SES driver can be switched on by env later.
- The public supplier capability form works without login through token endpoints.
- Remove hard-coded user ids, dates and URLs from the product code.
- Prove it: API integration tests against a real test database, browser journeys for every role, a QA workbook
  (Excel, one sheet per role, screenshots, pass/fail, emails, supplier requests, issues) and a PDF user story.

## Non-goals

- New screens or a redesign — the front end is accepted as it is.
- Multi-company sign-up flow. (Every table carries `org_id`; only Amber exists.)
- Deploying to AWS now (a Dockerfile and docker-compose are provided for later).

## Anti-goals

- Breaking the Vercel demo: with no API configured the app must run exactly as today (local mode).
- A second copy of the workflow rules on the server that can drift from the client.
- Any role receiving ideas, emails or supplier contacts it may not see, even in the API payload.
- Passwords stored or sent back in plain text.

## Architecture

```
src/domain/        shared rules: engine (all workflow actions), permissions, visibility, command policies
src/store/         zustand store = UI state + engine (local mode) or API calls (api mode)
server/src/        Fastify API: auth, bootstrap, commands, undo, public supplier form, files, health
db/migrations/     plain SQL migrations, applied in order, recorded in schema_migrations
scripts/db.mjs     local PostgreSQL cluster (init / start / stop / status / reset) in .pgdata, port 5433
e2e/               browser journeys (puppeteer), QA workbook (exceljs) and PDF user story generators
```

### Data mode

`VITE_DATA_MODE=local` (default, Vercel) keeps zustand + localStorage. `VITE_DATA_MODE=api` uses the server: login,
bootstrap, commands. Vite proxies `/api` to the server in development.

### The engine (one copy of the rules)

The action bodies move from `useStore.ts` into `src/domain/engine.ts` as `domainActions(set, get, hooks)`. The client
store spreads them in local mode. The server creates a vanilla zustand store per command from the database snapshot,
sets `userId` to the signed-in user and runs the same action. `hooks` replace browser-only side effects: `warn(msg)`
(client toast / server 409), `celebrate()` and `appUrl` (supplier form link).

### Command flow (server)

`POST /api/commands/:name { args, commandId }`
1. Session → actor; zod-check the args shape.
2. Transaction + `pg_advisory_xact_lock(org)`; read `organisations.version`.
3. Snapshot of the org from the in-memory cache when its version matches, else loaded from the tables.
4. Policy check (`src/domain/policies.ts`) — uses `ideaPerms`, `kanbanMove`, `execRights`, role lists.
5. Run the engine action; a `warn` aborts with 409 and the message.
6. Diff every collection (by id + object identity), write upserts/deletes, store before-images in `command_log`,
   bump the org version, commit, refresh the cache.
7. Respond `{ result, version, changes }` with `changes` filtered by what the actor may see.

Clients poll `GET /api/version` every 5 s and re-fetch `GET /api/bootstrap` when another user changed something.

### Undo

Screens offer a 5-second undo. In api mode `beginUndo()` marks the client's command count; undo posts the command ids
issued since to `POST /api/undo`. The server restores the before-images only for the same user, within 10 minutes, and
only if no later command touched those rows.

### Visibility (bootstrap and deltas)

- ideas: `canSeeIdea`; ledger: rows of visible ideas; notifications: own; email prefs and saved views: own (+ shared).
- emails: internal roles except plain employees see the org log; employees and suppliers only mail addressed to them.
- users: everyone without password hashes; suppliers get id, name, roles, department, designation only.
- suppliers master: suppliers see only their own record; parts: suppliers only their commodities.
- campaigns: suppliers only those they are invited to; outreach / supplier responses / templates: Sourcing roles.

### Database (all tables carry `org_id`)

`organisations` (id, name, version) · `org_settings` (settings, targets, departments, drop reasons, fy closure, portal
sync) · `users` (typed columns + `password_hash`) · master tables `levers, categories, commodities, plants, suppliers,
parts, sla_rules, approval_rules, email_templates, supplier_templates` (key + `data jsonb`) · `ideas` (typed columns for
stage, bucket, department, commodity, submitter, owner, fy/seq + `data jsonb`) · `ledger_entries` · `campaigns` ·
`notifications` · `emails` (outbox with delivery status) · `saved_views` · `email_prefs` · `outreach_batches` ·
`supplier_responses` · `files` (attachment bytes; ideas keep metadata + `/api/files/:id`) · `sessions` · `command_log`
(audit + undo before-images) · `schema_migrations`.

### Security

scrypt password hashes; session id = 32 random bytes, stored hashed; httpOnly + SameSite=Lax cookie; server-side idle
timeout from `settings.sessionTimeoutMin`; login rate limit; CORS limited to `APP_URL`; body limit 15 MB; every command
authorised; public supplier endpoints expose only what the email showed (item, spec, required-by), never prices.

## Hard-coding to remove

`u-buyer1` draft default · `u-fin`, `u-mgmt`, `u-head` notification recipients · `u-head` lookup on Submit Idea ·
supplier portal URL · `window.location.origin` in the engine · default filter FY `FY27` · `CMP-<count>` and outreach ids
that collide after deletes · ErrorBoundary resetting demo data · client-only session timeout · plain-text passwords.

## Calls I made (Ayush can overrule)

Amber only (org_id everywhere) · Fastify + node-postgres + zod, TypeScript run with tsx · project-local Postgres cluster
on 5433 instead of the Windows service (no admin password needed) · demo password stays `coin@2026` for the 40 seeded
accounts (local only) · email outbox instead of real sending · full-org snapshot per command, cached by version (fine
for thousands of ideas; split per idea later if needed).

## Tasks

1. Local database: `scripts/db.mjs`, `.env` / `.env.example`, migrations, migrator, seed (hashing passwords).
2. Engine extraction into `src/domain/engine.ts`; hard-coded ids → role lookups; all existing tests green.
3. Domain permissions / visibility / command policies (pure, tested).
4. API server: config, db pool, sessions + auth, bootstrap, commands + diff/persist, version, undo, public supplier
   form, files, health; integration tests on `coin_test`.
5. Client api mode: api client, login + demo accounts, bootstrap, async commands, polling, undo, supplier form,
   attachments, error boundary.
6. Run the app end to end against the server; fix what breaks.
7. Browser journeys for every role + screenshots; API permission matrix.
8. QA workbook (Excel) and PDF user story.
9. README (backend section), Dockerfile + docker-compose, final review.

## Ledger

(appended as tasks complete)
- Task 1 done (c13bf74): local cluster `.pgdata` on 5433, `db/migrations/001_init.sql`, `.env` / `.env.example`.
- Task 2 done (c13bf74): engine extracted; hard-coded ids → role lookups; direct store writes → actions; async value actions.
- Task 3 done (86c4f6c, b86d102): permissions / policies / visibility in `src/domain`; fixed the supplier visibility leak.
- Task 4 done (e3529e1): API server + 17 integration tests (mutation check: disabling the policy fails 7 of them).
- Task 5 done (56fcb4e): web app api mode; smoke-tested password sign-in in Chrome.
- Tasks 6–7 (065cdcc …): browser QA found and fixed — login limiter counted successes; Admin had no password field and a
  hard-coded `coin@2026`; malformed Admin change → 500; Submit Idea predicted the COIN number client-side.
- Ruling: undo restores every data set in local mode (single user) and before-images on the server — cost if wrong:
  local-mode undo within 5 s could also revert another change by the same person.
- Ruling: suppliers see only their own parts (other vendors' prices are confidential), not every part of their
  commodities — cost if wrong: a supplier must type part codes it does not supply.
- Ruling: a full-org snapshot per command, cached by version — cost if wrong: slow commands beyond ~10k ideas.
