import { AppRole } from '@/lib/auth/roles';

/** Player membership: $6.99 CAD / month recurring subscription (before tax) */
export const PLAYER_REGISTRATION_PRICE_CAD = 6.99;

/**
 * Alberta applies only federal GST (5%). No PST.
 * All prices are quoted before tax; GST is collected by Stripe at checkout.
 */
export const ALBERTA_GST_RATE = 0.05;

/** Returns the total price including Alberta GST, rounded to 2 decimal places. */
export function priceWithTax(baseCAD: number): number {
  return Math.round(baseCAD * (1 + ALBERTA_GST_RATE) * 100) / 100;
}

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
