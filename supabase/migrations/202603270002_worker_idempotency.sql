create table if not exists public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  route text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.api_idempotency_keys enable row level security;

create policy if not exists api_idempotency_service_only on public.api_idempotency_keys
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
