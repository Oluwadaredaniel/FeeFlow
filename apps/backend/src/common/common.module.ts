import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { NombaService } from './nomba/nomba.service';
import { EmailService } from './email/email.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [AuditService, NombaService, EmailService],
  exports: [AuditService, NombaService, EmailService],
})
export class CommonModule {}
