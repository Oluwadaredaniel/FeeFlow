# API Endpoint Catalog: FeeFlow

**Version:** 1.0
**Status:** Canonical MVP endpoint reference (NestJS backend)
**Scope:** Nomba Hackathon 2026 MVP only. Phase 2 features (configurable rules engine, installments, full refund processing, faculty/department hierarchy) are explicitly out of scope per CLAUDE.md.

This document is the single source of truth for every HTTP endpoint the FeeFlow backend exposes for the MVP. It aligns endpoint names to `doc/API_Spec.md`; endpoints not present in `API_Spec.md` but clearly required are tagged **[added]** with a justification.

---

## Conventions

### Base URL

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.feeflow.vercel.app` |
| Development | `http://localhost:3001` |

All paths in this catalog are prefixed with `/api` (NestJS global prefix). The existing `WebhooksController` is currently mounted at `/webhooks/nomba` without the `/api` prefix — it should be aligned to `/api/webhooks/nomba` to match this catalog and `API_Spec.md`.

### Authentication

| Auth tier | How it is supplied | Who holds it |
|-----------|--------------------|--------------|
| **public** | none | unauthenticated callers (login, OTP, health) |
| **admin JWT** | `Authorization: Bearer <token>` with claim `role: "ADMIN"` | institution administrators |
| **student JWT** | `Authorization: Bearer <token>` with claim `role: "STUDENT"` | enrolled students (self-service only) |
| **Nomba signature** | `x-nomba-signature: <HMAC-SHA256 hex>` header | the Nomba webhook caller (no JWT) |

JWTs are signed by FeeFlow on OTP verification and carry: `sub` (user/student id), `email`, `role`, `org_id`, and (for students) `matric`. The `org_id` claim drives multi-tenant isolation: every authenticated query is scoped to the caller's `org_id` via Postgres Row-Level Security (RLS). A student JWT may only read its own records; an admin JWT may read/write all records inside its `org_id`.

### Error Envelope

All non-2xx responses use a single envelope shape:

```json
{
  "success": false,
  "error": "INVALID_REQUEST",
  "message": "Email is required",
  "status_code": 400,
  "request_id": "req_12345"
}
```

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_REQUEST` | 400 | Missing or invalid fields |
| `UNAUTHORIZED` | 401 | No/invalid token, or bad webhook signature |
| `FORBIDDEN` | 403 | Authenticated but lacks permission (wrong role or cross-org) |
| `NOT_FOUND` | 404 | Resource not found (within caller's org) |
| `CONFLICT` | 409 | Resource already exists (unique constraint) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error (transient — safe to retry) |

### Money Rule

**All monetary fields are integer Kobo (₦1 = 100 Kobo).** `500000` means ₦5,000.00. Never floats. Frontend divides by 100 for display. This applies to every `amount_*`, `total_*`, `credit_balance`, `collected`, and `allocated_amount` field below.

### Pagination

List endpoints accept `?page` and `?limit` query params and return a `pagination` block.

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int | `1` | 1-based page index |
| `limit` | int | `20` | max `100` |

> Note: `API_Spec.md` historically used `?offset`. This catalog standardizes on `?page` per the requested convention and returns both `page` and the derived `offset` in the response `pagination` block for backward compatibility.

```json
"pagination": { "total": 500, "page": 1, "limit": 20, "offset": 0 }
```

### Standard Status Codes

`200` OK · `201` Created · `204` No Content · `400` Bad Request · `401` Unauthorized · `403` Forbidden · `404` Not Found · `409` Conflict · `429` Too Many Requests · `500` Internal Server Error.

### Org-Scoping & RLS (applies to every authenticated endpoint)

Every table carries `org_id` and has RLS enabled. The JWT `org_id` claim is the tenant boundary — an OAU admin can never see UNILAG data even with a guessed UUID. List endpoints are implicitly filtered to the caller's org. This is assumed for all endpoints below and not repeated per-endpoint.

---

## 1. Auth

OTP-based passwordless auth via Supabase Auth + FeeFlow-signed JWT. (Implemented: `apps/backend/src/auth/`.)

### POST /api/auth/login

- **Auth:** public
- **Purpose:** Request a 6-digit OTP for an email (admin or student).
- **Request body:**
  ```json
  { "email": "chioma.adeyemi@student.oau.edu.ng" }
  ```
- **Success — 200 OK:**
  ```json
  { "success": true, "message": "OTP sent to email" }
  ```
- **Errors:** `400` missing email · `401` email not registered to any org/student · `429` too many OTP requests (5/min per email).
- **Notes:** OTP cached 5 min TTL. Dev sandbox uses static `123456`.

### POST /api/auth/verify-otp

- **Auth:** public
- **Purpose:** Exchange a valid OTP for a JWT.
- **Request body:**
  ```json
  { "email": "chioma.adeyemi@student.oau.edu.ng", "otp": "123456" }
  ```
- **Success — 200 OK:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "user-45", "email": "chioma.adeyemi@student.oau.edu.ng", "org_id": "org-001", "role": "STUDENT" }
  }
  ```
