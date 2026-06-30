import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../common/audit/audit.service';
import { NombaService } from '../common/nomba/nomba.service';
import { ConflictException } from '@nestjs/common';

describe('StudentsService', () => {
  let service: StudentsService;
  let db: any;
  let audit: any;
  let nomba: any;

  const mockOrgId = 'org-123';
  const mockActor = { email: 'admin@test.com', role: 'ADMIN' };

  beforeEach(async () => {
    db = {
      client: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    nomba = {
      createVirtualAccount: jest.fn().mockResolvedValue({
        accountNumber: '1234567890',
        bankName: 'Nomba',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: SupabaseService, useValue: db },
        { provide: AuditService, useValue: audit },
        { provide: NombaService, useValue: nomba },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if student already exists', async () => {
      db.client.maybeSingle.mockResolvedValue({ data: { id: 'existing-id' }, error: null });

      await expect(service.create(mockOrgId, { email: 'test@test.com', matric_number: '123' } as any, mockActor))
        .rejects.toThrow(ConflictException);
    });

    it('should create a student and a virtual account', async () => {
      db.client.maybeSingle.mockResolvedValue({ data: null, error: null });
      db.client.single
        .mockResolvedValueOnce({ data: { id: 'new-id', last_name: 'Doe', first_name: 'John', email: 'test@test.com' }, error: null }) // Create student
        .mockResolvedValueOnce({ data: { id: 'va-id', account_number: '1234567890' }, error: null }); // Create VA

      const result = await service.create(mockOrgId, {
        email: 'test@test.com',
        matric_number: '123',
        first_name: 'John',
        last_name: 'Doe'
      } as any, mockActor);

      expect(result).toBeDefined();
      expect(db.client.insert).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATED',
        entityType: 'STUDENT',
      }));
    });
  });
});
