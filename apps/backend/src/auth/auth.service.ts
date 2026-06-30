import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager_1 from 'cache-manager';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from '../common/email/email.service';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager_1.Cache,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  async generateOtp(email: string) {
    const formattedEmail = email.toLowerCase().trim();

    // 1. Cross-reference identity matrix (Check Org Admin first, then Student)
    const { data: orgAdmin } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('admin_email', formattedEmail)
      .maybeSingle();

    let userRole = orgAdmin ? 'ADMIN' : null;
    let orgId = orgAdmin ? orgAdmin.id : null;

    if (!userRole) {
      const { data: student } = await this.supabase
        .from('students')
        .select('org_id')
        .eq('email', formattedEmail)
        .maybeSingle();

      if (student) {
        userRole = 'STUDENT';
        orgId = student.org_id;
      }
    }

    if (!userRole || !orgId) {
      throw new UnauthorizedException('Identity records matching this email do not exist');
    }

    // For local hackathon sandbox testing, use 123456 as bypass if requested
    const otp = process.env.NODE_ENV === 'production'
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456';

    // 3. Stateless Cache Injection: Save to Cloud Redis with a 5-minute TTL window (300 seconds)
    const redisOtpKey = `auth:otp:${formattedEmail}`;
    await this.cacheManager.set(redisOtpKey, otp, 300);

    // 4. Dispatch Email
    await this.emailService.sendOtp(formattedEmail, otp);

    return {
      success: true,
      message: 'A security verification token has been dispatched to your email address',
    };
  }

  async verifyOtp(email: string, otp: string) {
    const formattedEmail = email.toLowerCase().trim();
    const redisOtpKey = `auth:otp:${formattedEmail}`;

    // 1. Fetch token from Cloud Redis fabric layer
    const cachedOtp = await this.cacheManager.get<string>(redisOtpKey);

    if (!cachedOtp || cachedOtp !== otp) {
      throw new UnauthorizedException('The provided verification token is invalid or has expired');
    }

    // 2. Clear token from cache immediately upon consumption (single-use constraint)
    await this.cacheManager.del(redisOtpKey);

    // 3. Construct specific JWT multi-tenant parameters
    const { data: orgAdmin } = await this.supabase
      .from('organizations')
      .select('id, name')
      .eq('admin_email', formattedEmail)
      .maybeSingle();

    let jwtPayload: any = null;

    if (orgAdmin) {
      jwtPayload = {
        sub: orgAdmin.id,
        email: formattedEmail,
        role: 'ADMIN',
        org_id: orgAdmin.id,
      };
    } else {
      const { data: student } = await this.supabase
        .from('students')
        .select('id, org_id, matric_number')
        .eq('email', formattedEmail)
        .maybeSingle();

      if (!student) {
        throw new UnauthorizedException('Identity sync failure encountered during token authorization');
      }

      jwtPayload = {
        sub: student.id,
        email: formattedEmail,
        role: 'STUDENT',
        org_id: student.org_id,
        matric: student.matric_number,
      };
    }

    // 4. Sign stateless token containing multi-tenant org_id mappings
    const signedToken = this.jwtService.sign(jwtPayload);

    return {
      success: true,
      token: signedToken,
      user: {
        email: formattedEmail,
        role: jwtPayload.role,
        orgId: jwtPayload.org_id,
      },
    };
  }
}
