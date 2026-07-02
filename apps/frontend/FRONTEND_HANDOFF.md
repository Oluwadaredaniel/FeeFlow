# Frontend Handoff Spec: FeeFlow

**Version:** 1.0
**Audience:** Frontend Developer
**Status:** Build-ready (Hackathon MVP)
**Stack:** Next.js 14 (App Router, `src/app`), TypeScript, Tailwind, shadcn/ui, Supabase Auth (email OTP)
**Backend:** NestJS API at `process.env.NEXT_PUBLIC_API_URL` (dev: `http://localhost:3001`)

---

## 0. Read This First (Conventions)

### Two roles only (MVP)
The Product Spec defines 5 roles (Student, Department Exec, Faculty Exec, Finance Officer, Super Admin). **For the hackathon we ship TWO:**

| Build Role | Maps to spec roles | What they do |
|------------|--------------------|--------------|
| **ADMIN** | Finance Officer + Department/Faculty Exec (merged) | Manage students, fees, view revenue/debtors/transactions, reports, refunds, webhook config |
| **STUDENT** | Student | View own virtual account, fees, payment/clearance status, receipts |

`role` comes from the auth response (`user.role` is `"STUDENT"` or `"ADMIN"`). Super Admin / multi-institution onboarding is **Phase 2** — institution is hardcoded to OAU for build week (per CLAUDE.md). One admin login screen, one student experience.

> **Judgment call:** `POST /api/institutions` (Create Institution) is Super-Admin-only and out of MVP scope. We do **not** build an onboarding wizard UI for it. The Admin "Settings" page reads `GET /api/institutions/:id` to show the (single, hardcoded) institution and its webhook config. See §3.11.

### Money = Kobo (integer)
Every monetary field from the API (`amount_naira`, `amount_due`, `amount_paid`, `amount_balance`, `total_owed`, `credit_balance`, `allocated_amount`, etc.) is an **integer in Kobo**. Divide by 100 and format as Naira for display. Use the `formatNaira()` util (§2.5). Never do float math on these — only divide-by-100 at the render boundary.

```
500000 (Kobo)  →  ₦5,000.00
50     (Kobo)  →  ₦0.50
0      (Kobo)  →  ₦0.00
```

### Auth & requests
- Login is Supabase email OTP via the backend (`POST /api/auth/login` → `POST /api/auth/verify-otp`).
- `verify-otp` returns `{ token, user: { id, email, org_id, role } }`. Persist `token` + `user` (httpOnly cookie preferred; localStorage acceptable for hackathon).
- Every authed request sends `Authorization: Bearer ${token}`.
- All requests go to `NEXT_PUBLIC_API_URL` via the `api()` client (§2.4). On `401`, clear session and redirect to the correct login.

### Status enums (from DB schema — drive the StatusBadge component)
- **Student fee status:** `UNPAID` | `PARTIALLY_PAID` | `PAID`
- **Student status:** `ACTIVE` | `DEFERRED` | `GRADUATED` | `INACTIVE`
- **Payment status:** `SUCCESS` | `FAILED` | `PENDING`
- **Reconciliation status:** `UNRECONCILED` | `RECONCILED` | `DISPUTED`
- **Clearance:** `is_cleared` boolean → display `CLEARED` / `NOT CLEARED`
- **Refund status:** `REQUESTED` | `APPROVED` | `REJECTED` | `PROCESSED` | `FAILED`

### Global state rules (every page)
- **Loading:** skeleton (cards/rows), never a blank screen. Disable submit buttons + show spinner during mutations.
- **Empty:** dedicated empty-state block (icon + headline + subtext + CTA). Exact copy in §6.
- **Error:** inline error card with the API `message` if present, plus a **Retry** button. Toasts (`sonner`) for action failures, inline cards for page-load failures.

---

## 1. App Structure (Route Tree)

```
src/app/
├── layout.tsx                      # Root layout: fonts, <Toaster/> (sonner), providers
├── page.tsx                        # Landing / marketing page (public) → "See Live Demo" CTAs to /login
├── globals.css
│
├── (auth)/                         # PUBLIC — no sidebar/topbar
│   ├── layout.tsx                  # Centered card layout, FeeFlow logo
│   ├── login/
│   │   └── page.tsx                # Admin login (email → OTP)  [ADMIN]
│   ├── student-login/
│   │   └── page.tsx                # Student login (email → OTP) [STUDENT]
│   └── verify/
│       └── page.tsx                # (optional) OTP entry step if not inline; ?email=&role=
│
├── (dashboard)/                    # ADMIN — RoleGuard role="ADMIN"
│   ├── layout.tsx                  # Sidebar + Topbar (admin nav)
│   ├── dashboard/
│   │   └── page.tsx                # Overview / metrics
│   ├── students/
│   │   ├── page.tsx                # Students list (search, filter, paginate)
│   │   ├── import/
│   │   │   └── page.tsx            # Bulk CSV import
│   │   └── [id]/
│   │       └── page.tsx            # Student detail (fees, payments, clearance, status)
│   ├── fees/
│   │   ├── page.tsx                # Fee types list
│   │   └── new/
│   │       └── page.tsx            # Create fee type (can be a dialog instead — see §3.6)
│   ├── transactions/
│   │   └── page.tsx                # Payments / transaction log
│   ├── debtors/
│   │   └── page.tsx                # Debtors report
│   ├── clearance/
│   │   └── page.tsx                # Clearance overview (cleared vs not)
│   ├── reports/
│   │   └── page.tsx                # Reports + CSV export
│   └── settings/
│       └── page.tsx                # Institution + webhook config (read-mostly)
│
└── (student)/                      # STUDENT — RoleGuard role="STUDENT"
    ├── layout.tsx                  # Student topbar (lighter chrome, no admin sidebar)
    ├── me/
    │   └── page.tsx                # Student dashboard (virtual account + balance + clearance)
    ├── fees/
    │   └── page.tsx                # My fees (detailed, progress bars)
    ├── clearance/
    │   └── page.tsx                # Payment/clearance status + certificate
    └── receipts/
        ├── page.tsx                # Receipts list
        └── [paymentId]/
            └── page.tsx            # Receipt detail / viewer
```

