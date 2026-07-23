/**
 * Roster Image Ingest — regression coverage.
 *
 * Root cause (2026-07-23 execution contract): no image → roster ingestion path
 * existed anywhere in the codebase. Scoreboard/event parsers wrote nowhere;
 * the single-player POTG parser could create at most one player and never a
 * team (team resolution there is lookup-only). This suite covers the new
 * /ops/roster/parse-image (Groq vision, parse-only) and /ops/roster/import
 * (team find-or-create + N-player provisioning) routes.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { handleParseRosterImage } from '@/worker/index';
import { handleRosterImport } from '@/worker/routes/ops-upload';
import { createAdmin, type Row } from './broadcast-test-utils';

const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');

const ADMIN_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const LEAGUE_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const SEASON_ID = 'cccccccc-3333-4333-8333-333333333333';

function mkCtx(options: {
  url: string;
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  admin: ReturnType<typeof createAdmin>;
  env?: Record<string, string>;
}) {
  const init: RequestInit = { method: options.method ?? 'GET' };
  const headers = {
    'x-idempotency-key': 'idempotency-key-long-enough-12345',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'content-type': 'application/json', ...headers };
  } else {
    init.headers = headers;
  }
  return {
    req: new Request(options.url, init),
    admin: options.admin,
    params: options.params ?? {},
    env: (options.env ?? {}) as unknown as Env,
  };
}

// ── Route registration ───────────────────────────────────────────────────────
describe('roster ingest route registration', () => {
  it('registers POST /ops/roster/parse-image', () => {
    expect(workerSrc).toContain('"/ops/roster/parse-image"');
    expect(workerSrc).toContain('handleParseRosterImage');
  });

  it('registers POST /ops/roster/import', () => {
    expect(workerSrc).toContain('"/ops/roster/import"');
  });
});

// ── /ops/roster/parse-image ──────────────────────────────────────────────────
describe('handleParseRosterImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('401s unauthenticated callers', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/parse-image',
      method: 'POST',
      body: { imageBase64: 'aGVsbG8=', mimeType: 'image/png' },
      admin: createAdmin({ user_role_assignments: [] }),
      env: { GROQ_API_KEY: 'test-key' },
    });
    await expect(handleParseRosterImage(ctx)).rejects.toThrow(/unauthorized/);
  });

  it('403s callers without an admin role', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/parse-image',
      method: 'POST',
      body: { imageBase64: 'aGVsbG8=', mimeType: 'image/png' },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin({ user_role_assignments: [{ user_id: ADMIN_ID, role: 'fan' }] }),
      env: { GROQ_API_KEY: 'test-key' },
    });
    await expect(handleParseRosterImage(ctx)).rejects.toThrow(/forbidden/);
  });

  it('503s when GROQ_API_KEY is missing', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/parse-image',
      method: 'POST',
      body: { imageBase64: 'aGVsbG8=', mimeType: 'image/png' },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin({ user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }] }),
    });
    const res = await handleParseRosterImage(ctx);
    expect(res.status).toBe(503);
  });

  it('parses a well-formed { teamName, players[] } response from Groq', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"teamName":"Ball is Life","players":[{"name":"Jaime Phillips","jerseyNumber":23,"position":"G"}]}' } }],
    }), { status: 200 })));

    const ctx = mkCtx({
      url: 'https://local/ops/roster/parse-image',
      method: 'POST',
      body: { imageBase64: 'aGVsbG8=', mimeType: 'image/png' },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin({ user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }] }),
      env: { GROQ_API_KEY: 'test-key' },
    });
    const res = await handleParseRosterImage(ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { teamName: string; players: Array<{ name: string }> } };
    expect(body.ok).toBe(true);
    expect(body.data.teamName).toBe('Ball is Life');
    expect(body.data.players).toEqual([{ name: 'Jaime Phillips', jerseyNumber: 23, position: 'G' }]);
  });

  it('422s when the model reply cannot be parsed as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'not json at all' } }],
    }), { status: 200 })));

    const ctx = mkCtx({
      url: 'https://local/ops/roster/parse-image',
      method: 'POST',
      body: { imageBase64: 'aGVsbG8=', mimeType: 'image/png' },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin({ user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }] }),
      env: { GROQ_API_KEY: 'test-key' },
    });
    const res = await handleParseRosterImage(ctx);
    expect(res.status).toBe(422);
  });

  it('never writes to the database — parse-only, matching the scores/event/potg parsers', () => {
    const fnStart = workerSrc.indexOf('export async function handleParseRosterImage');
    const fnEnd = workerSrc.indexOf('\nfunction normalizeTeamToken', fnStart);
    const fnBody = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).not.toMatch(/\.insert\(/);
    expect(fnBody).not.toMatch(/\.update\(/);
  });
});

// ── /ops/roster/import ────────────────────────────────────────────────────────
function baseRosterState(overrides: Partial<Record<string, Row[]>> = {}) {
  return {
    user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
    leagues: [{ id: LEAGUE_ID, code: 'wbl', name: 'Weekend Basketball League' }],
    teams: [] as Row[],
    profiles: [] as Row[],
    players: [] as Row[],
    ...overrides,
  };
}

function rosterBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    leagueId: 'wbl',
    seasonId: SEASON_ID,
    teamName: 'Ball is Life',
    players: [
      { name: 'Jaime Phillips', jerseyNumber: 23, position: 'G' },
      { name: 'Alex Rivera', jerseyNumber: 5, position: 'F' },
    ],
    ...overrides,
  };
}

describe('handleRosterImport', () => {
  it('401s unauthenticated callers', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      admin: createAdmin({ user_role_assignments: [] }),
    });
    await expect(handleRosterImport(ctx)).rejects.toThrow(/unauthorized/);
  });

  it('403s non-super-admin callers', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin({ user_role_assignments: [{ user_id: ADMIN_ID, role: 'league_admin' }] }),
    });
    await expect(handleRosterImport(ctx)).rejects.toThrow(/forbidden/);
  });

  it('422s when seasonId is missing (proves the tightened team schema contract)', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ seasonId: undefined }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(baseRosterState()),
    });
    const res = await handleRosterImport(ctx);
    expect(res.status).toBe(422);
  });

  it('422s when players is empty', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ players: [] }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(baseRosterState()),
    });
    const res = await handleRosterImport(ctx);
    expect(res.status).toBe(422);
  });

  it('400s when the league cannot be resolved', async () => {
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ leagueId: 'not-a-real-league' }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(baseRosterState({ leagues: [{ id: LEAGUE_ID, code: 'wbl' }] })),
    });
    const res = await handleRosterImport(ctx);
    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.error).toBe('invalid_league_code');
  });

  it('creates a new team when no name match exists, and attaches every player to it', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; teamId: string; inserted: number; skipped: number; failed: number };
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(2);
    expect(body.failed).toBe(0);

    expect(state.teams).toHaveLength(1);
    expect(state.teams[0].name).toBe('Ball is Life');
    expect(state.teams[0].league_id).toBe(LEAGUE_ID);
    expect(state.teams[0].season_id).toBe(SEASON_ID);

    expect(state.players).toHaveLength(2);
    for (const player of state.players) {
      expect(player.team_id).toBe(body.teamId);
    }
    const jaime = state.players.find((p) => p.jersey_number === 23);
    expect(jaime?.position).toBe('G');
  });

  it('does NOT reuse a same-named team from a different season — creates a new one instead', async () => {
    // teams.unique(season_id, name): the same team name legitimately recurs
    // every season as a distinct row. A league-only lookup would silently
    // attach this season's roster to last season's team.
    const OTHER_SEASON = 'dddddddd-4444-4444-8444-444444444444';
    const state = baseRosterState({
      teams: [{ id: 'team-last-season', league_id: LEAGUE_ID, season_id: OTHER_SEASON, name: 'Ball is Life' }],
    });
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    const body = await res.json() as { ok: boolean; teamId: string };
    expect(res.status).toBe(200);
    expect(body.teamId).not.toBe('team-last-season');
    expect(state.teams).toHaveLength(2);
    const newTeam = state.teams.find((t) => t.id === body.teamId);
    expect(newTeam?.season_id).toBe(SEASON_ID);

    // resolvePotgPlayer's own team lookup (used when it inserts a brand-new
    // player) is scoped by league only — it would find the STALE prior-season
    // team internally. Every player's final team_id must still land on the
    // correct current-season team, because handleRosterImport's own update()
    // step always overwrites team_id with the season-scoped id it resolved.
    for (const player of state.players) {
      expect(player.team_id).toBe(body.teamId);
      expect(player.team_id).not.toBe('team-last-season');
    }
  });

  it('trims surrounding whitespace on teamName/leagueId before matching', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ teamName: '  Ball is Life  ', leagueId: '  wbl  ' }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    expect(res.status).toBe(200);
    expect(state.teams).toHaveLength(1);
    expect(state.teams[0].name).toBe('Ball is Life');
  });

  it('flags an unparseable jersey number as a warning instead of silently ignoring or crashing', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ players: [{ name: 'Jaime Phillips', jerseyNumber: '23G', position: 'G' }] }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    const body = await res.json() as { ok: boolean; inserted: number; warnings: string[] };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(1);
    expect(body.warnings.some((w) => w.includes('invalid_jersey_number_ignored'))).toBe(true);
    expect(state.players[0].jersey_number).toBeNull();
  });

  it('accepts jersey number 0 as a real value, not a falsy no-op', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ players: [{ name: 'Jaime Phillips', jerseyNumber: 0 }] }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    const body = await res.json() as { ok: boolean; warnings: string[] };
    expect(res.status).toBe(200);
    expect(body.warnings.some((w) => w.includes('invalid_jersey_number'))).toBe(false);
    expect(state.players[0].jersey_number).toBe(0);
  });

  it('rejects a negative jersey number with a warning rather than storing it', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ players: [{ name: 'Jaime Phillips', jerseyNumber: -5 }] }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    const body = await res.json() as { ok: boolean; warnings: string[] };
    expect(res.status).toBe(200);
    expect(body.warnings.some((w) => w.includes('invalid_jersey_number_ignored'))).toBe(true);
    expect(state.players[0].jersey_number).toBeNull();
  });

  it('reuses an existing team on an ilike name match — never a duplicate team row', async () => {
    const state = baseRosterState({
      teams: [{ id: 'team-existing', league_id: LEAGUE_ID, season_id: SEASON_ID, name: 'ball is life' }],
    });
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    const body = await res.json() as { ok: boolean; teamId: string };
    expect(body.teamId).toBe('team-existing');
    expect(state.teams).toHaveLength(1);
  });

  it('re-running the identical import is idempotent: team and players are skipped, not duplicated', async () => {
    const state = baseRosterState();
    const admin = createAdmin(state);

    const first = await handleRosterImport(mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin,
    }));
    expect((await first.json() as { inserted: number }).inserted).toBe(2);
    expect(state.teams).toHaveLength(1);
    expect(state.players).toHaveLength(2);

    const second = await handleRosterImport(mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin,
    }));
    const secondBody = await second.json() as { ok: boolean; inserted: number; skipped: number };
    expect(secondBody.ok).toBe(true);
    expect(secondBody.inserted).toBe(0);
    expect(secondBody.skipped).toBe(2);
    expect(state.teams).toHaveLength(1); // still exactly one team row
    expect(state.players).toHaveLength(2); // still exactly two player rows
  });

  it('flags unresolved players as failed without aborting the rest of the batch', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ players: [{ name: '   ' }, { name: 'Valid Player', jerseyNumber: 10 }] }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    const body = await res.json() as { ok: boolean; inserted: number; failed: number; errors: string[] };
    expect(body.ok).toBe(true);
    expect(body.failed).toBe(1);
    expect(body.inserted).toBe(1);
    expect(body.errors[0]).toContain('potg_player_name_required');
  });

  it('blocks SQL-injection-class payloads before any write', async () => {
    const state = baseRosterState();
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody({ teamName: 'DROP TABLE teams;' }),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleRosterImport(ctx);
    expect(res.status).toBe(403);
    expect(state.teams).toHaveLength(0);
  });

  it('emits a roster_imported domain event', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const state = baseRosterState();
    const admin = createAdmin(state, {
      rpc: {
        enqueue_local_domain_event: (payload) => { calls.push(payload); return { data: null, error: null }; },
      },
    });
    const ctx = mkCtx({
      url: 'https://local/ops/roster/import',
      method: 'POST',
      body: rosterBody(),
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin,
    });
    await handleRosterImport(ctx);
    expect(calls.some((c) => c.p_event_type === 'roster_imported')).toBe(true);
  });
});

// ── Schema-contract fix (§5.4): teams.season_id is required at the Zod layer ─
import { handleScoresCsvUpload } from '@/worker/routes/ops-upload';

describe('teamRowSchema — season_id is required (closes the silent-DB-failure gap)', () => {
  it('rejects a teams CSV row with no season_id at the 422 validation layer, before any insert is attempted', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
      leagues: [{ id: LEAGUE_ID, code: 'wbl' }],
      teams: [] as Row[],
    };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: { kind: 'teams', format: 'v1', rows: [{ name: 'No Season Team', league_id: 'wbl' }] },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(422);
    expect(state.teams).toHaveLength(0);
  });
});
