# FeeFlow Backend Review

**Reviewer:** Senior NestJS / fintech code review
**Scope:** `apps/backend` (webhooks, auth, app bootstrap) + `packages/core` (@feeflow/core) + `supabase/migrations`
**Date:** 2026-06-29
**Judging lens:** (1) reconciliation accuracy, (2) identity model quality, (3) developer API quality. Money is integer Kobo.

---

## 1. Summary Verdict

**Not good enough yet — but one change fixes the most dangerous flaw.** The queue/idempotency scaffolding (BullMQ `jobId = transactionId`, exponential backoff, HTTP 200 to Nomba) is genuinely well thought out, and the SQL layer is excellent: the atomic `reconcile_payment()` function in `0002_functions.sql` does exactly the right thing — locks the student's fees `FOR UPDATE`, allocates clearance-required-first then oldest, writes the payment + allocations, credits overpayment, recomputes clearance, and audits, all in ONE transaction. The shared `@feeflow/core` package is clean, pure, integer-Kobo-safe, and unit-tested.

**The problem: none of that correct code is actually used.** `webhooks.service.ts` re-implements the entire reconciliation by hand as ~8 separate, un-transactional Supabase calls. `@feeflow/core` is imported nowhere in the backend (verified: zero matches). The atomic `reconcile_payment()` RPC is never called. So in production the service has a real **money-corrupting race condition** plus several smaller correctness bugs.

### The ONE thing to fix first

**Replace the entire hand-rolled body of `WebhooksService.processPayment()` with a single `supabase.rpc('reconcile_payment', {...})` call.** The atomic function already exists, already matches the canonical allocation order, and already handles idempotency, overpayment, clearance, and audit. This one change simultaneously fixes the race condition, the missing row locks, the non-atomic partial-write window, the `'PROCESSING'` enum bug, the wrong allocation order, and the duplicate logic. It is less code, not more.

---

## 2. Findings (ranked by severity)

### CRITICAL

| # | File:Line | Problem | Fix |
|---|-----------|---------|-----|
| C1 | `webhooks.service.ts:30-181` | **Race condition / non-atomic reconciliation.** The whole method is ~8 independent Supabase calls with no transaction and no row lock. Two concurrent webhooks for the same student (Nomba retry, or two real transfers) both read the same stale `student_fees.amount_balance`/`amount_paid`, both allocate against it, and double-credit the fee — the exact bug `RECONCILIATION_FLOW.md` warns about. The idempotency guard at lines 31-39 is a non-locking `SELECT` and does not prevent two *distinct* transaction IDs from racing, nor two copies of the same ID that both pass the check before either inserts. | Call the atomic DB function instead: `const { data, error } = await this.supabase.rpc('reconcile_payment', { p_org_id, p_student_id, p_virtual_account_id, p_amount: amountKobo, p_nomba_transaction_id, p_nomba_reference, p_sender_name, p_sender_account, p_webhook_received_at })`. It locks fees `FOR UPDATE`, is single-transaction, and returns the summary jsonb. Delete lines 70-181. |
| C2 | `webhooks.controller.ts:26-33` + `main.ts:5` | **Webhook signature is effectively never verified against the raw body.** `main.ts` calls `NestFactory.create(AppModule)` WITHOUT `{ rawBody: true }`, so `req.rawBody` is always `undefined`. The HMAC therefore always falls back to `JSON.stringify(payload)` (line 27), whose byte layout differs from Nomba's original body → the computed signature can never match a real Nomba signature. On top of that, the check only runs `if (NODE_ENV === 'production')` (line 31), so in every other environment any caller can post a forged payment and get it reconciled. `@feeflow/core` already exports a correct constant-time `verifyWebhookSignature()` that is unused. | (a) `NestFactory.create(AppModule, { rawBody: true })` in `main.ts`. (b) Import and use `verifyWebhookSignature(req.rawBody.toString('utf8'), signature, secret)` from `@feeflow/core`. (c) Verify in ALL environments (gate only a test-mode bypass behind an explicit flag, not `NODE_ENV`). (d) On failure return 401, do not throw a 400 that could be misread by Nomba as retryable. |

