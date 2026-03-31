import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/parseCsv';

describe('parseCsv', () => {
  it('returns empty for header-only CSV', () => { expect(parseCsv('name,id')).toHaveLength(0); });
  it('parses basic CSV correctly', () => {
    const result = parseCsv('name,score\nAlice,10\nBob,20');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', score: '10' });
    expect(result[1]).toEqual({ name: 'Bob', score: '20' });
  });
  it('handles Windows line endings', () => {
    const result = parseCsv('name,val\r\nFoo,1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Foo', val: '1' });
  });
});
