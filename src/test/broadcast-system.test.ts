import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  canonicalizeStreamSourceUrl,
  detectStreamUrlType,
  toPlayableUrl,
  getStreamDeliveryClass,
  getStreamTypeAdvisory,
} from '@/lib/stream/url-detector';
import { probeWhepCors } from '@/components/WhepPlayer';

// ── canonicalizeStreamSourceUrl ─────────────────────────────────────────────

describe('canonicalizeStreamSourceUrl', () => {
  describe('YouTube embed → canonical', () => {
    it('converts /embed/ to watch URL', () => {
      const result = canonicalizeStreamSourceUrl('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(result).toEqual({ ok: true, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', wasNormalized: true });
    });

    it('converts youtube-nocookie.com embed to canonical', () => {
      const result = canonicalizeStreamSourceUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(result).toEqual({ ok: true, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', wasNormalized: true });
    });

    it('rejects embed with invalid video ID', () => {
      const result = canonicalizeStreamSourceUrl('https://www.youtube.com/embed/bad');
      expect(result.ok).toBe(false);
    });
  });

  describe('Twitch player embed → canonical', () => {
    it('converts player.twitch.tv to channel URL', () => {
      const result = canonicalizeStreamSourceUrl('https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu');
      expect(result).toEqual({ ok: true, url: 'https://www.twitch.tv/sbblhq', wasNormalized: true });
    });

    it('rejects player URL without channel param', () => {
      const result = canonicalizeStreamSourceUrl('https://player.twitch.tv/?parent=sbbl-hq.icu');
      expect(result.ok).toBe(false);
    });
  });

  describe('Vimeo player embed → canonical', () => {
    it('converts player.vimeo.com to canonical URL', () => {
      const result = canonicalizeStreamSourceUrl('https://player.vimeo.com/video/123456789');
      expect(result).toEqual({ ok: true, url: 'https://vimeo.com/123456789', wasNormalized: true });
    });

    it('rejects player URL with invalid ID', () => {
      const result = canonicalizeStreamSourceUrl('https://player.vimeo.com/video/abc');
      expect(result.ok).toBe(false);
    });
  });

  describe('Facebook plugin block', () => {
    it('rejects facebook plugin embed URLs', () => {
      const result = canonicalizeStreamSourceUrl('https://www.facebook.com/plugins/video.php?href=foo');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('plugin');
    });
  });

  describe('passthrough for canonical URLs', () => {
    it('passes through canonical YouTube watch URL unchanged', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = canonicalizeStreamSourceUrl(url);
      expect(result).toEqual({ ok: true, url, wasNormalized: false });
    });

    it('passes through HLS URL unchanged', () => {
      const url = 'https://stream.sbbl-hq.icu/live/main.m3u8';
      const result = canonicalizeStreamSourceUrl(url);
      expect(result).toEqual({ ok: true, url, wasNormalized: false });
    });

    it('passes through WHEP URL unchanged', () => {
      const url = 'https://stream.sbbl-hq.icu/whep/live';
      const result = canonicalizeStreamSourceUrl(url);
      expect(result).toEqual({ ok: true, url, wasNormalized: false });
    });

    it('passes through canonical Twitch channel URL unchanged', () => {
      const url = 'https://www.twitch.tv/sbblhq';
      const result = canonicalizeStreamSourceUrl(url);
      expect(result).toEqual({ ok: true, url, wasNormalized: false });
    });
  });

  describe('edge cases', () => {
    it('rejects empty string', () => {
      expect(canonicalizeStreamSourceUrl('').ok).toBe(false);
    });

    it('rejects invalid URL', () => {
      expect(canonicalizeStreamSourceUrl('not-a-url').ok).toBe(false);
    });

    it('trims whitespace', () => {
      const result = canonicalizeStreamSourceUrl('  https://stream.sbbl-hq.icu/live/main.m3u8  ');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.url).not.toMatch(/^\s|\s$/);
    });
  });
});

// ── detectStreamUrlType ─────────────────────────────────────────────────────

