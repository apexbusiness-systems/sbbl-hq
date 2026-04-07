create table media_publications (
  id                uuid        primary key default gen_random_uuid(),
  media_asset_id    uuid        not null references media_assets(id) on delete cascade,
  surface           text        not null check (surface in (
                                  'media_feed','store','potg','event','score','feature'
                                )),
  league_id         uuid        null references leagues(id),
  title             text        not null,
  subtitle          text        null,
  status            text        not null check (status in (
                                  'draft','scheduled','published','archived'
                                )),
  published_at      timestamptz null,
  scheduled_at      timestamptz null,
  sort_at           timestamptz not null default now(),
  render_payload    jsonb       not null default '{}'::jsonb,
  unique (media_asset_id, surface)
);

-- RLS: Super-Admin write, public read of published rows only
alter table media_publications enable row level security;

create policy "super_admin_full_access" on media_publications
  for all using (auth.jwt() ->> 'role' = 'super_admin');

create policy "public_read_published" on media_publications
  for select using (status = 'published');
