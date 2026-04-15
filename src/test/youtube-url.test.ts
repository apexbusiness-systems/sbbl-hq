import { describe, expect, it } from 'vitest';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function isValidYoutubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_REGEX.test(id);
}

function extractYoutubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    // /watch?v=ID
    if (
      url.pathname === '/watch' ||
      url.pathname.startsWith('/live/') ||
      url.pathname.startsWith('/shorts/')
    ) {
      if (url.pathname === '/watch') {
        const watchId = url.searchParams.get('v');
        if (watchId && isValidYoutubeVideoId(watchId)) {
          return watchId;
        }
      }

      const pathSegments = url.pathname.split('/').filter(Boolean);
      const candidate = pathSegments[pathSegments.length - 1] ?? null;
      if (candidate && isValidYoutubeVideoId(candidate)) {
        return candidate;
      }
    }

    // youtu.be/ID
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const shortId = url.pathname.split('/').filter(Boolean)[0] ?? null;
      if (shortId && isValidYoutubeVideoId(shortId)) {
        return shortId;
      }
    }
  }

  return null;
}

describe('extractYoutubeVideoId', () => {
  it('extracts id from /watch URLs', () => {
    expect(extractYoutubeVideoId(new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBe('dQw4w9WgXcQ');
  });

  it('extracts id from /live and /shorts URLs', () => {
    expect(extractYoutubeVideoId(new URL('https://www.youtube.com/live/dQw4w9WgXcQ'))).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId(new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ'))).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-youtube URLs', () => {
    expect(extractYoutubeVideoId(new URL('https://example.com/watch?v=dQw4w9WgXcQ'))).toBeNull();
  });
});