- **Errors:** `400` invalid/expired OTP · `401` email not found.
- **Notes:** OTP is single-use (deleted on consumption). JWT carries `org_id` + `role`.

### POST /api/auth/logout

- **Auth:** admin JWT or student JWT
- **Purpose:** Invalidate the current session token.
- **Request body:** none
- **Success — 200 OK:**
  ```json
  { "success": true, "message": "Logged out successfully" }
  ```
- **Errors:** `401` no/invalid token.
- **Notes:** In spec; not yet implemented in `auth.controller.ts`.

### GET /api/auth/me

- **Auth:** admin JWT or student JWT — **[added]**
- **Purpose:** Return the authenticated principal decoded from the JWT (used by frontend on app load to restore session).
- **Success — 200 OK:**
  ```json
  { "id": "user-45", "email": "chioma.adeyemi@student.oau.edu.ng", "org_id": "org-001", "role": "STUDENT", "matric_number": "CSC/2024/045" }
  ```
- **Errors:** `401` no/invalid token.
- **Justification:** SPA session bootstrap needs a cheap "who am I" call; avoids decoding the JWT client-side and re-validating org status. Trivial to implement from the JWT strategy already in `auth/jwt.strategy.ts`.

---

## 2. Organizations / Onboarding

Institution accounts. For the hackathon, OAU is the seeded tenant; multi-institution onboarding is supported but creation is restricted.

### POST /api/institutions

- **Auth:** public (super-admin / platform owner — gated by a platform key, no org JWT exists yet at creation time)
- **Purpose:** Create a new institution (tenant) and its admin.
- **Request body:**
  ```json
  {
    "name": "Obafemi Awolowo University",
    "slug": "oau",
    "nomba_account_id": "f666ef9b-888e-4799-85ce-acb505b28023",
    "nomba_sub_account_id": "f23a4cd9-4d9b-4429-92f4-6f881d9c39b2",
    "admin_email": "admin@oau.edu.ng",
    "institution_type": "UNIVERSITY",
    "country_code": "NG"
  }
  ```
- **Success — 201 Created:**
  ```json
  { "id": "org-001", "name": "Obafemi Awolowo University", "slug": "oau", "status": "ACTIVE", "created_at": "2026-07-01T10:00:00Z" }
  ```
- **Errors:** `400` missing fields · `409` slug or `nomba_account_id` already in use.
- **Notes:** `nomba_account_id` is `UNIQUE` (one Nomba account = one institution). `nomba_webhook_secret` is generated server-side, not accepted from the client.

### GET /api/institutions/:id

- **Auth:** admin JWT (must match `org_id`)
- **Purpose:** Fetch the caller's institution profile.
- **Path params:** `id` — organization UUID.
- **Success — 200 OK:**
  ```json
  {
    "id": "org-001",
    "name": "Obafemi Awolowo University",
    "slug": "oau",
    "logo_url": "https://s3.../oau-logo.png",
    "status": "ACTIVE",
    "nomba_account_id": "f666ef9b-888e-4799-85ce-acb505b28023",
    "created_at": "2026-07-01T10:00:00Z"
  }
  ```
- **Errors:** `401` no token · `403` requesting a different org's id · `404` not found.
- **Notes:** `nomba_webhook_secret` and `nomba_sub_account_id` are never returned in responses.

### PATCH /api/institutions/:id

- **Auth:** admin JWT (must match `org_id`) — **[added]**
- **Purpose:** Update institution profile (logo, contact email/phone, display name).
- **Path params:** `id` — organization UUID.
- **Request body (all optional):**
  ```json
  { "logo_url": "https://s3.../oau-logo.png", "contact_email": "bursar@oau.edu.ng", "contact_phone": "+2348012345678" }
  ```
- **Success — 200 OK:** updated institution object.
- **Errors:** `400` invalid field · `401`/`403`/`404`.
- **Justification:** Onboarding requires a logo (used on receipts/certificates per Product Spec) and contact details; without an update path the admin cannot complete branding. Immutable fields (`slug`, `nomba_account_id`, webhook secret) are rejected.

---

## 3. Students

Each student gets exactly one primary virtual account on creation.

### POST /api/students

- **Auth:** admin JWT
- **Purpose:** Create a student and provision a Nomba virtual account.
- **Request body:**
  ```json
  {
    "email": "chioma.adeyemi@student.oau.edu.ng",
    "matric_number": "CSC/2024/045",
    "first_name": "Chioma",
    "last_name": "Adeyemi",
    "department": "Computer Science",
    "faculty": "Computing"
  }
  ```
- **Success — 201 Created:**
  ```json
  {
    "id": "student-45",
    "email": "chioma.adeyemi@student.oau.edu.ng",
    "matric_number": "CSC/2024/045",
    "first_name": "Chioma",
    "last_name": "Adeyemi",
    "status": "ACTIVE",
    "virtual_account": { "id": "va-45", "account_number": "1023456789", "bank_name": "Nomba", "status": "ACTIVE" },
    "created_at": "2026-07-01T10:00:00Z"
  }
  ```
