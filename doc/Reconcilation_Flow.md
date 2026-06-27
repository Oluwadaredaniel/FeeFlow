# Reconciliation Flow: FeeFlow

**Version:** 1.0  
**Last Updated:** June 27, 2026  
**Critical Path:** This is where reconciliation accuracy (judging criteria) is won/lost

---

## Table of Contents

1. [Payment Lifecycle](#payment-lifecycle)
2. [Webhook Processing](#webhook-processing)
3. [Payment Allocation Algorithm](#payment-allocation-algorithm)
4. [Clearance Calculation](#clearance-calculation)
5. [Idempotency & Deduplication](#idempotency--deduplication)
6. [Error Handling](#error-handling)
7. [Audit Trail](#audit-trail)

---

## Payment Lifecycle

### States and Transitions

```
Nomba               FeeFlow                         Database
  │
  ├─ [1] Payment received to virtual account
  │       Amount: ₦7,500
  │       Account: 1023456789
  │       Txn ID: TXN_ABC123
  │
  ├─ [2] Nomba settles to institutional account
  │
  ├─ [3] POST /api/webhooks/nomba
  │                    │
  │                    ├─ [4] Validate signature (HMAC-SHA256)
  │                    ├─ [5] Check for duplicates (nomba_transaction_id)
  │                    │
  │                    ├─ [6] Find student
  │                    │       SELECT student_id FROM virtual_accounts
  │                    │       WHERE account_number = '1023456789'
  │                    │       STATUS = 'ACTIVE'
  │                    │
  │                    ├─ [7] Find outstanding fees
  │                    │       SELECT * FROM student_fees
  │                    │       WHERE student_id = ?
  │                    │       AND status IN ('UNPAID', 'PARTIALLY_PAID')
  │                    │       ORDER BY created_at ASC
  │                    │
  │                    ├─ [8] Allocate payment to fees
  │                    │       Faculty Due: ₦5,000 (full)
  │                    │       Lab Fee: ₦2,000 (full)
  │                    │       Clearance Fee: ₦0 (exhausted)
  │                    │
  │                    ├─ [9] Update student_fees statuses
  │                    │       Faculty Due: PAID
  │                    │       Lab Fee: PAID
  │                    │       Clearance Fee: UNPAID
  │                    │
  │                    ├─ [10] Create payment record
  │                    │        status = SUCCESS
  │                    │        reconciliation_status = RECONCILED
  │                    │
  │                    ├─ [11] Create payment_allocations
  │                    │        Link payment to each fee
  │                    │
  │                    ├─ [12] Recalculate clearance
  │                    │        Check all required fees
  │                    │        Clearance status: NOT CLEARED
  │                    │        (Clearance Fee still unpaid)
  │                    │
  │                    ├─ [13] Generate receipt PDF
  │                    │
  │                    ├─ [14] Queue email send
  │                    │
  │                    ├─ [15] Create audit log entry
  │                    │
  │                    ├─ [16] Return 200 OK
  │
  ├─ (Nomba marks webhook delivered)
```

---

## Webhook Processing

### Step-by-Step Implementation

#### Step 1: Webhook Endpoint Setup

**File:** `app/api/webhooks/nomba/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // 1. Get request body as text (for signature verification)
    const body = await req.text();
    
    // 2. Validate signature
    const signature = req.headers.get('x-nomba-signature');
    const secret = process.env.NOMBA_WEBHOOK_SECRET;
    
    if (!signature || !secret) {
      return NextResponse.json(
        { error: 'Missing signature or secret' },
        { status: 401 }
      );
    }
    
    // 3. Verify HMAC
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    if (signature !== hash) {
      // Log security event
      console.error('Invalid webhook signature', { signature, hash });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // 4. Parse JSON (safe because we validated signature first)
    const payload = JSON.parse(body);
    
    // 5. Process webhook
    const result = await processNombaWebhook(payload);
    
    // 6. Return result
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

async function processNombaWebhook(payload: any) {
  const { event, data } = payload;
  
  if (event !== 'transfer.received') {
    return { ignored: true, reason: 'Not a transfer event' };
  }
  
  const {
    amount,
    destinationAccountNumber,
    transactionReference,
    senderName,
    senderAccount,
    timestamp
  } = data;
  
  // Step 2-16 continue below...
}
```

#### Step 2: Validate Webhook Data

```typescript
// Validate required fields
if (!amount || !destinationAccountNumber || !transactionReference) {
  throw new Error('Missing required webhook fields');
}

// Validate amount is positive
if (amount <= 0) {
  throw new Error('Invalid amount');
}

console.log(`[WEBHOOK] Received ₦${amount/100} to account ${destinationAccountNumber}`);
```

#### Step 3: Deduplicate by Transaction ID

```typescript
// Check if payment already exists
const { data: existingPayment, error: fetchError } = await supabase
  .from('payments')
  .select('id')
  .eq('nomba_transaction_id', transactionReference)
  .single();

if (existingPayment) {
  console.log('[WEBHOOK] Duplicate payment, ignoring:', transactionReference);
  return {
    reconciled: false,
    reason: 'Duplicate payment',
    payment_id: existingPayment.id
  };
}

if (fetchError && fetchError.code !== 'PGRST116') {
  // PGRST116 = not found (expected)
  throw new Error(`Database error: ${fetchError.message}`);
}
```

#### Step 4: Find Student by Virtual Account

```typescript
// This is speed-critical (index must be on account_number)
const { data: virtualAccount, error: vaError } = await supabase
  .from('virtual_accounts')
  .select('student_id, org_id')
  .eq('account_number', destinationAccountNumber)
  .eq('status', 'ACTIVE')
  .single();

if (vaError || !virtualAccount) {
  console.log('[WEBHOOK] Virtual account not found:', destinationAccountNumber);
  
  // Create orphaned payment record for manual review
  await createOrphanedPayment({
    account_number: destinationAccountNumber,
    amount,
    transaction_reference: transactionReference,
    sender_name: senderName
  });
  
  return {
    reconciled: false,
    reason: 'Virtual account not found',
    action: 'Payment stored for manual review'
  };
}

const studentId = virtualAccount.student_id;
const orgId = virtualAccount.org_id;

console.log(`[WEBHOOK] Payment for student: ${studentId}`);
```

#### Step 5: Find Outstanding Fees

```typescript
// Get all unpaid/partially paid fees for student, ordered by priority
const { data: outstandingFees, error: feesError } = await supabase
  .from('student_fees')
  .select('id, fee_type_id, amount_due, amount_paid, status')
  .eq('student_id', studentId)
  .in('status', ['UNPAID', 'PARTIALLY_PAID'])
  .order('created_at', { ascending: true });

if (feesError) {
  throw new Error(`Failed to fetch fees: ${feesError.message}`);
}

console.log(`[WEBHOOK] Found ${outstandingFees.length} outstanding fees`);

// If no fees, this is unexpected (student shouldn't have account if no fees)
if (outstandingFees.length === 0) {
  console.log('[WEBHOOK] Student has no outstanding fees');
  
  // Apply as credit to student balance
  await supabase
    .from('students')
    .update({ credit_balance: amount })
    .eq('id', studentId);
  
  return {
    reconciled: false,
    reason: 'No outstanding fees',
    action: 'Payment stored as credit'
  };
}
```

#### Step 6: Allocate Payment to Fees

```typescript
let remainingAmount = amount;
const allocations: { fee_id: string; amount: number }[] = [];

// For each fee, allocate payment
for (const fee of outstandingFees) {
  if (remainingAmount <= 0) break;
  
  const feeBalance = fee.amount_due - fee.amount_paid;
  
  if (remainingAmount >= feeBalance) {
    // Full payment of this fee
    allocations.push({
      fee_id: fee.id,
      amount: feeBalance
    });
    remainingAmount -= feeBalance;
  } else {
    // Partial payment of this fee
    allocations.push({
      fee_id: fee.id,
      amount: remainingAmount
    });
    remainingAmount = 0;
  }
}

console.log(`[WEBHOOK] Allocations: ${JSON.stringify(allocations)}`);
console.log(`[WEBHOOK] Remaining (credit): ₦${remainingAmount/100}`);
```

#### Step 7: Update Student Fees (Atomic Transaction)

```typescript
// Use database transaction for atomicity
const { error: updateError } = await supabase.rpc('allocate_payment', {
  p_student_id: studentId,
  p_allocations: allocations,
  p_remaining_amount: remainingAmount
});

if (updateError) {
  throw new Error(`Failed to allocate payment: ${updateError.message}`);
}

console.log('[WEBHOOK] Fees updated successfully');
```

**SQL Function (in database):**
```sql
CREATE OR REPLACE FUNCTION allocate_payment(
  p_student_id UUID,
  p_allocations JSONB,
  p_remaining_amount INT
) RETURNS VOID AS $$
BEGIN
  -- Update each fee
  FOR alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) 
               AS x(fee_id UUID, amount INT)
  LOOP
    UPDATE student_fees
    SET 
      amount_paid = amount_paid + alloc.amount,
      status = CASE 
        WHEN (amount_paid + alloc.amount) >= amount_due THEN 'PAID'
        WHEN (amount_paid + alloc.amount) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
      END,
      updated_at = NOW()
    WHERE id = alloc.fee_id;
  END LOOP;
  
  -- Store remaining as credit
  IF p_remaining_amount > 0 THEN
    UPDATE students
    SET credit_balance = credit_balance + p_remaining_amount
    WHERE id = p_student_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

#### Step 8: Create Payment Record

```typescript
const { data: payment, error: paymentError } = await supabase
  .from('payments')
  .insert({
    org_id: orgId,
    student_id: studentId,
    virtual_account_id: virtualAccount.id,
    amount_naira: amount,
    nomba_transaction_id: transactionReference,
    sender_name: senderName,
    sender_account: senderAccount,
    status: 'SUCCESS',
    reconciliation_status: 'RECONCILED',
    webhook_received_at: new Date(timestamp).toISOString(),
    reconciliation_completed_at: new Date().toISOString()
  })
  .select()
  .single();

if (paymentError) {
  throw new Error(`Failed to create payment: ${paymentError.message}`);
}

console.log(`[WEBHOOK] Payment record created: ${payment.id}`);
```

#### Step 9: Create Payment Allocations

```typescript
const allocationRecords = allocations.map(alloc => ({
  payment_id: payment.id,
  student_fee_id: alloc.fee_id,
  allocated_amount: alloc.amount
}));

const { error: allocError } = await supabase
  .from('payment_allocations')
  .insert(allocationRecords);

if (allocError) {
  throw new Error(`Failed to create allocations: ${allocError.message}`);
}

console.log(`[WEBHOOK] Created ${allocations.length} allocation records`);
```

#### Step 10: Recalculate Clearance

```typescript
const { data: clearanceData, error: clearanceError } = await supabase.rpc(
  'calculate_clearance',
  { p_student_id: studentId }
);

if (clearanceError) {
  throw new Error(`Failed to calculate clearance: ${clearanceError.message}`);
}

console.log(`[WEBHOOK] Clearance status: ${clearanceData.is_cleared ? 'CLEARED' : 'NOT CLEARED'}`);
```

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION calculate_clearance(p_student_id UUID)
RETURNS TABLE (is_cleared BOOLEAN, cleared_at TIMESTAMPTZ) AS $$
DECLARE
  v_is_cleared BOOLEAN;
  v_required_paid INT;
  v_required_total INT;
BEGIN
  -- Count required fees that are PAID
  SELECT COUNT(*) INTO v_required_paid
  FROM student_fees sf
  JOIN fee_types ft ON sf.fee_type_id = ft.id
  WHERE sf.student_id = p_student_id
    AND ft.is_clearance_required = true
    AND sf.status = 'PAID';
  
  -- Count total required fees
  SELECT COUNT(*) INTO v_required_total
  FROM student_fees sf
  JOIN fee_types ft ON sf.fee_type_id = ft.id
  WHERE sf.student_id = p_student_id
    AND ft.is_clearance_required = true;
  
  -- If all required fees are paid, mark as cleared
  v_is_cleared := (v_required_paid = v_required_total);
  
  -- Update clearance status
  INSERT INTO clearance_status (org_id, student_id, is_cleared, cleared_at)
  SELECT 
    s.org_id,
    p_student_id,
    v_is_cleared,
    CASE WHEN v_is_cleared THEN NOW() ELSE NULL END
  FROM students s
  WHERE s.id = p_student_id
  ON CONFLICT (student_id) DO UPDATE
  SET 
    is_cleared = v_is_cleared,
    cleared_at = CASE WHEN v_is_cleared THEN NOW() ELSE NULL END,
    last_calculated_at = NOW();
  
  RETURN QUERY
  SELECT is_cleared, cleared_at FROM clearance_status WHERE student_id = p_student_id;
END;
$$ LANGUAGE plpgsql;
```

#### Step 11: Generate Receipt

```typescript
const receiptHtml = generateReceiptHtml({
  student: { name: studentName, matric: matricNumber },
  payment: { amount, transactionId: transactionReference, date: timestamp },
  allocations: allocations,
  clearanceStatus: clearanceData
});

// Convert HTML to PDF
const pdfBuffer = await generatePdf(receiptHtml);

// Upload to storage
const { data: file, error: uploadError } = await supabase.storage
  .from('receipts')
  .upload(
    `${orgId}/${studentId}/${payment.id}.pdf`,
    pdfBuffer,
    { contentType: 'application/pdf' }
  );

if (uploadError) {
  console.error('Receipt upload failed (non-blocking):', uploadError);
  // Don't throw - email can be sent without receipt attached
}

console.log(`[WEBHOOK] Receipt generated: ${file?.path}`);
```

#### Step 12: Queue Email Send

```typescript
// Add to email queue (non-blocking)
const { error: emailError } = await supabase.from('email_queue').insert({
  org_id: orgId,
  student_id: studentId,
  payment_id: payment.id,
  recipient_email: studentEmail,
  template: 'PAYMENT_RECEIPT',
  subject: 'Payment Receipt – FeeFlow',
  data: {
    student_name: studentName,
    amount: amount / 100,
    transaction_id: transactionReference,
    receipt_url: file?.path,
    clearance_status: clearanceData.is_cleared
  },
  status: 'PENDING',
  retry_count: 0,
  max_retries: 3,
  created_at: new Date().toISOString()
});

if (emailError) {
  console.error('Email queue failed (non-blocking):', emailError);
}

console.log('[WEBHOOK] Email queued for sending');
```

#### Step 13: Create Audit Log

```typescript
const { error: auditError } = await supabase.from('audit_logs').insert({
  org_id: orgId,
  entity_type: 'PAYMENT',
  entity_id: payment.id,
  action: 'RECONCILED',
  old_value: { status: 'UNRECONCILED' },
  new_value: { 
    status: 'RECONCILED',
    allocations: allocations.length,
    clearance_updated: clearanceData.is_cleared
  },
  actor_email: 'system',
  actor_role: 'SYSTEM',
  created_at: new Date().toISOString()
});

console.log('[WEBHOOK] Audit log created');
```

#### Step 14: Return Success Response

```typescript
return {
  reconciled: true,
  student_id: studentId,
  payment_id: payment.id,
  amount_allocated: amount - remainingAmount,
  amount_credit: remainingAmount,
  fees_updated: allocations.length,
  clearance_status: {
    is_cleared: clearanceData.is_cleared,
    cleared_at: clearanceData.cleared_at
  },
  message: 'Payment reconciled successfully'
};
```

---

## Payment Allocation Algorithm

### Priority Ordering

**Key Principle:** Allocate to clearance-required fees first, then others.

**Algorithm:**
```typescript
function allocatePayment(fees: Fee[], amount: number): Allocation[] {
  // 1. Sort fees by priority
  const prioritized = fees.sort((a, b) => {
    // Clearance-required fees come first
    if (a.is_clearance_required && !b.is_clearance_required) return -1;
    if (!a.is_clearance_required && b.is_clearance_required) return 1;
    // Then by oldest created_at
    return a.created_at - b.created_at;
  });
  
  // 2. Allocate amount to each fee in order
  const allocations: Allocation[] = [];
  let remaining = amount;
  
  for (const fee of prioritized) {
    if (remaining <= 0) break;
    
    const balance = fee.amount_due - fee.amount_paid;
    const allocate = Math.min(remaining, balance);
    
    allocations.push({
      fee_id: fee.id,
      amount: allocate
    });
    
    remaining -= allocate;
  }
  
  return allocations;
}
```

**Example:**
```
Fees:
  1. Faculty Due (₦5,000) - is_clearance_required=true, created=2026-01-01
  2. Lab Fee (₦2,000) - is_clearance_required=false, created=2026-01-02
  3. Clearance Fee (₦500) - is_clearance_required=true, created=2026-06-01

After sorting by priority:
  1. Faculty Due (clearance req, oldest)
  2. Clearance Fee (clearance req, newer)
  3. Lab Fee (not clearance req)

Payment received: ₦7,500
Allocation:
  - Faculty Due: ₦5,000 (full) → remaining: ₦2,500
  - Clearance Fee: ₦500 (full) → remaining: ₦2,000
  - Lab Fee: ₦2,000 (full) → remaining: ₦0
```

---

## Clearance Calculation

### Definition

**A student is CLEARED when:**
- All fees where `fee_type.is_clearance_required = true` have `status = 'PAID'`

**Pseudo-code:**
```
required_fees = SELECT * FROM student_fees
                WHERE student_id = ?
                  AND fee_type.is_clearance_required = true

is_cleared = ALL(fee.status = 'PAID' for fee in required_fees)
```

### Recalculation Triggers

**Automatic recalculation when:**
1. Payment webhook is processed
2. Fee status changes (dispute, refund)
3. Admin manually overrides

**Manual recalculation:**
```typescript
// Force recalculate for debugging
POST /api/admin/clearance/:student_id/recalculate
```

### Output

**Clearance Status Record:**
```json
{
  "student_id": "student-45",
  "is_cleared": true,
  "cleared_at": "2026-07-01T14:30:00Z",
  "calculation_details": {
    "required_fees": [
      {
        "fee_type": "Faculty Due",
        "status": "PAID",
        "amount_due": 500000,
        "amount_paid": 500000
      },
      {
        "fee_type": "Clearance Fee",
        "status": "PAID",
        "amount_due": 50000,
        "amount_paid": 50000
      }
    ],
    "optional_fees": [
      {
        "fee_type": "Lab Fee",
        "status": "UNPAID",
        "amount_due": 200000,
        "amount_paid": 0
      }
    ]
  }
}
```

---

## Idempotency & Deduplication

### Why Idempotency Matters

**Scenario:** Nomba sends same webhook twice (network retry)

**Without idempotency:**
```
Webhook 1 arrives → Payment created, fees updated, ₦7,500 allocated
Webhook 2 arrives → Payment created again, fees updated again, ₦7,500 double-allocated
Result: Student shows ₦15,000 paid instead of ₦7,500 (WRONG)
```

**With idempotency:**
```
Webhook 1 arrives → Payment created, fees updated, ₦7,500 allocated
Webhook 2 arrives → Check: payment already exists → IGNORE
Result: Student correctly shows ₦7,500 paid (CORRECT)
```

### Implementation

**Database Constraint:**
```sql
-- nomba_transaction_id is UNIQUE per org
ALTER TABLE payments
ADD CONSTRAINT unique_nomba_txn_per_org 
UNIQUE(org_id, nomba_transaction_id);
```

**Webhook Check:**
```typescript
// Before processing, check if payment exists
const { data: existing } = await supabase
  .from('payments')
  .select('id')
  .eq('nomba_transaction_id', transactionReference)
  .eq('org_id', orgId)
  .single();

if (existing) {
  // Webhook is duplicate, ignore gracefully
  return {
    reconciled: false,
    reason: 'Duplicate payment',
    payment_id: existing.id
  };
}
```

---

## Error Handling

### Webhook Processing Errors

| Error | Cause | Action |
|-------|-------|--------|
| Invalid signature | Webhook tampered | Log security event, reject |
| Duplicate transaction | Nomba retry | Ignore gracefully, return payment_id |
| Virtual account not found | Typo/invalid account | Create orphaned payment, flag for review |
| Student not found | Account deactivated | Create orphaned payment |
| Database error | Connection issue | Return 500, Nomba will retry |
| Fee update fails | Concurrent update | Transaction prevents race condition |

### Webhook Retry Strategy

**If FeeFlow returns non-200:**
- Nomba will retry up to 5 times with exponential backoff
- FeeFlow will process duplicate idempotently (no harm)

**If FeeFlow returns 200 but something fails internally:**
- Email doesn't send → Retry job picks it up
- PDF generation fails → Email sent without attachment
- Audit log fails → Non-blocking (doesn't fail payment)

---

## Audit Trail

### Every Action Logged

```json
{
  "timestamp": "2026-07-01T14:30:00Z",
  "event": "PAYMENT_WEBHOOK_RECEIVED",
  "nomba_transaction_id": "TXN_ABC123XYZ",
  "student_id": "student-45",
  "amount": 750000,
  "source": "nomba_webhook",
  "details": {
    "sender_name": "Adeyemi John",
    "allocations": [
      { "fee_type": "Faculty Due", "amount": 500000 },
      { "fee_type": "Lab Fee", "amount": 200000 },
      { "fee_type": "Clearance Fee", "amount": 50000 }
    ],
    "clearance_status_before": { "is_cleared": false },
    "clearance_status_after": { "is_cleared": true }
  }
}
```

### Post-Incident Investigation

**Scenario:** Student claims ₦5,000 paid but system shows unpaid

**Investigation:**
```sql
-- 1. Check audit logs for student
SELECT * FROM audit_logs 
WHERE student_id = 'student-45' 
ORDER BY created_at DESC 
LIMIT 20;

-- 2. Check all payments for this student
SELECT * FROM payments 
WHERE student_id = 'student-45' 
ORDER BY created_at DESC;

-- 3. Check all fees and their status
SELECT * FROM student_fees 
WHERE student_id = 'student-45';

-- 4. Check payment allocations
SELECT pa.* FROM payment_allocations pa
JOIN payments p ON pa.payment_id = p.id
WHERE p.student_id = 'student-45'
ORDER BY pa.created_at DESC;
```

---

**Next:** Read ROADMAP.md for day-by-day implementation tasks.