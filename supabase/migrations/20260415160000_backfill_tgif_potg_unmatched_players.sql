-- Create deterministic placeholder profile/player rows for unmatched TGIFBL POTG imports
-- so stats/leaderboards can tabulate imported POTG rows immediately.

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
    coalesce(ij.payload_summary->>'playerName', '') as player_name,
    coalesce(ij.payload_summary->>'team', '') as team_name,
    coalesce(ij.payload_summary->>'game_id', '') as game_id_text,
    coalesce((ij.payload_summary->>'pts')::int, 0) as pts,
    coalesce((ij.payload_summary->>'rebs')::int, 0) as reb,
    coalesce((ij.payload_summary->>'assts')::int, 0) as ast
  from public.import_jobs ij
  where ij.job_type = 'potg_award'
    and lower(coalesce(ij.payload_summary->>'leagueId', '')) = 'tgifbl'
    and coalesce(ij.payload_summary->>'matched_profile_id', '') = ''
    and coalesce(ij.payload_summary->>'game_id', '') ~ '^[0-9a-fA-F-]{36}$'
),
resolved as (
  select
    s.*,
    (
      substr(md5('potg-unmatched:' || s.import_job_id::text), 1, 8) || '-' ||
      substr(md5('potg-unmatched:' || s.import_job_id::text), 9, 4) || '-' ||
      substr(md5('potg-unmatched:' || s.import_job_id::text), 13, 4) || '-' ||
      substr(md5('potg-unmatched:' || s.import_job_id::text), 17, 4) || '-' ||
      substr(md5('potg-unmatched:' || s.import_job_id::text), 21, 12)
    )::uuid as synthetic_user_id
  from source_rows s
),
upsert_profiles as (
  insert into public.profiles (user_id, display_name)
  select r.synthetic_user_id, r.player_name
  from resolved r
  on conflict (user_id)
  do update set display_name = excluded.display_name
  returning user_id
),
upsert_players as (
  insert into public.players (id, user_id, league_id)
  select r.synthetic_user_id, r.synthetic_user_id, tl.league_id
  from resolved r
  join tgif_league tl on true
  on conflict (user_id)
  do update set league_id = excluded.league_id
  returning id, user_id
),
upsert_stats as (
  insert into public.player_game_stats (game_id, player_id, pts, reb, ast)
  select
    r.game_id_text::uuid,
    r.synthetic_user_id,
    r.pts,
    r.reb,
    r.ast
  from resolved r
  on conflict (game_id, player_id)
  do update set
    pts = excluded.pts,
    reb = excluded.reb,
    ast = excluded.ast,
    updated_at = now()
)
update public.import_jobs ij
set payload_summary = jsonb_set(
      jsonb_set(coalesce(ij.payload_summary, '{}'::jsonb), '{matched_profile_id}', to_jsonb(r.synthetic_user_id::text), true),
      '{matched_player_placeholder}',
      'true'::jsonb,
      true
    )
from resolved r
where ij.id = r.import_job_id;
