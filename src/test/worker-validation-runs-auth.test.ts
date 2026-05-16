import { describe, expect, it, vi } from 'vitest';
import { handleOpsValidationRuns } from '@/worker/validation-contract-wrapper';

const env = {
  SUPABASE_URL: 'https://supabase.sbbl-hq.icu',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
} as unknown as Env;

function authFor(roles: string[] | null) {
  return vi.fn(async () => {
    if (!roles) return { ok: false as const, response: new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 }) };
    if (!roles.includes('super_admin')) return { ok: false as const, response: new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 }) };
    return { ok: true as const, session: { userId: 'jr', roles } };
  });
}

function makeAdmin(existingRun: unknown = null) {
  const calls: string[] = [];
  const admin = {
    from: vi.fn((table: string) => {
      calls.push(table);
      if (table === 'validation_runs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: existingRun, error: null })) })),
              maybeSingle: vi.fn(async () => ({ data: existingRun, error: existingRun ? null : null })),
            })),
            single: vi.fn(async () => ({ data: { id: 'run-new', status: 'running' }, error: null })),
          })),
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'run-new', status: 'running' }, error: null })) })) })),
        };
      }
      return { insert: vi.fn(async () => ({ error: null })) };
    }),
  };
  return { admin: admin as unknown as Parameters<typeof handleOpsValidationRuns>[2] extends (env: Env) => infer R ? R : never, calls };
}

describe('/ops/validation-runs auth gate', () => {
  it('unauth POST returns 401 and does not create service-role validation client', async () => {
    const make = vi.fn(() => makeAdmin().admin);
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs', { method: 'POST' }), env, make, authFor(null));
    expect(res.status).toBe(401);
    expect(make).not.toHaveBeenCalled();
  });

  it('invalid token POST returns 401 and does not create service-role validation client', async () => {
    const make = vi.fn(() => makeAdmin().admin);
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs', { method: 'POST', headers: { authorization: 'Bearer invalid' } }), env, make, authFor(null));
    expect(res.status).toBe(401);
    expect(make).not.toHaveBeenCalled();
  });

  it('authenticated non-super-admin POST returns 403 and does not create service-role validation client', async () => {
    const make = vi.fn(() => makeAdmin().admin);
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs', { method: 'POST' }), env, make, authFor(['league_admin']));
    expect(res.status).toBe(403);
    expect(make).not.toHaveBeenCalled();
  });

  it('super_admin POST with valid idempotency succeeds', async () => {
    const { admin } = makeAdmin();
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'idem-1' },
      body: JSON.stringify({ game_id: 'g1' }),
    }), env, vi.fn(() => admin), authFor(['super_admin']));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ ok: true, validation_run_id: 'run-new' });
  });

  it('super_admin POST missing idempotency returns existing validation error', async () => {
    const { admin } = makeAdmin();
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs', { method: 'POST' }), env, vi.fn(() => admin), authFor(['super_admin']));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'idempotency_key_required' });
  });

  it('unauth GET returns 401 and does not create service-role validation client', async () => {
    const make = vi.fn(() => makeAdmin().admin);
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs/run-1'), env, make, authFor(null));
    expect(res.status).toBe(401);
    expect(make).not.toHaveBeenCalled();
  });

  it('authenticated non-super-admin GET returns 403 and does not create service-role validation client', async () => {
    const make = vi.fn(() => makeAdmin().admin);
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs/run-1'), env, make, authFor(['coach']));
    expect(res.status).toBe(403);
    expect(make).not.toHaveBeenCalled();
  });

  it('super_admin GET returns not-found when the run is absent', async () => {
    const { admin } = makeAdmin(null);
    const res = await handleOpsValidationRuns(new Request('https://local/ops/validation-runs/run-1'), env, vi.fn(() => admin), authFor(['super_admin']));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'not_found' });
  });
});
