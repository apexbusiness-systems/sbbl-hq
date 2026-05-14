import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api/client';
import { type AppRole } from '@/lib/auth/roles';

const DEVICE_KEY = 'sbbl_stream_device';

export type AccessState =
  | 'loading'
  | 'unauthenticated'
  | 'free'
  | 'paid'
  | 'paywall'
  // Broadcast oracle failed (RPC missing, schema drift, wrong project, etc.).
  // Distinct from "not live" — UI must fail closed and show a misconfiguration
  // message rather than silently rendering an empty state.
  | 'misconfigured';

export interface LiveConfig {
  isLive: boolean;
  videoUrl: string | null;
  title: string;
}

interface StreamStatusPayload {
  ok?: boolean;
  isLive?: boolean | null;
  title?: string | null;
  streamUrl?: string | null;
}

function resolveDirectStreamUrl(rawUrl: string | null | undefined): string | null {
  const resolvedUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!resolvedUrl) return null;
  if (resolvedUrl.startsWith('blob:')) {
    console.error('[useLiveAccess] Refusing to persist blob URL for live playback', {
      urlPrefix: resolvedUrl.slice(0, 32),
    });
    throw new Error('blob_stream_url_rejected');
  }
  return resolvedUrl;
}

async function fetchStatusStreamUrl(activeGameId: string | null): Promise<string | null> {
  const qs = activeGameId ? `?gameId=${encodeURIComponent(activeGameId)}` : '';
  try {
    const status = await apiFetch<StreamStatusPayload>(`/api/streams/status${qs}`);
    return resolveDirectStreamUrl(status.streamUrl);
  } catch (error) {
    if (error instanceof Error && error.message === 'blob_stream_url_rejected') throw error;
    console.error('[useLiveAccess] Status endpoint streamUrl resolution failed', error);
    return null;
  }
}

export function useLiveAccess() {
  const [access, setAccess] = useState<AccessState>('loading');
  const [config, setConfig] = useState<LiveConfig>({
    isLive: false,
    videoUrl: null,
    title: 'SBBL Live',
  });
  const [resolveSignal, setResolveSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAccess('unauthenticated');
      return;
    }

    async function resolve() {
      // Server-authoritative oracle: returns paywall flags and withholds stream_url unless permitted.
      // active_game_id is included in the response — no direct stream_admin_config read needed
      // (Rule 6.1: non-admin clients must not read stream_admin_config directly).
      const { data: broadcast, error: broadcastError } = await supabase.rpc('get_active_broadcast');

      // Fail closed on oracle errors. The most common production cause is
      // migration drift / wrong project / missing function — in any of those
      // cases we MUST surface a misconfiguration state instead of silently
      // pretending the broadcast is not live (which hides the outage).
      if (broadcastError) {
        if (!cancelled) setAccess('misconfigured');
        return;
      }

      const view = (broadcast as {
        is_live?: boolean | null;
        title?: string | null;
        stream_url?: string | null;
        active_game_id?: string | null;
        requires_payment?: boolean | null;
        has_entitlement?: boolean | null;
        is_subscribed?: boolean | null;
      } | null) ?? null;

      if (!cancelled && view) {
        setConfig({
          isLive: Boolean(view.is_live),
          videoUrl: null,
          title: String(view.title ?? 'SBBL Live'),
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setAccess('unauthenticated');
        return;
      }

      const { data: roleRows } = await supabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id);

      const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
      const isFreeRole = (roles as AppRole[]).some(
        (r) => r === 'player' || r === 'paid_fan' || r === 'super_admin',
      );
      const activeGameId = view?.active_game_id ?? null;
      const statusStreamUrl = await fetchStatusStreamUrl(activeGameId);
      const directStreamUrl = statusStreamUrl ?? resolveDirectStreamUrl(view?.stream_url);

      const grantPlaybackConfig = () => {
        if (cancelled || !view) return;
        setConfig({
          isLive: Boolean(view.is_live),
          videoUrl: directStreamUrl,
          title: String(view.title ?? 'SBBL Live'),
        });
      };

      if (isFreeRole || Boolean(view?.is_subscribed) || Boolean(view?.has_entitlement) || statusStreamUrl) {
        localStorage.setItem(DEVICE_KEY, user.id);
        grantPlaybackConfig();
        if (!cancelled) setAccess((isFreeRole || Boolean(view?.is_subscribed) || statusStreamUrl) ? 'free' : 'paid');
        return;
      }

      if (activeGameId) {
        const { data: entitlements } = await supabase
          .from('stream_entitlements')
          .select('id, status, expires_at')
          .eq('user_id', user.id)
          .eq('game_id', activeGameId)
          .eq('status', 'active');
        const hasActive = Array.isArray(entitlements) && entitlements.some(
          (e: { expires_at: string | null }) => !e.expires_at || new Date(e.expires_at) > new Date(),
        );
        if (hasActive) {
          localStorage.setItem(DEVICE_KEY, user.id);
          grantPlaybackConfig();
          if (!cancelled) setAccess('paid');
          return;
        }
      }

      if (!cancelled) setAccess('paywall');
    }

    setAccess('loading');
    void resolve().catch((error) => {
      if (!cancelled) {
        console.error('[useLiveAccess] Failed to resolve live access', error);
        setAccess('misconfigured');
      }
    });
    return () => { cancelled = true; };
  }, [resolveSignal]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(DEVICE_KEY);
        setResolveSignal((s) => s + 1);
      } else if (event === 'SIGNED_IN') {
        setResolveSignal((s) => s + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return { access, config };
}
