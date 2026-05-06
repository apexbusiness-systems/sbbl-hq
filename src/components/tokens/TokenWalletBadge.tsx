/**
 * Token wallet badge — persistent balance pill.
 *
 * Mount anywhere (typically app header). Fetches wallet lazily via
 * react-query when the caller passes `enabled`. Pulses briefly when
 * the balance changes.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { TokenCoinIcon } from './TokenCoinIcon';

interface Props {
  balance: number;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

function TokenWalletBadgeImpl({ balance, loading = false, onClick, className = '' }: Props) {
  const lastBalance = useRef(balance);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (balance !== lastBalance.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 600);
      lastBalance.current = balance;
      return () => window.clearTimeout(t);
    }
  }, [balance]);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="token-wallet-badge"
      aria-label={`Fan token balance: ${balance}`}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-card border border-[hsl(var(--primary)/0.3)] text-foreground',
        'text-xs font-semibold tabular-nums',
        'hover:bg-[hsl(var(--primary)/0.1)] transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        pulse ? 'animate-[sbbl-token-pulse_600ms_ease-out]' : '',
        className,
      ].join(' ')}
    >
      <TokenCoinIcon size={16} />
      <span data-testid="token-wallet-balance">{loading ? '—' : balance.toLocaleString()}</span>
      <style>{`
        @keyframes sbbl-token-pulse {
          0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.35); }
          100% { box-shadow: 0 0 0 12px hsl(var(--primary) / 0); }
        }
      `}</style>
    </button>
  );
}

export const TokenWalletBadge = memo(TokenWalletBadgeImpl);
