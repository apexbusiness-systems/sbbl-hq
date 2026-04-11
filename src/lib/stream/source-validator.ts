export type StreamSourceType = 'hls' | 'mp4' | 'youtube' | 'twitch' | 'facebook' | 'unsupported';
export type StreamSourceStatus = 'untested' | 'valid' | 'valid_with_warning' | 'invalid';
export type StreamRiskLevel = 'low' | 'medium' | 'high';
export type StreamVisibilityClass = 'private_or_gated' | 'public' | 'unknown';

export interface StreamSourceValidationResult {
  ok: boolean;
  normalizedUrl: string;
  sourceType: StreamSourceType;
  sourceStatus: StreamSourceStatus;
  riskLevel: StreamRiskLevel;
  visibilityClass: StreamVisibilityClass;
  validationMessage: string;
  blockingReason: string | null;
}

function asInvalid(
  message: string,
  blockingReason: string,
  normalizedUrl = '',
  sourceType: StreamSourceType = 'unsupported',
): StreamSourceValidationResult {
  return {
    ok: false,
    normalizedUrl,
    sourceType,
    sourceStatus: 'invalid',
    riskLevel: 'high',
    visibilityClass: 'unknown',
    validationMessage: message,
    blockingReason,
  };
}

export function validateStreamSource(rawUrl: string): StreamSourceValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) return asInvalid('Stream source URL is required.', 'missing_url');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return asInvalid('Stream source URL must be a valid absolute URL.', 'invalid_url');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host.endsWith('facebook.com') || host === 'fb.watch') {
    return validateFacebookSource(url);
  }

  url.searchParams.delete('fbclid'); // safe normalization only
  const normalizedUrl = url.toString();
  const path = url.pathname.toLowerCase();

  if (path.endsWith('.m3u8')) {
    return { ok: true, normalizedUrl, sourceType: 'hls', sourceStatus: 'valid', riskLevel: 'low', visibilityClass: 'private_or_gated', validationMessage: 'HLS source accepted.', blockingReason: null };
  }
  if (path.endsWith('.mp4')) {
    return { ok: true, normalizedUrl, sourceType: 'mp4', sourceStatus: 'valid', riskLevel: 'low', visibilityClass: 'private_or_gated', validationMessage: 'MP4 source accepted.', blockingReason: null };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    const isWatch = (host.includes('youtube') && url.pathname === '/watch' && !!url.searchParams.get('v')) || host === 'youtu.be';
    const isLive = host.includes('youtube') && url.pathname.startsWith('/live');
    if (!isWatch && !isLive) return asInvalid('YouTube source must be watch/live URL.', 'unsupported_youtube_url', normalizedUrl, 'youtube');
    return { ok: true, normalizedUrl, sourceType: 'youtube', sourceStatus: 'valid_with_warning', riskLevel: 'medium', visibilityClass: 'public', validationMessage: 'YouTube source accepted. Public source = soft paywall only.', blockingReason: null };
  }
  if (host.endsWith('twitch.tv')) {
    const okPath = /^\/[a-z0-9_]+$/i.test(url.pathname) || url.pathname.includes('/videos/');
    if (!okPath) return asInvalid('Twitch URL must target a channel or video.', 'unsupported_twitch_url', normalizedUrl, 'twitch');
    return { ok: true, normalizedUrl, sourceType: 'twitch', sourceStatus: 'valid_with_warning', riskLevel: 'medium', visibilityClass: 'public', validationMessage: 'Twitch source accepted. Public source = soft paywall only.', blockingReason: null };
  }

  return asInvalid('Unsupported stream source. Allowed: HLS, MP4, YouTube, Twitch, deterministic Facebook live/video URLs.', 'unsupported_source', normalizedUrl);
}

function validateFacebookSource(url: URL): StreamSourceValidationResult {
  url.searchParams.delete('fbclid');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  const normalizedBase = `https://${host}${path || '/'}`;

  if (path === '/profile.php' && url.searchParams.get('id')) {
    return asInvalid('facebook.com/profile.php?id=... is unsupported. Use deterministic page slug URL.', 'facebook_profile_id_unsupported', normalizedBase, 'facebook');
  }

  const cleanSlug = /^\/[A-Za-z0-9.]+$/.test(path);
  if (cleanSlug) {
    return {
      ok: true,
      normalizedUrl: `https://facebook.com${path}/live`,
      sourceType: 'facebook',
      sourceStatus: 'valid_with_warning',
      riskLevel: 'high',
      visibilityClass: 'public',
      validationMessage: 'Facebook slug normalized to /live. Public source = soft paywall only.',
      blockingReason: null,
    };
  }

  const deterministicVideo =
    /^\/[^/]+\/videos\/\d+\/?$/i.test(path) ||
    (path === '/watch' && Boolean(url.searchParams.get('v')));
  if (deterministicVideo) {
    return {
      ok: true,
      normalizedUrl: url.toString(),
      sourceType: 'facebook',
      sourceStatus: 'valid_with_warning',
      riskLevel: 'high',
      visibilityClass: 'public',
      validationMessage: 'Deterministic Facebook video URL accepted. Public source = soft paywall only.',
      blockingReason: null,
    };
  }

  return asInvalid('Facebook URL is ambiguous. Use page slug /live or deterministic video URL.', 'facebook_ambiguous_url', normalizedBase, 'facebook');
}
