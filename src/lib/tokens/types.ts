/**
 * Fan token system — shared types.
 */
export interface FanTokenProduct {
  id: string;
  label: string;
  tokenCount: number;
  priceCad: number;
  stripePriceId: string | null;
  sortOrder: number;
}

export interface FanTokenWallet {
  balance: number;
  totalPurchased: number;
  totalAwarded: number;
}

export interface TokenAwardCategory {
  slug: string;
  label: string;
  emoji: string | null;
  sortOrder: number;
}

export interface LeaderboardEntry {
  playerId: string;
  totalTokens: number;
  categoryBreakdown: Record<string, number>;
  lastUpdated: string;
  /** Enriched by the worker query; may be absent on realtime deltas. */
  player?: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    teamId: string | null;
  };
}

export interface AwardResult {
  replay: boolean;
  transactionId: string;
  recipientPlayerId: string;
  amount: number;
  walletBalance: number;
  leaderboardTotal: number;
}

export interface PurchaseCheckoutStart {
  checkoutUrl: string;
  productId: string;
  sessionId: string;
}
