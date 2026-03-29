-- Stripe webhook processing should not require metadata.user_id on every event.
-- Resolve actor from order when available to keep webhook ingestion non-brittle.

create or replace function public.process_stripe_webhook(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_order_id uuid,
  p_provider_ref text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_status text;
  v_user_id uuid;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'missing_event_id';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception 'missing_event_type';
  end if;

  -- Prefer explicit metadata user id; fallback to order owner for webhook resilience.
  v_user_id := p_user_id;
  if v_user_id is null and p_order_id is not null then
    select o.user_id into v_user_id
    from public.orders o
    where o.id = p_order_id;
  end if;

  if v_user_id is null then
    raise exception 'missing_user_context';
  end if;

  begin
    insert into public.billing_events (user_id, event_type, payload, created_by, updated_by)
    values (
      v_user_id,
      'stripe.webhook',
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('event_id', p_event_id, 'stripe_type', p_event_type),
      v_user_id,
      v_user_id
    );
  exception
    when unique_violation then
      return jsonb_build_object('duplicate', true, 'payment_recorded', false);
  end;

  if p_event_type in ('checkout.session.completed', 'payment_intent.succeeded', 'payment_intent.payment_failed') then
    v_payment_status := case
      when p_event_type = 'checkout.session.completed' then 'succeeded'
      when p_event_type = 'payment_intent.succeeded' then 'captured'
      else 'failed'
    end;

    insert into public.payment_attempts (order_id, provider, provider_ref, status, idempotency_key, created_by, updated_by)
    values (
      p_order_id,
      'stripe',
      p_provider_ref,
      v_payment_status,
      p_event_id,
      v_user_id,
      v_user_id
    )
    on conflict (provider, idempotency_key) where idempotency_key is not null do nothing;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'payment_recorded', p_event_type in ('checkout.session.completed', 'payment_intent.succeeded', 'payment_intent.payment_failed')
  );
end;
$$;
