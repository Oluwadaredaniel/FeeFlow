/**
 * Clearance calculation.
 *
 * A student is CLEARED when every fee whose fee_type.is_clearance_required = true
 * has status = 'PAID'. Mirrors the DB function calculate_clearance()
 * (doc/Reconciliation_Flow.md): a student with zero clearance-required fees is
 * trivially cleared (0 required paid === 0 required total).
 */
import type { Kobo, FeeStatus } from './types';

export interface ClearanceFee {
  feeTypeName?: string;
  isClearanceRequired: boolean;
  status: FeeStatus;
  amountDue: Kobo;
  amountPaid: Kobo;
}

export interface ClearanceResult {
  isCleared: boolean;
  requiredTotal: number;
  requiredPaid: number;
  requiredFees: ClearanceFee[];
  optionalFees: ClearanceFee[];
}

export function calculateClearance(fees: readonly ClearanceFee[]): ClearanceResult {
  const requiredFees = fees.filter((f) => f.isClearanceRequired);
  const optionalFees = fees.filter((f) => !f.isClearanceRequired);
  const requiredPaid = requiredFees.filter((f) => f.status === 'PAID').length;
  const requiredTotal = requiredFees.length;

  return {
    isCleared: requiredPaid === requiredTotal,
    requiredTotal,
    requiredPaid,
    requiredFees,
    optionalFees,
  };
}
