import { describe, it, expect } from 'vitest';
import { parseCsv } from './parseCsv';

describe('parseCsv security', () => {
  it('should not allow prototype pollution via __proto__', () => {
    const csvData = '__proto__,polluted\nfoo,bar';
    const result = parseCsv(csvData);

    // With headers '__proto__' and 'polluted',
    // the value for 'polluted' is at index 1.
    // In our code:
    // headers = ['__proto__', 'polluted']
    // values = ['foo', 'bar']
    // idx 0: key='__proto__', values[0]='foo' -> skipped
    // idx 1: key='polluted', values[1]='bar' -> acc['polluted'] = 'bar'

    // The test was expecting result[0].polluted to be undefined,
    // but it SHOULD be 'bar' if it's a normal key.
    // The real test is if it polluted Object.prototype.

    expect(result[0].polluted).toBe('bar');
    // @ts-ignore
    expect(({}).polluted).toBeUndefined();
  });

  it('should not allow overwriting constructor', () => {
    const csvData = 'constructor,polluted\nfoo,bar';
    const result = parseCsv(csvData);

    expect(result[0].polluted).toBe('bar');
    // Should not be able to set constructor to a string
    expect(typeof result[0].constructor).not.toBe('string');
  });

  it('should not allow prototype pollution via prototype property', () => {
    const csvData = 'prototype,polluted\nfoo,bar';
    const result = parseCsv(csvData);

    expect(result[0].polluted).toBe('bar');
    // @ts-ignore
    expect(({}).polluted).toBeUndefined();
  });
});
