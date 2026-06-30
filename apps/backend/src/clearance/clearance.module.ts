import { Module } from '@nestjs/common';
import { ClearanceService } from './clearance.service';
import { ClearanceController } from './clearance.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ClearanceController],
  providers: [ClearanceService],
  exports: [ClearanceService],
})
export class ClearanceModule {}
