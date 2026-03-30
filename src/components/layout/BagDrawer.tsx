import { useApp } from '@/contexts/AppContext';
import { products } from '@/data/mock';
import { X, Trash2, ShoppingBag } from 'lucide-react';

export const BagDrawer = () => {
  const { bagOpen, setBagOpen, bagItems, removeFromBag } = useApp();

  if (!bagOpen) return null;

  const subtotal = bagItems.reduce((sum, id) => {
    const product = products.find(p => p.id === id);
    return sum + (product?.price ?? 0);
  }, 0);

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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Your bag is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bagItems.map((id, i) => {
                const product = products.find(p => p.id === id);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-secondary rounded-sm">
                    {product?.image && (
                      <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product?.name ?? id}</p>
                      {product && product.price > 0 && (
                        <p className="text-xs text-primary font-semibold">₱{product.price.toLocaleString()}</p>
                      )}
                      {product && product.price === 0 && (
                        <p className="text-xs text-primary font-semibold">Reward Item</p>
                      )}
                    </div>
                    <button onClick={() => removeFromBag(id)} className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {bagItems.length > 0 && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-display font-bold text-primary">₱{subtotal.toLocaleString()}</span>
            </div>
            <button className="w-full gold-bg py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
