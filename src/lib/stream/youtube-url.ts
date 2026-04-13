const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function isValidYoutubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_REGEX.test(id);
}

function extractYoutubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && isValidYoutubeVideoId(id) ? id : null;
  }
  if (host.endsWith('youtube.com')) {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && isValidYoutubeVideoId(id) ? id : null;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'live' || parts[0] === 'embed') {
      const id = parts[1];
      return id && isValidYoutubeVideoId(id) ? id : null;
    }
  }
  return null;
}

export function getYoutubeVideoId(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    return extractYoutubeVideoId(parsed);
  } catch {
    return null;
  }
}

export function isYoutubeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

type NormalizeOptions = {
  youtubeOnly?: boolean;
};

export function normalizeYoutubeUrl(
  raw: string,
  options: NormalizeOptions = {},
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Stream URL is required to go live.' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a valid URL (e.g. https://www.youtube.com/watch?v=VIDEO_ID).' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) stream URLs are supported.' };
  }
  const host = parsed.hostname.toLowerCase();
  const youtubeOnly = options.youtubeOnly ?? false;
  if (youtubeOnly && !YOUTUBE_HOSTS.has(host)) {
    return { ok: false, error: 'Only YouTube Live URLs are allowed in baseline mode.' };
  }
  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = extractYoutubeVideoId(parsed);
    if (!videoId) {
      return { ok: false, error: 'Use a YouTube watch/live/embed/share URL with a valid video id.' };
    }
    return { ok: true, url: `https://www.youtube.com/watch?v=${videoId}` };
  }
  return { ok: true, url: trimmed };
}

export function toPlayableYoutubeEmbedUrl(raw: string): string | null {
  const videoId = getYoutubeVideoId(raw);
  if (!videoId) return null;
  // Use the embed endpoint explicitly; this avoids provider-level /live URL parsing issues.
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
}
