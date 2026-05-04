import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { type AppRole } from '@/lib/auth/roles';

const DEVICE_KEY = 'sbbl_stream_device';

export type AccessState =
  | 'loading'
  | 'unauthenticated'
  | 'free'
  | 'paid'
  | 'paywall';

export interface LiveConfig {
  isLive: boolean;
  videoUrl: string | null;
  title: string;
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
      // Keep active_game_id lookup for test-backed entitlement scoping invariants.
      const { data: cfg } = await supabase
        .from('stream_admin_config')
        .select('is_live, title, active_game_id')
        .single();

      // Server-authoritative oracle: returns paywall flags and withholds stream_url unless permitted.
      const { data: broadcast } = await supabase.rpc('get_active_broadcast');
      const view = (broadcast as {
        is_live?: boolean | null;
        title?: string | null;
        stream_url?: string | null;
        requires_payment?: boolean | null;
        has_entitlement?: boolean | null;
        is_subscribed?: boolean | null;
      } | null) ?? null;

      if (!cancelled && view) {
        setConfig({
          isLive: Boolean(view.is_live),
          // Never expose raw upstream URL from client-side reads.
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

      if (isFreeRole || Boolean(view?.is_subscribed) || Boolean(view?.has_entitlement)) {
        localStorage.setItem(DEVICE_KEY, user.id);
        if (!cancelled) setAccess((isFreeRole || Boolean(view?.is_subscribed)) ? 'free' : 'paid');
        return;
      }


      const activeGameId = (cfg as { active_game_id?: string | null } | null)?.active_game_id ?? null;
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
          if (!cancelled) setAccess('paid');
          return;
        }
      }

      if (!cancelled) setAccess('paywall');
    }

    setAccess('loading');
    void resolve();
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
