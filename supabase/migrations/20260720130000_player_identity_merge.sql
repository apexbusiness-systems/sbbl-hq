-- 2026-07-20 · Player identity merge support.
-- Auto-provisioned players (parser-first POTG pipeline) can later be merged
-- into a player's real registered identity. Merge is a soft pointer — no rows
-- are deleted, stats are re-pointed, and the source row keeps full history.
alter table public.players add column if not exists merged_into uuid references public.players(id);
alter table public.players add column if not exists merged_at timestamptz;
create index if not exists idx_players_merged_into on public.players(merged_into) where merged_into is not null;
comment on column public.players.merged_into is 'Canonical player this row was merged into (identity dedup). Resolvers must follow this pointer.';