### HIGH

| # | File:Line | Problem | Fix |
|---|-----------|---------|-----|
| H1 | `webhooks.service.ts:83` | **`reconciliation_status: 'PROCESSING'` is not a valid value.** The documented/`@feeflow/core` enum is `UNRECONCILED | RECONCILED | DISPUTED` (`types.ts:29`). The DB column has no CHECK constraint so it silently accepts the bad value, leaving any payment that crashes mid-method stuck in a phantom `PROCESSING` state that no query or dashboard understands. | Goes away entirely with C1 (the RPC writes `RECONCILED` atomically). If kept manually, the correct intermediate is `UNRECONCILED`. |
| H2 | `webhooks.service.ts:93-100` | **Wrong allocation order — contradicts the canonical algorithm.** The service orders fees by `created_at` only (oldest-first). The spec, `@feeflow/core`'s `prioritizeFees()`, and the SQL function all require **clearance-required fees FIRST, then oldest**. This directly hurts judging criterion #1 (reconciliation accuracy) and #2: a part-payment can settle a non-clearance fee while leaving a clearance fee unpaid, producing a "wrong" clearance outcome in the demo. | Fixed by C1. The RPC's `order by ft.is_clearance_required desc, sf.created_at asc` is correct. |
| H3 | `webhooks.service.ts:28` + `webhooks.controller.ts:47` | **Possible Kobo/Naira double-handling — confirm the Nomba unit.** The controller passes `amountNaira: Number(amount)` and the service does `Math.round(amountNaira * 100)`. But `RECONCILIATION_FLOW.md` and `types.ts:218-231` state Nomba's `amount` is already **Kobo** (the spec logs `amount/100` and stores `amount` straight into the Kobo column). If Nomba sends Kobo and you multiply by 100, every payment is inflated 100×. | Confirm against a real Nomba payload. Treat the webhook `amount` as Kobo by default (per the documented convention); only convert with `nairaToKobo()` if Nomba is verified to send Naira. Do the conversion once, at the controller boundary, and pass Kobo inward. Name the field `amountKobo`. |
| H4 | `webhooks.service.ts:52-54`, `64-68`, `139-148` | **Missing edge-case handling the judges explicitly test.** Unknown virtual account just throws `NotFoundException` (→ job fails → 5 retries → permanent failure) instead of recording an **orphaned/misdirected payment** for manual review as the spec requires. There is also no handling for "student has no outstanding fees" beyond dumping to credit. These are scored edge cases (misdirected payment, overpayment). | In the RPC (or a thin wrapper) record orphaned payments to a holding state rather than throwing; surface them on the admin side. At minimum, catch the not-found case and persist it so money is never silently lost. |
| H5 | `webhooks.service.ts` (whole file) + backend-wide | **`@feeflow/core` is duplicated, not used (verified: 0 imports in `apps/backend`).** The tested, canonical `allocatePayment()`, `calculateClearance()`, `deriveFeeStatus()`, `verifyWebhookSignature()`, and the Kobo helpers all exist and are re-implemented by hand here with subtle differences (H2, C2). Logic drift between the duplicate and the source is how reconciliation bugs ship. | Depend on `@feeflow/core` from the backend. After C1 the service barely needs it (RPC does the math), but the controller must use `verifyWebhookSignature` and `nairaToKobo`. Wire the workspace package into the backend `package.json`. |

### MEDIUM

