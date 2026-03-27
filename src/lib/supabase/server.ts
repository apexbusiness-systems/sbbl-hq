import { createClient } from '@supabase/supabase-js';
import { readServerEnv } from '@/lib/env';

export type ServerBindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  OPTIONAL_SOCIAL_API_KEYS?: string;
  OPTIONAL_TURNSTILE_SECRET_KEY?: string;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
};

export function createServiceSupabase(bindings: Record<string, unknown>) {
  const env = readServerEnv(bindings);
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
