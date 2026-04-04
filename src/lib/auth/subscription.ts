import { AppRole } from '@/lib/auth/roles';

/** Player membership: $6.99 CAD / month recurring subscription */
export const PLAYER_REGISTRATION_PRICE_CAD = 6.99;

/**
 * @deprecated Use PLAYER_REGISTRATION_PRICE_CAD.
 * Kept for backwards-compatibility with existing test expectations.
 */
export const PLAYER_REGISTRATION_PRICE_USD = PLAYER_REGISTRATION_PRICE_CAD;

/** PPV single-stream access: $4.99 CAD, token valid for 6 hours from first use */
export const PPV_PRICE_CAD = 4.99;
export const PPV_ACCESS_HOURS = 6;

export function isPlayerSubscriptionActive(subscriptionEndsAt: string | null, now = new Date()): boolean {
  if (!subscriptionEndsAt) return false;
  const expiresAt = new Date(subscriptionEndsAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

export function hasPremiumPlayerAccess(role: AppRole, subscriptionEndsAt: string | null, now = new Date()) {
  if (role === 'league_admin' || role === 'super_admin') return true;
  if (role !== 'player') return false;
  return isPlayerSubscriptionActive(subscriptionEndsAt, now);
}

export function shouldShowMinimalStats(role: AppRole, subscriptionEndsAt: string | null, now = new Date()) {
  return !hasPremiumPlayerAccess(role, subscriptionEndsAt, now);
}

/** 10% discount for active player subscribers on store items */
export const PLAYER_STORE_DISCOUNT_PERCENT = 10;
