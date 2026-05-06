-- Backfill games + player_game_stats from published POTG media_publications.
--
-- Context: Historical POTG posters were uploaded directly through the media
-- pipeline and never produced `potg_award` import_jobs rows, so the earlier
-- backfills in 20260415143000/153000/160000 skipped them. Stats and
-- Leaderboards therefore saw only 2 players even though 23 POTG cards were
-- live on /home. This migration reads the render_payload stored on each
-- published POTG publication and tabulates it into games + player_game_stats.
--
-- Idempotent: reruns do nothing because
--   • games is upserted via "existing" CTE (match by label_a/label_b + date),
--   • player_game_stats has ON CONFLICT (game_id, player_id) DO UPDATE,
--   • media_publications gets two metadata flags once backfilled so the
--     second run's `source` CTE becomes empty (see final UPDATE).

with source as (
  select
    mp.id                                                       as pub_id,
    mp.league_id                                                as league_id,
    lower(coalesce(mp.render_payload->>'playerName',''))         as player_name_lc,
    coalesce(mp.render_payload->>'playerName','')                as player_name,
    coalesce(mp.render_payload->>'team','')                      as team_name,
    coalesce(mp.render_payload->>'gameResult','')                as game_result,
    nullif(coalesce(mp.render_payload->>'date',''),'')::date     as game_date,
    coalesce((mp.render_payload->>'pts')::int, 0)                as pts,
    coalesce((mp.render_payload->>'rebs')::int, 0)               as reb,
    coalesce((mp.render_payload->>'assts')::int, 0)              as ast
  from public.media_publications mp
  where mp.surface = 'potg'
    and mp.status  = 'published'
    and mp.league_id is not null
    and coalesce(mp.render_payload->>'playerName','') <> ''
    and coalesce(mp.render_payload->>'gameResult','') <> ''
    and coalesce(mp.render_payload->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
    and coalesce(mp.render_payload->>'stats_backfilled','') <> 'true'
),
parsed as (
  select
    s.*,
    trim(parts[1])                                                         as side_a,
    trim(parts[2])                                                         as side_b,
    trim(regexp_replace(trim(parts[1]), '(\d{1,3})\s*$', ''))              as label_a,
    trim(regexp_replace(trim(parts[2]), '(\d{1,3})\s*$', ''))              as label_b,
    nullif(regexp_replace(trim(parts[1]), '.*?(\d{1,3})\s*$', '\1'),
           trim(parts[1]))::int                                            as score_a,
    nullif(regexp_replace(trim(parts[2]), '.*?(\d{1,3})\s*$', '\1'),
           trim(parts[2]))::int                                            as score_b
  from source s
  cross join lateral (
    select regexp_split_to_array(
      regexp_replace(s.game_result, '\s+', ' ', 'g'),
      '\s+vs\s+', 'i'
    ) as parts
  ) p
  where array_length(parts, 1) = 2
    and trim(parts[1]) <> ''
    and trim(parts[2]) <> ''
),
valid as (
  -- Only rows where BOTH labels parsed non-empty (score may be null; final
  -- status 'final' implies score present — we keep rows with null scores as
  -- partial records so the PGS entry is still tabulated).
  select *
  from parsed
  where coalesce(label_a,'') <> '' and coalesce(label_b,'') <> ''
),
existing as (
  -- Exact-match lookup against games already present (by label pair + date).
  select v.pub_id, g.id as game_id
  from valid v
  join public.games g
    on g.league_id = v.league_id
   and g.category  = 'league'
   and g.game_date = v.game_date
   and (
     (lower(coalesce(g.participant1_label,'')) = lower(v.label_a)
      and lower(coalesce(g.participant2_label,'')) = lower(v.label_b))
     or
     (lower(coalesce(g.participant1_label,'')) = lower(v.label_b)
      and lower(coalesce(g.participant2_label,'')) = lower(v.label_a))
   )
),
inserted as (
  insert into public.games (
    league_id, category, status, game_date,
    participant1_label, participant2_label,
    home_score, away_score, notes
  )
  select
    v.league_id, 'league', 'final', v.game_date,
    v.label_a, v.label_b,
    v.score_a, v.score_b,
    'Backfilled from POTG media_publications'
  from valid v
  left join existing e on e.pub_id = v.pub_id
  where e.game_id is null
  returning id, league_id, game_date, participant1_label, participant2_label
),
resolved_games as (
  select pub_id, game_id from existing
  union all
  select v.pub_id, i.id as game_id
  from valid v
  join inserted i
    on i.league_id = v.league_id
   and i.game_date = v.game_date
   and lower(i.participant1_label) = lower(v.label_a)
   and lower(i.participant2_label) = lower(v.label_b)
  left join existing e on e.pub_id = v.pub_id
  where e.game_id is null
),
-- Resolve the player: prefer matching on profile.display_name; fall back to
-- a deterministic synthetic UUID so every POTG card tabulates stats even
-- when the player's profile doesn't exist yet (coach/admin can merge later).
matched_profile as (
  select v.pub_id, p.id as player_id
  from valid v
  join public.profiles pr on lower(coalesce(pr.display_name,'')) = v.player_name_lc
  join public.players p on p.user_id = pr.user_id
),
synthetic as (
  select
    v.pub_id, v.league_id, v.player_name,
    (
      substr(md5('potg-media:' || v.pub_id::text), 1, 8)  || '-' ||
      substr(md5('potg-media:' || v.pub_id::text), 9, 4)  || '-' ||
      substr(md5('potg-media:' || v.pub_id::text), 13, 4) || '-' ||
      substr(md5('potg-media:' || v.pub_id::text), 17, 4) || '-' ||
      substr(md5('potg-media:' || v.pub_id::text), 21, 12)
    )::uuid as synthetic_user_id
  from valid v
  left join matched_profile mp on mp.pub_id = v.pub_id
  where mp.player_id is null
),
ins_profiles as (
  insert into public.profiles (user_id, display_name)
  select s.synthetic_user_id, s.player_name from synthetic s
  on conflict (user_id) do update set display_name = excluded.display_name
  returning user_id
),
ins_players as (
  insert into public.players (id, user_id, league_id)
  select s.synthetic_user_id, s.synthetic_user_id, s.league_id from synthetic s
  on conflict (user_id) do update set league_id = excluded.league_id
  returning id, user_id
),
resolved_players as (
  select pub_id, player_id from matched_profile
  union all
  select s.pub_id, s.synthetic_user_id as player_id from synthetic s
),
ups as (
  insert into public.player_game_stats (game_id, player_id, pts, reb, ast)
  select rg.game_id, rp.player_id, v.pts, v.reb, v.ast
  from resolved_games rg
  join resolved_players rp on rp.pub_id = rg.pub_id
  join valid v             on v.pub_id  = rg.pub_id
  on conflict (game_id, player_id)
  do update set pts = excluded.pts, reb = excluded.reb, ast = excluded.ast,
                updated_at = now()
  returning game_id, player_id
)
update public.media_publications mp
set render_payload = jsonb_set(
  jsonb_set(coalesce(mp.render_payload, '{}'::jsonb),
            '{stats_backfilled}', 'true'::jsonb, true),
  '{stats_backfilled_game_id}', to_jsonb(rg.game_id::text), true
)
from resolved_games rg
where mp.id = rg.pub_id;
