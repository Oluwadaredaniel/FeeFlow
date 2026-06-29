/**
 * Nomba webhook signature verification (HMAC-SHA256).
 *
 * Verify against the RAW request body BEFORE JSON.parse — re-serializing changes
 * bytes and breaks the signature. Comparison is constant-time to avoid leaking
 * the expected signature via timing (a hardening over the doc's `!==` compare).
 */
import * as crypto from 'node:crypto';

/** Compute the hex HMAC-SHA256 of the raw body with the shared secret. */
export function computeWebhookSignature(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/**
 * Constant-time check that `signature` matches HMAC-SHA256(rawBody, secret).
 * Returns false (never throws) on missing inputs or length mismatch.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!signature || !secret) return false;

  const expected = computeWebhookSignature(rawBody, secret);
  const provided = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // timingSafeEqual throws on unequal lengths — guard first.
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}
