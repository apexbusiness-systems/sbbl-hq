# Media Publications `sort_order` Migration Execution — 2026-04-16

## Scope
Applied the owner-ordering schema change directly to hosted Supabase project `ezanilxygnpucwkwpsoc`.

## SQL Applied
```sql
alter table public.media_publications
  add column if not exists sort_order integer;

alter table public.media_publications
  alter column sort_order drop not null,
  alter column sort_order set default 0;

comment on column public.media_publications.sort_order is
  'Owner-controlled manual ordering for public /media feed (ascending, nullable with default 0).';
```

## Verification Query
```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'media_publications'
  and column_name = 'sort_order';
```

## Verification Result
- `column_name`: `sort_order`
- `is_nullable`: `YES`
- `column_default`: `0`

## Notes
- `supabase db push` from this runtime could not connect to Supabase pooler TCP/5432, so migration SQL was executed via the Supabase Management API query endpoint.
