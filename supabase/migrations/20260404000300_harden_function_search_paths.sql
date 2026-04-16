-- Harden SECURITY DEFINER/function execution context by pinning search_path.
-- This resolves Supabase lint `function_search_path_mutable` warnings.

DO $$
DECLARE
  fn text;
  target_functions constant text[] := ARRAY[

    'public.touch_updated_at()',
    'public.enforce_idempotency(text)',
    'public.log_admin_action(text,text,uuid,jsonb,text)',
    'public.enqueue_review_item(text,uuid,jsonb,text)',
    'public.resolve_review_item(uuid,text,text,text)',
    'public.handle_new_user_profile()',
    'public.complete_player_onboarding(jsonb,text)',
    'public.submit_player_headshot(uuid,uuid,jsonb,text)',
    'public.approve_or_reject_headshot(uuid,text,text,text)',
    'public.create_game_stat_sheet(uuid,text)',
    'public.save_stat_draft(uuid,jsonb,text)',
    'public.finalize_game_stats(uuid,jsonb,text)',
    'public.recompute_leaderboards(uuid,uuid,text)',
    'public.create_stream_entitlement(uuid,uuid,uuid,timestamptz,text)',
    'public.begin_stream_access_session(uuid,text)',
    'public.expire_stream_access_sessions(text)',
    'public.create_cart_for_user(text)',
    'public.add_cart_item(uuid,uuid,integer,text)',
    'public.remove_cart_item(uuid,uuid,text)',
    'public.create_order_from_cart(uuid,text)',
    'public.mark_order_paid(uuid,text,text)',
    'public.grant_reward_credit(uuid,uuid,text)',
    'public.redeem_reward_credit(uuid,uuid,text)',
    'public.record_ingress_failure(uuid,text)',
    'public.get_pending_ingress_buffer(integer)',
    'public.claim_ingress_for_replay(integer)',
    'public.cleanup_ingress_failures(interval)',
    'public.enqueue_local_domain_event(text,uuid,jsonb,text)',
    'public.claim_outbox_events(integer)',
    'public.mark_outbox_delivered(uuid)',
    'public.mark_outbox_retry(uuid,text)'
  ];
BEGIN
  FOREACH fn IN ARRAY target_functions LOOP
    -- Guard by to_regprocedure so preview/staging schema drift does not break migration.
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, extensions, pg_temp;',
        fn
      );
    END IF;
  END LOOP;
END
$$;
