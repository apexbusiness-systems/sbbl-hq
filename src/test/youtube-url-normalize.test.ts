import { canonicalizeStreamSourceUrl, detectStreamUrlType } from '@/lib/stream/url-detector';
import { describe, expect, it } from 'vitest';
import { normalizeYoutubeUrl } from '@/lib/stream/youtube-url';

describe('normalizeYoutubeUrl', () => {
  it('normalizes shared YouTube live URLs to canonical watch URL', () => {
    const result = normalizeYoutubeUrl('https://youtube.com/live/BjcQrDA9koY?feature=share');
    expect(result).toEqual({ ok: true, url: 'https://www.youtube.com/watch?v=BjcQrDA9koY' });
  });

  it('accepts non-YouTube http(s) stream URLs without provider lock-in', () => {
    const result = normalizeYoutubeUrl('https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu');
    expect(result).toEqual({ ok: true, url: 'https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu' });
  });

  it('rejects non-http(s) protocols', () => {
    const result = normalizeYoutubeUrl('rtmp://ingest.example/live/key');
    expect(result).toEqual({ ok: false, error: 'Only http(s) stream URLs are supported.' });
  });
});



describe('canonicalizeStreamSourceUrl', () => {
  it('detects Twitch URLs correctly', () => {
    expect(detectStreamUrlType('https://www.twitch.tv/sbblhq')).toBe('twitch');
  });

  it('canonicalizes raw Twitch URL to same raw URL unchanged', () => {
    const result = canonicalizeStreamSourceUrl('https://www.twitch.tv/sbblhq');
    expect(result.url).toBe('https://www.twitch.tv/sbblhq');
    expect(result.canonical).toBe(true);
  });

  it('canonicalizes player.twitch.tv URL to raw URL', () => {
    const result = canonicalizeStreamSourceUrl('https://player.twitch.tv/?channel=sbblhq&parent=localhost');
    expect(result.url).toBe('https://www.twitch.tv/sbblhq');
    expect(result.canonical).toBe(true);
  });
});
