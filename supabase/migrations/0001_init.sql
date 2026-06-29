-- ============================================================================
-- FeeFlow — 0001_init.sql
-- Full schema. Idempotent (safe to re-run). Money is integer Kobo (₦1 = 100).
-- Mirrors doc/Database_Schema.md. Apply in Supabase SQL Editor or `supabase db push`.
-- ============================================================================

create extension if not exists pgcrypto;

-- Generic updated_at trigger ------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. organizations ----------------------------------------------------------
create table if not exists organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique not null,
  logo_url              text,
  nomba_account_id      text not null unique,
  nomba_sub_account_id  text not null,
  nomba_webhook_secret  text,
  institution_type      text,
  country_code          text default 'NG',
  currency_code         text default 'NGN',
  admin_email           text not null,
  contact_email         text,
  contact_phone         text,
  status                text default 'ACTIVE',
  is_verified           boolean default false,
  settings              jsonb default '{}',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
create index if not exists idx_organizations_status on organizations(status);
create index if not exists idx_organizations_slug on organizations(slug);

-- 2. students ---------------------------------------------------------------
create table if not exists students (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  email             text not null,
  matric_number     text not null,
  first_name        text,
  last_name         text,
  middle_name       text,
  department        text,
  faculty           text,
  enrollment_year   int,
  level             int,
  phone_number      text,
  alternative_email text,
  status            text default 'ACTIVE',
  date_enrolled     date,
  date_deferred     date,
  date_graduated    date,
  credit_balance    int default 0,          -- Kobo
  metadata          jsonb default '{}',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (org_id, matric_number),
  unique (org_id, email)
);
create index if not exists idx_students_org_id on students(org_id);
create index if not exists idx_students_status on students(status);
create index if not exists idx_students_matric on students(matric_number);
create index if not exists idx_students_email on students(email);

-- 3. virtual_accounts -------------------------------------------------------
create table if not exists virtual_accounts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  student_id       uuid not null references students(id) on delete cascade,
  account_number   text not null unique,
  account_name     text,
  bank_name        text default 'Nomba',
  nomba_account_id text,
  status           text default 'ACTIVE',
  is_primary       boolean default true,
  metadata         jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  archived_at      timestamptz,
  unique (student_id, is_primary)
);
create index if not exists idx_virtual_accounts_org_id on virtual_accounts(org_id);
create index if not exists idx_virtual_accounts_student_id on virtual_accounts(student_id);
create index if not exists idx_virtual_accounts_account_number on virtual_accounts(account_number);

-- 4. fee_types --------------------------------------------------------------
create table if not exists fee_types (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  name                  text not null,
  slug                  text,
  description           text,
  amount_naira          int not null,        -- Kobo
  is_clearance_required boolean default false,
  fiscal_year           text,
  version               int default 1,
  status                text default 'ACTIVE',
  created_by_email      text,
  created_by_role       text,
  created_at            timestamptz default now(),
  effective_from        date,
  effective_to          date,
  unique (org_id, name, version)
);
create index if not exists idx_fee_types_org_id on fee_types(org_id);
create index if not exists idx_fee_types_status on fee_types(status);

-- 5. student_fees -----------------------------------------------------------
-- NOTE: doc spec'd `is_overdue` as a GENERATED column using NOW(); Postgres
-- rejects that (NOW() is not immutable). It's a plain column here, refreshed by
-- mark_overdue_fees() (see 0002) — run via node-cron.
create table if not exists student_fees (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  fee_type_id    uuid not null references fee_types(id),
  amount_due     int not null,               -- Kobo
  amount_paid    int default 0,              -- Kobo
  amount_balance int generated always as (amount_due - amount_paid) stored,
  status         text default 'UNPAID',
  due_date       date,
  is_overdue     boolean default false,
  is_disputed    boolean default false,
  disputed_at    timestamptz,
  dispute_reason text,
  notes          text,
  created_at     timestamptz default now(),
  paid_at        timestamptz,
  unique (student_id, fee_type_id),
  check (amount_paid >= 0 and amount_paid <= amount_due)
);
create index if not exists idx_student_fees_org_id on student_fees(org_id);
create index if not exists idx_student_fees_student_id on student_fees(student_id);
create index if not exists idx_student_fees_status on student_fees(status);
create index if not exists idx_student_fees_is_disputed on student_fees(is_disputed);

-- 6. payments ---------------------------------------------------------------
create table if not exists payments (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organizations(id) on delete cascade,
  student_id                  uuid not null references students(id),
  virtual_account_id          uuid not null references virtual_accounts(id),
  amount_naira                int not null,  -- Kobo
  nomba_transaction_id        text not null unique,
  nomba_reference             text,
  sender_name                 text,
  sender_account              text,
  status                      text default 'SUCCESS',
  reconciliation_status       text default 'UNRECONCILED',
  webhook_received_at         timestamptz,
  reconciliation_completed_at timestamptz,
  is_disputed                 boolean default false,
  dispute_reason              text,
  created_at                  timestamptz default now()
);
create index if not exists idx_payments_org_id on payments(org_id);
create index if not exists idx_payments_student_id on payments(student_id);
create index if not exists idx_payments_nomba_transaction_id on payments(nomba_transaction_id);
create index if not exists idx_payments_reconciliation_status on payments(reconciliation_status);
create index if not exists idx_payments_created_at on payments(created_at);

-- 7. payment_allocations ----------------------------------------------------
create table if not exists payment_allocations (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references payments(id) on delete cascade,
  student_fee_id   uuid not null references student_fees(id),
  allocated_amount int not null,             -- Kobo
  created_at       timestamptz default now()
);
create index if not exists idx_payment_allocations_payment_id on payment_allocations(payment_id);
create index if not exists idx_payment_allocations_student_fee_id on payment_allocations(student_fee_id);

-- 8. clearance_status -------------------------------------------------------
create table if not exists clearance_status (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  student_id          uuid not null references students(id) on delete cascade,
  is_cleared          boolean default false,
  last_calculated_at  timestamptz default now(),
  cleared_at          timestamptz,
  calculation_details jsonb,
  unique (student_id)
);
create index if not exists idx_clearance_status_org_id on clearance_status(org_id);
create index if not exists idx_clearance_status_is_cleared on clearance_status(is_cleared);

-- 9. refund_requests --------------------------------------------------------
create table if not exists refund_requests (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  student_id          uuid not null references students(id),
  payment_id          uuid references payments(id),
  amount_requested    int not null,          -- Kobo
  amount_approved     int,
  amount_processed    int,
  status              text default 'REQUESTED',
  reason              text not null,
  requested_at        timestamptz default now(),
  approved_at         timestamptz,
  approved_by_email   text,
  processed_at        timestamptz,
  nomba_refund_txn_id text,
  notes               text
);
create index if not exists idx_refund_requests_org_id on refund_requests(org_id);
create index if not exists idx_refund_requests_status on refund_requests(status);
create index if not exists idx_refund_requests_student_id on refund_requests(student_id);

-- 10. audit_logs ------------------------------------------------------------
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  old_value   jsonb,
  new_value   jsonb,
  actor_email text,
  actor_role  text,
  request_id  text,
  ip_address  text,
  created_at  timestamptz default now()
);
create index if not exists idx_audit_logs_org_id on audit_logs(org_id);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_actor on audit_logs(actor_email);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

-- updated_at triggers -------------------------------------------------------
drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_virtual_accounts_updated_at on virtual_accounts;
create trigger trg_virtual_accounts_updated_at before update on virtual_accounts
  for each row execute function set_updated_at();
