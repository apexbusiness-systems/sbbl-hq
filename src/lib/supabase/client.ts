import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig, getRuntimeConfigSync } from '@/lib/runtime-config';

type SupabaseConfig = {
  url: string;
  key: string;
};

// Mutable reference for the runtime-configured client
let activeClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;
let activeConfig: SupabaseConfig | null = null;
let reportedConfigMismatch = false;

function buildClient(url: string, key: string): SupabaseClient {
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

function selectPreferredConfig(runtimeConfig: SupabaseConfig | null, buildConfig: SupabaseConfig | null): SupabaseConfig | null {
  if (runtimeConfig && buildConfig && !sameConfig(runtimeConfig, buildConfig) && !reportedConfigMismatch) {
    reportedConfigMismatch = true;
    console.error('[supabase] Config mismatch detected: using runtime credentials to avoid auth split-brain.');
  }
  return runtimeConfig ?? buildConfig;
}

function ensureClient(config: SupabaseConfig): SupabaseClient {
  if (activeClient && activeConfig && sameConfig(activeConfig, config)) return activeClient;
  activeClient = buildClient(config.url, config.key);
  activeConfig = config;
  return activeClient;
}

export async function initSupabaseClient(config?: { url: string; key: string }): Promise<SupabaseClient | null> {
  if (config?.url && config?.key) return ensureClient(config);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const runtime = await getRuntimeConfig();
    const runtimeConfig = runtime.supabaseUrl && runtime.supabasePublishableKey
      ? { url: runtime.supabaseUrl, key: runtime.supabasePublishableKey }
      : null;
    const selected = selectPreferredConfig(runtimeConfig, readBuildConfig());
    if (!selected) return null;
    return ensureClient(selected);
  })();

  return initPromise;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (activeClient) return activeClient;
  const selected = selectPreferredConfig(readRuntimeConfig(), readBuildConfig());
  if (!selected) return null;
  return ensureClient(selected);
}


const initialBuildConfig = readBuildConfig();
if (initialBuildConfig) {
  // Prime legacy behavior: allow early auth reads before async runtime config resolves.
  ensureClient(initialBuildConfig);
}

export const hasSupabaseClientConfig = (() => Boolean(readRuntimeConfig() ?? readBuildConfig()))();

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) throw new Error('supabase_client_not_configured');
  return client;
}

// Context-Bound Proxy guarantees all legacy imports point to the active runtime client
export const supabaseClient = new Proxy({} as SupabaseClient, {
  get: (_, prop: keyof SupabaseClient) => {
    const client = getSupabaseClient();
    if (!client) {
      console.warn(`[Supabase Proxy] Accessed property '${String(prop)}' before initSupabaseClient was called.`);
      return undefined;
    }
    const value = client[prop];
    // Explicitly bind functions to prevent 'Illegal invocation' context loss
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
