/**
 * url-detector.test.ts
 *
 * Regression shield for src/lib/stream/url-detector.ts.
 *
 * Covers Fix #2 (WHEP misrouting): all *.sbbl-hq.icu subdomains and /whep/
 * path segments classified correctly, and detectStreamUrlType recognises WHEP
 * only as a standalone path segment (not a substring like /badwhep/).
 */
import { describe, it, expect } from 'vitest';
import {
  detectStreamUrlType,
  getStreamDeliveryClass,
  toPlayableUrl,
  STREAM_TYPE_LABELS,
  getStreamTypeAdvisory,
} from '@/lib/stream/url-detector';

describe('detectStreamUrlType — WHEP standalone path segment', () => {
  it.each([
    'https://stream.sbbl-hq.icu/whep/live',
    'https://live.sbbl-hq.icu/whep/game-1',
    'https://broadcast.sbbl-hq.icu/api/whep',
    'https://mediamtx.example.com/live/whep',
    'https://origin.example.com/whep',
  ])('classifies %s as whep', (url) => {
    expect(detectStreamUrlType(url)).toBe('whep');
  });

  it.each([
    'https://stream.sbbl-hq.icu/badwhep/live',
    'https://stream.sbbl-hq.icu/whepfoo/bar',
    'https://stream.sbbl-hq.icu/prewhep/stream',
  ])('does NOT classify %s as whep (substring false-positive guard)', (url) => {
    expect(detectStreamUrlType(url)).not.toBe('whep');
  });

  it.each([
    'https://stream.sbbl-hq.icu/live?whep=1',
    'https://stream.sbbl-hq.icu/live?other=x&whep=1',
    'https://stream.sbbl-hq.icu/live?whep',
  ])('classifies %s as whep via query param', (url) => {
    expect(detectStreamUrlType(url)).toBe('whep');
  });
});

describe('detectStreamUrlType — platform detection', () => {
  it('detects YouTube watch URLs', () => {
    expect(detectStreamUrlType('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
    expect(detectStreamUrlType('https://youtu.be/abc123')).toBe('youtube');
  });

  it('detects Twitch channel URLs', () => {
    expect(detectStreamUrlType('https://www.twitch.tv/channelname')).toBe('twitch');
  });

  it('detects HLS m3u8 files with query strings and fragments', () => {
    expect(detectStreamUrlType('https://cdn.example.com/live/stream.m3u8')).toBe('hls');
    expect(detectStreamUrlType('https://cdn.example.com/stream.m3u8?token=abc')).toBe('hls');
    expect(detectStreamUrlType('https://cdn.example.com/stream.m3u8#frag')).toBe('hls');
  });

  it('detects DASH mpd files', () => {
    expect(detectStreamUrlType('https://cdn.example.com/stream.mpd')).toBe('dash');
  });

  it('detects direct video files', () => {
    expect(detectStreamUrlType('https://cdn.example.com/clip.mp4')).toBe('mp4');
    expect(detectStreamUrlType('https://cdn.example.com/clip.webm')).toBe('mp4');
    expect(detectStreamUrlType('https://cdn.example.com/clip.ogg')).toBe('mp4');
  });

  it('detects RTMP/RTMPS URLs', () => {
    expect(detectStreamUrlType('rtmp://ingest.example.com/live/streamkey')).toBe('rtmp');
    expect(detectStreamUrlType('rtmps://ingest.example.com/live/streamkey')).toBe('rtmp');
  });

  it('returns "unknown" for empty or unrecognised URLs', () => {
    expect(detectStreamUrlType('')).toBe('unknown');
    expect(detectStreamUrlType('https://example.com/some/page')).toBe('unknown');
  });
});

describe('getStreamDeliveryClass — Fix #2 coverage', () => {
  it.each([
    'https://stream.sbbl-hq.icu/whep/live',
    'https://live.sbbl-hq.icu/whep/game-1',
    'https://cdn.sbbl-hq.icu/hls/playlist.m3u8',
    'https://broadcast.sbbl-hq.icu/api/whep',
  ])('classifies %s as proxy', (url) => {
    expect(getStreamDeliveryClass(url)).toBe('proxy');
  });

  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://twitch.tv/channel',
    'https://vimeo.com/123',
    'https://facebook.com/live/123',
  ])('classifies %s as embed', (url) => {
    expect(getStreamDeliveryClass(url)).toBe('embed');
  });

  it.each([
    'https://cdn.example.com/stream.m3u8',
    'https://cdn.example.com/clip.mp4',
    'https://cdn.example.com/stream.mpd',
  ])('classifies direct file %s as proxy', (url) => {
    expect(getStreamDeliveryClass(url)).toBe('proxy');
  });

  it('classifies any /whep/ path as proxy regardless of host', () => {
    expect(getStreamDeliveryClass('https://origin.example.com/whep/live')).toBe('proxy');
    expect(getStreamDeliveryClass('https://mediamtx.example.com/live/whep')).toBe('proxy');
  });

  it('returns unsupported for unknown hosts without recognised formats', () => {
    expect(getStreamDeliveryClass('https://example.com/random/page')).toBe('unsupported');
  });

  it('treats empty input as unsupported', () => {
    expect(getStreamDeliveryClass('')).toBe('unsupported');
    expect(getStreamDeliveryClass('   ')).toBe('unsupported');
  });
});

describe('toPlayableUrl', () => {
  it('carries an RTMP advisory warning', () => {
    const r = toPlayableUrl('rtmp://ingest.example.com/live/key');
    expect(r.type).toBe('rtmp');
    expect(r.warning).toMatch(/RTMP cannot play/i);
  });

  it('normalises YouTube URLs to canonical watch form preserving video id', () => {
    // 11-char id required by youtube-url canonicalizer.
    const r = toPlayableUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(r.type).toBe('youtube');
    expect(r.url).toMatch(/watch\?v=dQw4w9WgXcQ/);
  });

  it('normalises Twitch URLs to player embed', () => {
    const r = toPlayableUrl('https://www.twitch.tv/channelname');
    expect(r.type).toBe('twitch');
    expect(r.url).toMatch(/player\.twitch\.tv\/\?channel=channelname/);
  });

  it('passes HLS URLs through unchanged', () => {
    const r = toPlayableUrl('https://cdn.example.com/stream.m3u8');
    expect(r.type).toBe('hls');
    expect(r.url).toBe('https://cdn.example.com/stream.m3u8');
  });

  it('returns empty for empty input without throwing', () => {
    const r = toPlayableUrl('');
    expect(r.type).toBe('unknown');
    expect(r.url).toBe('');
  });
});

describe('advisory + labels', () => {
  it('provides a non-empty label for every known type', () => {
    const types = Object.keys(STREAM_TYPE_LABELS) as Array<keyof typeof STREAM_TYPE_LABELS>;
    for (const t of types) expect(STREAM_TYPE_LABELS[t]).toBeTruthy();
  });

  it('flags WHEP as info-level (low-latency)', () => {
    const adv = getStreamTypeAdvisory('whep');
    expect(adv.level).toBe('info');
    expect(adv.message).toMatch(/WHEP|low.?latency/i);
  });

  it('warns on RTMP since it cannot play in browser', () => {
    const adv = getStreamTypeAdvisory('rtmp');
    expect(adv.level).toBe('warn');
  });
});
