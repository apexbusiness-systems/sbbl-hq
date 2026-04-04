-- P2-D: Standings materialized view + trigger refresh on Game→final
--
-- Problem: The /api/teams endpoint re-computes standings in the Worker by
-- fetching ALL finalized games, iterating them in JS memory, and building
-- win/loss records per team. At 10K+ games this becomes a full table scan
-- per API call and grows linearly with season length.
--
-- Solution:
--   1. mvw_standings — materialized view pre-aggregating W/L/pts per
--      (league_id, season_id, team_id). Refreshed incrementally on-demand.
--   2. fn_refresh_standings_trigger() — AFTER UPDATE trigger function that
--      calls REFRESH MATERIALIZED VIEW CONCURRENTLY when a game's status
--      transitions to 'final'. CONCURRENTLY avoids a table lock and allows
--      concurrent reads during refresh.
--   3. trg_games_refresh_standings — the trigger binding.
--   4. Realtime publication on mvw_standings so the Teams page can subscribe
--      to standings updates via Supabase Realtime.
--
-- Note: REFRESH MATERIALIZED VIEW CONCURRENTLY requires at least one UNIQUE
-- index on the materialized view. We add idx_mvw_standings_unique below.

-- ── Drop old view and trigger if re-running migration ─────────────────────────
drop trigger if exists trg_games_refresh_standings on public.games;
drop function if exists public.fn_refresh_standings_trigger();
drop materialized view if exists public.mvw_standings;

-- ── Materialized view ─────────────────────────────────────────────────────────
create materialized view public.mvw_standings as
with game_results as (
  -- Each game produces two rows: one for home team, one for away team.
  select
    g.league_id,
    g.season_id,
    g.home_team_id                                        as team_id,
    1                                                     as games_played,
    case when g.home_score > g.away_score then 1 else 0 end as wins,
    case when g.home_score < g.away_score then 1 else 0 end as losses,
    coalesce(g.home_score, 0)                             as pts_for,
    coalesce(g.away_score, 0)                             as pts_against
  from public.games g
  where g.status = 'final'
    and g.home_score is not null
    and g.away_score is not null

  union all

  select
    g.league_id,
    g.season_id,
    g.away_team_id                                        as team_id,
    1                                                     as games_played,
    case when g.away_score > g.home_score then 1 else 0 end as wins,
    case when g.away_score < g.home_score then 1 else 0 end as losses,
    coalesce(g.away_score, 0)                             as pts_for,
    coalesce(g.home_score, 0)                             as pts_against
  from public.games g
  where g.status = 'final'
    and g.home_score is not null
    and g.away_score is not null
)
select
  gr.league_id,
  gr.season_id,
  gr.team_id,
  t.name                              as team_name,
  sum(gr.games_played)::int           as games_played,
  sum(gr.wins)::int                   as wins,
  sum(gr.losses)::int                 as losses,
  sum(gr.pts_for)::int                as pts_for,
  sum(gr.pts_against)::int            as pts_against,
  round(
    case
      when sum(gr.games_played) > 0
        then sum(gr.wins)::numeric / sum(gr.games_played)::numeric
      else 0
    end,
    3
  )                                   as win_pct,
  now()                               as refreshed_at
from game_results gr
join public.teams t on t.id = gr.team_id
group by gr.league_id, gr.season_id, gr.team_id, t.name
with data;

comment on materialized view public.mvw_standings is
  'Pre-computed W/L/pts standings per (league_id, season_id, team_id). '
  'Refreshed CONCURRENTLY after each game transitions to status = ''final''.';

-- ── Unique index (required for CONCURRENTLY refresh) ─────────────────────────
create unique index idx_mvw_standings_unique
  on public.mvw_standings (league_id, season_id, team_id);

-- ── Supporting indexes ────────────────────────────────────────────────────────
create index if not exists idx_mvw_standings_league
  on public.mvw_standings (league_id);

create index if not exists idx_mvw_standings_season
  on public.mvw_standings (season_id);

create index if not exists idx_mvw_standings_win_pct
  on public.mvw_standings (league_id, season_id, win_pct desc);

-- ── RLS on mvw_standings (public read — standings are not sensitive) ──────────
alter materialized view public.mvw_standings owner to postgres;

-- We rely on Postgres table security rather than RLS (materialized views don't
-- support RLS policies directly). Grant SELECT to the anon and authenticated
-- roles so the client SDK can query it without elevation.
grant select on public.mvw_standings to anon, authenticated;

-- ── Trigger: REFRESH CONCURRENTLY on game→final transition ───────────────────
create or replace function public.fn_refresh_standings_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only refresh when a game newly reaches 'final' status.
  -- This covers both UPDATE (status changed) and INSERT directly as 'final'.
  if (TG_OP = 'UPDATE' and NEW.status = 'final' and OLD.status <> 'final')
     or (TG_OP = 'INSERT' and NEW.status = 'final')
  then
    -- CONCURRENTLY: allows concurrent SELECTs during refresh; requires the
    -- unique index idx_mvw_standings_unique created above.
    refresh materialized view concurrently public.mvw_standings;
  end if;
  return null; -- AFTER trigger, return value is ignored
end;
$$;

comment on function public.fn_refresh_standings_trigger() is
  'AFTER INSERT OR UPDATE trigger on games: refreshes mvw_standings '
  'CONCURRENTLY whenever a game transitions to status = ''final''.';

create trigger trg_games_refresh_standings
  after insert or update of status
  on public.games
  for each row
  execute function public.fn_refresh_standings_trigger();

comment on trigger trg_games_refresh_standings on public.games is
  'Fires after any game INSERT or status UPDATE to refresh the standings '
  'materialized view when the game reaches final status.';

-- ── Realtime publication ──────────────────────────────────────────────────────
-- Supabase Realtime listens to the supabase_realtime publication.
-- Adding mvw_standings lets the Teams page subscribe to standings changes
-- via supabase.channel().on('postgres_changes', ...) without polling.
-- Note: Supabase Realtime on materialized views requires PG 15+ and the
-- logical replication WAL level; this is a best-effort addition.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mvw_standings'
  ) then
    alter publication supabase_realtime add table public.mvw_standings;
  end if;
exception
  -- Publication may not exist in all environments (e.g., local dev without
  -- Realtime configured). Silently skip rather than fail the migration.
  when undefined_object then null;
  when feature_not_supported then null;
end;
$$;