> **Route-group note:** `(auth)`, `(dashboard)`, `(student)` are Next.js route groups — the parentheses do **not** appear in the URL. So `(dashboard)/students/page.tsx` serves `/students`, and `(student)/me/page.tsx` serves `/me`. Admin and student routes therefore share the URL namespace; the `RoleGuard` in each group's `layout.tsx` enforces access. Where names would collide (`/fees`, `/clearance` exist in both groups) the guard + the user's role decide which renders — but **a student never has an admin token and vice-versa**, so only one group's layout will ever authorize. If you prefer zero ambiguity, prefix student routes (e.g. `(student)/student/...`); documented here unprefixed to match the spec's mental model.

**Page count:** 6 admin nav pages + 4 admin sub-pages (import, student detail, fee new) + Settings + Dashboard = **11 admin pages**; **6 student pages**; **3 auth pages**. Total **~20 routes**.

---

## 2. Shared Components & Layout

Build these once in `src/components/`. Everything below is consumed by the pages in §3–4.

### 2.1 `RoleGuard` — `src/components/auth/role-guard.tsx`
- Props: `{ role: "ADMIN" | "STUDENT"; children }`.
- Reads session (token + user). If no session → redirect to the matching login (`/login` for ADMIN, `/student-login` for STUDENT). If `user.role !== role` → redirect to that role's home (`/dashboard` or `/me`).
- While resolving session: render full-page skeleton (not a flash of content).
- Used inside `(dashboard)/layout.tsx` and `(student)/layout.tsx`.

### 2.2 `Sidebar` — `src/components/layout/sidebar.tsx` (ADMIN only)
- Nav items (icon + label, active-route highlight):
  Dashboard `/dashboard` · Students `/students` · Fees `/fees` · Transactions `/transactions` · Debtors `/debtors` · Clearance `/clearance` · Reports `/reports` · Settings `/settings`.
- Collapsible on mobile (sheet/drawer). Footer: institution name + logout.

### 2.3 `Topbar` — `src/components/layout/topbar.tsx`
- Left: page title / breadcrumb. Right: institution name (admin) OR student name+matric (student), avatar menu with **Logout** (`POST /api/auth/logout` → clear session → redirect to login).
- Student variant exposes nav links (Dashboard `/me`, My Fees `/fees`, Clearance `/clearance`, Receipts `/receipts`) since students have no sidebar.

### 2.4 `api()` client — `src/lib/api.ts`
- Thin `fetch` wrapper. Reads `NEXT_PUBLIC_API_URL`, injects `Authorization: Bearer <token>`, sets `Content-Type: application/json` (skip for multipart uploads).
- Parses JSON; on non-2xx throws an `ApiError` carrying `{ status_code, error, message, request_id }` (matches the standard error shape in API_Spec §Error Handling).
- Centralized `401` handling → clears session, redirects to login.
- Helpers: `api.get(path)`, `api.post(path, body)`, `api.patch(path, body)`, `api.upload(path, formData)`.

### 2.5 `formatNaira()` + money utils — `src/lib/money.ts`
```ts
// Kobo (int) → "₦5,000.00"
export const formatNaira = (kobo: number) =>
  "₦" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Kobo → "₦5,000" (no decimals, for compact tables/cards)
export const formatNairaShort = (kobo: number) =>
  "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
// percent paid for a fee (guard divide-by-zero)
export const percentPaid = (paid: number, due: number) => (due === 0 ? 100 : Math.round((paid / due) * 100));
```

### 2.6 `StatusBadge` — `src/components/ui-ext/status-badge.tsx`
- Wraps shadcn `badge`. Prop `status: string`. Color map:
  - `PAID` / `RECONCILED` / `SUCCESS` / `CLEARED` / `APPROVED` / `PROCESSED` → green
  - `PARTIALLY_PAID` / `PENDING` / `REQUESTED` / `UNRECONCILED` → amber
  - `UNPAID` / `FAILED` / `REJECTED` / `NOT CLEARED` / `DISPUTED` → red
  - `ACTIVE` → green · `DEFERRED` → amber · `GRADUATED` → blue · `INACTIVE` → gray
- Accepts a `boolean` overload for clearance (`true`→CLEARED green, `false`→NOT CLEARED red).

### 2.7 `DataTable` — `src/components/ui-ext/data-table.tsx`
- Generic table on shadcn `table`. Props: `columns`, `rows`, `loading`, `emptyState`, optional `onRowClick`, `pagination` (`{ total, limit, offset, onPage }`).
- Renders skeleton rows when `loading`, the supplied `emptyState` block when `rows.length === 0`, and a footer pager when `pagination` provided. Used by students/transactions/debtors/fees/clearance lists.

### 2.8 `EmptyState` — `src/components/ui-ext/empty-state.tsx`
- Props: `{ icon, title, description, action? }`. Centered block. The single source for all empty screens in §6.

### 2.9 `MoneyStat` / `StatCard` — `src/components/ui-ext/stat-card.tsx`
- shadcn `card` with a big number + label + optional sub-line / trend. Used across admin dashboard & summaries. Pass already-formatted strings.

