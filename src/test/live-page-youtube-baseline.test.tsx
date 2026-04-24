import { describe, expect, it } from 'vitest';
import { toPlayableUrl } from '@/lib/stream/url-detector';

// This suite intentionally avoids mounting LivePage because the page includes
// long-lived polling/query effects that are already covered elsewhere.
// Here we lock down the stream URL normalization contract used by Go Live.
describe('Live URL normalization baseline', () => {
  it('passes through unrecognized stream URLs (e.g. Facebook) without blocking', () => {
    const raw = 'https://www.facebook.com/live/12345';
    const normalized = toPlayableUrl(raw).url || raw;
    expect(normalized).toBe(raw);
  });

  it('normalizes short YouTube URLs into canonical watch URLs', () => {
    const raw = 'https://youtu.be/abc123def45?t=5';
    const normalized = toPlayableUrl(raw).url || raw;
    expect(normalized).toBe('https://www.youtube.com/watch?v=abc123def45');
  });
});
