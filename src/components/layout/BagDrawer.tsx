import { AppRole } from '@/lib/auth/roles';
import { getStoreDiscountPercent } from '@/lib/auth/subscription';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api/client';
import { products } from '@/data/mock';
import { X, Trash2, ShoppingBag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const BagDrawer = () => {
  const { bagOpen, setBagOpen, bagItems, removeFromBag } = useApp();
  const { session, roles } = useAuth();
  const { playerSubscriptionEndsAt } = useApp();
  const [checkingOut, setCheckingOut] = useState(false);

  if (!bagOpen) return null;

  const appRoles = (roles.length > 0 ? roles : ['fan']) as AppRole[];
  // Determine highest role for discount processing
  const primaryRole = appRoles[appRoles.length - 1];
  const discountPercent = getStoreDiscountPercent(primaryRole, playerSubscriptionEndsAt);
  const discountMultiplier = 1 - (discountPercent / 100);

  const subtotal = bagItems.reduce((sum, id) => {
    const product = products.find(p => p.id === id);
    return sum + (product?.price ?? 0);
  }, 0);

  const finalTotal = subtotal * discountMultiplier;


  const handleCheckout = async () => {
    if (!session) { toast.error('Sign in to complete your purchase.'); return; }
    const lineItems = bagItems.reduce<Array<{ name: string; price: number; qty: number }>>((acc, id) => {
      const product = products.find(p => p.id === id);
      if (!product || product.price === 0) return acc; // skip reward/free items
      const existing = acc.find(i => i.name === product.name);
      if (existing) { existing.qty += 1; } else { acc.push({ name: product.name, price: product.price, qty: 1 }); }
      return acc;
    }, []);
    if (!lineItems.length) { toast.error('No purchasable items in bag.'); return; }
    setCheckingOut(true);
    try {
      const res = await apiFetch<{ ok: boolean; url?: string; error?: string }>('/api/store/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: lineItems,
          successUrl: `${window.location.origin}/store?success=1`,
          cancelUrl: `${window.location.origin}/store`,
        }),
      }, session.access_token);
      if (res.ok && res.url) {
        window.location.href = res.url;
      } else if (res.error === 'payments_not_configured') {
        toast.error('Payments not yet configured. Contact info-outreach@sbbl-hq.icu');
      } else {
        toast.error(res.error ?? 'Checkout failed. Please try again.');
      }
    } catch {
      toast.error('Could not reach the payment service. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

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
              <span className="font-display font-bold text-muted-foreground line-through">₱{subtotal.toLocaleString()}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-success font-bold uppercase tracking-wider">{discountPercent}% Player/Coach Discount</span>
                <span className="font-display font-bold text-success">-₱{(subtotal - finalTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border/50 pt-2">
              <span className="text-sm font-bold">Total</span>
              <span className="font-display font-bold text-primary text-xl">₱{finalTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full gold-bg py-3 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {checkingOut ? 'Redirecting…' : 'Proceed to Checkout'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
