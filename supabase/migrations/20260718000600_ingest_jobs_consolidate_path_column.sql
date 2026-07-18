-- Gap 6: Consolidate ingest_jobs path column drift (asset_path vs object_path).
--
-- Context: handleIngestSubmit has a runtime try/fallback that tries asset_path first,
-- then falls back to object_path when the column doesn't exist. This is evidence of
-- an incompletely-rolled-out migration across environments. This migration normalises
-- all environments to use asset_path as the canonical column name.
--
-- Rollback safety: object_path is NOT dropped here — it is retained for one release
-- cycle. Drop it in the next scheduled migration window after verifying all
-- environments have applied this migration and the runtime fallback is no longer hit.

alter table ingest_jobs
  add column if not exists asset_path text;

-- Backfill: copy any object_path values into asset_path for environments that
-- had the old column but not the new one. Wrap in a dynamic execution block so
-- that databases without the object_path column (like the main project database)
-- do not fail compiling the migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ingest_jobs'
      and column_name = 'object_path'
  ) then
    execute '
      update public.ingest_jobs
      set asset_path = object_path
      where object_path is not null
        and asset_path is null
    ';
  end if;
end $$;

comment on column ingest_jobs.asset_path is
  'Canonical storage path for the ingested object (e.g. potg/uuid.jpg). '
  'Supersedes the deprecated object_path column; both are kept during the '
  'transition window. See migration 20260718000600 for history.';

