const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

function extractYoutubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && id.length >= 6 ? id : null;
  }
  if (host.endsWith('youtube.com')) {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && id.length >= 6 ? id : null;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'live' || parts[0] === 'embed') {
      const id = parts[1];
      return id && id.length >= 6 ? id : null;
    }
  }
  return null;
}

export function isYoutubeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function normalizeYoutubeUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Stream URL is required to go live.' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a valid URL (e.g. https://www.youtube.com/watch?v=VIDEO_ID).' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return { ok: false, error: 'Only YouTube Live URLs are allowed in baseline mode.' };
  }
  const videoId = extractYoutubeVideoId(parsed);
  if (!videoId) {
    return { ok: false, error: 'Use a YouTube watch/live/embed/share URL with a valid video id.' };
  }
  return { ok: true, url: `https://www.youtube.com/watch?v=${videoId}` };
}