describe('detectStreamUrlType', () => {
  it('detects WHEP URL with /whep/ path segment', () => {
    expect(detectStreamUrlType('https://stream.sbbl-hq.icu/whep/live')).toBe('whep');
  });

  it('detects WHEP URL with /whep at end', () => {
    expect(detectStreamUrlType('https://example.com/api/whep')).toBe('whep');
  });

  it('does not false-positive on /badwhep/ substring', () => {
    expect(detectStreamUrlType('https://example.com/badwhep/stream')).not.toBe('whep');
  });

  it('detects HLS', () => {
    expect(detectStreamUrlType('https://cdn.example.com/stream.m3u8')).toBe('hls');
  });

  it('detects DASH', () => {
    expect(detectStreamUrlType('https://cdn.example.com/stream.mpd')).toBe('dash');
  });

  it('detects RTMP', () => {
    expect(detectStreamUrlType('rtmp://live.example.com/app/stream')).toBe('rtmp');
  });

  it('detects YouTube', () => {
    expect(detectStreamUrlType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
  });

  it('detects Twitch', () => {
    expect(detectStreamUrlType('https://www.twitch.tv/sbblhq')).toBe('twitch');
  });

  it('detects Vimeo', () => {
    expect(detectStreamUrlType('https://vimeo.com/123456789')).toBe('vimeo');
  });

  it('detects Facebook', () => {
    expect(detectStreamUrlType('https://www.facebook.com/video/123')).toBe('facebook');
  });

  it('returns unknown for empty', () => {
    expect(detectStreamUrlType('')).toBe('unknown');
  });
});

// ── toPlayableUrl ───────────────────────────────────────────────────────────

describe('toPlayableUrl', () => {
  it('normalizes YouTube to watch URL', () => {
    const result = toPlayableUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.type).toBe('youtube');
  });

  it('adds advisory warning for RTMP', () => {
    const result = toPlayableUrl('rtmp://live.example.com/app/stream');
    expect(result.type).toBe('rtmp');
    expect(result.warning).toBeDefined();
  });

  it('converts Twitch URL to player embed with parent', () => {
    const result = toPlayableUrl('https://www.twitch.tv/sbblhq');
    expect(result.url).toContain('player.twitch.tv');
    expect(result.url).toContain('channel=sbblhq');
    expect(result.type).toBe('twitch');
  });

  it('converts Vimeo URL to player embed', () => {
    const result = toPlayableUrl('https://vimeo.com/123456789');
    expect(result.url).toBe('https://player.vimeo.com/video/123456789');
    expect(result.type).toBe('vimeo');
  });

  it('passes through HLS as-is', () => {
    const url = 'https://stream.sbbl-hq.icu/live/main.m3u8';
    expect(toPlayableUrl(url).url).toBe(url);
  });
});

// ── getStreamDeliveryClass ──────────────────────────────────────────────────

describe('getStreamDeliveryClass', () => {
  it('classifies YouTube as embed', () => {
    expect(getStreamDeliveryClass('https://www.youtube.com/watch?v=abc')).toBe('embed');
  });

  it('classifies HLS as proxy', () => {
    expect(getStreamDeliveryClass('https://cdn.example.com/stream.m3u8')).toBe('proxy');
  });

  it('classifies SBBL stream domain as proxy', () => {
    expect(getStreamDeliveryClass('https://stream.sbbl-hq.icu/whep/live')).toBe('proxy');
  });

  it('classifies unknown URL as unsupported', () => {
    expect(getStreamDeliveryClass('https://random.example.com/something')).toBe('unsupported');
  });

  it('handles empty string', () => {
    expect(getStreamDeliveryClass('')).toBe('unsupported');
  });
});

// ── getStreamTypeAdvisory ───────────────────────────────────────────────────

describe('getStreamTypeAdvisory', () => {
  it('returns ok for YouTube', () => {
    expect(getStreamTypeAdvisory('youtube').level).toBe('ok');
  });

  it('returns warn for RTMP', () => {
    expect(getStreamTypeAdvisory('rtmp').level).toBe('warn');
  });

  it('returns info for WHEP', () => {
    expect(getStreamTypeAdvisory('whep').level).toBe('info');
  });

  it('returns warn for unsupported embed platforms', () => {
    expect(getStreamTypeAdvisory('instagram').level).toBe('warn');
    expect(getStreamTypeAdvisory('kick').level).toBe('warn');
    expect(getStreamTypeAdvisory('x-spaces').level).toBe('warn');
  });
});

// ── probeWhepCors ───────────────────────────────────────────────────────────

describe('probeWhepCors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok when endpoint responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await probeWhepCors('https://stream.sbbl-hq.icu/whep/live');
    expect(result.ok).toBe(true);
  });

  it('returns ok on 405 (CORS works, method not supported)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 405 }));
    const result = await probeWhepCors('https://stream.sbbl-hq.icu/whep/live');
    expect(result.ok).toBe(true);
  });

  it('returns ok on 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 204 }));
    const result = await probeWhepCors('https://stream.sbbl-hq.icu/whep/live');
    expect(result.ok).toBe(true);
  });

  it('fails on network/CORS error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const result = await probeWhepCors('https://stream.sbbl-hq.icu/whep/live');
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('unreachable');
  });

  it('fails on timeout', async () => {
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    const result = await probeWhepCors('https://stream.sbbl-hq.icu/whep/live');
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('timed out');
  });

  it('sends OPTIONS method for CORS preflight', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    await probeWhepCors('https://stream.sbbl-hq.icu/whep/live');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://stream.sbbl-hq.icu/whep/live',
      expect.objectContaining({ method: 'OPTIONS', mode: 'cors' }),
    );
  });
});
