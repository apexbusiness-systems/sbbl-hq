import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { initSupabaseClient, getSupabaseClient } from '@/lib/supabase/client';
import { canAccessOps, type AppRole } from '@/lib/auth/roles';
import { fetchProfileAndRoles, type AuthProfile } from '@/lib/api/auth';

const PROFILE_CACHE_TTL = 5 * 60 * 1000;

async function getCachedProfile(userId: string) {
  const cacheKey = `auth_profile_cache_${userId}`;

  // Try cache first
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < PROFILE_CACHE_TTL) {
        // Fire background revalidation
        fetchProfileAndRoles(userId).then(data => {
          sessionStorage.setItem(cacheKey, JSON.stringify({ ...data, timestamp: Date.now() }));
        }).catch(() => { /* silent */ });
        return parsed.data;
      }
    }
  } catch { /* ignore cache parse errors */ }

  // Network fetch
  try {
    const data = await fetchProfileAndRoles(userId);
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  } catch (err) {
    // Graceful degradation: log silently
    console.error('Failed to fetch profile', err);
    return { profile: null, roles: [] };
  }
}

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
  const currentUserIdRef = useRef<string | null>(null);

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
    const { data } = await client.auth.getSession();
    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);
    currentUserIdRef.current = data.session?.user?.id ?? null;

    if (data.session?.user?.id) {
      const details = await getCachedProfile(data.session.user.id);
      setProfile(details.profile);
      setRoles(details.roles);
    } else {
      setProfile(null);
      setRoles([]);
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

      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        // Use the session directly from the event — never call load() here.
        // Calling load() from inside onAuthStateChange triggers a second
        // getSession() which can transiently return null and wipe auth state
        // during the magic-link or password sign-in redirect window.
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        const nextUserId = nextSession?.user?.id ?? null;
        if (currentUserIdRef.current === nextUserId) return;
        currentUserIdRef.current = nextUserId;
        if (nextSession?.user?.id) {
          void getCachedProfile(nextSession.user.id).then(({ profile: p, roles: r }) => {
            setProfile(p);
            setRoles(r);
          });
        } else {
          setProfile(null);
          setRoles([]);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    };

    void boot();
    return () => unsubscribe?.();
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading,
    session,
    user,
    profile,
    roles,
    isSignedIn: Boolean(user),
    isAdmin: canAccessOps(roles),
    needsOnboarding: Boolean(user && (!profile?.display_name || !profile?.full_name || !profile?.primary_role_intent)),
    configAvailable,
    refresh: load,
  }), [loading, session, user, profile, roles, configAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