- **Errors:** `400` missing required fields · `409` email or matric already exists for this org.
- **Notes:** Virtual-account creation calls Nomba with retry/backoff. If Nomba returns null, the student row is still created and the VA is provisioned on retry (see Edge Cases). `UNIQUE(org_id, matric_number)` and `UNIQUE(org_id, email)`.

### GET /api/students

- **Auth:** admin JWT
- **Purpose:** List/search students in the org.
- **Query params:** `?status=ACTIVE` · `?department=Computer%20Science` · `?search=<name|matric>` · `?page=1` · `?limit=20`
- **Success — 200 OK:**
  ```json
  {
    "data": [
      { "id": "student-45", "email": "chioma.adeyemi@student.oau.edu.ng", "matric_number": "CSC/2024/045", "first_name": "Chioma", "status": "ACTIVE", "created_at": "2026-07-01T10:00:00Z" }
    ],
    "pagination": { "total": 500, "page": 1, "limit": 20, "offset": 0 }
  }
  ```
- **Errors:** `401`/`403`.
- **Notes:** Paginated. RLS-scoped to org.

### GET /api/students/:id

- **Auth:** admin JWT, **or** student JWT where `sub == :id`
- **Purpose:** Full student profile with fees, virtual account, and clearance summary.
- **Path params:** `id` — student UUID.
- **Success — 200 OK:**
  ```json
  {
    "id": "student-45",
    "email": "chioma.adeyemi@student.oau.edu.ng",
    "matric_number": "CSC/2024/045",
    "first_name": "Chioma",
    "last_name": "Adeyemi",
    "department": "Computer Science",
    "status": "ACTIVE",
    "credit_balance": 0,
    "virtual_account": { "account_number": "1023456789", "bank_name": "Nomba", "status": "ACTIVE" },
    "fees": [
      { "id": "sf-45-001", "fee_type": "Faculty Due", "amount_due": 500000, "amount_paid": 300000, "amount_balance": 200000, "status": "PARTIALLY_PAID" }
    ],
    "clearance_status": { "is_cleared": false, "last_calculated_at": "2026-07-01T14:30:00Z" }
  }
  ```
- **Errors:** `401` · `403` student requesting another student's id · `404`.
- **Notes:** Money fields in Kobo (int).

### PATCH /api/students/:id

- **Auth:** admin JWT
- **Purpose:** Update student status/metadata (e.g. defer, graduate).
- **Path params:** `id` — student UUID.
- **Request body (all optional):**
  ```json
  { "status": "DEFERRED", "date_deferred": "2026-07-01" }
  ```
- **Success — 200 OK:**
  ```json
  { "id": "student-45", "status": "DEFERRED", "date_deferred": "2026-07-01", "updated_at": "2026-07-01T15:00:00Z" }
  ```
- **Errors:** `400` invalid status · `401`/`403`/`404`.

### POST /api/students/bulk-import

- **Auth:** admin JWT
- **Purpose:** Import students from CSV; provisions a virtual account per row.
- **Content-Type:** `multipart/form-data`, field `file` = CSV.
- **CSV columns:** `email,matric_number,first_name,last_name,department`
- **Success — 200 OK:**
  ```json
  { "success": true, "imported": 198, "failed": 2, "errors": [ { "row": 14, "reason": "Duplicate matric_number" } ], "message": "198 students imported successfully" }
  ```
- **Errors:** `400` malformed CSV / missing file · `401`/`403`.
- **Notes:** Partial success returns 200 with per-row `errors`. Idempotent on `(org_id, matric_number)` — existing rows are skipped, counted as `failed`.

---

## 4. Virtual Accounts

1:1 with students, provisioned via Nomba. Read-only in the MVP (creation happens implicitly during student creation).

### GET /api/students/:id/virtual-account — **[added]**

- **Auth:** admin JWT, **or** student JWT where `sub == :id`
- **Purpose:** Return the student's virtual account details (the number to pay into).
- **Path params:** `id` — student UUID.
- **Success — 200 OK:**
  ```json
  { "id": "va-45", "account_number": "1023456789", "account_name": "Adeyemi, Chioma", "bank_name": "Nomba", "status": "ACTIVE", "created_at": "2026-07-01T10:00:00Z" }
  ```
- **Errors:** `401`/`403`/`404`.
- **Justification:** The core student-facing action is "where do I pay?" The full student profile embeds this, but a dedicated lightweight endpoint is needed for the student dashboard's "pay now" panel and for other systems integrating the identity→account mapping (a judged criterion). Read-only; no create/delete in MVP.

### POST /api/students/:id/virtual-account/retry — **[added]**

