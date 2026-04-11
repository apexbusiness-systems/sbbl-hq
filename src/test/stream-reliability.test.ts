import { describe, expect, it } from 'vitest';
import {
  computeRetryDelayMs,
  DEFAULT_STREAM_RETRY_POLICY,
  detectNetworkTier,
  isRecoverablePlaybackError,
} from '@/lib/stream-reliability';

describe('stream reliability helpers', () => {
  it('classifies constrained connections conservatively', () => {
    expect(detectNetworkTier({ effectiveType: '2g', downlink: 0.3, saveData: false })).toBe('constrained');
    expect(detectNetworkTier({ effectiveType: '4g', downlink: 12, saveData: true })).toBe('constrained');
  });

  it('computes bounded exponential retry delay', () => {
    const delay1 = computeRetryDelayMs(1, DEFAULT_STREAM_RETRY_POLICY, () => 0.5);
    const delay4 = computeRetryDelayMs(4, DEFAULT_STREAM_RETRY_POLICY, () => 0.5);

    expect(delay1).toBeGreaterThanOrEqual(250);
    expect(delay4).toBeGreaterThan(delay1);
    expect(delay4).toBeLessThanOrEqual(DEFAULT_STREAM_RETRY_POLICY.maxDelayMs);
  });

  it('marks transient transport errors as recoverable', () => {
    expect(isRecoverablePlaybackError('Network timeout while fetching stream')).toBe(true);
    expect(isRecoverablePlaybackError('source is not available')).toBe(true);
    expect(isRecoverablePlaybackError('permission denied')).toBe(false);
    expect(isRecoverablePlaybackError('forbidden')).toBe(false);
  });
});
