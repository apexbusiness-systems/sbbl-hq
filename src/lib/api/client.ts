import { supabaseClient } from '@/lib/supabase/client';

const API_BASE = import.meta.env.VITE_WORKER_API_BASE?.trim() || '';

export async function getAuthToken() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const authToken = token ?? await getAuthToken();
  const headers = new Headers(init.headers);
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  if (authToken) headers.set('authorization', `Bearer ${authToken}`);
  // All mutating requests require an idempotency key — auto-generate one so
  // callers don't have to manage this manually.
  const method = (init.method ?? 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('x-idempotency-key', `${path}-${Date.now()}-${crypto.randomUUID()}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `request_failed_${response.status}`);
  }

  return payload as T;
}
