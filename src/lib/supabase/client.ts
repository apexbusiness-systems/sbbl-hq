import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig, getRuntimeConfigSync } from '@/lib/runtime-config';

let _client: SupabaseClient | null = null;
let _initPromise: Promise<void> | null = null;

function buildClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export async function initSupabaseClient(): Promise<void> {
  if (_client) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    // Build-time env vars (injected by Cloudflare Pages at build) take precedence.
    // The /api/public-config endpoint intentionally omits Supabase credentials
    // for security, so we must read them from the bundle, not the runtime config.
    const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
      ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
    if (envUrl && envKey) {
      _client = buildClient(envUrl, envKey);
      return;
    }
    // Fallback: runtime config (future server-injected config support)
    const cfg = await getRuntimeConfig();
    if (cfg.supabaseUrl && cfg.supabasePublishableKey) {
      _client = buildClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    }
  })();
  return _initPromise;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
    ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (envUrl && envKey) {
    _client = buildClient(envUrl, envKey);
    return _client;
  }
  const cfg = getRuntimeConfigSync();
  if (cfg?.supabaseUrl && cfg?.supabasePublishableKey) {
    _client = buildClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  }
  return _client;
}

export const hasSupabaseClientConfig = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key);
})();

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) throw new Error('supabase_client_not_configured');
  return client;
}

// Legacy compat
export const supabaseClient = getSupabaseClient();