### 2.10 `ProgressBar` — `src/components/ui-ext/progress-bar.tsx`
- Custom (shadcn `progress` not in the installed set). Prop `value` (0–100). Used on fee rows to show `% paid`.

### 2.11 `CopyField` — `src/components/ui-ext/copy-field.tsx`
- Read-only field + copy-to-clipboard button (toast "Copied"). **Critical** for the student virtual-account number (the whole product hinges on the student sharing this number).

### 2.12 `ReceiptViewer` — `src/components/ui-ext/receipt-viewer.tsx`
- Renders a receipt: header (institution/logo), student block, txn details, **allocations table** (fee → amount via `formatNaira`), totals, clearance line, payer block.
- Data source: a single payment object from `GET /api/payments/:student_id` (has `allocations`, `receipt_url`, `sender_name`, etc.).
- Actions: **Download PDF** (open `receipt_url` in new tab) and **Print**. If `receipt_url` is null/empty, show "Receipt PDF is still generating — refresh in a moment" and keep the on-screen rendered version available.

### 2.13 `OtpForm` — `src/components/auth/otp-form.tsx`
- Two-step inline form: (1) email input → `POST /api/auth/login`; (2) 6-digit OTP input → `POST /api/auth/verify-otp`. Shared by both login pages; takes a `role` prop only to decide post-login redirect (`/dashboard` vs `/me`). Resend OTP throttled (button disabled 30s; backend also rate-limits at 5/min → handle `429`).

### 2.14 `ConfirmDialog` — `src/components/ui-ext/confirm-dialog.tsx`
- shadcn `dialog` wrapper for destructive/important confirms (defer student, approve refund, archive fee). Props: `{ title, description, confirmLabel, onConfirm, loading }`.

---

## 3. ADMIN Pages

> Wrapped by `(dashboard)/layout.tsx` → `RoleGuard role="ADMIN"` + `Sidebar` + `Topbar`.

### 3.1 Admin Login — `app/(auth)/login/page.tsx`  [ADMIN]
**Purpose:** Authenticate an institution admin via email OTP.
**Sections / components:** FeeFlow logo, `OtpForm` (role=`ADMIN`), link "Are you a student? → /student-login".
**API calls:**
- On "Send code" submit → `POST /api/auth/login` `{ email }`.
- On "Verify" submit → `POST /api/auth/verify-otp` `{ email, otp }` → persist token+user → if `user.role !== "ADMIN"` show error toast "This portal is for administrators"; else redirect `/dashboard`.
- (Logout elsewhere → `POST /api/auth/logout`.)
**Loading:** Step buttons show spinner + disabled while awaiting.
**Empty:** n/a (form).
**Error:** `400` missing email → inline field error. `429` → toast "Too many attempts, wait a minute." `400/401` invalid OTP → inline "Invalid or expired code. Resend?"
**Primary actions:** Send code; Verify code; Resend code.

### 3.2 Admin Dashboard / Overview — `app/(dashboard)/dashboard/page.tsx`  [ADMIN]
**Purpose:** At-a-glance institution health: revenue, clearance, debtors, recent payments.
**Sections / components:**
- 4 `StatCard`s: **Total Revenue Collected**, **Students Cleared (x / total)**, **Total Outstanding**, **Collection Rate %**.
- **Clearance breakdown** (Cleared / Partially Paid / Not Cleared counts) — small bar or 3 mini-stats.
- **Recent Payments** table (last ~10): Date · Student (name/matric) · Amount · Status → row click to `/transactions` or student detail.
- **Top Debtors** preview (top 5) → "View all" → `/debtors`.
- Quick actions: "Add Student" → `/students` (open create dialog), "Create Fee" → `/fees/new`.
**API calls (on load, in parallel):**
- `GET /api/reports/collection?format=JSON` → summary (`total_revenue`, `students_cleared`, `students_owing`, `collection_rate`), `by_department`, `monthly_breakdown` (for an optional trend chart).
- `GET /api/debtors?sort=amount_owed&order=DESC&limit=5` → top debtors + `summary.total_outstanding`, `students_owing`.
- `GET /api/payments` recent — **see §5 note**: there is no list-all-payments endpoint in the spec; use the collection report's `monthly_breakdown` for revenue and pull recent payments from the transactions page source. **Judgment call:** treat "Recent Payments" as best-effort; if no all-payments endpoint exists yet, render the section from `monthly_breakdown` aggregates or hide it until backend exposes one. Flagged in §5.
**Loading:** StatCards → skeleton numbers; tables → skeleton rows.
**Empty:** Fresh institution (no data): EmptyState "No activity yet — Import your students to get started" + CTA "Import Students" → `/students/import`.
**Error:** Page-level error card with Retry (re-runs the parallel fetches).
**Primary actions:** navigate to deeper pages; quick-create student/fee.

### 3.3 Students List — `app/(dashboard)/students/page.tsx`  [ADMIN]
**Purpose:** Browse, search, filter, and create students.
**Sections / components:**
- Toolbar: search input (matric/name/email), status filter (`ACTIVE`/`DEFERRED`/`GRADUATED`/`INACTIVE`), department filter, **"Add Student"** button (opens create `dialog`), **"Import CSV"** → `/students/import`.
- `DataTable`: columns Matric · Name · Email · Department · Status (`StatusBadge`) · (optional) Owing · created_at. Row click → `/students/[id]`. Pagination footer (limit/offset).
- Create Student `dialog`: fields email, matric_number, first_name, last_name, department, faculty.
**API calls:**
- On load / filter / page change → `GET /api/students?status=ACTIVE&department=Computer%20Science&limit=20&offset=0`.
- Create submit → `POST /api/students` `{ email, matric_number, first_name, last_name, department, faculty }` → on `201` toast "Student created — virtual account 1023456789 assigned" (show returned `virtual_account.account_number`), close dialog, refetch list.
**Loading:** table skeleton; create button → spinner on submit.
**Empty:** EmptyState "No students yet — Add your first student or import a CSV" + dual CTA "Add Student" / "Import CSV". Filtered-empty variant: "No students match your filters" + "Clear filters".
**Error:** load error → table error row with Retry. Create `409` → field error "Email or matric already exists." `400` → field-level validation.
**Primary actions:** Search/filter; Add Student; Import; open detail.

