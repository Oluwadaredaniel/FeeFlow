/**
 * Payment reconciliation engine — the core of FeeFlow.
 *
 * Pure, deterministic, side-effect-free. Given a student's outstanding fees and
 * an incoming payment amount (Kobo), it decides exactly how the payment is split
 * across fees and what each fee's new state becomes. The caller persists the
 * result inside a DB transaction (see doc/Reconciliation_Flow.md, allocate_payment()).
 *
 * Allocation priority (canonical — from the "Payment Allocation Algorithm" section):
 *   1. Clearance-required fees first (maximizes clearance outcomes).
 *   2. Within the same priority, oldest fee first (by created_at ascending).
 * The payment is then applied greedily, fully settling each fee before moving on.
 * Any leftover becomes student credit (overpayment).
 */
import type { Kobo, FeeStatus, UUID, ISODateTime } from './types';

export class ReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

/** Minimal shape of a student fee required to allocate a payment. */
export interface AllocatableFee {
  id: UUID;
  amountDue: Kobo;
  amountPaid: Kobo;
  isClearanceRequired: boolean;
  createdAt: ISODateTime;
}

export interface Allocation {
  studentFeeId: UUID;
  amount: Kobo;
}

export interface UpdatedFeeState {
  id: UUID;
  allocated: Kobo;
  previousAmountPaid: Kobo;
  newAmountPaid: Kobo;
  previousStatus: FeeStatus;
  newStatus: FeeStatus;
}

export interface AllocationResult {
  /** Per-fee allocations, in priority order. Persist as payment_allocations rows. */
  allocations: Allocation[];
  /** New state for each touched fee. Persist onto student_fees. */
  updatedFees: UpdatedFeeState[];
  /** Sum of all allocations (Kobo). */
  totalAllocated: Kobo;
  /** Leftover after settling all fees — becomes student credit_balance (Kobo). */
  remainingCredit: Kobo;
}

/** Derive a fee's status from its paid/due amounts. */
export function deriveFeeStatus(amountPaid: Kobo, amountDue: Kobo): FeeStatus {
  if (amountPaid >= amountDue) return 'PAID';
  if (amountPaid > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
}

/**
 * Order fees for allocation: clearance-required first, then oldest first.
 * Returns a new array; does not mutate the input.
 */
export function prioritizeFees<T extends AllocatableFee>(fees: readonly T[]): T[] {
  return [...fees].sort((a, b) => {
    if (a.isClearanceRequired !== b.isClearanceRequired) {
      return a.isClearanceRequired ? -1 : 1;
    }
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    return 0;
  });
}

function assertFeeAmounts(fee: AllocatableFee): void {
  if (!Number.isInteger(fee.amountDue) || fee.amountDue < 0) {
    throw new ReconciliationError(
      `fee ${fee.id} amountDue must be a non-negative integer (Kobo), got ${fee.amountDue}`,
    );
  }
  if (!Number.isInteger(fee.amountPaid) || fee.amountPaid < 0) {
    throw new ReconciliationError(
      `fee ${fee.id} amountPaid must be a non-negative integer (Kobo), got ${fee.amountPaid}`,
    );
  }
  if (fee.amountPaid > fee.amountDue) {
    throw new ReconciliationError(
      `fee ${fee.id} is over-paid (amountPaid ${fee.amountPaid} > amountDue ${fee.amountDue})`,
    );
  }
}

/**
 * Allocate an incoming payment across outstanding fees.
 *
 * @param fees   Outstanding fees (UNPAID / PARTIALLY_PAID). Already-settled fees
 *               are skipped defensively. The array is not mutated.
 * @param amount Incoming payment in Kobo. Must be a positive integer.
 * @throws ReconciliationError on invalid amount or invalid fee amounts.
 */
export function allocatePayment(
  fees: readonly AllocatableFee[],
  amount: Kobo,
): AllocationResult {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ReconciliationError(
      `payment amount must be a positive integer (Kobo), got ${amount}`,
    );
  }

  const prioritized = prioritizeFees(fees);
  const allocations: Allocation[] = [];
  const updatedFees: UpdatedFeeState[] = [];
  let remaining = amount;

  for (const fee of prioritized) {
    assertFeeAmounts(fee);

    const balance = fee.amountDue - fee.amountPaid;
    if (balance <= 0) continue; // already settled — skip
    if (remaining <= 0) break; // payment exhausted

    const allocate = Math.min(remaining, balance);
    const newAmountPaid = fee.amountPaid + allocate;

    allocations.push({ studentFeeId: fee.id, amount: allocate });
    updatedFees.push({
      id: fee.id,
      allocated: allocate,
      previousAmountPaid: fee.amountPaid,
      newAmountPaid,
      previousStatus: deriveFeeStatus(fee.amountPaid, fee.amountDue),
      newStatus: deriveFeeStatus(newAmountPaid, fee.amountDue),
    });

    remaining -= allocate;
  }

  return {
    allocations,
    updatedFees,
    totalAllocated: amount - remaining,
    remainingCredit: remaining,
  };
}
