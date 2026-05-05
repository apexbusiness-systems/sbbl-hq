# Runtime Credential & Public Endpoint Check — 2026-05-05

## Scope
Production-safe runtime verification using only environment-injected credentials available in this container.

## Step 1 — Environment credential presence (values redacted)
Command:

```bash
for v in GH_TOKEN GITHUB_TOKEN GITHUB_AG_TOKEN SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_TOKEN; do if [ -n "${!v}" ]; then echo "$v=set"; else echo "$v=unset"; fi; done
```

Result:
- GH_TOKEN=unset
- GITHUB_TOKEN=unset
- GITHUB_AG_TOKEN=unset
- SUPABASE_URL=set
- SUPABASE_ANON_KEY=set
- SUPABASE_SERVICE_ROLE_KEY=unset
- SUPABASE_TOKEN=unset

Interpretation:
- GitHub API operations are blocked (no token).
- Privileged Supabase checks are blocked (no service role key/token).
- Anonymous Supabase checks are possible.

## Step 2 — Anonymous Supabase RPC check (`get_active_broadcast`)
Command:

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
Command:

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
- Inject `GITHUB_TOKEN` (or equivalent) for GitHub PR comment API access.
- Inject `SUPABASE_SERVICE_ROLE_KEY` (or provide DB admin channel) for SQL verification and privileged comparisons.
- Provide an allowlisted machine path (or challenge bypass) for `/api/streams/status` to support deterministic API comparison from container runtime.
