import { createClient } from '@supabase/supabase-js';
import { readClientEnv } from '@/lib/env';

const env = readClientEnv();

export const hasSupabaseClientConfig = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);

export const supabaseClient = hasSupabaseClientConfig
  ? createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export function requireSupabaseClient() {
  if (!supabaseClient) {
    throw new Error('supabase_client_not_configured');
  }
  return supabaseClient;
}
