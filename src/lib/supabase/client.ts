import { createClient } from '@supabase/supabase-js';
import { readClientEnv } from '@/lib/env';

const env = readClientEnv();

export const supabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
