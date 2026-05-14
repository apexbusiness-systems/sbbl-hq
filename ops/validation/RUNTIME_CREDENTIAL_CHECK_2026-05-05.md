# Runtime Credential & Public Endpoint Check — 2026-05-05

## Scope
Production-safe runtime verification using only environment-injected credentials available in this container.

## Automation
Use the committed script to rerun this exact check deterministically:

```bash
ops/validation/check_runtime_access.sh
```

The script intentionally prints only **set/unset** states and never prints secret values.

## Step 1 — Environment credential presence (values redacted)
Result from current runtime:
- GH_TOKEN=unset
- GITHUB_TOKEN=unset
- GITHUB_AG_TOKEN=unset
- SUPABASE_URL=set
- SUPABASE_ANON_KEY=set
- SUPABASE_SERVICE_ROLE_KEY=unset
- SUPABASE_TOKEN=unset

Interpretation:
- GitHub API operations are blocked (no token injected in this shell environment).
- Privileged Supabase checks are blocked (no service role key/token injected).
- Anonymous Supabase checks are possible.

## Step 2 — Anonymous Supabase RPC check (`get_active_broadcast`)
Command executed by script:

```bash
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/rpc/get_active_broadcast"
```

Result:
- HTTP 404
- PostgREST error code: `PGRST202`
- Message: could not find `public.get_active_broadcast` in schema cache.

Interpretation:
- Either this runtime `SUPABASE_URL` points at a different project/environment,
  or the function is not present/exposed in the targeted project schema cache.

## Step 3 — Public stream status endpoint check (`/api/streams/status`)
Command executed by script:

```bash
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' https://sbbl-hq.icu/api/streams/status
```

Result:
- HTTP 403
- Cloudflare challenge page (JS/cookie gate) returned instead of JSON payload.

Interpretation:
- Non-browser runtime polling from this container is blocked by upstream Cloudflare protection,
  so direct JSON comparison against Supabase RPC output cannot be completed here.

## Blockers to full requested workflow
1. Missing GitHub token (`GH_TOKEN` / `GITHUB_TOKEN` / `GITHUB_AG_TOKEN`) blocks PR inline comment retrieval.
2. Missing privileged Supabase credential (`SUPABASE_SERVICE_ROLE_KEY` or equivalent DB admin access) blocks production SQL definition introspection.
3. Cloudflare challenge on `https://sbbl-hq.icu/api/streams/status` blocks machine-to-machine public status JSON retrieval from this environment.

## Immediate next requirements
- Inject `GITHUB_TOKEN` (or equivalent) for GitHub PR comment API access in this runtime.
- Inject `SUPABASE_SERVICE_ROLE_KEY` (or provide DB admin channel) for SQL verification and privileged comparisons.
- Provide an allowlisted machine path (or challenge bypass) for `/api/streams/status` to support deterministic API comparison from container runtime.

## Re-run evidence — 2026-05-05 (follow-up)
- Re-ran `ops/validation/check_runtime_access.sh` in branch `work`.
- `GITHUB_TOKEN` remains unset in this runtime.
- `SUPABASE_SERVICE_ROLE_KEY` remains unset in this runtime.
- Anon RPC status remains `HTTP 404` with `PGRST202`.
- Public `/api/streams/status` remains blocked by Cloudflare challenge (`HTTP 403`).

Status:
- **BLOCKED: Credential access required. Provide via secure channel.**

## Credential-injected execution — 2026-05-05 (secure runtime)
Using securely injected runtime credentials, the checker was re-run with `GH_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` present.

Observed:
- GitHub token probe (`GET https://api.github.com/rate_limit`) returned `HTTP 200`.
- Anon RPC `get_active_broadcast` remained `HTTP 404` with `PGRST202`.
- Service-role RPC `get_active_broadcast` also failed against current `SUPABASE_URL` target (function not available in schema cache for this endpoint target).
- Public `https://sbbl-hq.icu/api/streams/status` remained blocked by Cloudflare challenge (`HTTP 403`).

Conclusion:
- Credentials are valid and usable at runtime for GitHub API access.
- Remaining failures are now attributable to target/environment mismatch and upstream edge protection, not missing credentials.

## Targeted URL re-check — 2026-05-05 (`SUPABASE_URL=https://ezanilxygnpucwkwpsoc.supabase.co`)
Executed checker with explicit URL override:

```bash
SUPABASE_URL=https://ezanilxygnpucwkwpsoc.supabase.co ops/validation/check_runtime_access.sh
```

Observed:
- `get_active_broadcast` RPC still returns `HTTP 404` with `PGRST202` (function absent from schema cache on this target).
- Public `/api/streams/status` still returns `HTTP 403` Cloudflare challenge.

Conclusion:
- The provided URL override does not change current failure mode; missing RPC exposure/function deployment remains the primary Supabase blocker for this runtime path.
