\set pguser `echo "${POSTGRES_USER:-supabase_admin}"`

-- Realtime uses two schemas in self-hosted stacks:
--   _realtime: management metadata owned by the Realtime service
--   realtime: tenant database objects created by Realtime tenant migrations
-- Create both idempotently so fresh and existing Docker volumes can recover
-- before the realtime container attempts its migrations.
create schema if not exists _realtime;
alter schema _realtime owner to :pguser;

create schema if not exists realtime;
alter schema realtime owner to :pguser;

-- If supabase_realtime_admin exists (roles.sql may run before or after
-- this file depending on image entrypoint ordering), grant it ALL on
-- _realtime so the Realtime container can run its Ecto migrations.
-- The DO block guards against the role not existing yet — in that case,
-- roles.sql will create the role and the operator recovery script
-- (scripts/repair-selfhost-db.ps1) will idempotently apply the grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    EXECUTE 'GRANT ALL ON SCHEMA _realtime TO supabase_realtime_admin';
    EXECUTE 'ALTER ROLE supabase_realtime_admin SET search_path TO _realtime';
  END IF;
END
$$;
