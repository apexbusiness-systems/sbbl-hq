import { describe, expect, it, beforeEach } from 'vitest';
import {
  canonicalizeStreamSourceUrl,
  detectStreamUrlType,
  getStreamDeliveryClass,
  getStreamTypeAdvisory,
  toPlayableUrl,
} from '@/lib/stream/url-detector';
import { ENTITLEMENT } from '@/lib/constants/ENTITLEMENT_CONSTANTS';
import { handleGoLive, handleInviteGenerate } from '@/worker/index';
import { authedRequest, baseState, createAdmin, testEnv } from './broadcast-test-utils';

type Scenario = {
  name: string;
  url: string;
  type: ReturnType<typeof detectStreamUrlType>;
  delivery: ReturnType<typeof getStreamDeliveryClass>;
  canonicalOk?: boolean;
  playableIncludes?: string;
  warning?: boolean;
};

const scenarios: Scenario[] = [
  { name: 'SBBL WHEP endpoint', url: 'https://stream.sbbl-hq.icu/whep/broadcast', type: 'whep', delivery: 'proxy' },
  { name: 'SBBL HLS manifest', url: 'https://stream.sbbl-hq.icu/live/main.m3u8', type: 'hls', delivery: 'proxy' },
  { name: 'Generic HLS with query token', url: 'https://cdn.example.com/live/main.m3u8?token=abc', type: 'hls', delivery: 'proxy' },
  { name: 'DASH manifest', url: 'https://cdn.example.com/live/manifest.mpd', type: 'dash', delivery: 'proxy' },
  { name: 'YouTube watch URL', url: 'https://www.youtube.com/watch?v=BjcQrDA9koY', type: 'youtube', delivery: 'embed', playableIncludes: 'youtube' },
  { name: 'YouTube live/short URL', url: 'https://youtube.com/live/BjcQrDA9koY?feature=share', type: 'youtube', delivery: 'embed', playableIncludes: 'youtube' },
  { name: 'Twitch channel URL', url: 'https://www.twitch.tv/sbblhq', type: 'twitch', delivery: 'embed', playableIncludes: 'twitch.tv/sbblhq' },
  { name: 'Facebook plugin video URL', url: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Ffacebook.com%2Fwatch%2F%3Fv%3D123', type: 'facebook', delivery: 'embed', canonicalOk: false, warning: true },
  { name: 'fb.watch shortlink', url: 'https://fb.watch/abcdef/', type: 'facebook', delivery: 'embed', warning: true },
  { name: 'Vimeo event/embed URL', url: 'https://player.vimeo.com/video/123456789', type: 'vimeo', delivery: 'embed', playableIncludes: 'player.vimeo.com' },
  { name: 'Rumble embed URL', url: 'https://rumble.com/embed/vabc123/?pub=4', type: 'rumble', delivery: 'unsupported' },
  { name: 'Direct MP4', url: 'https://cdn.example.com/video/final.mp4?sig=1', type: 'mp4', delivery: 'proxy' },
  { name: 'RTMP warning or rejection', url: 'rtmp://ingest.example.com/live/key', type: 'rtmp', delivery: 'unsupported', warning: true },
  { name: 'Kick unsupported', url: 'https://kick.com/sbblhq', type: 'kick', delivery: 'unsupported' },
  { name: 'Instagram unsupported', url: 'https://instagram.com/sbblhq/live/', type: 'instagram', delivery: 'unsupported' },
  { name: 'Empty string', url: '', type: 'unknown', delivery: 'unsupported', canonicalOk: false },
  { name: 'javascript: protocol', url: 'javascript:alert(1)', type: 'unknown', delivery: 'unsupported' },
  { name: 'data: URI', url: 'data:text/html,<svg onload=alert(1)>', type: 'unknown', delivery: 'unsupported' },
];

describe('broadcast ingest URL classification', () => {
  for (const scenario of scenarios) {
    it(`classifies ${scenario.name}`, () => {
      expect(detectStreamUrlType(scenario.url)).toBe(scenario.type);
      expect(getStreamDeliveryClass(scenario.url)).toBe(scenario.delivery);
      expect(getStreamTypeAdvisory(scenario.type).level).toMatch(/ok|info|warn/);
      const canonical = canonicalizeStreamSourceUrl(scenario.url);
      if (scenario.canonicalOk === false || !scenario.url.trim()) {
        expect(canonical.ok).toBe(false);
      } else {
        // Repo truth: canonicalizeStreamSourceUrl validates parseability/platform
        // normalization, while Go-Live sanitizes dangerous protocols before save.
        expect(canonical.ok).toBe(true);
      }
      const playable = toPlayableUrl(scenario.url);
      expect(playable.type).toBe(scenario.type);
      if (scenario.playableIncludes) expect(playable.url).toContain(scenario.playableIncludes);
      if (scenario.warning) expect(playable.warning).toBeTruthy();
    });
  }
});

describe('broadcast Go-Live handler', () => {
  beforeEach(() => {
    (globalThis as any).caches = { default: { delete: async () => true } };
  });

  function stateWithAdmin() {
    return baseState({ user_role_assignments: [{ user_id: 'admin', role: 'super_admin' }] });
  }

  it('valid YouTube URL + title returns 200', async () => {
    const state = stateWithAdmin();
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: true, collectionId: 'https://youtube.com/watch?v=BjcQrDA9koY', title: 'Finals' }), env: testEnv, params: {}, admin: createAdmin(state) } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toMatchObject({ ok: true, isLive: true, title: 'Finals' });
  });

  it('missing isLive returns 400', async () => {
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { collectionId: 'https://youtube.com/watch?v=BjcQrDA9koY' }), env: testEnv, params: {}, admin: createAdmin(stateWithAdmin()) } as any);
    expect(res.status).toBe(400);
  });

  it('non-boolean isLive returns 400', async () => {
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: 'true' }), env: testEnv, params: {}, admin: createAdmin(stateWithAdmin()) } as any);
    expect(res.status).toBe(400);
  });

  it('invalid activeGameId returns 400', async () => {
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: true, activeGameId: 'game-1' }), env: testEnv, params: {}, admin: createAdmin(stateWithAdmin()) } as any);
    expect(res.status).toBe(400);
  });

  it('null activeGameId is accepted for open broadcast', async () => {
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: true, activeGameId: null }), env: testEnv, params: {}, admin: createAdmin(stateWithAdmin()) } as any);
    expect(res.status).toBe(200);
    expect((await res.json() as any).activeGameId).toBeNull();
  });

  it('valid UUID activeGameId is accepted for PPV broadcast', async () => {
    const gameId = '11111111-1111-4111-8111-111111111111';
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: true, activeGameId: gameId }), env: testEnv, params: {}, admin: createAdmin(stateWithAdmin()) } as any);
    expect(res.status).toBe(200);
    expect((await res.json() as any).activeGameId).toBe(gameId);
  });

  it('isLive false transitions offline', async () => {
    const state = stateWithAdmin();
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: false }), env: testEnv, params: {}, admin: createAdmin(state) } as any);
    expect(res.status).toBe(200);
    expect(state.stream_admin_config[0].is_live).toBe(false);
    expect(state.stream_admin_config[0].live_ended_at).toBeTruthy();
  });

  it('dangerous collectionId is sanitized', async () => {
    const state = stateWithAdmin();
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: true, collectionId: 'javascript:alert(1)' }), env: testEnv, params: {}, admin: createAdmin(state) } as any);
    expect(res.status).toBe(200);
    expect((await res.json() as any).collectionId).toBe('');
  });

  it('Supabase upsert error returns 500', async () => {
    const res = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', { isLive: true }), env: testEnv, params: {}, admin: createAdmin(stateWithAdmin(), { upsertErrorTable: 'stream_admin_config' }) } as any);
    expect(res.status).toBe(500);
  });

  it('identical repeated Go-Live calls are idempotent at config row level', async () => {
    const state = stateWithAdmin();
    const body = { isLive: true, collectionId: 'https://cdn.example.com/live.m3u8', title: 'Repeat' };
    const admin = createAdmin(state);
    const first = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', body), env: testEnv, params: {}, admin } as any);
    const second = await handleGoLive({ req: authedRequest('/ops/streams/go-live', 'admin', body), env: testEnv, params: {}, admin } as any);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(state.stream_admin_config).toHaveLength(1);
    expect(state.stream_admin_config[0].collection_id).toBe(body.collectionId);
  });
});

describe('comp code generation handler', () => {
  it('super_admin can generate comp code with canonical validity window', async () => {
    const gameId = '11111111-1111-4111-8111-111111111111';
    const state = baseState({ user_role_assignments: [{ user_id: 'admin', role: 'super_admin' }], games: [{ id: gameId }] });
    const res = await handleInviteGenerate({ req: authedRequest('/api/invite/generate', 'admin', { gameId }), env: testEnv, params: {}, admin: createAdmin(state) } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.code).toMatch(/^[0-9a-f-]{36}$/i);
    expect(ENTITLEMENT.MANUAL_COMP_VALIDITY_HOURS).toBe(48);
  });

  it('non-super_admin without eligible role is denied', async () => {
    const res = await handleInviteGenerate({ req: authedRequest('/api/invite/generate', 'fan', { gameId: '11111111-1111-4111-8111-111111111111' }), env: testEnv, params: {}, admin: createAdmin(baseState({ user_role_assignments: [{ user_id: 'fan', role: 'fan' }] })) } as any);
    expect(res.status).toBe(403);
  });
});
