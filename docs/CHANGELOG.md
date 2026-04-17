# CHANGELOG

## 2026-04-17 — v1.2.0 — Broadcast overlay, engagement, sponsors, AI digest, OBS control

- **Overlay (OBS browser source)**: new chromeless `/overlay/:gameId` page.
  `overlay_game_state` table holds period, clock, score, fouls, timeouts,
  possession, bonus, lower-third, sponsor-bug flag. Auto-created by trigger
  on every new game. Admin mutations via `/api/ops/overlay/:gameId/{state,clock,score,foul,period,reset}`.
- **Overlay control console**: `/overlay-control/:gameId` admin page drives
  every scoreboard field in real time, plus the OBS command queue.
- **Interactive engagement**: polls/predictions/trivia (`engagement_polls` +
  `engagement_poll_votes` with one-vote-per-user uniqueness), gamification
  (`gamification_points` + `get_gamification_leaderboard` RPC), watch parties
  with 6-char invite codes (`watch_parties`, `watch_party_members`). New
  `/engage` page.
- **Sponsor overlay**: `sponsor_slots` with weight, league scope, start/end
  windows. In-overlay rotation every 15 s (deterministic across viewers).
  Impression + click tracking via `sponsor_impressions`.
- **AI weekly digest**: `/digest` page + `ai_weekly_digest` cache keyed on
  `(league_id, week_start)`. Groq `llama-3.3-70b-versatile` when
  `GROQ_API_KEY` is set; deterministic fallback otherwise. Facts pulled from
  `games` + `player_game_stats` over the last 7 days.
- **OBS remote control**: `obs_commands` queue. Web ops enqueues commands;
  on-site `obs-agent` pulls `/pending` and acks, auth'd by
  `OBS_AGENT_TOKEN` Bearer token. Supports stream/record start-stop, scene
  switch, source visibility, filter toggle, text source update, browser
  refresh.
- Full details + validation evidence in
  [`features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md`](features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md).

## 2026-04-16 - v1.0-store-canonicalization-hardening
- **Hardening**: Created migration to target `store_orders` in webhook and added audit triggers.
- **Worker API**: Refactored public products to fetch from `store_products`.
- **Worker API**: Added `/api/store/quote` for inserting into `custom_quote_requests` with idempotency.
- **Worker API**: Refactored `/api/store/checkout` to use `store_products` and create pending `store_orders`.
- **Worker API**: Updated Stripe webhook to no longer rely on legacy `orders` and `carts` tables for closing carts.
- **UI**: Connected `Store.tsx` to live product APIs and custom quote submission.
- **UI**: Refactored `BagDrawer.tsx` to pull from API data and submit accurate line item `price_cents`.
- **E2E**: Added tests for store browsing, bag additions, and idempotent custom quote request.
