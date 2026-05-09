/**
 * Fan Token System — typed API client.
 *
 * Every token endpoint is reachable through a wrapper here. Callers
 * never hand-roll paths or parse raw responses; this keeps the API
 * surface narrow and refactorable.
 */
import { apiFetch } from '@/lib/api/client';
import type {
  AwardResult,
  FanTokenProduct,
  FanTokenWallet,
  LeaderboardEntry,
  PurchaseCheckoutStart,
  TokenAwardCategory,
} from '@/lib/tokens/types';

export async function fetchTokenProducts(): Promise<FanTokenProduct[]> {
  const res = await apiFetch<{ ok: boolean; data: FanTokenProduct[] }>('/api/tokens/products');
  return res.data ?? [];
}

export async function fetchTokenCategories(): Promise<TokenAwardCategory[]> {
  const res = await apiFetch<{ ok: boolean; data: TokenAwardCategory[] }>('/api/tokens/categories');
  return res.data ?? [];
}

export async function fetchTokenWallet(): Promise<FanTokenWallet> {
  const res = await apiFetch<{ ok: boolean; wallet: FanTokenWallet }>('/api/tokens/wallet');
  return res.wallet;
}

export async function fetchLeaderboardByGame(gameId: string): Promise<LeaderboardEntry[]> {
  const res = await apiFetch<{ ok: boolean; data: unknown[] }>(
    `/api/tokens/leaderboard/${encodeURIComponent(gameId)}`,
  );
  return (res.data ?? []).map(toLeaderboardEntry);
}

export async function fetchLeaderboardBySeason(seasonId: string): Promise<LeaderboardEntry[]> {
  const res = await apiFetch<{ ok: boolean; data: unknown[] }>(
    `/api/tokens/leaderboard/season/${encodeURIComponent(seasonId)}`,
  );
  return (res.data ?? []).map(toLeaderboardEntry);
}

export async function startTokenPurchase(productId: string): Promise<PurchaseCheckoutStart> {
  const res = await apiFetch<{
    ok: boolean;
    checkoutUrl: string;
    sessionId: string;
    productId: string;
  }>('/api/tokens/purchase', { method: 'POST', body: JSON.stringify({ productId }) });
  return {
    checkoutUrl: res.checkoutUrl,
    sessionId: res.sessionId,
    productId: res.productId,
  };
}

export interface AwardTokenArgs {
  recipientPlayerId: string;
  amount: number;
  gameId?: string | null;
  seasonId?: string | null;
  categorySlug: string;
  /** Client-generated UUID v4; the server rejects replays. */
  idempotencyKey: string;
}

export async function awardTokens(args: AwardTokenArgs): Promise<AwardResult> {
  const res = await apiFetch<{
    ok: boolean;
    replay: boolean;
    transaction_id: string;
    recipient_player_id: string;
    amount: number;
    wallet_balance?: number;
    leaderboard_total: number;
  }>('/api/tokens/award', {
    method: 'POST',
    body: JSON.stringify(args),
  });
  return {
    replay: res.replay,
    transactionId: res.transaction_id,
    recipientPlayerId: res.recipient_player_id,
    amount: res.amount,
    walletBalance: res.wallet_balance ?? 0,
    leaderboardTotal: res.leaderboard_total,
  };
}

function toLeaderboardEntry(row: unknown): LeaderboardEntry {
  const r = row as Record<string, unknown>;
  return {
    playerId: String(r.player_id ?? ''),
    totalTokens: Number(r.total_tokens ?? 0),
    categoryBreakdown: (r.category_breakdown as Record<string, number>) ?? {},
    lastUpdated: String(r.last_updated ?? ''),
  };
}
