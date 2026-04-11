import { describe, expect, it } from 'vitest';
import { validateStreamSource } from '@/lib/stream/source-validator';

describe('stream source validator', () => {
  it('rewrites clean facebook slug to /live', () => {
    const result = validateStreamSource('https://facebook.com/SBBLhq?fbclid=abc');
    expect(result.ok).toBe(true);
    expect(result.normalizedUrl).toBe('https://facebook.com/SBBLhq/live');
    expect(result.sourceType).toBe('facebook');
  });

  it('rejects facebook profile.php?id', () => {
    const result = validateStreamSource('https://www.facebook.com/profile.php?id=12345');
    expect(result.ok).toBe(false);
    expect(result.sourceType).toBe('facebook');
    expect(result.blockingReason).toBe('facebook_profile_id_unsupported');
  });

  it('flags public sources as soft-paywall risk', () => {
    const result = validateStreamSource('https://www.youtube.com/watch?v=abc123');
    expect(result.ok).toBe(true);
    expect(result.visibilityClass).toBe('public');
    expect(result.validationMessage).toContain('soft paywall only');
  });
});
