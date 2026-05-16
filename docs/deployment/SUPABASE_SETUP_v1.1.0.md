<!-- Version: v1.1.0 | Date: 2026-04-04 | Status: Current -->
# Supabase Setup

1. Target the self-hosted Supabase instance for the environment; do not link production to a Supabase Cloud project ref.
2. Run `npm run db:migrate`.
3. Run seed with `supabase db reset` or apply `supabase/seed.sql`.
4. Generate TS types: `npm run db:types`.
5. Configure storage buckets and review policies in migration output.
