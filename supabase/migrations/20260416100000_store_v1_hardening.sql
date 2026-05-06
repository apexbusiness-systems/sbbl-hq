-- Store v1 Hardening
-- Unifies mark_order_paid to target store_orders instead of legacy orders
-- Adds audit triggers for store_orders and custom_quote_requests

-- Re-create mark_order_paid to target store_orders
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid, p_payment_ref text, p_idempotency_key text) RETURNS jsonb AS $$
BEGIN
  PERFORM public.enforce_idempotency(p_idempotency_key);

  -- Update store_orders instead of legacy orders
  UPDATE public.store_orders
  SET status = 'paid', updated_at = now()
  WHERE id = p_order_id;

  -- Ensure we insert an audit log for this state change
  INSERT INTO public.audit_logs (actor_id, action, ref_type, ref_id, payload, idempotency_key, created_at, updated_at)
  VALUES (
    auth.uid(),
    'store_order_paid',
    'store_order',
    p_order_id,
    jsonb_build_object('payment_ref', p_payment_ref),
    p_idempotency_key,
    now(),
    now()
  );

  RETURN jsonb_build_object('ok', true, 'payment_ref', p_payment_ref);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to audit custom quote requests via trigger or manual insert
-- We'll use a trigger to automatically log inserts to custom_quote_requests
CREATE OR REPLACE FUNCTION public.audit_custom_quote_request_insert() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, ref_type, ref_id, payload, created_at, updated_at)
  VALUES (
    NEW.user_id,
    'custom_quote_requested',
    'custom_quote_request',
    NEW.id,
    jsonb_build_object('product_id', NEW.product_id, 'quantity', NEW.quantity, 'team', NEW.team_name),
    now(),
    now()
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_custom_quote_requests ON public.custom_quote_requests;
CREATE TRIGGER trg_audit_custom_quote_requests
  AFTER INSERT ON public.custom_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_custom_quote_request_insert();

-- Same for store_orders creation
CREATE OR REPLACE FUNCTION public.audit_store_order_insert() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, ref_type, ref_id, payload, created_at, updated_at)
  VALUES (
    NEW.user_id,
    'store_order_created',
    'store_order',
    NEW.id,
    jsonb_build_object('amount_total_cents', NEW.amount_total_cents, 'status', NEW.status),
    now(),
    now()
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_store_orders ON public.store_orders;
CREATE TRIGGER trg_audit_store_orders
  AFTER INSERT ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_store_order_insert();

-- Add Indexes for active queries
CREATE INDEX IF NOT EXISTS store_products_active_idx ON public.store_products(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS custom_quote_requests_status_idx ON public.custom_quote_requests(status);
CREATE INDEX IF NOT EXISTS store_order_items_order_id_idx ON public.store_order_items(order_id);

-- Apply search path hardening to the re-created function
ALTER FUNCTION public.mark_order_paid(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.audit_custom_quote_request_insert() SET search_path = public;
ALTER FUNCTION public.audit_store_order_insert() SET search_path = public;
