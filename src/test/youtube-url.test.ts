import { describe, expect, it } from 'vitest';
import { normalizeYoutubeUrl, toPlayableYoutubeEmbedUrl } from '@/lib/stream/youtube-url';

describe('normalizeYoutubeUrl', () => {
  it('normalizes watch/live/embed/youtu.be URLs to canonical watch URL', () => {
    expect(normalizeYoutubeUrl('https://www.youtube.com/watch?v=abc123def45', { youtubeOnly: true })).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
    expect(normalizeYoutubeUrl('https://youtube.com/live/abc123def45?feature=share', { youtubeOnly: true })).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
    expect(normalizeYoutubeUrl('https://www.youtube.com/embed/abc123def45', { youtubeOnly: true })).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
    expect(normalizeYoutubeUrl('https://youtu.be/abc123def45?t=2', { youtubeOnly: true })).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
  });

  it('rejects malformed/empty/non-youtube URLs in youtube-only mode', () => {
    expect(normalizeYoutubeUrl('', { youtubeOnly: true })).toEqual({ ok: false, error: 'Stream URL is required to go live.' });
    expect(normalizeYoutubeUrl('not-a-url', { youtubeOnly: true })).toEqual({
      ok: false,
      error: 'Enter a valid URL (e.g. https://www.youtube.com/watch?v=VIDEO_ID).',
    });
    expect(normalizeYoutubeUrl('https://vimeo.com/12345', { youtubeOnly: true })).toEqual({
      ok: false,
      error: 'Only YouTube Live URLs are allowed in baseline mode.',
    });
    expect(normalizeYoutubeUrl('https://youtube.com/watch', { youtubeOnly: true })).toEqual({
      ok: false,
      error: 'Use a YouTube watch/live/embed/share URL with a valid video id.',
    });
    expect(normalizeYoutubeUrl('https://youtu.be/shortid', { youtubeOnly: true })).toEqual({
      ok: false,
      error: 'Use a YouTube watch/live/embed/share URL with a valid video id.',
    });
    expect(normalizeYoutubeUrl('https://www.youtube.com/watch?v=abc123def45zzz', { youtubeOnly: true })).toEqual({
      ok: false,
      error: 'Use a YouTube watch/live/embed/share URL with a valid video id.',
    });
  });

  it('accepts non-youtube http(s) URLs in compatibility mode and blocks non-http(s) protocols', () => {
    expect(normalizeYoutubeUrl('https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu')).toEqual({
      ok: true,
      url: 'https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu',
    });
    expect(normalizeYoutubeUrl('rtmp://ingest.example/live/key')).toEqual({
      ok: false,
      error: 'Only http(s) stream URLs are supported.',
    });
  });
});

describe('toPlayableYoutubeEmbedUrl', () => {
  it('converts supported youtube URL shapes into an embeddable URL', () => {
    expect(toPlayableYoutubeEmbedUrl('https://youtube.com/live/D_h4ChDG72k?feature=share')).toBe(
      'https://www.youtube.com/embed/D_h4ChDG72k?autoplay=1&rel=0&modestbranding=1',
    );
    expect(toPlayableYoutubeEmbedUrl('https://www.youtube.com/watch?v=D_h4ChDG72k')).toBe(
      'https://www.youtube.com/embed/D_h4ChDG72k?autoplay=1&rel=0&modestbranding=1',
    );
  });

  it('returns null when the URL is not a valid youtube video link', () => {
    expect(toPlayableYoutubeEmbedUrl('https://youtube.com/live/not-valid-id')).toBeNull();
    expect(toPlayableYoutubeEmbedUrl('https://vimeo.com/123')).toBeNull();
  });
});
