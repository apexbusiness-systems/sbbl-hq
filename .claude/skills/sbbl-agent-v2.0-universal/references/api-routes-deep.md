# SBBL HQ API Routes Reference
<!-- Version: v2.0.0 | Date: 2026-05-20 | Source: src/worker/index.ts -->

## Auth Policy Legend
- 🔓 Public (no auth required)
- 🔐 requireAuth (x-sbbl-user-id-verified header)
- 🛡️ Admin/Super-admin only
- ❄️ FROZEN (no agent modifications without owner approval)

---

## Auth Routes
| Method | Route | Auth |
|--------|-------|------|
| GET | `/auth/session` | 🔓 |
| GET | `/api/profile/me` | 🔐 |
| POST | `/api/profile/onboarding` | 🔐 |
| POST | `/api/profile/headshot` | 🔐 |

## Game & Stats
| Method | Route | Auth |
|--------|-------|------|
| GET/POST | `/api/games/:id/stat-sheet` | 🔐 |
| POST | `/api/games/:id/stats/draft` | 🔐 |
| POST | `/api/games/:id/stats/finalize` | 🛡️ |
| GET | `/api/stats` | 🔓 (tier-aware, anon = limited data) |
| GET | `/api/leaderboards` | 🔓 (login-gate UI for full data) |
| GET | `/api/scores` | 🔓 |
| POST | `/ops/scores/game` | 🛡️ |
| POST | `/ops/scores/import` | 🛡️ |
| POST | `/ops/scores/parse-image` | 🛡️ |

## PPV Invites
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/invite/generate` | 🛡️ |
| POST | `/api/invite/redeem` | 🔐 |

## Streams (Game PPV)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/streams/:gameId/preview` | 🔐 |
| POST | `/api/streams/:gameId/purchase` | 🔐 |
| GET | `/api/streams/:gameId/access` | 🔐 |
| POST | `/api/streams/:gameId/session` | 🔐 |
| POST | `/api/streams/:gameId/proxy/*` | 🔐 |
| POST | `/api/streams/:gameId/session/heartbeat` | 🔐 |
| POST | `/api/streams/:gameId/session/end` | 🔐 |
| POST | `/api/streams/:gameId/playback-token/verify` | 🔐 |
| GET | `/api/streams/:gameId/preflight` | 🔐 |
| GET | `/api/streams/:gameId/replay/status` | 🔐 |
| GET | `/api/public/streams/:gameId/reactions/aggregate` | 🔓 |

## Broadcast Routes (FROZEN ❄️)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/broadcast/access` | 🔐 |
| POST | `/api/broadcast/session` | 🔐 |
| POST | `/api/broadcast/session/heartbeat` | 🔐 |
| POST | `/api/broadcast/session/end` | 🔐 |
| POST | `/api/streams/broadcast/session` | 🔐 (alias) |
| POST | `/api/streams/broadcast/session/heartbeat` | 🔐 (alias) |
| POST | `/api/streams/broadcast/session/end` | 🔐 (alias) |

## Fan Tokens
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/tokens/products` | 🔐 |
| GET | `/api/tokens/categories` | 🔐 |
| GET | `/api/tokens/wallet` | 🔐 |
| GET | `/api/tokens/leaderboard/season/:seasonId` | 🔐 |
| GET | `/api/tokens/leaderboard/:gameId` | 🔐 |
| POST | `/api/tokens/purchase` | 🔐 |
| POST | `/api/tokens/award` | 🛡️ |
| POST | `/api/tokens/webhook` | 🔐 |

## Biometrics
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/streams/:gameId/biometrics` | 🔐 |
| POST | `/api/streams/:gameId/biometrics/webhook` | 🔐 |
| GET | `/api/streams/:gameId/biometrics/latest` | 🔐 |

## Overlay & Broadcast Events
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/streams/:gameId/overlay/event` | 🔐 |
| GET | `/api/streams/:gameId/overlay/events/latest` | 🔐 |

## Stream Comments & Reactions
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/streams/:gameId/comments` | 🔐 |
| POST | `/api/streams/:gameId/comments` | 🔐 |
| POST | `/ops/streams/:gameId/comments/:commentId` | 🛡️ |
| POST | `/ops/streams/:gameId/reactions/reset` | 🛡️ |

## Commerce (Store)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/cart` | 🔐 |
| POST | `/api/cart/items` | 🔐 |
| DELETE | `/api/cart/items/:itemId` | 🔐 |

