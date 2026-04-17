# Stream Independence Contract

**Status:** ACTIVE — enforced by CLAUDE.md Rule #4, CI AST gate, and runtime tests.
**Version:** 1.0.0
**Effective:** 2026-04-17
**Owner:** APEX Business Systems Ltd. — SBBL-HQ engineering

---

## Why this contract exists

On 2026-04-16 the Toronto vs Scarborough PPV livestream failed. A
contributing root cause was that *stream identity was inferred from
`games.stream_url`* — a single string column on `games`. This coupling
meant:

- Two games could not share a stream without duplicating the URL.
- A stream URL change required a `games` row update — dangerous during
  live events.
- Entitlement (`stream_entitlements.game_id`) implicitly gated playback
  by the *game*, not the *stream*, so if the game→URL mapping was stale
  or absent, paid customers saw a black box.
- There was no way to author a stream *before* its game row existed, or
  to keep a stream alive after the game ended (VOD/highlights flow).

This contract decouples **streams** from **games** so that:

> A `stream` is a first-class, addressable media resource.
> A `game` MAY be associated with zero, one, or many streams via
> `stream_assignments`. Entitlements gate access to `stream_id`, and
> legacy `game_id` is retained only for backward-compatibility.

---

## The invariants (MUST)

1. **`streams` has no `game_id` column.** A stream is independent of
   any game. Associations live in `stream_assignments`.

2. **`stream_entitlements` retains `game_id` ONLY as a nullable legacy
   column.** `stream_id` is the primary, non-null access key after
   Stage 5 cutover.

3. **`stream_assignments` is many-to-many.** A stream may be assigned
   to multiple games (rebroadcasts, shared channels) and a game may
   have multiple streams (multi-cam, alt commentary).

4. **RLS is enabled on every new table with at least two policies**
   (read-public, write-service-role) per sbbl-agent §VII.

5. **`can_user_view_stream_v2(p_stream_id, p_game_id, p_user_id)`**
   is the single access authority. It resolves `stream_id` first and
   falls back to `game_id` only during the dual-read window (Stage 4).

6. **Backfill deduplicates by `stream_url`.** One stream per unique
   URL, multiple `stream_assignments` rows per shared stream.

---

## Forbidden patterns (MUST NOT)

> These are hard violations. CI will block a PR that introduces them.

- ❌ `ALTER TABLE streams ADD COLUMN game_id ...`
- ❌ `ALTER TABLE stream_assignments ALTER COLUMN game_id SET NOT NULL`
- ❌ `ALTER TABLE stream_entitlements ALTER COLUMN game_id SET NOT NULL`
- ❌ Reading `games.stream_url` from worker or frontend paths after
     Stage 5.
- ❌ Hard-coding `game_id` as the playback-access key in any new RPC.
- ❌ Removing the `can_user_view_stream_v2` RPC or reverting it to
     `can_user_view_stream` (pre-v2) without a replacement that
     preserves the stream-first resolution.

---

## Enforcement layers

| Layer | Mechanism | Location |
|-------|-----------|----------|
| 1. Human doctrine | CLAUDE.md Rule #4 | `CLAUDE.md` |
| 2. Static CI gate | pglast AST parser scans migration diffs | `.github/workflows/stream-contract-gate.yml` |
| 3. Runtime tests | Vitest stage-test battery | `src/test/stream-independence-stage*.test.ts` |
| 4. Armageddon suite | Adversarial invariant probes | `src/test/armageddon-stream-invariants.test.ts` |
| 5. Observability | Sentry span `stream.access.v2` + alerts | Sentry project `sbbl-hq-worker` |

---

## Migration timeline

| Stage | Description | State change |
|-------|-------------|--------------|
| 0 | Freeze invariants (this doc + CLAUDE.md #4) | Docs only |
| 1 | Additive tables: `streams`, `stream_assignments` | Additive DDL |
| 2 | Dual-write: webhook populates both `game_id` + `stream_id` | New RPC `create_stream_entitlement_v2` |
| 3 | Deduplicated backfill of historical `games.stream_url` | Data migration |
| 4 | Dual-read: `can_user_view_stream_v2` stream-first | New RPC, Sunday event rides this |
| 4.5 | User re-engagement (refund cohort) | No code |
| 5 | Cutover: new path primary, legacy deprecated | Worker routing |
| 6 | Decommission legacy NOT NULL + install AST tripwires | Destructive DDL + CI |

---

## Rollback protocol

Every forward migration under `supabase/migrations/` has a paired
rollback script under `supabase/rollbacks/` with the same timestamp
prefix. Rollbacks are **idempotent** (uses `IF EXISTS`, `DROP ... CASCADE`
where safe) and reverse-ordered so a multi-stage rollback applies cleanly.

If a stage fails verification:

1. Apply the paired rollback SQL.
2. `git revert` the commit.
3. `npx wrangler deploy` to restore the prior worker.
4. Post an incident note in `docs/status/`.

---

## Performance SLOs

- `can_user_view_stream_v2` p95 < 15ms under 1000 concurrent (Stage 4
  benchmark via EXPLAIN ANALYZE + k6).
- `/api/streams/:id/access` end-to-end p95 < 50ms (includes network).
- Error rate on `stream.access.v2` span < 0.1% (Sentry alert).

---

## References

- Incident history: `docs/status/` (2026-04-16 refund postmortem)
- Skill doctrine: sbbl-agent (Iron Laws), apex-live (broadcast),
  omnidev-v2, apex-qa, apex-master-debug, one-pass-debug-skill
- Related docs: `docs/protocols/no-mock-in-production.md`,
  `docs/features/STREAM_GATING_v1.5.0.md`
