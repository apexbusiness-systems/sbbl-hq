import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LeagueId } from '@/types';
import { hasPremiumPlayerAccess, isPlayerSubscriptionActive } from '@/lib/auth/subscription';
import { useAuth } from '@/hooks/use-auth';
import { leagueIdFromCode, persistLeague, loadPersistedLeague } from '@/lib/leagues';
import { readClientEnv } from '@/lib/env';

interface AppState {
  activeLeague: LeagueId;
  setActiveLeague: (l: LeagueId) => void;
  authRole: 'fan' | 'player' | 'team_manager' | 'league_admin' | 'media_operator' | 'store_operator' | 'super_admin';
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
  const { roles, isAdmin } = useAuth();
  const [activeLeague, setActiveLeagueRaw] = useState<LeagueId>(resolveDefaultLeague);
  const [playerSubscriptionEndsAt, setPlayerSubscriptionEndsAt] = useState<string | null>(null);
  const [bagItems, setBagItems] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);

  const authRole = (roles[0] ?? 'fan') as AppState['authRole'];

  const setActiveLeague = (l: LeagueId) => {
    setActiveLeagueRaw(l);
    persistLeague(l);
  };

  const renewPlayerTier = () => {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    setPlayerSubscriptionEndsAt(now.toISOString());
  };

  useEffect(() => {
    const stored = localStorage.getItem('sbblhq.playerSubscriptionEndsAt');
    if (stored) setPlayerSubscriptionEndsAt(stored);
  }, []);

  useEffect(() => {
    if (!playerSubscriptionEndsAt) {
      localStorage.removeItem('sbblhq.playerSubscriptionEndsAt');
      return;
    }
    localStorage.setItem('sbblhq.playerSubscriptionEndsAt', playerSubscriptionEndsAt);
  }, [playerSubscriptionEndsAt]);

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
