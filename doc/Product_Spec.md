# Product Specification: FeeFlow

**Version:** 1.0  
**Last Updated:** June 27, 2026  
**Status:** MVP (Hackathon Build)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Core Features](#core-features)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Student Lifecycle](#student-lifecycle)
6. [Fee Management](#fee-management)
7. [Reconciliation Engine](#reconciliation-engine)
8. [Clearance Engine](#clearance-engine)
9. [Dashboards](#dashboards)
10. [User Flows](#user-flows)

---

## Problem Statement

### Current State (Manual Process)

**Scenario:** A Nigerian university collects ₦200M annually across 10,000 students.

**Current workflow:**
1. Student sends payment screenshot to department treasurer
2. Treasurer manually verifies sender is the student
3. Treasurer logs amount in Excel spreadsheet
4. Treasurer marks student as "paid" in notebook or outdated system
5. If payment is ₦4,500 but fee is ₦5,000, nobody knows (underpayment lost)
6. If payment is ₦6,000 but fee is ₦5,000, nobody follows up (overpayment lost)
7. Student later claims they never paid (no automated receipt)
8. Disputes escalate to finance officer (manual investigation)
9. At graduation, clearance is done by hand (cross-referencing multiple sheets)
10. Institutional data is fragmented (no unified reporting)

**Pain Points:**
- **Lost Revenue:** Underpayments aren't tracked. ₦1K-₦5K overpayments aren't refunded or credited.
- **Disputes:** No proof of payment. Student says they paid, treasurer says no receipt.
- **Manual Overhead:** Treasurers spend 10+ hours/week on reconciliation.
- **Slow Clearance:** Graduation clearance takes weeks due to manual verification.
- **No Real-Time Visibility:** Finance officer doesn't know how much is outstanding until month-end.
- **Audit Trail Loss:** No record of who paid when, from which account, or proof of receipt.
- **Error-Prone:** Excel mistakes, duplicate entries, incorrect totals.
- **Scalability:** System breaks when student population grows (more payments = more manual work).

### Target Institutions

- Universities (Nigeria: 47 universities × 5,000+ students each)
- Polytechnics (38 institutions)
- Faculties within universities
- Departments (100+ per university)
- Student associations (need fee collection for events, projects)
- Secondary schools (₦50K-₦200K annual fees/student)

**Total addressable market:** 1,000+ institutions in Nigeria, each losing 5-10% of revenue to reconciliation failures.

---

## Solution Overview

### Core Idea

**Every student gets a unique virtual account (powered by Nomba).**

When a payment arrives to that account:
1. **Automatic Detection:** System identifies which student the payment is for (linked to their virtual account)
2. **Automatic Allocation:** Payment is allocated to outstanding fees
3. **Automatic Reconciliation:** Fee status updates, balance decreases
4. **Automatic Clearance:** If all required fees are paid, student becomes eligible for graduation
5. **Automatic Notification:** Receipt is generated and emailed to student

**Result:** Zero manual verification needed. Payment → System handles everything.

### Example Flow

```
Student: CSC/2024/001
Virtual Account: 1023456789 (Nomba)
Outstanding Fees:
  - Faculty Due: ₦5,000 (UNPAID)
  - Lab Fee: ₦2,000 (UNPAID)
  - Clearance Fee: ₦500 (UNPAID)
Total Owed: ₦7,500

[Student pays ₦7,500 to account 1023456789]

Payment webhook received:
  - Amount: ₦7,500
  - Destination: 1023456789
  - Transaction ID: TXN_ABC123

System logic:
  1. Find student: CSC/2024/001 ✅
  2. Find outstanding fees (₦7,500 total)
  3. Allocate ₦5,000 → Faculty Due (status: PAID)
  4. Allocate ₦2,000 → Lab Fee (status: PAID)
  5. Allocate ₦500 → Clearance Fee (status: PAID)
  6. Update student: No outstanding fees ✅
  7. Calculate clearance: CLEARED ✅
  8. Generate receipt (PDF)
  9. Email receipt to student

Result:
  - Student receives receipt immediately
  - Dashboard shows: FULLY PAID, CLEARED
  - Faculty sees revenue updated in real-time
  - Zero manual verification needed
```

---

## Core Features

### 1. Dedicated Virtual Accounts

**What:** Every student gets a unique virtual account number (NUBAN-like).

**How:**
- Admin creates student (name, matric number, email, department)
- System calls Nomba API to create virtual account
- Virtual account auto-assigned to student (1:1 mapping)
- Student views account number in dashboard

**Why:**
- Payments are automatically attributed (account number = student ID)
- No manual verification needed
- Student can share account number to payer (parent, sponsor, etc.)
- Audit trail is automatic (every payment linked to account)

**Example:**
```
Student: Adeyemi, Chioma
Matric: CSC/2024/045
Virtual Account: 1023456781
Bank: Nomba (via Wema)
Payer can send payment to this account from any bank.
System instantly knows it's for CSC/2024/045.
```

**Implementation:**
- On student creation: `POST /nomba/virtual-accounts` with student metadata
- Nomba returns account number
- Store in database: `virtual_accounts.account_number = "1023456781"`
- On payment: webhook provides account number → lookup student instantly

---

### 2. Automatic Reconciliation

**What:** Payments are automatically matched to fees without manual verification.

**How:**
1. Payment arrives to virtual account
2. Nomba sends webhook with: amount, destination account, timestamp, transaction ID
3. System identifies student (via virtual account lookup)
4. System finds outstanding fees (in priority order: clearance first, then oldest fees)
5. System allocates payment to fees
6. System updates balance
7. No human needed

**Why:**
- Eliminates manual verification (treasurer doesn't touch it)
- Instant updates (student sees paid status immediately)
- Accurate (no Excel errors)
- Auditable (every transaction logged)

**Example:**
```
Payment: ₦3,000 (to account 1023456781)
Outstanding fees:
  - Faculty Due: ₦5,000
  - Lab Fee: ₦2,000

Allocation logic:
  1. Allocate ₦3,000 to Faculty Due
  2. Faculty Due status: PARTIALLY_PAID (₦3,000/₦5,000)
  3. Lab Fee status: UNPAID
  4. Student not cleared (still owes ₦4,000)

Next payment (₦4,000):
  1. Allocate ₦2,000 to Faculty Due (completes it)
  2. Allocate ₦2,000 to Lab Fee (completes it)
  3. All fees paid
  4. Student status: CLEARED
```

**Deduplication:**
- Every payment has unique `nomba_transaction_id`
- If same payment webhook arrives twice (Nomba retry), system ignores (idempotent)
- No duplicate fees, no double-counting

---

### 3. Fee Management

**What:** Admins create fee templates. System applies to students automatically.

**Types of Fees (examples):**
- Faculty Due (e.g., ₦5,000)
- Department Due (e.g., ₦2,000)
- Lab Fee (e.g., ₦1,500)
- Project Fee (e.g., ₦1,000)
- Event Fee (e.g., ₦500)
- Clearance Fee (e.g., ₦500) — must be paid to graduate

**Fee Properties (MVP):**
```
Fee Type: "Faculty Due"
Amount: ₦5,000
Description: "Faculty development levy"
Required for Clearance: true  // Must be paid to graduate
```

**Creating Fees:**
1. Admin: "Create new fee type"
2. Input: name, amount, description, is_clearance_required
3. System stores fee template
4. New students automatically assigned this fee
5. Existing students: manual assignment (or bulk import)

**Example:**
```
Faculty creates 3 fee types:
1. Faculty Due (₦5,000, clearance-required)
2. Lab Fee (₦2,000, optional)
3. Clearance Fee (₦500, clearance-required)

When new student CSC/2024/100 joins:
- Virtual account created
- All 3 fees assigned (amounts owed: ₦7,500)
- Student sees fees in dashboard immediately
```

**Not in MVP (Phase 2):**
- Configurable installments (₦5K fee split as ₦2.5K + ₦2.5K)
- Penalties (late fees increase amount owed)
- Conditional fees (only charged if student has debt)
- Pro-rated fees (adjusted for mid-semester entry)

---

### 4. Underpayment Handling

**What:** If payment is less than amount owed, system tracks partial payment.

**How:**
```
Fee: Faculty Due (₦5,000)
Payment: ₦3,000

Result:
  Amount Paid: ₦3,000
  Amount Outstanding: ₦2,000 (₦5,000 - ₦3,000)
  Status: PARTIALLY_PAID
  Student Cleared: NO (must pay full amount)

Next payment (₦2,000):
  Amount Paid: ₦5,000 (₦3,000 + ₦2,000)
  Amount Outstanding: ₦0
  Status: PAID
  Student Cleared: YES (if all other fees are also paid)
```

**Student View:**
```
Faculty Due: ₦5,000
  Paid: ₦3,000
  Outstanding: ₦2,000
  Progress: 60% ████████░
```

**Why This Matters:**
- Students can make installment payments (even without formal installment plans)
- System tracks each partial payment separately
- Clear visibility of balance owed
- No lost payments (every Kobo is tracked)

---

### 5. Overpayment Handling

**What:** If payment exceeds amount owed, system creates credit or returns funds.

**Example:**
```
Fee: Lab Fee (₦2,000)
Payment: ₦3,000

Allocation:
  Lab Fee: ₦2,000 (satisfies)
  Credit Balance: ₦1,000

Admin options:
  1. Keep as credit (auto-apply to next fee this student owes)
  2. Refund to student (process withdrawal)
  3. Flag for manual review (if unsure)
```

**Student View:**
```
Lab Fee: ₦2,000
  Paid: ₦3,000 ✅
  Credit Balance: ₦1,000
  
Your account has a ₦1,000 credit. 
This will be applied to your next payment.
Request refund? [Button]
```

**Implementation (MVP):**
- Store credit in `students.credit_balance` column
- Next fee assignment: deduct credit first
- Manual refund: admin reviews → approves → system processes via Nomba

---

### 6. Clearance Engine

**What:** Determines if a student is eligible for graduation.

**Clearance Rules (configurable per institution):**
```
To graduate, a student must have paid:
  - All fees marked "clearance_required: true"
  - Example: Faculty Due + Clearance Fee (but not Lab Fee if optional)
```

**Example 1: Cleared**
```
Student: CSC/2024/001
Required Fees:
  - Faculty Due (₦5,000): PAID ✅
  - Clearance Fee (₦500): PAID ✅
Optional Fees:
  - Lab Fee (₦2,000): UNPAID (doesn't matter)

Result: CLEARED ✅
Can graduate now.
```

**Example 2: Not Cleared**
```
Student: CSC/2024/002
Required Fees:
  - Faculty Due (₦5,000): PARTIALLY_PAID (₦3,000/₦5,000) ✅
  - Clearance Fee (₦500): UNPAID ❌

Result: NOT CLEARED ❌
Cannot graduate. Outstanding: ₦2,500 (Faculty) + ₦500 (Clearance) = ₦3,000
```

**Clearance Status Changes:**
1. **UNPAID** → Payment received → **PARTIALLY_PAID** → Full payment → **PAID**
2. When all required fees are PAID → **CLEARED**
3. If disputed payment is refunded → Back to **PARTIALLY_PAID** or **UNPAID**

**Student Dashboard:**
```
Clearance Status: NOT CLEARED ❌
You owe ₦3,000 to be eligible for graduation.

Required Fees:
  - Faculty Due: ₦5,000 (Paid: ₦3,000, Owing: ₦2,000)
  - Clearance Fee: ₦500 (Paid: ₦0, Owing: ₦500)

Pay Outstanding Fees →
```

**Admin Dashboard:**
```
Clearance Summary:
  - Cleared: 450 students (90%)
  - Partially Paid: 35 students (7%)
  - Not Cleared: 15 students (3%)

Debtors Report:
  Student Name | Matric | Outstanding | Due Date
  -------------|--------|-------------|----------
  Adebayo, Ade | CSC/24/001 | ₦2,500 | 5 days
  Eze, Chioma | CSC/24/045 | ₦500 | Overdue
```

---

### 7. Receipt Generation

**What:** Automatic PDF receipts emailed after successful payment.

**Receipt Contents:**
```
═══════════════════════════════════════════════════════
                    PAYMENT RECEIPT
═══════════════════════════════════════════════════════

Institution: Obafemi Awolowo University
Faculty: Computing

Student Name: Adeyemi, Chioma
Matric Number: CSC/2024/045
Email: chioma.adeyemi@student.oau.edu.ng

─────────────────────────────────────────────────────

Date: June 27, 2026, 2:30 PM
Transaction ID: TXN_ABC123XYZ
Amount Paid: ₦7,500.00

Fees Paid:
  Faculty Due (₦5,000)        ────────────→  ✅ PAID
  Lab Fee (₦2,000)            ────────────→  ✅ PAID
  Clearance Fee (₦500)        ────────────→  ✅ PAID

Total Outstanding: ₦0.00
Clearance Status: ✅ ELIGIBLE FOR GRADUATION

─────────────────────────────────────────────────────

Payer Name: Adeyemi John
Payer Account: 1234567890

Virtual Account Used:
  1023456789 (Nomba via Wema Bank)

─────────────────────────────────────────────────────

Generated by FeeFlow
https://feeflow.io
Powered by Nomba

═══════════════════════════════════════════════════════
```

**Email Delivery:**
- Recipient: student email address
- Subject: "Payment Receipt – FeeFlow"
- Body: HTML email + PDF attachment
- Timing: Within 30 seconds of payment reconciliation
- Retry: If SendGrid fails, queue for retry every 5 min (3 attempts)

**Student Access:**
- Permanent link: dashboard.feeflow.io/students/:id/receipts
- Student can download any receipt anytime
- Email can be re-sent from dashboard

---

### 8. Audit Trail

**What:** Every payment, fee update, and clearance change is logged.

**Audit Log Entry Example:**
```
{
  "timestamp": "2026-07-01T14:30:00Z",
  "action": "PAYMENT_RECONCILED",
  "entity_type": "PAYMENT",
  "entity_id": "payment_12345",
  "actor": "system", // or "admin_user@oau.edu.ng"
  "changes": {
    "old": {
      "status": "UNRECONCILED",
      "reconciliation_status": null
    },
    "new": {
      "status": "SUCCESS",
      "reconciliation_status": "RECONCILED",
      "student_id": "student_67890"
    }
  },
  "details": {
    "amount": 7500,
    "nomba_transaction_id": "TXN_ABC123XYZ",
    "fees_affected": [
      {
        "fee_type": "Faculty Due",
        "amount_allocated": 5000,
        "old_status": "UNPAID",
        "new_status": "PAID"
      },
      {
        "fee_type": "Lab Fee",
        "amount_allocated": 2000,
        "old_status": "UNPAID",
        "new_status": "PAID"
      }
    ]
  }
}
```

**Audit Log Uses:**
- Debugging: "What happened to this payment?"
- Compliance: "Prove this student was charged ₦5,000"
- Dispute Resolution: "Show payment history for CSC/2024/045"
- Security: "Who changed this fee? When?"

---

## User Roles & Permissions

### 1. Student

**Access Level:** View own data only

**Capabilities:**
- ✅ View own virtual account number
- ✅ View all assigned fees (amount, status, due date)
- ✅ View payment history
- ✅ Download receipts (PDF)
- ✅ Check clearance status
- ✅ Request refund for overpayment
- ❌ Cannot view other students' data
- ❌ Cannot create fees
- ❌ Cannot process refunds

**Student Dashboard:**
```
Virtual Account:     1023456789
Bank:                Nomba (via Wema)

Outstanding Fees:
  Faculty Due        ₦5,000      60% paid
  Lab Fee            ₦2,000      0% paid
  Clearance Fee      ₦500        0% paid
  
Total Owed:          ₦7,500
Clearance Status:    NOT CLEARED (₦3,000 required to clear)

Recent Payments:
  Jun 1, 2026        ₦3,000      Faculty Due (partial)
  May 15, 2026       ₦2,000      Lab Fee (partial)

Download Receipts    [PDF] [PDF]
Request Refund       [Button]
```

**Authentication:** Email + OTP (Supabase Auth)

---

### 2. Department Executive

**Access Level:** View all students in their department, manage department fees

**Examples:** President, Treasurer, Financial Secretary

**Capabilities:**
- ✅ View all students in department
- ✅ View all payments received
- ✅ Create department-level fees
- ✅ View payment history (department-wide)
- ✅ Export payment reports (CSV)
- ✅ View debtors list
- ✅ Flag disputed payments for review
- ✅ Generate clearance certificates (if all fees paid)
- ❌ Cannot access students from other departments
- ❌ Cannot process refunds (finance officer does)
- ❌ Cannot change student status

**Department Dashboard:**
```
Department:          Computer Science (CSC)

Collection Summary:
  Total Students:    500
  Cleared:           450 (90%)
  Partially Paid:    35 (7%)
  Not Cleared:       15 (3%)
  
Revenue This Month:  ₦2,500,000
Outstanding:         ₦150,000
Collection Rate:     95%

Department Fees:
  Faculty Due (₦5,000)
  Lab Fee (₦2,000)
  Clearance Fee (₦500)
  [+ Create New Fee]

Recent Payments:
  Jun 27, 14:30      ₦7,500      CSC/24/045 ✅
  Jun 27, 14:15      ₦3,000      CSC/24/087 (partial)
  
Debtors (15 students):
  [See debtors list]
  
Export Report (CSV)  [Download]
```

**Authentication:** Institutional email + OTP

---

### 3. Faculty Executive

**Access Level:** View all departments in faculty, monitor faculty performance

**Capabilities:**
- ✅ View all departments in faculty
- ✅ View aggregate metrics (total revenue, debtors by department)
- ✅ View department performance comparison
- ✅ Create faculty-level fees
- ✅ Generate faculty-wide reports
- ❌ Cannot view individual student payments (see department summaries only)
- ❌ Cannot create or modify department fees
- ❌ Cannot process refunds

**Faculty Dashboard:**
```
Faculty:             Computing

Departments:
  Computer Science   ₦2.5M collected    450/500 cleared
  Software Eng       ₦1.8M collected    380/400 cleared
  IT Engineering     ₦1.2M collected    290/320 cleared
  Cyber Security     ₦800K collected    190/200 cleared

Faculty Total:       ₦6.3M collected    1,310/1,420 cleared (92%)
Outstanding:        ₦450K

Faculty Fees:
  Faculty Due (₦5,000)
  [+ Create New Fee]
  
View Detailed Reports [Download]
```

**Authentication:** Institutional email + OTP

---

### 4. Finance Officer

**Access Level:** Full data access, process refunds, resolve disputes

**Capabilities:**
- ✅ View all institutions (if multi-tenant)
- ✅ View all students, payments, fees
- ✅ Review disputed payments
- ✅ Process refunds (approve + initiate Nomba transfer)
- ✅ Adjust student balances (for edge cases)
- ✅ View audit trail (who did what when)
- ✅ Generate compliance reports
- ✅ Manually override clearance (if needed)
- ✅ Export full financial statements
- ❌ Cannot create new institutions (admin does)
- ❌ Cannot change core fee structure (only adjustments)

**Finance Officer Dashboard:**
```
Institution:         OAU

Financial Summary:
  Total Revenue:     ₦50M
  Collected This Month: ₦2.8M
  Outstanding:       ₦3.5M
  Collection Rate:   93%

Disputes (3):
  [Payment from CSC/24/087 marked as disputed]
  [Student claims fee was reduced]
  [Overpayment from CSC/24/001 pending refund approval]

Refund Requests (5 pending):
  [Approve] [Reject] [Investigate]

Student Balance Adjustments:
  [Manual override for CSC/24/045 (deferred, clear debts)]

Audit Log:
  [View all changes, by whom, when]
  
Export Financial Statement [CSV] [PDF]
```

**Authentication:** Institutional email + OTP + 2FA (for sensitive operations)

---

### 5. Super Admin

**Access Level:** Full system access (multi-tenant administrator)

**Capabilities:**
- ✅ Create new institutions
- ✅ Manage institution settings (name, logo, fees)
- ✅ Manage institution admins
- ✅ View all data across all institutions
- ✅ Configure policies (clearance rules, fee structures)
- ✅ Manage Nomba API credentials
- ✅ View system-wide analytics
- ✅ Access audit logs
- ✅ Manage webhooks
- ✅ System-level backups
- ✅ Emergency override (pause payments, etc.)

**Super Admin Dashboard:**
```
System Overview:

Institutions: 50
  - Active: 45
  - Paused: 3
  - Archived: 2
  
Total Users: 12,500
Total Revenue: ₦500M (all institutions)
Monthly Transactions: 45,000+
System Uptime: 99.9%

Recent Activity:
  [OAU onboarded 500 new students]
  [UNILAG processed ₦15M in payments]
  [Covenant University cleared 95 students for graduation]

Manage Institutions [Create] [Edit] [Delete]
Manage Admins [Add] [Remove] [Reset Password]
View Webhook Logs
Manage API Credentials
System Settings
  - Nomba Account ID
  - Webhook Secret
  - Email Provider
  - SMS Provider
```

**Authentication:** Super admin email + strong password + 2FA

---

## Student Lifecycle

### Phase 1: New Student (Onboarding)

**Trigger:** Student registered in institution system (start of semester)

**Process:**
```
1. Admin imports student data (CSV or manual entry):
   - Name, Email, Matric Number, Department
   
2. System creates student record in FeeFlow
   
3. System calls Nomba API to create virtual account:
   POST /nomba/virtual-accounts
   {
     "account_name": "Adeyemi, Chioma",
     "metadata": {
       "matric": "CSC/2024/045",
       "institution": "OAU",
       "department": "Computer Science"
     }
   }
   
4. Nomba returns virtual account number (e.g., 1023456789)
   
5. System stores virtual account in database:
   virtual_accounts.student_id = student_45
   virtual_accounts.account_number = "1023456789"
   virtual_accounts.status = "ACTIVE"
   
6. System assigns default fees:
   - Faculty Due (₦5,000)
   - Lab Fee (₦2,000)
   - Clearance Fee (₦500)
   
7. System sends email with virtual account number:
   "Your payment account is: 1023456789
    Pay this account to settle all fees.
    Virtual Account: https://dashboard.feeflow.io/student/CSC/2024/045"
    
8. Student can now view dashboard and see:
   - Virtual account number (copy/share with payer)
   - Fees owed (₦7,500 total)
   - Payment account details
```

**Status:** `ACTIVE`  
**Virtual Account:** Assigned and active  
**Fees:** All default fees assigned  
**Clearance:** NOT CLEARED (no payments yet)

---

### Phase 2: Active Student (Paying Fees)

**Trigger:** Student makes payment to virtual account

**Process:**
```
1. Payment sent to account 1023456789 (from any bank)

2. Nomba settles payment to FeeFlow's institutional account

3. Nomba sends webhook:
   POST /api/webhooks/nomba
   {
     "event": "transfer.received",
     "data": {
       "amount": 7500,
       "destinationAccountNumber": "1023456789",
       "transactionReference": "TXN_ABC123",
       "senderName": "Adeyemi John",
       "narration": "Payment"
     }
   }

4. FeeFlow webhook handler:
   a. Find student (by virtual account 1023456789)
   b. Verify not duplicate (check nomba_transaction_id)
   c. Create payment record
   d. Allocate payment to fees (oldest/clearance-required first)
   e. Update fee status (UNPAID → PARTIALLY_PAID or PAID)
   f. Recalculate clearance status
   g. Generate receipt PDF
   h. Queue email (send receipt to student)
   i. Return 200 OK to Nomba
   
5. Student receives receipt email immediately
   - PDF attachment with payment details
   - Receipt number, transaction ID, balance update

6. Student views dashboard:
   - Fees updated in real-time
   - Clearance status visible
   - Payment appears in history
```

**Status:** `ACTIVE`  
**Virtual Account:** Active, payments flowing  
**Fees:** Being paid down (status changes)  
**Clearance:** Updated after each payment

---

### Phase 3: Partial Payment Scenarios

**Scenario 1: Underpayment (Multiple Payments)**
```
Student owes ₦7,500 (₦5K + ₦2K + ₦500)

Payment 1: ₦3,000
  - Allocate to Faculty Due (oldest, clearance-required)
  - Faculty Due: PARTIALLY_PAID (₦3K/₦5K)
  - Clearance: NOT CLEARED

Payment 2: ₦2,000
  - Complete Faculty Due (₦2K more)
  - Allocate ₦0 to Lab Fee
  - Faculty Due: PAID
  - Clearance: Still NOT CLEARED (Clearance Fee unpaid)

Payment 3: ₦500
  - Allocate to Clearance Fee
  - Clearance Fee: PAID
  - Clearance: CLEARED ✅
```

**Scenario 2: Overpayment (Single Large Payment)**
```
Student owes ₦7,500
Payment: ₦8,000

Allocation:
  - Faculty Due: ₦5,000 (PAID)
  - Lab Fee: ₦2,000 (PAID)
  - Clearance Fee: ₦500 (PAID)
  - Credit Balance: ₦500 (overpayment)

Student dashboard:
  - All fees marked PAID
  - Clearance: CLEARED ✅
  - Credit Balance: ₦500 (auto-applied to next year's fees, or request refund)
```

**Status:** `ACTIVE`  
**Virtual Account:** Active  
**Fees:** Partially/fully paid  
**Clearance:** Recalculated after each payment

---

### Phase 4: Ready for Graduation (Clearance)

**Trigger:** All required fees (clearance_required=true) are marked PAID

**Process:**
```
1. Last payment arrives → all required fees now paid

2. System recalculates clearance:
   - Faculty Due: PAID ✅
   - Clearance Fee: PAID ✅
   - Lab Fee (optional): UNPAID (doesn't matter)
   
   Result: CLEARED = TRUE ✅

3. Update student status:
   clearance_status.is_cleared = TRUE
   clearance_status.cleared_at = NOW()

4. System sends email:
   "Congratulations! You are now eligible for graduation.
    Clearance Certificate: [link to PDF]
    
    Submit this document to Registrar."

5. Faculty dashboard shows:
   - Student moved from "Partially Paid" to "Cleared"
   - Department collection rate updates
   
6. Student can:
   - View/download clearance certificate
   - Share with graduation office
   - Complete graduation requirements
```

**Status:** `ACTIVE`  
**Virtual Account:** Still active (future years)  
**Fees:** All required fees PAID  
**Clearance:** CLEARED ✅

**Clearance Certificate (PDF):**
```
════════════════════════════════════════════════
           CLEARANCE CERTIFICATE
════════════════════════════════════════════════

This certifies that Adeyemi, Chioma
Matric Number: CSC/2024/045
Department: Computer Science
Faculty: Computing

has fulfilled all financial obligations to
Obafemi Awolowo University for the 2023/2024 
academic year.

Required Fees:
  ✅ Faculty Due (₦5,000)
  ✅ Clearance Fee (₦500)

Total Amount Paid: ₦7,500
Clearance Date: June 27, 2026

This student is eligible for graduation.

Issued by: Finance Office, OAU
Powered by: FeeFlow

════════════════════════════════════════════════
Certificate ID: CERT_CSC_2024_045
Verification: feeflow.io/verify/CERT_CSC_2024_045
```

---

### Phase 5: Deferred Student (Temporary Status Change)

**Trigger:** Student goes on leave, deferred, or temporary withdrawal

**Process:**
```
1. Faculty marks student as DEFERRED:
   students.status = "DEFERRED"

2. System actions:
   - Virtual account marked INACTIVE (no new payments accepted)
   - No new fees auto-assigned
   - Existing fees remain (student still owes)
   - Clearance status frozen
   - Dashboard shows: "Your account is deferred"
   
3. When student returns:
   - Status changed back to ACTIVE
   - Virtual account reactivated
   - New fees assigned (for new semester)
   - Outstanding fees still due
```

**Use Cases:**
- Medical leave (semester break)
- Temporary financial hardship
- Visa processing delay (for international students)

**Status:** `DEFERRED`  
**Virtual Account:** INACTIVE (temporary)  
**Fees:** Frozen (no new assignments)  
**Clearance:** Frozen at current state

---

### Phase 6: Graduated Student (Alumni Status)

**Trigger:** Student completes degree and exits program

**Process:**
```
1. Faculty marks student as GRADUATED:
   students.status = "GRADUATED"

2. System actions:
   - Virtual account archived (no new payments)
   - All outstanding fees finalized
   - Clearance status finalized
   - Payment history preserved (for 7 years minimum)
   - Student record never deleted (compliance)
   
3. Alumni dashboard:
   - Can view payment history
   - Can download transcripts/clearance certs
   - Cannot be assigned new fees
   
4. Institution keeps data:
   - Alumni report (who graduated, when)
   - Payment patterns analysis
   - Revenue tracking
```

**Data Preservation:**
- No deletion (7-year audit trail required)
- Soft delete (mark as GRADUATED, not removed)
- Searchable in admin reports (by graduation year)

**Status:** `GRADUATED`  
**Virtual Account:** Archived  
**Fees:** Finalized (no changes)  
**Clearance:** Finalized (CLEARED or NOT_CLEARED at time of graduation)

---

## Fee Management

### Creating Fees (Admin)

**User:** Faculty Executive or Super Admin

**Process:**
```
1. Admin: "Create Fee Type"

2. Form fields:
   - Name (e.g., "Lab Fee")
   - Amount (₦2,000)
   - Description (e.g., "Laboratory usage and materials")
   - Is Clearance Required? (checkbox: yes/no)
   - Fiscal Year (2024/2025, etc.)

3. System stores in database:
   INSERT INTO fee_types (
     org_id, name, amount_naira, 
     description, is_clearance_required, created_at
   ) VALUES (
     'org_oau', 'Lab Fee', 200000,
     'Laboratory usage and materials', false, NOW()
   )

4. Auto-apply to students:
   - All ACTIVE students in that department get this fee
   - Status: UNPAID
   - Amount: ₦2,000
```

**Fee Types (Examples)**

| Fee Name | Amount | Clearance? | Who Pays | Note |
|----------|--------|-----------|---------|------|
| Faculty Due | ₦5,000 | Yes | All students | Development levy |
| Lab Fee | ₦2,000 | No | Tech majors only | (manual assignment) |
| Project Fee | ₦1,000 | No | FYP students | (manual assignment) |
| Clearance Fee | ₦500 | Yes | All at graduation | Must pay to graduate |
| Library Fee | ₦1,500 | No | All students | Optional renewal |
| Event Fee | ₦500 | No | Attending students | (manual assignment) |

---

### Assigning Fees to Students

**Scenario 1: Auto-Assignment (on creation)**
```
Admin creates "Faculty Due" (₦5,000)
  → Automatically assigned to all ACTIVE students
  → Students immediately see it in dashboard
```

**Scenario 2: Manual Assignment**
```
Admin creates "Lab Fee" (₦2,000)
  → Only assign to students taking lab courses
  → Admin selects: "Assign to Computer Science majors"
  → System filters: all CSC students with lab enrollment
  → Fee assigned to 150 students
```

**Scenario 3: Bulk Import**
```
Admin uploads CSV:
  matric_number, fee_type, amount
  CSC/2024/001, Lab Fee, 2000
  CSC/2024/002, Lab Fee, 2000
  CSC/2024/045, Project Fee, 1000
  
System assigns fees in bulk.
```

---

### Updating Fees

**Scenario: Mid-Year Fee Increase**
```
Q1 2026: Faculty Due = ₦5,000
Q3 2026: Faculty Due increased to ₦6,000

Admin action:
  - Create NEW fee type: "Faculty Due (Updated)" = ₦6,000
  - Existing students keep old fee (₦5,000)
  - New students get new fee (₦6,000)
  - System tracks versioning in audit log

Why? Fairness + compliance (don't retroactively increase fees)
```

**Never Edit Existing Fees:**
- Breaks reconciliation (payment allocated to wrong amount)
- Violates fairness (students charged differently)
- Breaks audit trail (impossible to reconstruct original amount)

---

## Reconciliation Engine

See detailed flow in `RECONCILIATION_FLOW.md`. Quick overview:

**Basic Flow:**
1. Nomba webhook arrives with payment
2. System identifies student (via virtual account)
3. System allocates payment to fees (oldest first, clearance-required first)
4. System updates fee status
5. System recalculates clearance
6. System sends receipt email
7. System returns success to Nomba

**Key Principles:**
- **Idempotent:** If webhook arrives twice, payment counted once (no double-billing)
- **Atomic:** Either payment is fully allocated or not at all (no partial success)
- **Auditable:** Every step logged for compliance
- **Fast:** Most payments reconciled in <1 second

---

## Clearance Engine

See detailed implementation in `RECONCILIATION_FLOW.md`. Quick overview:

**Rule:** To be cleared, student must have paid all fees where `fee_type.is_clearance_required = true`

**Calculation:**
```
SELECT 
  CASE 
    WHEN ALL(fee_type.is_clearance_required = true AND student_fee.status = 'PAID')
    THEN true
    ELSE false
  END as is_cleared
FROM student_fees
WHERE student_id = ?
  AND fee_type.is_clearance_required = true
```

**Triggers Recalculation:**
- After every payment reconciliation
- When admin manually overrides
- When fee status changes (disputed payment, refund)

**Output:**
- `clearance_status.is_cleared` (boolean)
- `clearance_status.cleared_at` (timestamp)
- Accessible via `/api/clearance/:student_id`

---

## Dashboards

### Student Dashboard

**URL:** `https://feeflow.io/dashboard/student`  
**Role:** Student only (own data)

**Sections:**
1. **Quick View**
   - Virtual Account Number (copy to clipboard)
   - Total Owed
   - Clearance Status
   - Action button: "Pay Now"

2. **Outstanding Fees**
   - Table: Fee Name | Amount | Paid | Balance | Status
   - Progress bars (% paid)
   - Due dates (if available)

3. **Payment History**
   - Table: Date | Amount | Fee | Status | Receipt
   - Most recent first
   - Downloadable receipts

4. **Clearance Certificate**
   - If CLEARED: Download PDF certificate
   - If NOT CLEARED: Show progress (X/Y fees paid)

---

### Department Dashboard

**URL:** `https://feeflow.io/dashboard/department`  
**Role:** Department Executive

**Sections:**
1. **Collection Summary**
   - Total revenue (this month, this year)
   - Number of students cleared
   - Outstanding amount
   - Collection rate (%)

2. **Department Fees**
   - List of all fee types
   - Create new fee
   - View student assignments

3. **Debtors List**
   - Table: Matric | Name | Fee | Amount Owed | Status
   - Sortable by amount owed
   - Export to CSV

4. **Transaction Log**
   - Recent payments (descending)
   - Filter by date, amount, status

5. **Reports**
   - Export collection report (CSV)
   - Export student list (CSV)

---

### Faculty Dashboard

**URL:** `https://feeflow.io/dashboard/faculty`  
**Role:** Faculty Executive

**Sections:**
1. **Faculty Summary**
   - Total revenue (all departments)
   - All students across departments
   - Aggregate collection rate

2. **Department Performance**
   - Comparison table: Department | Revenue | Students | Collection Rate
   - Visual charts (bar chart: revenue by department)

3. **Outstanding by Department**
   - Table: Department | Outstanding | % of Total

4. **Reports**
   - Export faculty-wide report

---

### Admin Dashboard

**URL:** `https://feeflow.io/dashboard/admin`  
**Role:** Finance Officer

**Sections:**
1. **Institution Overview**
   - Total revenue (all time, this month)
   - Total students (cleared/not cleared)
   - Collection rate (%)
   - Monthly revenue trend (chart)

2. **Critical Items**
   - Disputed payments (pending review)
   - Refund requests (pending approval)
   - Failed webhooks (need retry)

3. **Full Data Access**
   - Student lookup (search by name/matric)
   - Payment lookup (search by transaction ID)
   - Fee management
   - Audit log (all changes)

4. **Reports & Exports**
   - Financial statement (CSV, PDF)
   - Student list with balances
   - Debtors report
   - Compliance report (for audit)

---

## User Flows

### Flow 1: Student Pays Fee (Happy Path)

```
1. Student logs in
   Email → OTP → Dashboard

2. Student views virtual account:
   "1023456789"

3. Student (or parent) sends ₦7,500 to that account
   Via any Nigerian bank (using USSD, mobile app, etc.)

4. Nomba settles payment to FeeFlow

5. Nomba sends webhook to FeeFlow:
   "₦7,500 received to account 1023456789"

6. FeeFlow processes webhook:
   - Identifies student (CSC/2024/045)
   - Allocates payment
   - Updates fees (all marked PAID)
   - Recalculates clearance (CLEARED)
   - Generates receipt
   - Sends email

7. Within 30 seconds:
   Student receives receipt email with PDF

8. Student checks dashboard:
   "All fees paid ✅ Clearance: CLEARED ✅"

9. Student downloads clearance certificate

10. Student submits to graduation office
```

**Time:** ~1 minute (payment) + 30 sec (system processing) = 1.5 minutes total

---

### Flow 2: Admin Creates Department Fee

```
1. Department Treasurer logs in as "Department Executive"

2. Navigates to: Fees → Create New Fee

3. Fills form:
   - Name: "Lab Fee"
   - Amount: ₦2,000
   - Description: "Laboratory materials and supplies"
   - Clearance Required: No

4. Clicks "Create & Assign to All"

5. System:
   - Creates fee type
   - Finds all ACTIVE students in department (500)
   - Assigns fee to all 500 students
   - Emails admin confirmation

6. All 500 students see new fee on dashboard:
   "Lab Fee ₦2,000 (NEW)"

7. Treasurer can now track collection:
   - View debtors list
   - Export report
   - Follow up on outstanding
```

---

### Flow 3: Finance Officer Approves Refund

```
1. Student requests refund (overpaid ₦1,000)
   Dashboard → Request Refund → Submit

2. Request appears in Finance Officer queue:
   "CSC/2024/045 requesting ₦1,000 refund"

3. Finance Officer reviews:
   - Payment history (yes, overpaid)
   - Approval status: Approve

4. Finance Officer clicks "Approve Refund"

5. System:
   - Calls Nomba API to initiate transfer back to student's original account
   - Creates refund record
   - Updates credit balance
   - Sends email to student: "Refund approved, processing in 2 business days"

6. Student receives ₦1,000 in original account (2 business days)

7. System audit log shows:
   - Who approved
   - When
   - Amount
   - Nomba transaction ID (proof)
```

---

### Flow 4: Faculty Reviews Department Performance

```
1. Faculty Executive logs in

2. Views Faculty Dashboard:
   - See all departments in faculty
   - Collection rate per department
   - Revenue comparison (chart)

3. Notices Computer Science has low collection (80%)
   vs Software Engineering (95%)

4. Clicks "Computer Science" → Details

5. Sees:
   - 20 students not yet cleared
   - Top 5 debtors
   - Revenue this month

6. Exports report to share with CS department head:
   [Export as CSV]

7. Uses data to follow up on low performers
```

---

**End of Product Spec**

Next: Read `ARCHITECTURE.md` for technical decisions, then `DATABASE_SCHEMA.md` for data model.