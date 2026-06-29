import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Processor('payment-reconciliation')
@Injectable()
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[QUEUE CONSUMER] Processing background ledger reconciliation job: ${job.id}`);
    
    try {
      // Fires the core multi-tenant FIFO reconciliation logic
      const result = await this.webhooksService.processPayment(job.data);
      this.logger.log(`[QUEUE CONSUMER] Ledger updates completed for job ${job.id}`);
      return result;
    } catch (error) {
      this.logger.error(`[QUEUE ERROR] Processing failed for entry ${job.id}. Scheduling retry policy...`, error.stack);
      throw error; // Propagates back to BullMQ handler to trigger the exponential retry backoff
    }
  }
}