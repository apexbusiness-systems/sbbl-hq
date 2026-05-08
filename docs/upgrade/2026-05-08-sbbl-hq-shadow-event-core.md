# SBBL HQ Shadow Event Core Upgrade — Current State, Freeze Line, Safe Additive Zones

Date: 2026-05-08
Owner: Sports Operations / Broadcast Platform
Status: additive shadow-run plan

## Current-state map

- Framework/runtime: Vite + React 18 SPA with React Router routes in `src/App.tsx`; Cloudflare Worker API in `src/worker/index.ts`; Supabase Postgres migrations/functions under `supabase/`.
- Package manager: npm (`package-lock.json`, scripts in `package.json`).
- Router structure: client pages live in `src/pages/*`; worker routes are registered in `src/worker/index.ts` and split routes exist under `src/worker/routes/*` for overlay, engagement, sponsors, tokens, biometrics, highlights, replay, public data, and OBS.
- Database/migrations: Supabase SQL migrations live in `supabase/migrations`; canonical core schema starts at `202603270001_core_schema.sql` with `games`, `player_game_stats`, `team_game_stats`, `stream_*`, `audit_logs`, roles, leagues/seasons/teams.
- Auth model: Supabase Auth JWTs plus `user_role_assignments` (`app_role` enum) and worker-side role guards; admin writes use service-role Supabase clients only on server/worker code paths.
- Payment/webhook paths: Cloudflare Worker Stripe paths in `src/worker/index.ts`, Stripe helpers in `src/worker/stripe-utils.ts`, Supabase Edge Function webhook at `supabase/functions/stripe-webhook/index.ts`, and `stripe_events` idempotency in migration `20260404240000_stripe_events_idempotency.sql`.
- Existing realtime paths: Supabase Realtime table subscription for `overlay_game_state` in `src/pages/Overlay.tsx`, broadcast channel patterns in `src/hooks/useTokenLeaderboardRealtime.ts` and biometric realtime hooks.
- Existing broadcast/PPV/stream paths: `/live`, playback provider modules, signed playback tests, stream gating docs, worker stream routes, overlay routes, OBS routes, ingest pipeline migrations, replay entitlement migrations, PPV invite helpers, stream independence contract docs.
- Test/lint/typecheck commands: `npm run test`, `npm run lint`, `npm run typecheck`, plus stream validation scripts (`npm run test:stream:*`, `npm run validate:stream:gate`).
- Env inventory: client env is centralized in `src/lib/env.ts`; worker/server env includes Supabase, Stripe, OmniHub, Turnstile, playback token, stream URL, optional Sentry/Groq keys as referenced by worker and function code.

## Freeze line — do not destabilize

These surfaces remain functionally unchanged by the shadow event core until parity is proven:

1. Stream ingest, publication, playback, provider selection, signed playback, and stream independence contract.
2. PPV entitlement purchase/grant/replay logic and Stripe side-effect paths.
3. Broadcast control writes that currently mutate `overlay_game_state` and mirror scores to `games`.
4. Canonical score/stat read paths (`games`, `player_game_stats`, `team_game_stats`, public scores API, standings materialized view/RPCs).
5. Any client route exposing premium video URLs or operator controls.

## Safe additive zones

- Feature flags defaulting off in `src/lib/env.ts` / `src/lib/feature-flags.ts`.
- Append-only shadow tables, projections, reconciliation logs, and reporting views added by migration only.
- Pure reducer code under `src/lib/events/*` with deterministic tests and no side effects.
- OBS-friendly read-only overlay variants rendered from existing public overlay payloads.
- Sponsor exposure instrumentation tables/views that do not load third-party scripts.
- Webhook inbox/audit tables that dedupe before side effects and can be populated in shadow without changing existing webhook behavior.

## Rollback

1. Disable flags: `shadow_event_ledger`, `shadow_game_projection`, `broadcast_overlay_v2`, `sponsor_analytics_v2`, `entitlement_tokens_v2`.
2. Leave append-only tables in place for audit, or drop the migration-created tables/views/functions if no production rows need retention.
3. Revert client overlay route variant code if OBS operators report rendering issues; existing `/overlay/:gameId` default scorebug remains available.
4. Do not change media, playback, or PPV deployment variables during rollback.
