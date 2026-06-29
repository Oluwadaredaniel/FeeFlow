# FeeFlow — Handoff / Pickup Guide

Single source of truth for "where are we and what's next." Read this first.

---

## What exists right now

```
Hackathon/
├── packages/core/         @feeflow/core — SHARED logic, 0 runtime deps, 15 tests passing
│   └── src/               reconciliation.ts · clearance.ts · webhook.ts · money.ts · types.ts
├── supabase/
│   ├── migrations/        0001_init.sql · 0002_functions.sql · 0003_rls.sql
│   ├── seed/seed.sql      OAU + 3 fee types + 5 students
│   └── README.md          how to apply + the reconcile_payment() contract
├── apps/
│   ├── backend/           NestJS (scaffolded). Webhook → BullMQ queue → atomic RPC.
│   └── frontend/          Next.js 14 + shadcn (scaffolded; pages not built yet)
└── doc/
    ├── API_ENDPOINTS.md       ← 33-endpoint catalog (give to backend devs)
    ├── FRONTEND_HANDOFF.md    ← every page/component/empty-state + endpoints (give to frontend dev)
    ├── BACKEND_REVIEW.md      ← code audit + prioritized fixes
    └── (existing specs: Product_Spec, Architecture, Database_Schema, Reconcilation_Flow, ...)
```

## How the pieces link (the payment path)

```
Nomba ──POST /webhooks/nomba──► WebhooksController
   verify HMAC (verifyWebhookSignature from @feeflow/core)
   enqueue BullMQ job (jobId = transactionId → idempotent)
        └─► PaymentProcessor ──► WebhooksService.processPayment()
                 lookup virtual_accounts by account_number  (identity)
                 supabase.rpc('reconcile_payment', {...})    (ATOMIC money movement)
                      └─ locks fees FOR UPDATE, allocates (clearance-first, then oldest),
                         writes payment + allocations, credits overpayment,
                         calculate_clearance(), audit log — ONE transaction
```

`@feeflow/core` holds the **reference** allocation/clearance logic (unit-tested); the
**Postgres `reconcile_payment()`** is the atomic executor that actually runs in production.
Keep the two in sync if allocation rules change.

## Run it (after the npm SSL issue is resolved)

```bash
npm install                 # root — symlinks workspaces; postinstall builds @feeflow/core
npm run build:core          # (re)build the shared package
npm run test:core           # 15 tests should pass

# DB: apply supabase/migrations/0001 → 0002 → 0003, then seed/seed.sql (see supabase/README.md)

npm run dev:backend         # builds core, then NestJS on :3001  (needs Redis for BullMQ)
npm run dev:frontend        # Next.js on :3000
```

Backend needs **Redis** (BullMQ + OTP). `.env` keys: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `NOMBA_WEBHOOK_SECRET`, `REDIS_HOST/PORT`, `JWT_SECRET`.

---

## What's DONE ✅
- Full DB schema + **atomic, race-safe** `reconcile_payment()` + clearance + RLS + seed
- `@feeflow/core` (money/reconciliation/clearance/webhook + types), tested
- Webhook flow rewired: signature verified (always-on when secret set) + atomic RPC
- 3 handoff docs (endpoints, frontend, backend review)

## What's NEXT 🔜 (pick up here)
**Backend** (details + line refs in `doc/BACKEND_REVIEW.md`):
1. Auth: replace static `'123456'` OTP with Supabase OTP; add env validation; remove hardcoded JWT/secret fallbacks **before LIVE day**.
2. Add DTOs + leverage the global `ValidationPipe`; add a global exception filter.
3. Build the read/CRUD modules from `doc/API_ENDPOINTS.md`: students, fee-types, student-fees (assign), payments list, clearance, reports, health.
4. (Optional) `orphaned_payments` table + `GET /api/payments/orphaned` for misdirected payments.
5. Remove the unused Redis account→student cache (premature; see review).

**Frontend** — build from `doc/FRONTEND_HANDOFF.md` (12 admin + 6 student pages, ~14 shared components). Landing page last (lowest judged value).

## Open questions to confirm 🚩
- **Nomba payload**: real field names + whether `amount` is Naira or **Kobo** (service currently does `*100`). Confirm against a live/sandbox webhook — this is a 100×-error risk.
- **Webhook path**: controller is at `/webhooks/nomba` (no `/api` prefix) — align with the rest of the API and the URL registered with Nomba.
- Stray `apps/next-app/` folder looks like an accidental scaffold — verify and delete if so.
