import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/** Global so any module can inject SupabaseService without importing this. */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
