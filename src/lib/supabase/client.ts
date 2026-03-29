import { createClient } from '@supabase/supabase-js';
import { readClientEnv } from '@/lib/env';

const env = readClientEnv();
const supabasePublicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseClientConfig = Boolean(env.VITE_SUPABASE_URL && supabasePublicKey);

export const supabaseClient = hasSupabaseClientConfig
  ? createClient(env.VITE_SUPABASE_URL!, supabasePublicKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export function requireSupabaseClient() {
  if (!supabaseClient) {
    throw new Error('supabase_client_not_configured');
  }
  return supabaseClient;
}
