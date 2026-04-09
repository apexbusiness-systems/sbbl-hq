import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { initSupabaseClient, getSupabaseClient } from '@/lib/supabase/client';
import { canAccessOps, type AppRole } from '@/lib/auth/roles';
import { fetchProfileAndRoles, type AuthProfile } from '@/lib/api/auth';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  isSignedIn: boolean;
  isAdmin: boolean;
  needsOnboarding: boolean;
  configAvailable: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [configAvailable, setConfigAvailable] = useState(true);

  const load = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // GUARDRAIL: Read the cached session first (instant, localStorage only),
    // then force a live token refresh via getUser() ONLY when the access_token
    // is expired or about to expire (<60 s remaining).  This eliminates a
    // ~150-300 ms network round-trip on every cold mount for fresh tokens
    // while still preventing stale/expired access_tokens from causing
    // "unauthorized" errors on Save Config / Go Live.
    let { data } = await client.auth.getSession();

    if (data.session) {
      const expiresAt = (data.session.expires_at ?? 0) * 1000; // seconds → ms
      const needsRefresh = expiresAt - Date.now() < 60_000;
      if (needsRefresh) {
        await client.auth.getUser().catch(() => null);
        // Re-read session after the refresh has updated localStorage
        ({ data } = await client.auth.getSession());
      }
    }

    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);

    if (data.session?.user?.id) {
      const details = await fetchProfileAndRoles(data.session.user.id);
      setProfile(details.profile);
      setRoles(details.roles);
      Sentry.setUser({
        id: data.session.user.id,
        email: data.session.user.email,
        username: details.profile?.display_name ?? undefined,
      });
    } else {
      setProfile(null);
      setRoles([]);
      Sentry.setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const boot = async () => {
      try {
        await initSupabaseClient();
      } catch {
        setConfigAvailable(false);
        setLoading(false);
        return;
      }

      const client = getSupabaseClient();
      if (!client) {
        setConfigAvailable(false);
        setLoading(false);
        return;
      }

      setConfigAvailable(true);
      await load();

      const { data } = client.auth.onAuthStateChange((event, nextSession) => {
        // INITIAL_SESSION fires immediately on subscribe — boot() already
        // loaded session + profile, so skip to avoid a redundant fetch.
        if (event === 'INITIAL_SESSION') return;

        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user?.id) {
          // On SIGNED_IN, gate the loading state so Login.tsx waits for
          // profile/roles before navigating (prevents wrong onboarding redirect
          // when profile is still null).
          const gateLoading = event === 'SIGNED_IN';
          if (gateLoading) setLoading(true);

          void fetchProfileAndRoles(nextSession.user.id).then(({ profile: p, roles: r }) => {
            setProfile(p);
            setRoles(r);
            Sentry.setUser({
              id: nextSession.user.id,
              email: nextSession.user.email,
              username: p?.display_name ?? undefined,
            });
          }).catch(() => {
            setProfile(null);
            setRoles([]);
          }).finally(() => {
            if (gateLoading) setLoading(false);
          });
        } else {
          setProfile(null);
          setRoles([]);
          Sentry.setUser(null);
        }
      });

      unsubscribe = () => data.subscription.unsubscribe();
    };

    void boot();
    return () => unsubscribe?.();
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      profile,
      roles,
      isSignedIn: Boolean(user),
      isAdmin: canAccessOps(roles),
      needsOnboarding:
        !loading &&
        Boolean(user && !profile?.onboarding_completed_at) &&
        !canAccessOps(roles),
      configAvailable,
      refresh: load,
    }),
    [loading, session, user, profile, roles, configAvailable],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
