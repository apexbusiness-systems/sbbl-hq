import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LeagueId } from '@/types';
import { AppRole } from '@/lib/auth/roles';
import { hasPremiumPlayerAccess, isPlayerSubscriptionActive } from '@/lib/auth/subscription';
import { useAuth } from '@/hooks/use-auth';
import { leagueIdFromCode, persistLeague, loadPersistedLeague } from '@/lib/leagues';
import { readClientEnv } from '@/lib/env';
import { getSupabaseClient } from '@/lib/supabase/client';

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
  bagItems: string[];
  addToBag: (id: string) => void;
  removeFromBag: (id: string) => void;
  bagOpen: boolean;
  setBagOpen: (o: boolean) => void;
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
  const [bagItems, setBagItems] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);

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

  const renewPlayerTier = () => {
    // TODO: replace with POST /api/player/checkout → Stripe checkout session
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    setPlayerSubscriptionEndsAt(now.toISOString());
  };

  // Pull subscription_ends_at from the database — source of truth is the profile row,
  // not localStorage. If the column doesn't exist yet the query fails silently (null).
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

  const addToBag = (id: string) => {
    setBagItems((prev) => [...prev, id]);
    setBagOpen(true);
  };

  const removeFromBag = (id: string) => {
    setBagItems((prev) => prev.filter((i) => i !== id));
  };

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
      bagItems,
      addToBag,
      removeFromBag,
      bagOpen,
      setBagOpen,
    }}>
      {children}
    </AppContext.Provider>
  );
};
