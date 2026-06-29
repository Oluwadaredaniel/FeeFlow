# @feeflow/core

Framework-agnostic domain logic shared by the FeeFlow frontend and backend.
Pure TypeScript, **zero runtime dependencies** (only Node's built-in `crypto` and `Intl`).

## What's inside

| Module | Exports | Purpose |
|---|---|---|
| `money.ts` | `nairaToKobo`, `koboToNaira`, `formatNaira`, `assert*Integer` | Money is integer **Kobo** everywhere. ₦1 = 100 Kobo. |
| `reconciliation.ts` | `allocatePayment`, `prioritizeFees`, `deriveFeeStatus` | The payment allocation engine (clearance-first, then oldest). |
| `clearance.ts` | `calculateClearance` | Is a student cleared? (all clearance-required fees `PAID`). |
| `webhook.ts` | `verifyWebhookSignature`, `computeWebhookSignature` | Constant-time HMAC-SHA256 verification of Nomba webhooks. |
| `types.ts` | DB row + Nomba payload interfaces | Typed contract matching `doc/Database_Schema.md`. |

## Usage (backend / frontend)

```ts
import { allocatePayment, calculateClearance, verifyWebhookSignature } from '@feeflow/core';

if (!verifyWebhookSignature(rawBody, sigHeader, secret)) return reject();

const { allocations, updatedFees, remainingCredit } = allocatePayment(outstandingFees, amountKobo);
// ...persist inside a DB transaction, then:
const { isCleared } = calculateClearance(allFeesForStudent);
```

## Develop

```bash
npm run build      -w @feeflow/core   # tsc -> dist/ (CommonJS, consumable by NestJS)
npm run typecheck  -w @feeflow/core
npm run test       -w @feeflow/core   # node:test via tsx — runs after `npm install`
```

> Tests use Node's built-in `node:test` runner (no Jest needed). `tsx` is the only
> dev dependency required to run them; it installs with the root `npm install`.

## Design notes

- **Integer Kobo only.** Never store or compute money as floats.
- **Allocation priority is canonical:** clearance-required fees first, then oldest
  (`created_at` ascending) — resolves the contradiction in `doc/Reconciliation_Flow.md`
  between the webhook walkthrough and the algorithm section.
- **No-required-fees edge case:** a student with zero clearance-required fees is
  reported as cleared, mirroring the DB `calculate_clearance()` function.
- **Nomba `amount` units:** treated as Kobo (matches how the spec stores it). Confirm
  against the live payload; if Nomba sends Naira, convert at the boundary only.
