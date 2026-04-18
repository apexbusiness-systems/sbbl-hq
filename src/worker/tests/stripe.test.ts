import { describe, it, expect } from 'vitest';
import { parseStripeSignature } from '../stripe-utils';

describe('parseStripeSignature', () => {
  it('should parse a valid Stripe signature header', () => {
    const header = 't=1612345678,v1=signature_string_here';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 1612345678,
      signatures: ['signature_string_here'],
    });
  });

  it('should parse a header with multiple signatures', () => {
    const header = 't=1612345678,v1=sig1,v1=sig2';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 1612345678,
      signatures: ['sig1', 'sig2'],
    });
  });

  it('should handle spaces in the header', () => {
    const header = ' t=1612345678 , v1=sig1 , v1=sig2 ';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 1612345678,
      signatures: ['sig1', 'sig2'],
    });
  });

  it('should handle missing timestamp', () => {
    const header = 'v1=sig1';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: NaN,
      signatures: ['sig1'],
    });
  });

  it('should handle missing signatures', () => {
    const header = 't=1612345678';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: 1612345678,
      signatures: [],
    });
  });

  it('should handle empty header', () => {
    const header = '';
    const result = parseStripeSignature(header);
    expect(result).toEqual({
      timestamp: NaN,
      signatures: [],
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
