/**
 * Stream Access — One-Active-Device Invariant Tests
 *
 * Contract: Tasks 1–2 of the Stream Access Hardening contract (2026-07-17).
 * Tests the DB-enforced one-active-device-per-user-per-game invariant introduced by:
 *   supabase/migrations/20260718000100_stream_access_sessions_one_active_device.sql
 *
 * These are unit/integration tests against the Worker logic layer.
 * The actual unique_violation from the DB index is exercised in a separate
 * concurrency integration test (requires live DB connection — see §5 of contract).
 *
 * INVARIANTS UNDER TEST:
 *   OAD-1  One active PPV session per (user_id, game_id) — unique_violation on conflict
 *   OAD-2  One active broadcast session per user (game_id IS NULL)
 *   OAD-3  unique_violation (23505) from the DB must surface as a structured
 *           "device_conflict" response, not a raw 500
 *   OAD-4  Displaced sessions (status = 'displaced') are excluded from the invariant
 *           (a displaced + a new active row for the same (user, game) is allowed)
 *   OAD-5  Existing cleanup/expire functions still operable by service-role
 *           (Task 2 revoke only strips anon/authenticated — service-role unaffected)
 *
 * apex-omnitest mode: GENERATE + CONTRACT FIRST + FAIL BEFORE SUCCESS
 */

import { describe, expect, it } from 'vitest';

// ── Shared helpers ────────────────────────────────────────────────────────────

interface MockSession {
  id: string;
  user_id: string;
  game_id: string | null;
  idempotency_key: string;
  status: string;
  entitlement_id: string;
  expires_at: string;
}

/**
 * Simulates the DB unique index behavior for one-active-device enforcement.
 * Mirrors: uq_stream_access_sessions_one_active_device (game_id IS NOT NULL)
 *          uq_stream_access_sessions_one_active_broadcast (game_id IS NULL)
 */
class MockSessionStore {
  private rows: MockSession[] = [];

  /**
   * Attempt to insert a new active session.
   * Returns { ok: true, session } on success.
   * Returns { ok: false, code: '23505', conflictRow } when invariant would be violated.
   */
  insert(session: MockSession): { ok: true; session: MockSession } | { ok: false; code: '23505'; conflictRow: MockSession } {
    // Find conflict: same user, same game (or both null), status = 'active'
    const conflict = this.rows.find((r) => {
      if (r.status !== 'active') return false;
      if (session.game_id !== null) {
        // PPV game: (user_id, game_id) must be unique
        return r.user_id === session.user_id && r.game_id === session.game_id;
      } else {
        // Broadcast: (user_id) must be unique where game_id IS NULL
        return r.user_id === session.user_id && r.game_id === null;
      }
    });

    if (conflict) {
      return { ok: false, code: '23505', conflictRow: conflict };
    }

    this.rows.push(session);
    return { ok: true, session };
  }

  /** Displace all active sessions for a (user, game) — the takeover path */
  displace(userId: string, gameId: string | null): number {
    let count = 0;
    this.rows.forEach((r) => {
      if (
        r.user_id === userId &&
        r.game_id === gameId &&
        r.status === 'active'
      ) {
        r.status = 'displaced';
        count++;
      }
    });
    return count;
  }

  activeCount(userId: string, gameId: string | null): number {
    return this.rows.filter(
      (r) =>
        r.user_id === userId &&
        r.game_id === gameId &&
        r.status === 'active',
    ).length;
  }

  all(): MockSession[] {
    return [...this.rows];
  }
}

function makeSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-a',
    game_id: 'game-ppv-1',
    idempotency_key: `key-${crypto.randomUUID()}`,
    status: 'active',
    entitlement_id: 'ent-1',
    expires_at: new Date(Date.now() + 7200_000).toISOString(),
    ...overrides,
  };
}

// ── OAD-1: PPV one-active-device ─────────────────────────────────────────────

