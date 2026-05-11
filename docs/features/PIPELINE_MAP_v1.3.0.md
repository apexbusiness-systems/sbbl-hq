<!-- Version: v1.4.0 | Date: 2026-05-11 | Status: Current -->
# SBBL HQ Pipeline Map (Internal)

## 1) Trust Boundary and Env Systems
- Frontend (Vite/browser bundle): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`
- Worker runtime (Cloudflare secrets): `SUPABASE_SERVICE_ROLE_KEY` via `wrangler secret put`
- Worker public vars (non-secret): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

Rule:
- Browser never receives or references service-role secrets.
- Worker admin writes always use `env.SUPABASE_SERVICE_ROLE_KEY`.

## 2) Ingress Entry Points
- CSV ingest:
  - `/ops/imports/teams`
  - `/ops/imports/players`
  - `/ops/imports/schedules`
  - `/ops/imports/events`
- Scores ingest:
  - `/ops/scores/import`
  - `/ops/scores/game`
- Parser ingress:
  - `/ops/potg/parse`
  - `/ops/scores/parse-image`
- Media ingest:
  - `/ops/store/media`
  - `/ops/potg/submit`
  - Canonical ingest state machine:
    - `/ops/ingest/presign`
    - `/ops/ingest/submit`
    - `/ops/ingest/:jobId`
    - `/ops/ingest/:jobId/approve`
    - `/ops/ingest/:jobId/reject`
    - `/ops/ingest/:jobId/replay`

## 3) Parse and Normalize Layer
- Client-side image prep:
  - `resizeImageToFit(...)`
  - `inferTargetDimensions(...)`
- Vision parser calls:
  - POTG parser payload: `{ imageBase64, mimeType }`
  - Scoreboard parser payload: `{ imageBase64, mimeType }`
- Worker validation:
  - idempotency key enforcement
  - role checks (`super_admin` for ops ingest mutations)

## 4) Persistence Projection
- Canonical publication flow:
  - `media_assets` write
  - `media_publications` projection
- Ingest state machine traceability:
  - `ingest_jobs` (`uploaded -> classified -> validated -> written -> projected/published` or `failed`)
- Audit trace:
  - `audit_logs`

## 5) Render Endpoints
- `/api/public/media`
- `/api/public/potg`
- `/api/public/schedule`
- `/api/scores`

Public render contract:
- reads publication layer (`media_publications`) not raw ingest payloads
- returns cacheable, presentation-ready records

## 6) Container Fit and Resize Contract
- Portrait POTG target: `560x747` (`cover`)
- Landscape graphic target: `747x560` (`cover`)
- Store media target: `800x800`
- Render surface contract uses constrained card ratio (`3:4`) for stable fit in media grids.

## 8) OmniBridge Layer

Added in v1.5.0 (PR #502). Bidirectional sync channel between SBBL-HQ and APEX-OmniHub.

### Inbound command path

```
OmniHub (external)
  → POST /webhooks/omnihub   (handleOmnihubWebhook)
      │
      ├─ HMAC-SHA256 signature verify (OMNIHUB_VERIFY_KEY)
      │   └─ invalid → 401
      │
      ├─ Clock-skew check (±300 s)
      │   └─ outside window → 400
      │
      ├─ Risk-lane classify (content-level blast-radius guard)
      │   └─ BLOCKED lane → 400 (even if HMAC valid)
      │
      ├─ Idempotency check (api_idempotency_keys on command_id)
      │   └─ duplicate → 200 already_processed (no re-execution)
      │
      ├─ Action allowlist check (9 permitted actions)
      │   └─ not on list → 400 action_not_allowed
      │
      ├─ Action dispatch (disable_stream | enable_stream | revoke_access |
      │                   grant_access | emergency_halt | broadcast_message |
      │                   force_man_review | hotfix_dispatch | ping)
      │
      └─ Audit log  →  log_admin_action RPC  →  audit_logs
```

### Outbound telemetry path

```
omnibridge_outbox (pending records)
  → POST /sync/drain          (handleSyncDrain)
      │
      └─ deliverSyncEnvelope()
            │
            ├─ Build envelope: { packet: SyncPacket, signature: HMAC-SHA256(OMNIHUB_SIGNING_SECRET) }
            ├─ Set headers: X-Omni-Source, X-Omni-Signature, X-Omni-Packet-Id, X-Omni-Trace-Id
            ├─ Retry loop: 4 attempts, exponential backoff (250 ms → 1 s → 4 s)
            │   └─ 4xx response → fast-fail (no retry on client rejection)
            │
            └─ OmniHub /api/omnibridge/sync  (OMNIHUB_SYNC_URL)
```

## 7) Verification Artifacts
- `src/test/endpoint-ingress-render-checklist.test.ts`
- `src/test/env-system-separation-audit.test.ts`
- `src/test/worker-ingest-pipeline.test.ts`
- `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.3.0.md`
