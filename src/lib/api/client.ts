import { getSupabaseClient } from '@/lib/supabase/client';

const API_BASE = import.meta.env.VITE_WORKER_API_BASE?.trim() || '';

/**
 * getAuthToken — always returns a fresh, non-expired Supabase JWT.
 *
 * ROOT CAUSE FIX: The previous implementation used `getSession()` which only
 * reads the cached token from localStorage without checking expiry or
 * refreshing it. If the magic-link session token had expired, the stale
 * access_token was sent to the Worker, `jwtVerify()` failed, and the
 * request was rejected with "unauthorized".
 *
 * Fix: use `getUser()` which makes a live round-trip to Supabase Auth and
 * will automatically refresh the token via the refresh_token if the
 * access_token is expired. After that, `getSession()` gives us the fresh
 * token without an extra network call.
 */
export async function getAuthToken(): Promise<string | null> {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return null;

  // getUser() contacts the Supabase Auth server and auto-refreshes the
  // access_token when it is expired (unlike getSession() which only reads
  // the local cache and can return a stale, expired token).
  const { error } = await supabaseClient.auth.getUser();
  if (error) {
    // If the refresh fails (e.g. refresh_token revoked / user logged out),
    // return null so callers see a clean auth failure rather than a
    // cryptic network error.
    console.warn('[getAuthToken] Token refresh failed:', error.message);
    return null;
  }

  // After getUser() the local session is guaranteed to be fresh.
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * apiFetch — typed fetch wrapper with automatic auth, idempotency keys,
 * and a single-retry guardrail for transient 401s.
 *
 * GUARDRAIL: If the server returns 401, we proactively refresh the session
 * and retry the request exactly once. This applies whether the token was
 * auto-fetched OR explicitly passed — callers often capture a token in a
 * React closure that goes stale when the JWT expires, so we must always
 * attempt a refresh on 401.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  // All mutating requests require an idempotency key — auto-generate one so
  // callers don't have to manage this manually, but do it OUTSIDE the attempt loop
  // to ensure retries use the identical key.
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  if (isMutation && !init.headers) {
    init.headers = {};
  }
  
  const headers = new Headers(init.headers);
  if (isMutation && !headers.has('x-idempotency-key')) {
      // Deterministic fallback hash based on body helps with cross-request idempotency. 
      // Using UUID as ultimate fallback.
      const bodyStr = typeof init.body === 'string' ? init.body : JSON.stringify(init.body || {});
      let bodyHash = 0;
      for (let i = 0; i < bodyStr.length; i++) {
        bodyHash = ((bodyHash << 5) - bodyHash) + bodyStr.charCodeAt(i);
        bodyHash |= 0;
      }
      headers.set('x-idempotency-key', `${path}-${bodyHash}-${crypto.randomUUID()}`);
  }

  const attempt = async (authToken: string | null): Promise<Response> => {
    const attemptHeaders = new Headers(headers);
    attemptHeaders.set('content-type', attemptHeaders.get('content-type') ?? 'application/json');
    if (authToken) attemptHeaders.set('authorization', `Bearer ${authToken}`);

    return fetch(`${API_BASE}${path}`, { ...init, headers: attemptHeaders });
  };

  const authToken = token ?? (await getAuthToken());
  let response = await attempt(authToken);

  // GUARDRAIL: single retry on 401 — refresh session and try once more.
  // This fires whether the token was auto-fetched or explicitly passed.
  // Explicit tokens (e.g. from useAuth() closures) go stale when the JWT
  // expires, producing endless 401 loops if we don't retry with a refresh.
  if (response.status === 401) {
    console.warn('[apiFetch] 401 received, refreshing session and retrying:', path);
    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      const { data: refreshData } = await supabaseClient.auth.refreshSession();
      const freshToken = refreshData.session?.access_token ?? null;
      if (freshToken && freshToken !== authToken) {
        response = await attempt(freshToken);
      }
    }
  }

  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `request_failed_${response.status}`);
  }

  return payload as T;
}
