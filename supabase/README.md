# FeeFlow — Database (Supabase)

Apply these **in order**. Idempotent, so re-running is safe.

| File | Purpose |
|---|---|
| `migrations/0001_init.sql` | All 10 tables, indexes, `updated_at` triggers |
| `migrations/0002_functions.sql` | `reconcile_payment()` (atomic), `calculate_clearance()`, `mark_overdue_fees()` |
| `migrations/0003_rls.sql` | Row-Level Security (multi-tenant org isolation) |
| `seed/seed.sql` | Demo data: OAU + 3 fee types + 5 students (do **not** run in prod) |

## Apply

**Option A — Supabase SQL Editor:** paste each file's contents and run, in order.

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies migrations/
# seed manually:
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

## The one function that matters: `reconcile_payment()`

Reconciliation is **atomic and race-safe** because it's a single Postgres function
(the Supabase JS client can't hold a transaction across calls). The backend calls it
via RPC — see `apps/backend/src/webhooks/`:

```ts
const { data } = await supabase.rpc('reconcile_payment', {
  p_org_id, p_student_id, p_virtual_account_id,
  p_amount: amountKobo,                 // integer Kobo, > 0
  p_nomba_transaction_id: txnRef,
  p_nomba_reference, p_sender_name, p_sender_account,
  p_webhook_received_at: receivedAtIso,
});
// data => { reconciled, payment_id, total_allocated, credit, fees_updated, clearance }
```

It locks the student's fees `FOR UPDATE`, allocates **clearance-required fees first
then oldest**, writes the payment + allocations, credits overpayment, recomputes
clearance, and logs an audit row — all in one transaction. Duplicate Nomba
transaction ids return `{ reconciled: false, reason: 'DUPLICATE' }`.

This mirrors the pure reference implementation in `@feeflow/core` (`allocatePayment`),
which is unit-tested — keep the two in sync if you change allocation rules.

## Gotchas baked in

- **Money is integer Kobo** everywhere (`amount_naira`, `amount_due`, ... ). ₦1 = 100.
- **`is_overdue`** is a plain column (the doc's `GENERATED ... NOW()` is illegal in
  Postgres). Refresh it on a schedule with `select mark_overdue_fees();`.
- **RLS is bypassed by the service-role key** the backend uses — policies only guard
  the frontend (anon key + user JWT, with `org_id` as a custom claim).
