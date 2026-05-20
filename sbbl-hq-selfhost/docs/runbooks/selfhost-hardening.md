# Self-Hosted Supabase — Hardening & Operations Runbook

Last verified: 2026-05-20.

This runbook captures every operational invariant required to keep the
self-hosted Supabase stack (`https://supabase.sbbl-hq.icu`) running
correctly in production. It complements
[`supabase-clean-secret-rotation.md`](./supabase-clean-secret-rotation.md)
(which handles full JWT key rotation) by covering the day-2 operations
that the 2026-05-20 login-outage incident exposed.

---

## 1. Architecture invariants (do not break)

| Invariant | File / mechanism enforcing it |
|---|---|
| Shell scripts checkout with LF on Windows | `sbbl-hq-selfhost/.gitattributes` (`*.sh text eol=lf`) |
| YAML / SQL / Elixir checkout with LF on Windows | Same (`*.yml`, `*.yaml`, `*.sql`, `*.exs`, `*.ex`) |
| Active Docker root is the OUTER `sbbl-hq-selfhost/` | `WARNING_NOT_ACTIVE_SELFHOST_ROOT.md` markers + presence of `.env` |
| Kong CORS allows every header supabase-js v2 sends | `volumes/api/kong.yml` + `selfhost-auth-smoke.yml` CI workflow |
| Service role passwords match `POSTGRES_PASSWORD` | `volumes/db/roles.sql` + `scripts/rotate-postgres-password.ps1` |
| `graphql_public` schema exists | `volumes/db/graphql.sql` |
| `supabase_realtime_admin` role exists | `volumes/db/roles.sql` |
| `_realtime` schema exists with grants | `volumes/db/realtime.sql` |
| `_supabase` database exists | `volumes/db/_supabase.sql` |
| `auth.*` functions owned by `supabase_auth_admin` | `scripts/repair-selfhost-db.ps1` (recovery only — fresh init does this via the image) |

---

## 2. Common failures → fast diagnosis table

| Symptom | Most likely cause | Fix |
|---|---|---|
| Browser: `Failed to fetch` on `/auth/v1/token`, DevTools shows `Request header field X is not allowed by Access-Control-Allow-Headers` | `volumes/api/kong.yml` missing a header from its allowlist | Add header to all 5 `auth-v1*` route CORS configs; `docker compose up -d --force-recreate kong` |
| Cloudflare 502 on every `/auth/v1/*` request | Kong container crash-looping (often CRLF in `kong-entrypoint.sh`) | `docker compose logs kong`; if `exec ... no such file or directory`, run on-disk LF conversion of `volumes/api/kong-entrypoint.sh` |
| GoTrue logs `password authentication failed for user "supabase_auth_admin"` | `.env` `POSTGRES_PASSWORD` drifted from DB | `scripts/repair-selfhost-db.ps1` |
| GoTrue logs `must be owner of function uid (SQLSTATE 42501)` | `auth.*` functions owned by wrong role | `scripts/repair-selfhost-db.ps1` |
| PostgREST logs `schema "graphql_public" does not exist` | Init scripts never ran or were incomplete | `scripts/repair-selfhost-db.ps1` |
| Realtime logs `role supabase_realtime_admin does not exist` | Role missing | `scripts/repair-selfhost-db.ps1` |
| Supavisor logs `database "_supabase" does not exist` | DB missing | `scripts/repair-selfhost-db.ps1` |
| Supavisor logs `(SyntaxError) unexpected token: carriage return (column 4, code point U+000D)` | CRLF in `volumes/pooler/pooler.exs` | LF-convert the file; `docker compose up -d --force-recreate supavisor` |

---

## 3. The init-script chain (alphabetical order within `/docker-entrypoint-initdb.d/`)

Both subdirectories are recursed by the supabase/postgres image entrypoint.
File contents must be **idempotent** so re-runs against an existing data
volume are safe.

```
/docker-entrypoint-initdb.d/
  migrations/
    97-_supabase.sql      → create _supabase database (for supavisor)
    99-graphql.sql        → CREATE EXTENSION pg_graphql + graphql_public schema
    99-logs.sql           → _analytics schema
    99-pooler.sql         → _supavisor schema
    99-realtime.sql       → _realtime + realtime schemas + grants
  init-scripts/
    98-webhooks.sql       → pg_net HTTP webhook infrastructure
    99-jwt.sql            → app.settings.jwt_secret + jwt_exp GUCs
    99-roles.sql          → service role passwords from $POSTGRES_PASSWORD + supabase_realtime_admin role
```

Sources live in `sbbl-hq-selfhost/volumes/db/*.sql` and are mounted by the
`db:` service in `docker-compose.yml`.

---

## 4. Routine operations

### 4.1 Recover a drifted DB without rebuilding

When any of the symptoms in §2 appear and `docker compose ps` shows the
DB itself is running:

```powershell
cd C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost
.\scripts\repair-selfhost-db.ps1
docker compose restart auth rest realtime storage supavisor
```

Safe to run repeatedly. Reads `POSTGRES_PASSWORD` from `.env` and never
prints it.

### 4.2 Rotate `POSTGRES_PASSWORD`

```powershell
cd C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost
.\scripts\rotate-postgres-password.ps1 -DryRun   # preview
.\scripts\rotate-postgres-password.ps1
```

