import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentProcessor } from './payment.processor';

@Module({
  imports: [
    // Register the isolated channel into the structural module scope
    BullModule.registerQueue({
      name: 'payment-reconciliation',
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, PaymentProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
