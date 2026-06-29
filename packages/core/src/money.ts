/**
 * Money utilities. All internal amounts are integer **Kobo**.
 * Convert to/from Naira only at display or external boundaries.
 */
import type { Kobo } from './types';

export const KOBO_PER_NAIRA = 100;

/** Convert Naira (possibly fractional) to integer Kobo. */
export function nairaToKobo(naira: number): Kobo {
  if (!Number.isFinite(naira)) {
    throw new RangeError(`naira must be a finite number, got ${naira}`);
  }
  return Math.round(naira * KOBO_PER_NAIRA);
}

/** Convert integer Kobo to a Naira number (may be fractional). */
export function koboToNaira(kobo: Kobo): number {
  return kobo / KOBO_PER_NAIRA;
}

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format Kobo as a display string, e.g. 500000 -> "₦5,000.00". */
export function formatNaira(kobo: Kobo): string {
  return nairaFormatter.format(koboToNaira(kobo));
}

export function assertInteger(value: number, label = 'value'): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer (Kobo), got ${value}`);
  }
}

export function assertNonNegativeInteger(value: number, label = 'value'): void {
  assertInteger(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be >= 0, got ${value}`);
  }
}

export function assertPositiveInteger(value: number, label = 'value'): void {
  assertInteger(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be > 0, got ${value}`);
  }
}
