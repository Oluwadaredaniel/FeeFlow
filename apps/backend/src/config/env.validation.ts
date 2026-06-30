/**
 * Lightweight env validation (no extra deps). Plugged into ConfigModule.forRoot.
 * Hard-fails in production if critical vars are missing (prevents a silent
 * auth-bypass / misconfigured deploy); warns loudly in dev.
 */
export function validateEnv(config: Record<string, unknown>) {
  const missing: string[] = [];

  if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!config.SUPABASE_SERVICE_ROLE_KEY && !config.SUPABASE_SERVICE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!config.JWT_SECRET) missing.push('JWT_SECRET');

  // Webhook secret isn't strictly required to boot, but warn — signatures are
  // skipped without it (see WebhooksController).
  if (!config.NOMBA_WEBHOOK_SECRET) {
    console.warn('[env] NOMBA_WEBHOOK_SECRET not set — webhook signatures will not be verified.');
  }

  if (missing.length) {
    const msg = `[env] Missing required vars: ${missing.join(', ')}`;
    if (config.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    console.warn(`${msg} (continuing in non-production)`);
  }

  return config;
}