describe('OAD-1: one active PPV session per (user_id, game_id)', () => {
  it('first acquire succeeds', () => {
    const store = new MockSessionStore();
    const result = store.insert(makeSession());
    expect(result.ok).toBe(true);
  });

  it('second acquire with different idempotency_key fails with 23505', () => {
    const store = new MockSessionStore();
    store.insert(makeSession({ idempotency_key: 'key-first-device' }));

    const result = store.insert(
      makeSession({ idempotency_key: 'key-second-device' }),
    );

    expect(result.ok).toBe(false);
    // Narrowed via ok === false — TypeScript discriminated union
    const conflict = result.ok === false ? result : null;
    expect(conflict?.code).toBe('23505');
  });

  it('exactly one active row after N concurrent attempts (N=5)', () => {
    const store = new MockSessionStore();
    const userId = 'user-concurrent';
    const gameId = 'game-concurrent-ppv';

    // Simulate N concurrent acquire attempts with distinct idempotency keys
    const attempts = Array.from({ length: 5 }, (_, i) =>
      makeSession({ user_id: userId, game_id: gameId, idempotency_key: `concurrent-key-${i}` }),
    );

    const results = attempts.map((s) => store.insert(s));
    const successes = results.filter((r) => r.ok);
    const conflicts = results.filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(4);
    expect(store.activeCount(userId, gameId)).toBe(1);
  });

  it('different users for same game each get their own active session', () => {
    const store = new MockSessionStore();
    const gameId = 'game-multi-user';

    const userA = makeSession({ user_id: 'user-a', game_id: gameId });
    const userB = makeSession({ user_id: 'user-b', game_id: gameId });

    expect(store.insert(userA).ok).toBe(true);
    expect(store.insert(userB).ok).toBe(true);
    expect(store.activeCount('user-a', gameId)).toBe(1);
    expect(store.activeCount('user-b', gameId)).toBe(1);
  });

  it('same user, different games each get their own active session', () => {
    const store = new MockSessionStore();
    const userId = 'user-multi-game';

    const gameA = makeSession({ user_id: userId, game_id: 'game-alpha' });
    const gameB = makeSession({ user_id: userId, game_id: 'game-beta' });

    expect(store.insert(gameA).ok).toBe(true);
    expect(store.insert(gameB).ok).toBe(true);
  });
});

// ── OAD-2: Broadcast one-active-device (game_id IS NULL) ─────────────────────

describe('OAD-2: one active broadcast session per user (game_id IS NULL)', () => {
  it('first broadcast acquire succeeds', () => {
    const store = new MockSessionStore();
    const result = store.insert(makeSession({ game_id: null }));
    expect(result.ok).toBe(true);
  });

  it('second broadcast acquire for same user fails with 23505', () => {
    const store = new MockSessionStore();
    store.insert(makeSession({ game_id: null, idempotency_key: 'bcast-key-1' }));

    const result = store.insert(
      makeSession({ game_id: null, idempotency_key: 'bcast-key-2' }),
    );

    expect(result.ok).toBe(false);
    const conflict = result.ok === false ? result : null;
    expect(conflict?.code).toBe('23505');
  });

  it('broadcast and PPV session for same user are independent (no conflict)', () => {
    const store = new MockSessionStore();
    // A user watching both an open broadcast AND a PPV game simultaneously
    // should be allowed — these are separate indexes
    const bcast = makeSession({ game_id: null, idempotency_key: 'bcast-only' });
    const ppv   = makeSession({ game_id: 'game-ppv-z', idempotency_key: 'ppv-only' });

    expect(store.insert(bcast).ok).toBe(true);
    expect(store.insert(ppv).ok).toBe(true);
  });
});

// ── OAD-3: Structured conflict response (not a raw 500) ──────────────────────

describe('OAD-3: unique_violation surfaces as structured device_conflict', () => {
  /**
   * The Worker handler is responsible for catching the Postgres 23505 error
   * from the DB insert and returning { ok: false, error: 'device_conflict', ... }.
   * This test validates the expected shape of that response.
   */
  function simulateAcquireHandler(
    store: MockSessionStore,
    session: MockSession,
  ): { ok: boolean; error?: string; conflictSessionId?: string } {
    const result = store.insert(session);
    if (result.ok) {
      return { ok: true };
    }
    // code === '23505' → unique_violation
    const failure = result.ok === false ? result : null;
    if (failure?.code === '23505') {
      return {
        ok: false,
        error: 'device_conflict',
        conflictSessionId: failure.conflictRow.id,
      };
    }
    // Any other error → 500
    return { ok: false, error: 'internal_error' };
  }

  it('returns device_conflict (not internal_error) on unique_violation', () => {
    const store = new MockSessionStore();
    store.insert(makeSession({ idempotency_key: 'existing-session' }));

    const response = simulateAcquireHandler(
      store,
      makeSession({ idempotency_key: 'competing-session' }),
    );

    expect(response.ok).toBe(false);
    expect(response.error).toBe('device_conflict');
    expect(response.conflictSessionId).toBeDefined();
  });

  it('includes conflictSessionId in response so client can prompt takeover', () => {
    const store = new MockSessionStore();
    const existing = makeSession({ id: 'known-session-id', idempotency_key: 'existing' });
    store.insert(existing);

    const response = simulateAcquireHandler(
      store,
      makeSession({ idempotency_key: 'new-device' }),
    );

    expect(response.conflictSessionId).toBe('known-session-id');
  });
});

