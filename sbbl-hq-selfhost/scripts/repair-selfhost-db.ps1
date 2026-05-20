#requires -Version 5.1
<#
.SYNOPSIS
  Idempotent recovery for a self-hosted Supabase Postgres whose state
  has drifted from a clean init.

.DESCRIPTION
  Reapplies every hand-patch we ever had to run live during incident
  recovery, in idempotent form. Safe to run repeatedly. Use this when:

    * `.env` POSTGRES_PASSWORD changed after first DB init (services
      get "password authentication failed").
    * GoTrue logs "must be owner of function uid" (auth.* function
      ownership drifted from supabase_auth_admin).
    * PostgREST logs "schema graphql_public does not exist".
    * Realtime logs "role supabase_realtime_admin does not exist" or
      "no schema has been selected to create in".
    * Supavisor logs "database _supabase does not exist".

  Reads POSTGRES_PASSWORD from .env. Never prints secrets.

.PARAMETER ComposeDir
  Path to the directory containing docker-compose.yml + .env.
  Defaults to the script's parent directory.

.EXAMPLE
  .\repair-selfhost-db.ps1
  .\repair-selfhost-db.ps1 -ComposeDir "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost"
#>
param(
    [string]$ComposeDir = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

# --- Locate compose root and .env -------------------------------------------
if (-not (Test-Path (Join-Path $ComposeDir 'docker-compose.yml'))) {
    throw "docker-compose.yml not found in $ComposeDir"
}
$envFile = Join-Path $ComposeDir '.env'
if (-not (Test-Path $envFile)) {
    throw ".env not found in $ComposeDir"
}

# --- Read POSTGRES_PASSWORD without echoing it ------------------------------
$pwLine = (Get-Content $envFile | Select-String -Pattern '^POSTGRES_PASSWORD=').Line
if (-not $pwLine) { throw "POSTGRES_PASSWORD missing from .env" }
$pgPass = ($pwLine -split '=', 2)[1]
if (-not $pgPass) { throw "POSTGRES_PASSWORD is empty in .env" }

# --- Confirm the db container is up -----------------------------------------
$dbState = & docker inspect -f '{{.State.Status}}' supabase-db 2>$null
if ($LASTEXITCODE -ne 0 -or $dbState -ne 'running') {
    throw "supabase-db is not running. Run 'docker compose up -d db' first."
}

Write-Host "[repair] supabase-db is running. Applying idempotent recovery..." -ForegroundColor Cyan

# --- Helper: run SQL via stdin so secrets never appear in process args ------
function Invoke-DbSql {
    param([string]$Sql, [string]$Database = 'postgres')
    $output = $Sql | & docker exec -i supabase-db psql -U postgres -d $Database -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed:`n$output"
    }
    return $output
}

# --- 1. Sync service role passwords from .env -------------------------------
Write-Host "[1/6] Syncing service role passwords from .env..." -ForegroundColor Yellow
$rolesSql = @"
DO `$do`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin WITH NOINHERIT CREATEROLE LOGIN NOREPLICATION;
  END IF;
END
`$do`$;

ALTER ROLE authenticator            WITH PASSWORD '$pgPass';
ALTER ROLE pgbouncer                WITH PASSWORD '$pgPass';
ALTER ROLE supabase_auth_admin      WITH PASSWORD '$pgPass';
ALTER ROLE supabase_storage_admin   WITH PASSWORD '$pgPass';
ALTER ROLE supabase_realtime_admin  WITH PASSWORD '$pgPass';
ALTER ROLE supabase_functions_admin WITH PASSWORD '$pgPass';

GRANT supabase_realtime_admin TO postgres;
GRANT anon, authenticated, service_role TO supabase_storage_admin;
"@
Invoke-DbSql -Sql $rolesSql | Out-Null

# --- 2. Ensure graphql_public exists ----------------------------------------
Write-Host "[2/6] Ensuring graphql_public schema exists..." -ForegroundColor Yellow
$gqlSql = @'
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;
GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;
GRANT ALL   ON SCHEMA graphql_public TO postgres;
'@
Invoke-DbSql -Sql $gqlSql | Out-Null

# --- 3. Ensure _realtime schema + grants ------------------------------------
Write-Host "[3/6] Ensuring _realtime schema + grants..." -ForegroundColor Yellow
$rtSql = @'
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS realtime;
GRANT ALL ON SCHEMA _realtime TO supabase_realtime_admin;
ALTER ROLE supabase_realtime_admin SET search_path TO _realtime;
'@
Invoke-DbSql -Sql $rtSql | Out-Null

# --- 4. Ensure _supabase database exists (supavisor migrations) -------------
Write-Host "[4/6] Ensuring _supabase database exists..." -ForegroundColor Yellow
$exists = Invoke-DbSql -Sql "SELECT 1 FROM pg_database WHERE datname = '_supabase';"
if ($exists -notmatch '1 row') {
    Invoke-DbSql -Sql "CREATE DATABASE _supabase;" | Out-Null
    Write-Host "      _supabase created." -ForegroundColor Green
} else {
    Write-Host "      _supabase already present." -ForegroundColor Green
}

# --- 5. Transfer auth.* function ownership to supabase_auth_admin -----------
Write-Host "[5/6] Repairing auth.* function ownership..." -ForegroundColor Yellow
$ownerSql = @'
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth'
      AND pg_get_userbyid(p.proowner) <> 'supabase_auth_admin'
  LOOP
    EXECUTE 'ALTER FUNCTION ' || r.sig || ' OWNER TO supabase_auth_admin';
  END LOOP;
END
$do$;
'@
Invoke-DbSql -Sql $ownerSql | Out-Null

# --- 6. Verify ---------------------------------------------------------------
Write-Host "[6/6] Verifying..." -ForegroundColor Yellow
$verify = Invoke-DbSql -Sql @'
SELECT
  (SELECT count(*) FROM pg_roles WHERE rolname IN
    ('authenticator','pgbouncer','supabase_auth_admin','supabase_storage_admin',
     'supabase_realtime_admin','supabase_functions_admin')) AS roles_ok,
  (SELECT count(*) FROM pg_namespace WHERE nspname IN ('graphql_public','_realtime','realtime','auth')) AS schemas_ok,
  (SELECT count(*) FROM pg_database WHERE datname = '_supabase') AS supa_db_ok,
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'auth' AND pg_get_userbyid(p.proowner) <> 'supabase_auth_admin') AS auth_owner_drift;
'@
Write-Host $verify

Write-Host ""
Write-Host "[repair] Done. Restart any services that were crash-looping:" -ForegroundColor Green
Write-Host "  docker compose restart auth rest realtime storage supavisor" -ForegroundColor Green
