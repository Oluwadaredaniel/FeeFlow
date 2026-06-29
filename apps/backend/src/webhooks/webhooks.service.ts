import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Shape of the job enqueued by WebhooksController. */
interface ReconcileJobData {
  nombaTransactionId: string;
  nombaReference: string;
  amountNaira: number; // NOTE: confirm Nomba's unit — see conversion below.
  accountNumber: string;
  senderName: string;
  senderAccount: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      // accept either env name to avoid silent misconfig
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '',
    );
  }

  /**
   * Reconcile one incoming payment. Runs inside a BullMQ worker, so throwing
   * triggers the queue's retry/backoff; returning resolves the job.
   *
   * The actual money movement is a SINGLE atomic Postgres function,
   * `reconcile_payment()`, which locks the student's fees FOR UPDATE, allocates
   * (clearance-required fees first, then oldest), writes the payment +
   * allocations, credits overpayment, recomputes clearance, and audits — all in
   * one transaction. This is what makes concurrent payments to the same student
   * race-safe (see supabase/migrations/0002_functions.sql).
   */
  async processPayment(data: ReconcileJobData) {
    const {
      nombaTransactionId,
      nombaReference,
      amountNaira,
      accountNumber,
      senderName,
      senderAccount,
    } = data;

    // 1. Identity: map destination account -> student/org (the judged identity model).
    const { data: va, error: vaErr } = await this.supabase
      .from('virtual_accounts')
      .select('id, org_id, student_id')
      .eq('account_number', accountNumber)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (vaErr) {
      // Transient DB error — throw so BullMQ retries with backoff.
      throw new Error(`virtual_accounts lookup failed: ${vaErr.message}`);
    }

    if (!va) {
      // Orphaned / misdirected payment: unknown account. Retrying won't help, so
      // DO NOT throw (avoids a retry storm). Flag for manual review instead.
      // TODO(handoff): persist these in an `orphaned_payments` table for the
      //   admin "orphaned payments" review screen (GET /api/payments/orphaned).
      this.logger.warn(
        `[ORPHANED] No active virtual account for ${accountNumber} (txn ${nombaTransactionId}) — flagged for manual review.`,
      );
      return {
        reconciled: false,
        reason: 'ORPHANED_NO_VIRTUAL_ACCOUNT',
        accountNumber,
        nombaTransactionId,
      };
    }

    // 2. Boundary conversion: internal money is integer Kobo.
    // NOTE: confirm Nomba's `amount` unit against a real payload. If Nomba already
    // sends Kobo, drop this *100 — do the conversion ONCE, only here at the edge.
    const amountKobo = Math.round(amountNaira * 100);

    // 3. Atomic reconciliation via RPC.
    const { data: result, error: rpcErr } = await this.supabase.rpc('reconcile_payment', {
      p_org_id: va.org_id,
      p_student_id: va.student_id,
      p_virtual_account_id: va.id,
      p_amount: amountKobo,
      p_nomba_transaction_id: nombaTransactionId,
      p_nomba_reference: nombaReference,
      p_sender_name: senderName,
      p_sender_account: senderAccount,
      p_webhook_received_at: new Date().toISOString(),
    });

    if (rpcErr) {
      // Transient — throw for BullMQ retry. Genuine duplicates are handled inside
      // the function and returned as { reconciled: false, reason: 'DUPLICATE' }.
      throw new Error(`reconcile_payment RPC failed: ${rpcErr.message}`);
    }

    this.logger.log(`[RECONCILED] txn ${nombaTransactionId}: ${JSON.stringify(result)}`);
    return result;
  }
}
