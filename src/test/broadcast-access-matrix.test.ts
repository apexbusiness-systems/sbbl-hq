import { describe, expect, it } from 'vitest';
import { handleBroadcastSessionStart, handlePlaybackSession } from '@/worker/index';
import { authedRequest, baseState, createAdmin, testEnv, type TestState } from './broadcast-test-utils';

const gameId = '11111111-1111-4111-8111-111111111111';
const wrongGameId = '22222222-2222-4222-8222-222222222222';
const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

function withUser(state: TestState, userId: string, role = 'fan', onboarded = true) {
  state.user_role_assignments.push({ user_id: userId, role });
  if (onboarded) state.profiles.push({ user_id: userId, onboarding_completed_at: new Date().toISOString() });
  return state;
}

async function startBroadcast(state: TestState, userId: string, sessionKey = `session-${userId}`) {
  return handleBroadcastSessionStart({ req: authedRequest('/api/broadcast/session', userId, { sessionKey }), env: testEnv, params: {}, admin: createAdmin(state) } as any);
}

async function startPpv(state: TestState, userId: string, sessionKey = `session-${userId}`) {
  return handlePlaybackSession({ req: authedRequest(`/api/streams/${gameId}/session`, userId, { sessionKey }), env: testEnv, params: { gameId }, admin: createAdmin(state) } as any);
}

describe('broadcast access matrix — open broadcast', () => {
  it('super_admin gets session', async () => {
    const res = await startBroadcast(withUser(baseState(), 'super', 'super_admin', false), 'super');
    expect(res.status).toBe(200);
  });

  it('player gets session when onboarded', async () => {
    const res = await startBroadcast(withUser(baseState(), 'player', 'player'), 'player');
    expect(res.status).toBe(200);
  });

  it('fan with onboarding_completed_at gets session', async () => {
    const res = await startBroadcast(withUser(baseState(), 'fan', 'fan'), 'fan');
    expect(res.status).toBe(200);
  });

  it('paid_fan gets session', async () => {
    const res = await startBroadcast(withUser(baseState(), 'paid', 'paid_fan'), 'paid');
    expect(res.status).toBe(200);
  });

  it('fan without onboarding_completed_at is denied', async () => {
    const state = baseState({ profiles: [{ user_id: 'fan', onboarding_completed_at: null }], user_role_assignments: [{ user_id: 'fan', role: 'fan' }] });
    expect((await startBroadcast(state, 'fan')).status).toBe(403);
  });

  it('user with no profile row is denied', async () => {
    const state = baseState({ user_role_assignments: [{ user_id: 'fan', role: 'fan' }] });
    expect((await startBroadcast(state, 'fan')).status).toBe(403);
  });

  it('anonymous users are denied', async () => {
    await expect(handleBroadcastSessionStart({ req: new Request('https://worker.test/api/broadcast/session', { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': 'anon-key-12345678' }, body: JSON.stringify({ sessionKey: 'anon-session' }) }), env: testEnv, params: {}, admin: createAdmin(baseState()) } as any)).rejects.toThrow('unauthorized');
  });

  it('offline stream does not grant live session', async () => {
    const state = withUser(baseState({ stream_admin_config: [{ id: true, collection_id: 'https://cdn.example.com/live.m3u8', is_live: false }] }), 'fan', 'fan');
    expect((await startBroadcast(state, 'fan')).status).toBe(403);
  });

  it('missing or short sessionKey returns 400', async () => {
    const state = withUser(baseState(), 'fan', 'fan');
    const missing = await handleBroadcastSessionStart({ req: authedRequest('/api/broadcast/session', 'fan', {}), env: testEnv, params: {}, admin: createAdmin(state) } as any);
    const short = await handleBroadcastSessionStart({ req: authedRequest('/api/broadcast/session', 'fan', { sessionKey: 'short' }), env: testEnv, params: {}, admin: createAdmin(state) } as any);
    expect([missing.status, short.status]).toEqual([400, 400]);
  });
});

describe('broadcast access matrix — PPV game', () => {
  function ppvState() {
    return baseState({ stream_admin_config: [{ id: true, collection_id: 'https://cdn.example.com/live/main.m3u8', title: 'PPV', is_live: true, active_game_id: gameId }], games: [{ id: gameId }] });
  }

  it('fan with active entitlement for correct game gets session', async () => {
    const state = withUser(ppvState(), 'fan', 'fan');
    state.stream_entitlements.push({ user_id: 'fan', game_id: gameId, status: 'active', expires_at: future() });
    expect((await startPpv(state, 'fan')).status).toBe(200);
  });

  it('fan without entitlement is denied', async () => {
    const state = withUser(ppvState(), 'fan', 'fan');
    expect((await startPpv(state, 'fan')).status).toBe(403);
  });

  it('fan with entitlement for wrong game is denied', async () => {
    const state = withUser(ppvState(), 'fan', 'fan');
    state.stream_entitlements.push({ user_id: 'fan', game_id: wrongGameId, status: 'active', expires_at: future() });
    expect((await startPpv(state, 'fan')).status).toBe(403);
  });

  it('expired entitlement is denied', async () => {
    const state = withUser(ppvState(), 'fan', 'fan');
    state.stream_entitlements.push({ user_id: 'fan', game_id: gameId, status: 'active', expires_at: past() });
    expect((await startPpv(state, 'fan')).status).toBe(403);
  });

  it('super_admin bypasses PPV gate', async () => {
    expect((await startPpv(withUser(ppvState(), 'super', 'super_admin'), 'super')).status).toBe(200);
  });

  it('player role gets access', async () => {
    expect((await startPpv(withUser(ppvState(), 'player', 'player'), 'player')).status).toBe(200);
  });

  it('paid_fan role gets access per worker privileged-role logic', async () => {
    expect((await startPpv(withUser(ppvState(), 'paid', 'paid_fan'), 'paid')).status).toBe(200);
  });
});

describe('broadcast access matrix — idempotency', () => {
  it('50 concurrent identical session requests create no duplicate logical sessions', async () => {
    const state = withUser(baseState(), 'fan', 'fan');
    const requests = Array.from({ length: 50 }, () => startBroadcast(state, 'fan', 'same-session-key'));
    const responses = await Promise.all(requests);
    expect(responses.every((res) => res.status === 200)).toBe(true);
    const logical = state.stream_access_sessions.filter((row) => row.user_id === 'fan' && row.game_id == null && row.idempotency_key === 'same-session-key');
    expect(logical).toHaveLength(1);
  });
});
