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

  const sessionResponse = await supabaseClient.auth.getSession();
  const currentSession = sessionResponse?.data?.session ?? null;
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

  const initialToken = token ?? (await getAuthToken(false));
  if (initialToken) {
    baseHeaders.set('Authorization', `Bearer ${initialToken}`);
  }

  const endpoint = `${API_BASE}${path}`;
  const options: RequestInit = { ...init, method, headers: baseHeaders };

  // 1. Execute primary network request
  let response = await fetch(endpoint, options);

  // 2. Intercept 401 Unauthorized
  if (response.status === 401) {
    // Safely extract headers using the native API to preserve Content-Type/Accept
    const safeHeaders = new Headers(options.headers || {});
    const hadToken = safeHeaders.has('Authorization') || !!(await getAuthToken(false));

    // 3. 1-Pass Turbulence Recovery (Only if session was previously authenticated)
    const retryableOptions = options as RequestInit & { _retry?: boolean };
    if (hadToken && !retryableOptions._retry) {
      retryableOptions._retry = true;

      const freshToken = await getAuthToken(true); // Force refresh

      if (freshToken) {
        safeHeaders.set('Authorization', `Bearer ${freshToken}`);
        options.headers = safeHeaders;

        response = await fetch(endpoint, options); // Retry

        if (response.ok) return response as unknown as T; // Immediate unblock on success
      }

      // 4. Terminal Auth Failure: Token existed but refresh/retry failed. Kill session.
      await getSupabaseClient()?.auth.signOut();
    }

    // 5. Terminal Rejection: Paywall hits (No token) OR Retry Failed.
    // Throws absolute 401 to UI without destroying local storage (Preserves PR #243).
    const authError = new Error('Unauthorized') as Error & { status: number };
    authError.status = 401;
    throw authError;
  }

  // 6. Standard Error Rejection
  if (!response.ok) {
    const apiError = new Error(`API Error: ${response.status} ${response.statusText}`) as Error & { status: number };
    apiError.status = response.status;
    throw apiError;
  }

  // 7. CRITICAL: Return valid payload to unblock downstream JSON parsers
  return response as unknown as T;
}
