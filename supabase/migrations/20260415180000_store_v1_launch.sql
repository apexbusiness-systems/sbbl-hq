-- Store Tables Foundation + Custom Jerseys Scope

-- 1. store_products
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null,
  price_cents integer not null default 0,
  image_url text not null,
  sizes text[],
  colors text[],
  badge text,
  is_custom boolean default false not null,
  active boolean default true not null,
  _modified timestamptz default now() not null,
  _deleted boolean default false not null
);

-- 2. store_orders
CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount_subtotal_cents integer not null,
  amount_total_cents integer not null,
  status text not null,
  shipping_address jsonb,
  customer_email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. store_order_items
CREATE TABLE IF NOT EXISTS public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.store_orders(id) not null,
  product_id uuid references public.store_products(id) not null,
  quantity integer not null,
  unit_price_cents integer not null,
  size text,
  color text,
  created_at timestamptz default now() not null
);

-- 4. custom_quote_requests
CREATE TABLE IF NOT EXISTS public.custom_quote_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  product_id uuid references public.store_products(id),
  name text not null,
  team_name text not null,
  quantity integer not null,
  notes text,
  status text default 'pending' not null,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.custom_quote_requests enable row level security;

-- Policies

-- Products are readable by anyone
create policy "store_products_read_all" on public.store_products for select using (true);
create policy "store_products_write_admin" on public.store_products for all to service_role using (true) with check(true);

-- Orders readable by owner
create policy "store_orders_read_owner" on public.store_orders for select using (auth.uid() = user_id);
create policy "store_orders_write_service" on public.store_orders for all to service_role using (true) with check(true);

-- Order Items readable by owner
create policy "store_order_items_read_owner" on public.store_order_items for select using (
  exists (
    select 1 from public.store_orders o where o.id = store_order_items.order_id and o.user_id = auth.uid()
  )
);
create policy "store_order_items_write_service" on public.store_order_items for all to service_role using (true) with check(true);

-- Custom Quote Requests readable by owner, insertable by owner
create policy "custom_quote_requests_read_owner" on public.custom_quote_requests for select using (auth.uid() = user_id);
create policy "custom_quote_requests_insert_owner" on public.custom_quote_requests for insert with check (auth.uid() = user_id);
create policy "custom_quote_requests_write_service" on public.custom_quote_requests for all to service_role using (true) with check(true);

-- Indexes
create index if not exists store_products_category_idx on public.store_products(category) where _deleted = false;
create index if not exists store_orders_user_idx on public.store_orders(user_id);
create index if not exists custom_quote_requests_user_idx on public.custom_quote_requests(user_id);
