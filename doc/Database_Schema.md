# Database Schema: FeeFlow

**Version:** 1.0  
**Database:** Supabase (PostgreSQL 15+)  
**Last Updated:** June 27, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Core Tables](#core-tables)
3. [Financial Tables](#financial-tables)
4. [Status Tables](#status-tables)
5. [Audit & Compliance](#audit--compliance)
6. [Indexes & Performance](#indexes--performance)
7. [Row-Level Security (RLS)](#row-level-security-rls)
8. [Migration Scripts](#migration-scripts)

---

## Overview

### Design Principles

1. **Relational:** Every entity properly normalized (3NF)
2. **ACID:** All transactions atomic (no partial states)
3. **Audit Trail:** Every change logged for compliance
4. **Multi-Tenant:** All tables have org_id (RLS enforced)
5. **Type Safety:** Use appropriate column types (INT for money in Kobo, UUID for IDs)
6. **Scalability:** Indexes on hot paths, connection pooling ready

### Money Representation

**Important:** All monetary amounts stored as **Kobo (₦/100)**

```
₦5,000 → 500000 Kobo (INT)
₦50.00 → 5000 Kobo (INT)
₦0.50  → 50 Kobo (INT)

Why?
- ✅ Avoids float rounding errors
- ✅ All calculations are integer arithmetic (perfect precision)
- ✅ Database stores efficiently (INT vs DECIMAL)
- ✅ Display: divide by 100 and format on frontend
```

### ID Strategy

**All primary keys:** UUID (gen_random_uuid())

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Why?**
- ✅ Globally unique (no coordination needed)
- ✅ Non-sequential (privacy: can't guess next ID)
- ✅ Works across distributed systems
- ✅ Standard in production apps

---

## Core Tables

### 1. organizations

**Purpose:** Institution accounts (universities, faculties, departments)

**SQL:**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- URL: feeflow.io/oau, feeflow.io/unilag
  logo_url TEXT,                       -- S3 URL
  
  -- Nomba Integration
  nomba_account_id TEXT NOT NULL,      -- Parent account ID (from Nomba)
  nomba_sub_account_id TEXT NOT NULL,  -- Sub-account for this institution
  nomba_webhook_secret TEXT,           -- Secret for validating webhooks
  
  -- Institution Details
  institution_type TEXT,               -- UNIVERSITY, POLYTECHNIC, SECONDARY_SCHOOL, etc.
  country_code TEXT DEFAULT 'NG',      -- Nigeria only for MVP
  currency_code TEXT DEFAULT 'NGN',    -- Nigerian Naira
  
  -- Contact
  admin_email TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Status
  status TEXT DEFAULT 'ACTIVE',        -- ACTIVE, PAUSED, ARCHIVED
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  settings JSONB DEFAULT '{}',         -- Configurable: clearance rules, fee structure
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(nomba_account_id)             -- Each Nomba account = one institution
);

CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_slug ON organizations(slug);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `id` | UUID | Unique identifier |
| `name` | TEXT | "Obafemi Awolowo University" |
| `slug` | TEXT | URL-friendly: "oau" (unique across all institutions) |
| `logo_url` | TEXT | S3 URL for display on receipts |
| `nomba_account_id` | TEXT | Nomba's parent account (from credentials) |
| `nomba_sub_account_id` | TEXT | Sub-account for virtual accounts |
| `nomba_webhook_secret` | TEXT | Used to verify webhook signatures |
| `institution_type` | TEXT | Helps categorize (reporting, benchmarking) |
| `settings` | JSONB | Future: clearance rules, custom fees |
| `status` | TEXT | Can pause institution temporarily |

**Example Row:**
```json
{
  "id": "org-001",
  "name": "Obafemi Awolowo University",
  "slug": "oau",
  "nomba_account_id": "f666ef9b-888e-4799-85ce-acb505b28023",
  "nomba_sub_account_id": "f23a4cd9-4d9b-4429-92f4-6f881d9c39b2",
  "status": "ACTIVE"
}
```

---

### 2. students

**Purpose:** Student records (one per person per institution)

**SQL:**
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identification
  email TEXT NOT NULL,
  matric_number TEXT NOT NULL,         -- "CSC/2024/045"
  
  -- Personal Info
  first_name TEXT,
  last_name TEXT,
  middle_name TEXT,
  
  -- Academic
  department TEXT,                     -- "Computer Science"
  faculty TEXT,                        -- "Computing"
  enrollment_year INT,                 -- 2024 (first year)
  level INT,                           -- 1, 2, 3, 4 (year in program)
  
  -- Contact
  phone_number TEXT,
  alternative_email TEXT,
  
  -- Status
  status TEXT DEFAULT 'ACTIVE',        -- ACTIVE, DEFERRED, GRADUATED, INACTIVE
  date_enrolled DATE,
  date_deferred DATE,
  date_graduated Date,
  
  -- Credit Balance (for overpayments)
  credit_balance INT DEFAULT 0,        -- In Kobo
  
  -- Metadata
  metadata JSONB DEFAULT '{}',         -- Flexible: gender, address, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(org_id, matric_number),       -- Per institution, matric is unique
  UNIQUE(org_id, email)                -- Per institution, email is unique
);

CREATE INDEX idx_students_org_id ON students(org_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_matric ON students(matric_number);
CREATE INDEX idx_students_email ON students(email);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `org_id` | UUID | Links to institution (multi-tenant isolation) |
| `email` | TEXT | Used for login (Supabase Auth) |
| `matric_number` | TEXT | "CSC/2024/045" — unique per institution |
| `department` | TEXT | "Computer Science" |
| `status` | TEXT | Can be deferred mid-year |
| `credit_balance` | INT | Kobo: overpayment stored here |
| `UNIQUE(org_id, matric_number)` | Constraint | Same student can't exist twice |

**Example Row:**
```json
{
  "id": "student-45",
  "org_id": "org-001",
  "email": "chioma.adeyemi@student.oau.edu.ng",
  "matric_number": "CSC/2024/045",
  "first_name": "Chioma",
  "last_name": "Adeyemi",
  "department": "Computer Science",
  "status": "ACTIVE",
  "credit_balance": 0
}
```

---

### 3. virtual_accounts

**Purpose:** Nomba virtual accounts (1:1 with students)

**SQL:**
```sql
CREATE TABLE virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Relationships
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Account Details
  account_number TEXT NOT NULL,       -- "1023456789" (provided by Nomba)
  account_name TEXT,                  -- "Adeyemi, Chioma"
  bank_name TEXT DEFAULT 'Nomba',     -- Which bank (Wema, etc.)
  nomba_account_id TEXT,              -- Nomba's internal ID
  
  -- Account Status
  status TEXT DEFAULT 'ACTIVE',       -- ACTIVE, INACTIVE (archived)
  is_primary BOOLEAN DEFAULT TRUE,    -- Can have multiple accounts per student (future)
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,            -- When deactivated
  
  -- Constraints
  UNIQUE(account_number),             -- Account number globally unique
  UNIQUE(student_id, is_primary)      -- One primary account per student
);

CREATE INDEX idx_virtual_accounts_org_id ON virtual_accounts(org_id);
CREATE INDEX idx_virtual_accounts_student_id ON virtual_accounts(student_id);
CREATE INDEX idx_virtual_accounts_account_number ON virtual_accounts(account_number);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `account_number` | TEXT | "1023456789" — payment destination |
| `account_name` | TEXT | Appears in payer's transfer description |
| `nomba_account_id` | TEXT | Nomba's tracking ID (for API calls) |
| `status` | TEXT | ACTIVE while student is enrolled, INACTIVE after graduation |
| `UNIQUE(account_number)` | Constraint | No two students can have same account |

**Lookup Pattern:**
```sql
-- Find student by account number (most common)
SELECT student_id 
FROM virtual_accounts 
WHERE account_number = '1023456789' 
  AND status = 'ACTIVE'
LIMIT 1;
-- This is the speed-critical query (executed for every payment)
-- Index on account_number ensures O(1) lookup
```

**Example Row:**
```json
{
  "id": "va-45",
  "org_id": "org-001",
  "student_id": "student-45",
  "account_number": "1023456789",
  "account_name": "Adeyemi, Chioma",
  "bank_name": "Nomba",
  "status": "ACTIVE"
}
```

---

## Financial Tables

### 4. fee_types

**Purpose:** Fee templates (Faculty Due, Lab Fee, etc.)

**SQL:**
```sql
CREATE TABLE fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Fee Definition
  name TEXT NOT NULL,                 -- "Faculty Due"
  slug TEXT,                          -- "faculty_due" (unique per org)
  description TEXT,
  
  -- Amount (in Kobo)
  amount_naira INT NOT NULL,          -- 500000 = ₦5,000
  
  -- Clearance
  is_clearance_required BOOLEAN DEFAULT FALSE,
  
  -- Lifecycle
  fiscal_year TEXT,                   -- "2024/2025"
  version INT DEFAULT 1,              -- Track fee changes
  status TEXT DEFAULT 'ACTIVE',       -- ACTIVE, ARCHIVED
  
  -- Metadata
  created_by_email TEXT,
  created_by_role TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  effective_from DATE,
  effective_to DATE,
  
  -- Constraints
  UNIQUE(org_id, name, version)       -- Track versions per institution
);

CREATE INDEX idx_fee_types_org_id ON fee_types(org_id);
CREATE INDEX idx_fee_types_status ON fee_types(status);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `amount_naira` | INT | In Kobo: 500000 = ₦5,000 |
| `is_clearance_required` | BOOL | Must pay to graduate |
| `fiscal_year` | TEXT | "2024/2025" (for tracking) |
| `version` | INT | If fee amount changes, create v2 (don't edit v1) |
| `effective_from` / `effective_to` | DATE | When this fee is active |

**Why Version Tracking:**
```
Problem: Admin changes Faculty Due from ₦5,000 to ₦6,000
Solution: 
  - Keep original fee_type (v1, ₦5,000)
  - Create new fee_type (v2, ₦6,000)
  - Existing students keep v1
  - New students get v2
  - No retroactive changes (compliance)
```

**Example Row:**
```json
{
  "id": "ft-001",
  "org_id": "org-001",
  "name": "Faculty Due",
  "amount_naira": 500000,  // ₦5,000
  "is_clearance_required": true,
  "fiscal_year": "2024/2025",
  "version": 1,
  "status": "ACTIVE"
}
```

---

### 5. student_fees

**Purpose:** What each student owes (fee assignments)

**SQL:**
```sql
CREATE TABLE student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Relationships
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_type_id UUID NOT NULL REFERENCES fee_types(id),
  
  -- Amounts (all in Kobo)
  amount_due INT NOT NULL,            -- Original amount owed
  amount_paid INT DEFAULT 0,          -- Amount already paid
  amount_balance GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
  
  -- Status Tracking
  status TEXT DEFAULT 'UNPAID',       -- UNPAID, PARTIALLY_PAID, PAID
  
  -- Deadlines
  due_date DATE,
  is_overdue GENERATED ALWAYS AS (due_date < NOW()::date) STORED,
  
  -- Dispute Handling
  is_disputed BOOLEAN DEFAULT FALSE,
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  
  -- Metadata
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,                -- When fully paid
  
  -- Constraints
  UNIQUE(student_id, fee_type_id),    -- One instance of each fee per student
  CHECK (amount_paid >= 0 AND amount_paid <= amount_due)
);

CREATE INDEX idx_student_fees_org_id ON student_fees(org_id);
CREATE INDEX idx_student_fees_student_id ON student_fees(student_id);
CREATE INDEX idx_student_fees_status ON student_fees(status);
CREATE INDEX idx_student_fees_is_disputed ON student_fees(is_disputed);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `amount_due` | INT | Original fee amount (₦5,000 = 500000 Kobo) |
| `amount_paid` | INT | How much student has paid so far |
| `amount_balance` | INT | Generated: amount_due - amount_paid |
| `status` | TEXT | UNPAID → PARTIALLY_PAID → PAID |
| `is_disputed` | BOOL | Flag for manual review |
| `UNIQUE(student_id, fee_type_id)` | Constraint | Each student has exactly one instance of each fee |

**Example Row:**
```json
{
  "id": "sf-45-001",
  "org_id": "org-001",
  "student_id": "student-45",
  "fee_type_id": "ft-001",
  "amount_due": 500000,      // ₦5,000
  "amount_paid": 300000,     // ₦3,000
  "amount_balance": 200000,  // ₦2,000 (generated)
  "status": "PARTIALLY_PAID"
}
```

**Fee Allocation Example:**
```
Student CSC/2024/045 owes:
  - Faculty Due: ₦5,000 (sf-45-001)
  - Lab Fee: ₦2,000 (sf-45-002)
  - Clearance Fee: ₦500 (sf-45-003)

Student pays ₦3,000:
  - sf-45-001: amount_paid += ₦3,000 (status: PARTIALLY_PAID, balance: ₦2,000)
  - sf-45-002: amount_paid += ₦0 (status: UNPAID, balance: ₦2,000)
  - sf-45-003: amount_paid += ₦0 (status: UNPAID, balance: ₦500)

Next student pays ₦2,500:
  - sf-45-001: amount_paid += ₦2,000 (completes it, status: PAID)
  - sf-45-002: amount_paid += ₦500 (status: PARTIALLY_PAID, balance: ₦1,500)
```

---

### 6. payments

**Purpose:** Payment records (from Nomba webhooks)

**SQL:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Relationships
  student_id UUID NOT NULL REFERENCES students(id),
  virtual_account_id UUID NOT NULL REFERENCES virtual_accounts(id),
  
  -- Payment Details (all in Kobo)
  amount_naira INT NOT NULL,          -- Amount received
  
  -- Nomba Information
  nomba_transaction_id TEXT UNIQUE NOT NULL,  -- Nomba's tracking ID
  nomba_reference TEXT,               -- Additional reference
  
  -- Payer Details
  sender_name TEXT,                   -- Who sent the money
  sender_account TEXT,                -- From which account
  
  -- Status
  status TEXT DEFAULT 'SUCCESS',      -- SUCCESS, FAILED, PENDING
  reconciliation_status TEXT DEFAULT 'UNRECONCILED',  -- UNRECONCILED, RECONCILED, DISPUTED
  
  -- Timing
  webhook_received_at TIMESTAMPTZ,    -- When Nomba sent webhook
  reconciliation_completed_at TIMESTAMPTZ,
  
  -- Dispute Tracking
  is_disputed BOOLEAN DEFAULT FALSE,
  dispute_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(org_id, nomba_transaction_id)  -- No duplicate payments
);

CREATE INDEX idx_payments_org_id ON payments(org_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_nomba_transaction_id ON payments(nomba_transaction_id);
CREATE INDEX idx_payments_reconciliation_status ON payments(reconciliation_status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `nomba_transaction_id` | TEXT | Unique per Nomba transaction (prevents dupes) |
| `amount_naira` | INT | In Kobo (₦7,500 = 750000) |
| `status` | TEXT | SUCCESS or FAILED (from Nomba) |
| `reconciliation_status` | TEXT | Whether fees were updated |
| `webhook_received_at` | TIMESTAMP | When Nomba sent us the webhook |
| `UNIQUE(nomba_transaction_id)` | Constraint | Nomba retry same webhook → ignored |

**Reconciliation Workflow:**
```
1. Payment created: reconciliation_status = UNRECONCILED
2. Payment allocated to fees: reconciliation_status = RECONCILED
3. Email sent, fees updated, clearance recalculated
4. reconciliation_completed_at = NOW()
```

**Example Row:**
```json
{
  "id": "payment-12345",
  "org_id": "org-001",
  "student_id": "student-45",
  "virtual_account_id": "va-45",
  "amount_naira": 750000,  // ₦7,500
  "nomba_transaction_id": "TXN_ABC123XYZ",
  "sender_name": "Adeyemi John",
  "status": "SUCCESS",
  "reconciliation_status": "RECONCILED",
  "webhook_received_at": "2026-07-01T14:30:00Z"
}
```

---

### 7. payment_allocations

**Purpose:** Track which part of each payment goes to which fee

**SQL:**
```sql
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  student_fee_id UUID NOT NULL REFERENCES student_fees(id),
  
  -- Allocation Details (in Kobo)
  allocated_amount INT NOT NULL,      -- How much of payment goes to this fee
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_student_fee_id ON payment_allocations(student_fee_id);
```

**Why Separate Table:**

One payment can satisfy multiple fees. Track each allocation separately for auditing.

```
Payment: ₦7,500
Allocations:
  - Faculty Due (₦5,000)
  - Lab Fee (₦2,000)
  - Clearance Fee (₦500)

Query: "What happened to payment TXN_ABC123?"
→ Find all allocations for this payment → see exactly how it was split
```

**Example Rows:**
```json
[
  {
    "payment_id": "payment-12345",
    "student_fee_id": "sf-45-001",  // Faculty Due
    "allocated_amount": 500000       // ₦5,000
  },
  {
    "payment_id": "payment-12345",
    "student_fee_id": "sf-45-002",  // Lab Fee
    "allocated_amount": 200000       // ₦2,000
  },
  {
    "payment_id": "payment-12345",
    "student_fee_id": "sf-45-003",  // Clearance Fee
    "allocated_amount": 50000        // ₦500
  }
]
```

---

## Status Tables

### 8. clearance_status

**Purpose:** Denormalized clearance status (for speed)

**SQL:**
```sql
CREATE TABLE clearance_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Relationship
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Clearance Status
  is_cleared BOOLEAN DEFAULT FALSE,
  
  -- Timing
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  cleared_at TIMESTAMPTZ,             -- When officially cleared
  
  -- Metadata
  calculation_details JSONB,          -- Debug: which fees were checked
  
  -- Constraints
  UNIQUE(student_id)                  -- One clearance record per student
);

CREATE INDEX idx_clearance_status_org_id ON clearance_status(org_id);
CREATE INDEX idx_clearance_status_is_cleared ON clearance_status(is_cleared);
```

**Why Denormalized:**

Clearance is calculated from student_fees table (query joins multiple tables). Recalculating every time is slow. Store result in denormalized table for instant lookups.

```sql
-- Slow: Recalculate every time
SELECT 
  CASE 
    WHEN COUNT(*) = SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END)
    THEN true
    ELSE false
  END as is_cleared
FROM student_fees
WHERE student_id = ? AND fee_type_id IN (
  SELECT id FROM fee_types 
  WHERE is_clearance_required = true
);

-- Fast: Just check denormalized table
SELECT is_cleared FROM clearance_status WHERE student_id = ?;
```

**Example Row:**
```json
{
  "id": "cs-45",
  "org_id": "org-001",
  "student_id": "student-45",
  "is_cleared": true,
  "cleared_at": "2026-07-01T14:30:00Z",
  "calculation_details": {
    "required_fees": ["Faculty Due", "Clearance Fee"],
    "all_paid": true
  }
}
```

---

### 9. refund_requests

**Purpose:** Track refund requests (for overpayments)

**SQL:**
```sql
CREATE TABLE refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Relationships
  student_id UUID NOT NULL REFERENCES students(id),
  payment_id UUID REFERENCES payments(id),
  
  -- Refund Details (in Kobo)
  amount_requested INT NOT NULL,
  amount_approved INT,                -- Amount approved by finance officer
  amount_processed INT,               -- Amount actually refunded
  
  -- Status
  status TEXT DEFAULT 'REQUESTED',    -- REQUESTED, APPROVED, REJECTED, PROCESSED, FAILED
  
  -- Reason
  reason TEXT NOT NULL,               -- "Overpayment", "Student request", etc.
  
  -- Processing
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by_email TEXT,             -- Finance officer
  processed_at TIMESTAMPTZ,
  nomba_refund_txn_id TEXT,          -- Nomba transaction ID for refund
  
  -- Notes
  notes TEXT                          -- Admin notes
);

CREATE INDEX idx_refund_requests_org_id ON refund_requests(org_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
CREATE INDEX idx_refund_requests_student_id ON refund_requests(student_id);
```

**Fields Explained:**

| Field | Type | Why |
|-------|------|-----|
| `amount_requested` | INT | What student requested |
| `amount_approved` | INT | What finance officer approved (may be different) |
| `amount_processed` | INT | What actually went through Nomba |
| `status` | TEXT | REQUESTED → APPROVED → PROCESSED |
| `nomba_refund_txn_id` | TEXT | Proof refund was sent |

**Example Row:**
```json
{
  "id": "refund-001",
  "org_id": "org-001",
  "student_id": "student-45",
  "payment_id": "payment-12345",
  "amount_requested": 100000,  // ₦1,000 (overpayment)
  "amount_approved": 100000,
  "amount_processed": 100000,
  "status": "PROCESSED",
  "nomba_refund_txn_id": "TXN_REFUND_XYZ"
}
```

---

## Audit & Compliance

### 10. audit_logs

**Purpose:** Immutable record of all changes (for compliance + debugging)

**SQL:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization (multi-tenant)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- What Changed
  entity_type TEXT NOT NULL,          -- STUDENT, PAYMENT, STUDENT_FEE, CLEARANCE
  entity_id UUID,
  
  -- The Change
  action TEXT NOT NULL,               -- CREATED, UPDATED, DELETED, RECONCILED
  old_value JSONB,                    -- Previous state (if update)
  new_value JSONB,                    -- New state
  
  -- Who & When
  actor_email TEXT,                   -- User who made change (or 'system')
  actor_role TEXT,                    -- STUDENT, ADMIN, FINANCE_OFFICER
  
  -- Request Context
  request_id TEXT,                    -- Trace requests
  ip_address TEXT,                    -- For security audit
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_email);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**Example Entries:**

```json
{
  "entity_type": "PAYMENT",
  "entity_id": "payment-12345",
  "action": "RECONCILED",
  "old_value": { "reconciliation_status": "UNRECONCILED" },
  "new_value": { "reconciliation_status": "RECONCILED", "reconciliation_completed_at": "2026-07-01T14:30:00Z" },
  "actor_email": "system",
  "created_at": "2026-07-01T14:30:00Z"
}
```

```json
{
  "entity_type": "STUDENT_FEE",
  "entity_id": "sf-45-001",
  "action": "UPDATED",
  "old_value": { "amount_paid": 0, "status": "UNPAID" },
  "new_value": { "amount_paid": 500000, "status": "PAID" },
  "actor_email": "system",
  "created_at": "2026-07-01T14:30:00Z"
}
```

```json
{
  "entity_type": "CLEARANCE",
  "entity_id": "cs-45",
  "action": "UPDATED",
  "old_value": { "is_cleared": false },
  "new_value": { "is_cleared": true, "cleared_at": "2026-07-01T14:30:00Z" },
  "actor_email": "system",
  "created_at": "2026-07-01T14:30:00Z"
}
```

---

## Indexes & Performance

### Index Strategy

**Hot Paths (looked up frequently):**

| Query | Index | Benefit |
|-------|-------|---------|
| Find student by virtual account | `idx_virtual_accounts_account_number` | O(1) lookup on payment arrival |
| Find student's fees | `idx_student_fees_student_id` | Fast dashboard load |
| Check fee status | `idx_student_fees_status` | Clearance calculation |
| Find student by email (login) | `idx_students_email` | O(1) auth lookup |
| Get organization | `idx_organizations_slug` | O(1) lookup by slug |

**All Indexes Created:**
```sql
-- organizations
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- students
CREATE INDEX idx_students_org_id ON students(org_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_matric ON students(matric_number);
CREATE INDEX idx_students_email ON students(email);

-- virtual_accounts
CREATE INDEX idx_virtual_accounts_org_id ON virtual_accounts(org_id);
CREATE INDEX idx_virtual_accounts_student_id ON virtual_accounts(student_id);
CREATE INDEX idx_virtual_accounts_account_number ON virtual_accounts(account_number);

-- fee_types
CREATE INDEX idx_fee_types_org_id ON fee_types(org_id);
CREATE INDEX idx_fee_types_status ON fee_types(status);

-- student_fees
CREATE INDEX idx_student_fees_org_id ON student_fees(org_id);
CREATE INDEX idx_student_fees_student_id ON student_fees(student_id);
CREATE INDEX idx_student_fees_status ON student_fees(status);
CREATE INDEX idx_student_fees_is_disputed ON student_fees(is_disputed);

-- payments
CREATE INDEX idx_payments_org_id ON payments(org_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_nomba_transaction_id ON payments(nomba_transaction_id);
CREATE INDEX idx_payments_reconciliation_status ON payments(reconciliation_status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- payment_allocations
CREATE INDEX idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_student_fee_id ON payment_allocations(student_fee_id);

-- clearance_status
CREATE INDEX idx_clearance_status_org_id ON clearance_status(org_id);
CREATE INDEX idx_clearance_status_is_cleared ON clearance_status(is_cleared);

-- refund_requests
CREATE INDEX idx_refund_requests_org_id ON refund_requests(org_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
CREATE INDEX idx_refund_requests_student_id ON refund_requests(student_id);

-- audit_logs
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_email);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

## Row-Level Security (RLS)

### RLS Policies (Multi-Tenancy Enforcement)

**Principle:** Every user can only see data from their organization (org_id).

**Example Policy (students table):**
```sql
-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see students in their org
CREATE POLICY "Students visible to org users" ON students
  FOR SELECT
  USING (
    auth.jwt() ->> 'org_id' = org_id::text
  );

-- Policy: Only admins can insert students
CREATE POLICY "Admins can create students" ON students
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id
        AND (auth.jwt() ->> 'role' = 'ADMIN' OR auth.jwt() ->> 'role' = 'SUPER_ADMIN')
    )
  );
```

**Applied to All Tables:**
```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

**How It Works:**

1. User logs in → JWT token created
2. JWT contains: `user_id`, `org_id`, `role`
3. User queries: `SELECT * FROM students`
4. Database checks RLS policy: `org_id = auth.jwt() ->> 'org_id'`
5. Only rows matching that org_id are returned
6. Admin from OAU can't see students from UNILAG (even if they guess the student ID)

---

## Migration Scripts

### Initial Schema Creation

**Run on first deploy (Supabase SQL Editor):**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  nomba_account_id TEXT NOT NULL UNIQUE,
  nomba_sub_account_id TEXT NOT NULL,
  nomba_webhook_secret TEXT,
  institution_type TEXT,
  country_code TEXT DEFAULT 'NG',
  currency_code TEXT DEFAULT 'NGN',
  admin_email TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'ACTIVE',
  is_verified BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ... (repeat for all tables above) ...

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ... etc

-- Create policies
CREATE POLICY "Users see their org" ON organizations
  FOR SELECT USING (auth.jwt() ->> 'org_id' = id::text);

-- ... (create policies for all tables)
```

### Add New Columns (Schema Evolution)

**Example: Add support for SMS notifications**
```sql
ALTER TABLE students ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Update audit log to track this change
INSERT INTO audit_logs (entity_type, action, new_value, actor_email)
VALUES ('SCHEMA', 'MIGRATION', '{"added_sms_support": true}', 'system');
```

### Backups & Recovery

**Supabase handles automatically:**
- ✅ Daily backups (retained for 30 days)
- ✅ Point-in-time recovery available
- ✅ Automatic replication (high availability)

**Manual Backup (before major migration):**
```bash
pg_dump postgresql://user:password@host/db > backup.sql
```

---

**Next:** Read API_SPEC.md for endpoint specifications, then RECONCILIATION_FLOW.md for payment logic.