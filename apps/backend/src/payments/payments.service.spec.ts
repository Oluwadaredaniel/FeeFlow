import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let db: any;

  beforeEach(async () => {
    db = {
      client: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: SupabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should calculate debtors correctly', async () => {
    const mockData = [
      {
        id: 's1',
        matric_number: 'M1',
        first_name: 'F1',
        last_name: 'L1',
        student_fees: [
          { amount_balance: 5000, due_date: '2023-01-01', fee_types: { name: 'Fee1' }, status: 'UNPAID' },
          { amount_balance: 2000, due_date: '2023-02-01', fee_types: { name: 'Fee2' }, status: 'PARTIALLY_PAID' },
        ],
      },
    ];

    (db.client.gt as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await service.getDebtors('org1', {});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].total_owed).toBe(7000);
    expect(result.summary.students_owing).toBe(1);
    expect(result.summary.total_outstanding).toBe(7000);
  });
});
