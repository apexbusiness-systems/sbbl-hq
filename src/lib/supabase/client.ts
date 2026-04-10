import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig, getRuntimeConfigSync } from '@/lib/runtime-config';

type SupabaseConfig = {
  url: string;
  key: string;
};

let _client: SupabaseClient | null = null;
let _initPromise: Promise<void> | null = null;
let _clientConfig: SupabaseConfig | null = null;
let _reportedConfigMismatch = false;

function isServiceRoleKey(key: string): boolean {
  // CODEX: guard browser builds from ever booting with privileged server credentials.
  return key.startsWith('sb_secret_') || /service[_-]?role/i.test(key);
}

function buildClient(url: string, key: string): SupabaseClient {
  if (import.meta.env.DEV && typeof window !== 'undefined' && isServiceRoleKey(key)) {
    // CODEX: fail closed in local/dev browser if a service-role key leaks into client config.
    console.error('[supabase] SERVICE_ROLE_KEY detected in browser config. Aborting client initialization.');
    throw new Error('supabase_service_role_key_detected_in_browser');
  }

  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

function readBuildConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
    ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  return url && key ? { url, key } : null;
}

function readRuntimeConfig(): SupabaseConfig | null {
  const cfg = getRuntimeConfigSync();
  if (!cfg?.supabaseUrl || !cfg?.supabasePublishableKey) return null;
  return { url: cfg.supabaseUrl, key: cfg.supabasePublishableKey };
}

function sameConfig(left: SupabaseConfig, right: SupabaseConfig): boolean {
  return left.url === right.url && left.key === right.key;
}

function selectPreferredConfig(
  runtimeConfig: SupabaseConfig | null,
  buildConfig: SupabaseConfig | null,
): SupabaseConfig | null {
  if (
    runtimeConfig &&
    buildConfig &&
    !sameConfig(runtimeConfig, buildConfig) &&
    !_reportedConfigMismatch
  ) {
    _reportedConfigMismatch = true;
    // Guardrail: if build-time and runtime Supabase credentials diverge, prefer
    // Worker-served runtime config so JWT issuer/audience never split-brains.
    console.error(
      '[supabase] Config mismatch detected: using /api/public-config credentials to avoid auth split-brain.',
    );
  }

  return runtimeConfig ?? buildConfig;
}

function ensureClient(config: SupabaseConfig): SupabaseClient {
  if (_client && _clientConfig && sameConfig(_clientConfig, config)) return _client;
  _client = buildClient(config.url, config.key);
  _clientConfig = config;
  return _client;
}

export function ensureFreshSupabaseClient(staleRef: SupabaseClient | null | undefined): SupabaseClient | null {
  const current = getSupabaseClient();
  if (!staleRef) return current;
  if (current && staleRef !== current) {
    // CODEX: explicit stale-reference guard for modules that cached a pre-reinit client instance.
    return current;
  }
  return staleRef;
}

export async function initSupabaseClient(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const runtime = await getRuntimeConfig();
    const runtimeConfig = runtime.supabaseUrl && runtime.supabasePublishableKey
      ? { url: runtime.supabaseUrl, key: runtime.supabasePublishableKey }
      : null;

    const selected = selectPreferredConfig(runtimeConfig, readBuildConfig());
    if (!selected) return;
    ensureClient(selected);
  })();
  return _initPromise;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;
  const selected = selectPreferredConfig(readRuntimeConfig(), readBuildConfig());
  if (!selected) return null;
  return ensureClient(selected);
}

export const hasSupabaseClientConfig = (() => Boolean(readRuntimeConfig() ?? readBuildConfig()))();

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) throw new Error('supabase_client_not_configured');
  return client;
}

// Legacy compat
export const supabaseClient = getSupabaseClient();
