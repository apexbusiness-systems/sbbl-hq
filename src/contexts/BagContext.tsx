// BagContext — isolated shopping-bag state.
//
// Splitting bag state out of AppContext prevents bag mutations (addToBag,
// setBagOpen) from cascade-re-rendering league/stats/scores consumers that
// subscribe to AppContext but have no interest in bag changes.
//
// Consumers:
//   Header        — bagItems count badge, setBagOpen
//   BagDrawer     — all bag state
//   Store         — addToBag
//   Live          — addToBag (featured merch carousel)

import { createContext, memo, useCallback, useContext, useState, type ReactNode } from 'react';

interface BagState {
  bagItems: string[];
  addToBag: (id: string) => void;
  removeFromBag: (id: string) => void;
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;
}

const BagContext = createContext<BagState | null>(null);

export function useBag(): BagState {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error('useBag must be used inside BagProvider');
  return ctx;
}

function BagProviderInner({ children }: { children: ReactNode }) {
  const [bagItems, setBagItems] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);

  const addToBag = useCallback((id: string) => {
    setBagItems((prev) => [...prev, id]);
    setBagOpen(true);
  }, []);

  const removeFromBag = useCallback((id: string) => {
    setBagItems((prev) => prev.filter((i) => i !== id));
  }, []);

  return (
    <BagContext.Provider value={{ bagItems, addToBag, removeFromBag, bagOpen, setBagOpen }}>
      {children}
    </BagContext.Provider>
  );
}

// memo wrapper so BagProvider itself doesn't re-render when parent re-renders
export const BagProvider = memo(BagProviderInner);
