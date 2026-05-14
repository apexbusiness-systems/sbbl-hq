#!/usr/bin/env bash
set -euo pipefail

# Non-obvious: keep output deterministic and never print secret values.
required_vars=(SUPABASE_URL SUPABASE_ANON_KEY)
for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "ERROR: $v is required but unset" >&2
    exit 1
  fi
done

for v in GH_TOKEN GITHUB_TOKEN GITHUB_AG_TOKEN SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_TOKEN; do
  if [[ -n "${!v:-}" ]]; then
    echo "$v=set"
  else
    echo "$v=unset"
  fi
done

gh_runtime_token="${GITHUB_TOKEN:-${GH_TOKEN:-${GITHUB_AG_TOKEN:-}}}"
if [[ -n "$gh_runtime_token" ]]; then
  echo "--- GitHub token probe (/rate_limit) ---"
  curl -sS -w '\nHTTP_STATUS:%{http_code}\n' \
    -H "Authorization: Bearer $gh_runtime_token" \
    -H 'Accept: application/vnd.github+json' \
    https://api.github.com/rate_limit
fi

echo "--- RPC get_active_broadcast (anon) ---"
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/rpc/get_active_broadcast"

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "--- RPC get_active_broadcast (service_role) ---"
  curl -sS -w '\nHTTP_STATUS:%{http_code}\n' \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$SUPABASE_URL/rest/v1/rpc/get_active_broadcast"
fi

echo "--- Public /api/streams/status ---"
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' \
  "https://sbbl-hq.icu/api/streams/status"
