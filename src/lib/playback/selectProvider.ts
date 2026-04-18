/**
 * Playback provider selector.
 *
 * Hard-coded priority chain — NOT data-driven, NOT overridable per
 * request. Provider selection is a security-relevant decision; the
 * chain below is the authoritative policy.
 *
 *   1. FEATURE_SIGNED_PLAYBACK_ENABLED must be on. If off, every
 *      request falls through to legacy_embed regardless of game
 *      configuration — the flag is the kill switch.
 *   2. games.require_signed_url must be true. The per-game flag is
 *      what an ops operator flips to opt a specific game into signed
 *      playback.
 *   3. games.playback_provider must equal 'native_hls'. Any other
 *      value (or null) falls back.
 *   4. FEATURE_NATIVE_HLS_PROVIDER must be on. Gates the specific
 *      provider implementation.
 *
 * Anything less than all four → legacy_embed (zero behavior change).
 */
import type { IPlaybackProvider } from './IPlaybackProvider';
import { legacyEmbedProvider } from './LegacyEmbedProvider';
import { NativeHlsProvider } from './NativeHlsProvider';

export interface ProviderSelectionInput {
  game: {
    require_signed_url?: boolean | null;
    playback_provider?: string | null;
    playback_asset_id?: string | null;
  };
  flags: {
    FEATURE_SIGNED_PLAYBACK_ENABLED?: string;
    FEATURE_NATIVE_HLS_PROVIDER?: string;
  };
  /** HMAC secret — only consulted when the chain resolves to native_hls. */
  playbackTokenSecret?: string;
  /** Worker origin used to build signed URLs. */
  workerOrigin: string;
}

function flagOn(v: string | undefined): boolean {
  return v === 'true' || v === '1';
}

export function selectPlaybackProvider(
  input: ProviderSelectionInput,
): IPlaybackProvider {
  const signedEnabled = flagOn(input.flags.FEATURE_SIGNED_PLAYBACK_ENABLED);
  const nativeHlsEnabled = flagOn(input.flags.FEATURE_NATIVE_HLS_PROVIDER);
  const gameRequiresSigned = input.game.require_signed_url === true;
  const gameWantsNativeHls = input.game.playback_provider === 'native_hls';
  const assetConfigured = typeof input.game.playback_asset_id === 'string'
    && input.game.playback_asset_id.length > 0;

  if (!signedEnabled) return legacyEmbedProvider;
  if (!gameRequiresSigned) return legacyEmbedProvider;
  if (!gameWantsNativeHls) return legacyEmbedProvider;
  if (!nativeHlsEnabled) return legacyEmbedProvider;
  if (!assetConfigured) return legacyEmbedProvider;
  if (!input.playbackTokenSecret) return legacyEmbedProvider;

  return new NativeHlsProvider({
    secret: input.playbackTokenSecret,
    workerOrigin: input.workerOrigin,
  });
}
