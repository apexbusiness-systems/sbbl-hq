import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
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
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabaseClient.auth.getSession();
    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);

    if (data.session?.user?.id) {
      const details = await fetchProfileAndRoles(data.session.user.id);
      setProfile(details.profile);
      setRoles(details.roles);
    } else {
      setProfile(null);
      setRoles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
        setRoles([]);
      }
      void load();
    });

    return () => data.subscription.unsubscribe();
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
    refresh: load,
  }), [loading, session, user, profile, roles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
