import { describe, expect, it } from 'vitest';
import { constantTimeEqualHex } from '@/worker/index';

describe('constantTimeEqualHex', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeEqualHex('abc123', 'abc123')).toBe(true);
  });

  it('returns false for unequal strings', () => {
    expect(constantTimeEqualHex('abc123', 'abc124')).toBe(false);
  });

  it('returns false safely for different lengths', () => {
    expect(constantTimeEqualHex('abc123', 'abc12300')).toBe(false);
  });
});
