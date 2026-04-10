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

function buildClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

function getLeakedServiceRoleKey(): string | null {
  const viteLeak = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined)?.trim();
  const legacyLeak = (import.meta.env as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY;
  if (viteLeak) return viteLeak;
  if (typeof legacyLeak === 'string' && legacyLeak.trim().length > 0) return legacyLeak.trim();
  return null;
}

function assertNoServiceRoleLeakInBrowser(): void {
  if (!import.meta.env.DEV) return;
  const leakedKey = getLeakedServiceRoleKey();
  if (!leakedKey) return;

  // CODEX: Fail closed in dev when service-role credentials leak into browser config.
  console.error('[supabase] Refusing browser client init: SERVICE_ROLE_KEY is exposed to frontend runtime.');
  throw new Error('supabase_service_role_key_exposed');
}

function readBuildConfig(): SupabaseConfig | null {
  // CODEX: Validate browser env before reading build-time config so leaked secrets hard-stop immediately.
  assertNoServiceRoleLeakInBrowser();

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
  const selected = selectPreferredConfig(readRuntimeConfig(), readBuildConfig());
  if (!selected) return null;

  if (_client && _clientConfig && sameConfig(_clientConfig, selected)) return _client;

  if (_client && (!_clientConfig || !sameConfig(_clientConfig, selected))) {
    // CODEX: Rebuild stale singleton when runtime/build config rotates after first access.
    _client = buildClient(selected.url, selected.key);
    _clientConfig = selected;
    return _client;
  }

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
