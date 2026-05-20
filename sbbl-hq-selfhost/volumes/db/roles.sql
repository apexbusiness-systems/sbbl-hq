-- Bind PostgreSQL service role passwords to POSTGRES_PASSWORD from the
-- environment. Runs on every fresh DB init AND on each container start of
-- the supabase/postgres image (the entrypoint replays init scripts when the
-- data dir already exists IF init has not been marked complete), so a
-- correctly-configured .env keeps role passwords in lock-step.
--
-- For a running DB whose passwords have drifted from .env (because .env
-- was rotated after the data volume was first initialized), use
-- scripts/repair-selfhost-db.ps1 to re-sync without rebuilding.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator            WITH PASSWORD :'pgpass';
ALTER USER pgbouncer                WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin      WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin   WITH PASSWORD :'pgpass';

-- supabase_realtime_admin is required by the Realtime container to run
-- its Ecto tenant migrations. Some supabase/postgres image versions do
-- not pre-create this role, so create it idempotently here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin WITH NOINHERIT CREATEROLE LOGIN NOREPLICATION;
  END IF;
END
$$;

ALTER USER supabase_realtime_admin WITH PASSWORD :'pgpass';

-- Allow postgres superuser to SET ROLE supabase_realtime_admin (required
-- by Realtime's startup connection that runs CREATE SCHEMA + migrations).
GRANT supabase_realtime_admin TO postgres;

-- Storage API switches into JWT request roles for RLS evaluation.
GRANT anon, authenticated, service_role TO supabase_storage_admin;
