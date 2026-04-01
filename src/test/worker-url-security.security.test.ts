import { describe, expect, it } from 'vitest';

// Extracting the pure function manually for testing since it's an internal function in index.ts
function getSafeRedirectUrl(url: string | undefined | null, fallback: string, reqUrl: string): string {
  if (!url) return fallback;
  try {
    const baseOrigin = new URL(reqUrl).origin;
    const resolvedUrl = new URL(url, baseOrigin);
    if (resolvedUrl.origin === baseOrigin) {
      return resolvedUrl.toString();
    }
  } catch (err) {
    // Ignore invalid URLs
  }
  return fallback;
}

describe('getSafeRedirectUrl security', () => {
  const reqUrl = 'https://sbbl-hq.icu/api/test';
  const fallback = 'https://sbbl-hq.icu/fallback';

  it('allows same-origin absolute URLs', () => {
    expect(getSafeRedirectUrl('https://sbbl-hq.icu/success', fallback, reqUrl))
      .toBe('https://sbbl-hq.icu/success');
  });

  it('allows relative URLs and resolves them to the same origin', () => {
    expect(getSafeRedirectUrl('/relative/path', fallback, reqUrl))
      .toBe('https://sbbl-hq.icu/relative/path');
  });

  it('rejects cross-origin absolute URLs', () => {
    expect(getSafeRedirectUrl('https://evil.com/phishing', fallback, reqUrl))
      .toBe(fallback);
  });

  it('rejects javascript: URIs', () => {
    expect(getSafeRedirectUrl('javascript:alert(1)', fallback, reqUrl))
      .toBe(fallback);
  });

  it('returns fallback for undefined or null url', () => {
    expect(getSafeRedirectUrl(undefined, fallback, reqUrl)).toBe(fallback);
    expect(getSafeRedirectUrl(null, fallback, reqUrl)).toBe(fallback);
  });

  it('rejects data: URIs', () => {
    expect(getSafeRedirectUrl('data:text/html,<script>alert(1)</script>', fallback, reqUrl))
      .toBe(fallback);
  });
});
