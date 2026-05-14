-- Migration: 20260514000100_media_publications_pinning_needs_review
-- Adds pinned_at, needs_review, and parser_confidence columns to media_publications.
-- These fields support the touch-first media command center:
--   - pinned_at: non-null means item is pinned; excluded from stale cleanup
--   - needs_review: parser flagged low-confidence output requiring operator review
--   - parser_confidence: 0.0–1.0 parser confidence score (null if not AI-parsed)

ALTER TABLE media_publications
  ADD COLUMN IF NOT EXISTS pinned_at         TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS needs_review      BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parser_confidence NUMERIC(5,4) NULL
    CONSTRAINT chk_parser_confidence_range CHECK (parser_confidence IS NULL OR (parser_confidence >= 0 AND parser_confidence <= 1));

-- Index for pinned-item fast path (exclude from stale cleanup)
CREATE INDEX IF NOT EXISTS idx_media_publications_pinned_at
  ON media_publications (pinned_at)
  WHERE pinned_at IS NOT NULL;

-- Index for needs_review triage queue
CREATE INDEX IF NOT EXISTS idx_media_publications_needs_review
  ON media_publications (needs_review)
  WHERE needs_review = TRUE;

COMMENT ON COLUMN media_publications.pinned_at IS
  'Non-null = pinned. Pinned media is excluded from stale cleanup and cannot be archived until unpinned.';
COMMENT ON COLUMN media_publications.needs_review IS
  'Parser flagged this item as needing operator review (low confidence, uncertain fields, etc).';
COMMENT ON COLUMN media_publications.parser_confidence IS
  '0.0–1.0 parser confidence from AI ingest. NULL if not AI-parsed.';
