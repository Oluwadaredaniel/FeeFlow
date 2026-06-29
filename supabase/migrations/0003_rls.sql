-- ============================================================================
-- FeeFlow — 0003_rls.sql
-- Row-Level Security. Multi-tenant isolation by org_id.
--
-- IMPORTANT: the BACKEND uses the Supabase SERVICE ROLE key, which BYPASSES RLS.
-- These policies protect the FRONTEND path (anon key + user JWT). For them to
-- work, org_id must be present as a JWT claim. Supabase puts custom claims under
-- app_metadata, so we read `auth.jwt() -> 'app_metadata' ->> 'org_id'` (with a
-- fallback to a top-level 'org_id' claim). Set this when you create the user.
-- ============================================================================

create or replace function current_org_id()
returns text
language sql stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'org_id',
    auth.jwt() ->> 'org_id'
  );
$$;

alter table organizations    enable row level security;
alter table students         enable row level security;
alter table virtual_accounts enable row level security;
alter table fee_types        enable row level security;
alter table student_fees     enable row level security;
alter table payments         enable row level security;
alter table payment_allocations enable row level security;
alter table clearance_status enable row level security;
alter table refund_requests  enable row level security;
alter table audit_logs       enable row level security;

-- organizations: a user sees only their own org row.
drop policy if exists org_isolation on organizations;
create policy org_isolation on organizations
  for select using (id::text = current_org_id());

-- Helper macro pattern: org-scoped read for tables that carry org_id directly.
do $$
declare t text;
begin
  foreach t in array array[
    'students','virtual_accounts','fee_types','student_fees',
    'payments','clearance_status','refund_requests','audit_logs'
  ]
  loop
    execute format('drop policy if exists %1$s_org_read on %1$s;', t);
    execute format(
      'create policy %1$s_org_read on %1$s for select using (org_id::text = current_org_id());',
      t
    );
  end loop;
end $$;

-- payment_allocations has no org_id; scope it through its parent payment.
drop policy if exists payment_allocations_org_read on payment_allocations;
create policy payment_allocations_org_read on payment_allocations
  for select using (
    exists (
      select 1 from payments p
      where p.id = payment_allocations.payment_id
        and p.org_id::text = current_org_id()
    )
  );

-- NOTE: writes (INSERT/UPDATE/DELETE) intentionally have NO policy here, so the
-- anon/user role cannot mutate financial tables directly — all writes go through
-- the backend (service role). Add granular admin write policies later if the
-- frontend ever writes directly. See doc/Database_Schema.md.
