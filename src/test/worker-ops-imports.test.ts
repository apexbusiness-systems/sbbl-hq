/**
 * worker-ops-imports — regression tests for the import route auth/validation hardening.
 *
 * Coverage (post Gap-1 audit fix):
 *   1. Unauthenticated requests → 401 (existing)
 *   2. /ops/imports/* routes require SUPER_ADMIN (not just ADMIN) after Gap-1 lift
 *   3. handleImportRoute source has classifyRiskLane gate (source assertion)
 *   4. handleImportRoute source has per-row Zod validation (source assertion)
 *   5. handleScoresCsvImport source has classifyRiskLane gate (source assertion)
 *   6. handleScoresCsvImport source has per-row Zod validation (source assertion)
 *   7. Dead local handleImportRoute copy is absent from index.ts (Gap-2 regression)
 *   8. Dead local handleScoresCsvImport copy is absent from index.ts (Gap-2 regression)
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
} as unknown as Env;

const workerSrc   = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');
const routeSrc    = readFileSync(resolve(__dirname, '../worker/routes/ops-upload.ts'), 'utf-8');

// ── 1. Unauthenticated requests ───────────────────────────────────────────────
describe('ops import routes auth', () => {
  it('rejects import mutation without auth → 401', async () => {
    const res = await worker.fetch(new Request('https://local/ops/imports/teams', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'idempotency-key-1234' },
      body: JSON.stringify({ rows: [{ name: 'Test' }] }),
    }), env);
    expect(res.status).toBe(401);
  });
});

// ── 2. SUPER_ADMIN auth gate on handleImportRoute (Gap 1) ────────────────────
describe('handleImportRoute auth level (Gap 1)', () => {
  it('handleImportRoute calls requireSuperAdminSession, not requireAdminSession', () => {
    const fnStart = routeSrc.indexOf('export async function handleImportRoute');
    const fnEnd   = routeSrc.indexOf('\nexport async function ', fnStart + 10);
    const fnBody  = routeSrc.slice(fnStart, fnEnd);

    expect(fnBody).toContain('requireSuperAdminSession');
    // Ensure the old lower-bar auth is gone from this specific function body
    expect(fnBody).not.toContain('requireAdminSession');
  });

  it('handleScoresCsvImport keeps requireSuperAdminSession', () => {
    const fnStart = routeSrc.indexOf('export async function handleScoresCsvImport');
    const fnEnd   = routeSrc.length; // last export in file
    const fnBody  = routeSrc.slice(fnStart, fnEnd);

    expect(fnBody).toContain('requireSuperAdminSession');
  });
});

// ── 3 & 4. classifyRiskLane + Zod gates in handleImportRoute (Gap 1) ─────────
describe('handleImportRoute validation gates (Gap 1)', () => {
  const fnStart = routeSrc.indexOf('export async function handleImportRoute');
  const fnEnd   = routeSrc.indexOf('\nexport async function ', fnStart + 10);
  const fnBody  = routeSrc.slice(fnStart, fnEnd);

  it('calls classifyRiskLane before any DB write', () => {
    const riskIdx   = fnBody.indexOf('classifyRiskLane');
    const insertIdx = fnBody.indexOf('.upsert(') !== -1
      ? fnBody.indexOf('.upsert(')
      : fnBody.indexOf('.insert(');
    expect(riskIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(riskIdx);
  });

  it('returns 403 on BLOCKED risk lane', () => {
    expect(fnBody).toContain('blocked_class_payload');
    expect(fnBody).toContain('403');
  });

  it('runs per-row config.schema.safeParse before DB write', () => {
    const zodIdx    = fnBody.indexOf('config.schema.safeParse');
    const insertIdx = fnBody.indexOf('validatedRows.map(row => config.resolvePayload');
    expect(zodIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(zodIdx);
  });

  it('returns 422 with field-level errors on Zod failure', () => {
    expect(fnBody).toContain('validationErrors');
    expect(fnBody).toContain('422');
    expect(fnBody).toContain('err.path');
    expect(fnBody).toContain('err.message');
  });

  it('uses validatedRows (not raw rows) in all downstream DB writes', () => {
    // Confirm raw rows are NOT passed to the insert/upsert path
    const afterValidation = fnBody.slice(fnBody.indexOf('validatedRows.push'));
    // leagueMap and resolvePayload should only see validatedRows
    expect(afterValidation).toContain('fetchLeagueMap(ctx.admin, validatedRows)');
    expect(afterValidation).toContain('validatedRows.map(row => config.resolvePayload');
  });
});

// ── 5 & 6. classifyRiskLane + Zod gates in handleScoresCsvImport (Gap 1) ─────
describe('handleScoresCsvImport validation gates (Gap 1)', () => {
  const fnStart = routeSrc.indexOf('export async function handleScoresCsvImport');
  const fnBody  = routeSrc.slice(fnStart);

  it('calls classifyRiskLane before any DB write', () => {
    const riskIdx   = fnBody.indexOf('classifyRiskLane');
    const insertIdx = fnBody.indexOf('.insert(');
    expect(riskIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(riskIdx);
  });

  it('returns 403 on BLOCKED risk lane', () => {
    expect(fnBody).toContain('blocked_class_payload');
    expect(fnBody).toContain('403');
  });

  it('runs per-row config.schema.safeParse before DB write', () => {
    const zodIdx    = fnBody.indexOf('config.schema.safeParse');
    const insertIdx = fnBody.indexOf('validatedRows.map(row => config.resolvePayload');
    expect(zodIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(zodIdx);
  });

  it('returns 422 on Zod validation failure', () => {
    expect(fnBody).toContain('validationErrors');
    expect(fnBody).toContain('422');
  });
});

// ── 7 & 8. Dead handler copies absent from index.ts (Gap 2) ─────────────────
describe('dead handler copies removed from index.ts (Gap 2)', () => {
  it('index.ts does NOT contain a local (non-imported) handleImportRoute declaration', () => {
    // The only mention should be the import alias binding in the route table.
    // A local function declaration would be: "async function handleImportRoute("
    // The import re-export from routes/ops-upload is: "_handleImportRoute"
    expect(workerSrc).not.toMatch(/^async function handleImportRoute\b/m);
  });

  it('index.ts does NOT contain a local handleScoresCsvImport declaration', () => {
    // Expect only the aliased import reference, not a local function
    expect(workerSrc).not.toMatch(/^async function handleScoresCsvImport\b/m);
  });

  it('live route bindings still reference _handleImportRoute alias', () => {
    expect(workerSrc).toContain('_handleImportRoute');
    expect(workerSrc).toContain('_handleScoresCsvImport');
  });
});
