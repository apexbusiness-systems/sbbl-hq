# SBBL HQ OmniBridge Deep Reference
<!-- Version: v2.0.0 | Date: 2026-05-20 | PR: #502 -->

## Architecture

```
APEX-OmniHub Control Plane
      │
      │  HMAC-SHA256 signed (OMNIHUB_VERIFY_KEY)
      ▼
POST /webhooks/omnihub  ─── handleOmnihubWebhook
      │
      ├── 1. Verify X-Omni-Source = "sbbl-hq"
      ├── 2. Verify clock skew ≤ 300s
      ├── 3. Verify HMAC signature (X-Omni-Signature)
      ├── 4. Check BLOCKED-lane patterns (before dispatch)
      ├── 5. Check idempotency (api_idempotency_keys)
      ├── 6. Dispatch to allowlisted action
      └── 7. log_admin_action() (always, even on no-op)

SBBL HQ → OmniHub:
POST /sync/drain ─── handleSyncDrain
      │
      ├── Build SyncPacket envelope
      ├── HMAC-SHA256 sign (OMNIHUB_SIGNING_SECRET)
      └── deliverSyncEnvelope() → 4-attempt exponential backoff
```

## Inbound: `POST /webhooks/omnihub`

### Required Headers
| Header | Value |
|--------|-------|
| `X-Omni-Source` | Must equal `"sbbl-hq"` (target_source pin) |
| `X-Omni-Signature` | `base64url(HMAC-SHA256(secret, JSON.stringify(packet)))` |
| `X-Omni-Packet-Id` | Idempotency key (stored in `api_idempotency_keys`) |
| `X-Omni-Trace-Id` | Propagated in logs and audit records |

### Envelope Shape
```ts
{
  packet: SyncPacket,
  signature: string // base64url HMAC-SHA256
}
```

### 9-Action Allowlist (FROZEN — no additions without owner approval)
```
disable_stream
enable_stream
revoke_access
grant_access
emergency_halt
broadcast_message
force_man_review
hotfix_dispatch
ping
```

Any action NOT on this list → `400 action_not_allowed`.

### BLOCKED-Lane Patterns (rejected before dispatch, even with valid HMAC)
```
DROP TABLE
ALTER ROLE
DISABLE RLS
TRUNCATE
GRANT ALL PRIVILEGES
```

### Idempotency
- `X-Omni-Packet-Id` stored in `api_idempotency_keys` on first processing
- Replayed packet IDs → `200 already_processed` (no re-execution)

### Authentication Keys
- Production: `OMNIHUB_VERIFY_KEY` (separate from signing key)
- Dev/staging: Falls back to `OMNIHUB_SIGNING_SECRET` when `OMNIHUB_VERIFY_KEY` absent
- Clock-skew window: ±300 seconds

### Audit
Every accepted command → `log_admin_action()` RPC.
Record includes: command_id, action name, risk lane, X-Omni-Trace-Id.

## Outbound: `POST /sync/drain`

### Envelope Shape
```ts
{
  packet: SyncPacket,
  signature: string // base64url(HMAC-SHA256(OMNIHUB_SIGNING_SECRET, JSON.stringify(packet)))
}
```

### Required Outbound Headers
```
X-Omni-Source:    "sbbl-hq"
X-Omni-Signature: <base64url HMAC>
X-Omni-Packet-Id: <packet.id>
X-Omni-Trace-Id:  <trace id>
```

### Retry Policy (`deliverSyncEnvelope`)
| Attempt | Delay before retry |
|---------|--------------------|
| 1 (initial) | — |
| 2 | 250 ms |
| 3 | 1 s |
| 4 | 4 s |

- Per-attempt timeout: 5 seconds
- 4xx response → fast-fail (non-retryable, do NOT retry on client errors)
- 5xx response → retry (transient server errors)

## Diagnostic Endpoint: `POST /api/omniport/command`

Auth: Standard Supabase JWT (`requireAuth`). No HMAC.

| Command | Response |
|---------|----------|
| `PING` | `{ ok: true, ts: <ISO timestamp> }` |
| `ECHO` | Request payload verbatim |
| `HEALTH_CHECK` | Worker health snapshot |
| `TELEMETRY_SNAPSHOT` | Recent QoE/telemetry metrics |

Any other command → `400 unsupported_command`.

## Required Cloudflare Worker Secrets

| Secret | Purpose | Required |
|--------|---------|----------|
| `OMNIHUB_SIGNING_SECRET` | Sign outbound sync envelopes | Always |
| `OMNIHUB_SYNC_URL` | OmniHub endpoint for outbound packets | Always |
| `OMNIHUB_VERIFY_KEY` | Verify inbound OmniHub commands | Production |

## HARD RULES (non-negotiable in every review)

1. NEVER bypass the 9-action allowlist
2. NEVER skip idempotency check
3. NEVER skip HMAC verify step — missing/invalid sig → 401, always
4. NEVER process BLOCKED-lane payload even with valid HMAC
5. NEVER remove or weaken `target_source === "sbbl-hq"` pin

## Integration Tests

`src/worker/tests/omnihub-bridge.integration.test.ts` — 14 tests (ALL must pass):

1. Header presence validation
2. Signature failure rejection
3. Target mismatch (target_source pin)
4. Clock-skew rejection (>300s)
5. Valid `ping` dispatch
6. BLOCKED payload rejection
7. Replay dedup (idempotency)
8. 401 unauthenticated
9. PING command
10. Unsupported command
11. HEALTH_CHECK
12. Sync drain envelope shape
13. 5xx retry (backoff triggered)
14. 4xx fast-fail (no retry)
