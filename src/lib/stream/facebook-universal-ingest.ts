export type FacebookIngestMode = 'direct-hls' | 'server-relay' | 'unsupported';

export interface FacebookIngestAssessment {
  mode: FacebookIngestMode;
  reason: string;
  playableInBrowser: boolean;
  requiresServerCredentials: boolean;
}

/**
 * Additive-only assessment helper.
 * Does not alter player behavior; used by ops tooling and future adapters.
 */
export function assessFacebookUniversalIngest(url: string): FacebookIngestAssessment {
  const input = (url ?? '').trim();
  if (!input) {
    return {
      mode: 'unsupported',
      reason: 'empty-url',
      playableInBrowser: false,
      requiresServerCredentials: false,
    };
  }

  // Direct browser playback is only possible when the source is already an HLS URL.
  if (/\.m3u8(?:$|\?)/i.test(input)) {
    return {
      mode: 'direct-hls',
      reason: 'pre-resolved-hls',
      playableInBrowser: true,
      requiresServerCredentials: false,
    };
  }

  const isFacebook = /(?:^https?:\/\/)?(?:www\.)?(facebook\.com|fb\.watch)\//i.test(input);
  if (!isFacebook) {
    return {
      mode: 'unsupported',
      reason: 'non-facebook-url',
      playableInBrowser: false,
      requiresServerCredentials: false,
    };
  }

  // Canonical FB pages/videos generally require server-side extraction/relay to avoid SDK/CSP conflicts.
  return {
    mode: 'server-relay',
    reason: 'fb-page-or-video-needs-backend-resolution',
    playableInBrowser: false,
    requiresServerCredentials: true,
  };
}