- **Auth:** admin JWT
- **Purpose:** Manually re-attempt Nomba virtual-account provisioning when the initial create returned null.
- **Path params:** `id` — student UUID.
- **Success — 201 Created:** the provisioned virtual account object (same shape as GET above).
- **Errors:** `401`/`403` · `404` student not found · `409` student already has an active VA · `502` Nomba upstream failure (retryable).
- **Justification:** CLAUDE.md "Common Gotchas" #8 calls out that Nomba VA creation can succeed-but-return-null; an admin recovery path is required so a student is never permanently left without a payment account. Not a Phase-2 feature — it is part of the identity-model robustness the hackathon judges.

---

## 5. Fee Types

Fee templates owned by the institution. Versioned (editing creates a new version rather than mutating).

### POST /api/fee-types

- **Auth:** admin JWT
- **Purpose:** Create a fee template.
- **Request body:**
  ```json
  { "name": "Faculty Due", "amount_naira": 500000, "description": "Faculty development levy", "is_clearance_required": true, "fiscal_year": "2024/2025" }
  ```
  > `amount_naira` is **Kobo (int)** despite the legacy field name (`500000` = ₦5,000).
- **Success — 201 Created:**
  ```json
  { "id": "ft-001", "org_id": "org-001", "name": "Faculty Due", "amount_naira": 500000, "is_clearance_required": true, "version": 1, "status": "ACTIVE", "created_at": "2026-07-01T10:00:00Z" }
  ```
- **Errors:** `400` missing name/amount · `401`/`403` · `409` duplicate `(org_id, name, version)`.

### GET /api/fee-types

- **Auth:** admin JWT (student JWT may read for display of what they owe)
- **Purpose:** List active fee templates for the org.
- **Query params:** `?status=ACTIVE` · `?fiscal_year=2024/2025`
- **Success — 200 OK:**
  ```json
  {
    "data": [
      { "id": "ft-001", "name": "Faculty Due", "amount_naira": 500000, "is_clearance_required": true, "status": "ACTIVE" },
      { "id": "ft-002", "name": "Lab Fee", "amount_naira": 200000, "is_clearance_required": false, "status": "ACTIVE" }
    ]
  }
  ```
- **Errors:** `401`/`403`.
- **Notes:** Small set; no pagination required (filtered by org).

### GET /api/fee-types/:id — **[added]**

- **Auth:** admin JWT
- **Purpose:** Fetch a single fee template (detail view / before edit).
- **Path params:** `id` — fee type UUID.
- **Success — 200 OK:** single fee-type object (same fields as list item + `description`, `fiscal_year`, `version`, `effective_from/to`).
- **Errors:** `401`/`403`/`404`.
- **Justification:** Standard REST detail companion to the list; the admin "edit fee" UI needs to load current values. Cheap and consistent.

### PATCH /api/fee-types/:id — **[added]**

- **Auth:** admin JWT
- **Purpose:** Change a fee (creates a new `version`; old version preserved) or archive it.
- **Path params:** `id` — fee type UUID.
- **Request body (optional):**
  ```json
  { "amount_naira": 600000, "is_clearance_required": true, "status": "ARCHIVED" }
  ```
- **Success — 200 OK:** the new active fee-type version (`version` incremented).
- **Errors:** `400` invalid amount · `401`/`403`/`404`.
- **Justification:** Database_Schema mandates version tracking ("don't edit v1, create v2") and lifecycle `status: ACTIVE → ARCHIVED`. Without this endpoint the documented versioning design is unreachable. This is template metadata management, not the Phase-2 rules engine.

### POST /api/students/:id/fees — **[added]**

- **Auth:** admin JWT
- **Purpose:** Assign a fee type to a student (creates a `student_fees` row from the template).
- **Path params:** `id` — student UUID.
- **Request body:**
  ```json
  { "fee_type_id": "ft-001", "due_date": "2026-06-30" }
  ```
  Optional override: `"amount_due": 500000` (Kobo, int) — defaults to the fee type's amount.
- **Success — 201 Created:**
  ```json
  { "id": "sf-45-001", "student_id": "student-45", "fee_type_id": "ft-001", "amount_due": 500000, "amount_paid": 0, "amount_balance": 500000, "status": "UNPAID", "due_date": "2026-06-30" }
  ```
- **Errors:** `400` unknown fee_type · `401`/`403` · `404` student not found · `409` student already has this fee (`UNIQUE(student_id, fee_type_id)`).
- **Justification:** Reconciliation has nothing to allocate against unless fees are assigned to students. `API_Spec.md` documents reading student fees but no write path to create them — this is a hard prerequisite for the core demo (assign fees → receive payment → reconcile). Single-fee assignment only; bulk/rules-based assignment is Phase 2.

---

## 6. Student Fees

What each student owes. Read endpoints; writes happen via fee assignment (§5) and reconciliation (§7/§8).

### GET /api/students/:id/fees