| # | File:Line | Problem | Fix |
|---|-----------|---------|-----|
| M1 | `main.ts:1-8` | **No global hardening.** No `ValidationPipe` (`{ whitelist: true, transform: true }`), no global exception filter, no Pino logger wired (the `nestjs-pino` dep is installed but unused), no `enableShutdownHooks`, no `setGlobalPrefix`. API quality is a judging axis. | `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`, register a global exception filter that maps to consistent JSON, adopt `nestjs-pino`'s `Logger`, and `app.useLogger(...)`. |
| M2 | `webhooks.controller.ts:17` + `auth.controller.ts:10,19` | **No DTOs / `class-validator`, despite the deps being installed.** Controllers read untyped `@Body() payload: any` and `@Body('email')`. No structural validation of the webhook or auth bodies beyond manual `if (!x)`. | Add `NombaWebhookDto`, `LoginDto`, `VerifyOtpDto` with `class-validator` decorators; let the global `ValidationPipe` enforce them. Improves API quality score directly. |
| M3 | `app.module.ts` vs `app.controller.ts`/`app.service.ts` | **`AppController`/`AppService` are never registered.** `AppModule` declares no `controllers`/`providers` for them, so `GET /` (health check) does not actually exist. Dead, misleading code. | Either register them (useful as a `/health` endpoint judges/uptime checks hit) or delete them. A real health endpoint is worth keeping. |
| M4 | `auth.service.ts:55` | **Hardcoded OTP `'123456'` with no env guard.** Fine for the sandbox, but if this ships to the LIVE submission it is a full auth bypass for any known email. The real OTP line is commented out. | Gate behind `if (process.env.NODE_ENV !== 'production')`; generate a crypto OTP otherwise. Make it impossible to deploy the static OTP to prod. |
| M5 | `auth.module.ts:12`, `jwt.strategy.ts:11` | **JWT secret falls back to a hardcoded string** in two places. If `JWT_SECRET` is unset in prod, tokens are signable by anyone who has read the repo. | Fail fast at boot if `JWT_SECRET` is missing (use `ConfigModule` `validationSchema` / Joi). No fallback secret. |
| M6 | `app.module.ts:12-14` + `auth/webhooks services` | **`SUPABASE_SERVICE_ROLE_KEY` naming, env validation, and service-role-on-webhook.** Env name is consistent across the two services (good — both use `SUPABASE_SERVICE_ROLE_KEY`), but CLAUDE.md/SETUP examples call it `SUPABASE_SERVICE_KEY`; align the docs/`.env` to avoid a silent empty-string client (`|| ''`) that fails every call. There is no `ConfigModule` env-schema validation, so a missing `SUPABASE_URL`/key boots a broken app. | Standardize on `SUPABASE_SERVICE_ROLE_KEY` everywhere and add `ConfigModule.forRoot({ validationSchema })` so the app refuses to boot without required vars. (Service-role key bypasses RLS — acceptable for the trusted webhook worker, but keep it out of any user-facing path.) |

### LOW

| # | File:Line | Problem | Fix |
|---|-----------|---------|-----|
| L1 | `webhooks.service.ts:1-3`, `auth.service.ts:3-4` | Odd import style `import * as cacheManager_1 from 'cache-manager'` (looks transpiler-generated). Cosmetic; tidy to `import type { Cache } from 'cache-manager'`. | Clean up imports. |
| L2 | `webhooks.controller.ts:63` | Response `status: 'QUEUED_IN_REDUCER_POOL'` and pervasive florid comments ("liquid funds", "reducer pool", "cryptographic integrity audit") add noise without meaning. Keep responses/log lines plain for API quality. | Use plain, accurate strings. |
| L3 | `auth.service.ts:61` | OTP printed to `console.log` — fine for sandbox, remove before LIVE. | Drop the log or guard by env. |
| L4 | `webhooks.service.ts:64-68` | Redundant second `virtual_accounts` lookup for the row `id` after the cached mapping already could carry it. After C1 you need `virtual_account_id` once; include `id` in the cached mapping (or pass it through). | Fold `id` into the lookup/cache. |
| L5 | `0001_init.sql:157` / `payments` | `payments` table has the documented `UNIQUE(nomba_transaction_id)` but the doc also mentions `UNIQUE(org_id, nomba_transaction_id)`. Single-column unique is stricter and fine; just make sure the RPC's `unique_violation` handler (it has one) matches the actual constraint. | No action needed; noted for consistency. |

