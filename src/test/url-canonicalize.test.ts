/**
 * url-canonicalize.test.ts
 *
 * Regression suite for canonicalizeStreamSourceUrl.
 * Ensures embed URLs are collapsed to canonical forms and that
 * canonical URLs pass through unchanged so toPlayableUrl() never double-embeds.
 */
import { describe, it, expect } from 'vitest';
import { canonicalizeStreamSourceUrl } from '@/lib/stream/url-detector';

describe('canonicalizeStreamSourceUrl — YouTube', () => {
  it('converts /embed/ to watch URL', () => {
    expect(canonicalizeStreamSourceUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      wasNormalized: true,
    });
  });

  it('converts youtube-nocookie.com embed to canonical', () => {
    expect(canonicalizeStreamSourceUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      wasNormalized: true,
    });
  });

  it('rejects embed with invalid video ID (too short)', () => {
    const r = canonicalizeStreamSourceUrl('https://www.youtube.com/embed/bad');
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toMatch(/video ID/i);
  });

  it('passes through canonical watch URL unchanged', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(canonicalizeStreamSourceUrl(url)).toEqual({ ok: true, url, wasNormalized: false });
  });

  it('passes through youtu.be share URL unchanged', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    expect(canonicalizeStreamSourceUrl(url)).toEqual({ ok: true, url, wasNormalized: false });
  });
});

describe('canonicalizeStreamSourceUrl — Twitch', () => {
  it('converts player.twitch.tv to channel URL', () => {
    expect(
      canonicalizeStreamSourceUrl('https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu'),
    ).toEqual({ ok: true, url: 'https://www.twitch.tv/sbblhq', wasNormalized: true });
  });

  it('rejects player URL with no channel param', () => {
    const r = canonicalizeStreamSourceUrl('https://player.twitch.tv/?parent=sbbl-hq.icu');
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toMatch(/channel/i);
  });

  it('passes through canonical twitch.tv channel URL unchanged', () => {
    const url = 'https://www.twitch.tv/sbblhq';
    expect(canonicalizeStreamSourceUrl(url)).toEqual({ ok: true, url, wasNormalized: false });
  });
});

describe('canonicalizeStreamSourceUrl — Vimeo', () => {
  it('converts player.vimeo.com to canonical URL', () => {
    expect(canonicalizeStreamSourceUrl('https://player.vimeo.com/video/123456789')).toEqual({
      ok: true,
      url: 'https://vimeo.com/123456789',
      wasNormalized: true,
    });
  });

  it('rejects player URL with non-numeric or too-short ID', () => {
    expect(canonicalizeStreamSourceUrl('https://player.vimeo.com/video/abc').ok).toBe(false);
    expect(canonicalizeStreamSourceUrl('https://player.vimeo.com/video/123').ok).toBe(false);
  });

  it('passes through canonical vimeo.com URL unchanged', () => {
    const url = 'https://vimeo.com/123456789';
    expect(canonicalizeStreamSourceUrl(url)).toEqual({ ok: true, url, wasNormalized: false });
  });
});

describe('canonicalizeStreamSourceUrl — Facebook', () => {
  it('rejects facebook plugin embed URLs', () => {
    const r = canonicalizeStreamSourceUrl('https://www.facebook.com/plugins/video.php?href=foo');
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toMatch(/plugin/i);
  });

  it('passes through a regular facebook video URL unchanged', () => {
    const url = 'https://www.facebook.com/video/123456';
    expect(canonicalizeStreamSourceUrl(url)).toEqual({ ok: true, url, wasNormalized: false });
  });
});

describe('canonicalizeStreamSourceUrl — passthrough for other types', () => {
  it.each([
    'https://stream.sbbl-hq.icu/whep/live',
    'https://cdn.example.com/stream.m3u8',
    'https://cdn.example.com/stream.mpd',
    'https://cdn.example.com/clip.mp4',
    'rtmp://ingest.example.com/live/key',
  ])('passes %s through unchanged', (url) => {
    const r = canonicalizeStreamSourceUrl(url);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toBe(url);
      expect(r.wasNormalized).toBe(false);
    }
  });
});

describe('canonicalizeStreamSourceUrl — edge cases', () => {
  it('rejects empty string', () => {
    expect(canonicalizeStreamSourceUrl('').ok).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(canonicalizeStreamSourceUrl('   ').ok).toBe(false);
  });

  it('rejects an invalid URL', () => {
    expect(canonicalizeStreamSourceUrl('not-a-url').ok).toBe(false);
  });

  it('trims leading/trailing whitespace before processing', () => {
    const r = canonicalizeStreamSourceUrl('  https://stream.sbbl-hq.icu/whep/live  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe('https://stream.sbbl-hq.icu/whep/live');
  });
});
