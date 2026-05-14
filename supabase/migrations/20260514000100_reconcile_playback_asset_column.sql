-- Additive reconciliation for broadcast playback asset addressing.
-- Retains collection_id and mirrors it into playback_asset_id for readers that
-- now consume the normalized playback column.

alter table public.stream_admin_config
  add column if not exists playback_asset_id text;

update public.stream_admin_config
set playback_asset_id = collection_id
where playback_asset_id is null
  and collection_id is not null
  and collection_id <> '';
