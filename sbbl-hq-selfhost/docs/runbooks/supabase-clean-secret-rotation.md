# Supabase Clean Secret Rotation Runbook

**Status:** COMPLETE — Rotated 2026-05-17
**Last Updated:** 2026-05-17
**Target:** SBBL-HQ Self-Hosted Supabase

---

## Overview

This runbook documents the step-by-step process for rotating all Supabase secrets in a production-safe manner. The rotation must be atomic, verifiable, and roll-backable.

---

## Preconditions

- Supabase stack is operational
- Production is BLOCKED until clean rotation succeeds
- Runtime target: Cloudflare (Pages + Workers), NOT Vercel

---

## Secret Constraints (Non-Negotiable)

| Secret | Required Length | Format |
| ---------------------- | --------------- | ------------------- |
| JWT_SECRET | 64+ chars | Alphanumeric |
| SECRET_KEY_BASE | 64+ chars minimum | Base64 |
| VAULT_ENC_KEY | **exactly** 32 chars | Hex |
| PG_META_CRYPTO_KEY | 32+ chars minimum | Base64 |
| POSTGRES_PASSWORD | 48+ chars | Alphanumeric |
| ANON_KEY | JWT with role=anon | HS256 signed |
| SERVICE_ROLE_KEY | JWT with role=service_role | HS256 signed |

---

## Rotation Sequence

### Phase 1: Pre-flight Checks

```bash
# Verify stack is operational
docker compose ps

# Verify HTTPS endpoints are reachable
curl -i https://supabase.sbbl-hq.icu/auth/v1/health
curl -i https://supabase.sbbl-hq.icu/rest/v1/
```

### Phase 2: Backup

```bash
# Backup .env
cp .env .env.bak-clean-rotation-$(date +%Y%m%d-%H%M%S)

# Backup _supabase internal DB (Supavisor tenant config)
docker exec supabase-db pg_dump -U postgres -d _supabase -f /tmp/_supabase-before-clean-rotation.sql
docker cp supabase-db:/tmp/_supabase-before-clean-rotation.sql ./_supabase-before-clean-rotation.sql
```

### Phase 3: Generate New Secrets

Use PS 5.1-compatible RNG only — `RandomNumberGenerator.Create().GetBytes()`, never `Fill()`:

```powershell
function Get-AlphaNumSecret {
    param([int]$Length)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    $rng.Dispose()
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
```

Generation rules:

- JWT_SECRET: 64+ alphanumeric chars
- SECRET_KEY_BASE: 64+ base64 (from 48 random bytes)
- VAULT_ENC_KEY: exactly 32 hex (from 16 random bytes)
- PG_META_CRYPTO_KEY: 32+ base64 (from 24 random bytes)
- POSTGRES_PASSWORD: 48+ alphanumeric chars

### Phase 4: Update .env

Use BOM-safe read/write — `[System.IO.File]::ReadAllText` with UTF-8 no-BOM encoding:

```powershell
$envContent = [System.IO.File]::ReadAllText($EnvPath).TrimStart([char]0xFEFF)
$envContent = $envContent -replace '(?m)^JWT_SECRET=.*', "JWT_SECRET=$newJwtSecret"
# ... repeat for all secrets
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($EnvPath, $envContent, $utf8NoBom)
```

### Phase 5: Generate API Keys

ANON_KEY and SERVICE_ROLE_KEY are generated in-process via `New-LegacyJwt` — no Python dependency:

```powershell
function New-LegacyJwt {
    param([string]$Role, [string]$Secret)
    $now = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $exp = $now + (60 * 60 * 24 * 365 * 10)
    $header = @{ alg = "HS256"; typ = "JWT" } | ConvertTo-Json -Compress
    $payload = @{ role = $Role; iss = "supabase"; iat = $now; exp = $exp } | ConvertTo-Json -Compress
    # ... base64url encode + HMAC-SHA256 sign
}
```

### Phase 6: Update Database

```sql
ALTER ROLE postgres WITH PASSWORD 'new-password';
ALTER ROLE authenticator WITH PASSWORD 'new-password';
ALTER ROLE pgbouncer WITH PASSWORD 'new-password';
ALTER ROLE supabase_admin WITH PASSWORD 'new-password';
ALTER ROLE supabase_auth_admin WITH PASSWORD 'new-password';
ALTER ROLE supabase_functions_admin WITH PASSWORD 'new-password';
ALTER ROLE supabase_storage_admin WITH PASSWORD 'new-password';

ALTER DATABASE postgres SET app.settings.jwt_secret TO 'new-jwt-secret';
ALTER DATABASE postgres SET app.settings.jwt_exp TO '3600';
```

