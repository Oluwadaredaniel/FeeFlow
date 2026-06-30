import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Single shared Supabase client (service-role key — bypasses RLS).
 * Inject this everywhere instead of calling createClient() per service.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      this.logger.error(
        'SUPABASE_URL or service-role key missing — database calls will fail.',
      );
    }

    this.client = createClient(url ?? '', key ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}
