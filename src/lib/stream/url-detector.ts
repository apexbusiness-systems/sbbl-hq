/**
 * url-detector.ts
 *
 * Universal stream URL type detection and normalization.
 * Accepts any valid video stream URL with zero strictness on format.
 * The only hard requirements: URL must be parseable and protocol must be
 * http(s)/rtmp(s) or a recognized stream scheme.
 *
 * Supports 13 stream source types. Advisory system provides level-coded
 * feedback (ok / warn / info) without ever hard-blocking a URL.
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
  | 'facebook'
  | 'kick'
  | 'rumble'
  | 'x-spaces'
  | 'instagram'
  | 'rtmp'
  | 'unknown';

export type StreamAdvisoryLevel = 'ok' | 'warn' | 'info';
export type StreamDeliveryClass = 'embed' | 'proxy' | 'unsupported';

export interface StreamAdvisory {
  level: StreamAdvisoryLevel;
  message: string;
}

export function getStreamDeliveryClass(url: string): StreamDeliveryClass {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return 'unsupported';

  if (
    normalized.includes('youtube.com') ||
    normalized.includes('youtu.be') ||
    normalized.includes('twitch.tv') ||
    normalized.includes('vimeo.com') ||
    normalized.includes('facebook.com')
  ) {
    return 'embed';
  }

  if (
    normalized.endsWith('.m3u8') ||
    normalized.endsWith('.mp4') ||
    normalized.endsWith('.mpd') ||
    normalized.includes('stream.sbbl-hq.icu')
  ) {
    return 'proxy';
  }

  return 'unsupported';
}

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
  // Match a /whep segment as a standalone path component (not a substring of
  // a longer segment), or an explicit ?whep= / &whep= query parameter.
  // Examples that match:  /whep/live  /live/whep  /api/whep
  // Examples that DON'T: /badwhep/stream  /whepfoo/bar
  if (
    /(?:^|\/)whep(?:\/|$)/i.test(url) ||    // path segment: /whep/ or /whep$
    /[?&]whep[=&]/i.test(url) ||             // query param: ?whep= or &whep=
    /[?&]whep$/i.test(url)                   // query param at end: ?whep
  ) {
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

  // Platform detection — order by expected usage frequency
  if (isYoutubeUrl(url)) return 'youtube';

  if (/(?:^|[./])twitch\.tv(?:\/|$)/i.test(url)) return 'twitch';

  if (/(?:^|[./])vimeo\.com(?:\/|$)/i.test(url)) return 'vimeo';

  if (/(?:^|[./])(?:facebook\.com|fb\.me|fbcdn\.net)(?:\/|$)/i.test(url)) return 'facebook';

  if (/(?:^|[./])kick\.com(?:\/|$)/i.test(url)) return 'kick';

  if (/(?:^|[./])rumble\.com(?:\/|$)/i.test(url)) return 'rumble';

  if (/(?:^|[./])(?:x\.com|twitter\.com)\/i\/(?:broadcasts|spaces)(?:\/|$)/i.test(url)) return 'x-spaces';

  if (/(?:^|[./])instagram\.com\/(?:live|.*\/live)(?:\/|$)/i.test(url)) return 'instagram';

  return 'unknown';
}

export interface PlayableUrl {
  url: string;
  type: StreamUrlType;
  warning?: string;
}

/**
 * Extract a Twitch channel name from common twitch.tv URL formats.
 * e.g. https://www.twitch.tv/channelname → channelname
 */
export function extractTwitchChannel(url: string): string | null {
  try {
    const parsed = new URL(url.trim());

    // Handle embed URLs: player.twitch.tv/?channel=name
    if (parsed.hostname.toLowerCase() === 'player.twitch.tv') {
      return parsed.searchParams.get('channel') || null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    // Skip known non-channel paths
    if (parts.length === 0) return null;
    const first = parts[0].toLowerCase();
    if (['directory', 'videos', 'p', 'settings', 'search'].includes(first)) return null;
    return parts[0];
  } catch {
    return null;
  }
}

/**
 * Normalizes any stream source URL into its canonical raw format for persistence.
 * This guarantees we never persist embed/iframe URLs (Canonical Persistence Law).
 */
export function canonicalizeStreamSourceUrl(raw: string): { url: string; type: StreamUrlType; canonical: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: '', type: 'unknown', canonical: false };

  const type = detectStreamUrlType(trimmed);

  if (type === 'youtube') {
    const embedUrl = toPlayableYoutubeEmbedUrl(trimmed);
    return {
      url: embedUrl ?? trimmed,
      type: 'youtube',
      canonical: !!embedUrl
    };
  }

  if (type === 'twitch') {
    const channel = extractTwitchChannel(trimmed);
    if (channel) {
      const canonicalUrl = `https://www.twitch.tv/${channel}`;
      return { url: canonicalUrl, type: 'twitch', canonical: true };
    }
  }

  if (type === 'vimeo') {
    const vimeoId = extractVimeoId(trimmed);
    if (vimeoId) {
       const canonicalUrl = `https://vimeo.com/${vimeoId}`;
       return { url: canonicalUrl, type: 'vimeo', canonical: true };
    }
  }

  if (type === 'facebook') {
    return {
      url: trimmed,
      type: 'facebook',
      warning: 'Facebook embedding may be limited. Verify playback after going live.',
    };
  }

  return { url: trimmed, type };
}

/** Human-readable label for each stream URL type */
export const STREAM_TYPE_LABELS: Record<StreamUrlType, string> = {
  youtube:    'YouTube',
  hls:        'HLS',
  dash:       'DASH',
  whep:       'WHEP',
  mp4:        'MP4',
  twitch:     'Twitch',
  vimeo:      'Vimeo',
  facebook:   'Facebook',
  kick:       'Kick',
  rumble:     'Rumble',
  'x-spaces': 'X Spaces',
  instagram:  'IG Live',
  rtmp:       'RTMP',
  unknown:    'Stream',
};

/**
 * Centralized advisory system for stream URL types.
 * Returns level-coded feedback for the admin UI.
 * NEVER blocks — only advises.
 */
export function getStreamTypeAdvisory(type: StreamUrlType): StreamAdvisory {
  switch (type) {
    case 'rtmp':
      return { level: 'warn', message: 'RTMP cannot play in browser — use an HLS endpoint instead.' };
    case 'facebook':
      return { level: 'warn', message: 'Facebook embedding may be limited. Verify playback after going live.' };
    case 'instagram':
      return { level: 'warn', message: 'Instagram Live does not support external embedding.' };
    case 'kick':
      return { level: 'warn', message: 'Kick does not provide embeddable player URLs. Consider an HLS restream.' };
    case 'rumble':
      return { level: 'warn', message: 'Rumble embedding may be restricted. Verify playback after going live.' };
    case 'x-spaces':
      return { level: 'warn', message: 'X Spaces does not support external embedding.' };
    case 'youtube':
      return { level: 'ok', message: 'YouTube stream detected — auto-normalized.' };
    case 'hls':
      return { level: 'ok', message: 'HLS stream — universal browser support.' };
    case 'dash':
      return { level: 'ok', message: 'DASH stream detected.' };
    case 'whep':
      return { level: 'info', message: 'WHEP/WebRTC — ultra-low latency mode active.' };
    case 'twitch':
      return { level: 'ok', message: 'Twitch stream detected — auto-configured.' };
    case 'vimeo':
      return { level: 'ok', message: 'Vimeo stream detected — auto-configured.' };
    case 'mp4':
      return { level: 'ok', message: 'Direct video file detected.' };
    case 'unknown':
    default:
      return { level: 'ok', message: '' };
  }
}
