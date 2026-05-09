-- =============================================================================
-- Migration: Add get_poll_tallies RPC for database-side aggregation
-- Date:      2026-05-09
--
-- Replaces in-memory aggregation of poll votes in the Worker with a
-- grouped-count query in Supabase, reducing memory pressure and
-- bandwidth for high-volume polls.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_poll_tallies(p_poll_id uuid)
RETURNS TABLE (
  option_id   text,
  vote_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.option_id,
    COUNT(*)::bigint AS vote_count
  FROM public.engagement_poll_votes v
  WHERE v.poll_id = p_poll_id
  GROUP BY v.option_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_poll_tallies(uuid) TO anon, authenticated, service_role;
