-- BLOCKER: worker handlePublicProducts filters store_products by league_id
-- but the original store_v1_launch schema never created that column. Any
-- request to /api/public/products?leagueId=... currently 400s against
-- Supabase. Add the column + index + matching FK to public.leagues.

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_products_league_id
  ON public.store_products(league_id)
  WHERE _deleted = false;
