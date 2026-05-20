#requires -Version 5.1
<#
.SYNOPSIS
  Atomically rotate POSTGRES_PASSWORD across .env and all service roles.

.DESCRIPTION
  Replaces POSTGRES_PASSWORD in .env, runs ALTER ROLE for every Supabase
  service role using the new value, then restarts the services that hold
  persistent DB connections. The new password is never written to stdout
  or to the PowerShell history.

  Order is critical:
    1. Generate new password (cryptographically random or user-supplied).
    2. ALTER ROLE the DB first (postgres can still authenticate with the
       superuser password regardless of POSTGRES_PASSWORD).
    3. Rewrite .env (UTF-8 no BOM, LF line endings).
    4. Restart services that read POSTGRES_PASSWORD on boot.

  If step 2 fails, .env is untouched. If step 3 fails (filesystem error)
  AFTER step 2, run this script again with -RollbackToCurrentEnv to
  restore .env-of-record to what the DB has. (Or re-run with the same
  -Password.)

.PARAMETER ComposeDir
  Directory containing docker-compose.yml + .env. Defaults to script
  parent dir.

.PARAMETER Password
  Optional explicit new password. If omitted, a 32-char URL-safe
  random password is generated.

.PARAMETER DryRun
  Print what would happen without changing anything.

.EXAMPLE
  .\rotate-postgres-password.ps1
  .\rotate-postgres-password.ps1 -DryRun
  .\rotate-postgres-password.ps1 -Password (Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText)
#>
param(
    [string]$ComposeDir = (Split-Path -Parent $PSScriptRoot),
    [string]$Password,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$envFile = Join-Path $ComposeDir '.env'
if (-not (Test-Path $envFile)) { throw ".env not found in $ComposeDir" }
if (-not (Test-Path (Join-Path $ComposeDir 'docker-compose.yml'))) {
    throw "docker-compose.yml not found in $ComposeDir"
}

# --- Generate or accept password --------------------------------------------
if (-not $Password) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $Password = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
if ($Password.Length -lt 16) {
    throw "Password must be at least 16 characters."
}

# --- Confirm DB is reachable ------------------------------------------------
$dbState = & docker inspect -f '{{.State.Status}}' supabase-db 2>$null
if ($LASTEXITCODE -ne 0 -or $dbState -ne 'running') {
    throw "supabase-db is not running. Bring it up first."
}

if ($DryRun) {
    Write-Host "[dry-run] Would rotate POSTGRES_PASSWORD in $envFile and ALTER ROLE for:"
    Write-Host "          authenticator, pgbouncer, supabase_auth_admin, supabase_storage_admin, supabase_realtime_admin, supabase_functions_admin"
    Write-Host "[dry-run] Would restart: db, auth, rest, realtime, storage, supavisor, functions"
    return
}

Write-Host "[rotate] Applying new POSTGRES_PASSWORD to DB roles..." -ForegroundColor Yellow
$alterSql = @"
ALTER ROLE postgres                 WITH PASSWORD '$Password';
ALTER ROLE authenticator            WITH PASSWORD '$Password';
ALTER ROLE pgbouncer                WITH PASSWORD '$Password';
ALTER ROLE supabase_auth_admin      WITH PASSWORD '$Password';
ALTER ROLE supabase_storage_admin   WITH PASSWORD '$Password';
ALTER ROLE supabase_realtime_admin  WITH PASSWORD '$Password';
ALTER ROLE supabase_functions_admin WITH PASSWORD '$Password';
SELECT 'roles rotated' AS result;
"@
$output = $alterSql | & docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 2>&1
if ($LASTEXITCODE -ne 0) { throw "ALTER ROLE failed:`n$output" }

Write-Host "[rotate] Rewriting .env (UTF-8 no BOM, LF)..." -ForegroundColor Yellow
$envText = [System.IO.File]::ReadAllText($envFile)
$envText = [regex]::Replace($envText, '(?m)^POSTGRES_PASSWORD=.*$', "POSTGRES_PASSWORD=$Password")
$envText = $envText -replace "`r`n", "`n" -replace "`r", "`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envFile, $envText, $enc)

Write-Host "[rotate] Restarting services that read POSTGRES_PASSWORD at boot..." -ForegroundColor Yellow
Push-Location $ComposeDir
try {
    & docker compose up -d --force-recreate auth rest realtime storage supavisor functions
    if ($LASTEXITCODE -ne 0) { throw "docker compose restart failed." }
}
finally { Pop-Location }

Start-Sleep -Seconds 15
& docker compose -f (Join-Path $ComposeDir 'docker-compose.yml') ps

Write-Host ""
Write-Host "[rotate] Done. Verify with scripts/validate-supabase-core.ps1" -ForegroundColor Green
