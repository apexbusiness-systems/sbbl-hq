-- Media Intelligence Overhaul: pin support, parser metadata, bulk archive RPC
-- Migration: 20260513000000

-- ============================================================
-- 1. Pin support
-- ============================================================
ALTER TABLE media_publications
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for fast "where pinned" queries
CREATE INDEX IF NOT EXISTS idx_media_publications_pinned
  ON media_publications (pinned_at)
  WHERE pinned_at IS NOT NULL;

-- ============================================================
-- 2. Parser metadata (needs_review is BOOLEAN, NOT a status value)
-- ============================================================
ALTER TABLE media_publications
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

ALTER TABLE media_publications
  ADD COLUMN IF NOT EXISTS parser_confidence REAL DEFAULT NULL;

ALTER TABLE media_publications
  ADD COLUMN IF NOT EXISTS parser_uncertain_fields TEXT[] DEFAULT NULL;

-- ============================================================
-- 3. updated_at column (must exist before index + RPC reference it)
-- ============================================================
ALTER TABLE media_publications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 4. Trigger to maintain updated_at on every mutation
--    DEFAULT now() only applies on INSERT. Without this trigger,
--    stale cleanup (which depends on updated_at) would treat every
--    row as "never edited since creation", causing false positives.
-- ============================================================
CREATE OR REPLACE FUNCTION media_publications_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_media_publications_updated_at ON media_publications;
CREATE TRIGGER trg_media_publications_updated_at
  BEFORE UPDATE ON media_publications
  FOR EACH ROW
  EXECUTE FUNCTION media_publications_set_updated_at();

-- ============================================================
-- 5. Indexes
-- ============================================================

-- Stale cleanup: published items by age, pin status, and edit recency
CREATE INDEX IF NOT EXISTS idx_media_publications_stale_cleanup
  ON media_publications (status, published_at, pinned_at, updated_at)
  WHERE status = 'published';

-- Search: simple lower(title) index (helps prefix LIKE).
-- For full ILIKE %q% support, enable pg_trgm and use GIN trigram indexes:
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX idx_media_publications_title_trgm ON media_publications USING gin (title gin_trgm_ops);
--   CREATE INDEX idx_media_publications_subtitle_trgm ON media_publications USING gin (subtitle gin_trgm_ops);
-- Without pg_trgm, ILIKE %q% does a sequential scan but is acceptable
-- for the limited dataset sizes in this application.
CREATE INDEX IF NOT EXISTS idx_media_publications_title_lower
  ON media_publications (lower(title));

-- ============================================================
-- 6. Bulk archive RPC (transactional: validates all IDs + archives in single TX)
--    All-or-nothing: if any ID is invalid or pinned, the entire operation
--    is rejected and no rows are modified. Already-archived IDs are silently
--    skipped (idempotent) and NOT returned — the caller gets only the IDs
--    that were actually transitioned to archived in this call.
-- ============================================================
CREATE OR REPLACE FUNCTION bulk_archive_media_publications(p_ids uuid[])
RETURNS TABLE(archived_id uuid) AS $$
DECLARE
  v_invalid_ids uuid[];
  v_pinned_ids uuid[];
BEGIN
  -- Validate: find IDs that do not exist
  SELECT array_agg(t.id) INTO v_invalid_ids
    FROM UNNEST(p_ids) AS t(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM media_publications mp WHERE mp.id = t.id
    );
  IF v_invalid_ids IS NOT NULL AND array_length(v_invalid_ids, 1) > 0 THEN
    RAISE EXCEPTION 'invalid_ids: %', v_invalid_ids;
  END IF;

  -- Validate: find IDs that are pinned (must unpin first)
  SELECT array_agg(mp.id) INTO v_pinned_ids
    FROM media_publications mp
    WHERE mp.id = ANY(p_ids) AND mp.pinned_at IS NOT NULL;
  IF v_pinned_ids IS NOT NULL AND array_length(v_pinned_ids, 1) > 0 THEN
    RAISE EXCEPTION 'pinned_ids: %', v_pinned_ids;
  END IF;

  -- Atomic update: archive eligible items and return ONLY the rows
  -- actually changed. Already-archived IDs are excluded by the WHERE
  -- clause, so they never appear in the result set. The caller gets
  -- the true count of newly archived items.
  RETURN QUERY
  UPDATE media_publications
    SET status = 'archived',
        published_at = NULL,
        updated_at = now()
    WHERE id = ANY(p_ids)
      AND status != 'archived'
  RETURNING id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to service role (worker uses service-role key)
GRANT EXECUTE ON FUNCTION bulk_archive_media_publications(uuid[]) TO service_role;