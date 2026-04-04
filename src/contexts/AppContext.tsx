import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LeagueId } from '@/types';
import { AppRole } from '@/lib/auth/roles';
import { hasPremiumPlayerAccess, isPlayerSubscriptionActive } from '@/lib/auth/subscription';
import { useAuth } from '@/hooks/use-auth';
import { leagueIdFromCode, persistLeague, loadPersistedLeague } from '@/lib/leagues';
import { readClientEnv } from '@/lib/env';
import { getSupabaseClient } from '@/lib/supabase/client';

// Bag state is intentionally split into BagContext so shopping-bag mutations
// do not cascade re-renders to league/stats/scores/live consumers.
interface AppState {
  activeLeague: LeagueId;
  setActiveLeague: (l: LeagueId) => void;
  authRole: AppRole;
  setAuthRole: (m: AppRole) => void;
  isPrototypeAuthMode: boolean;
  isAdmin: boolean;
  playerSubscriptionEndsAt: string | null;
  isPlayerSubscriptionActive: boolean;
  hasPremiumPlayerAccess: boolean;
  renewPlayerTier: () => void;
}

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

function resolveDefaultLeague(): LeagueId {
  const persisted = loadPersistedLeague();
  if (persisted) return persisted;
  try {
    const env = readClientEnv();
    return leagueIdFromCode(env.VITE_DEFAULT_LEAGUE);
  } catch {
    return 'sbbl';
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { roles, isAdmin: jwtIsAdmin, user } = useAuth();
  const [activeLeague, setActiveLeagueRaw] = useState<LeagueId>(resolveDefaultLeague);
  const [authRoleOverride, setAuthRoleOverride] = useState<AppRole | null>(null);
  const [playerSubscriptionEndsAt, setPlayerSubscriptionEndsAt] = useState<string | null>(null);

  // Effective role: prototype toggle overrides JWT role when set
  const authRole: AppRole = authRoleOverride ?? ((roles[0] ?? 'fan') as AppRole);

  // isAdmin: real JWT only — the prototype toggle never grants admin access
  const isAdmin = jwtIsAdmin;

  const setActiveLeague = (l: LeagueId) => {
    setActiveLeagueRaw(l);
    persistLeague(l);
  };

  const setAuthRole = (role: AppRole) => {
    setAuthRoleOverride(role);
  };

  // No-op: kept for interface compatibility. Actual renewal goes through
  // POST /api/player/checkout → Stripe → webhook stamps subscription_ends_at in DB.
  const renewPlayerTier = () => { /* wired via Billing page checkout flow */ };

  // Subscription status sourced exclusively from Supabase — never localStorage.
  // This prevents DevTools bypass (localStorage.setItem to fake premium access).
  useEffect(() => {
    if (!user?.id) {
      setPlayerSubscriptionEndsAt(null);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase
      .from('profiles')
      .select('subscription_ends_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          const raw = (data as Record<string, unknown>).subscription_ends_at;
          if (typeof raw === 'string') setPlayerSubscriptionEndsAt(raw);
        }
      });
  }, [user?.id]);

  return (
    <AppContext.Provider value={{
      activeLeague,
      setActiveLeague,
      authRole,
      setAuthRole,
      isPrototypeAuthMode: import.meta.env.DEV,
      isAdmin,
      playerSubscriptionEndsAt,
      isPlayerSubscriptionActive: isPlayerSubscriptionActive(playerSubscriptionEndsAt),
      hasPremiumPlayerAccess: hasPremiumPlayerAccess(authRole, playerSubscriptionEndsAt),
      renewPlayerTier,
    }}>
      {children}
    </AppContext.Provider>
  );
};
