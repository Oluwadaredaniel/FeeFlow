import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('FeeFlow Master Lifecycle (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentId: string;
  let virtualAccount: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Auth: Should login as Admin and get JWT', async () => {
    // Note: This assumes your local DB has an organization with this admin email
    // or the AuthService is in "Mock" mode.
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ email: 'admin@nacos.oauife.edu.ng', otp: '123456' });

    expect(response.status).toBe(200);
    adminToken = response.body.token;
  });

  it('2. Setup: Should create a Fee Type', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/fee-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'NACOS Dues 24/25',
        amount_naira: 500000, // ₦5,000
        is_clearance_required: true,
        fiscal_year: '2024/2025'
      });

    expect(response.status).toBe(201);
  });

  it('3. Onboarding: Should register a Student', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'test-student@oauife.edu.ng',
        matric_number: 'CSC/2024/TEST',
        first_name: 'Test',
        last_name: 'Student',
        department: 'Computer Science'
      });

    expect(response.status).toBe(201);
    studentId = response.body.id;
    virtualAccount = response.body.virtual_account.account_number;
  });

  it('4. Payment: Should handle Nomba Webhook', async () => {
    // Simulating Nomba Webhook
    const response = await request(app.getHttpServer())
      .post('/webhooks/nomba')
      .send({
        event: 'transfer.received',
        data: {
          transactionReference: `TXN_${Date.now()}`,
          amount: 5000,
          destinationAccountNumber: virtualAccount,
          senderName: 'Sponsor Name'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it('5. Ledger: Should verify student is cleared after background processing', async () => {
    // We give BullMQ a moment to process the queue
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await request(app.getHttpServer())
      .get(`/api/clearance/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    // If the payment matched the fee, is_cleared should be true
    expect(response.body.is_cleared).toBe(true);
  });
});
