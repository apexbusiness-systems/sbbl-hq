/**
 * Regression guard for ingest presign bucket selection.
 *
 * Why this exists:
 * - `media-ingest` was created with a raw SQL insert.
 * - Raw SQL creation does not initialize Supabase Storage's signing engine.
 * - The ingest presign flow must keep targeting the existing `media` bucket.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');
const migrationSrc = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260407200000_ingest_pipeline.sql'),
  'utf-8'
);

describe('ingest presign storage bucket regression guard', () => {
  it('uses the initialized media bucket for signed uploads', () => {
    expect(workerSrc).toContain('/storage/v1/object/upload/sign/media/${objectPath}');
  });

  it('does not fall back to media-ingest for signed uploads', () => {
    // Guard both the old bucket and the older path ordering.
    expect(workerSrc).not.toContain('/storage/v1/object/sign/upload/media-ingest/');
    expect(workerSrc).not.toContain('/storage/v1/object/upload/sign/media-ingest/');
  });

  it('documents why media-ingest must not be recreated via SQL', () => {
    expect(migrationSrc).toContain('media-ingest bucket replaced by existing `media` bucket for ingest pipeline.');
    expect(migrationSrc).toContain('SQL INSERT is insufficient to initialize Supabase Storage signing engine;');
    expect(migrationSrc).toContain('the `media` bucket was properly initialized at project creation via Supabase CLI.');
  });
});
