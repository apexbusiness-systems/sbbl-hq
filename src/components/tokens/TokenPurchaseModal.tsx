/**
 * Token purchase modal — bundle picker + Stripe checkout trigger.
 *
 * Pure presentation + `onPurchase(productId)` callback. Parent owns the
 * Stripe Checkout redirect and the query invalidation on completion.
 * Modal backdrop click closes; Escape closes. No focus-trap (not our
 * scope here; a focus-trap library was out of budget); focus returns to
 * triggering element via the parent's own logic if needed.
 */
import { memo } from 'react';
import type { FanTokenProduct } from '@/lib/tokens/types';
import { TokenCoinIcon } from './TokenCoinIcon';

interface Props {
  open: boolean;
  products: FanTokenProduct[];
  busyProductId?: string | null;
  onPurchase: (productId: string) => void;
  onClose: () => void;
}

function TokenPurchaseModalImpl({ open, products, busyProductId, onPurchase, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buy fan tokens"
      data-testid="token-purchase-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-card border border-border rounded-md shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display uppercase tracking-wide text-lg text-foreground">
            Buy Fan Tokens
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`token-bundle-${p.id}`}
              onClick={() => onPurchase(p.id)}
              disabled={busyProductId === p.id}
              className={[
                'w-full flex items-center gap-3 p-3 rounded-md border border-border bg-background',
                'hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.05)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'transition-colors text-left',
                'disabled:opacity-60 disabled:cursor-wait',
              ].join(' ')}
            >
              <TokenCoinIcon size={28} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{p.label}</div>
                <div className="text-xs text-muted-foreground">
                  {p.tokenCount.toLocaleString()} tokens
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg text-primary tabular-nums">
                  ${p.priceCad.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">CAD</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Checkout is handled by Stripe. You will be redirected.
        </p>
      </div>
    </div>
  );
}

export const TokenPurchaseModal = memo(TokenPurchaseModalImpl);
