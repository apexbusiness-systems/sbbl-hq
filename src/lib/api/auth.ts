import { requireSupabaseClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api/client';
import type { AppRole } from '@/lib/auth/roles';

export type AuthProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  preferred_league: string | null;
  primary_role_intent: string | null;
};

export async function signInWithEmail(email: string) {
  // Route through our worker using the service role key — avoids the strict
  // per-email rate limits that Supabase applies to anon-key OTP requests.
  const API_BASE = (import.meta.env.VITE_WORKER_API_BASE ?? '').trim();
  const redirectTo = `${window.location.origin}/`;
  const resp = await fetch(`${API_BASE}/auth/otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), redirectTo }),
  });
  const payload = await resp.json().catch(() => ({ ok: false, error: 'invalid_response' })) as { ok: boolean; error?: string };
  if (!resp.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Failed to send magic link');
  }
}

export async function signOut() {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchSessionSummary() {
  return apiFetch<{ ok: boolean; userId: string; roles: AppRole[] }>('/auth/session');
}

export async function fetchProfileAndRoles(userId: string) {
  const supabase = requireSupabaseClient();
  const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,user_id,display_name,full_name,bio,avatar_url,preferred_league,primary_role_intent')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_role_assignments')
      .select('role')
      .eq('user_id', userId),
  ]);

  if (profileError) throw profileError;
  if (roleError) throw roleError;

  return {
    profile: profile as AuthProfile | null,
    roles: (roleRows ?? []).map((r) => r.role as AppRole),
  };
}

export async function saveOnboarding(payload: {
  userId: string;
  displayName: string;
  fullName: string;
  primaryRoleIntent: string;
  preferredLeague: string;
  bio?: string;
  avatarFile?: File | null;
}) {
  const supabase = requireSupabaseClient();
  let avatarUrl: string | null = null;
  if (payload.avatarFile) {
    const extension = payload.avatarFile.name.split('.').pop() || 'jpg';
    const path = `avatars/${payload.userId}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from('media').upload(path, payload.avatarFile, {
      cacheControl: '3600', upsert: true,
    });
    if (upload.error) throw upload.error;
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    avatarUrl = data.publicUrl;
  }

  const { error } = await supabase.from('profiles').upsert({
    user_id: payload.userId,
    display_name: payload.displayName,
    full_name: payload.fullName,
    primary_role_intent: payload.primaryRoleIntent,
    preferred_league: payload.preferredLeague,
    bio: payload.bio || null,
    avatar_url: avatarUrl,
  }, { onConflict: 'user_id' });
  if (error) throw error;

  if (payload.primaryRoleIntent === 'player') {
    const { error: regError } = await supabase.from('player_registration_submissions').upsert({
      user_id: payload.userId,
      payload: { preferred_league: payload.preferredLeague },
      idempotency_key: `onboarding-${payload.userId}`,
    }, { onConflict: 'user_id,idempotency_key' });
    if (regError) throw regError;
  }
}
