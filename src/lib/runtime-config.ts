type RuntimeConfig = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  appName: string;
  defaultLeague: string;
  // Capability flags — sourced from worker env. Default false when unset so
  // the UI cannot falsely advertise a provider that the operator has not
  // explicitly enabled (e.g. Google OAuth set to org_internal in Google Cloud).
  googleOAuthEnabled: boolean;
};

let cached: RuntimeConfig | null = null;
let fetchPromise: Promise<RuntimeConfig> | null = null;

function fromBuildEnv(): RuntimeConfig {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    // Empty strings (the new vite.config.ts default when env is absent) collapse
    // to null so downstream code reliably detects "no config".
    supabaseUrl: typeof url === 'string' && url.length > 0 ? url : null,
    supabasePublishableKey: typeof key === 'string' && key.length > 0 ? key : null,
    appName: import.meta.env.VITE_APP_NAME ?? 'SBBL HQ',
    defaultLeague: import.meta.env.VITE_DEFAULT_LEAGUE ?? 'SBBL',
    // Build-time fallback is always false — capability must be confirmed by
    // the worker, never by a committed build flag.
    googleOAuthEnabled: false,
  };
}

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const resp = await fetch('/api/public-config', { signal: controller.signal });
    if (!resp.ok) throw new Error(`config_fetch_${resp.status}`);
    const data = (await resp.json()) as {
      ok: boolean;
      supabaseUrl?: string;
      supabasePublishableKey?: string;
      appName?: string;
      defaultLeague?: string;
      googleOAuthEnabled?: boolean;
    };
    if (!data.ok) throw new Error('config_not_ok');
    return {
      supabaseUrl: data.supabaseUrl ?? null,
      supabasePublishableKey: data.supabasePublishableKey ?? null,
      appName: data.appName ?? 'SBBL HQ',
      defaultLeague: data.defaultLeague ?? 'SBBL',
      // Strict boolean coercion — anything other than literal true is false
      // so missing/garbled fields fail closed.
      googleOAuthEnabled: data.googleOAuthEnabled === true,
    };
  } catch {
    return fromBuildEnv();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;
  if (!fetchPromise) {
    fetchPromise = fetchRuntimeConfig().then((cfg) => {
      cached = cfg;
      return cfg;
    });
  }
  return fetchPromise;
}

export function getRuntimeConfigSync(): RuntimeConfig | null {
  return cached;
}
