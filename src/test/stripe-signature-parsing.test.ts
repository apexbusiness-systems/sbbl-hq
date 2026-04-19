import { describe, expect, it } from 'vitest';
import { parseStripeSignature } from '@/worker/stripe-utils';

describe('parseStripeSignature', () => {
  it('parses a valid header with timestamp and one signature', () => {
    const header = 't=123,v1=sig1';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: ['sig1'],
    });
  });

  it('parses a valid header with multiple signatures', () => {
    const header = 't=123,v1=sig1,v1=sig2';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: ['sig1', 'sig2'],
    });
  });

  it('handles extra spaces and mixed fields', () => {
    const header = ' t=123 , v1=sig1 , other=value ';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: ['sig1'],
    });
  });

  it('handles missing timestamp', () => {
    const header = 'v1=sig1';
    const result = parseStripeSignature(header);
    expect(result.timestamp).toBeNaN();
    expect(result.signatures).toEqual(['sig1']);
  });

  it('handles missing signatures', () => {
    const header = 't=123';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: [],
    });
  });

  it('handles malformed timestamp', () => {
    const header = 't=abc,v1=sig1';
    const result = parseStripeSignature(header);
    expect(result.timestamp).toBeNaN();
    expect(result.signatures).toEqual(['sig1']);
  });

  it('handles an empty header', () => {
    const header = '';
    const result = parseStripeSignature(header);
    expect(result.timestamp).toBeNaN();
    expect(result.signatures).toEqual([]);
  });

  it('filters out empty v1 tags', () => {
    const header = 't=123,v1=,v1=sig2';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: ['sig2'],
    });
  });

  it('should handle invalid parts in the header', () => {
    const header = 'foo=bar,t=123,v1=sig1,baz';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: ['sig1'],
    });
  });

  it('should handle empty signature values', () => {
    const header = 't=123,v1=';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 123,
      signatures: [],
    });
  });
});
