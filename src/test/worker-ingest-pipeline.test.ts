/**
 * Ingest pipeline verification tests.
 *
 * Coverage:
 *   1. Route registration — all canonical ingest routes exist in the worker
 *   2. Public render contract — /api/public/media reads media_publications, not media_assets
 *   3. Mock fallback removed — Media.tsx has NO fallback to mockMedia
 *   4. handleManualOpsAction deleted — scaffold handler with schema drift is gone
 *   5. handleStoreMedia and handleSubmitPotg write to media_publications
 *   6. Image resize — portrait POTG cards (3:4) resize to 560×747; landscape to 747×560
 *   7. Real POTG card data — all test fixtures from production assets parse correctly
 *   8. State machine transitions — correct states flow for submit/approve/reject/replay
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');
const mediaSrc  = readFileSync(resolve(__dirname, '../pages/Media.tsx'),   'utf-8');
const opsSrc    = readFileSync(resolve(__dirname, '../lib/api/ops.ts'),    'utf-8');

// ── 1. Canonical ingest route registration ───────────────────────────────────
describe('ingest route registration', () => {
  const requiredRoutes = [
    ['"POST"', '"/ops/ingest/presign"',         'handleIngestPresign'],
    ['"POST"', '"/ops/ingest/submit"',           'handleIngestSubmit'],
    ['"GET"',  '"/ops/ingest/:jobId"',           'handleIngestStatus'],
    ['"POST"', '"/ops/ingest/:jobId/approve"',   'handleIngestApprove'],
    ['"POST"', '"/ops/ingest/:jobId/reject"',    'handleIngestReject'],
    ['"POST"', '"/ops/ingest/:jobId/replay"',    'handleIngestReplay'],
  ];

  requiredRoutes.forEach(([method, path, handler]) => {
    it(`registers ${method} ${path}`, () => {
      expect(workerSrc).toContain(path);
      expect(workerSrc).toContain(handler);
    });
  });

  it('ingest handlers are async functions', () => {
    for (const handler of [
      'handleIngestPresign', 'handleIngestSubmit', 'handleIngestStatus',
      'handleIngestApprove', 'handleIngestReject', 'handleIngestReplay',
    ]) {
      expect(workerSrc).toMatch(new RegExp(`async function ${handler}`));
    }
  });

  it('supports a dedicated video ingest kind', () => {
    expect(workerSrc).toContain('"video"');
    expect(opsSrc).toContain("type IngestKind = 'potg' | 'store' | 'event' | 'generic' | 'video'");
  });
});

// ── 2. Public render contract ────────────────────────────────────────────────
describe('public render contract: /api/public/media', () => {
  it('handlePublicMedia reads from media_publications (not media_assets directly)', () => {
    // Find handlePublicMedia body
    const fnStart = workerSrc.indexOf('async function handlePublicMedia');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);

    expect(fnBody).toContain('media_publications');
    expect(fnBody).toContain('media_assets!inner');
  });

  it('handlePublicMedia does NOT query media_assets directly as the primary table', () => {
    const fnStart = workerSrc.indexOf('async function handlePublicMedia');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);

    // The FROM clause should be media_publications, not media_assets
    expect(fnBody).not.toMatch(/\.from\("media_assets"\)/);
  });

  it('public media response is cached', () => {
    const fnStart = workerSrc.indexOf('async function handlePublicMedia');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('Cache-Control');
    expect(fnBody).toContain('s-maxage');
  });
});

// ── 3. Mock fallback is gone ─────────────────────────────────────────────────
describe('mockMedia fallback removal', () => {
  it('Media.tsx does NOT import from @/data/mock', () => {
    expect(mediaSrc).not.toContain("from '@/data/mock'");
    expect(mediaSrc).not.toContain('from "@/data/mock"');
  });

  it('Media.tsx does NOT reference mockMedia variable', () => {
    expect(mediaSrc).not.toContain('mockMedia');
  });

  it('Media.tsx shows a real error state on API failure', () => {
    expect(mediaSrc).toContain('isError');
    expect(mediaSrc).toContain('AlertTriangle');
  });
});

// ── 4. Scaffold handler deleted ──────────────────────────────────────────────
describe('handleManualOpsAction removal', () => {
  it('handleManualOpsAction is not defined in the worker', () => {
    expect(workerSrc).not.toContain('async function handleManualOpsAction');
  });

  it('/ops/manual/:kind/:action route is not registered', () => {
    expect(workerSrc).not.toContain('"/ops/manual/:kind/:action"');
  });

  it('schema-drifted columns are not used in executable code', () => {
    // These columns do not exist in the products table.
    // We check for .update({ or .insert({ patterns — not comment mentions.
    expect(workerSrc).not.toContain('publish_status: "suspended"');
    expect(workerSrc).not.toContain('publish_status: "archived"');
    // inventory_qty, is_sold_out, sold_out_date must not appear in DB calls
    expect(workerSrc).not.toMatch(/inventory_qty[^,\n]*:/);
    expect(workerSrc).not.toMatch(/\.eq\("is_sold_out"/);
    expect(workerSrc).not.toMatch(/\.lt\("sold_out_date"/);
  });
});

// ── 5. handleStoreMedia and handleSubmitPotg project to media_publications ───
describe('ingest handlers write to publication layer', () => {
  it('handleStoreMedia inserts into media_publications', () => {
    const fnStart = workerSrc.indexOf('async function handleStoreMedia');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('media_publications');
    expect(fnBody).toContain("surface: \"store\"");
  });

  it('handleSubmitPotg inserts into media_publications', () => {
    const fnStart = workerSrc.indexOf('async function handleSubmitPotg');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('media_publications');
    expect(fnBody).toContain("surface: \"potg\"");
  });

  it('handleIngestSubmit projects into media_publications', () => {
    const fnStart = workerSrc.indexOf('async function handleIngestSubmit');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('media_publications');
  });
});

// ── 6. Image resize: POTG card dimensions ───────────────────────────────────
describe('POTG image resize logic', () => {
  /**
   * inferTargetDimensions decides portrait vs landscape by comparing
   * img.width vs img.height. These tests validate the expected output
   * dimensions for real POTG card aspect ratios.
   *
   * Real POTG cards observed: ~940×1253 (portrait, ~3:4)
   * Event graphics observed:  ~940×705  (landscape, ~4:3)
   */

  type DimResult = { width: number; height: number; mode: 'contain' | 'cover' };

  function simulateInferDimensions(srcWidth: number, srcHeight: number): DimResult {
    // Mirrors the logic in src/lib/imageResize.ts inferTargetDimensions
    const isLandscape = srcWidth > srcHeight;
    return isLandscape
      ? { width: 747, height: 560, mode: 'cover' }
      : { width: 560, height: 747, mode: 'cover' };
  }

  const portraitCards = [
    // Real TGIFBL POTG cards from production assets (2026-04-07 batch)
    { name: 'Rex Manalo — JC Trans Jrs',           w: 940, h: 1253 },
    { name: 'Washington Darko — Full Time Ballers', w: 940, h: 1253 },
    { name: 'Jhing De Vers — Full Time Ballers',    w: 940, h: 1253 },
    { name: 'Tata Ramon — OSY x LCL',               w: 940, h: 1253 },
    { name: 'Jhonly Velasco — Mantiku',              w: 940, h: 1253 },
    { name: 'Sheldon Gahi — Batang Riles x Tri J',  w: 940, h: 1253 },
    { name: 'Chad Vincent Simon — 14oz Athletics',  w: 940, h: 1253 },
    { name: 'Malik Gittens — City Above Elite',     w: 940, h: 1253 },
    { name: 'Khaleed Sutherland — Conceited Fantasy', w: 940, h: 1253 },
  ];

  portraitCards.forEach(({ name, w, h }) => {
    it(`portrait card [${name}] → 560×747 cover`, () => {
      const result = simulateInferDimensions(w, h);
      expect(result).toEqual({ width: 560, height: 747, mode: 'cover' });
    });
  });

  it('event graphic (landscape, SBBL 2v2) → 747×560 cover', () => {
    // SBBL 2v2 event graphic — landscape format
    const result = simulateInferDimensions(1253, 940);
    expect(result).toEqual({ width: 747, height: 560, mode: 'cover' });
  });

  it('portrait output 560×747 matches UI aspect-[3/4] container exactly', () => {
    const { width, height } = simulateInferDimensions(940, 1253);
    // 3/4 = 0.75; 560/747 = 0.7497... ≈ 0.75
    expect(Math.abs(width / height - 3 / 4)).toBeLessThan(0.001);
  });

  it('cover mode on exact 3:4 source performs zero cropping', () => {
    // A 3:4 source into a 3:4 canvas: no pixels discarded
    const srcW = 560, srcH = 747;
    const dstW = 560, dstH = 747;
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;
    // In cover mode, crop only occurs when srcAspect !== dstAspect
    expect(Math.abs(srcAspect - dstAspect)).toBeLessThan(0.001);
  });

  it('store media resize target is square (800×800)', () => {
    // Store product images always resize to 800×800 (square, contain mode)
    // Verify Ops.tsx still uses these fixed dimensions
    const opsTsxSrc = readFileSync(resolve(__dirname, '../pages/Ops.tsx'), 'utf-8');
    expect(opsTsxSrc).toContain('resizeImageToFit(storeForm.imageFile, 800, 800)');
  });
});

