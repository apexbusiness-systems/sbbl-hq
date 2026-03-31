import { AppRole } from '@/lib/auth/roles';

// Set to $7 as requested
export const PLAYER_REGISTRATION_PRICE_USD = 7;

// Helper to determine the status of the subscription
export function getSubscriptionStatus(subscriptionEndsAt: string | null, now = new Date()): 'active' | 'grace' | 'expired' {
  if (!subscriptionEndsAt) return 'expired';

  const expiresAt = new Date(subscriptionEndsAt);
  if (Number.isNaN(expiresAt.getTime())) return 'expired';

  if (expiresAt > now) return 'active';

  // 5 days grace period nudge logic
  const graceEnd = new Date(expiresAt.getTime() + 5 * 24 * 60 * 60 * 1000);
  if (now <= graceEnd) return 'grace';

  return 'expired';
}

export function isPlayerSubscriptionActive(subscriptionEndsAt: string | null, now = new Date()): boolean {
  return getSubscriptionStatus(subscriptionEndsAt, now) === 'active';
}

export function hasPremiumPlayerAccess(role: AppRole, subscriptionEndsAt: string | null, now = new Date()) {
  if (role === 'league_admin' || role === 'super_admin') return true;
  // Note: coach requires same check as player
  if (role !== 'player' && role !== 'coach') return false;

  const status = getSubscriptionStatus(subscriptionEndsAt, now);
  // Allow access during the active and grace periods
  return status === 'active' || status === 'grace';
}

export function shouldShowMinimalStats(role: AppRole, subscriptionEndsAt: string | null, now = new Date()) {
  return !hasPremiumPlayerAccess(role, subscriptionEndsAt, now);
}

// Discount logic
export function getStoreDiscountPercent(role: AppRole, subscriptionEndsAt: string | null, now = new Date()) {
  if (role === 'league_admin' || role === 'super_admin') return 100; // Free for admins potentially? Or 0
  if (hasPremiumPlayerAccess(role, subscriptionEndsAt, now)) return 5;
  return 0;
}
