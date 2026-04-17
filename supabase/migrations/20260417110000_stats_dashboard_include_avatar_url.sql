-- Patch get_stats_dashboard to return profile avatar_url.
--
-- Why: Stats.tsx and Leaderboards.tsx render `<img src={p.avatar}>`, but the
-- worker's normalizePublicPlayerRow hardcoded `avatar: ""` because the RPC
-- didn't expose profiles.avatar_url. Every player therefore rendered a
-- broken-image placeholder (screenshots 2026-04-17). This adds the
-- `avatar_url` column to the jsonb shape so the worker + UI can stop
-- hardcoding and start passing the real URL through.
--
-- Also widens the leaderboard coverage: the old query filtered via INNER
-- JOIN to player_game_stats which silently dropped every rostered player
-- who hadn't received a stat entry yet. We now LEFT JOIN so the full
-- roster surfaces with zero-average rows, and the UI's empty-state copy
-- ("select a player") continues to work.

CREATE OR REPLACE FUNCTION public.get_stats_dashboard(
  p_filters jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_league_id uuid;
BEGIN
  IF p_filters IS NOT NULL AND p_filters ? 'league' THEN
    SELECT id INTO v_league_id FROM public.leagues
    WHERE code ILIKE (p_filters->>'league') LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'players', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY (row_to_json(s)->>'pts')::numeric DESC NULLS LAST)
      FROM (
        SELECT
          p.user_id                         AS id,
          COALESCE(pr.display_name, pr.full_name, 'Unknown') AS name,
          p.jersey_number                   AS number,
          p.position,
          p.team_id,
          t.name                            AS team_name,
          l.code                            AS league_id,
          pr.avatar_url                     AS avatar_url,
          COALESCE(ROUND(AVG(pgs.pts)::numeric, 1), 0) AS pts,
          COALESCE(ROUND(AVG(pgs.reb)::numeric, 1), 0) AS reb,
          COALESCE(ROUND(AVG(pgs.ast)::numeric, 1), 0) AS ast,
          COALESCE(ROUND(AVG(pgs.stl)::numeric, 1), 0) AS stl,
          COALESCE(ROUND(AVG(pgs.blk)::numeric, 1), 0) AS blk,
          COALESCE(ROUND(AVG(pgs.fls)::numeric, 1), 0) AS fls,
          COALESCE(ROUND(AVG(pgs.min)::numeric, 1), 0) AS min,
          COUNT(pgs.id)                                AS games
        FROM public.players p
        LEFT JOIN public.player_game_stats pgs ON pgs.player_id = p.user_id
        LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
        LEFT JOIN public.teams    t  ON t.id = p.team_id
        LEFT JOIN public.leagues  l  ON l.id = p.league_id
        WHERE v_league_id IS NULL OR p.league_id = v_league_id
        GROUP BY p.user_id, pr.display_name, pr.full_name, p.jersey_number,
                 p.position, p.team_id, t.name, l.code, pr.avatar_url
      ) s
    ), '[]'::jsonb)
  );
END;
$function$;

-- Grant execute to authenticated + anon (it was already callable; this is
-- defensive against future PRIVILEGES changes).
GRANT EXECUTE ON FUNCTION public.get_stats_dashboard(jsonb) TO authenticated, anon, service_role;
