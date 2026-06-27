# Edge Cases: FeeFlow

**Version:** 1.0  
**Last Updated:** June 27, 2026  
**Purpose:** Prepare for every scenario judges might test

---

## Table of Contents

1. [Payment Edge Cases](#payment-edge-cases)
2. [Reconciliation Edge Cases](#reconciliation-edge-cases)
3. [Clearance Edge Cases](#clearance-edge-cases)
4. [Student Lifecycle Edge Cases](#student-lifecycle-edge-cases)
5. [System Resilience Edge Cases](#system-resilience-edge-cases)

---

## Payment Edge Cases

### 1. Duplicate Payment (Nomba Webhook Retry)

**Scenario:**
```
Payment 1: ₦5,000 to account 1023456789 (Txn ID: TXN_ABC123)
Network fails, Nomba retries
Payment 2: Same ₦5,000 to same account (Same Txn ID: TXN_ABC123)
```

**Problem:**
Without deduplication, payment counted twice, student sees ₦10,000 allocated.

**Solution:**
```sql
-- Database constraint prevents duplicate
ALTER TABLE payments
ADD CONSTRAINT unique_nomba_txn 
UNIQUE(org_id, nomba_transaction_id);

-- Webhook handler:
const existing = await db.payments.findOne({
  nomba_transaction_id: TXN_ABC123,
  org_id
});

if (existing) {
  return {
    reconciled: false,
    reason: 'Duplicate detected',
    payment_id: existing.id
  };
}
```

**Test:**
```typescript
// Send same webhook twice
POST /api/webhooks/nomba { ... TXN_ABC123 ... }
// Response 1: reconciled: true, payment_id: "payment-1"
POST /api/webhooks/nomba { ... TXN_ABC123 ... }
// Response 2: reconciled: false, payment_id: "payment-1" (same)
// Verify: Database has only 1 payment record
```

---

### 2. Overpayment (Payment Exceeds Total Owed)

**Scenario:**
```
Student owes: Faculty Due (₦5K) + Lab Fee (₦2K) + Clearance Fee (₦500) = ₦7,500 total
Student pays: ₦8,000
```

**Problem:**
₦500 extra unaccounted for.

**Solution:**
```sql
CREATE TABLE students (
  ...
  credit_balance INT DEFAULT 0  -- Store overpayment
)

-- On allocation:
remaining = 8000
Faculty Due: -5000 → remaining = 3000
Lab Fee: -2000 → remaining = 1000
Clearance Fee: -500 → remaining = 500

IF remaining > 0:
  UPDATE students SET credit_balance += remaining WHERE id = ?
  
-- Student can:
-- 1. Request refund (processed manually by finance officer)
-- 2. Auto-apply to next year's fees
```

**Test:**
```typescript
// Student pays ₦8,000 when owing ₦7,500
POST /api/webhooks/nomba { amount: 800000, ... }

// Verify:
// - All fees marked PAID
// - Student credit_balance = 50000 (₦500)
// - Dashboard shows: "You have ₦500 credit"
```

---

### 3. Underpayment (Partial Payment)

**Scenario:**
```
Student owes: ₦5,000
Student pays: ₦3,000
```

**Problem:**
Remaining ₦2,000 owed. Status should reflect partial payment.

**Solution:**
```sql
-- student_fees tracks both amount_due and amount_paid
UPDATE student_fees
SET 
  amount_paid = amount_paid + 3000,
  status = 'PARTIALLY_PAID',  -- Not PAID, not UNPAID
  amount_balance = amount_due - (amount_paid + 3000)
WHERE id = ?

-- Next payment (₦2,500):
UPDATE student_fees
SET 
  amount_paid = amount_paid + 2000,  -- Now 5000
  status = 'PAID',
  amount_balance = 0
WHERE id = ?
```

**Test:**
```typescript
// Payment 1: ₦3,000
POST /api/webhooks/nomba { amount: 300000, ... }
// Verify: status = 'PARTIALLY_PAID', balance = ₦2,000

// Payment 2: ₦2,500
POST /api/webhooks/nomba { amount: 250000, ... }
// Verify: status = 'PAID', balance = ₦0
```

---

### 4. Misdirected Payment (Wrong Virtual Account)

**Scenario:**
```
Payment: ₦5,000 to account 1023456790 (wrong account, should be 1023456789)
```

**Problem:**
System can't find student.

**Solution:**
```typescript
-- Webhook handler:
const virtualAccount = await db.virtual_accounts.findOne({
  account_number: '1023456790'
});

if (!virtualAccount) {
  // Create orphaned payment record
  await db.orphaned_payments.insert({
    account_number: '1023456790',
    amount: 500000,
    transaction_reference: 'TXN_...',
    sender_name: 'Unknown',
    status: 'AWAITING_REVIEW'
  });
  
  return {
    reconciled: false,
    reason: 'Account not found',
    action: 'Payment stored for manual review'
  };
}

-- Finance officer reviews orphaned payments
GET /api/admin/orphaned-payments
PATCH /api/admin/orphaned-payments/:id/resolve {
  student_id: 'correct_student_id',
  fee_type_id: 'specific_fee'
}
```

**Test:**
```typescript
// Send payment to wrong account
POST /api/webhooks/nomba {
  amount: 500000,
  destinationAccountNumber: '9999999999',  // Doesn't exist
  ...
}
// Verify: Response shows "Payment stored for manual review"
// Verify: Dashboard shows orphaned payment under admin section
```

---

### 5. Zero Amount Payment

**Scenario:**
```
Webhook arrives with amount: 0
```

**Problem:**
Invalid payment.

**Solution:**
```typescript
// Validation in webhook handler:
if (amount <= 0) {
  console.error('Invalid amount:', amount);
  return {
    reconciled: false,
    reason: 'Invalid amount',
    status_code: 400
  };
}
```

---

## Reconciliation Edge Cases

### 6. Concurrent Payments (Race Condition)

**Scenario:**
```
Webhook 1: ₦3,000 to account (processing)
Webhook 2: ₦2,000 to account (arrives immediately after)

Both process simultaneously:
- Webhook 1 reads: Faculty Due amount_paid = 0
- Webhook 2 reads: Faculty Due amount_paid = 0 (before Webhook 1 writes)
- Webhook 1 writes: amount_paid = 3000
- Webhook 2 writes: amount_paid = 2000 (overwrites!)
Result: Only ₦2,000 counted, ₦3,000 lost
```

**Problem:**
Race condition corrupts state.

**Solution:**
```sql
-- Use database row-level locking
BEGIN TRANSACTION
  SELECT * FROM student_fees WHERE id = ? FOR UPDATE;  -- LOCK ROW
  UPDATE student_fees SET amount_paid = amount_paid + allocation;
COMMIT TRANSACTION
-- Only one webhook can hold lock at a time

-- PostgreSQL handles this atomically
```

**PostgreSQL Implementation:**
```typescript
// Supabase uses PostgreSQL, which provides ACID guarantees
// When using transactions, Supabase handles row locking:

await supabase.rpc('allocate_payment', {
  p_student_id: studentId,
  p_allocations: allocations
  // Function uses: BEGIN ... SELECT FOR UPDATE ... COMMIT
  // Prevents race conditions automatically
});
```

**Test:**
```typescript
// Simulate concurrent payments
Promise.all([
  fetch('/api/webhooks/nomba', { body: payment1 }),
  fetch('/api/webhooks/nomba', { body: payment2 })
]);

// Verify:
// Total allocated = payment1 + payment2 (not one overwriting the other)
// Amount paid in DB = ₦5,000 (not ₦3,000 or ₦2,000)
```

---

### 7. Out-of-Order Webhook Delivery

**Scenario:**
```
Webhooks sent in order:
1. Payment ₦3,000 (sent at 14:00)
2. Payment ₦2,000 (sent at 14:05)

Arrive out-of-order (due to network delays):
1. Payment ₦2,000 (arrives at 14:06)
2. Payment ₦3,000 (arrives at 14:07)
```

**Problem:**
If allocation is based on arrival order, fees allocated wrong.

**Solution:**
```typescript
// Store webhook timestamp (when Nomba sent it, not when we received it)
const webhookTimestamp = payload.timestamp;  // From Nomba

// Sort by this timestamp before allocating
const sortedPayments = await db.payments
  .where({ student_id })
  .orderBy('webhook_received_at')
  .get();

// Then re-allocate all payments in order
// (Idempotent: re-allocating same payment twice = no change)
```

**Test:**
```typescript
// Send payments out of order
POST /api/webhooks/nomba { timestamp: '2026-07-01T14:05:00Z', amount: 200000 }
POST /api/webhooks/nomba { timestamp: '2026-07-01T14:00:00Z', amount: 300000 }

// Verify:
// System re-orders by timestamp internally
// Fee allocations match the correct order (3K first, then 2K)
```

---

### 8. Webhook Arrives Before Virtual Account Created

**Scenario:**
```
Payment arrives: ₦5,000 to account 1023456789
But student/account not yet created in FeeFlow
```

**Problem:**
Webhook handler can't find virtual account, payment lost.

**Solution:**
```typescript
// Store as orphaned payment
await db.orphaned_payments.insert({
  account_number: '1023456789',
  amount: 500000,
  transaction_reference: 'TXN_ABC123',
  status: 'PENDING_ACCOUNT'
});

// Background job (every 5 min): Check if account now exists
const orphaned = await db.orphaned_payments.where({ status: 'PENDING_ACCOUNT' });
for (const payment of orphaned) {
  const account = await db.virtual_accounts.findOne({
    account_number: payment.account_number
  });
  
  if (account) {
    // Account now exists, process payment
    await processPayment(payment);
    await db.orphaned_payments.update(payment.id, { status: 'PROCESSED' });
  }
}
```

**Test:**
```typescript
// Send payment before creating student
POST /api/webhooks/nomba {
  destinationAccountNumber: 'future_account_123',
  amount: 500000,
  ...
}
// Verify: Payment stored as orphaned

// Later: Create student
POST /api/students { ... }
// Verify: Student gets account 'future_account_123'

// Wait 5 min: Background job runs
// Verify: Orphaned payment auto-processed, fees updated
```

---

## Clearance Edge Cases

### 9. Clearance Revoked (Disputed Payment)

**Scenario:**
```
Student status: CLEARED
Later: Payment flagged as disputed (duplicate, fraud, etc.)
```

**Problem:**
Disputed payment removed from allocation, but student still shows CLEARED.

**Solution:**
```sql
-- When payment marked as disputed:
UPDATE payments
SET reconciliation_status = 'DISPUTED'
WHERE id = ?;

-- Trigger recalculation:
SELECT calculate_clearance(student_id);

-- Clearance now recalculates excluding disputed payment
-- If fees no longer fully paid, status = NOT_CLEARED
```

**Test:**
```typescript
// Get student with CLEARED status
GET /api/clearance/student-45
// Response: is_cleared: true

// Flag payment as disputed
POST /api/admin/payments/payment-123/dispute {
  reason: 'Duplicate transaction'
}

// Re-fetch clearance
GET /api/clearance/student-45
// Response: is_cleared: false (disputed payment excluded)
```

---

### 10. Fee Structure Changes Mid-Year

**Scenario:**
```
Q1 2026: Faculty Due = ₦5,000
Q3 2026: Faculty Due increased to ₦6,000

Students enrolled in Q1 should keep ₦5,000
Students enrolled after Q3 should owe ₦6,000
```

**Problem:**
Can't retroactively change amount (violates fairness).

**Solution:**
```sql
-- Create versioned fees
CREATE TABLE fee_types (
  id UUID,
  org_id UUID,
  name TEXT,
  amount_naira INT,
  version INT,
  effective_from DATE,
  effective_to DATE,
  status TEXT,  -- ACTIVE, ARCHIVED
  UNIQUE(org_id, name, version)
);

-- Q1 2026:
INSERT INTO fee_types (..., name='Faculty Due', amount=500000, version=1, ...)

-- Q3 2026 (don't edit v1, create v2):
INSERT INTO fee_types (..., name='Faculty Due', amount=600000, version=2, effective_from='2026-07-01', ...)

-- When assigning fees to new students:
SELECT * FROM fee_types 
WHERE name = 'Faculty Due'
  AND effective_from <= NOW()
  AND effective_to >= NOW()
  AND status = 'ACTIVE'
LIMIT 1;  -- Gets v2 for new students

-- Existing students keep v1 (grandfathered)
```

**Test:**
```typescript
// Create fee v1 (₦5,000)
POST /api/fee-types {
  name: 'Faculty Due',
  amount_naira: 500000,
  version: 1
}

// Student enrolled with v1
POST /api/students { ... }
// Verify: Assigned Faculty Due v1 (₦5,000)

// Create fee v2 (₦6,000) with future effective_from
POST /api/fee-types {
  name: 'Faculty Due',
  amount_naira: 600000,
  version: 2,
  effective_from: '2026-07-01'
}

// New student enrolled after effective_from
POST /api/students { created_at: '2026-07-05', ... }
// Verify: Assigned Faculty Due v2 (₦6,000)

// Original student still owes v1
// Verify: Dashboard shows ₦5,000 owed
```

---

### 11. Clearance Certificate Generation

**Scenario:**
```
Student graduated, requesting clearance certificate
But certificate wasn't generated when fees were paid
```

**Problem:**
Certificate doesn't exist, can't graduate.

**Solution:**
```typescript
// On-demand certificate generation
GET /api/clearance/:student_id/certificate

if (!student.is_cleared) {
  return 403 Forbidden;
}

// Generate PDF (on-demand)
const certificateHtml = generateClearanceCertificate({
  student,
  institution,
  cleared_at: student.cleared_at
});

const pdfBuffer = await generatePdf(certificateHtml);
return response.pdf(pdfBuffer);
```

**Test:**
```typescript
// Student is cleared
// Request certificate
GET /api/clearance/student-45/certificate
// Response: PDF download
```

---

## Student Lifecycle Edge Cases

### 12. Student Transfer (Department Change)

**Scenario:**
```
Student CSC/2024/045 transfers to SEN (Software Engineering)
Matric number changes to SEN/2024/045
Outstanding fees: Faculty Due ₦2,000, Lab Fee ₦0
```

**Problem:**
Old records orphaned, new records don't know about old fees.

**Solution:**
```typescript
// Soft-delete old student record, create new one
await db.students.update('student-45', {
  status: 'TRANSFERRED',
  transfer_to_student_id: 'student-new-id'
});

// Create new student record
const newStudent = await db.students.create({
  org_id,
  email,
  matric_number: 'SEN/2024/045',
  department: 'Software Engineering',
  status: 'ACTIVE'
});

// Copy outstanding fees (manual or automatic)
const oldFees = await db.student_fees.where({ student_id: 'student-45' });
for (const fee of oldFees) {
  if (fee.status !== 'PAID') {
    // Create new fee record for new student
    await db.student_fees.create({
      student_id: newStudent.id,
      fee_type_id: fee.fee_type_id,
      amount_due: fee.amount_balance  // Copy remaining balance
    });
  }
}

// Old virtual account archived
await db.virtual_accounts.update('va-45', {
  status: 'INACTIVE',
  archived_at: NOW()
});

// New virtual account created
await db.virtual_accounts.create({
  student_id: newStudent.id,
  account_number: 'NEW_ACCOUNT_NUMBER'
});
```

**Test:**
```typescript
// Transfer student
POST /api/admin/students/student-45/transfer {
  new_department: 'Software Engineering'
}

// Verify:
// - Old student marked TRANSFERRED
// - New student created
// - Fees carried over to new student
// - Virtual accounts updated
```

---

### 13. Deferred Student (Temporary Suspension)

**Scenario:**
```
Student deferred for medical leave (semester break)
Shouldn't receive new fees
Existing fees stay outstanding
```

**Problem:**
Auto-assignment of new fees still happens.

**Solution:**
```sql
-- Mark as deferred
UPDATE students SET status = 'DEFERRED' WHERE id = ?;
UPDATE virtual_accounts SET status = 'INACTIVE' WHERE student_id = ?;

-- Auto-assignment skips deferred students
INSERT INTO student_fees (student_id, fee_type_id, amount_due)
SELECT 
  s.id, ft.id, ft.amount_naira
FROM students s
CROSS JOIN fee_types ft
WHERE s.org_id = ft.org_id
  AND s.status = 'ACTIVE'  -- DEFERRED students skipped
  AND NOT EXISTS (
    SELECT 1 FROM student_fees sf
    WHERE sf.student_id = s.id
      AND sf.fee_type_id = ft.id
  );
```

**Test:**
```typescript
// Mark student as deferred
PATCH /api/students/student-45 {
  status: 'DEFERRED',
  date_deferred: '2026-07-01'
}

// Verify:
// - Student shows DEFERRED status
// - Virtual account shows INACTIVE
// - No new fees auto-assigned

// When student returns
PATCH /api/students/student-45 {
  status: 'ACTIVE'
}

// Verify:
// - Student shows ACTIVE
// - Virtual account reactivated
// - New fees can be assigned
```

---

### 14. Graduated Student (Alumni)

**Scenario:**
```
Student completes degree
Should never receive new fees
Records preserved forever (7-year retention)
```

**Problem:**
Deleting student data violates audit/compliance.

**Solution:**
```sql
-- Never delete, only mark
UPDATE students SET status = 'GRADUATED' WHERE id = ?;
UPDATE virtual_accounts SET status = 'ARCHIVED' WHERE student_id = ?;

-- Alumni can still access payment history
SELECT * FROM payments
WHERE student_id = ? AND status = 'GRADUATED';

-- No new fees
INSERT INTO student_fees
WHERE student.status NOT IN ('GRADUATED', 'TRANSFERRED')
```

**Test:**
```typescript
// Graduate student
PATCH /api/students/student-45 {
  status: 'GRADUATED',
  date_graduated: '2026-07-01'
}

// Verify:
// - Student shows GRADUATED
// - Can view payment history
// - Can download receipts/certificate
// - No new fees assigned
// - Database still has all records (no deletion)
```

---

## System Resilience Edge Cases

### 15. Silent Webhook Failure (Nomba API Issue)

**Scenario:**
```
Nomba processes payment successfully
But webhook delivery fails (Nomba server error)
Payment settles to institutional account
But FeeFlow never receives notification
```

**Problem:**
Payment received but student still owes money (system out of sync).

**Solution:**
```typescript
// Background reconciliation job (runs every 5 minutes)
async function reconcileWithNomba() {
  const institutions = await db.organizations.findAll();
  
  for (const org of institutions) {
    // Get last sync time
    const lastSync = await db.sync_state.get({
      org_id: org.id,
      service: 'NOMBA'
    });
    
    // Query Nomba for recent transactions
    const nombaTransactions = await nomba.getTransactions({
      accountNumber: org.nomba_sub_account_id,
      since: lastSync.last_sync_time
    });
    
    // Compare with our database
    for (const txn of nombaTransactions) {
      const existsInDb = await db.payments.findOne({
        nomba_transaction_id: txn.reference
      });
      
      if (!existsInDb) {
        // Missed webhook, process manually
        console.log(`Recovered missed payment: ${txn.reference}`);
        await processPayment({
          amount: txn.amount,
          destinationAccountNumber: txn.destination,
          transactionReference: txn.reference,
          timestamp: txn.timestamp
        });
      }
    }
    
    // Update sync time
    await db.sync_state.update({
      org_id: org.id,
      service: 'NOMBA',
      last_sync_time: NOW()
    });
  }
}

// Schedule every 5 minutes
cron.schedule('*/5 * * * *', reconcileWithNomba);
```

**Test:**
```typescript
// Manually block webhook
// Simulate by disabling webhook endpoint temporarily

// Send payment via Nomba (payment processes on Nomba side)

// Verify:
// - Student shows unpaid (webhook never arrived)
// - Background job runs (every 5 min)
// - Detected missed payment
// - Auto-reconciled, fees updated
// - Student now shows paid
```

---

### 16. Email Delivery Failure

**Scenario:**
```
Payment reconciled successfully
Email send fails (SendGrid quota, spam filter, etc.)
Student doesn't receive receipt
```

**Problem:**
Student can't verify they paid.

**Solution:**
```typescript
// 1. Queue email with retry logic
const { error } = await emailQueue.enqueue({
  recipient: studentEmail,
  template: 'PAYMENT_RECEIPT',
  data: { ... },
  retry_policy: {
    max_retries: 3,
    backoff: 'exponential'  // 1min, 5min, 15min
  }
});

// 2. Webhook returns 200 OK (payment reconciled)
// Email failure is non-blocking

// 3. Background job retries failed emails
async function retryFailedEmails() {
  const failed = await emailQueue.find({
    status: 'FAILED',
    retry_count: { $lt: 3 }
  });
  
  for (const email of failed) {
    try {
      await sendEmail(email);
      await emailQueue.update(email.id, { status: 'SENT' });
    } catch (err) {
      await emailQueue.update(email.id, {
        retry_count: email.retry_count + 1,
        last_error: err.message,
        next_retry_at: calculateNextRetry()
      });
    }
  }
}

// 4. Student can re-request receipt from dashboard
GET /api/payments/:payment_id/receipt
// Returns PDF, optionally re-sends email
```

**Test:**
```typescript
// Disable SendGrid (simulate failure)

// Send payment
POST /api/webhooks/nomba { ... }
// Response: reconciled: true (email failure is non-blocking)

// Student checks dashboard
// Sees: "Receipt available" with download button

// Re-request email
POST /api/payments/payment-123/send-receipt
// Email retried, eventually succeeds
```

---

### 17. Database Connection Failure

**Scenario:**
```
Webhook arrives, tries to update database
Database temporarily unavailable
```

**Problem:**
Webhook processor crashes, payment not recorded.

**Solution:**
```typescript
// 1. Retry logic in webhook handler
async function processNombaWebhook(payload) {
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      return await reconcilePayment(payload);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        retries--;
        await sleep(Math.pow(2, 3 - retries) * 1000);  // Exponential backoff
        lastError = err;
      } else {
        throw err;  // Non-retryable error
      }
    }
  }
  
  throw lastError;  // Return 500 to Nomba (will retry)
}

// 2. Return appropriate status code
if (error instanceof DatabaseError) {
  return NextResponse.json(
    { error: 'Database unavailable' },
    { status: 500 }
  );
  // Nomba will retry webhook automatically
}

// 3. Monitoring alerts
if (lastError) {
  await sendAlert({
    severity: 'WARNING',
    message: `Database unavailable: ${lastError.message}`,
    action: 'Check database status'
  });
}
```

**Test:**
```typescript
// Simulate database downtime
// Send payment webhook
POST /api/webhooks/nomba { ... }

// Verify:
// - Returns 500 error
// - Nomba retries webhook
// - Eventually succeeds when database recovers
// - No data loss
```

---

**All edge cases covered. Team should test these before submission day.**