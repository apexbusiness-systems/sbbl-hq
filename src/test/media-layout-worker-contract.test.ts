import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerSource = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');
const migrationSource = readFileSync(resolve(__dirname, '../../supabase/migrations/20260411153000_media_layout_manager.sql'), 'utf-8');

describe('media layout worker + schema contract', () => {
  it('registers media layout ops routes', () => {
    expect(workerSource).toContain('"/ops/media-layout/:sectionSlug"');
    expect(workerSource).toContain('"/ops/media-layout/:sectionSlug/save"');
    expect(workerSource).toContain('"/ops/media-layout/:sectionSlug/reset"');
  });

  it('enforces idempotency and stale conflict in migration functions', () => {
    expect(migrationSource).toContain('idempotency_key_conflict');
    expect(migrationSource).toContain('stale_revision');
    expect(migrationSource).toContain('duplicate_asset_ids');
    expect(migrationSource).toContain('capacity_exceeded');
  });
});
