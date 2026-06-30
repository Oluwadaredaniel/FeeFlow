import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { getQueueToken } from '@nestjs/bullmq';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let queue: any;

  beforeEach(async () => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: getQueueToken('payment-reconciliation'), useValue: queue },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should enqueue a payment reconciliation job', async () => {
    const payload = {
      data: {
        transactionReference: 'REF123',
        amount: 5000,
        destinationAccountNumber: '1234567890',
        senderName: 'John',
        senderAccount: '001122',
      },
    };

    const result = await controller.handleNombaWebhook(
      { rawBody: Buffer.from(JSON.stringify(payload)) } as any,
      'valid-sig', // Signature verification is skipped if secret is not set
      payload
    );

    expect(result).toEqual({ received: true });
    expect(queue.add).toHaveBeenCalledWith(
      'reconcile-job',
      expect.objectContaining({ nombaTransactionId: 'REF123' }),
      expect.any(Object)
    );
  });
});
