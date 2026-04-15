/**
 * url-detector.ts
 *
 * Universal stream URL type detection and normalization.
 * Accepts any valid video stream URL with zero strictness on format.
 * The only hard requirements: URL must be parseable and protocol must be
 * http(s)/rtmp(s) or a recognized stream scheme.
 */

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
 * Detect the stream URL type from a raw URL string.
 * Detection order matters — more specific patterns first.
 */
export function detectStreamUrlType(url: string): StreamUrlType {
  if (!url) return 'unknown';
  const lower = url.toLowerCase();

  // RTMP/RTMPS — must check before generic https checks
  if (/^rtmps?:\/\//i.test(url)) return 'rtmp';

  // WHEP — WebRTC-HTTP Egress Protocol
  // Detect by path segment or query param
  if (/\/whep\//i.test(url) || /[?&]whep[=&]/.test(lower) || lower.includes('/whep')) {
    return 'whep';
  }

  // HLS
  if (/\.m3u8(\?|#|$)/i.test(url)) return 'hls';

  // DASH
  if (/\.mpd(\?|#|$)/i.test(url)) return 'dash';

  // Direct video files
  if (/\.mp4(\?|#|$)/i.test(url) || /\.webm(\?|#|$)/i.test(url) || /\.ogg(\?|#|$)/i.test(url)) {
    return 'mp4';
  }

  // Platform detection
  if (isYoutubeUrl(url)) return 'youtube';

  if (/(?:^|[./])twitch\.tv(?:\/|$)/i.test(url)) return 'twitch';

  if (/(?:^|[./])vimeo\.com(?:\/|$)/i.test(url)) return 'vimeo';

  return 'unknown';
}

export interface PlayableUrl {
  url: string;
  type: StreamUrlType;
  warning?: string;
}

/**
 * Convert a raw stream URL to a playable form.
 * - YouTube URLs are normalized to embed format.
 * - RTMP URLs trigger an advisory warning (cannot play in browser).
 * - All other URLs are returned as-is.
 */
export function toPlayableUrl(raw: string): PlayableUrl {
  const trimmed = raw.trim();
  if (!trimmed) return { url: '', type: 'unknown' };

  const type = detectStreamUrlType(trimmed);

  if (type === 'rtmp') {
    return {
      url: trimmed,
      type: 'rtmp',
      warning: 'RTMP cannot play in browser. Use an HLS endpoint instead.',
    };
  }

  if (type === 'youtube') {
    const embedUrl = toPlayableYoutubeEmbedUrl(trimmed);
    return { url: embedUrl ?? trimmed, type: 'youtube' };
  }

  return { url: trimmed, type };
}

/** Human-readable label for each stream URL type */
export const STREAM_TYPE_LABELS: Record<StreamUrlType, string> = {
  youtube: 'YouTube',
  hls:     'HLS',
  dash:    'DASH',
  whep:    'WHEP',
  mp4:     'MP4',
  twitch:  'Twitch',
  vimeo:   'Vimeo',
  rtmp:    'RTMP',
  unknown: 'Unknown',
};
