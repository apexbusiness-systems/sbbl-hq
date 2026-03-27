import { describe, expect, it } from 'vitest';
import { hasPremiumPlayerAccess, isPlayerSubscriptionActive, PLAYER_REGISTRATION_PRICE_USD, shouldShowMinimalStats } from '@/lib/auth/subscription';

describe('player subscription access', () => {
  it('uses $7 monthly player registration', () => {
    expect(PLAYER_REGISTRATION_PRICE_USD).toBe(7);
  });

  it('validates active subscription window for players', () => {
    const now = new Date('2026-03-27T00:00:00.000Z');
    expect(isPlayerSubscriptionActive('2026-04-05T00:00:00.000Z', now)).toBe(true);
    expect(isPlayerSubscriptionActive('2026-03-01T00:00:00.000Z', now)).toBe(false);
  });

  it('gates premium access and minimal stats correctly', () => {
    const now = new Date('2026-03-27T00:00:00.000Z');
    expect(hasPremiumPlayerAccess('player', '2026-04-05T00:00:00.000Z', now)).toBe(true);
    expect(hasPremiumPlayerAccess('player', null, now)).toBe(false);
    expect(shouldShowMinimalStats('fan', null, now)).toBe(true);
  });
});
