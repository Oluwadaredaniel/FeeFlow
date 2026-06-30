import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private readonly baseUrl = 'https://api.nomba.com/v1';

  async createVirtualAccount(params: {
    email: string;
    firstName: string;
    lastName: string;
    accountName: string;
  }) {
    // In a real hackathon/production setup, we'd use the Nomba credentials
    const secretKey = process.env.NOMBA_SECRET_KEY;
    const accountId = process.env.NOMBA_ACCOUNT_ID;

    if (!secretKey || !accountId) {
      this.logger.warn('NOMBA credentials missing, falling back to mock account number');
      return {
        accountNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
        bankName: 'Nomba (Mock)',
        status: 'ACTIVE'
      };
    }

    try {
      // Real API call to Nomba would go here
      /*
      const response = await axios.post(`${this.baseUrl}/accounts/virtual`, {
        account_name: params.accountName,
        email: params.email,
        ...
      }, {
        headers: { Authorization: `Bearer ${secretKey}`, 'accountId': accountId }
      });
      return response.data;
      */

      // Simulating a successful response for now
      return {
        accountNumber: '10' + Math.floor(10000000 + Math.random() * 90000000).toString(),
        bankName: 'Nomba',
        status: 'ACTIVE'
      };
    } catch (error) {
      this.logger.error('Nomba VA creation failed', error.response?.data || error.message);
      throw error;
    }
  }
}
