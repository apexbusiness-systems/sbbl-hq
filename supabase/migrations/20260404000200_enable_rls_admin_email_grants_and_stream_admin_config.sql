-- Enable RLS on newly introduced public tables and add explicit baseline policies.

DO $$
DECLARE
  tbl text;
  target_tables constant text[] := ARRAY['admin_email_grants', 'stream_admin_config'];
  policy_name constant text := 'service_role_only_baseline';
BEGIN
  FOREACH tbl IN ARRAY target_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl
        AND c.relkind = 'r'
    ) THEN
      -- Enforce RLS for public schema tables exposed through PostgREST.
      EXECUTE format('alter table public.%I enable row level security;', tbl);

      -- Keep direct table access restricted to service_role only.
      EXECUTE format('drop policy if exists %I on public.%I;', policy_name, tbl);
      EXECUTE format(
        'create policy %I on public.%I as permissive for all to service_role using (true) with check (true);',
        policy_name,
        tbl
      );
    END IF;
  END LOOP;
END
$$;
