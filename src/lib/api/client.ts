import { getSupabaseClient } from '@/lib/supabase/client';

const API_BASE = import.meta.env.VITE_WORKER_API_BASE?.trim() || '';

// CODEX: Enforce bounded auth retry behavior before fail-closed logout.
const MAX_CONSECUTIVE_401 = 3;
// CODEX: 500ms exponential backoff base (500ms, 1000ms) to stop tight 401 loops.
const AUTH_RETRY_BASE_DELAY_MS = 500;

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * getAuthToken returns a fresh Supabase JWT when possible.
 *
 * Behavior contract:
 * - no active session => null (silent)
 * - active non-expired session => current access token
 * - near-expiry token => refresh once, then return fresh token or null
 */
export async function getAuthToken(): Promise<string | null> {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return null;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const currentSession = sessionData.session;
  if (!currentSession?.access_token) return null;

  const expiresAtMs = typeof currentSession.expires_at === 'number'
    ? currentSession.expires_at * 1000
    : 0;
  const isFresh = expiresAtMs === 0 || expiresAtMs - Date.now() > 60_000;
  if (isFresh) return currentSession.access_token;

  const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
  if (refreshError) {
    // Suppress expected "no session" noise while still surfacing unexpected refresh failures.
    if (!/auth session missing/i.test(refreshError.message)) {
      console.warn('[getAuthToken] Token refresh failed:', refreshError.message);
    }
    return null;
  }

  const session = refreshData.session ?? null;
  if (session?.access_token) {
    // CODEX: Emit refresh observability for post-login token stability diagnostics.
    console.log('[AUTH] session refreshed', { userId: session?.user?.id, expiresAt: session?.expires_at });
  }

  return session?.access_token ?? null;
}

/**
 * apiFetch typed fetch wrapper with automatic auth, idempotency, and single retry on 401.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const clearLocalAuthState = async () => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    try {
      await supabaseClient.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('[apiFetch] Failed to clear local auth state:', error);
    }
  };

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

  const attempt = async (authToken: string | null): Promise<Response> => {
    const headers = new Headers(baseHeaders);
    if (authToken) {
      headers.set('authorization', `Bearer ${authToken}`);
    } else {
      headers.delete('authorization');
    }
    if (stableIdempotencyKey) headers.set('x-idempotency-key', stableIdempotencyKey);

    return fetch(`${API_BASE}${path}`, { ...init, method, headers });
  };

  const isOpsRoute = path.startsWith('/ops/');
  let authToken = token ?? (await getAuthToken());

  // Non-discoverable fast-fail for auth-protected ops routes when session is gone.
  if (isOpsRoute && !authToken) {
    throw new Error('reauth_required');
  }

  let response: Response | null = null;

  for (let auth401Count = 1; auth401Count <= MAX_CONSECUTIVE_401; auth401Count += 1) {
    response = await attempt(authToken);

    if (response.status !== 401) {
      break;
    }

    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
      const session = refreshError ? null : (refreshData.session ?? null);
      if (session?.access_token) {
        // CODEX: Emit refresh observability on every successful 401 recovery refresh.
        console.log('[AUTH] session refreshed', { userId: session?.user?.id, expiresAt: session?.expires_at });
        authToken = session.access_token;
      }
    }

    if (auth401Count < MAX_CONSECUTIVE_401) {
      // CODEX: Exponential backoff prevents immediate 401 spin loops while preserving recovery attempts.
      const delayMs = AUTH_RETRY_BASE_DELAY_MS * (2 ** (auth401Count - 1));
      await wait(delayMs);
      continue;
    }
  }

  if (!response) {
    throw new Error('request_failed_unknown');
  }

  if (response.status === 401) {
    await clearLocalAuthState();
    throw new Error('reauth_required');
  }

  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `request_failed_${response.status}`);
  }

  return payload as T;
}
