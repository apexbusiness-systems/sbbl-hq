import { useApp } from '@/contexts/AppContext';
import { X, Trash2 } from 'lucide-react';

export const BagDrawer = () => {
  const { bagOpen, setBagOpen, bagItems, removeFromBag } = useApp();

  if (!bagOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setBagOpen(false)} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border animate-slide-in flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display text-lg">Your Bag</h3>
          <button onClick={() => setBagOpen(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {bagItems.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">Your bag is empty</p>
          ) : (
            <div className="space-y-3">
              {bagItems.map((id, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-secondary rounded-sm">
                  <span className="text-sm font-medium truncate">{id}</span>
                  <button onClick={() => removeFromBag(id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
