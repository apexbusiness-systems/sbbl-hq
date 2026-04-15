// src/lib/stream/url-detector.ts
// Universal stream URL type detection + normalization.
// Zero runtime dependencies beyond the existing youtube-url.ts utility.
// Used by: LiveStreamPlayer (player routing), AdminStreamOverlay (URL badge).

import { isYoutubeUrl, toPlayableYoutubeEmbedUrl } from '@/lib/stream/youtube-url';

export type StreamUrlType =
  | 'youtube'
  | 'hls'
  | 'dash'
  | 'whep'
  | 'mp4'
  | 'twitch'
  | 'vimeo'
  | 'rtmp'
  | 'unknown';

/**
 * Detects the stream type of a URL string.
 * Rules are evaluated top-to-bottom; first match wins.
 * Returns 'unknown' for any https:// source that doesn't match a known pattern —
 * these are passed through to ReactPlayer for best-effort playback.
 */
export function detectStreamUrlType(url: string): StreamUrlType {
  const trimmed = url.trim();
  if (!trimmed) return 'unknown';

  // RTMP must be checked before http(s) — its scheme is distinct
  if (/^rtmps?:\/\//i.test(trimmed)) return 'rtmp';

  // YouTube — check before generic URL parsing
  if (isYoutubeUrl(trimmed)) return 'youtube';

  // Twitch
  if (/twitch\.tv/i.test(trimmed)) return 'twitch';

  // Vimeo
  if (/vimeo\.com/i.test(trimmed)) return 'vimeo';

  // HLS — .m3u8 extension with optional query string
  if (/\.m3u8(\?|$)/i.test(trimmed)) return 'hls';

  // MPEG-DASH
  if (/\.mpd(\?|$)/i.test(trimmed)) return 'dash';

  // WHEP — path segment OR query param named 'whep'
  if (/\/whep\//i.test(trimmed) || /[?&]whep=/i.test(trimmed)) return 'whep';

  // Direct video files
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(trimmed)) return 'mp4';

  // Fallthrough — any other https:// source
  return 'unknown';
}

export interface PlayableUrlResult {
  url: string;
  type: StreamUrlType;
  /** Non-null when the URL type requires a user-facing advisory (e.g. RTMP). */
  warning?: string;
}

/**
 * Normalizes a raw stream URL into a playable form and declares its type.
 * - YouTube URLs are converted to embed form via the existing youtube-url utility.
 * - RTMP URLs are returned as-is with a warning (browser cannot play RTMP directly).
 * - All other URLs are returned unchanged.
 */
export function toPlayableUrl(raw: string): PlayableUrlResult {
  const trimmed = raw.trim();
  const type = detectStreamUrlType(trimmed);

  if (type === 'rtmp') {
    return {
      url: trimmed,
      type,
      warning: 'RTMP streams cannot play directly in a browser. Configure an HLS or WHEP endpoint on your encoder instead.',
    };
  }

  if (type === 'youtube') {
    const embedUrl = toPlayableYoutubeEmbedUrl(trimmed);
    return { url: embedUrl ?? trimmed, type };
  }

  return { url: trimmed, type };
}
