/**
 * Re-exports from the real worker module so audit tests exercise the actual
 * production code paths rather than mirrored copies.
 *
 * Anything that was previously duplicated here has been moved to the source
 * and exported — see resolveProxyTokenSecret() and addSecurityHeaders() in
 * src/worker/index.ts.
 */

export { resolveProxyTokenSecret, addSecurityHeaders } from '@/worker/index';

// ── Admin client cache simulation ────────────────────────────────────────────
// getAdminClient() is not exported from the worker (it holds module-level
// singleton state that is unsafe to expose), so we test the cache invalidation
// logic through a thin faithful re-implementation here.  If getAdminClient()
// changes its cache keying, this helper must be updated to match.

type AdminEnv = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };

/**
 * Simulates the getAdminClient() cache logic from src/worker/index.ts.
 * The invariant under test: cache must invalidate on EITHER URL or key change.
 */
export function makeAdminClientTracker() {
  let cachedClient: object | null = null;
  let cachedUrl: string | null = null;
  let cachedKey: string | null = null;
  let count = 0;

  function get(env: AdminEnv): object {
    if (
      cachedClient &&
      cachedUrl === env.SUPABASE_URL &&
      cachedKey === env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return cachedClient;
    }
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