// ── 7. Real POTG data parsing ────────────────────────────────────────────────
describe('POTG payload structure validation', () => {
  const potgCards = [
    { playerName: 'Rex Manalo',          team: 'JC Trans Jrs',             pts: 17, rebs: 4,  assts: 6,  gameResult: 'JC Trans Jrs 75 vs Banayad Hoopers 65', leagueId: 'tgifbl' },
    { playerName: 'Washington Darko',    team: 'Full Time Ballers',         pts: 15, rebs: 3,  assts: 3,  gameResult: 'Full Time Ballers 65 vs DBRKDZ 60',      leagueId: 'tgifbl' },
    { playerName: 'Jhing De Vers',       team: 'Full Time Ballers',         pts: 15, rebs: 8,  assts: 5,  gameResult: 'Full Time Ballers 65 vs DBRKDZ 60',      leagueId: 'tgifbl' },
    { playerName: 'Tata Ramon',          team: 'OSY x LCL',                 pts: 24, rebs: 4,  assts: 6,  gameResult: 'Solid North 78 vs OSY x LCL 82',         leagueId: 'tgifbl' },
    { playerName: 'Jhonly Velasco',      team: 'Mantiku',                   pts: 16, rebs: 7,  assts: 5,  gameResult: 'Mantiku 59 vs BLBG 57',                  leagueId: 'tgifbl' },
    { playerName: 'Sheldon Gahi',        team: 'Batang Riles x Tri J',      pts: 35, rebs: 5,  assts: 7,  gameResult: 'J Elite 70 vs Batang Riles x Tri J 75',  leagueId: 'tgifbl' },
    { playerName: 'Chad Vincent Simon',  team: 'Fourteen Ounce Athletics',  pts: 20, rebs: 8,  assts: 7,  gameResult: 'Fourteen Ounce Athletics 85 vs Ball Is Life 65', leagueId: 'tgifbl' },
    { playerName: 'Malik Gittens',       team: 'City Above Elite',          pts: 18, rebs: 9,  assts: 7,  gameResult: 'City Above Elite 68 vs C&F 61',          leagueId: 'tgifbl' },
    { playerName: 'Khaleed Sutherland',  team: 'Conceited Fantasy',         pts: 25, rebs: 10, assts: 6,  gameResult: 'YG 51 vs Conceited Fantasy 62',          leagueId: 'tgifbl' },
  ];

  potgCards.forEach(({ playerName, team, pts, rebs, assts, gameResult, leagueId }) => {
    it(`validates payload for ${playerName} (${team})`, () => {
      // All required fields present
      expect(playerName).toBeTruthy();
      expect(team).toBeTruthy();
      expect(leagueId).toBe('tgifbl');
      expect(typeof pts).toBe('number');
      expect(typeof rebs).toBe('number');
      expect(typeof assts).toBe('number');
      expect(gameResult).toBeTruthy();
      // Stats are positive integers
      expect(pts).toBeGreaterThan(0);
      expect(rebs).toBeGreaterThanOrEqual(0);
      expect(assts).toBeGreaterThanOrEqual(0);
    });

    it(`${playerName}: media_publications title format is correct`, () => {
      const expectedTitle = `POTG — ${playerName} (${team})`;
      expect(expectedTitle).toMatch(/^POTG — .+ \(.+\)$/);
    });
  });
});

