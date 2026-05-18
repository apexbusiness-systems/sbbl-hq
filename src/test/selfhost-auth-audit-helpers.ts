/**
 * Thin helpers that expose internal worker logic as pure functions so the
 * audit tests can assert against them without spinning up a full Worker.
 */

// ── Proxy token secret resolution ────────────────────────────────────────────

type ProxySecretEnv = {
  STREAM_PROXY_SECRET?: string;
  OMNIHUB_SIGNING_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

/**
 * Mirrors the resolveProxyTokenSecret() function in src/worker/index.ts.
 * Must be kept in sync whenever that function changes.
 *
 * Invariant: NEVER returns SUPABASE_SERVICE_ROLE_KEY.
 */
export function resolveProxyTokenSecret(env: ProxySecretEnv): string | null {
  return env.STREAM_PROXY_SECRET ?? env.OMNIHUB_SIGNING_SECRET ?? null;
}

// ── Admin client cache simulation ────────────────────────────────────────────

type AdminEnv = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };

/**
 * Simulates the getAdminClient() cache logic from src/worker/index.ts.
 * Returns a tracker so tests can assert on how many clients were created.
 */
export function makeAdminClientTracker() {
  let cachedClient: object | null = null;
  let cachedUrl: string | null = null;
  let cachedKey: string | null = null;
  let count = 0;

  function get(env: AdminEnv): object {
    if (cachedClient && cachedUrl === env.SUPABASE_URL && cachedKey === env.SUPABASE_SERVICE_ROLE_KEY) {
      return cachedClient;
    }
    // Simulate creating a new client.
    cachedClient = { _url: env.SUPABASE_URL, _key: env.SUPABASE_SERVICE_ROLE_KEY, _id: ++count };
    cachedUrl = env.SUPABASE_URL;
    cachedKey = env.SUPABASE_SERVICE_ROLE_KEY;
    return cachedClient;
  }

  return {
    get,
    get createCount() { return count; },
  };
}

// ── Security headers ──────────────────────────────────────────────────────────

/**
 * Applies the same security headers that addSecurityHeaders() applies in the
 * worker, so tests can assert header presence/absence without a live Worker.
 * Must be kept in sync with addSecurityHeaders() in src/worker/index.ts.
 */
export function addSecurityHeadersForTest(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // X-XSS-Protection intentionally NOT set — deprecated and exploitable in IE.
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors 'none'; base-uri 'self';",
  );
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