- **Auth:** admin JWT, **or** student JWT where `sub == :id`
- **Purpose:** List a student's fee assignments with balances and totals.
- **Path params:** `id` — student UUID.
- **Success — 200 OK:**
  ```json
  {
    "student_id": "student-45",
    "fees": [
      { "id": "sf-45-001", "fee_type": "Faculty Due", "amount_due": 500000, "amount_paid": 300000, "amount_balance": 200000, "status": "PARTIALLY_PAID", "is_clearance_required": true, "due_date": "2026-06-30" },
      { "id": "sf-45-002", "fee_type": "Lab Fee", "amount_due": 200000, "amount_paid": 0, "amount_balance": 200000, "status": "UNPAID", "is_clearance_required": false }
    ],
    "total_owed": 400000,
    "total_paid": 300000
  }
  ```
- **Errors:** `401` · `403` cross-student access · `404`.
- **Notes:** All amounts Kobo (int). `amount_balance` is DB-generated.

### PATCH /api/student-fees/:id — **[added]**

- **Auth:** admin JWT
- **Purpose:** Flag/unflag a fee as disputed, or edit `due_date`/`notes` (manual reconciliation support).
- **Path params:** `id` — student_fee UUID.
- **Request body (optional):**
  ```json
  { "is_disputed": true, "dispute_reason": "Student claims prior payment", "due_date": "2026-08-01" }
  ```
- **Success — 200 OK:** updated student-fee object.
- **Errors:** `400` · `401`/`403`/`404`.
- **Justification:** Edge_Cases and Database_Schema include `is_disputed`/`dispute_reason` columns and the MVP scope says "duplicate payment detection (manual flag instead)". This endpoint is that manual flag. Amounts are not editable here (only via assignment/reconciliation) to protect the ledger.

---

## 7. Payments

Payment records originate from the Nomba webhook (§8). These endpoints are read-only history + the manual-review queue.

### GET /api/payments/:student_id

- **Auth:** admin JWT, **or** student JWT where `sub == :student_id`
- **Purpose:** Paginated payment history for a student, with allocations and receipt links.
- **Path params:** `student_id` — student UUID.
- **Query params:** `?page=1` · `?limit=20` · `?sort=created_at` · `?order=DESC`
- **Success — 200 OK:**
  ```json
  {
    "data": [
      {
        "id": "payment-12345",
        "amount_naira": 750000,
        "nomba_transaction_id": "TXN_ABC123XYZ",
        "sender_name": "Adeyemi John",
        "status": "SUCCESS",
        "reconciliation_status": "RECONCILED",
        "created_at": "2026-07-01T14:30:00Z",
        "receipt_url": "https://feeflow.io/receipts/payment-12345.pdf",
        "allocations": [
          { "fee_type": "Faculty Due", "amount": 500000 },
          { "fee_type": "Lab Fee", "amount": 200000 },
          { "fee_type": "Clearance Fee", "amount": 50000 }
        ]
      }
    ],
    "pagination": { "total": 5, "page": 1, "limit": 20, "offset": 0 }
  }
  ```
- **Errors:** `401` · `403` cross-student access · `404`.
- **Notes:** `amount_naira` and `allocations[].amount` are Kobo (int).

### GET /api/payments/orphaned — **[added]**

- **Auth:** admin JWT
- **Purpose:** List payments that arrived but could not be matched to a virtual account / student (manual-review queue).
- **Query params:** `?page=1` · `?limit=20`
- **Success — 200 OK:**
  ```json
  {
    "data": [
      { "id": "payment-orphan-9", "account_number": "1099999999", "amount_naira": 500000, "nomba_transaction_id": "TXN_ORPH_1", "sender_name": "Unknown Sender", "reconciliation_status": "UNRECONCILED", "created_at": "2026-07-01T14:31:00Z" }
    ],
    "pagination": { "total": 3, "page": 1, "limit": 20, "offset": 0 }
  }
  ```
- **Errors:** `401`/`403`.
- **Justification:** Reconcilation_Flow and Edge_Cases require storing "misdirected"/orphaned payments for manual review — a directly judged edge case ("handles misdirected payments"). The admin needs a way to surface and resolve them. Resolution re-uses the reconcile RPC once an account is identified; no separate write endpoint is added for MVP (flag-and-review only).

### POST /api/receipts/:payment_id/resend — **[added]**

