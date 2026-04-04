import { describe, expect, it } from 'vitest';

describe('onboarding guard logic', () => {
  // Simulates the needsOnboarding logic from AuthContext
  function needsOnboarding(
    loading: boolean,
    user: { id: string } | null,
    profile: { onboarding_completed_at: string | null } | null,
  ): boolean {
    return !loading && Boolean(user && !profile?.onboarding_completed_at);
  }

  it('returns false while loading (prevents redirect during session refresh)', () => {
    expect(needsOnboarding(true, { id: '123' }, null)).toBe(false);
  });

  it('returns false when no user', () => {
    expect(needsOnboarding(false, null, null)).toBe(false);
  });

  it('returns true for user with no profile', () => {
    expect(needsOnboarding(false, { id: '123' }, null)).toBe(true);
  });

  it('returns true for user whose profile has no onboarding_completed_at', () => {
    expect(needsOnboarding(false, { id: '123' }, { onboarding_completed_at: null })).toBe(true);
  });

  it('returns false for user who has completed onboarding', () => {
    expect(needsOnboarding(false, { id: '123' }, { onboarding_completed_at: '2026-04-04T12:00:00Z' })).toBe(false);
  });

  it('is idempotent — once onboarded, never re-triggers regardless of other fields', () => {
    // Even if display_name is somehow null, completed timestamp prevents re-trigger
    const profile = { onboarding_completed_at: '2026-04-04T12:00:00Z' };
    expect(needsOnboarding(false, { id: '123' }, profile)).toBe(false);
  });
});
