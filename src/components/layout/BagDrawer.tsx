import { useApp } from '@/contexts/AppContext';
import { products } from '@/data/mock';
import { X, Trash2 } from 'lucide-react';

export const BagDrawer = () => {
  const { bagOpen, setBagOpen, bagItems, removeFromBag } = useApp();

  if (!bagOpen) return null;

  const items = bagItems.map(id => products.find(p => p.id === id)).filter(Boolean);
  const total = items.reduce((sum, p) => sum + (p?.price || 0), 0);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setBagOpen(false)} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border animate-slide-in flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display text-lg font-bold">Your Bag</h3>
          <button onClick={() => setBagOpen(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">Your bag is empty</p>
          ) : (
            <div className="space-y-3">
              {items.map((p, i) => p && (
                <div key={i} className="flex gap-3 p-3 bg-secondary rounded-sm">
                  <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded-sm" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                    <p className="text-sm font-display font-bold text-primary mt-1">₱{p.price.toLocaleString()}</p>
                  </div>
                  <button onClick={() => removeFromBag(p.id)} className="p-1 text-muted-foreground hover:text-destructive self-start"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl font-bold text-primary">₱{total.toLocaleString()}</span>
            </div>
            <button className="w-full py-3 gold-bg font-display font-bold text-sm uppercase tracking-wider rounded-sm">
              Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