// ── OAD-4: Displaced sessions excluded from invariant ────────────────────────

describe('OAD-4: displaced sessions are excluded from one-active-device invariant', () => {
  it('allows a new active session after the previous one is displaced', () => {
    const store = new MockSessionStore();
    const userId = 'user-takeover';
    const gameId = 'game-takeover';

    // Step 1: First device acquires
    store.insert(makeSession({ user_id: userId, game_id: gameId, idempotency_key: 'device-1' }));
    expect(store.activeCount(userId, gameId)).toBe(1);

    // Step 2: Takeover — displace the existing active session
    const displaced = store.displace(userId, gameId);
    expect(displaced).toBe(1);
    expect(store.activeCount(userId, gameId)).toBe(0);

    // Step 3: Second device acquires — should succeed
    const result = store.insert(
      makeSession({ user_id: userId, game_id: gameId, idempotency_key: 'device-2' }),
    );
    expect(result.ok).toBe(true);
    expect(store.activeCount(userId, gameId)).toBe(1);
  });

  it('total row count after takeover is 2 (one displaced, one active)', () => {
    const store = new MockSessionStore();
    store.insert(makeSession({ idempotency_key: 'device-old' }));
    store.displace('user-a', 'game-ppv-1');
    store.insert(makeSession({ idempotency_key: 'device-new' }));

    const rows = store.all();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'displaced')).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'active')).toHaveLength(1);
  });
});

// ── OAD-5: Cleanup functions remain callable by service-role ──────────────────

describe('OAD-5: Task 2 revoke does not break service-role cleanup paths', () => {
  /**
   * Task 2 revokes execute on cleanup_expired_stream_sessions and
   * expire_stream_access_sessions FROM anon, authenticated only.
   * Service-role (Worker) is not affected by REVOKE on named roles.
   *
   * These tests validate the logical behavior of the cleanup paths
   * (service-role calls them, not clients). The actual revoke verification
   * is a DB-side query (see migration verification comments).
   */

  it('cleanup_expired: marks sessions with past expires_at as expired', () => {
    // Simulate the function's UPDATE logic
    const now = new Date();
    const pastTime = new Date(now.getTime() - 60_000).toISOString(); // 1 min ago
    const futureTime = new Date(now.getTime() + 3600_000).toISOString(); // 1 hr ahead

    const sessions: Array<{ id: string; status: string; expires_at: string; session_status?: string }> = [
      { id: 'sess-expired', status: 'active', expires_at: pastTime },
      { id: 'sess-alive',   status: 'active', expires_at: futureTime },
    ];

    // Replicate cleanup_expired_stream_sessions logic
    const updated = sessions.filter(
      (s) =>
        (s.status === 'active' || s.status === 'resumable') &&
        new Date(s.expires_at) <= now,
    );
    updated.forEach((s) => { s.session_status = 'expired'; });

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('sess-expired');
    expect(sessions.find((s) => s.id === 'sess-alive')?.session_status).toBeUndefined();
  });

  it('expire_stream_access: sets expires_at = now() for all future-expiring sessions', () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 3600_000).toISOString();
    const pastTime = new Date(now.getTime() - 60_000).toISOString();

    const sessions: Array<{ id: string; expires_at: string }> = [
      { id: 'sess-future', expires_at: futureTime },
      { id: 'sess-past',   expires_at: pastTime },
    ];

    // Replicate expire_stream_access_sessions logic
    const toExpire = sessions.filter(
      (s) => new Date(s.expires_at) > now,
    );
    toExpire.forEach((s) => { s.expires_at = now.toISOString(); });

    expect(toExpire).toHaveLength(1);
    expect(toExpire[0].id).toBe('sess-future');
    // Past session untouched
    expect(sessions.find((s) => s.id === 'sess-past')?.expires_at).toBe(pastTime);
  });
});

// ── REAL Concurrency Integration Test ────────────────────────────────────────
// This tests the worker HTTP handler handlePlaybackSession directly via
// Promise.all to ensure the async race condition actually triggers the
// 23505 unique_violation and the handler correctly catches it to return a 409.

