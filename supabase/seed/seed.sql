-- ============================================================================
-- FeeFlow — seed.sql  (DEMO DATA — do not run against production)
-- 1 org (OAU) · 3 fee types · 5 students each with a virtual account + 3 fees.
-- Deterministic UUIDs so you can reference rows in tests. Idempotent.
-- Apply AFTER 0001_init.sql. Money is Kobo.
-- ============================================================================

-- Organization --------------------------------------------------------------
insert into organizations (id, name, slug, nomba_account_id, nomba_sub_account_id, admin_email, institution_type, is_verified)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'Obafemi Awolowo University', 'oau',
  'f666ef9b-888e-4799-85ce-acb505b28023',   -- Nomba parent (TEST)
  'f23a4cd9-4d9b-4429-92f4-6f881d9c39b2',   -- Nomba sub-account (TEST)
  'admin@oau.edu.ng', 'UNIVERSITY', true
)
on conflict (id) do nothing;

-- Fee types -----------------------------------------------------------------
insert into fee_types (id, org_id, name, slug, amount_naira, is_clearance_required, fiscal_year) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Faculty Due',   'faculty_due',   500000, true,  '2024/2025'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Lab Fee',       'lab_fee',       200000, false, '2024/2025'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'Clearance Fee', 'clearance_fee',  50000, true,  '2024/2025')
on conflict (id) do nothing;

-- Students + virtual accounts + assigned fees -------------------------------
do $$
declare
  v_org   uuid := '00000000-0000-0000-0000-0000000000a1';
  i       int;
  v_sid   uuid;
  v_matric text;
  v_acct  text;
  v_ft    record;
begin
  for i in 1..5 loop
    -- Deterministic, valid-hex UUIDs: students = 1000+i, accounts = 2000+i.
    v_sid    := ('00000000-0000-0000-0000-' || lpad(to_hex(1000 + i), 12, '0'))::uuid;
    v_matric := 'CSC/2024/' || lpad(i::text, 3, '0');
    v_acct   := '102345' || lpad(i::text, 4, '0');

    insert into students (id, org_id, email, matric_number, first_name, last_name, department, faculty, level)
    values (v_sid, v_org, 'student' || i || '@student.oau.edu.ng', v_matric,
            'Student', 'Number' || i, 'Computer Science', 'Computing', 2)
    on conflict (id) do nothing;

    insert into virtual_accounts (id, org_id, student_id, account_number, account_name)
    values (('00000000-0000-0000-0000-' || lpad(to_hex(2000 + i), 12, '0'))::uuid,
            v_org, v_sid, v_acct, 'Student Number' || i)
    on conflict (id) do nothing;

    -- assign all three fee types to each student
    for v_ft in select id, amount_naira from fee_types where org_id = v_org loop
      insert into student_fees (org_id, student_id, fee_type_id, amount_due)
      values (v_org, v_sid, v_ft.id, v_ft.amount_naira)
      on conflict (student_id, fee_type_id) do nothing;
    end loop;

    perform calculate_clearance(v_sid);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Try a reconciliation against the seeded data (student 1, account 1023450001):
--   student 1 id = to_hex(1001)=3e9, account 1 id = to_hex(2001)=7d1
--
--   select reconcile_payment(
--     '00000000-0000-0000-0000-0000000000a1',          -- org
--     '00000000-0000-0000-0000-0000000003e9',          -- student 1
--     '00000000-0000-0000-0000-0000000007d1',          -- virtual account 1
--     750000,                                           -- ₦7,500 in Kobo
--     'TXN_DEMO_0001'                                   -- nomba transaction id
--   );
--
-- Expect: Faculty Due (₦5,000) + Clearance Fee (₦500) paid first (clearance-
-- required), then Lab Fee (₦2,000) -> all PAID, credit 0, is_cleared = true.
-- ---------------------------------------------------------------------------
