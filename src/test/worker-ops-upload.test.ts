import { describe, expect, it } from 'vitest';
import { handleScoresCsvUpload } from '@/worker/routes/ops-upload';
import { createAdmin, type Row } from './broadcast-test-utils';

const ADMIN_ID = 'bbbbbbbb-2222-4222-8222-222222222222';

function mkCtx(options: {
  url: string;
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  admin: ReturnType<typeof createAdmin>;
}) {
  const init: RequestInit = { method: options.method ?? 'GET' };
  const headers = {
    'x-idempotency-key': 'idempotency-key-long-enough-12345',
    ...(options.headers ?? {})
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
    env: {} as unknown as Env,
  };
}

describe('handleScoresCsvUpload — functional unit tests', () => {
  it('rejects unauthenticated callers', async () => {
    const state = { user_role_assignments: [] };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: { kind: 'teams', rows: [{ name: 'Test' }] },
      admin: createAdmin(state),
    });

    await expect(handleScoresCsvUpload(ctx)).rejects.toThrow(/unauthorized/);
  });

  it('rejects non-admin callers', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'fan' }],
    };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: { kind: 'teams', rows: [{ name: 'Test' }] },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });

    await expect(handleScoresCsvUpload(ctx)).rejects.toThrow(/forbidden/);
  });

  it('blocks SQL-injection payloads', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
    };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: {
        kind: 'teams',
        format: 'v1',
        rows: [{ name: 'DROP TABLE teams;' }],
      },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });

    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('blocked_class_payload');
  });

  it('rejects invalid schema version', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
    };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: {
        kind: 'teams',
        format: 'v2',
        rows: [{ name: 'Test' }],
      },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });

    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('unsupported_schema_version');
  });
});

// ── Regression: silent row-drop fix (2026-07-20 audit) ──────────────────────
// Previously any row carrying a schema_version/format field was dropped from
// BOTH validation and insertion with no error surfaced anywhere.
describe('handleScoresCsvUpload — v1 marker rows never cause silent data loss', () => {
  const SUPER = { user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }] };

  it('inserts data rows that carry a format/schema_version column', async () => {
    const state = { ...SUPER, leagues: [{ id: 'L1', code: 'WBL' }], teams: [] };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: {
        kind: 'teams',
        rows: [
          { name: 'Alpha', league_id: 'WBL', format: 'v1' },
          { name: 'Beta', league_id: 'WBL', schema_version: 'v1' },
        ],
      },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });

    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; inserted: number; failed: number };
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(2); // pre-fix: 0 inserted, 0 failed, no error — silent loss
    expect(body.failed).toBe(0);
  });

  it('skips pure marker rows but validates and inserts the rest', async () => {
    const state = { ...SUPER, leagues: [{ id: 'L1', code: 'WBL' }], teams: [] };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: {
        kind: 'teams',
        rows: [
          { schema_version: 'v1', name: '', league_id: '' }, // marker-only row from CSV export
          { name: 'Gamma', league_id: 'WBL' },
        ],
      },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });

    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; inserted: number; failed: number };
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(1);
    expect(body.failed).toBe(0);
  });

  it('still surfaces validation errors for invalid data rows carrying a marker', async () => {
    const state = { ...SUPER, leagues: [], teams: [] };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: {
        kind: 'teams',
        rows: [{ name: '', league_id: 'WBL', format: 'v1' }], // invalid: empty name
      },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });

    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(422); // pre-fix: row vanished silently with 200
  });
});

// ── Regression shields: A+ hardening pass (2026-07-20) ──────────────────────
import { isDuplicateKeyError } from '@/worker/routes/ops-upload';
import { handleImportHistory } from '@/worker/index';

describe('uniform duplicate-key tolerance — idempotent re-runs for every entity', () => {
  it('classifies Postgres duplicate errors for any table, not just teams', () => {
    expect(isDuplicateKeyError(new Error('duplicate key value violates unique constraint "players_pkey"'))).toBe(true);
    expect(isDuplicateKeyError({ message: 'insert failed', code: '23505' })).toBe(true);
    expect(isDuplicateKeyError(new Error('permission denied for table teams'))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });

  it('csv upload response always carries the skipped counter (shape contract)', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
      leagues: [{ id: 'L1', code: 'WBL' }],
      teams: [],
    };
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: { kind: 'teams', format: 'v1', rows: [{ name: 'Delta', league_id: 'WBL' }] },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleScoresCsvUpload(ctx);
    const body = await res.json() as { ok: boolean; inserted: number; skipped: number; failed: number };
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(0);
    expect(body.inserted).toBe(1);
  });
});

describe('csv upload emits domain events — parity with /ops/imports/*', () => {
  it('enqueues one <kind>_imported event per inserted row', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
      leagues: [{ id: 'L1', code: 'WBL' }],
      teams: [],
    };
    const admin = createAdmin(state, {
      rpc: {
        enqueue_local_domain_event: (payload) => { calls.push(payload); return { data: null, error: null }; },
      },
    });
    const ctx = mkCtx({
      url: 'https://local/api/ops/upload/csv',
      method: 'POST',
      body: {
        kind: 'teams', format: 'v1',
        rows: [{ name: 'Echo', league_id: 'WBL' }, { name: 'Foxtrot', league_id: 'WBL' }],
      },
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin,
    });
    const res = await handleScoresCsvUpload(ctx);
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.p_event_type === 'teams_imported')).toHaveLength(2);
  });
});

describe('import history — operator visibility of ingress failures', () => {
  it('returns ingress_failures alongside jobs (additive, non-breaking shape)', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
      import_jobs: [],
      ingress_buffer: [
        { correlation_id: 'c-1', error_reason: 'invalid_json', source_type: 'upload', status: 'failed', created_at: '2026-07-20T00:00:00Z' },
        { correlation_id: 'c-2', error_reason: 'ok_row', source_type: 'upload', status: 'accepted', created_at: '2026-07-20T00:00:01Z' },
      ],
    };
    const ctx = mkCtx({
      url: 'https://local/ops/imports/history',
      headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
      admin: createAdmin(state),
    });
    const res = await handleImportHistory(ctx);
    const body = await res.json() as { ok: boolean; jobs: unknown[]; ingress_failures: Array<{ correlation_id: string }> };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.ingress_failures).toHaveLength(1);
    expect(body.ingress_failures[0].correlation_id).toBe('c-1');
  });
});
