import { describe, expect, it } from 'vitest';
import { PPV_ACCESS_HOURS, PPV_SESSION_CAP_HOURS } from '@/lib/auth/subscription';
import { ENTITLEMENT } from '@/lib/constants/ENTITLEMENT_CONSTANTS';

describe('PPV access window', () => {
  it('entitlement validity is 48 hours (tolerates game-day delays)', () => {
    expect(PPV_ACCESS_HOURS).toBe(48);
    expect(PPV_ACCESS_HOURS).toBe(ENTITLEMENT.ENTITLEMENT_VALIDITY_HOURS);
  });

  it('session hard cap is 6 hours, independent of entitlement', () => {
    expect(PPV_SESSION_CAP_HOURS).toBe(6);
    expect(PPV_SESSION_CAP_HOURS * 3600).toBe(ENTITLEMENT.VIEWING_SESSION_MAX_SECONDS);
  });

  it('entitlement window is strictly greater than session cap', () => {
    expect(PPV_ACCESS_HOURS).toBeGreaterThan(PPV_SESSION_CAP_HOURS);
  });

  it('entitlement expires at correct time from purchase', () => {
    const purchasedAt = new Date('2026-04-04T12:00:00.000Z');
    const expiry = new Date(purchasedAt.getTime() + PPV_ACCESS_HOURS * 60 * 60 * 1000);
    // 48 hours later: 2026-04-06T12:00:00.000Z
    expect(expiry.toISOString()).toBe('2026-04-06T12:00:00.000Z');
  });

  it('session cap expires 6h from session start, not entitlement purchase', () => {
    const sessionStart = new Date('2026-04-05T20:00:00.000Z');
    const cap = new Date(sessionStart.getTime() + PPV_SESSION_CAP_HOURS * 60 * 60 * 1000);
    expect(cap.toISOString()).toBe('2026-04-06T02:00:00.000Z');
  });
});
