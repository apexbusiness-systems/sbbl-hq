DROP TRIGGER IF EXISTS trg_games_refresh_standings ON public.games;

-- FOR EACH STATEMENT: one refresh per bulk CSV import/finalize batch instead
-- of one per row. Uses a transition table so the trigger only fires when at
-- least one row in the statement actually reached 'final'.
CREATE OR REPLACE FUNCTION public.fn_refresh_standings_trigger_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM new_games WHERE status = 'final') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mvw_standings;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_games_refresh_standings_stmt
  AFTER INSERT OR UPDATE OF status ON public.games
  REFERENCING NEW TABLE AS new_games
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fn_refresh_standings_trigger_stmt();
