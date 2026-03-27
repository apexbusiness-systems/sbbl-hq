import { describe, expect, it } from 'vitest';
import { readIdempotencyKey } from '@/lib/api/idempotency';

describe('idempotency header parsing', () => {
  it('returns valid key', () => {
    const headers = new Headers({ 'x-idempotency-key': 'abc123456789z' });
    expect(readIdempotencyKey(headers)).toBe('abc123456789z');
  });

  it('throws on missing key', () => {
    expect(() => readIdempotencyKey(new Headers())).toThrow(/idempotency/i);
  });
});
