import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly baseUrl = 'https://api.resend.com';

  async sendOtp(email: string, otp: string) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey || apiKey === 're_123456789') {
      this.logger.warn(`[MOCK EMAIL] OTP for ${email}: ${otp}. Set RESEND_API_KEY to send real emails.`);
      return;
    }

    try {
      await axios.post(
        `${this.baseUrl}/emails`,
        {
          from: 'FeeFlow <onboarding@resend.dev>', // Update with association domain in prod
          to: email,
          subject: 'Your FeeFlow Verification Code',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Verification Code</h2>
              <p>Hello,</p>
              <p>Your security verification code for FeeFlow is:</p>
              <h1 style="color: #0E8C2C; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
              <p>This code expires in 5 minutes.</p>
              <hr />
              <p style="font-size: 12px; color: #888;">Nigeria Association of Computing Students (NACOS), OAU Chapter.</p>
            </div>
          `,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      this.logger.log(`Email dispatched successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error.response?.data || error.message);
      // We don't throw here to avoid blocking the auth flow, but we log the failure.
    }
  }
}
