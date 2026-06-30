import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: SupabaseService) {}

  @Get()
  async check() {
    let database: 'ok' | 'error' = 'error';
    try {
      const { error } = await this.db.client
        .from('organizations')
        .select('id')
        .limit(1);
      database = error ? 'error' : 'ok';
    } catch {
      database = 'error';
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'feeflow-backend',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
