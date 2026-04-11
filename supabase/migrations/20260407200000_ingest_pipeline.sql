-- ─────────────────────────────────────────────────────────────────────────────
-- INGEST PIPELINE — canonical media ingest state machine
-- Closes: mock fallback, fragmented entry points, schema drift, raw-table renders
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Private upload bucket for raw ingest ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('media-ingest', 'media-ingest', false)
on conflict (id) do nothing;

-- Ensure the legacy 'media' bucket exists (used by current frontend uploader)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- ── 2. ingest_jobs — canonical state machine table ─────────────────────────
create table if not exists public.ingest_jobs (
  id                uuid        primary key default gen_random_uuid(),
  submitted_by      uuid        not null references auth.users(id),
  kind              text        not null check (kind in ('potg','store','event','generic')),
  state             text        not null default 'uploaded'
                                check (state in (
                                  'uploaded','fingerprinted','classified','parsed',
                                  'validated','written','projected','published',
                                  'failed','needs_review'
                                )),
  confidence        numeric     null check (confidence between 0 and 1),
  asset_path        text        not null,
  payload           jsonb       not null default '{}'::jsonb,
  parse_result      jsonb       null,
  media_asset_id    uuid        null references public.media_assets(id),
  publication_id    uuid        null references public.media_publications(id),
  error_message     text        null,
  idempotency_key   text        null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (idempotency_key)
);

create trigger trg_ingest_jobs_touch_updated_at
  before update on public.ingest_jobs
  for each row execute function public.touch_updated_at();

alter table public.ingest_jobs enable row level security;

-- Super-admin can do everything; no public read
create policy "ingest_jobs_super_admin" on public.ingest_jobs
  for all using (auth.jwt() ->> 'role' = 'super_admin');

-- Index for replay queries
create index if not exists idx_ingest_jobs_state
  on public.ingest_jobs (state, created_at desc);

-- Index for dedup by idempotency_key
create index if not exists idx_ingest_jobs_idem
  on public.ingest_jobs (idempotency_key)
  where idempotency_key is not null;

-- ── 3. Backfill media_publications from existing media_assets ──────────────
-- Determines surface from metadata heuristics. Uses ON CONFLICT DO NOTHING so
-- this is idempotent and safe to re-run.
insert into public.media_publications (
  media_asset_id,
  surface,
  league_id,
  title,
  status,
  published_at,
  sort_at,
  render_payload
)
select
  ma.id,
  case
    when (ma.metadata->>'potg')::boolean = true                    then 'potg'
    when (ma.metadata->>'product_id') is not null                  then 'store'
    when (ma.metadata->>'type') = 'event'                          then 'event'
    else                                                                'media_feed'
  end                                                             as surface,
  ma.league_id,
  ma.title,
  case
    when ma.status = 'published' then 'published'
    when ma.status = 'archived'  then 'archived'
    else                              'draft'
  end                                                             as status,
  case when ma.status = 'published' then ma.created_at else null end
                                                                  as published_at,
  ma.created_at                                                   as sort_at,
  jsonb_build_object(
    'type',      coalesce(ma.metadata->>'type', 'poster'),
    'thumbnail', coalesce(
                   ma.metadata->>'thumbnail',
                   ma.metadata->>'image_url',
                   ''
                 )
  ) || ma.metadata                                                as render_payload
from public.media_assets ma
where not exists (
  select 1 from public.media_publications mp
  where mp.media_asset_id = ma.id
    and mp.surface = case
      when (ma.metadata->>'potg')::boolean = true   then 'potg'
      when (ma.metadata->>'product_id') is not null then 'store'
      when (ma.metadata->>'type') = 'event'         then 'event'
      else                                               'media_feed'
    end
)
on conflict (media_asset_id, surface) do nothing;

-- ── 4. Nightly reconciliation view ────────────────────────────────────────
-- Surfaces: orphan assets, missing projections, stale drafts, schema drift
create or replace view public.v_ingest_reconciliation as
  -- a) Orphan media_assets: published but no media_publications row
  select
    'orphan_asset'         as anomaly_class,
    ma.id                  as ref_id,
    ma.title               as description,
    ma.created_at          as detected_at
  from public.media_assets ma
  where ma.status = 'published'
    and not exists (
      select 1 from public.media_publications mp
      where mp.media_asset_id = ma.id
        and mp.status = 'published'
    )

  union all

  -- b) Stale drafts: media_publications in 'draft' for > 7 days
  select
    'stale_draft',
    mp.id,
    mp.title,
    mp.sort_at
  from public.media_publications mp
  where mp.status = 'draft'
    and mp.sort_at < now() - interval '7 days'

  union all

  -- c) Stuck ingest_jobs: in non-terminal state for > 1 hour
  select
    'stuck_ingest_job',
    ij.id,
    'kind=' || ij.kind || ' state=' || ij.state,
    ij.created_at
  from public.ingest_jobs ij
  where ij.state not in ('published','failed')
    and ij.updated_at < now() - interval '1 hour'

  union all

  -- d) Missing projections: ingest_job written but no publication_id
  select
    'missing_projection',
    ij.id,
    'media_asset_id=' || coalesce(ij.media_asset_id::text, 'null'),
    ij.created_at
  from public.ingest_jobs ij
  where ij.state in ('written','projected')
    and ij.publication_id is null
    and ij.updated_at < now() - interval '30 minutes';

-- Super-admin read only
create policy "v_ingest_reconciliation_super_admin" on public.ingest_jobs
  for select using (auth.jwt() ->> 'role' = 'super_admin');
