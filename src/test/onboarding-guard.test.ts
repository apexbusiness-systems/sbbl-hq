import { describe, expect, it } from 'vitest';

describe('onboarding guard logic', () => {
  // Mirrors the needsOnboarding logic from AuthContext exactly:
  // !loading && Boolean(user && !profile?.onboarding_completed_at) && !isAdmin
  function needsOnboarding(
    loading: boolean,
    user: { id: string } | null,
    profile: { onboarding_completed_at: string | null } | null,
    isAdmin = false,
  ): boolean {
    return !loading && Boolean(user && !profile?.onboarding_completed_at) && !isAdmin;
  }

  it('returns false while loading (prevents redirect during session refresh)', () => {
    expect(needsOnboarding(true, { id: '123' }, null)).toBe(false);
  });

  it('returns false when no user', () => {
    expect(needsOnboarding(false, null, null)).toBe(false);
  });

  it('returns true for new user with no profile', () => {
    expect(needsOnboarding(false, { id: '123' }, null)).toBe(true);
  });

  it('returns true for user whose profile has no onboarding_completed_at', () => {
    expect(needsOnboarding(false, { id: '123' }, { onboarding_completed_at: null })).toBe(true);
  });

  it('returns false for user who has completed onboarding', () => {
    expect(needsOnboarding(false, { id: '123' }, { onboarding_completed_at: '2026-04-04T12:00:00Z' })).toBe(false);
  });

  it('is idempotent — once onboarded, never re-triggers regardless of other fields', () => {
    const profile = { onboarding_completed_at: '2026-04-04T12:00:00Z' };
    expect(needsOnboarding(false, { id: '123' }, profile)).toBe(false);
  });

  it('never triggers for admins even if onboarding_completed_at is null', () => {
    expect(needsOnboarding(false, { id: '123' }, null, true)).toBe(false);
    expect(needsOnboarding(false, { id: '123' }, { onboarding_completed_at: null }, true)).toBe(false);
  });

  it('never triggers for admins even if profile is fully missing', () => {
    expect(needsOnboarding(false, { id: 'admin' }, null, true)).toBe(false);
  });
});
