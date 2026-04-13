import { describe, expect, it } from 'vitest';
import { normalizeYoutubeUrl } from '@/lib/stream/youtube-url';

describe('normalizeYoutubeUrl', () => {
  it('normalizes watch/live/embed/youtu.be URLs to canonical watch URL', () => {
    expect(normalizeYoutubeUrl('https://www.youtube.com/watch?v=abc123def45')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
    expect(normalizeYoutubeUrl('https://youtube.com/live/abc123def45?feature=share')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
    expect(normalizeYoutubeUrl('https://www.youtube.com/embed/abc123def45')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
    expect(normalizeYoutubeUrl('https://youtu.be/abc123def45?t=2')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=abc123def45',
    });
  });

  it('rejects malformed/empty/non-youtube URLs', () => {
    expect(normalizeYoutubeUrl('')).toEqual({ ok: false, error: 'Stream URL is required to go live.' });
    expect(normalizeYoutubeUrl('not-a-url')).toEqual({
      ok: false,
      error: 'Enter a valid URL (e.g. https://www.youtube.com/watch?v=VIDEO_ID).',
    });
    expect(normalizeYoutubeUrl('https://vimeo.com/12345')).toEqual({
      ok: false,
      error: 'Only YouTube Live URLs are allowed in baseline mode.',
    });
    expect(normalizeYoutubeUrl('https://youtube.com/watch')).toEqual({
      ok: false,
      error: 'Use a YouTube watch/live/embed/share URL with a valid video id.',
    });
    expect(normalizeYoutubeUrl('https://youtu.be/shortid')).toEqual({
      ok: false,
      error: 'Use a YouTube watch/live/embed/share URL with a valid video id.',
    });
    expect(normalizeYoutubeUrl('https://www.youtube.com/watch?v=abc123def45zzz')).toEqual({
      ok: false,
      error: 'Use a YouTube watch/live/embed/share URL with a valid video id.',
    });
  });
});
