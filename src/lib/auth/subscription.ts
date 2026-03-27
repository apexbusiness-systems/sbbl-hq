import { AppRole } from '@/lib/auth/roles';

export const PLAYER_REGISTRATION_PRICE_USD = 7;

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
