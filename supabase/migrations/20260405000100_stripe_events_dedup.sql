-- Stripe webhook event deduplication table.
-- Every incoming Stripe event is recorded by event_id (primary key).
-- The process_stripe_webhook RPC already handles idempotency via the
-- stripe_webhook_events table; this migration adds a lightweight
-- lookup table for the Worker to fast-check duplicates before
-- invoking the heavier RPC, reducing DB load under replay attacks.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id   TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  created    TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload    JSONB,
  processed_at TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed', 'skipped'))
);

-- Index for nightly reconciliation queries (find unprocessed events)
CREATE INDEX IF NOT EXISTS idx_stripe_events_status
  ON public.stripe_events (status)
  WHERE status != 'processed';

-- Index for time-range queries during incident investigation
CREATE INDEX IF NOT EXISTS idx_stripe_events_created
  ON public.stripe_events (created DESC);

-- RLS: only service_role can read/write (webhook handler uses admin client)
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role (admin client) accesses this table.
-- This prevents any authenticated user from reading webhook payloads.

COMMENT ON TABLE public.stripe_events IS
  'Stripe webhook event deduplication. Written by Worker webhook handler, read by reconciliation jobs.';
