import { describe, expect, it } from 'vitest';
import { PPV_ACCESS_HOURS } from '@/lib/auth/subscription';

describe('PPV access window', () => {
  it('PPV access window is 6 hours', () => {
    expect(PPV_ACCESS_HOURS).toBe(6);
  });

  it('6-hour PPV window is less than 24 hours', () => {
    const sixHoursMs = PPV_ACCESS_HOURS * 60 * 60 * 1000;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(sixHoursMs).toBeLessThan(twentyFourHoursMs);
  });

  it('PPV token expires at correct time from start', () => {
    const start = new Date('2026-04-04T12:00:00.000Z');
    const expiry = new Date(start.getTime() + PPV_ACCESS_HOURS * 60 * 60 * 1000);
    expect(expiry.toISOString()).toBe('2026-04-04T18:00:00.000Z');
  });
});
