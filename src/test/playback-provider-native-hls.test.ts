/**
 * NativeHlsProvider + selectPlaybackProvider — priority-chain + payload tests.
 */
import { describe, expect, it } from 'vitest';
import { NativeHlsProvider } from '@/lib/playback/NativeHlsProvider';
import { selectPlaybackProvider } from '@/lib/playback/selectProvider';
import { verifyPlaybackToken } from '@/lib/playback/signed-token';

const SECRET = 'test-secret-sufficient-entropy-12345';
const ORIGIN = 'https://sbbl-hq.icu';

const baseArgs = {
  gameId: 'g-1',
  userId: 'u-1',
  sessionId: 'sess-1',
  expiresAt: new Date(Date.now() + 70_000).toISOString(),
  maxExpiresAt: new Date(Date.now() + 21600_000).toISOString(),
};

describe('NativeHlsProvider', () => {
  it('returns a signedPlaybackUrl and never an embedUrl', async () => {
    const p = new NativeHlsProvider({ secret: SECRET, workerOrigin: ORIGIN });
    const payload = await p.resolve({
      ...baseArgs,
      mode: 'live',
      game: { id: 'g-1', playback_asset_id: 'asset-abc', source_url: 'https://evil/embed' },
    });
    expect(payload.provider).toBe('native_hls');
    expect(payload.signedPlaybackUrl).toMatch(/\/api\/streams\/g-1\/hls\/asset-abc\.m3u8\?t=/);
    expect(payload.embedUrl).toBeUndefined();
  });

  it('signed URL contains a token that verifies with the same secret', async () => {
    const p = new NativeHlsProvider({ secret: SECRET, workerOrigin: ORIGIN });
    const payload = await p.resolve({
      ...baseArgs,
      mode: 'live',
      game: { id: 'g-1', playback_asset_id: 'asset-abc' },
    });
    const token = payload.signedPlaybackUrl!.split('?t=')[1];
    const r = await verifyPlaybackToken(token, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claims.userId).toBe('u-1');
      expect(r.claims.gameId).toBe('g-1');
      expect(r.claims.sessionId).toBe('sess-1');
      expect(r.claims.assetId).toBe('asset-abc');
      expect(r.claims.playbackMode).toBe('live');
    }
  });

  it('throws when playback_asset_id is missing', async () => {
    const p = new NativeHlsProvider({ secret: SECRET, workerOrigin: ORIGIN });
    await expect(
      p.resolve({ ...baseArgs, mode: 'live', game: { id: 'g-1' } }),
    ).rejects.toThrow(/playback_asset_id/i);
  });

  it('emits replayTier when resolving a replay', async () => {
    const p = new NativeHlsProvider({ secret: SECRET, workerOrigin: ORIGIN });
    const payload = await p.resolve({
      ...baseArgs,
      mode: 'replay',
      game: { id: 'g-1', playback_asset_id: 'a', replay_quality_tier: 'edited' },
    });
    expect(payload.playbackMode).toBe('replay');
    expect(payload.replayTier).toBe('edited');
  });

  it('constructor rejects empty secret', () => {
    expect(() => new NativeHlsProvider({ secret: '', workerOrigin: ORIGIN })).toThrow();
  });

  it('constructor rejects empty workerOrigin', () => {
    expect(() => new NativeHlsProvider({ secret: SECRET, workerOrigin: '' })).toThrow();
  });
});

describe('selectPlaybackProvider priority chain', () => {
  const nativeGame = {
    require_signed_url: true,
    playback_provider: 'native_hls',
    playback_asset_id: 'asset-1',
  };
  const bothFlagsOn = {
    FEATURE_SIGNED_PLAYBACK_ENABLED: 'true',
    FEATURE_NATIVE_HLS_PROVIDER: 'true',
  };

  it('returns native_hls when the full chain is satisfied', () => {
    const p = selectPlaybackProvider({
      game: nativeGame,
      flags: bothFlagsOn,
      playbackTokenSecret: SECRET,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('native_hls');
  });

  it('falls back to legacy_embed when FEATURE_SIGNED_PLAYBACK_ENABLED is off', () => {
    const p = selectPlaybackProvider({
      game: nativeGame,
      flags: { ...bothFlagsOn, FEATURE_SIGNED_PLAYBACK_ENABLED: 'false' },
      playbackTokenSecret: SECRET,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });

  it('falls back to legacy_embed when require_signed_url is false', () => {
    const p = selectPlaybackProvider({
      game: { ...nativeGame, require_signed_url: false },
      flags: bothFlagsOn,
      playbackTokenSecret: SECRET,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });

  it('falls back to legacy_embed when playback_provider is not native_hls', () => {
    const p = selectPlaybackProvider({
      game: { ...nativeGame, playback_provider: 'legacy_embed' },
      flags: bothFlagsOn,
      playbackTokenSecret: SECRET,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });

  it('falls back to legacy_embed when FEATURE_NATIVE_HLS_PROVIDER is off', () => {
    const p = selectPlaybackProvider({
      game: nativeGame,
      flags: { ...bothFlagsOn, FEATURE_NATIVE_HLS_PROVIDER: 'false' },
      playbackTokenSecret: SECRET,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });

  it('falls back to legacy_embed when playback_asset_id is missing', () => {
    const p = selectPlaybackProvider({
      game: { ...nativeGame, playback_asset_id: null },
      flags: bothFlagsOn,
      playbackTokenSecret: SECRET,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });

  it('falls back to legacy_embed when playbackTokenSecret is missing', () => {
    const p = selectPlaybackProvider({
      game: nativeGame,
      flags: bothFlagsOn,
      playbackTokenSecret: undefined,
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });

  it('default (all undefined) is legacy_embed', () => {
    const p = selectPlaybackProvider({
      game: {},
      flags: {},
      workerOrigin: ORIGIN,
    });
    expect(p.name).toBe('legacy_embed');
  });
});
