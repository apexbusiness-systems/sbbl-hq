/**
 * Feature-flag regression guard — WS3 preflight must stay invisible
 * when VITE_FEATURE_SHOW_VIEWER_PREFLIGHT is not 'true'.
 *
 * This is the "dead-code vs. disabled-feature" guard: it asserts that
 * the flag getter returns false for every non-'true' value AND that
 * the component module can be imported without throwing (no top-level
 * side effects that would run regardless of flag state).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isBiometricOverlayEnabled,
  isFanTokenSystemEnabled,
  isMicUpSeriesEnabled,
  isViewerPreflightEnabled,
  __resetFeatureFlagCacheForTests,
} from '@/lib/feature-flags';

afterEach(() => {
  __resetFeatureFlagCacheForTests();
  vi.unstubAllEnvs();
});

describe('feature flags — default-off invariants', () => {
  it('all WS3-6 flags default to false when env is unset', () => {
    __resetFeatureFlagCacheForTests();
    expect(isViewerPreflightEnabled()).toBe(false);
    expect(isFanTokenSystemEnabled()).toBe(false);
    expect(isBiometricOverlayEnabled()).toBe(false);
    expect(isMicUpSeriesEnabled()).toBe(false);
  });

  it('preflight flag returns true when set to "true" or "1"', () => {
    for (const value of ['true', '1']) {
      vi.stubEnv('VITE_FEATURE_SHOW_VIEWER_PREFLIGHT', value);
      __resetFeatureFlagCacheForTests();
      expect(isViewerPreflightEnabled()).toBe(true);
    }
  });

  it('preflight flag stays false for any non-canonical string (robustness)', () => {
    for (const value of ['yes', 'on', 'TRUE', ' true ', 'false', '']) {
      vi.stubEnv('VITE_FEATURE_SHOW_VIEWER_PREFLIGHT', value);
      __resetFeatureFlagCacheForTests();
      // parseFlag is strict: only 'true' | true | '1' | 1 → true.
      // Anything else resolves to false with no exception.
      expect(isViewerPreflightEnabled()).toBe(false);
    }
  });

  it('ViewerPreflight module can be imported without side effects', async () => {
    const mod = await import('@/components/preflight/ViewerPreflight');
    expect(typeof mod.ViewerPreflight).toBe('function');
  });
});
