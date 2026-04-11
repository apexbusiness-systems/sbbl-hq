# CTO Zero-Cost Stream Optimization — 2026-04-11 v1.0.0

## 1) Repository context map (current)

### Runtime architecture
- **Frontend app:** React 18 + Vite + TypeScript (`src/`), routing and pages under `src/pages`, reusable UI in `src/components`.
- **Edge backend:** Cloudflare Worker in `src/worker/index.ts` with route-level auth, stream/session controls, ingest pipeline, health and metrics endpoints.
- **Data plane:** Supabase (SQL migrations under `supabase/migrations`) with RLS hardening, stream session constraints, ingest state machine.
- **Quality gates:** Vitest test suites in `src/test`, stream chaos + 20k stress tests, GitHub Actions workflows in `.github/workflows`.

### Stream/broadcast-critical modules
- **Viewer session + playback gate:** `src/components/LiveStreamPlayer.tsx`
- **Live page orchestration:** `src/pages/Live.tsx`
- **Typed stream API client:** `src/lib/api/stream.ts`
- **Session/heartbeat enforcement:** `src/worker/index.ts`
- **Operational validation contracts:** `src/worker/validation-contract-wrapper.ts`, `ops/validation/stream-validation.mjs`

## 2) Research-backed zero-cost leverage opportunities

### Opportunity A — QoE-driven auto-recovery loops (implemented in this pass)
Problem:
- Viewer drop-off increases when transient packet loss / Wi‑Fi handoff creates short playback failures.

Zero-cost approach:
- Client-side bounded exponential backoff + jitter + online-event recovery.
- Add adaptive delay for constrained links so reconnect storms do not amplify congestion.

Moat angle:
- First-party reliability heuristics tuned to your own stream failure signatures and incident postmortems.
- This accumulates as proprietary operational intelligence with no vendor spend.

### Opportunity B — Data network-aware player policy (partially enabled)
- Detect browser connection hints (`effectiveType`, `downlink`, `saveData`) and route retry behavior by network tier.
- Enables deterministic guardrails for weak links while preserving fast reconnect on stable links.

### Opportunity C — Edge QoE telemetry loop (next increment)
- Emit retry-attempt counters and recovery success/fail events to Worker analytics endpoint.
- Feed into existing ops dashboards and release gates to tune thresholds by league, device class, and region.

## 3) Production guardrails and contingency model
- **Idempotent recovery:** each auto-recovery cycle only remounts player instance; does not create duplicate purchase/session actions.
- **Bounded retries:** strict max-attempt ceiling prevents infinite reconnect loops and battery drain.
- **Offline/online fail-safe:** browser `online` event triggers clean remount and attempt counter reset.
- **Congestion safety:** constrained networks get extended reconnect intervals to avoid request bursts.

## 4) Delivery in this patch
1. Added reusable stream reliability primitives under `src/lib/stream-reliability.ts`.
2. Integrated adaptive auto-recovery into `LiveStreamPlayer` with:
   - bounded backoff retries,
   - network-tier-aware delay scaling,
   - online-event reconnect.
3. Added tests for reliability primitives in `src/test/stream-reliability.test.ts`.

## 5) Next production increment (recommended)
- Wire a Worker endpoint (`/api/streams/qoe`) for anonymized QoE events with abuse limits.
- Add SLOs: reconnect success rate, median time-to-recover, retries-per-session p95.
- Promote thresholds to ops-config table for hot updates without redeploy.