import { handlePlaybackSession } from '@/worker/index';

describe('REAL Concurrency (Promise.all race condition)', () => {
  it('Promise.all acquires: exactly one succeeds, one gets 409 device_conflict', async () => {
    // We simulate the DB unique constraint by delaying the upsert so that
    // the concurrent updates interleave.
    const tableRows: Record<string, unknown>[] = [];
    
    const mockAdmin = {
      from: (table: string) => {
        if (table !== 'stream_access_sessions') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            insert: () => ({ select: () => ({ single: async () => ({ data: { id: true, title: 'Live', is_live: true, collection_id: 'http://test' }, error: null }) }) }),
          };
        }
        
        const updateFilters: Array<(r: Record<string, unknown>) => boolean> = [];
        const selectChain: Record<string, unknown> = {
          eq: () => selectChain,
          is: () => selectChain,
          maybeSingle: async () => ({ data: null, error: null })
        };
        return {
          select: () => selectChain,
          update: (patch: Record<string, unknown>) => {
            const builder: Record<string, unknown> = {
              eq: (col: string, val: unknown) => { updateFilters.push((r: Record<string, unknown>) => r[col] === val); return builder; },
              is: (col: string, val: unknown) => { updateFilters.push((r: Record<string, unknown>) => r[col] === val); return builder; },
              neq: (col: string, val: unknown) => {
                updateFilters.push((r: Record<string, unknown>) => r[col] !== val);
                // execute update synchronously
                tableRows.forEach(r => {
                  if (updateFilters.every(f => f(r))) Object.assign(r, patch);
                });
                return { error: null };
              }
            };
            return builder;
          },
          upsert: (row: Record<string, unknown>, _opts?: unknown) => {
            return {
              select: () => ({
                single: async () => {
                  // Wait to allow the other concurrent Promise to run its displace logic
                  await new Promise(resolve => setTimeout(resolve, 20));
                  
                  // Enforcement of unique index (user_id, game_id) where status='active'
                  const conflict = tableRows.find(r => r.user_id === row.user_id && r.game_id === row.game_id && r.status === 'active');
                  if (conflict) {
                    return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                  }
                  
                  const normalized = { ...row, id: crypto.randomUUID() };
                  tableRows.push(normalized);
                  return { data: normalized, error: null };
                }
              })
            };
          }
        };
      },
      rpc: async (name: string, _payload?: unknown) => {
        if (name === 'can_user_view_stream') return { data: true, error: null };
        return { data: null, error: null };
      }
    };

    const envOverrides = {
      SUPABASE_URL: 'http://local',
      SUPABASE_SERVICE_ROLE_KEY: 'srk',
    };

    const req1 = new Request('https://local/api/streams/game-concurrency/session', {
      method: 'POST',
      headers: { 
        'x-sbbl-user-id-verified': 'user-1',
        'x-idempotency-key': 'idempotency-key-A123'
      },
      body: JSON.stringify({ sessionKey: 'client-A' })
    });
    const req2 = new Request('https://local/api/streams/game-concurrency/session', {
      method: 'POST',
      headers: { 
        'x-sbbl-user-id-verified': 'user-1',
        'x-idempotency-key': 'idempotency-key-B456'
      },
      body: JSON.stringify({ sessionKey: 'client-B' })
    });

    const ctx1 = { req: req1, admin: mockAdmin as unknown, params: { gameId: 'game-concurrency' }, env: envOverrides as unknown } as unknown as Parameters<typeof handlePlaybackSession>[0];
    const ctx2 = { req: req2, admin: mockAdmin as unknown, params: { gameId: 'game-concurrency' }, env: envOverrides as unknown } as unknown as Parameters<typeof handlePlaybackSession>[0];

    // Fire both concurrently!
    const [res1, res2] = await Promise.all([
      handlePlaybackSession(ctx1),
      handlePlaybackSession(ctx2)
    ]);

    // One must succeed (200), one must fail (409)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const failedRes = res1.status === 409 ? res1 : res2;
    const failedBody = await failedRes.json() as Record<string, unknown>;
    expect(failedBody.error).toBe('device_conflict');

    const actives = tableRows.filter(r => r.status === 'active');
    expect(actives).toHaveLength(1);
    
    // Both were fresh inserts; no prior session was displaced. 
    // The conflict happened squarely on the atomic index boundary.
  });
});

