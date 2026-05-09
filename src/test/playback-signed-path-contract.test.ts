/**
 * Stream Independence Contract — signed-path invariant.
 *
 * The single most security-relevant invariant of WS2: when the signed
 * playback path is selected, a raw third-party embed URL MUST NOT flow
 * back to the client. This test enumerates every combination where a
 * source_url is present on the game row AND native_hls is selected,
 * and asserts embedUrl is absent.
 *
 * If this test fails, STREAM_GATING_v1.6.0.md is violated and the
 * signed-playback feature must be reverted.
 */
import { describe, expect, it } from 'vitest';
import { selectPlaybackProvider } from '@/lib/playback/selectProvider';

const SECRET = 'contract-test-secret-entropy-ok-12345';
const ORIGIN = 'https://sbbl-hq.icu';

const resolveArgs = {
  gameId: 'g-1',
  userId: 'u-1',
  sessionId: 's-1',
  expiresAt: new Date(Date.now() + 70_000).toISOString(),
  maxExpiresAt: new Date(Date.now() + 21600_000).toISOString(),
};

describe('signed-path contract', () => {
  for (const sourceUrl of [
    'https://www.youtube.com/embed/malicious',
    'https://facebook.com/fb.watch/xyz',
    'https://evil.example/direct.m3u8',
    null,
    undefined,
  ]) {
    it(`never returns embedUrl when native_hls is selected (source_url=${String(sourceUrl)})`, async () => {
      const provider = selectPlaybackProvider({
        game: {
          require_signed_url: true,
          playback_provider: 'native_hls',
          playback_asset_id: 'asset-secure-1',
        },
        flags: {
          FEATURE_SIGNED_PLAYBACK_ENABLED: 'true',
          FEATURE_NATIVE_HLS_PROVIDER: 'true',
        },
        playbackTokenSecret: SECRET,
        workerOrigin: ORIGIN,
      });
      expect(provider.name).toBe('native_hls');
      const payload = await provider.resolve({
        ...resolveArgs,
        mode: 'live',
        game: {
          id: 'g-1',
          source_url: sourceUrl,
          playback_asset_id: 'asset-secure-1',
          require_signed_url: true,
        },
      });
      expect(payload.embedUrl).toBeUndefined();
      expect(payload.signedPlaybackUrl).toBeDefined();
      if (sourceUrl != null) {
        expect(payload.signedPlaybackUrl).not.toContain(String(sourceUrl));
      }
      // Signed URL must point back to our origin, never at the
      // third-party source domain.
      if (typeof sourceUrl === 'string') {
        const sourceHost = new URL(sourceUrl).host;
        expect(new URL(payload.signedPlaybackUrl!).host).not.toBe(sourceHost);
      }
    });
  }

  it('legacy_embed DOES emit embedUrl (baseline — confirms we are testing the distinction)', async () => {
    const provider = selectPlaybackProvider({
      game: {
        require_signed_url: false,
        playback_provider: 'legacy_embed',
      },
      flags: {},
      workerOrigin: ORIGIN,
    });
    expect(provider.name).toBe('legacy_embed');
    const payload = await provider.resolve({
      ...resolveArgs,
      mode: 'live',
      game: { id: 'g-1', source_url: 'https://youtube.com/embed/ok' },
    });
    expect(payload.embedUrl).toBe('https://youtube.com/embed/ok');
    expect(payload.signedPlaybackUrl).toBeUndefined();
  });
});
