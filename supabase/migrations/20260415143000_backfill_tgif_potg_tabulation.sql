-- Backfill TGIFBL POTG submissions into games + player_game_stats so
-- Scores, Stats, and Leaderboards include already-imported POTG rows.
-- Scope is intentionally narrow: potg_award jobs currently tagged as tgifbl.

with tgif_league as (
  select id as league_id
  from public.leagues
  where lower(code) = 'tgifbl'
  order by id
  limit 1
),
source_rows as (
  select
    ij.id as import_job_id,
    ij.payload_summary,
    lower(coalesce(ij.payload_summary->>'playerName', '')) as player_name_lc,
    coalesce(ij.payload_summary->>'gameResult', '') as game_result,
    coalesce(ij.payload_summary->>'date', '')::date as game_date
  from public.import_jobs ij
  where ij.job_type = 'potg_award'
    and lower(coalesce(ij.payload_summary->>'leagueId', '')) = 'tgifbl'
    and coalesce(ij.payload_summary->>'gameResult', '') <> ''
    and coalesce(ij.payload_summary->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
),
parsed as (
  select
    s.import_job_id,
    s.player_name_lc,
    s.game_date,
    trim(parts[1]) as side_a_raw,
    trim(parts[2]) as side_b_raw,
    nullif(regexp_replace(trim(parts[1]), '.*?(\\d{1,3})\\s*$', '\\1'), trim(parts[1]))::int as score_a,
    nullif(regexp_replace(trim(parts[2]), '.*?(\\d{1,3})\\s*$', '\\1'), trim(parts[2]))::int as score_b,
    trim(regexp_replace(trim(parts[1]), '(\\d{1,3})\\s*$', '')) as label_a,
    trim(regexp_replace(trim(parts[2]), '(\\d{1,3})\\s*$', '')) as label_b
  from source_rows s
  cross join lateral (
    select regexp_split_to_array(regexp_replace(s.game_result, '\\s+', ' ', 'g'), '\\s+vs\\s+', 'i') as parts
  ) p
  where array_length(parts, 1) = 2
),
valid as (
  select *
  from parsed
  where coalesce(label_a, '') <> ''
    and coalesce(label_b, '') <> ''
),
existing as (
  select
    v.import_job_id,
    g.id as game_id
  from valid v
  join tgif_league tl on true
  join public.games g on g.league_id = tl.league_id
   and g.category = 'league'
   and g.game_date = v.game_date
   and (
      (lower(coalesce(g.participant1_label, '')) = lower(v.label_a)
       and lower(coalesce(g.participant2_label, '')) = lower(v.label_b))
      or
      (lower(coalesce(g.participant1_label, '')) = lower(v.label_b)
       and lower(coalesce(g.participant2_label, '')) = lower(v.label_a))
   )
),
inserted_games as (
  insert into public.games (
    league_id, category, status, game_date,
    participant1_label, participant2_label,
    home_score, away_score, notes
  )
  select
    tl.league_id,
    'league',
    'final',
    v.game_date,
    v.label_a,
    v.label_b,
    v.score_a,
    v.score_b,
    'Backfilled from TGIFBL POTG import job'
  from valid v
  join tgif_league tl on true
  left join existing e on e.import_job_id = v.import_job_id
  where e.game_id is null
  returning id, game_date, participant1_label, participant2_label
),
resolved_games as (
  select e.import_job_id, e.game_id
  from existing e
  union all
  select v.import_job_id, ig.id as game_id
  from valid v
  join inserted_games ig
    on ig.game_date = v.game_date
   and lower(ig.participant1_label) = lower(v.label_a)
   and lower(ig.participant2_label) = lower(v.label_b)
  left join existing e on e.import_job_id = v.import_job_id
  where e.game_id is null
),
resolved_players as (
  select
    v.import_job_id,
    p.id as player_id,
    coalesce((s.payload_summary->>'pts')::int, 0) as pts,
    coalesce((s.payload_summary->>'rebs')::int, 0) as reb,
    coalesce((s.payload_summary->>'assts')::int, 0) as ast
  from valid v
  join source_rows s on s.import_job_id = v.import_job_id
  join public.profiles pr on lower(coalesce(pr.display_name, '')) = s.player_name_lc
  join public.players p on p.user_id = pr.user_id
),
upsert_stats as (
  insert into public.player_game_stats (game_id, player_id, pts, reb, ast)
  select
    rg.game_id,
    rp.player_id,
    rp.pts,
    rp.reb,
    rp.ast
  from resolved_games rg
  join resolved_players rp on rp.import_job_id = rg.import_job_id
  on conflict (game_id, player_id)
  do update set
    pts = excluded.pts,
    reb = excluded.reb,
    ast = excluded.ast,
    updated_at = now()
  returning game_id, player_id
)
update public.import_jobs ij
set payload_summary = jsonb_set(
      coalesce(ij.payload_summary, '{}'::jsonb),
      '{game_id}',
      to_jsonb(rg.game_id::text),
      true
    )
from resolved_games rg
where ij.id = rg.import_job_id
  and (ij.payload_summary->>'game_id') is null;
