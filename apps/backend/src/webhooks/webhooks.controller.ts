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
  @common.HttpCode(common.HttpStatus.OK)
  async handleNombaWebhook(
    @common.Req() req: common.RawBodyRequest<Request>,
    @common.Headers('x-nomba-signature') signature: string,
    @common.Body() payload: any,
  ) {
    const secret = process.env.NOMBA_WEBHOOK_SECRET;
    const rawBody = req.rawBody?.toString('utf8') ?? '';

    if (secret) {
      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        this.logger.warn('Rejected Nomba webhook: signature verification failed');
        throw new common.UnauthorizedException('Invalid webhook signature');
      }
    }

    // Defensive check for payload
    if (!payload || !payload.data) {
      this.logger.error('Received malformed Nomba webhook payload');
      throw new common.BadRequestException('Malformed payload');
    }

    const { transactionReference, amount, destinationAccountNumber, senderName, senderAccount } = payload.data;

    if (!transactionReference || amount == null || !destinationAccountNumber) {
      this.logger.error(`Missing required fields in webhook: ${JSON.stringify(payload.data)}`);
      throw new common.BadRequestException('Missing required fields');
    }

    // Idempotency: use transactionReference as jobId
    await this.paymentQueue.add(
      'reconcile-job',
      {
        nombaTransactionId: transactionReference,
        nombaReference: payload.data.transactionReference, // Or another ref if available
        amountNaira: Number(amount),
        accountNumber: destinationAccountNumber,
        senderName: senderName || 'Unknown Sender',
        senderAccount: senderAccount || '0000000000',
      },
      {
        jobId: transactionReference,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    this.logger.log(`Enqueued reconciliation job for txn ${transactionReference}`);
    return { received: true };
  }
}
