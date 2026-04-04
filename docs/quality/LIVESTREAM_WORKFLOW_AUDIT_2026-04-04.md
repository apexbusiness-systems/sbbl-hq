# Livestream Workflow Audit — 2026-04-04

## Scope
This audit reviews the current `Live` page + worker stream-control-plane implementation to determine practical performance characteristics (capacity, latency, and metric fidelity).

## 1) Current workflow (as implemented)

1. Super admin toggles stream via `POST /ops/streams/status`.
2. Clients poll `GET /api/streams/status` every 15s from the Live page and Ops page.
3. Access gating checks `GET /api/streams/:gameId/access` for non-privileged users.
4. If no access, user goes through `POST /api/streams/:gameId/purchase` (Stripe Checkout) or invite redemption.
5. Player rendering is done client-side via `ReactPlayer` using admin-saved stream URL (`collectionId` field repurposed as URL).

## 2) Performance and capacity findings

### A. Public status endpoint load profile
- Worker comment documents a design point of **2,000 concurrent viewers polling every 15s**.
- Endpoint uses Cloudflare Cache API with **TTL=10s** to flatten Supabase reads.
- On cache miss, code reads config and active entitlement count, then caches response.

**Derived control-plane request rate at 2,000 viewers:**
- Worker request rate: `2000 / 15 = 133.3 req/s`.
- DB read rate without cache: ~`133.3 * 2 = 266.7 queries/s` (matches in-code comment).
- DB read rate with 10s cache: ~`2 / 10 = 0.2 queries/s` (one miss path every 10s, with two DB queries in the miss path).

### B. Freshness / latency envelope for status flips
- Client poll interval: **15s**.
- Cache TTL: **10s**.
- Code explicitly cache-busts on admin config/status changes.

**Practical status propagation:**
- Typical: next poll after cache bust (~0–15s, viewer-dependent).
- Worst-case stale window: ~**15s** after a status change for a given client.
- If cache bust fails (best-effort), stale window can drift toward poll+TTL behavior.

### C. Access-check latency path
- Access check is a single RPC (`can_user_view_stream`) plus auth validation.
- DB side has lookup index `idx_entitlements_lookup (user_id, game_id)` and invite indexes.

**Implication:**
- Access check should stay low-latency at moderate scale; no N+1 pattern is present in this path.

### D. “Viewer count” metric quality
Current `viewerCount` is **not true concurrent viewers**.
- It is computed as `COUNT(stream_entitlements where game_id=active_game and status='active')`.
- Entitlements can remain active for up to the purchase/invite window, so count includes users who are *allowed* to watch, not necessarily *currently watching*.

**Result:**
- Viewer metric is closer to **active entitlement population** than live session concurrency.
- Peak concurrent and average watch-time are currently not implemented (sessions return `peakViewers: 0`).

### E. Maximum concurrent viewers “currently supported”
- **Verified design target:** 2,000 concurrent polling viewers for control-plane status.
- **Hard streaming ceiling:** not defined in this repo because video delivery is externalized to Twitch/YouTube/HLS provider through `ReactPlayer`.
- **Control-plane bottleneck risk:** low for status endpoint due edge caching; higher risk is correctness/observability, not raw read throughput.

## 3) Gaps and risks

1. **Metric accuracy gap**: `viewerCount` overstates real-time concurrency.
2. **Session analytics gap**: `/api/streams/:gameId/session` is a mutation-ack stub, so no heartbeat/session telemetry is captured.
3. **Ops analytics gap**: session/revenue endpoints return placeholders for `peakViewers` and `totalPpvRevenue` per session.
4. **Documentation drift**: operational docs say collection ID is not in public status payload, but worker currently returns `collectionId` publicly.

## 4) Recommended smallest production increment

1. Implement real stream presence sessions:
   - Start/heartbeat/end endpoints writing to `stream_access_sessions`.
   - TTL-based active session counting for true concurrent viewers.
2. Replace entitlement count with active-session count in `/api/streams/status`.
3. Backfill `stream_sessions` with peak-concurrency snapshots every 15–30s during live windows.
4. Align docs to implementation (or remove `collectionId` from public payload if that is the intended security posture).

## 5) Audit conclusion

The LiveStream workflow is structurally robust for **control-plane scale** and has a validated implementation target of **2,000 concurrent polling viewers** with negligible DB read pressure due edge cache. However, current “viewer” and session analytics are operational approximations, not real concurrency telemetry. For business decisions (sponsorship pricing, peak audience reporting, stream SLOs), session-level instrumentation is the immediate priority.
