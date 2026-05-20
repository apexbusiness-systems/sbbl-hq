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
