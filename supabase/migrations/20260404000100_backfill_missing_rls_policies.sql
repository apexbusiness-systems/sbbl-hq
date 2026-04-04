-- Backfill baseline RLS policies for tables flagged by Supabase linter
-- (RLS enabled with no policy).

DO $$
DECLARE
  tbl text;
  policy_name constant text := 'service_role_only_baseline';
  target_tables constant text[] := ARRAY[
    'audit_logs','billing_events','cart_items','carts','clips','courts','devices','divisions',
    'game_rosters','import_jobs','invoices','leaderboard_snapshots','leagues','moderation_events',
    'order_items','payment_attempts','player_game_stats','players','product_variants','promo_codes',
    'publish_jobs','purchase_entitlements','review_queue','reward_catalog','reward_claims',
    'rule_conflicts','schedule_slots','seasons','share_assets','social_destinations','stat_categories',
    'stat_line_submissions','stream_access_sessions','stream_entitlements','stream_sessions',
    'stream_sources','stream_watermark_events','sync_events','team_game_stats','team_memberships',
    'teams','venues'
  ];
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
