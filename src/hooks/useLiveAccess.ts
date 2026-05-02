import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { type AppRole } from '@/lib/auth/roles';

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
      // 1. Always fetch stream config (public read — no auth needed).
      // Also fetch active_game_id so entitlement checks are scoped to the
      // correct game and a user's PPV for game A cannot bleed into game B.
      const { data: cfg } = await supabase!
        .from('stream_admin_config')
        .select('is_live, collection_id, title, active_game_id')
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

      // 3. Check role — only player, paid_fan, and super_admin get free access.
      // This mirrors handlePlaybackSession on the server: coach/team_manager/
      // league_admin are operational roles that do not include stream access.
      const { data: roleRows } = await supabase!
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id);

      const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
      const isFreeRole = (roles as AppRole[]).some(
        (r) => r === 'player' || r === 'paid_fan' || r === 'super_admin',
      );

      if (isFreeRole) {
        localStorage.setItem(DEVICE_KEY, user.id);
        if (!cancelled) setAccess('free');
        return;
      }

      // 4. Check paid entitlement (fan path).
      // Scope by active_game_id so a PPV purchase for one game cannot grant
      // visual-access state on a different game's stream page.
      const activeGameId = (cfg as { active_game_id?: string | null } | null)?.active_game_id ?? null;
      if (!activeGameId) {
        // No active game → no purchasable PPV stream → show paywall
        if (!cancelled) setAccess('paywall');
        return;
      }

      const { data: entitlements } = await supabase!
        .from('stream_entitlements')
        .select('id, status, expires_at')
        .eq('user_id', user.id)
        .eq('game_id', activeGameId)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(DEVICE_KEY);
        setResolveSignal(s => s + 1);
      } else if (event === 'SIGNED_IN') {
        setResolveSignal(s => s + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return { access, config };
}
