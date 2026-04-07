-- ============================================================================
-- Migration: media_publications + ingest_jobs
-- Purpose: Canonical publication layer + state-machine job tracker
-- Safe: additive-only, no existing table modifications
-- ============================================================================

-- 1. ingest_jobs — state machine tracker for all media ingest operations
CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  state text NOT NULL DEFAULT 'uploaded'
    CHECK (state IN ('uploaded','validated','written','projected','published','failed','needs_review')),
  media_asset_id uuid REFERENCES public.media_assets(id),
  publication_id uuid, -- FK added after media_publications created
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_detail text,
  retry_count int NOT NULL DEFAULT 0,
  idempotency_key text UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. media_publications — approved media for public rendering
CREATE TABLE IF NOT EXISTS public.media_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id),
  league_id uuid REFERENCES public.leagues(id),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'poster'
    CHECK (type IN ('poster','highlight','clip','photo','event_graphic')),
  thumbnail_url text NOT NULL,
  status public.publish_status NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from ingest_jobs to media_publications
ALTER TABLE public.ingest_jobs
  ADD CONSTRAINT ingest_jobs_publication_id_fkey
  FOREIGN KEY (publication_id) REFERENCES public.media_publications(id);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_publications_status_published_at
  ON public.media_publications (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_publications_media_asset_id
  ON public.media_publications (media_asset_id);
CREATE INDEX IF NOT EXISTS idx_media_publications_league_id
  ON public.media_publications (league_id);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_state
  ON public.ingest_jobs (state);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_idempotency_key
  ON public.ingest_jobs (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_media_asset_id
  ON public.ingest_jobs (media_asset_id);

-- 4. RLS — media_publications readable by public, ingest_jobs service-only
ALTER TABLE public.media_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_publications_public_read ON public.media_publications;
CREATE POLICY media_publications_public_read
  ON public.media_publications FOR SELECT
  USING (status = 'published');

-- ingest_jobs: no public policies → service-role only access

-- 5. updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_media_publications_updated_at ON public.media_publications;
CREATE TRIGGER trg_media_publications_updated_at
  BEFORE UPDATE ON public.media_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ingest_jobs_updated_at ON public.ingest_jobs;
CREATE TRIGGER trg_ingest_jobs_updated_at
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
