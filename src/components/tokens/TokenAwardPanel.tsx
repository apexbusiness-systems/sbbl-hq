/**
 * Token award panel — player grid + category selector + award button.
 *
 * Flow:
 *   1. User selects a recipient player from the grid.
 *   2. User selects a category pill.
 *   3. User enters / steps an amount (default 1; capped at wallet balance
 *      and at the per-call cap enforced server-side).
 *   4. On submit, parent's onAward handler runs with an
 *      idempotency key; on success, parent triggers the burst animation.
 *
 * Stateless selection logic lives here; no fetch, no realtime — the
 * parent composes this with useQuery / useTokenLeaderboardRealtime.
 */
import { memo, useMemo, useState } from 'react';
import type { TokenAwardCategory } from '@/lib/tokens/types';
import { TokenCoinIcon } from './TokenCoinIcon';

export interface AwardablePlayer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  teamLabel?: string;
}

interface Props {
  players: AwardablePlayer[];
  categories: TokenAwardCategory[];
  walletBalance: number;
  busy?: boolean;
  /**
   * onAward returns a promise so the caller can await success, trigger
   * animation, and refresh leaderboard + wallet.
   */
  onAward: (args: {
    recipientPlayerId: string;
    amount: number;
    categorySlug: string;
    idempotencyKey: string;
  }) => Promise<void>;
}

const MAX_PER_AWARD = 1000;

function genIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function TokenAwardPanelImpl({
  players,
  categories,
  walletBalance,
  busy = false,
  onAward,
}: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categories[0]?.slug ?? null,
  );
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const maxAmount = useMemo(
    () => Math.min(walletBalance, MAX_PER_AWARD),
    [walletBalance],
  );

  const canSubmit =
    !!selectedPlayer &&
    !!selectedCategory &&
    amount > 0 &&
    amount <= maxAmount &&
    !busy;

  async function handleSubmit() {
    if (!canSubmit || !selectedPlayer || !selectedCategory) return;
    setError(null);
    try {
      await onAward({
        recipientPlayerId: selectedPlayer,
        amount,
        categorySlug: selectedCategory,
        idempotencyKey: genIdempotencyKey(),
      });
      // Reset amount but keep selection so user can stack awards.
      setAmount(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Award failed';
      setError(msg);
    }
  }

  return (
    <div
      data-testid="token-award-panel"
      className="flex flex-col gap-4 p-4 rounded-md border border-border bg-card"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display uppercase tracking-wide text-base text-foreground">
          Award tokens
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TokenCoinIcon size={14} />
          <span className="tabular-nums font-semibold text-foreground">{walletBalance}</span>
        </div>
      </div>

      {/* Player grid */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Player</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`token-player-${p.id}`}
              onClick={() => setSelectedPlayer(p.id)}
              className={[
                'p-2 rounded-md border text-left transition-colors',
                selectedPlayer === p.id
                  ? 'border-primary bg-[hsl(var(--primary)/0.1)]'
                  : 'border-border bg-background hover:border-[hsl(var(--primary)/0.4)]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full object-cover w-6 h-6"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary)/0.2)]" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {p.displayName}
                  </div>
                  {p.teamLabel && (
                    <div className="text-[10px] text-muted-foreground truncate">{p.teamLabel}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Category</div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              data-testid={`token-category-${c.slug}`}
              onClick={() => setSelectedCategory(c.slug)}
              className={[
                'px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider transition-colors',
                selectedCategory === c.slug
                  ? 'border-primary bg-[hsl(var(--primary)/0.15)] text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {c.emoji ? `${c.emoji} ` : ''}{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount stepper + submit */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setAmount((a) => Math.max(1, a - 1))}
            aria-label="Decrement"
            className="px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--primary)/0.05)]"
            disabled={amount <= 1}
          >
            −
          </button>
          <input
            data-testid="token-amount-input"
            type="number"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(e) => {
              const n = Math.max(1, Math.min(maxAmount, Number(e.target.value) || 1));
              setAmount(n);
            }}
            className="w-14 text-center bg-background text-foreground text-sm tabular-nums font-semibold focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setAmount((a) => Math.min(maxAmount, a + 1))}
            aria-label="Increment"
            className="px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--primary)/0.05)]"
            disabled={amount >= maxAmount}
          >
            +
          </button>
        </div>
        <button
          type="button"
          data-testid="token-award-submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={[
            'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-sm',
            'text-sm font-semibold uppercase tracking-wider',
            'bg-primary text-primary-foreground',
            'hover:bg-[hsl(var(--primary)/0.9)] transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          ].join(' ')}
        >
          <TokenCoinIcon size={16} />
          Award {amount}
        </button>
      </div>

      {error && (
        <div role="alert" className="text-xs text-destructive">{error}</div>
      )}
      {walletBalance < 1 && (
        <div className="text-xs text-muted-foreground">
          Your wallet is empty — buy tokens to award.
        </div>
      )}
    </div>
  );
}

export const TokenAwardPanel = memo(TokenAwardPanelImpl);