### 3.4 Student Detail — `app/(dashboard)/students/[id]/page.tsx`  [ADMIN]
**Purpose:** Full single-student view: identity, virtual account, fees, payments, clearance, lifecycle actions.
**Sections / components:**
- **Header card:** name, matric, email, department/faculty, `StatusBadge(student.status)`, `CopyField` for `virtual_account.account_number` (+ bank), `credit_balance` (if > 0 show "₦X credit").
- **Clearance card:** `StatusBadge(clearance.is_cleared)`, `last_calculated_at`, required vs optional fee checklist.
- **Fees table:** Fee · Due · Paid · Balance · Status · `ProgressBar`. (`formatNaira` on all amounts.)
- **Payments table:** Date · Amount · Sender · Recon status · Receipt link.
- **Actions:** "Mark Deferred" / "Mark Graduated" (via `ConfirmDialog`).
**API calls (on load, parallel):**
- `GET /api/students/:id` → identity + `virtual_account` + `credit_balance` + embedded `fees` + `clearance_status`.
- `GET /api/students/:id/fees` → authoritative fee list (`total_owed`, `total_paid`).
- `GET /api/payments/:id` (student_id) → payment history + allocations + `receipt_url`.
- `GET /api/clearance/:id` → required/optional fee breakdown + `clearance_certificate_url`.
- On status change → `PATCH /api/students/:id` `{ status: "DEFERRED", date_deferred }` → toast + refetch.
**Loading:** each card/section skeletons independently.
**Empty:** No fees yet → "No fees assigned to this student yet" + CTA "Create a fee type" → `/fees/new`. No payments → "No payments received yet. Share the virtual account number to receive payment."
**Error:** per-section error with Retry; `404` (bad id) → "Student not found" + back to `/students`.
**Primary actions:** Copy virtual account; Defer/Graduate; open receipt.

### 3.5 Import Students — `app/(dashboard)/students/import/page.tsx`  [ADMIN]
**Purpose:** Bulk-create students from a CSV (each gets a virtual account + default fees server-side).
**Sections / components:** file dropzone (`.csv`), **format helper** showing required columns `email,matric_number,first_name,last_name,department`, downloadable sample CSV (static asset), "Upload" button, results panel (imported/failed counts + failure reasons if returned).
**API calls:**
- Upload submit → `POST /api/students/bulk-import` (`multipart/form-data`, field `file`) via `api.upload`. Response `{ imported, failed, message }`.
**Loading:** progress/spinner on the Upload button; disable dropzone during upload (uploads of 200 rows take time).
**Empty:** before file chosen → instructional state "Drop a CSV here or browse. Columns: email, matric_number, first_name, last_name, department."
**Error:** wrong file type → inline "Please upload a .csv file." `400` malformed CSV → show `message`. Partial success (`failed > 0`) → warning banner "X imported, Y failed" + list.
**Primary actions:** Choose file; Upload; "View students" → `/students` after success.

### 3.6 Fee Types List — `app/(dashboard)/fees/page.tsx`  [ADMIN]
**Purpose:** View all fee templates; entry point to create one.
**Sections / components:** "Create Fee" button (→ `/fees/new` or open dialog), `DataTable`: Name · Amount (`formatNaira(amount_naira)`) · Clearance Required (yes/no badge) · Status · (version). Note next to clearance-required: "Counts toward graduation clearance."
**API calls:** on load → `GET /api/fee-types`.
**Loading:** table skeleton.
**Empty:** EmptyState "No fee types yet — Create your first fee (e.g. Faculty Due ₦5,000)" + CTA "Create Fee".
**Error:** table error + Retry.
**Primary actions:** Create Fee; (view fee — read-only; **no edit** — DB schema says never edit a fee, create a new version, so omit edit in MVP).

### 3.7 Create Fee — `app/(dashboard)/fees/new/page.tsx` (or dialog)  [ADMIN]
**Purpose:** Define a fee template; backend auto-assigns to active students.
**Sections / components:** form — Name, Amount (input in **Naira**, convert to Kobo on submit: `Math.round(naira*100)`), Description, "Required for clearance?" checkbox, Fiscal Year (e.g. `2024/2025`). Helper text under Amount: "Students are charged this exact amount; you cannot edit a fee later (create a new one to change it)."
**API calls:**
- Submit → `POST /api/fee-types` `{ name, amount_naira, description, is_clearance_required, fiscal_year }` → `201` → toast "Fee created and assigned to active students" → redirect `/fees`.
**Loading:** submit spinner; disable form.
**Empty:** n/a.
**Error:** `400` validation → field errors. Amount must be a positive integer (Kobo) after conversion.
**Primary actions:** Create; Cancel → `/fees`.

