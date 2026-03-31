-- Replace stub get_stats_dashboard with real aggregation over player_game_stats.
-- Returns per-player averages (pts, reb, ast, stl, blk, fls, min) joined with
-- profile display_name, team name, and league code.
CREATE OR REPLACE FUNCTION public.get_stats_dashboard(p_filters jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'players', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY (row_to_json(s)->>'pts')::numeric DESC)
      FROM (
        SELECT
          p.user_id AS id,
          COALESCE(pr.display_name, 'Unknown') AS name,
          p.jersey_number AS number,
          p.position,
          p.team_id,
          t.name AS team_name,
          l.code AS league_id,
          ROUND(AVG(pgs.pts)::numeric, 1) AS pts,
          ROUND(AVG(pgs.reb)::numeric, 1) AS reb,
          ROUND(AVG(pgs.ast)::numeric, 1) AS ast,
          ROUND(AVG(pgs.stl)::numeric, 1) AS stl,
          ROUND(AVG(pgs.blk)::numeric, 1) AS blk,
          ROUND(AVG(pgs.fls)::numeric, 1) AS fls,
          ROUND(AVG(pgs.min)::numeric, 1) AS min,
          COUNT(pgs.id) AS games
        FROM public.player_game_stats pgs
        JOIN public.players p ON p.user_id = pgs.player_id
        LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
        LEFT JOIN public.teams t ON t.id = p.team_id
        LEFT JOIN public.leagues l ON l.id = p.league_id
        GROUP BY p.user_id, pr.display_name, p.jersey_number, p.position, p.team_id, t.name, l.code
        ORDER BY AVG(pgs.pts) DESC
      ) s
    ), '[]'::jsonb)
  );
END;
$$;

-- Replace stub get_leaderboards with ranked aggregation, filterable by league code.
CREATE OR REPLACE FUNCTION public.get_leaderboards(p_filters jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_league_id uuid;
BEGIN
  IF p_filters IS NOT NULL AND p_filters ? 'league' THEN
    SELECT id INTO v_league_id FROM public.leagues
    WHERE code ILIKE (p_filters->>'league') LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'leaders', COALESCE((
      SELECT jsonb_agg(row_to_json(s))
      FROM (
        SELECT
          p.user_id AS id,
          COALESCE(pr.display_name, 'Unknown') AS name,
          p.jersey_number AS number,
          p.position,
          t.name AS team_name,
          l.code AS league_id,
          ROUND(AVG(pgs.pts)::numeric, 1) AS pts,
          ROUND(AVG(pgs.reb)::numeric, 1) AS reb,
          ROUND(AVG(pgs.ast)::numeric, 1) AS ast,
          RANK() OVER (ORDER BY AVG(pgs.pts) DESC) AS rank
        FROM public.player_game_stats pgs
        JOIN public.players p ON p.user_id = pgs.player_id
        LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
        LEFT JOIN public.teams t ON t.id = p.team_id
        LEFT JOIN public.leagues l ON l.id = p.league_id
        WHERE (v_league_id IS NULL OR p.league_id = v_league_id)
        GROUP BY p.user_id, pr.display_name, p.jersey_number, p.position, t.name, l.code
        ORDER BY AVG(pgs.pts) DESC
        LIMIT 50
      ) s
    ), '[]'::jsonb)
  );
END;
$$;
