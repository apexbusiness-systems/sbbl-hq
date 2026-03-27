import React, { createContext, useContext, useState, ReactNode } from 'react';
import { LeagueId } from '@/types';

type AuthMode = 'fan' | 'admin';

interface AppState {
  activeLeague: LeagueId;
  setActiveLeague: (l: LeagueId) => void;
  authMode: AuthMode;
  setAuthMode: (m: AuthMode) => void;
  isAdmin: boolean;
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
  const [authMode, setAuthMode] = useState<AuthMode>('fan');
  const [bagItems, setBagItems] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);

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
      authMode,
      setAuthMode,
      isAdmin: authMode === 'admin',
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
