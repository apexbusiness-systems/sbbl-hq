const YOUTUBE_HOSTS = new Set([
  'youtube.com',           // ← FIXED: Added
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',  // ← FIXED: Added
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
    if (url.pathname
