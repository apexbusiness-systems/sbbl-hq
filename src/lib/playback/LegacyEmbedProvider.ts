/**
 * Legacy embed provider.
 *
 * Passthrough of the existing behavior: whatever games.source_url is set
 * to becomes the embedUrl. Zero-risk, zero behavior change vs. current
 * /api/streams/:gameId/session output. Selected by default for any game
 * where require_signed_url = false (the current default).
 *
 * Does NOT emit a signedPlaybackUrl and does NOT mint a playback token
 * row — those are owned by NativeHlsProvider (WS2 PR 2).
 */
import type {
  IPlaybackProvider,
  PlaybackPayload,
  ResolvePlaybackArgs,
} from './IPlaybackProvider';

export class LegacyEmbedProvider implements IPlaybackProvider {
  readonly name = 'legacy_embed' as const;

  async resolve(args: ResolvePlaybackArgs): Promise<PlaybackPayload> {
    const embedUrl = args.game.source_url ?? undefined;
    return {
      provider: 'legacy_embed',
      playbackMode: args.mode,
      embedUrl,
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

export const legacyEmbedProvider = new LegacyEmbedProvider();
