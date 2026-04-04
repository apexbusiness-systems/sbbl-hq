-- P2-C: Query pattern indexes — keyset pagination support
--
-- Supports the keyset cursor (ORDER BY created_at DESC, ?before= parameter)
-- on the /api/scores endpoint (handleScoresList) and the import_jobs admin
-- history endpoints. All indexes use IF NOT EXISTS so the migration is
-- safely idempotent on re-run.

-- games: keyset cursor — ORDER BY created_at DESC used by /api/scores
-- Includes status for the filter push-down (WHERE status = 'final' or IN (...))
create index if not exists idx_games_created_at_desc
  on public.games (created_at desc);

create index if not exists idx_games_status_created_at
  on public.games (status, created_at desc);

-- import_jobs: ORDER BY created_at DESC used by ops bootstrap + import history
create index if not exists idx_import_jobs_created_at_desc
  on public.import_jobs (created_at desc);

-- import_jobs: submitted_by lookup (used by admin filters in future)
create index if not exists idx_import_jobs_submitted_by
  on public.import_jobs (submitted_by);
