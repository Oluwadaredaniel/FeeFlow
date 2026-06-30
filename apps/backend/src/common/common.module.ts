import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { NombaService } from './nomba/nomba.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [AuditService, NombaService],
  exports: [AuditService, NombaService],
})
export class CommonModule {}
