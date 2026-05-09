-- Store Canonicalization and Hardening v1.0
-- 1. Add idempotency_key to store_orders to ensure safe retries
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS idempotency_key text unique;

-- 2. Audit logging for custom quote requests
CREATE TABLE IF NOT EXISTS public.custom_quote_audit (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.custom_quote_requests(id) on delete cascade not null,
  action text not null,
  performed_by uuid references auth.users(id),
  old_status text,
  new_status text,
  notes text,
  created_at timestamptz default now() not null
);

ALTER TABLE public.custom_quote_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_quote_audit_read_admin" ON public.custom_quote_audit FOR SELECT TO service_role USING (true);
CREATE POLICY "custom_quote_audit_insert_service" ON public.custom_quote_audit FOR INSERT TO service_role WITH CHECK (true);

-- 3. Audit logging for store orders
CREATE TABLE IF NOT EXISTS public.store_order_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.store_orders(id) on delete cascade not null,
  action text not null,
  performed_by uuid references auth.users(id),
  old_status text,
  new_status text,
  created_at timestamptz default now() not null
);

ALTER TABLE public.store_order_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_order_audit_read_admin" ON public.store_order_audit FOR SELECT TO service_role USING (true);
CREATE POLICY "store_order_audit_insert_service" ON public.store_order_audit FOR INSERT TO service_role WITH CHECK (true);

-- 4. Triggers to capture status changes automatically via service_role / db

CREATE OR REPLACE FUNCTION audit_custom_quote_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.custom_quote_audit (quote_id, action, performed_by, new_status)
    VALUES (NEW.id, 'created', auth.uid(), NEW.status);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.custom_quote_audit (quote_id, action, performed_by, old_status, new_status)
    VALUES (NEW.id, 'status_changed', auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_custom_quote_audit ON public.custom_quote_requests;
CREATE TRIGGER tr_custom_quote_audit
  AFTER INSERT OR UPDATE ON public.custom_quote_requests
  FOR EACH ROW EXECUTE FUNCTION audit_custom_quote_changes();

CREATE OR REPLACE FUNCTION audit_store_order_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.store_order_audit (order_id, action, performed_by, new_status)
    VALUES (NEW.id, 'created', auth.uid(), NEW.status);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.store_order_audit (order_id, action, performed_by, old_status, new_status)
    VALUES (NEW.id, 'status_changed', auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_store_order_audit ON public.store_orders;
CREATE TRIGGER tr_store_order_audit
  AFTER INSERT OR UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION audit_store_order_changes();

-- 5. Additional Indexes
CREATE INDEX IF NOT EXISTS idx_store_products_is_custom ON public.store_products(is_custom);
CREATE INDEX IF NOT EXISTS idx_store_orders_idempotency ON public.store_orders(idempotency_key);