### 3.8 Transactions / Payments Log — `app/(dashboard)/transactions/page.tsx`  [ADMIN]
**Purpose:** Institution-wide payment / reconciliation log.
**Sections / components:** filters (date range, recon status, search by transaction ref / matric), `DataTable`: Date · Student (matric) · Amount · Sender · `StatusBadge(status)` · `StatusBadge(reconciliation_status)` · Receipt link. Expandable row → allocations breakdown. Summary chips: total collected (period), # reconciled, # unreconciled/disputed.
**API calls:**
- **See §5 caveat:** the documented per-student endpoint is `GET /api/payments/:student_id`. There is **no documented institution-wide payments list**. **Judgment call:** assume backend adds `GET /api/payments?status=&limit=&offset=&search=` (consistent with the list+pagination pattern used by `/students`, `/debtors`). Build against that shape (`{ data:[...], pagination:{...} }`, same payment object as the per-student endpoint). If unavailable at integration time, fall back to drilling in from Student Detail. **Flagged in §5 + §7.**
**Loading:** table skeleton + summary skeletons.
**Empty:** EmptyState "No payments yet — Payments appear here automatically when students pay into their virtual accounts."
**Error:** table error + Retry.
**Primary actions:** Filter; expand allocations; open receipt; click through to student.

### 3.9 Debtors — `app/(dashboard)/debtors/page.tsx`  [ADMIN]
**Purpose:** Students with outstanding balances, sortable, exportable.
**Sections / components:** summary `StatCard`s (Total Outstanding, Students Owing, Avg Debt — from response `summary`). Department filter, sort by amount owed. `DataTable`: Matric · Name · Total Owed (`formatNaira`) · Days Overdue (`oldest_fee_days_overdue`) · expand → per-fee breakdown. "Export CSV" button.
**API calls:**
- On load / filter / sort → `GET /api/debtors?department=&sort=amount_owed&order=DESC&limit=50&offset=0`.
- Export → `GET /api/reports/students?format=CSV` (download) — **note:** spec's `/api/reports/students` returns CSV of all students with `total_owed`/`is_cleared`; filter client-side or pass query if backend supports. (Debtors-specific CSV not separately documented → reuse student report.)
**Loading:** stat + table skeletons.
**Empty:** EmptyState (celebratory) "No debtors — every student is fully paid up." (No CTA, or "View clearance" → `/clearance`.)
**Error:** table error + Retry.
**Primary actions:** Filter/sort; Export CSV; click row → student detail.

### 3.10 Clearance Overview — `app/(dashboard)/clearance/page.tsx`  [ADMIN]
**Purpose:** Institution clearance picture: who is cleared / not, drill to certificates.
**Sections / components:** 3 `StatCard`s (Cleared / Partially Paid / Not Cleared counts + %). Tabs or filter (All / Cleared / Not Cleared). `DataTable`: Matric · Name · Clearance (`StatusBadge` from boolean) · Required fees paid (x/y) · Cleared date → row click → student detail (which has the certificate link).
**API calls:**
- Summary from `GET /api/reports/collection?format=JSON` (`students_cleared`, `students_owing`, `total_students`).
- Listing: **Judgment call** — no dedicated "all clearance statuses" list endpoint is documented. Drive the list from `GET /api/students?limit=...` and read each student's embedded `clearance_status`, **or** assume `GET /api/students?cleared=false` filter. Cleanest within docs: list students and show their `clearance_status.is_cleared` (the Get-Student payload includes it; the List-Students payload does not — so either backend extends list, or we rely on the reports summary + per-student drilldown). **Flagged in §5.** For not-cleared specifics, `GET /api/debtors` is the reliable source (everyone owing is not cleared).
**Loading:** stat + table skeletons.
**Empty:** "No students to evaluate yet" + CTA "Import Students".
**Error:** error + Retry.
**Primary actions:** Filter by clearance; open student → download certificate.

