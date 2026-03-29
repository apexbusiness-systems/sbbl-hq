type RuntimeConfig = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  appName: string;
  defaultLeague: string;
};

let cached: RuntimeConfig | null = null;
let fetchPromise: Promise<RuntimeConfig> | null = null;

function fromBuildEnv(): RuntimeConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? null,
    supabasePublishableKey:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY ??
      null,
    appName: import.meta.env.VITE_APP_NAME ?? 'SBBL HQ',
    defaultLeague: import.meta.env.VITE_DEFAULT_LEAGUE ?? 'SBBL',
  };
}

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const resp = await fetch('/api/public-config');
    if (!resp.ok) throw new Error(`config_fetch_${resp.status}`);
    const data = (await resp.json()) as {
      ok: boolean;
      supabaseUrl?: string;
      supabasePublishableKey?: string;
      appName?: string;
      defaultLeague?: string;
    };
    if (!data.ok) throw new Error('config_not_ok');
    return {
      supabaseUrl: data.supabaseUrl ?? null,
      supabasePublishableKey: data.supabasePublishableKey ?? null,
      appName: data.appName ?? 'SBBL HQ',
      defaultLeague: data.defaultLeague ?? 'SBBL',
    };
  } catch {
    return fromBuildEnv();
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
