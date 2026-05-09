/**
 * Canonical entitlement constants — value & invariant guard.
 *
 * This test enforces the SINGLE SOURCE OF TRUTH for PPV access semantics.
 * If any value drifts from spec, the build fails. The test also cross-checks
 * downstream aliases (PPV_ACCESS_HOURS, SIX_HOURS_MS) to guarantee they
 * derive from the same root and do not silently redefine the window.
 */
import { describe, expect, it } from 'vitest';
import { ENTITLEMENT, ENTITLEMENT_MS } from '@/lib/constants/ENTITLEMENT_CONSTANTS';
import { PPV_ACCESS_HOURS, PPV_SESSION_CAP_HOURS } from '@/lib/auth/subscription';
import { SIX_HOURS_MS, ENTITLEMENT_VALIDITY_MS } from '@/lib/stream/validation-policy';

describe('entitlement canonical values', () => {
  it('viewing session max is 6 hours (21600s)', () => {
    expect(ENTITLEMENT.VIEWING_SESSION_MAX_SECONDS).toBe(21600);
    expect(ENTITLEMENT_MS.VIEWING_SESSION_MAX).toBe(21600 * 1000);
  });

  it('entitlement validity is 48 hours post-purchase', () => {
    expect(ENTITLEMENT.ENTITLEMENT_VALIDITY_HOURS).toBe(48);
    expect(ENTITLEMENT_MS.ENTITLEMENT_VALIDITY).toBe(48 * 60 * 60 * 1000);
  });

  it('manual comp grant default is 48 hours', () => {
    expect(ENTITLEMENT.MANUAL_COMP_VALIDITY_HOURS).toBe(48);
  });

  it('entitlement validity strictly exceeds session cap', () => {
    expect(ENTITLEMENT_MS.ENTITLEMENT_VALIDITY).toBeGreaterThan(ENTITLEMENT_MS.VIEWING_SESSION_MAX);
  });

  it('replay embargo default is 7 days', () => {
    expect(ENTITLEMENT.REPLAY_EMBARGO_DAYS).toBe(7);
    expect(ENTITLEMENT_MS.REPLAY_EMBARGO).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('replay pricing: raw $1.50 CAD / edited $5.00 CAD', () => {
    expect(ENTITLEMENT.REPLAY_RAW_PRICE_CAD).toBe(1.5);
    expect(ENTITLEMENT.REPLAY_EDITED_PRICE_CAD).toBe(5.0);
  });

  it('replay validity: raw 72h / edited 30d', () => {
    expect(ENTITLEMENT.REPLAY_RAW_VALIDITY_HOURS).toBe(72);
    expect(ENTITLEMENT.REPLAY_EDITED_VALIDITY_DAYS).toBe(30);
    expect(ENTITLEMENT_MS.REPLAY_RAW_VALIDITY).toBe(72 * 60 * 60 * 1000);
    expect(ENTITLEMENT_MS.REPLAY_EDITED_VALIDITY).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('downstream aliases derive from canonical constants (no drift)', () => {
  it('PPV_ACCESS_HOURS equals canonical entitlement validity', () => {
    expect(PPV_ACCESS_HOURS).toBe(ENTITLEMENT.ENTITLEMENT_VALIDITY_HOURS);
  });

  it('PPV_SESSION_CAP_HOURS equals canonical viewing session cap', () => {
    expect(PPV_SESSION_CAP_HOURS * 3600).toBe(ENTITLEMENT.VIEWING_SESSION_MAX_SECONDS);
  });

  it('validation-policy SIX_HOURS_MS equals canonical session cap', () => {
    expect(SIX_HOURS_MS).toBe(ENTITLEMENT_MS.VIEWING_SESSION_MAX);
  });

  it('validation-policy ENTITLEMENT_VALIDITY_MS equals canonical entitlement validity', () => {
    expect(ENTITLEMENT_VALIDITY_MS).toBe(ENTITLEMENT_MS.ENTITLEMENT_VALIDITY);
  });
});
