-- P3-A: Stripe webhook idempotency — dedicated stripe_events table
--
-- The existing billing_events table uses a JSON-path unique index for
-- deduplication. This migration adds a dedicated stripe_events table as a
-- cleaner, faster idempotency log that:
--   • Uses a TEXT column for stripe_event_id (no JSON extraction)
--   • Has a partial-index-free UNIQUE constraint (simpler query plan)
--   • Records processing status for observability and replay audit
--   • Does NOT replace billing_events — both coexist for transition safety

create table if not exists public.stripe_events (
  id                uuid        primary key default gen_random_uuid(),
  stripe_event_id   text        not null unique,
  event_type        text        not null,
  payload           jsonb       not null default '{}'::jsonb,
  processed_at      timestamptz not null default now(),
  status            text        not null default 'processed'
                    check (status in ('processed', 'duplicate', 'failed', 'skipped')),
  error_detail      text,
  created_at        timestamptz not null default now()
);

comment on table public.stripe_events is
  'Idempotency log for incoming Stripe webhook events. '
  'Unique constraint on stripe_event_id prevents duplicate processing.';

-- RLS: no direct client access — written only by the Edge Function via service role
alter table public.stripe_events enable row level security;

create policy "stripe_events_admin_read"
  on public.stripe_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_role_assignments ura
      where ura.user_id = (select auth.uid())
        and ura.role in ('super_admin', 'league_admin')
    )
  );

-- Indexes
create index if not exists idx_stripe_events_event_id
  on public.stripe_events (stripe_event_id);

create index if not exists idx_stripe_events_created_at
  on public.stripe_events (created_at desc);

create index if not exists idx_stripe_events_status
  on public.stripe_events (status, created_at desc);
