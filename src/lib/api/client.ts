import { supabaseClient } from '@/lib/supabase/client';

const API_BASE = import.meta.env.VITE_WORKER_API_BASE?.trim() || '';

export async function getAuthToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const authToken = token ?? await getAuthToken();
  const headers = new Headers(init.headers);
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  if (authToken) headers.set('authorization', `Bearer ${authToken}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));

  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `request_failed_${response.status}`);
  }

  return payload as T;
}
