import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as RateLimiter from '../validation-contract-wrapper';

describe('enforceInMemoryRateLimit', () => {
  const originalMax = RateLimiter.RUNTIME_RATE_LIMIT_MAX;

  beforeEach(() => {
    RateLimiter.runtimeRateLimit.clear();
    // @ts-ignore - modifying exported let
    RateLimiter.RUNTIME_RATE_LIMIT_MAX = originalMax;
  });

  afterAll(() => {
    // @ts-ignore
    RateLimiter.RUNTIME_RATE_LIMIT_MAX = originalMax;
  });

  it('allows requests within the limit', () => {
    const key = 'user1';
    const limit = 5;
    const windowMs = 1000;

    for (let i = 0; i < limit; i++) {
      expect(RateLimiter.enforceInMemoryRateLimit(key, limit, windowMs)).toBe(true);
    }
  });

  it('blocks requests exceeding the limit', () => {
    const key = 'user1';
    const limit = 5;
    const windowMs = 1000;

    for (let i = 0; i < limit; i++) {
      RateLimiter.enforceInMemoryRateLimit(key, limit, windowMs);
    }
    expect(RateLimiter.enforceInMemoryRateLimit(key, limit, windowMs)).toBe(false);
  });

  it('evicts entries when reaching the max size', () => {
    // Set a small max for testing
    // @ts-ignore
    RateLimiter.RUNTIME_RATE_LIMIT_MAX = 3;

    RateLimiter.enforceInMemoryRateLimit('key1', 5, 1000); // size 1
    RateLimiter.enforceInMemoryRateLimit('key2', 5, 1000); // size 2
    RateLimiter.enforceInMemoryRateLimit('key3', 5, 1000); // size 3

    expect(RateLimiter.runtimeRateLimit.size).toBe(3);
    expect(RateLimiter.runtimeRateLimit.has('key1')).toBe(true);

    // This should trigger batch eviction (500 in prod, but here it will evict all up to 500)
    RateLimiter.enforceInMemoryRateLimit('key4', 5, 1000);

    // It should have evicted all 3 existing keys and added key4
    expect(RateLimiter.runtimeRateLimit.size).toBe(1);
    expect(RateLimiter.runtimeRateLimit.has('key1')).toBe(false);
    expect(RateLimiter.runtimeRateLimit.has('key2')).toBe(false);
    expect(RateLimiter.runtimeRateLimit.has('key3')).toBe(false);
    expect(RateLimiter.runtimeRateLimit.has('key4')).toBe(true);
  });
});