Note: Do NOT use quoted GUC names (`"app.settings.jwt_secret"`) — the double-quotes confuse the Windows PowerShell → Docker → psql argument chain. Unquoted works in all tested versions.

### Phase 7: Recreate Services

```powershell
docker compose up -d --force-recreate --remove-orphans `
    db auth rest storage supavisor kong meta studio functions realtime
```

Wait 60 seconds for services to stabilize.

### Phase 8: Supavisor Health Check

If `supavisor` logs contain `Unknown cipher`, `invalid key`, or `badarg`:

```bash
# Terminate connections and reset _supabase DB
docker exec supabase-db psql -U postgres -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '_supabase' AND pid <> pg_backend_pid();"
docker exec supabase-db psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS _supabase;"
docker exec supabase-db psql -U postgres -d postgres -c "CREATE DATABASE _supabase;"
docker compose up -d --force-recreate supavisor
```

### Phase 9: Validation

Run the validation script:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-supabase-core.ps1
```

Acceptance criteria:

- db, kong, auth, storage, supavisor, realtime, studio: healthy
- `GET /rest/v1/` with ANON_KEY: 200 OK
- `GET /auth/v1/health` with ANON_KEY: 200 OK

Run the E2E auth test:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-auth-e2e.ps1
```

Acceptance criteria:

- Signup: 200 OK
- Signin: 200 OK
- Access token: received
- User endpoint: 200 OK
- JWT claims: role=authenticated, expiry valid

### Phase 10: Cloudflare Handoff

Update Cloudflare Pages and Workers with keys from `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.sbbl-hq.icu
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from .env>
SERVER_SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from .env>
```

---

## Execution Command

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\clean-secret-rotation.ps1
```

## Rollback Command

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-secret-rotation.ps1
```

---

## Rollback Procedure

If rotation fails:

```bash
# Restore .env from backup
cp .env.bak-clean-rotation-<timestamp> .env

# Restore _supabase DB if needed
docker exec -i supabase-db psql -U postgres -d postgres < ./_supabase-before-clean-rotation.sql

# Recreate services to pick up old config
docker compose up -d --force-recreate db auth rest storage supavisor kong
```

---

## Known Risks

1. **VAULT_ENC_KEY** — If changed, Supavisor may fail to decrypt tenant config. Solution: reset `_supabase` DB and reseed (handled automatically in step 8).
2. **JWT_SECRET mismatch** — Must match between `.env` and database GUC. Both are updated atomically by the script.
3. **Old API keys** — Frontend must be updated with new ANON_KEY after rotation.
4. **Email confirmation** — Self-hosted stacks without a running SMTP relay must set `ENABLE_EMAIL_AUTOCONFIRM=true` or configure an external SMTP provider.

---

## SMTP Note

The default compose includes `supabase-mail` (Inbucket). If it is not running (e.g., removed from compose), signup will fail with:

```text
dial tcp: lookup supabase-mail: no such host
```

Fix: set `ENABLE_EMAIL_AUTOCONFIRM=true` in `.env` and recreate the `auth` container.

---

## Post-Rotation Verification (Completed 2026-05-17)

### E2E Auth Test Results

| Test | Status |
| ---- | ------ |
| Signup | ✅ HTTP 200 OK |
| Signin | ✅ HTTP 200 OK |
| Access Token | ✅ Received |
| Refresh Token | ✅ Received |
| User Settings | ✅ HTTP 200 OK |
| JWT Claims | ✅ role=authenticated, expiry valid |

### Service Health

| Service | Status |
| ------- | ------ |
| db | ✅ healthy |
| kong | ✅ healthy |
| auth | ✅ healthy |
| rest | ✅ HTTP 200 |
| storage | ✅ healthy |
| supavisor | ✅ healthy |
| realtime | ✅ healthy |
| studio | ✅ healthy |

### Rotated Configuration

- All secrets meet length requirements
- `ENABLE_EMAIL_AUTOCONFIRM=true` (self-hosted, no SMTP relay)
- JWT expiry: 3600 seconds
- ANON_KEY and SERVICE_ROLE_KEY updated in Cloudflare Pages
