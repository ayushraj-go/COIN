-- COIN schema v1. Every business table carries org_id (one organisation — Amber — today; more later).
-- Each record keeps its full document in `data` (the same shape the app uses) plus typed columns for lookups,
-- indexes and integrity. `updated_by_command` ties a row to the command that last wrote it (audit + undo).

create table organisations (
  id          text primary key,
  name        text not null,
  slug        text not null unique,
  version     bigint not null default 0,          -- bumped by every command; clients poll it
  created_at  timestamptz not null default now()
);

create table org_settings (
  org_id                  text primary key references organisations(id) on delete cascade,
  settings                jsonb not null,
  buyer_targets           jsonb not null default '{}',
  plant_targets           jsonb not null default '{}',
  departments             jsonb not null default '[]',
  drop_reasons            jsonb not null default '[]',
  fy_closed               jsonb not null default '{}',
  supplier_portal_sync_at timestamptz,
  updated_at              timestamptz not null default now(),
  updated_by_command      text
);

create table users (
  org_id             text not null references organisations(id) on delete cascade,
  id                 text not null,
  email              text not null,
  employee_id        text not null,
  name               text not null,
  password_hash      text,
  roles              text[] not null,
  department         text not null,
  supplier_code      text,
  active             boolean not null default true,
  data               jsonb not null,
  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by_command text,
  primary key (org_id, id)
);
create unique index users_email_uq on users (org_id, lower(email));
create unique index users_employee_uq on users (org_id, lower(employee_id));

-- master data: one table per kind, keyed by the app's own key (code / id / stage)
create table levers           (org_id text not null references organisations(id) on delete cascade, id text not null, data jsonb not null, sort int not null default 0, updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id));
create table categories       (like levers including all);
create table commodities      (like levers including all);
create table plants           (like levers including all);
create table suppliers        (like levers including all);
create table parts            (like levers including all);
create table sla_rules        (like levers including all);
create table approval_rules   (like levers including all);
create table email_templates  (like levers including all);
create table supplier_templates (like levers including all);
alter table categories add foreign key (org_id) references organisations(id) on delete cascade;
alter table commodities add foreign key (org_id) references organisations(id) on delete cascade;
alter table plants add foreign key (org_id) references organisations(id) on delete cascade;
alter table suppliers add foreign key (org_id) references organisations(id) on delete cascade;
alter table parts add foreign key (org_id) references organisations(id) on delete cascade;
alter table sla_rules add foreign key (org_id) references organisations(id) on delete cascade;
alter table approval_rules add foreign key (org_id) references organisations(id) on delete cascade;
alter table email_templates add foreign key (org_id) references organisations(id) on delete cascade;
alter table supplier_templates add foreign key (org_id) references organisations(id) on delete cascade;

create table ideas (
  org_id             text not null references organisations(id) on delete cascade,
  id                 text not null,
  fy                 text,
  seq                int not null default 0,
  title              text not null default '',
  stage              text not null,
  bucket             text not null,
  route              text,
  department         text,
  commodity          text,
  submitter_id       text,
  owner_id           text,
  buyer_id           text,
  supplier_code      text,
  campaign_id        text,
  submitted_at       timestamptz,
  data               jsonb not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by_command text,
  primary key (org_id, id)
);
-- a submitted idea's number COIN-<FY>-<commodity>-<seq> is unique
create unique index ideas_number_uq on ideas (org_id, fy, commodity, seq) where seq > 0;
create index ideas_stage_ix on ideas (org_id, stage);
create index ideas_bucket_ix on ideas (org_id, bucket);
create index ideas_submitter_ix on ideas (org_id, submitter_id);
create index ideas_department_ix on ideas (org_id, department);
create index ideas_owner_ix on ideas (org_id, owner_id);

create table ledger_entries (
  org_id             text not null references organisations(id) on delete cascade,
  id                 text not null,
  idea_id            text not null,
  month              text not null,
  finance_status     text not null,
  data               jsonb not null,
  updated_at         timestamptz not null default now(),
  updated_by_command text,
  primary key (org_id, id)
);
create index ledger_idea_ix on ledger_entries (org_id, idea_id);
create index ledger_month_ix on ledger_entries (org_id, month);

create table campaigns (
  org_id text not null references organisations(id) on delete cascade, id text not null, status text not null,
  data jsonb not null, updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);

create table notifications (
  org_id text not null references organisations(id) on delete cascade, id text not null, user_id text not null,
  read boolean not null default false, at timestamptz not null, data jsonb not null,
  updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);
create index notifications_user_ix on notifications (org_id, user_id, at desc);

-- the outbox: every email the system sends; status moves logged → sent / failed when a delivery driver is on
create table emails (
  org_id text not null references organisations(id) on delete cascade, id text not null, at timestamptz not null,
  to_addrs text[] not null, subject text not null, template text, status text not null default 'logged',
  sent_at timestamptz, error text, data jsonb not null,
  updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);
create index emails_at_ix on emails (org_id, at desc);

create table saved_views (
  org_id text not null references organisations(id) on delete cascade, id text not null, user_id text not null,
  data jsonb not null, updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);
create table email_prefs (
  org_id text not null references organisations(id) on delete cascade, id text not null,  -- id = user id
  data jsonb not null, updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);
create table outreach_batches (
  org_id text not null references organisations(id) on delete cascade, id text not null,
  data jsonb not null, updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);
create table supplier_responses (
  org_id text not null references organisations(id) on delete cascade, id text not null, status text not null,
  data jsonb not null, updated_at timestamptz not null default now(), updated_by_command text, primary key (org_id, id)
);

-- attachment bytes (ideas keep name / size / type and a /api/files/<id> link)
create table files (
  org_id     text not null references organisations(id) on delete cascade,
  id         text not null,
  idea_id    text,
  name       text not null,
  type       text not null,
  size       int not null,
  bytes      bytea not null,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table sessions (
  id_hash      text primary key,          -- sha256 of the cookie value; the raw id is never stored
  org_id       text not null references organisations(id) on delete cascade,
  user_id      text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip           text,
  user_agent   text
);
create index sessions_user_ix on sessions (org_id, user_id);

-- audit trail of every command, with the rows as they were before it (for undo)
create table command_log (
  id              text primary key,
  org_id          text not null references organisations(id) on delete cascade,
  actor_id        text not null,
  command         text not null,
  args            jsonb,
  ok              boolean not null,
  error           text,
  before_rows     jsonb,                  -- [{ table, id, data|null }]
  version         bigint,
  at              timestamptz not null default now(),
  undone_at       timestamptz,
  undone_by       text
);
create index command_log_org_ix on command_log (org_id, at desc);
