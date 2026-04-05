#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scripts/01-generate-keys.sh
# Generates signed ANON_KEY and SERVICE_ROLE_KEY JWTs from the
# JWT_SECRET in .env, then patches .env in place.
# Usage:  bash scripts/01-generate-keys.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

if ! command -v python3 &>/dev/null; then
  echo "❌ python3 required (pip install PyJWT)"
  exit 1
fi

if ! python3 -c "import jwt" 2>/dev/null; then
  pip3 install -q PyJWT
fi

source .env

ANON=$(python3 - <<PYEOF
import jwt, time
now = int(time.time())
payload_anon = {
    "role": "anon",
    "iss": "supabase",
    "iat": now,
    "exp": now + (10 * 365 * 24 * 3600)   # 10-year token
}
print(jwt.encode(payload_anon, "${JWT_SECRET}", algorithm="HS256"))
PYEOF
)

SVC=$(python3 - <<PYEOF
import jwt, time
now = int(time.time())
payload_svc = {
    "role": "service_role",
    "iss": "supabase",
    "iat": now,
    "exp": now + (10 * 365 * 24 * 3600)
}
print(jwt.encode(payload_svc, "${JWT_SECRET}", algorithm="HS256"))
PYEOF
)

# Patch .env
sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON}|" .env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SVC}|" .env

echo "✅ ANON_KEY and SERVICE_ROLE_KEY written to .env"
echo ""
echo "  ANON_KEY      → ${ANON:0:60}..."
echo "  SERVICE_ROLE  → ${SVC:0:60}..."
