-- Harden SECURITY DEFINER/function execution context by pinning search_path.
-- This resolves Supabase lint `function_search_path_mutable` warnings.

ALTER FUNCTION IF EXISTS public.update_league_events_updated_at()
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.touch_updated_at()
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.enforce_idempotency(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.log_admin_action(text, text, uuid, jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.enqueue_review_item(text, uuid, jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.resolve_review_item(uuid, text, text, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_new_user_profile()
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.complete_player_onboarding(jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.submit_player_headshot(uuid, uuid, jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.approve_or_reject_headshot(uuid, text, text, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.create_game_stat_sheet(uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.save_stat_draft(uuid, jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.finalize_game_stats(uuid, jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.recompute_leaderboards(uuid, uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.create_stream_entitlement(uuid, uuid, uuid, timestamptz, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.begin_stream_access_session(uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.expire_stream_access_sessions(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.create_cart_for_user(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.add_cart_item(uuid, uuid, int, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.remove_cart_item(uuid, uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.create_order_from_cart(uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.mark_order_paid(uuid, text, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.grant_reward_credit(uuid, uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.redeem_reward_credit(uuid, uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.record_ingress_failure(uuid, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.get_pending_ingress_buffer(int)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.claim_ingress_for_replay(int)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.cleanup_ingress_failures(interval)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.enqueue_local_domain_event(text, uuid, jsonb, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.claim_outbox_events(int)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.mark_outbox_delivered(uuid)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION IF EXISTS public.mark_outbox_retry(uuid, text)
  SET search_path = public, extensions, pg_temp;
