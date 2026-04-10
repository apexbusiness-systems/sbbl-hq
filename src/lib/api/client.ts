import { getSupabaseClient } from '@/lib/supabase/client';

const API_BASE = import.meta.env.VITE_WORKER_API_BASE?.trim() || '';

/**
 * getAuthToken returns a fresh Supabase JWT when possible.
 *
 * Behavior contract:
 * - no active session => null (silent)
 * - active non-expired session => current access token
 * - near-expiry token => refresh once, then return fresh token or null
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return null;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const currentSession = sessionData.session;
  if (!currentSession?.access_token) return null;

  const expiresAtMs = typeof currentSession.expires_at === 'number'
    ? currentSession.expires_at * 1000
    : 0;
  const isFresh = expiresAtMs === 0 || expiresAtMs - Date.now() > 60_000;
  if (!forceRefresh && isFresh) return currentSession.access_token;

  const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
  if (refreshError) {
    // Suppress expected "no session" noise while still surfacing unexpected refresh failures.
    if (!/auth session missing/i.test(refreshError.message)) {
      console.warn('[getAuthToken] Token refresh failed:', refreshError.message);
    }
    return null;
  }

  return refreshData.session?.access_token ?? null;
}

/**
 * apiFetch typed fetch wrapper with automatic auth, idempotency, and single retry on 401.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const baseHeaders = new Headers(init.headers);

  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body != null && !isFormDataBody && !baseHeaders.has('content-type')) {
    baseHeaders.set('content-type', 'application/json');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !baseHeaders.has('x-idempotency-key')) {
    baseHeaders.set('x-idempotency-key', `${path}-${Date.now()}-${crypto.randomUUID()}`);
  }

  // Keep one deterministic idempotency key across retries.
  const stableIdempotencyKey = baseHeaders.get('x-idempotency-key');

  type ApiFetchOptions = RequestInit & { _retry?: boolean };
  const options: ApiFetchOptions = { ...init, method, headers: new Headers(baseHeaders) };

  const isOpsRoute = path.startsWith('/ops/');
  const authToken = token ?? (await getAuthToken(false));

  // Non-discoverable fast-fail for auth-protected ops routes when session is gone.
  if (isOpsRoute && !authToken) {
    throw new Error('reauth_required');
  }

  if (authToken) {
    (options.headers as Headers).set('Authorization', `Bearer ${authToken}`);
  } else {
    (options.headers as Headers).delete('Authorization');
  }
  if (stableIdempotencyKey) {
    (options.headers as Headers).set('x-idempotency-key', stableIdempotencyKey);
  }

  const endpoint = `${API_BASE}${path}`;

  // 1. Execute primary network request
  let response = await fetch(endpoint, options);

  // 2. Intercept 401 Unauthorized
  if (response.status === 401) {
    // Determine if request was legitimately authenticated prior to failure
    const authHeader = options.headers instanceof Headers
      ? options.headers.get('Authorization')
      : (options.headers as Record<string, string>)?.Authorization;

    const hadToken = !!authHeader || !!(await getAuthToken(false));

    // 3. 1-Pass Turbulence Recovery (Only for previously authenticated sessions)
    if (hadToken && !options._retry) {
      options._retry = true;

      // Force strict token refresh
      const freshToken = await getAuthToken(true);

      if (freshToken) {
        // Safely map headers to handle undefined or varying Fetch types
        options.headers = {
          ...(options.headers instanceof Headers ? Object.fromEntries(options.headers.entries()) : options.headers),
          Authorization: `Bearer ${freshToken}`,
        };

        // Execute retry
        response = await fetch(endpoint, options);

        // Return immediately if recovery succeeds
        if (response.ok) return await response.json() as T;
      }

      // 4. Terminal Auth Failure (Token existed, but refresh/retry failed)
      // Nuke the dead session to prevent infinite ghost loops.
      await getSupabaseClient().auth.signOut();
    }

    // 5. Terminal Rejection (Tokenless 401 Paywall hits OR Failed Recovery)
    // Bypasses session destruction for unauthenticated users (Fixes PR #243 intent)
    const authError = new Error('Unauthorized');
    (authError as any).status = 401; // Ensure React Query boundaries read the exact status
    throw authError;
  }

  // 6. Guarantee downstream JSON parsing safety for non-401 errors
  if (!response.ok) {
    const apiError = new Error(`API Error: ${response.status} ${response.statusText}`);
    (apiError as any).status = response.status;
    throw apiError;
  }

  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

  return payload as T;
}
