-- Stripe webhook hardening: deterministic replay protection + transactional business writes.

create unique index if not exists billing_events_stripe_event_unique
  on public.billing_events ((payload->>'event_id'))
  where event_type = 'stripe.webhook';

create unique index if not exists payment_attempts_provider_idempotency_unique
  on public.payment_attempts (provider, idempotency_key)
  where idempotency_key is not null;

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
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'missing_event_id';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception 'missing_event_type';
  end if;

  begin
    insert into public.billing_events (user_id, event_type, payload, created_by, updated_by)
    values (
      p_user_id,
      'stripe.webhook',
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('event_id', p_event_id, 'stripe_type', p_event_type),
      p_user_id,
      p_user_id
    );
  exception
    when unique_violation then
      return jsonb_build_object('duplicate', true, 'payment_recorded', false);
  end;

  if p_event_type in ('checkout.session.completed', 'payment_intent.succeeded') then
    v_payment_status := case
      when p_event_type = 'checkout.session.completed' then 'succeeded'
      else 'captured'
    end;

    insert into public.payment_attempts (order_id, provider, provider_ref, status, idempotency_key, created_by, updated_by)
    values (
      p_order_id,
      'stripe',
      p_provider_ref,
      v_payment_status,
      p_event_id,
      p_user_id,
      p_user_id
    )
    on conflict (provider, idempotency_key) where idempotency_key is not null do nothing;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'payment_recorded', p_event_type in ('checkout.session.completed', 'payment_intent.succeeded')
  );
end;
$$;
