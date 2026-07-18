-- Migration: secure_ingest_reconciliation_view
-- Fixes: Security Definer View issue on public.v_ingest_reconciliation by defining with security_invoker = true.

CREATE OR REPLACE VIEW public.v_ingest_reconciliation WITH (security_invoker = true) AS
  -- a) Orphan media_assets: published but no media_publications row
  SELECT
    'orphan_asset'         AS anomaly_class,
    ma.id                  AS ref_id,
    ma.title               AS description,
    ma.created_at          AS detected_at
  FROM public.media_assets ma
  WHERE ma.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM public.media_publications mp
      WHERE mp.media_asset_id = ma.id
        AND mp.status = 'published'
    )

  UNION ALL

  -- b) Stale drafts: media_publications in 'draft' for > 7 days
  SELECT
    'stale_draft',
    mp.id,
    mp.title,
    mp.sort_at
  FROM public.media_publications mp
  WHERE mp.status = 'draft'
    AND mp.sort_at < now() - interval '7 days'

  UNION ALL

  -- c) Stuck ingest_jobs: in non-terminal state for > 1 hour
  SELECT
    'stuck_ingest_job',
    ij.id,
    'kind=' || ij.kind || ' state=' || ij.state,
    ij.created_at
  FROM public.ingest_jobs ij
  WHERE ij.state NOT IN ('published','failed')
    AND ij.updated_at < now() - interval '1 hour'

  UNION ALL

  -- d) Missing projections: ingest_job written but no publication_id
  SELECT
    'missing_projection',
    ij.id,
    'media_asset_id=' || coalesce(ij.media_asset_id::text, 'null'),
    ij.created_at
  FROM public.ingest_jobs ij
  WHERE ij.state IN ('written','projected')
    AND ij.publication_id IS NULL
    AND ij.updated_at < now() - interval '30 minutes';
