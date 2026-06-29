import * as common from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { verifyWebhookSignature } from '@feeflow/core';

@common.Controller('webhooks')
export class WebhooksController {
  private readonly logger = new common.Logger(WebhooksController.name);

  constructor(
    @InjectQueue('payment-reconciliation') private readonly paymentQueue: Queue,
  ) {}

  @common.Post('nomba')
  @common.HttpCode(common.HttpStatus.OK) // Nomba expects an immediate 200 so it stops retrying.
  async handleNombaWebhook(
    @common.Req() req: common.RawBodyRequest<Request>,
    @common.Headers('x-nomba-signature') signature: string,
    @common.Body() payload: any,
  ) {
    // 1. Verify HMAC-SHA256 over the RAW body (constant-time; from @feeflow/core).
    // Whenever a secret is configured we ALWAYS verify — not gated on NODE_ENV,
    // so production can't be tricked into skipping the check.
    const secret = process.env.NOMBA_WEBHOOK_SECRET;
    const rawBody = req.rawBody?.toString('utf8') ?? '';

    if (secret) {
      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        this.logger.warn('Rejected Nomba webhook: signature verification failed');
        throw new common.UnauthorizedException('Invalid webhook signature');
      }
    } else {
      this.logger.warn(
        'NOMBA_WEBHOOK_SECRET is not set — skipping signature verification (DEV ONLY). Set it before going live.',
      );
    }

    // 2. Validate the payload shape. NOTE: field names follow the current Nomba
    //    integration; confirm against the live payload (docs use {event,data}).
    const { transactionId, amount, accountNumber } = payload ?? {};
    if (!transactionId || amount == null || !accountNumber) {
      throw new common.BadRequestException(
        'Payload missing required fields: transactionId, amount, accountNumber',
      );
    }

    // 3. Enqueue. jobId = transactionId gives idempotency at the queue layer
    //    (duplicate Nomba retries collapse to one job); the DB function is a
    //    second idempotency guard.
    await this.paymentQueue.add(
      'reconcile-job',
      {
        nombaTransactionId: transactionId,
        nombaReference: payload.orderReference,
        amountNaira: Number(amount),
        accountNumber,
        senderName: payload.senderName || 'Unknown Sender',
        senderAccount: payload.senderAccount || '0000000000',
      },
      {
        jobId: transactionId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return { received: true };
  }
}
