/**
 * Regular-admin (league_admin) permission contract.
 *
 * Codifies the operator-defined rules for the Ops Console:
 *   1. league_admin runs ALL content ops for all three leagues — scores,
 *      schedules, stats, players, teams, media, POTG, roster.
 *   2. league_admin has NO access to live-PPV controls (stream config, go-live,
 *      access override, PPV revenue).
 *   3. league_admin MAY generate comp codes, capped at 5 per rolling 24h,
 *      non-compounding.
 *   4. league_admin is EXCLUDED from store media upload and edit.
 *
 * These are source-level assertions: they pin which auth gate each handler uses,
 * so a future refactor cannot quietly re-open or re-close a surface.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const WORKER_SRC = fs.readFileSync(
  path.join(__dirname, '../worker/index.ts'),
  'utf8',
);
const OPS_UPLOAD_SRC = fs.readFileSync(
  path.join(__dirname, '../worker/routes/ops-upload.ts'),
  'utf8',
);
const OPS_PAGE_SRC = fs.readFileSync(
  path.join(__dirname, '../pages/Ops.tsx'),
  'utf8',
);

/** Extract a function body by name, up to the next top-level function. */
function bodyOf(src: string, name: string): string {
  const start = src.search(
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`),
  );
  expect(start, `handler ${name} not found`).toBeGreaterThan(-1);
  const rest = src.slice(start + 10);
  const nextIdx = rest.search(/\n(?:export\s+)?(?:async\s+)?function\s+/);
  return nextIdx === -1 ? src.slice(start) : rest.slice(0, nextIdx);
}

describe('regular admin (league_admin) — Ops Console content operations', () => {
  const CONTENT_OPS_HANDLERS = [
    'handleScoreGameUpsert',
    'handleOpsListTeams',
    'handleOpsListPlayers',
    'handleOpsListEvents',
    'handleOpsMediaPublish',
    'handleOpsListMediaPublications',
    'handleOpsPatchMediaPublications',
    'handleIngestSubmit',
    'handleIngestApprove',
    'handlePlayerIdentityMerge',
  ];

  it.each(CONTENT_OPS_HANDLERS)(
    '%s is gated at ops-admin (league_admin allowed)',
    (handler) => {
      const body = bodyOf(WORKER_SRC, handler);
      expect(body).toContain('requireOpsAdminSession');
      expect(body).not.toContain('requireSuperAdminSession');
    },
  );

  it.each(['handleScoresCsvUpload', 'handleScoresCsvImport', 'handleRosterImport', 'handleImportRoute'])(
    '%s (upload path) is gated at ops-admin',
    (handler) => {
      const body = bodyOf(OPS_UPLOAD_SRC, handler);
      expect(body).toContain('requireOpsAdminSession');
      expect(body).not.toContain('requireSuperAdminSession');
    },
  );

  // The shared CRUD helpers dispatch per-table (store tables escalate to
  // super-admin), so they route through requireTableWriteSession rather than
  // calling the ops-admin gate directly.
  it.each(['handleOpsPatch', 'handleOpsDelete'])(
    '%s routes through the per-table write gate',
    (handler) => {
      const body = bodyOf(WORKER_SRC, handler);
      expect(body).toContain('requireTableWriteSession');
      expect(body).not.toContain('requireSuperAdminSession');
    },
  );

  it('ops-admin gate admits league_admin + super_admin only — never team_manager', () => {
    const body = bodyOf(WORKER_SRC, 'requireOpsAdminSession');
    expect(body).toContain('league_admin');
    expect(body).toContain('super_admin');
    expect(body).not.toContain('team_manager');
  });
});

describe('regular admin — NO access to live-PPV controls', () => {
  const PPV_CONTROL_HANDLERS = [
    'handleUpdateStreamConfig',
    'handleSetStreamStatus',
    'handleGoLive',
    'handleAccessLookup',
    'handleAccessOverride',
    'handleOpsRevenue',
  ];

  it.each(PPV_CONTROL_HANDLERS)('%s stays super-admin only', (handler) => {
    const body = bodyOf(WORKER_SRC, handler);
    expect(body).toContain('requireSuperAdminSession');
    expect(body).not.toContain('requireOpsAdminSession');
  });
});

describe('regular admin — comp codes capped at 5 per rolling 24h', () => {
  it('exports the limit as 5 over a 24h window', () => {
    expect(WORKER_SRC).toMatch(
      /LEAGUE_ADMIN_COMP_CODE_DAILY_LIMIT\s*=\s*5\b/,
    );
    expect(WORKER_SRC).toMatch(/COMP_CODE_LIMIT_WINDOW_HOURS\s*=\s*24\b/);
  });

  it('comp-code creation admits league_admin but enforces the cap for non-super', () => {
    const body = bodyOf(WORKER_SRC, 'handleSuperAdminCompCode');
    expect(body).toContain('requireOpsAdminSession');
    // The cap is skipped for super_admin and applied to everyone else.
    expect(body).toContain('isSuper');
    expect(body).toContain('LEAGUE_ADMIN_COMP_CODE_DAILY_LIMIT');
    expect(body).toContain('comp_code_daily_limit_reached');
  });

  it('counts only the caller\'s own comp codes inside the window', () => {
    const body = bodyOf(WORKER_SRC, 'handleSuperAdminCompCode');
    expect(body).toContain('generated_by');
    expect(body).toContain('is_comp');
    // A rolling window is what makes the allowance non-compounding.
    expect(body).toContain('windowStart');
    expect(body).toContain('gte("created_at"');
  });

  it('regular admins can only list their own comp codes', () => {
    const body = bodyOf(WORKER_SRC, 'handleSuperAdminCompCodeList');
    expect(body).toContain('requireOpsAdminSession');
    expect(body).toMatch(/if\s*\(!isSuper\)\s*query\s*=\s*query\.eq\("generated_by"/);
  });
});

describe('regular admin — excluded from store media upload and edit', () => {
  it('store product creation stays super-admin only', () => {
    const body = bodyOf(WORKER_SRC, 'handleOpsBatchProducts');
    expect(body).toContain('requireSuperAdminSession');
    expect(body).not.toContain('requireOpsAdminSession');
  });

  it('the shared CRUD path escalates to super-admin for store tables', () => {
    expect(WORKER_SRC).toMatch(/STORE_ONLY_TABLES\s*=\s*new Set\(\["products", "store_products"\]\)/);
    const body = bodyOf(WORKER_SRC, 'requireTableWriteSession');
    expect(body).toContain('STORE_ONLY_TABLES');
    expect(body).toContain('requireSuperAdminSession');
    expect(body).toContain('requireOpsAdminSession');
  });

  it('generic media publish is NOT a store surface and stays open to league_admin', () => {
    const body = bodyOf(WORKER_SRC, 'handleOpsMediaPublish');
    expect(body).toContain('requireOpsAdminSession');
  });

  it('the Ops Console hides the Store tab from non-super-admins', () => {
    expect(OPS_PAGE_SRC).toMatch(/SUPER_ADMIN_ONLY_TABS[\s\S]{0,120}'store'/);
    expect(OPS_PAGE_SRC).toContain('visibleTabs');
    expect(OPS_PAGE_SRC).toContain("activeTab === 'store' && isSuperAdmin");
  });
});

describe('Ops Console entry gate', () => {
  it('admits league_admin rather than requiring super_admin', () => {
    expect(OPS_PAGE_SRC).toContain('canAccessOps');
    expect(OPS_PAGE_SRC).toMatch(/const canRunOps = !loading && sessionFresh && canOperateOps/);
    // The old hard denial must be gone.
    expect(OPS_PAGE_SRC).not.toContain('Access denied. Super Admin role required.');
  });
});