### 3.11 Settings / Webhook Config — `app/(dashboard)/settings/page.tsx`  [ADMIN]
**Purpose:** Show institution identity + the Nomba webhook integration info admins must register (CLAUDE.md gotcha #1: register webhook URL with Nomba).
**Sections / components:**
- **Institution card:** name, slug, logo, status, `nomba_account_id` — read-only (`GET /api/institutions/:id`).
- **Webhook card:** `CopyField` for the webhook URL the institution must submit to Nomba — `${NEXT_PUBLIC_API_URL}/api/webhooks/nomba` — plus the **sub-account ID** to submit, plus a link to the Nomba webhook form (`https://forms.gle/hKfBRHZiTGvU7LC59`). Note: "Submit this URL + sub-account ID to Nomba so payments reach FeeFlow." `nomba_webhook_secret` is **never** displayed (secret).
- (Phase-2 placeholder, disabled: edit logo, manage admins.)
**API calls:** on load → `GET /api/institutions/:id` (`:id` = `user.org_id`).
**Loading:** card skeletons.
**Empty:** n/a (always one institution).
**Error:** error + Retry.
**Primary actions:** Copy webhook URL; Copy sub-account ID; open Nomba form.

---

## 4. STUDENT Pages

> Wrapped by `(student)/layout.tsx` → `RoleGuard role="STUDENT"` + student `Topbar`.
> The logged-in student's id = `user.id` (the `student-XX` id). All student calls use that id; the backend additionally enforces RLS so a student only ever sees their own data.

### 4.1 Student Login — `app/(auth)/student-login/page.tsx`  [STUDENT]
**Purpose:** Student authenticates via email OTP.
**Sections / components:** FeeFlow logo, `OtpForm` (role=`STUDENT`), helper "Use the email your institution registered." Link "Administrator? → /login".
**API calls:** `POST /api/auth/login` → `POST /api/auth/verify-otp` → if `user.role !== "STUDENT"` toast "Use the admin portal" else redirect `/me`.
**Loading / Error:** same as §3.1 (spinner; `429`; invalid OTP inline).
**Primary actions:** Send code; Verify; Resend.

### 4.2 Student Dashboard — `app/(student)/me/page.tsx`  [STUDENT]
**Purpose:** The hero screen — virtual account to pay into, total owed, clearance status.
**Sections / components:**
- **Virtual Account card (most prominent):** big account number via `CopyField`, bank name ("Nomba via Wema"), helper "Send your fees to this account from any bank. Payments are matched to you automatically." Account name.
- **Balance card:** Total Owed (`formatNaira(total_owed)`), Total Paid, `credit_balance` if > 0 ("You have ₦X credit, applied to future fees · Request refund").
- **Clearance card:** `StatusBadge(is_cleared)`; if not cleared: "You owe ₦X to be eligible for graduation"; if cleared: "Eligible for graduation" + Download Certificate.
- **Outstanding fees preview** (top 3) → "View all fees" → `/fees`.
- **Pay Now / How to pay** explainer (no payment widget — payment happens via bank transfer to the virtual account; reinforce the account number).
**API calls (on load, parallel):**
- `GET /api/students/:id` → virtual_account, credit_balance, embedded fees, clearance_status. (`:id` = `user.id`.)
- `GET /api/students/:id/fees` → `total_owed`, `total_paid`, fee list.
- `GET /api/clearance/:id` → cleared state + certificate url + required/optional.
**Loading:** card skeletons (keep the account-number card layout stable).
**Empty:** No fees assigned yet → "You have no fees yet. Your institution will assign them soon. Your account number is ready: <number>." (Still show the virtual account — it's always present.)
**Error:** error card + Retry. If `virtual_account` missing (edge: creation pending) → "Your payment account is being set up — check back shortly."
**Primary actions:** Copy account number; go to fees; download certificate; request refund (if credit).

### 4.3 My Fees — `app/(student)/fees/page.tsx`  [STUDENT]
**Purpose:** Detailed breakdown of every assigned fee and progress.
**Sections / components:** summary line (Total Owed / Total Paid). `DataTable` or card-list: Fee name · Amount Due · Paid · Balance · `StatusBadge` · `ProgressBar(percentPaid)` · clearance-required tag. Group/sort clearance-required first (mirrors allocation priority).
**API calls:** on load → `GET /api/students/:id/fees`.
**Loading:** list skeleton.
**Empty:** "No fees assigned yet — nothing to pay right now."
**Error:** error + Retry.
**Primary actions:** view; jump to receipts; copy account number (sticky CTA).

### 4.4 Payment / Clearance Status — `app/(student)/clearance/page.tsx`  [STUDENT]
**Purpose:** Show graduation-clearance progress and certificate.
**Sections / components:** big `StatusBadge(is_cleared)`. **Required fees checklist** (each with PAID/owing + amounts), **optional fees** listed separately ("don't affect clearance"). If cleared → prominent "Download Clearance Certificate" (`clearance_certificate_url`). If not → "You owe ₦X across N required fees" + "Pay into your virtual account" reminder (`CopyField`).
**API calls:** on load → `GET /api/clearance/:id` (`required_fees`, `optional_fees`, `is_cleared`, `cleared_at`, `clearance_certificate_url`).
**Loading:** skeleton.
**Empty:** No required fees configured → "No clearance requirements yet."
**Error:** error + Retry. If `is_cleared` true but `clearance_certificate_url` null → "Certificate generating — refresh shortly."
**Primary actions:** Download certificate; copy account number.

### 4.5 Receipts List — `app/(student)/receipts/page.tsx`  [STUDENT]
**Purpose:** All payment receipts the student can download/re-view.
**Sections / components:** `DataTable`: Date · Amount · Allocated to (fee summary / count) · `StatusBadge(status)` · Receipt (Download `receipt_url` / View → detail). Most recent first.
**API calls:** on load → `GET /api/payments/:id?limit=20&offset=0&sort=created_at&order=DESC` (`:id` = `user.id`). Pagination supported.
**Loading:** table skeleton.
**Empty:** EmptyState "No receipts yet — receipts appear here automatically after each payment. Pay into your virtual account to get started." + `CopyField` account number as the CTA.
**Error:** table error + Retry.
**Primary actions:** Download PDF; open receipt detail.

### 4.6 Receipt Detail — `app/(student)/receipts/[paymentId]/page.tsx`  [STUDENT]
**Purpose:** View a single receipt on-screen with allocations; download/print.
**Sections / components:** `ReceiptViewer` (§2.12) — institution header, student block, txn id + date, allocations table, totals, clearance line, payer block. Buttons: **Download PDF** (`receipt_url`), **Print**, **Re-send to email** (Phase-2 if no endpoint — hide for MVP unless backend adds one).
**API calls:**
- on load → `GET /api/payments/:id` (the student's id), then find the payment where `payment.id === paymentId` from the returned `data[]`. (No documented single-payment-by-id endpoint; reuse the list. **Flagged §5.**)
**Loading:** receipt skeleton.
**Empty:** if `paymentId` not found in list → "Receipt not found" + back to `/receipts`.
**Error:** error + Retry; if `receipt_url` null → show rendered receipt + "PDF still generating."
**Primary actions:** Download; Print.

---

## 5. Page → Endpoints Map (consolidated)

| # | Page | Route | Role | Method & Endpoint | When |
|---|------|-------|------|-------------------|------|
| 1 | Admin Login | `/login` | ADMIN | `POST /api/auth/login` | submit email |
| 1 | Admin Login | `/login` | ADMIN | `POST /api/auth/verify-otp` | submit OTP |
| 2 | Dashboard | `/dashboard` | ADMIN | `GET /api/reports/collection?format=JSON` | on load |
| 2 | Dashboard | `/dashboard` | ADMIN | `GET /api/debtors?sort=amount_owed&order=DESC&limit=5` | on load |
| 2 | Dashboard | `/dashboard` | ADMIN | `GET /api/payments?limit=10` ⚠️*assumed* | on load |
| 3 | Students List | `/students` | ADMIN | `GET /api/students?status=&department=&limit=&offset=` | load / filter / page |
| 3 | Students List | `/students` | ADMIN | `POST /api/students` | create submit |
| 4 | Student Detail | `/students/[id]` | ADMIN | `GET /api/students/:id` | on load |
| 4 | Student Detail | `/students/[id]` | ADMIN | `GET /api/students/:id/fees` | on load |
| 4 | Student Detail | `/students/[id]` | ADMIN | `GET /api/payments/:id` | on load |
| 4 | Student Detail | `/students/[id]` | ADMIN | `GET /api/clearance/:id` | on load |
| 4 | Student Detail | `/students/[id]` | ADMIN | `PATCH /api/students/:id` | defer/graduate |
| 5 | Import Students | `/students/import` | ADMIN | `POST /api/students/bulk-import` (multipart) | upload |
| 6 | Fee Types | `/fees` | ADMIN | `GET /api/fee-types` | on load |
| 7 | Create Fee | `/fees/new` | ADMIN | `POST /api/fee-types` | submit |
| 8 | Transactions | `/transactions` | ADMIN | `GET /api/payments?status=&limit=&offset=&search=` ⚠️*assumed* | load / filter |
| 9 | Debtors | `/debtors` | ADMIN | `GET /api/debtors?department=&sort=&order=&limit=&offset=` | load / filter |
| 9 | Debtors | `/debtors` | ADMIN | `GET /api/reports/students?format=CSV` | export |
| 10 | Clearance Overview | `/clearance` | ADMIN | `GET /api/reports/collection?format=JSON` | on load (summary) |
| 10 | Clearance Overview | `/clearance` | ADMIN | `GET /api/students?limit=...` / `GET /api/debtors` ⚠️*list source* | on load (list) |
| 11 | Reports | `/reports` | ADMIN | `GET /api/reports/collection?format=JSON` | on load (preview) |
| 11 | Reports | `/reports` | ADMIN | `GET /api/reports/collection?format=CSV` | export collection |
| 11 | Reports | `/reports` | ADMIN | `GET /api/reports/students` (CSV) | export students |
| 12 | Settings | `/settings` | ADMIN | `GET /api/institutions/:id` | on load |
| 13 | Refunds (admin action, surfaced on Student Detail / Dashboard "Critical") | — | ADMIN | `PATCH /api/refunds/:id` | approve/reject |
| 14 | Student Login | `/student-login` | STUDENT | `POST /api/auth/login` → `POST /api/auth/verify-otp` | submit |
| 15 | Student Dashboard | `/me` | STUDENT | `GET /api/students/:id` | on load |
| 15 | Student Dashboard | `/me` | STUDENT | `GET /api/students/:id/fees` | on load |
| 15 | Student Dashboard | `/me` | STUDENT | `GET /api/clearance/:id` | on load |
| 16 | My Fees | `/fees` (student) | STUDENT | `GET /api/students/:id/fees` | on load |
| 17 | Clearance Status | `/clearance` (student) | STUDENT | `GET /api/clearance/:id` | on load |
| 18 | Receipts List | `/receipts` | STUDENT | `GET /api/payments/:id?limit=&offset=&sort=&order=` | on load |
| 19 | Receipt Detail | `/receipts/[paymentId]` | STUDENT | `GET /api/payments/:id` (filter to paymentId) | on load |
| 20 | Request Refund (student action on `/me`) | — | STUDENT | `POST /api/refunds` | submit |
| all | Logout (Topbar) | — | both | `POST /api/auth/logout` | menu action |

**⚠️ Endpoint gaps / assumptions flagged for backend (not in API_Spec, inferred from existing patterns):**
1. **Institution-wide payments list** (`GET /api/payments?...`) — spec only documents `GET /api/payments/:student_id`. Needed by Dashboard "Recent Payments" and the Transactions page. Build against the same `{ data, pagination }` + payment object shape; confirm with backend.
2. **Single payment by id** — no `GET /api/payments/by-id/:paymentId`. Receipt Detail reuses the per-student list and filters client-side.
3. **All-clearance list** — no list endpoint returning every student's `clearance_status`. Clearance Overview uses the collection-report summary for counts and `/api/debtors` (+ per-student `GET /api/students/:id`) for the not-cleared list. Ask backend to add `clearance_status` to the List-Students payload, or a `?cleared=` filter.
4. **`POST /api/institutions`** exists but is Super-Admin / Phase-2 → **no UI built** in MVP (institution hardcoded). Settings page is read-only via `GET /api/institutions/:id`.
5. **Refund webhook/notification** — student refund request (`POST /api/refunds`) and admin approval (`PATCH /api/refunds/:id`) are documented; a refund **list** for the admin queue is not. Surface pending refunds inside Student Detail / a Dashboard "Critical Items" card; if a queue endpoint appears, add a Refunds admin page.

---

## 6. Empty-State Catalog

| Screen | Trigger | Copy (headline / subtext) | CTA |
|--------|---------|---------------------------|-----|
| Admin Dashboard | No students/payments yet | "No activity yet" / "Import your students to start collecting and reconciling fees." | "Import Students" → `/students/import` |
| Students List | Zero students | "No students yet" / "Add your first student or import a CSV — each gets a virtual account automatically." | "Add Student" + "Import CSV" |
| Students List | Filters match nothing | "No students match your filters" / "Try a different status or department." | "Clear filters" |
| Student Detail – Fees | Student has no fees | "No fees assigned yet" / "Create a fee type and it will be assigned to active students." | "Create Fee" → `/fees/new` |
| Student Detail – Payments | No payments | "No payments received yet" / "Share the virtual account number to start receiving payments." | Copy account number |
| Import Students | Before file chosen | "Drop a CSV here or browse" / "Columns: email, matric_number, first_name, last_name, department." | "Download sample CSV" |
| Fee Types | No fee types | "No fee types yet" / "Create your first fee, e.g. Faculty Due ₦5,000." | "Create Fee" |
| Transactions | No payments | "No payments yet" / "Payments appear here automatically when students pay into their virtual accounts." | — |
| Debtors | No one owes | "No debtors 🎉" / "Every student is fully paid up." | "View clearance" → `/clearance` |
| Clearance Overview | No students | "No students to evaluate yet" / "Import students to track clearance." | "Import Students" |
| Reports | No data for period | "Nothing to report yet" / "Reports populate once payments start flowing." | — |
| Student Dashboard | No fees assigned | "You have no fees yet" / "Your institution will assign them soon. Your payment account is ready below." | Copy account number |
| Student Dashboard | Virtual account pending | "Your payment account is being set up" / "Check back shortly — this usually takes a moment." | "Refresh" |
| My Fees (student) | No fees | "No fees assigned yet" / "Nothing to pay right now." | — |
| Clearance (student) | No required fees | "No clearance requirements yet" / "You'll see graduation requirements here once fees are assigned." | — |
| Receipts List (student) | No receipts | "No receipts yet" / "Receipts appear automatically after each payment. Pay into your virtual account to get started." | Copy account number |
| Receipt Detail | paymentId not found | "Receipt not found" / "This receipt may have been removed or the link is wrong." | "Back to receipts" |

---

## 7. Component Inventory Checklist

**Layout & guards**
- [ ] `(auth)/layout.tsx` — centered card, logo
- [ ] `(dashboard)/layout.tsx` — RoleGuard(ADMIN) + Sidebar + Topbar
- [ ] `(student)/layout.tsx` — RoleGuard(STUDENT) + student Topbar
- [ ] `RoleGuard` (§2.1)
- [ ] `Sidebar` (admin nav, §2.2)
- [ ] `Topbar` (admin + student variants, §2.3)

**Lib / utils**
- [ ] `lib/api.ts` — fetch client w/ auth, error parsing, 401 handling (§2.4)
- [ ] `lib/money.ts` — `formatNaira`, `formatNairaShort`, `percentPaid` (§2.5)
- [ ] `lib/auth.ts` — session get/set/clear (token + user)
- [ ] `lib/supabase.ts` — Supabase client (OTP) if doing OTP client-side; else backend-only

**Shared UI (build on installed shadcn: button, card, input, badge, dialog, table, sonner)**
- [ ] `StatusBadge` (§2.6)
- [ ] `DataTable` (loading/empty/pagination, §2.7)
- [ ] `EmptyState` (§2.8)
- [ ] `StatCard` / `MoneyStat` (§2.9)
- [ ] `ProgressBar` (custom — not installed, §2.10)
- [ ] `CopyField` (virtual account copy, §2.11)
- [ ] `ReceiptViewer` (§2.12)
- [ ] `OtpForm` (§2.13)
- [ ] `ConfirmDialog` (§2.14)
- [ ] `Toaster` wired in root layout (sonner — already installed)

**Admin pages**
- [ ] `/login`
- [ ] `/dashboard`
- [ ] `/students` (+ create dialog)
- [ ] `/students/[id]`
- [ ] `/students/import`
- [ ] `/fees`
- [ ] `/fees/new`
- [ ] `/transactions`
- [ ] `/debtors`
- [ ] `/clearance`
- [ ] `/reports`
- [ ] `/settings`

**Student pages**
- [ ] `/student-login`
- [ ] `/me`
- [ ] `/fees` (student)
- [ ] `/clearance` (student)
- [ ] `/receipts`
- [ ] `/receipts/[paymentId]`

**Cross-cutting**
- [ ] Landing page `/` polish (Phase: after core — CLAUDE.md)
- [ ] 401 → redirect-to-login flow tested for both roles
- [ ] All money rendered via `formatNaira` (grep for raw `/100` — should only live in `money.ts`)
- [ ] Every list page has loading + empty + error states wired
- [ ] Webhook URL + sub-account ID copyable on `/settings` (CLAUDE.md gotcha #1)

---

## 8. Out of Scope (Do NOT Build — Phase 2)

Per CLAUDE.md / Product_Spec "Not in MVP": configurable installments, penalties/dunning, faculty↔department hierarchy dashboards (we merge into one admin), student transfer flows, automated duplicate-payment UI (backend handles idempotently), advanced reporting/charts beyond CSV + one trend, mobile app, offline support, multi-institution onboarding wizard, separate Faculty/Super-Admin portals, SMS UI. Refund **approval** is a light admin action (no dedicated queue page) unless a list endpoint lands.

---

**End of Frontend Handoff.** Build order suggestion: shared lib/components (§2) → auth (§3.1/§4.1) → student happy path (`/me`, `/fees`, `/receipts`) → admin students+fees+detail → dashboard/debtors/transactions/clearance/reports/settings → landing polish.
