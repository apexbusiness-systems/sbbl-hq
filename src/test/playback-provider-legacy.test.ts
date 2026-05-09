/**
 * LegacyEmbedProvider — passthrough invariants.
 * Ensures zero behavior change vs. current embed output and that the
 * signed-playback fields are never populated from this provider.
 */
import { describe, expect, it } from 'vitest';
import { legacyEmbedProvider } from '@/lib/playback/LegacyEmbedProvider';

const baseArgs = {
  gameId: 'g1',
  userId: 'u1',
  sessionId: 's1',
  expiresAt: '2026-04-18T20:00:00.000Z',
  maxExpiresAt: '2026-04-19T02:00:00.000Z',
};

describe('LegacyEmbedProvider', () => {
  it('returns embedUrl from game.source_url in live mode', async () => {
    const payload = await legacyEmbedProvider.resolve({
      ...baseArgs,
      mode: 'live',
      game: { id: 'g1', source_url: 'https://youtube.com/embed/abc' },
    });
    expect(payload.provider).toBe('legacy_embed');
    expect(payload.playbackMode).toBe('live');
    expect(payload.embedUrl).toBe('https://youtube.com/embed/abc');
    expect(payload.signedPlaybackUrl).toBeUndefined();
    expect(payload.latencyMode).toBe('standard');
    expect(payload.replayTier).toBeUndefined();
  });

  it('preserves session/max expiry from caller, does not recompute', async () => {
    const payload = await legacyEmbedProvider.resolve({
      ...baseArgs,
      mode: 'live',
      game: { id: 'g1', source_url: 'https://example/x' },
    });
    expect(payload.expiresAt).toBe(baseArgs.expiresAt);
    expect(payload.maxExpiresAt).toBe(baseArgs.maxExpiresAt);
    expect(payload.sessionId).toBe('s1');
  });

  it('passes through latency_mode from game row', async () => {
    const payload = await legacyEmbedProvider.resolve({
      ...baseArgs,
      mode: 'live',
      game: { id: 'g1', source_url: 'x', latency_mode: 'low' },
    });
    expect(payload.latencyMode).toBe('low');
  });

  it('emits replayTier when resolving a replay', async () => {
    const payload = await legacyEmbedProvider.resolve({
      ...baseArgs,
      mode: 'replay',
      game: { id: 'g1', source_url: 'x', replay_quality_tier: 'edited' },
    });
    expect(payload.playbackMode).toBe('replay');
    expect(payload.replayTier).toBe('edited');
  });

  it('falls back to undefined embedUrl when source_url is missing', async () => {
    const payload = await legacyEmbedProvider.resolve({
      ...baseArgs,
      mode: 'live',
      game: { id: 'g1' },
    });
    expect(payload.embedUrl).toBeUndefined();
  });
});
