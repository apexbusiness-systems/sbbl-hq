<!-- Version: v1.1.0 | Date: 2026-04-04 | Status: Current -->
# DB Schema Summary

The migration `supabase/migrations/202603270001_core_schema.sql` creates identity, league core, stats, streaming, commerce, media, and ops domains.

Highlights:
- UUID PK + audit columns on operational tables.
- Idempotency keys on mutating workflows.
- `touch_updated_at` trigger on all domain tables.
- Lookup indexes for league/season/game/order/entitlement access.
- SQL RPC functions for onboarding, stats, stream gating, commerce, and ops review.
