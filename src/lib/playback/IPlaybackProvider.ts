/**
 * Playback provider interface.
 *
 * Decouples the /api/streams/:gameId/session endpoint from any single
 * delivery mechanism. Every provider returns a PlaybackPayload with the
 * same shape; callers never branch on provider-specific fields.
 *
 * Invariants (CI-enforced in PR 2):
 *   - A payload with playbackMode='live' or playbackMode='replay' and a
 *     provider of 'native_hls' MUST return signedPlaybackUrl, never
 *     embedUrl. Raw third-party URLs never flow through the signed path.
 *   - expiresAt is strictly less than or equal to maxExpiresAt. The
 *     session cap (ENTITLEMENT.VIEWING_SESSION_MAX_SECONDS) bounds
 *     maxExpiresAt; entitlement validity bounds eligibility to issue
 *     a new session at all.
 */
export type PlaybackProviderName = 'legacy_embed' | 'native_hls';
export type PlaybackMode = 'live' | 'replay';
export type LatencyMode = 'standard' | 'low';
export type ReplayTier = 'raw' | 'edited';

export interface PlaybackPayload {
  provider: PlaybackProviderName;
  playbackMode: PlaybackMode;
  /** Present for legacy_embed only. Never populated for native_hls. */
  embedUrl?: string;
  /** Present for native_hls or any signed-path provider. */
  signedPlaybackUrl?: string;
  /** ISO-8601. Rolling session expiry (heartbeat-extended up to maxExpiresAt). */
  expiresAt: string;
  /** Stream access session row id. */
  sessionId: string;
  /** ISO-8601. Hard ceiling; heartbeats never extend past this. */
  maxExpiresAt: string;
  latencyMode: LatencyMode;
  /** Only present when playbackMode === 'replay'. */
  replayTier?: ReplayTier;
}

export interface ResolvePlaybackArgs {
  gameId: string;
  userId: string;
  sessionId: string;
  mode: PlaybackMode;
  /** ISO-8601 of the stream_access_sessions.expires_at row. */
  expiresAt: string;
  /** ISO-8601 of the stream_access_sessions.max_expires_at row. */
  maxExpiresAt: string;
  /**
   * Opaque game-row snapshot passed through so providers avoid a second
   * DB round-trip. Providers should consume only the fields they declare.
   */
  game: {
    id: string;
    source_url?: string | null;
    playback_provider?: PlaybackProviderName | null;
    playback_asset_id?: string | null;
    require_signed_url?: boolean | null;
    latency_mode?: LatencyMode | null;
    replay_quality_tier?: ReplayTier | null;
  };
}

export interface IPlaybackProvider {
  readonly name: PlaybackProviderName;
  resolve(args: ResolvePlaybackArgs): Promise<PlaybackPayload>;
}
