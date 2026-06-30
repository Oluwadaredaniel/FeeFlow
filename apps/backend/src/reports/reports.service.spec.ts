import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let db: any;

  beforeEach(async () => {
    db = {
      client: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: SupabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should generate collection report', async () => {
    // Setup sequential mock returns for different from() calls
    db.client.single.mockResolvedValue({ data: { name: 'OAU' }, error: null });

    // For the other calls, eq() just returns the data directly (since they don't call .single())
    (db.client.eq as jest.Mock)
      .mockReturnValueOnce(db.client) // for organizations (followed by .single)
      .mockResolvedValueOnce({ data: [{ id: 's1', clearance_status: [{ is_cleared: true }] }], error: null }) // students
      .mockResolvedValueOnce({ data: [{ amount_naira: 10000 }], error: null }) // payments
      .mockResolvedValueOnce({ data: [{ amount_due: 5000, amount_paid: 5000, fee_types: { name: 'Fee1' } }], error: null }); // fees

    const result = await service.getCollectionReport('org1', {});

    expect(result.summary.total_revenue).toBe(10000);
    expect(result.summary.students_cleared).toBe(1);
    expect(result.by_fee_type[0].fee_type).toBe('Fee1');
    expect(result.by_fee_type[0].collection_rate).toBe(100);
  });
});
