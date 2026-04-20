import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { hasRole, type AppRole } from '@/lib/auth/roles';

const DEVICE_KEY = 'sbbl_stream_device';

export type AccessState =
  | 'loading'
  | 'unauthenticated'   // no user → show CTA
  | 'free'              // player or team_manager → show player
  | 'paid'              // fan with active entitlement → show player
  | 'paywall';          // fan, no entitlement → show paywall

export interface LiveConfig {
  isLive: boolean;
  videoUrl: string | null;  // collection_id from stream_admin_config
  title: string;
}

export function useLiveAccess() {
  const [access, setAccess] = useState<AccessState>('loading');
  const [config, setConfig] = useState<LiveConfig>({
    isLive: false,
    videoUrl: null,
    title: 'SBBL Live',
  });
  // Incrementing this re-runs the resolve effect (e.g. after sign-in/sign-out)
  const [resolveSignal, setResolveSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAccess('unauthenticated');
      return;
    }

    async function resolve() {
      // 1. Always fetch stream config (public read — no auth needed)
      const { data: cfg } = await supabase!
        .from('stream_admin_config')
        .select('is_live, collection_id, title')
        .single();

      if (!cancelled && cfg) {
        setConfig({
          isLive: cfg.is_live ?? false,
          videoUrl: cfg.collection_id ?? null,
          title: cfg.title ?? 'SBBL Live',
        });
      }

      // 2. Get current user
      const { data: { user } } = await supabase!.auth.getUser();

      if (!user) {
        if (!cancelled) setAccess('unauthenticated');
        return;
      }

      // 3. Check role
      const { data: roleRows } = await supabase!
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id);

      const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
      // Any role with hierarchy ≥ player (coach, team_manager, media_operator,
      // store_operator, league_admin, super_admin) bypasses the paywall entirely.
      const isFreeRole = hasRole(roles as AppRole[], 'player');

      if (isFreeRole) {
        localStorage.setItem(DEVICE_KEY, user.id);
        if (!cancelled) setAccess('free');
        return;
      }

      // 4. Check paid entitlement (fan path)
      const { data: entitlements } = await supabase!
        .from('stream_entitlements')
        .select('id, status, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const hasActive = Array.isArray(entitlements) && entitlements.some(
        (e: { expires_at: string | null }) =>
          !e.expires_at || new Date(e.expires_at) > new Date()
      );

      if (hasActive) {
        localStorage.setItem(DEVICE_KEY, user.id);
        if (!cancelled) setAccess('paid');
        return;
      }

      // 5. Fan with no entitlement → paywall
      if (!cancelled) setAccess('paywall');
    }

    setAccess('loading');
    resolve();
    return () => { cancelled = true; };
  }, [resolveSignal]);

  // Re-resolve on sign-in/sign-out; clear device lock on sign-out
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const authChange = supabase.auth.onAuthStateChange?.((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(DEVICE_KEY);
        setResolveSignal(s => s + 1);
      } else if (event === 'SIGNED_IN') {
        setResolveSignal(s => s + 1);
      }
    }) ?? { data: { subscription: null } };
    const { data: { subscription } = {} } = authChange;
    return () => subscription?.unsubscribe();
  }, []);

  return { access, config };
}