- **Auth:** admin JWT, **or** student JWT owning the payment
- **Purpose:** Re-queue the receipt email for a payment (when the original send failed or the student didn't receive it).
- **Path params:** `payment_id` — payment UUID.
- **Success — 202 Accepted:**
  ```json
  { "success": true, "message": "Receipt re-queued", "payment_id": "payment-12345" }
  ```
- **Errors:** `401`/`403`/`404`.
- **Justification:** Receipts are a stated MVP deliverable and CLAUDE.md gotcha #6 warns email frequently lands in spam. A resend path is the minimal operational fix and avoids re-triggering reconciliation. The receipt PDF itself is served via the `receipt_url` (Supabase Storage) already returned in payment objects — no separate download endpoint is added.

---

## 8. Webhooks (Nomba)

The reconciliation entry point. This is the most important endpoint for the judged "reconciliation accuracy" criterion. Implemented at `apps/backend/src/webhooks/` (controller enqueues to a BullMQ `payment-reconciliation` queue; `WebhooksService.processPayment` does the allocation; in the canonical design the allocation runs inside the Postgres `reconcile_payment()` RPC for atomicity).

### POST /api/webhooks/nomba

- **Auth:** **Nomba signature** — `x-nomba-signature` header, HMAC-SHA256 of the **raw request body** keyed by the org's `nomba_webhook_secret`. No JWT.
- **Purpose:** Receive a Nomba transfer-received event, identify the student by destination account, allocate funds to outstanding fees, recalculate clearance, and emit a receipt.
- **Request headers:**
  ```
  Content-Type: application/json
  x-nomba-signature: <HMAC-SHA256 hex digest of raw body>
  ```
- **Request body** (canonical Nomba envelope per `API_Spec.md`):
  ```json
  {
    "event": "transfer.received",
    "data": {
      "amount": 750000,
      "destinationAccountNumber": "1023456789",
      "transactionReference": "TXN_ABC123XYZ",
      "senderName": "Adeyemi John",
      "senderAccount": "1234567890",
      "narration": "Payment",
      "timestamp": "2026-07-01T14:30:00Z"
    }
  }
  ```
  > Field-name note: the current controller also accepts a flattened shape (`transactionId`, `amount`, `accountNumber`, `orderReference`, `senderName`, `senderAccount`). `transactionReference`/`transactionId` is the idempotency key. `amount` is Kobo (int).
- **Success — 200 OK** (reconciled):
  ```json
  {
    "reconciled": true,
    "student_id": "student-45",
    "payment_id": "payment-12345",
    "amount_allocated": 700000,
    "amount_credit": 50000,
    "fees_updated": 2,
    "clearance_status": { "is_cleared": true, "cleared_at": "2026-07-01T14:30:00Z" }
  }
  ```
- **Success — 200 OK** (handled-but-not-allocated; still 200 so Nomba stops retrying):
  - Duplicate: `{ "reconciled": false, "reason": "Duplicate payment", "payment_id": "payment-12345" }`
  - Orphaned account: `{ "reconciled": false, "reason": "Virtual account not found", "action": "Stored for manual review" }`
  - No outstanding fees: `{ "reconciled": false, "reason": "No outstanding fees", "action": "Stored as credit" }`
  - Ignored event type: `{ "ignored": true, "reason": "Not a transfer event" }`
- **Error responses:**
  - `401 Unauthorized` — missing or invalid HMAC signature (rejected before any DB work; logged as a security event).
  - `400 Bad Request` — payload missing `amount` / `destinationAccountNumber` / `transactionReference`, or non-positive amount.
  - `500 Internal Server Error` — **transient** failure only (DB connection drop, RPC error). Signals Nomba to retry.
- **Notes (critical):**
  - **Idempotency:** keyed on `nomba_transaction_id`. Enforced two ways: (1) BullMQ `jobId = transactionId` dedupes at enqueue; (2) Postgres `UNIQUE(org_id, nomba_transaction_id)` on `payments` and a pre-insert existence check. A duplicate returns **200** with the existing `payment_id` — never a 4xx — so Nomba's retry loop terminates.
  - **Retry contract:** FeeFlow returns **non-2xx (5xx) ONLY for transient failures** it wants Nomba to retry. Permanent conditions (duplicate, orphan, no-fees, bad event) return **200** because retrying would not help. Nomba retries up to 5× with exponential backoff; duplicates are absorbed idempotently.
  - **Atomicity:** allocation + fee updates + payment row + allocations + clearance run inside the `reconcile_payment()` Postgres RPC (a single transaction), preventing race conditions on concurrent payments to the same student (`SELECT ... FOR UPDATE`).
  - **Allocation order:** clearance-required fees first, then oldest `created_at` (see Reconcilation_Flow). Overpayment overflow → `students.credit_balance`.
  - Receipt PDF + email are queued **after** the transaction commits (non-blocking; failures don't roll back the payment).

### POST /api/webhooks/nomba/test — **[added]**

- **Auth:** admin JWT
- **Purpose:** Developer/demo helper that injects a simulated `transfer.received` event into the reconciliation pipeline (skips signature check; only enabled in non-production).
- **Request body:** same `data` shape as the real webhook, plus the target `account_number`.
- **Success — 200 OK:** same response envelope as the real webhook.
- **Errors:** `400` invalid body · `401`/`403` · `404` account not found · `503` disabled in production.
- **Justification:** The demo must show "payment arrives → reconcile → clearance" live without a real Nomba transfer. CLAUDE.md explicitly relies on simulating payments for the demo. Strictly disabled when `NODE_ENV=production`.

---

## 9. Clearance

A student is CLEARED when all `is_clearance_required` fees are `PAID`. Status is denormalized into `clearance_status` and recalculated on every payment.

### GET /api/clearance/:student_id

- **Auth:** admin JWT, **or** student JWT where `sub == :student_id`
- **Purpose:** Return clearance status with the required/optional fee breakdown and certificate link.
- **Path params:** `student_id` — student UUID.
- **Success — 200 OK:**
  ```json
  {
    "student_id": "student-45",
    "is_cleared": true,
    "cleared_at": "2026-07-01T14:30:00Z",
    "clearance_certificate_url": "https://feeflow.io/certificates/student-45.pdf",
    "required_fees": [
      { "fee_type": "Faculty Due", "status": "PAID", "amount_due": 500000, "amount_paid": 500000 },
      { "fee_type": "Clearance Fee", "status": "PAID", "amount_due": 50000, "amount_paid": 50000 }
    ],
    "optional_fees": [
      { "fee_type": "Lab Fee", "status": "UNPAID", "amount_due": 200000, "amount_paid": 0 }
    ]
  }
  ```
- **Errors:** `401` · `403` cross-student access · `404`.
- **Notes:** `clearance_certificate_url` present only when `is_cleared = true`. Amounts Kobo (int).

### POST /api/admin/clearance/:student_id/recalculate

- **Auth:** admin JWT
- **Purpose:** Force a clearance recalculation for a student (debugging / after a manual fee fix).
- **Path params:** `student_id` — student UUID.
- **Success — 200 OK:**
  ```json
  { "student_id": "student-45", "is_cleared": false, "last_calculated_at": "2026-07-01T15:10:00Z" }
  ```
- **Errors:** `401`/`403`/`404`.
- **Notes:** Documented in Reconcilation_Flow. Invokes the `calculate_clearance()` RPC. Idempotent.

---

## 10. Reports

Admin analytics for the dashboard. JSON by default; CSV export via `?format=CSV`.

### GET /api/debtors

- **Auth:** admin JWT
- **Purpose:** List students with outstanding balances + an aggregate summary.
- **Query params:** `?department=Computer%20Science` · `?sort=amount_owed` · `?order=DESC` · `?page=1` · `?limit=50`
- **Success — 200 OK:**
  ```json
  {
    "data": [
      {
        "student_id": "student-87",
        "matric_number": "CSC/2024/087",
        "first_name": "Adebayo",
        "last_name": "Oluwumi",
        "total_owed": 700000,
        "oldest_fee_days_overdue": 45,
        "fees": [
          { "fee_type": "Faculty Due", "amount_owed": 500000, "status": "PARTIALLY_PAID" },
          { "fee_type": "Lab Fee", "amount_owed": 200000, "status": "UNPAID" }
        ]
      }
    ],
    "pagination": { "total": 15, "page": 1, "limit": 50, "offset": 0 },
    "summary": { "total_outstanding": 10500000, "students_owing": 15, "average_debt_per_student": 700000 }
  }
  ```
- **Errors:** `401`/`403`.
- **Notes:** All amounts Kobo (int). Paginated.

### GET /api/reports/collection

- **Auth:** admin JWT
- **Purpose:** Revenue/collection report (totals, by fee type, by department, monthly breakdown).
- **Query params:** `?fiscal_year=2024/2025` · `?department=Computer%20Science` · `?format=JSON|CSV`
- **Success — 200 OK (JSON):**
  ```json
  {
    "report_date": "2026-07-01T15:00:00Z",
    "period": "2024/2025",
    "institution": "Obafemi Awolowo University",
    "summary": { "total_revenue": 50000000, "total_students": 500, "students_cleared": 450, "students_owing": 50, "collection_rate": 95.2 },
    "by_fee_type": [ { "fee_type": "Faculty Due", "amount_expected": 250000000, "amount_collected": 237500000, "collection_rate": 95 } ],
    "by_department": [ { "department": "Computer Science", "students": 500, "collected": 47500000, "collection_rate": 95 } ],
    "monthly_breakdown": [ { "month": "2026-06", "collected": 2500000, "transactions": 150 } ]
  }
  ```
- **Success — 200 OK (CSV):** `?format=CSV` returns a `text/csv` attachment.
- **Errors:** `401`/`403`.
- **Notes:** `total_*`, `amount_*`, `collected` are Kobo (int). `collection_rate` is a percentage (not money).

### GET /api/reports/students

- **Auth:** admin JWT
- **Purpose:** Export the student roster with balance + clearance flag (CSV).
- **Query params:** `?department=...` · `?status=...` · `?format=CSV` (default CSV)
- **Success — 200 OK (CSV):**
  ```
  matric_number,first_name,last_name,email,department,status,total_owed,is_cleared
  CSC/2024/001,Chioma,Adeyemi,chioma@...,Computer Science,ACTIVE,0,true
  CSC/2024/002,Adebayo,Oluwumi,adebayo@...,Computer Science,ACTIVE,700000,false
  ```
- **Errors:** `401`/`403`.
- **Notes:** `total_owed` in Kobo (int).

---

## 11. Refunds (basic flag only — MVP)

> **Scope note:** Per CLAUDE.md, full refund *processing* (Nomba payout, approval workflow) is Phase 2. The MVP keeps overpayments as `credit_balance` and lets an admin *flag* a refund request for manual handling. The two endpoints below match `API_Spec.md` but are intentionally thin: they record intent and status; they do **not** move money via Nomba in the MVP.

### POST /api/refunds

- **Auth:** admin JWT (student-initiated requests go through an admin in MVP)
- **Purpose:** Record a refund request (flag for manual review).
- **Request body:**
  ```json
  { "payment_id": "payment-12345", "amount_requested": 100000, "reason": "Overpayment" }
  ```
  `amount_requested` is Kobo (int).
- **Success — 201 Created:**
  ```json
  { "id": "refund-001", "payment_id": "payment-12345", "amount_requested": 100000, "status": "REQUESTED", "requested_at": "2026-07-01T15:00:00Z", "message": "Refund request submitted. Finance officer will review." }
  ```
- **Errors:** `400` · `401`/`403` · `404` payment not found.

### PATCH /api/refunds/:id

- **Auth:** admin JWT
- **Purpose:** Approve/reject a refund request (status flag only — no Nomba payout in MVP).
- **Path params:** `id` — refund UUID.
- **Request body:**
  ```json
  { "status": "APPROVED", "amount_approved": 100000, "notes": "Approved by finance officer" }
  ```
- **Success — 200 OK:**
  ```json
  { "id": "refund-001", "status": "APPROVED", "amount_approved": 100000, "approved_at": "2026-07-01T15:30:00Z", "approved_by_email": "finance@oau.edu.ng", "message": "Refund approved. Manual processing required." }
  ```
- **Errors:** `400` invalid status transition · `401`/`403`/`404`.

---

## 12. Health

### GET /api/health — **[added]**

- **Auth:** public
- **Purpose:** Liveness/readiness probe (DB + Redis reachability) for Vercel/Railway and uptime checks.
- **Success — 200 OK:**
  ```json
  { "status": "ok", "uptime": 12345, "db": "up", "redis": "up", "timestamp": "2026-07-01T15:00:00Z" }
  ```
- **Errors:** `503 Service Unavailable` — a dependency is down.
- **Justification:** CLAUDE.md notes Vercel/Railway cold starts and the need to document availability; a health endpoint is required for deploy probes and demo-day monitoring. The existing `GET /` returns a hello string and should be superseded by this. Trivial.

---

## Summary Table

| Method | Path | Auth | Resource |
|--------|------|------|----------|
| POST | /api/auth/login | public | Auth |
| POST | /api/auth/verify-otp | public | Auth |
| POST | /api/auth/logout | admin/student JWT | Auth |
| GET | /api/auth/me **[added]** | admin/student JWT | Auth |
| POST | /api/institutions | public (platform key) | Organizations |
| GET | /api/institutions/:id | admin JWT | Organizations |
| PATCH | /api/institutions/:id **[added]** | admin JWT | Organizations |
| POST | /api/students | admin JWT | Students |
| GET | /api/students | admin JWT | Students |
| GET | /api/students/:id | admin / owner student JWT | Students |
| PATCH | /api/students/:id | admin JWT | Students |
| POST | /api/students/bulk-import | admin JWT | Students |
| GET | /api/students/:id/virtual-account **[added]** | admin / owner student JWT | Virtual Accounts |
| POST | /api/students/:id/virtual-account/retry **[added]** | admin JWT | Virtual Accounts |
| POST | /api/fee-types | admin JWT | Fee Types |
| GET | /api/fee-types | admin JWT (student read) | Fee Types |
| GET | /api/fee-types/:id **[added]** | admin JWT | Fee Types |
| PATCH | /api/fee-types/:id **[added]** | admin JWT | Fee Types |
| POST | /api/students/:id/fees **[added]** | admin JWT | Fee Types / Student Fees |
| GET | /api/students/:id/fees | admin / owner student JWT | Student Fees |
| PATCH | /api/student-fees/:id **[added]** | admin JWT | Student Fees |
| GET | /api/payments/:student_id | admin / owner student JWT | Payments |
| GET | /api/payments/orphaned **[added]** | admin JWT | Payments |
| POST | /api/receipts/:payment_id/resend **[added]** | admin / owner student JWT | Payments |
| POST | /api/webhooks/nomba | Nomba signature | Webhooks |
| POST | /api/webhooks/nomba/test **[added]** | admin JWT (non-prod) | Webhooks |
| GET | /api/clearance/:student_id | admin / owner student JWT | Clearance |
| POST | /api/admin/clearance/:student_id/recalculate | admin JWT | Clearance |
| GET | /api/debtors | admin JWT | Reports |
| GET | /api/reports/collection | admin JWT | Reports |
| GET | /api/reports/students | admin JWT | Reports |
| POST | /api/refunds | admin JWT | Refunds (flag only) |
| PATCH | /api/refunds/:id | admin JWT | Refunds (flag only) |
| GET | /api/health **[added]** | public | Health |

**Total: 33 endpoints across 12 resource groups.**