---

## 3. What to actually build vs skip (honest hackathon calls)

### Caching (Redis account→student map) — **SKIP / remove for the hackathon**
The service caches `va:student:map:{accountNumber}` in Redis for 24h (`webhooks.service.ts:42-58`). Honest verdict: **premature and net-negative right now.**
- The lookup it replaces is a single indexed equality query on `virtual_accounts.account_number` (unique index exists) — already O(1) and sub-millisecond. You are caching to save a query that isn't slow.
- It adds correctness risk: if a virtual account is reassigned/archived, the 24h-stale cache misroutes a payment — directly harming judging criterion #2 (identity model). Caching identity mappings in a money path is the wrong place to cache.
- You are *already* paying for Redis because BullMQ needs it, so the cache isn't adding a dependency — but it is adding a stale-data failure mode for zero measured benefit.
- **Recommendation:** Drop the account-map cache; do the indexed query inside the RPC (it has to lock/read the student anyway). Keep Redis solely for BullMQ and the OTP store. If you ever prove the lookup is hot, cache it then, with explicit invalidation on account changes.

### Load balancing — **SKIP entirely; do not hand-code it**
This is pure infrastructure. Railway/Vercel terminate TLS and distribute requests across instances for you; horizontal scale is a platform setting, not application code. Hand-rolling LB logic in a NestJS service would be wasted hackathon time and would not earn a single judging point. The right "scaling" posture here is already in place: a stateless HTTP handler that returns 200 fast and pushes work to a BullMQ worker, with the DB enforcing correctness via row locks. Leave load balancing to the platform.

### Worth keeping / it's already good
- BullMQ with `jobId = transactionId`, 5 attempts, exponential backoff — correct shape for webhook durability.
- Returning HTTP 200 immediately so Nomba doesn't hammer retries while real work happens async — correct.
- The atomic `reconcile_payment()` SQL function and the `@feeflow/core` package — both excellent; the entire fix is to *use* them.

---

## 4. Prioritized action list

1. **(C1) Swap `processPayment()` to `supabase.rpc('reconcile_payment', …)`.** Deletes ~110 lines, kills the race condition, fixes allocation order (H2) and the `PROCESSING` enum (H1) for free. Highest impact, lowest effort.
2. **(C2) Make signature verification real:** add `{ rawBody: true }` in `main.ts`, use `@feeflow/core`'s `verifyWebhookSignature` against the raw body, verify in all environments, return 401 on failure.
3. **(H3) Confirm the Nomba `amount` unit** (Kobo vs Naira) and convert exactly once at the controller boundary. Wrong unit = every payment off by 100×.
4. **(H4) Handle orphaned/misdirected payments** (unknown VA, no fees) by recording for review instead of throwing — these are explicitly judged edge cases.
5. **(H5) Depend on `@feeflow/core`** from the backend; stop duplicating logic.
6. **(M1/M2)** Add global `ValidationPipe` + exception filter + wire `nestjs-pino`; add DTOs for webhook/auth bodies. Cheap API-quality wins.
7. **(M4/M5/M6)** Gate the static OTP, JWT secret, and Supabase keys behind env validation so the LIVE build can't ship with sandbox bypasses; align env var naming with the docs.
8. **(M3)** Register a real `/health` endpoint or delete the dead `AppController`/`AppService`.
9. **(Caching)** Remove the account→student Redis cache; keep Redis for BullMQ + OTP only.

**Bottom line:** the design and the SQL are right; the NestJS service just isn't calling them. Do item #1 and most of the Critical/High list collapses.
