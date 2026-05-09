/**
 * Legacy compatibility shim.
 *
 * This provider intentionally mirrors LegacyEmbedProvider semantics so any
 * historical imports remain type-safe while the worker-side resolver owns
 * actual provider selection.
 */
import type {
  IPlaybackProvider,
  PlaybackPayload,
  ResolvePlaybackArgs,
} from './IPlaybackProvider';

export class ReactPlayerProvider implements IPlaybackProvider {
  readonly name = 'legacy_embed' as const;

  async resolve(args: ResolvePlaybackArgs): Promise<PlaybackPayload> {
    return {
      provider: 'legacy_embed',
      playbackMode: args.mode,
      embedUrl: args.game.source_url ?? undefined,
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
