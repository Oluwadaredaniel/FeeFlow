import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allocatePayment,
  prioritizeFees,
  deriveFeeStatus,
  ReconciliationError,
  type AllocatableFee,
} from './reconciliation';
import { calculateClearance, type ClearanceFee } from './clearance';
import { computeWebhookSignature, verifyWebhookSignature } from './webhook';
import { nairaToKobo, koboToNaira, formatNaira } from './money';

// Helper: build a fee with sensible defaults (amounts in Kobo).
function fee(partial: Partial<AllocatableFee> & { id: string }): AllocatableFee {
  return {
    amountDue: 100000,
    amountPaid: 0,
    isClearanceRequired: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// deriveFeeStatus
// ---------------------------------------------------------------------------
test('deriveFeeStatus: unpaid / partial / paid', () => {
  assert.equal(deriveFeeStatus(0, 500000), 'UNPAID');
  assert.equal(deriveFeeStatus(300000, 500000), 'PARTIALLY_PAID');
  assert.equal(deriveFeeStatus(500000, 500000), 'PAID');
  assert.equal(deriveFeeStatus(600000, 500000), 'PAID');
});

// ---------------------------------------------------------------------------
// allocatePayment — happy paths
// ---------------------------------------------------------------------------
test('exact payment settles a single fee fully', () => {
  const fees = [fee({ id: 'a', amountDue: 500000 })];
  const r = allocatePayment(fees, 500000);

  assert.deepEqual(r.allocations, [{ studentFeeId: 'a', amount: 500000 }]);
  assert.equal(r.totalAllocated, 500000);
  assert.equal(r.remainingCredit, 0);
  assert.equal(r.updatedFees[0]!.newStatus, 'PAID');
});

test('underpayment leaves the fee PARTIALLY_PAID with no credit', () => {
  const fees = [fee({ id: 'a', amountDue: 500000 })];
  const r = allocatePayment(fees, 300000);

  assert.equal(r.totalAllocated, 300000);
  assert.equal(r.remainingCredit, 0);
  assert.equal(r.updatedFees[0]!.newAmountPaid, 300000);
  assert.equal(r.updatedFees[0]!.newStatus, 'PARTIALLY_PAID');
});

test('overpayment settles the fee and returns the remainder as credit', () => {
  const fees = [fee({ id: 'a', amountDue: 500000 })];
  const r = allocatePayment(fees, 700000);

  assert.equal(r.totalAllocated, 500000);
  assert.equal(r.remainingCredit, 200000);
  assert.equal(r.updatedFees[0]!.newStatus, 'PAID');
});

test('continues a partially-paid fee from its existing balance', () => {
  const fees = [fee({ id: 'a', amountDue: 500000, amountPaid: 200000 })];
  const r = allocatePayment(fees, 300000);

  assert.equal(r.allocations[0]!.amount, 300000);
  assert.equal(r.updatedFees[0]!.newAmountPaid, 500000);
  assert.equal(r.updatedFees[0]!.newStatus, 'PAID');
  assert.equal(r.remainingCredit, 0);
});

// ---------------------------------------------------------------------------
// allocatePayment — priority ordering (the doc's worked example, in Kobo)
// ---------------------------------------------------------------------------
test('allocates clearance-required fees first, then oldest', () => {
  const facultyDue = fee({
    id: 'faculty',
    amountDue: 500000,
    isClearanceRequired: true,
    createdAt: '2026-01-01T00:00:00Z',
  });
  const labFee = fee({
    id: 'lab',
    amountDue: 200000,
    isClearanceRequired: false,
    createdAt: '2026-01-02T00:00:00Z',
  });
  const clearanceFee = fee({
    id: 'clearance',
    amountDue: 50000,
    isClearanceRequired: true,
    createdAt: '2026-06-01T00:00:00Z',
  });

  // Intentionally out of order on input.
  const r = allocatePayment([labFee, clearanceFee, facultyDue], 750000);

  assert.deepEqual(r.allocations, [
    { studentFeeId: 'faculty', amount: 500000 },
    { studentFeeId: 'clearance', amount: 50000 },
    { studentFeeId: 'lab', amount: 200000 },
  ]);
  assert.equal(r.totalAllocated, 750000);
  assert.equal(r.remainingCredit, 0);
  assert.ok(r.updatedFees.every((f) => f.newStatus === 'PAID'));
});

test('prioritizeFees does not mutate the input array', () => {
  const input = [
    fee({ id: 'b', createdAt: '2026-02-01T00:00:00Z' }),
    fee({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
  ];
  const snapshot = input.map((f) => f.id);
  prioritizeFees(input);
  assert.deepEqual(
    input.map((f) => f.id),
    snapshot,
  );
});

// ---------------------------------------------------------------------------
// allocatePayment — edge cases
// ---------------------------------------------------------------------------
test('skips already-settled fees', () => {
  const settled = fee({ id: 'settled', amountDue: 500000, amountPaid: 500000 });
  const open = fee({ id: 'open', amountDue: 200000, createdAt: '2026-03-01T00:00:00Z' });
  const r = allocatePayment([settled, open], 200000);

  assert.equal(r.allocations.length, 1);
  assert.equal(r.allocations[0]!.studentFeeId, 'open');
  assert.equal(r.remainingCredit, 0);
});

test('no outstanding fees -> entire payment becomes credit', () => {
  const r = allocatePayment([], 100000);
  assert.deepEqual(r.allocations, []);
  assert.equal(r.totalAllocated, 0);
  assert.equal(r.remainingCredit, 100000);
});

test('rejects non-positive and non-integer amounts', () => {
  const fees = [fee({ id: 'a' })];
  assert.throws(() => allocatePayment(fees, 0), ReconciliationError);
  assert.throws(() => allocatePayment(fees, -500), ReconciliationError);
  assert.throws(() => allocatePayment(fees, 1.5), ReconciliationError);
});

// ---------------------------------------------------------------------------
// calculateClearance
// ---------------------------------------------------------------------------
function cfee(partial: Partial<ClearanceFee>): ClearanceFee {
  return {
    isClearanceRequired: false,
    status: 'UNPAID',
    amountDue: 100000,
    amountPaid: 0,
    ...partial,
  };
}

test('cleared when all required fees are paid', () => {
  const r = calculateClearance([
    cfee({ isClearanceRequired: true, status: 'PAID' }),
    cfee({ isClearanceRequired: true, status: 'PAID' }),
    cfee({ isClearanceRequired: false, status: 'UNPAID' }),
  ]);
  assert.equal(r.isCleared, true);
  assert.equal(r.requiredTotal, 2);
  assert.equal(r.requiredPaid, 2);
  assert.equal(r.optionalFees.length, 1);
});

test('not cleared when a required fee is unpaid', () => {
  const r = calculateClearance([
    cfee({ isClearanceRequired: true, status: 'PAID' }),
    cfee({ isClearanceRequired: true, status: 'PARTIALLY_PAID' }),
  ]);
  assert.equal(r.isCleared, false);
});

test('trivially cleared when there are no required fees', () => {
  const r = calculateClearance([cfee({ isClearanceRequired: false, status: 'UNPAID' })]);
  assert.equal(r.isCleared, true);
  assert.equal(r.requiredTotal, 0);
});

// ---------------------------------------------------------------------------
// webhook signature
// ---------------------------------------------------------------------------
test('verifies a correct webhook signature and rejects tampering', () => {
  const secret = 'nomba-test-secret';
  const body = JSON.stringify({ event: 'transfer.received', data: { amount: 750000 } });
  const sig = computeWebhookSignature(body, secret);

  assert.equal(verifyWebhookSignature(body, sig, secret), true);
  assert.equal(verifyWebhookSignature(body + ' ', sig, secret), false); // tampered body
  assert.equal(verifyWebhookSignature(body, 'deadbeef', secret), false); // wrong sig
  assert.equal(verifyWebhookSignature(body, sig, 'wrong-secret'), false); // wrong secret
  assert.equal(verifyWebhookSignature(body, null, secret), false); // missing sig
  assert.equal(verifyWebhookSignature(body, sig, null), false); // missing secret
});

// ---------------------------------------------------------------------------
// money
// ---------------------------------------------------------------------------
test('money conversions are exact integers', () => {
  assert.equal(nairaToKobo(5000), 500000);
  assert.equal(nairaToKobo(50.5), 5050);
  assert.equal(koboToNaira(500000), 5000);
  assert.ok(formatNaira(500000).includes('5,000'));
});
