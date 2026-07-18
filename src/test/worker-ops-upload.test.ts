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
