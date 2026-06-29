-- ============================================================================
-- FeeFlow — 0002_functions.sql
-- Atomic reconciliation. Supabase's JS client can't hold an interactive
-- transaction across calls, so the race-safe logic lives here as ONE function.
-- reconcile_payment() locks the student's fees (FOR UPDATE), allocates, writes
-- the payment + allocations, credits overpayment, and recomputes clearance —
-- all in a single transaction. Mirrors @feeflow/core's allocatePayment().
-- ============================================================================

-- calculate_clearance(): recompute + upsert a student's clearance status.
-- A student with zero clearance-required fees is trivially cleared (0 = 0).
create or replace function calculate_clearance(p_student_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_org_id         uuid;
  v_required_total int;
  v_required_paid  int;
  v_is_cleared     boolean;
begin
  select org_id into v_org_id from students where id = p_student_id;

  select
    count(*) filter (where ft.is_clearance_required),
    count(*) filter (where ft.is_clearance_required and sf.status = 'PAID')
  into v_required_total, v_required_paid
  from student_fees sf
  join fee_types ft on ft.id = sf.fee_type_id
  where sf.student_id = p_student_id;

  v_is_cleared := (v_required_paid = v_required_total);

  insert into clearance_status (org_id, student_id, is_cleared, cleared_at, last_calculated_at, calculation_details)
  values (
    v_org_id, p_student_id, v_is_cleared,
    case when v_is_cleared then now() else null end,
    now(),
    jsonb_build_object('required_total', v_required_total, 'required_paid', v_required_paid)
  )
  on conflict (student_id) do update set
    is_cleared          = excluded.is_cleared,
    cleared_at          = case when excluded.is_cleared then coalesce(clearance_status.cleared_at, now()) else null end,
    last_calculated_at  = now(),
    calculation_details = excluded.calculation_details;

  return jsonb_build_object(
    'is_cleared', v_is_cleared,
    'required_total', v_required_total,
    'required_paid', v_required_paid
  );
end;
$$;

-- reconcile_payment(): the atomic core. Returns a jsonb summary.
-- Allocation priority: clearance-required fees first, then oldest (created_at).
create or replace function reconcile_payment(
  p_org_id               uuid,
  p_student_id           uuid,
  p_virtual_account_id   uuid,
  p_amount               int,          -- Kobo, must be > 0
  p_nomba_transaction_id text,
  p_nomba_reference      text default null,
  p_sender_name          text default null,
  p_sender_account       text default null,
  p_webhook_received_at  timestamptz default now()
)
returns jsonb
language plpgsql
as $$
declare
  v_existing        uuid;
  v_payment_id      uuid;
  v_remaining       int := p_amount;
  v_alloc           int;
  v_balance         int;
  v_new_paid        int;
  v_allocated_count int := 0;
  v_fee             record;
  v_clearance       jsonb;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'reconcile_payment: amount must be a positive integer (Kobo), got %', p_amount;
  end if;

  -- Idempotency: ignore Nomba retries of the same transaction.
  select id into v_existing from payments where nomba_transaction_id = p_nomba_transaction_id;
  if found then
    return jsonb_build_object('reconciled', false, 'reason', 'DUPLICATE', 'payment_id', v_existing);
  end if;

  -- Record the payment (final state; the whole function is one transaction).
  insert into payments (
    org_id, student_id, virtual_account_id, amount_naira,
    nomba_transaction_id, nomba_reference, sender_name, sender_account,
    status, reconciliation_status, webhook_received_at, reconciliation_completed_at
  ) values (
    p_org_id, p_student_id, p_virtual_account_id, p_amount,
    p_nomba_transaction_id, p_nomba_reference, p_sender_name, p_sender_account,
    'SUCCESS', 'RECONCILED', p_webhook_received_at, now()
  )
  returning id into v_payment_id;

  -- Lock outstanding fees in priority order, then allocate greedily.
  for v_fee in
    select sf.id, sf.amount_due, sf.amount_paid
    from student_fees sf
    join fee_types ft on ft.id = sf.fee_type_id
    where sf.student_id = p_student_id
      and sf.status in ('UNPAID', 'PARTIALLY_PAID')
    order by ft.is_clearance_required desc, sf.created_at asc
    for update of sf
  loop
    exit when v_remaining <= 0;

    v_balance := v_fee.amount_due - v_fee.amount_paid;
    if v_balance <= 0 then
      continue;
    end if;

    v_alloc    := least(v_remaining, v_balance);
    v_new_paid := v_fee.amount_paid + v_alloc;

    update student_fees set
      amount_paid = v_new_paid,
      status      = case when v_new_paid >= amount_due then 'PAID'
                         when v_new_paid > 0          then 'PARTIALLY_PAID'
                         else 'UNPAID' end,
      paid_at     = case when v_new_paid >= amount_due then now() else paid_at end
    where id = v_fee.id;

    insert into payment_allocations (payment_id, student_fee_id, allocated_amount)
    values (v_payment_id, v_fee.id, v_alloc);

    v_remaining       := v_remaining - v_alloc;
    v_allocated_count := v_allocated_count + 1;
  end loop;

  -- Overpayment -> student credit balance (Kobo).
  if v_remaining > 0 then
    update students
    set credit_balance = credit_balance + v_remaining
    where id = p_student_id;
  end if;

  v_clearance := calculate_clearance(p_student_id);

  insert into audit_logs (org_id, entity_type, entity_id, action, new_value, actor_email, actor_role)
  values (
    p_org_id, 'PAYMENT', v_payment_id, 'RECONCILED',
    jsonb_build_object(
      'amount', p_amount,
      'total_allocated', p_amount - v_remaining,
      'credit', v_remaining,
      'fees_updated', v_allocated_count,
      'clearance', v_clearance
    ),
    'system', 'SYSTEM'
  );

  return jsonb_build_object(
    'reconciled', true,
    'payment_id', v_payment_id,
    'student_id', p_student_id,
    'amount', p_amount,
    'total_allocated', p_amount - v_remaining,
    'credit', v_remaining,
    'fees_updated', v_allocated_count,
    'clearance', v_clearance
  );

exception
  when unique_violation then
    -- Concurrent duplicate webhook lost the race on nomba_transaction_id.
    select id into v_existing from payments where nomba_transaction_id = p_nomba_transaction_id;
    return jsonb_build_object('reconciled', false, 'reason', 'DUPLICATE', 'payment_id', v_existing);
end;
$$;

-- mark_overdue_fees(): refresh is_overdue (run on a schedule via node-cron).
create or replace function mark_overdue_fees()
returns int
language plpgsql
as $$
declare v_count int;
begin
  update student_fees
  set is_overdue = true
  where due_date is not null
    and due_date < current_date
    and status in ('UNPAID', 'PARTIALLY_PAID')
    and is_overdue = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