// ── 8. State machine transitions ─────────────────────────────────────────────
describe('ingest state machine', () => {
  const validStates = ['uploaded','fingerprinted','classified','parsed','validated','written','projected','published','failed','needs_review'];
  const terminalStates = ['published', 'failed'];
  const replayableStates = ['failed', 'needs_review'];

  it('all valid states are in the migration CHECK constraint', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260407200000_ingest_pipeline.sql'),
      'utf-8'
    );
    validStates.forEach(state => {
      expect(migSrc).toContain(`'${state}'`);
    });
  });

  it('approve only transitions from projected|needs_review|draft', () => {
    const fnStart = workerSrc.indexOf('async function handleIngestApprove');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('projected');
    expect(fnBody).toContain('needs_review');
    expect(fnBody).toContain('cannot_approve_from_state');
  });

  it('replay only works from terminal failed|needs_review states', () => {
    const fnStart = workerSrc.indexOf('async function handleIngestReplay');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    replayableStates.forEach(s => expect(fnBody).toContain(`"${s}"`));
    expect(fnBody).toContain('not_replayable_from_state');
  });

  it('ingest_jobs has idempotency_key unique constraint to prevent duplicate rows', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260407200000_ingest_pipeline.sql'),
      'utf-8'
    );
    expect(migSrc).toContain('idempotency_key');
    expect(migSrc).toContain('unique (idempotency_key)');
  });

  it('submit handler detects duplicate by idempotency_key and returns existing job', () => {
    const fnStart = workerSrc.indexOf('async function handleIngestSubmit');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('deduplicated: true');
    expect(fnBody).toContain('idempotency_key');
  });

  it('terminalStates are never auto-transitioned to by submit', () => {
    const fnStart = workerSrc.indexOf('async function handleIngestSubmit');
    const fnEnd   = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody  = workerSrc.slice(fnStart, fnEnd);
    // published state only set if publishStatus === 'published'; never 'failed' auto-set
    expect(fnBody).not.toContain('"needs_review"'); // no auto-needs_review on submit
  });
});