## Engagement
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/engagement/polls` | 🔐 |
| POST | `/api/engagement/polls/:id/vote` | 🔐 |
| GET | `/api/engagement/me/points` | 🔐 |
| POST | `/api/engagement/watch-parties` | 🔐 |
| GET | `/api/engagement/watch-parties` | 🔐 |
| POST | `/api/engagement/watch-parties/:id/join` | 🔐 |
| POST | `/api/engagement/watch-parties/join-by-code` | 🔐 |
| POST | `/api/ops/engagement/polls` | 🛡️ |
| POST | `/api/ops/engagement/polls/:id` | 🛡️ |
| POST | `/api/ops/engagement/polls/:id/grade` | 🛡️ |

## Sponsors
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/public/sponsors` | 🔓 |
| POST | `/api/public/sponsors/:id/track` | 🔓 |
| GET | `/api/ops/sponsors` | 🛡️ |
| POST | `/api/ops/sponsors` | 🛡️ |
| POST | `/api/ops/sponsors/:id` | 🛡️ |
| POST | `/api/ops/sponsors/:id/delete` | 🛡️ |

## OBS Commands
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/ops/obs/commands` | 🛡️ |
| GET | `/api/ops/obs/commands` | 🛡️ |
| GET | `/api/ops/obs/commands/pending` | 🛡️ |
| POST | `/api/ops/obs/commands/:id/ack` | 🛡️ |

## Digest & Highlights
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/public/digest` | 🔓 |
| POST | `/api/ops/digest/:leagueCode/regenerate` | 🛡️ |
| GET | `/api/public/highlights/:gameId` | 🔓 |
| POST | `/api/ops/highlights/mark` | 🛡️ |
| POST | `/api/ops/highlights/:id` | 🛡️ |
| POST | `/api/ops/highlights/:id/delete` | 🛡️ |

## Ingest Pipeline
| Method | Route | Auth |
|--------|-------|------|
| POST | `/ops/ingest/presign` | 🛡️ |
| POST | `/ops/ingest/submit` | 🛡️ |
| GET | `/ops/ingest/:jobId` | 🛡️ |
| POST | `/ops/ingest/:jobId/approve` | 🛡️ |
| POST | `/ops/ingest/:jobId/reject` | 🛡️ |
| POST | `/ops/ingest/:jobId/replay` | 🛡️ |

## Ops Panel (CRUD)
| Method | Route | Auth |
|--------|-------|------|
| PATCH/DELETE | `/ops/teams/:id` | 🛡️ |
| PATCH/DELETE | `/ops/players/:id` | 🛡️ |
| PATCH/DELETE | `/ops/products/:id` | 🛡️ |
| PATCH/DELETE | `/ops/events/:id` | 🛡️ |
| PATCH/DELETE | `/ops/schedules/:id` | 🛡️ |
| POST | `/ops/products/batch` | 🛡️ |
| POST | `/ops/media/publish` | 🛡️ |
| GET | `/ops/list/teams` | 🛡️ |
| GET | `/ops/list/players` | 🛡️ |
| GET | `/ops/list/products` | 🛡️ |
| GET | `/ops/list/events` | 🛡️ |
| GET | `/ops/list/media` | 🛡️ |
| PATCH | `/ops/media/publications/:id` | 🛡️ |
| DELETE | `/ops/media/publications/:id` | 🛡️ |
| POST | `/ops/media/publications/order` | 🛡️ |
| POST | `/ops/media/publications/:id/restore` | 🛡️ |
| POST | `/ops/media/stale-cleanup-preview` | 🛡️ |
| POST | `/ops/media/stale-cleanup-execute` | 🛡️ |
| POST | `/ops/media/bulk-archive` | 🛡️ |

## OmniBridge
| Method | Route | Auth |
|--------|-------|------|
| POST | `/webhooks/omnihub` | HMAC-SHA256 (OMNIHUB_VERIFY_KEY) |
| POST | `/api/omniport/command` | 🔐 JWT |
| POST | `/sync/drain` | Internal (outbound to OmniHub) |

## Public Data Endpoints (Anonymous Safe)
```
/api/public/sponsors
/api/public/digest
/api/public/highlights/:gameId
/api/public/streams/:gameId/reactions/aggregate
/api/stats   ← tier-aware (anon = limited)
/api/scores
/api/teams   ← if exists
```

Cache header: `Cache-Control: public, s-maxage=30, max-age=15` (adjust per endpoint)

## Adding New Public Data Surface (Checklist)
1. Add handler in `src/worker/index.ts` (NO `requireAuth`)
2. Register in route table at bottom
3. Set `Cache-Control: public, s-maxage=30, max-age=15`
4. Add API client wrapper in `src/lib/api/public.ts`
5. Wire page via `useQuery` — no fallback, render empty state
6. Add endpoint to `docs/protocols/no-mock-in-production.md`
