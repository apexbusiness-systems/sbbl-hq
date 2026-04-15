-- Fix backfill parser: split POTG gameResult using whitespace-delimited VS.
-- Idempotent rerun for TGIFBL potg_award rows.

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
    s.payload_summary,
    s.game_date,
    trim(parts[1]) as side_a,
    trim(parts[2]) as side_b,
    trim(regexp_replace(trim(parts[1]), '(\d{1,3})\s*$', '')) as label_a,
    trim(regexp_replace(trim(parts[2]), '(\d{1,3})\s*$', '')) as label_b,
    nullif(regexp_replace(trim(parts[1]), '.*?(\d{1,3})\s*$', '\1'), trim(parts[1]))::int as score_a,
    nullif(regexp_replace(trim(parts[2]), '.*?(\d{1,3})\s*$', '\1'), trim(parts[2]))::int as score_b
  from source_rows s
  cross join lateral (
    select regexp_split_to_array(regexp_replace(s.game_result, '\s+', ' ', 'g'), '\s+vs\s+', 'i') as parts
  ) p
  where array_length(parts, 1) = 2
    and trim(parts[1]) <> ''
    and trim(parts[2]) <> ''
),
existing as (
  select p.import_job_id, g.id as game_id
  from parsed p
  join tgif_league tl on true
  join public.games g on g.league_id = tl.league_id
    and g.category = 'league'
    and g.game_date = p.game_date
    and (
      (lower(coalesce(g.participant1_label, '')) = lower(p.label_a) and lower(coalesce(g.participant2_label, '')) = lower(p.label_b))
      or
      (lower(coalesce(g.participant1_label, '')) = lower(p.label_b) and lower(coalesce(g.participant2_label, '')) = lower(p.label_a))
    )
),
inserted as (
  insert into public.games (
    league_id, category, status, game_date,
    participant1_label, participant2_label,
    home_score, away_score, notes
  )
  select
    tl.league_id,
    'league',
    'final',
    p.game_date,
    p.label_a,
    p.label_b,
    p.score_a,
    p.score_b,
    'Backfilled from TGIFBL POTG import job'
  from parsed p
  join tgif_league tl on true
  left join existing e on e.import_job_id = p.import_job_id
  where e.game_id is null
  returning id, game_date, participant1_label, participant2_label
),
resolved_games as (
  select import_job_id, game_id from existing
  union all
  select p.import_job_id, i.id as game_id
  from parsed p
  join inserted i on i.game_date = p.game_date
    and lower(i.participant1_label) = lower(p.label_a)
    and lower(i.participant2_label) = lower(p.label_b)
  left join existing e on e.import_job_id = p.import_job_id
  where e.game_id is null
),
resolved_players as (
  select
    p.import_job_id,
    pl.id as player_id,
    coalesce((p.payload_summary->>'pts')::int, 0) as pts,
    coalesce((p.payload_summary->>'rebs')::int, 0) as reb,
    coalesce((p.payload_summary->>'assts')::int, 0) as ast
  from parsed p
  join public.profiles pr on lower(coalesce(pr.display_name, '')) = p.player_name_lc
  join public.players pl on pl.user_id = pr.user_id
),
upsert_stats as (
  insert into public.player_game_stats (game_id, player_id, pts, reb, ast)
  select rg.game_id, rp.player_id, rp.pts, rp.reb, rp.ast
  from resolved_games rg
  join resolved_players rp on rp.import_job_id = rg.import_job_id
  on conflict (game_id, player_id)
  do update set
    pts = excluded.pts,
    reb = excluded.reb,
    ast = excluded.ast,
    updated_at = now()
)
update public.import_jobs ij
set payload_summary = jsonb_set(
      coalesce(ij.payload_summary, '{}'::jsonb),
      '{game_id}',
      to_jsonb(rg.game_id::text),
      true
    )
from resolved_games rg
where ij.id = rg.import_job_id;