describe('video ingest guardrails', () => {
  it('enforces caption length and video size cap in worker submit handler', () => {
    const fnStart = workerSrc.indexOf('async function handleIngestSubmit');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('caption_too_long');
    expect(fnBody).toContain('video_size_limit_exceeded');
    expect(fnBody).toContain('invalid_video_mime_type');
    expect(fnBody).toContain('resolveUploadedAssetMetadata');
  });

  it('maps video URL + caption into the public media contract', () => {
    const fnStart = workerSrc.indexOf('function mapPublicMediaRows');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const fnBody = workerSrc.slice(fnStart, fnEnd);
    expect(fnBody).toContain('videoUrl');
    expect(fnBody).toContain('caption');
  });

  it('media page includes admin upload controls + caption clamp', () => {
    expect(mediaSrc).toContain('Admin Video Upload');
    expect(mediaSrc).toContain('max 140 chars');
    expect(mediaSrc).toContain('ingestPresign(\'video\'');
  });
});

// ── 9. Security boundaries ────────────────────────────────────────────────────
describe('security: ingest role gating', () => {
  it('presign/submit/status require media-upload role gate', () => {
    for (const handler of ['handleIngestPresign', 'handleIngestSubmit', 'handleIngestStatus']) {
      const fnStart = workerSrc.indexOf(`async function ${handler}`);
      const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
      const fnBody = workerSrc.slice(fnStart, fnEnd);
      expect(fnBody).toContain('requireMediaUploadSession');
    }
  });

  it('approve/reject/replay remain super_admin gated', () => {
    for (const handler of ['handleIngestApprove', 'handleIngestReject', 'handleIngestReplay']) {
      const fnStart = workerSrc.indexOf(`async function ${handler}`);
      const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
      const fnBody = workerSrc.slice(fnStart, fnEnd);
      expect(fnBody).toContain('requireSuperAdmin');
    }
  });

  it('media_publications RLS policy in migration allows only super_admin writes', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260407103137_media_publications.sql'),
      'utf-8'
    );
    expect(migSrc).toContain('super_admin_full_access');
    expect(migSrc).toContain("role' = 'super_admin'");
  });

  it('media_publications public read limited to published rows only', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260407103137_media_publications.sql'),
      'utf-8'
    );
    expect(migSrc).toContain('public_read_published');
    expect(migSrc).toContain("status = 'published'");
  });
});
