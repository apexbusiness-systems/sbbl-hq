import React, { createContext, useContext, useState, ReactNode } from 'react';
import { LeagueId } from '@/types';
import { AppRole } from '@/lib/auth/roles';
import { hasPremiumPlayerAccess, isPlayerSubscriptionActive } from '@/lib/auth/subscription';

const isDevAuthPrototype = import.meta.env.DEV;

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

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [activeLeague, setActiveLeague] = useState<LeagueId>('sbbl');
  const [authRole, setAuthRole] = useState<AppRole>('fan');
  const [playerSubscriptionEndsAt, setPlayerSubscriptionEndsAt] = useState<string | null>(null);
  const [bagItems, setBagItems] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);

  const renewPlayerTier = () => {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    setPlayerSubscriptionEndsAt(now.toISOString());
  };

  const addToBag = (id: string) => {
    setBagItems(prev => [...prev, id]);
    setBagOpen(true);
  };

  const removeFromBag = (id: string) => {
    setBagItems(prev => prev.filter(i => i !== id));
  };

  return (
      <AppContext.Provider value={{
        activeLeague,
        setActiveLeague,
        authRole,
        setAuthRole,
        isPrototypeAuthMode: isDevAuthPrototype,
        isAdmin: authRole === 'league_admin' || authRole === 'super_admin',
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
