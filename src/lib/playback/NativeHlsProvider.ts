/**
 * Native HLS provider — signed playback for premium paths.
 *
 * Produces a `signedPlaybackUrl` pointing back at the SBBL-HQ worker
 * (never at the upstream origin directly), authenticated by a
 * short-lived HMAC-signed token bound to the user + session + game +
 * asset. This is the provider selected when `games.require_signed_url`
 * is true AND both feature flags (`FEATURE_SIGNED_PLAYBACK_ENABLED` +
 * `FEATURE_NATIVE_HLS_PROVIDER`) are on.
 *
 * Invariant enforced at the type level: the returned payload NEVER
 * includes `embedUrl`. If an upstream third-party URL exists on the
 * game row, it is dropped — leaking it back to the client would defeat
 * the signed path.
 *
 * The worker origin for the signed URL is passed in per-call by the
 * caller (it's derived from the request host). This avoids hard-coding
 * an env var and keeps the provider trivially testable.
 */
import type {
  IPlaybackProvider,
  PlaybackPayload,
  ResolvePlaybackArgs,
} from './IPlaybackProvider';
import { signPlaybackToken, type PlaybackTokenClaims } from './signed-token';

export interface NativeHlsConfig {
  /** HMAC-SHA256 signing secret (PLAYBACK_TOKEN_SECRET). */
  secret: string;
  /**
   * Absolute origin used to construct the signed URL, e.g.
   * `https://sbbl-hq.icu`. Must not have a trailing slash.
   */
  workerOrigin: string;
}

export class NativeHlsProvider implements IPlaybackProvider {
  readonly name = 'native_hls' as const;

  constructor(private readonly config: NativeHlsConfig) {
    if (!config.secret) throw new Error('NativeHlsProvider requires secret');
    if (!config.workerOrigin) throw new Error('NativeHlsProvider requires workerOrigin');
  }

  async resolve(args: ResolvePlaybackArgs): Promise<PlaybackPayload> {
    const assetId = args.game.playback_asset_id;
    if (!assetId) {
      throw new Error('native_hls requires games.playback_asset_id');
    }

    const expSec = Math.floor(new Date(args.expiresAt).getTime() / 1000);
    const mexSec = Math.floor(new Date(args.maxExpiresAt).getTime() / 1000);

    const claims: PlaybackTokenClaims = {
      v: 1,
      iss: 'sbbl-hq',
      userId: args.userId,
      gameId: args.gameId,
      sessionId: args.sessionId,
      assetId,
      playbackMode: args.mode,
      exp: expSec,
      mex: mexSec,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = await signPlaybackToken(claims, this.config.secret);

    // URL shape: /api/streams/:gameId/hls/:assetId.m3u8?t=<token>
    // The upstream playback origin/proxy route is out-of-scope for this
    // provider — this URL is served by the worker (PR 3+ or by
    // FEATURE_NATIVE_HLS_PROVIDER consumers). Deliberately avoids any
    // query-string leakage of user or game IDs (both live in the
    // signed claims, verified server-side).
    const encodedAsset = encodeURIComponent(assetId);
    const signedPlaybackUrl = `${this.config.workerOrigin}/api/streams/${args.gameId}/hls/${encodedAsset}.m3u8?t=${token}`;

    return {
      provider: 'native_hls',
      playbackMode: args.mode,
      signedPlaybackUrl,
      expiresAt: args.expiresAt,
      sessionId: args.sessionId,
      maxExpiresAt: args.maxExpiresAt,
      latencyMode: args.game.latency_mode ?? 'standard',
      ...(args.mode === 'replay'
        ? { replayTier: args.game.replay_quality_tier ?? 'raw' }
        : {}),
    };
  }
}