Rotates the password in the DB FIRST, then `.env`, then restarts the
services that read `POSTGRES_PASSWORD` at boot. If the DB step fails,
`.env` is untouched.

For full JWT-secret rotation (different concern — affects every issued
token), use [`supabase-clean-secret-rotation.md`](./supabase-clean-secret-rotation.md).

### 4.3 Validate after any change

```powershell
.\scripts\validate-supabase-core.ps1
.\scripts\test-auth-e2e.ps1
```

These hit `https://supabase.sbbl-hq.icu/auth/v1/*` and verify a full
sign-up → sign-in → JWT validation roundtrip.

### 4.4 CRLF emergency conversion (any file type)

Windows `git checkout` can write CRLF to any file not covered by
`.gitattributes`. To fix one file on disk without committing:

```powershell
$path = "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\<file>"
$content = [System.IO.File]::ReadAllText($path)
$fixed = $content -replace "`r`n", "`n" -replace "`r", "`n"
[System.IO.File]::WriteAllText($path, $fixed, (New-Object System.Text.UTF8Encoding($false)))
```

Then add the file extension to `sbbl-hq-selfhost/.gitattributes` and
commit so the fix is permanent.

---

## 5. Disaster recovery — full rebuild

If the `volumes/db/data` directory is wiped or corrupted:

1. **Stop the stack:** `docker compose stop` (DO NOT `down -v`).
2. **Back up if possible:** `docker compose exec db pg_dumpall -U postgres > backup-$(Get-Date -Format yyyyMMdd-HHmm).sql`
   (will fail if the DB is already corrupted — that's fine, skip).
3. **Remove the data volume:** delete `volumes/db/data` only if the DB
   really is unrecoverable. **This is destructive.**
4. **Bring the stack up:** `docker compose up -d db` — the init chain in
   §3 will run automatically against the fresh DB.
5. **Wait for `db` to be `healthy`:** `docker compose ps db`.
6. **Start the rest:** `docker compose up -d`.
7. **Run the repair script** (belt-and-braces for any image init that
   diverges from our pinned expectations):
   `.\scripts\repair-selfhost-db.ps1`
8. **Validate:** `.\scripts\validate-supabase-core.ps1` and
   `.\scripts\test-auth-e2e.ps1`.

Restoring from a `pg_dumpall` backup goes between steps 5 and 6:
`docker exec -i supabase-db psql -U postgres < backup-YYYYMMDD-HHMM.sql`.

---

## 6. Monitoring & alerting (defense in depth)

| Layer | Mechanism |
|---|---|
| CI nightly (06:00 UTC) | `.github/workflows/selfhost-auth-smoke.yml` — runs `OPTIONS` preflight + `POST /auth/v1/token` against production; fails if any required CORS header is missing or upstream returns 5xx |
| CI on every PR touching Kong | Same workflow, gated to `volumes/api/kong.yml` changes |
| Container restarts | `restart: unless-stopped` on every service in `docker-compose.yml` |
| Local smoke before deploy | `scripts/validate-supabase-core.ps1` |

To extend monitoring further (recommended but external):

- Add a Cloudflare uptime check on `https://supabase.sbbl-hq.icu/auth/v1/health`.
- Wire the CI workflow failure to a Slack or PagerDuty channel via a
  follow-up step.

---

## 7. Adding a new CORS header (when supabase-js adds one)

1. Add the header (lowercase preferred) to the `headers:` list in **every**
   `cors` config in `sbbl-hq-selfhost/volumes/api/kong.yml`. The file has
   5 explicit auth-route configs; `replace_all` covers them all if the
   surrounding block is identical (it is, by design).
2. Add the same header to `REQUIRED_HEADERS` in
   `.github/workflows/selfhost-auth-smoke.yml`.
3. Open a PR; the smoke workflow will run on the PR (`paths` trigger).
4. After merge, deploy:
   `git pull && docker compose up -d --force-recreate kong`.

---

## 8. Adding a new init invariant

When you discover something else that has to be true for the DB to work,
encode it as idempotent SQL:

1. Add a new file under `sbbl-hq-selfhost/volumes/db/<name>.sql` with
   `IF NOT EXISTS` / `DO $$ ... EXCEPTION` guards.
2. Mount it in `docker-compose.yml` under the `db:` service `volumes:`,
   using a numbered name (`99-<name>.sql`) in either `migrations/` or
   `init-scripts/`.
3. Add the same operation to `scripts/repair-selfhost-db.ps1` so
   existing installs can pick up the fix without a rebuild.
4. Add a row to §1 (Architecture invariants) of this runbook.

---

## 9. Files of record

| Purpose | Path |
|---|---|
| Compose entrypoint | `sbbl-hq-selfhost/docker-compose.yml` |
| Env file (secrets — NEVER commit) | `sbbl-hq-selfhost/.env` |
| Kong declarative config | `sbbl-hq-selfhost/volumes/api/kong.yml` |
| Kong custom entrypoint | `sbbl-hq-selfhost/volumes/api/kong-entrypoint.sh` |
| Supavisor pooler config | `sbbl-hq-selfhost/volumes/pooler/pooler.exs` |
| DB init scripts | `sbbl-hq-selfhost/volumes/db/*.sql` |
| Operator scripts | `sbbl-hq-selfhost/scripts/*.ps1` |
| LF enforcement | `sbbl-hq-selfhost/.gitattributes` |
| CI smoke test | `.github/workflows/selfhost-auth-smoke.yml` |
