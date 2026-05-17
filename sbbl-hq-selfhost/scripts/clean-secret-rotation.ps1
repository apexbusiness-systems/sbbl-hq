$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# =============================================================================
# SUPABASE CLEAN SECRET ROTATION SCRIPT
# =============================================================================
# PowerShell 5.1-compatible secret rotation for self-hosted Supabase
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\clean-secret-rotation.ps1
# =============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$EnvPath = Join-Path $RootDir ".env"

# Change to root directory for Docker commands
Push-Location $RootDir

# =============================================================================
# HELPER FUNCTIONS - PS 5.1 Safe RNG
# =============================================================================

function Get-AlphaNumSecret {
    param([int]$Length)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    $rng.Dispose()
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Get-HexSecret {
    param([int]$ByteCount)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $ByteCount
    $rng.GetBytes($bytes)
    $rng.Dispose()
    ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Get-Base64Secret {
    param([int]$ByteCount)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $ByteCount
    $rng.GetBytes($bytes)
    $rng.Dispose()
    [Convert]::ToBase64String($bytes)
}

function Get-Base64UrlSecret {
    param([int]$ByteCount)
    $b64 = Get-Base64Secret -ByteCount $ByteCount
    $b64.TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-LegacyJwt {
    param([string]$Role, [string]$Secret)
    $now = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $exp = $now + (60 * 60 * 24 * 365 * 10)  # 10 year

    $header = @{ alg = "HS256"; typ = "JWT" } | ConvertTo-Json -Compress
    $payload = @{ role = $Role; iss = "supabase"; iat = $now; exp = $exp } | ConvertTo-Json -Compress

    $headerBytes = [Text.Encoding]::UTF8.GetBytes($header)
    $payloadBytes = [Text.Encoding]::UTF8.GetBytes($payload)

    # Manual base64url encoding
    $header64 = [Convert]::ToBase64String($headerBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
    $payload64 = [Convert]::ToBase64String($payloadBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
    $unsigned = "$header64.$payload64"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
    $sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned))
    $sig64 = [Convert]::ToBase64String($sigBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

    "$unsigned.$sig64"
}

function Read-TextNoBom {
    param([string]$Path)
    $text = [System.IO.File]::ReadAllText($Path)
    return $text.TrimStart([char]0xFEFF)
}

function Write-TextNoBom {
    param([string]$Path, [string]$Text)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  SUPABASE CLEAN SECRET ROTATION" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/10] Pre-flight checks..." -ForegroundColor Yellow

# Check docker-compose.yml exists in root
$composePath = Join-Path $RootDir "docker-compose.yml"
if (-not (Test-Path $composePath)) {
    Write-Error "docker-compose.yml not found at $composePath"
    Pop-Location
    exit 1
}
Write-Host "  OK: Root path contains docker-compose.yml" -ForegroundColor Green

# Check .env exists
if (-not (Test-Path $EnvPath)) {
    Write-Error ".env not found at $EnvPath"
    Pop-Location
    exit 1
}
Write-Host "  OK: .env file exists" -ForegroundColor Green

# Read .env with BOM handling
$envContent = Read-TextNoBom -Path $EnvPath

# Validate required keys exist after BOM normalization
$postgresPasswordPresent = $envContent -match '(?m)^POSTGRES_PASSWORD='
$jwtSecretPresent = $envContent -match '(?m)^JWT_SECRET='
$anonKeyPresent = $envContent -match '(?m)^ANON_KEY='
$serviceRoleKeyPresent = $envContent -match '(?m)^SERVICE_ROLE_KEY='

if (-not $postgresPasswordPresent) {
    Write-Error "POSTGRES_PASSWORD not found in .env after BOM normalization"
    Pop-Location
    exit 1
}
Write-Host "  OK: POSTGRES_PASSWORD key found" -ForegroundColor Green

if (-not $jwtSecretPresent) {
    Write-Error "JWT_SECRET not found in .env"
    Pop-Location
    exit 1
}
Write-Host "  OK: JWT_SECRET key found" -ForegroundColor Green

# Check for default/demo values
$currentJwt = ($envContent -split "`n" | Select-String '^JWT_SECRET=').ToString().Split('=', 2)[1]
$currentAnon = ($envContent -split "`n" | Select-String '^ANON_KEY=').ToString().Split('=', 2)[1]

if ($currentJwt -match "your-super-secret-jwt" -or $currentAnon -match "supabase-demo") {
    Write-Host "  INFO: Current secrets appear to be defaults (rotation needed)" -ForegroundColor Yellow
} else {
    Write-Host "  OK: Secrets appear to be non-default" -ForegroundColor Green
}

# Check docker is running
$dockerCheck = docker compose ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker compose check failed. Is Docker running?"
    Pop-Location
    exit 1
}
Write-Host "  OK: Docker compose accessible" -ForegroundColor Green

# =============================================================================
# BACKUP
# =============================================================================

Write-Host ""
Write-Host "[2/10] Creating backups..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$envBackup = Join-Path $RootDir ".env.bak-clean-rotation-$timestamp"
Copy-Item $EnvPath $envBackup
Write-Host "  OK: .env backed up" -ForegroundColor Green

# Backup _supabase DB (if it exists and has data)
$dbBackupPath = Join-Path $RootDir "_supabase-before-clean-rotation.sql"
docker exec supabase-db pg_dump -U postgres -d _supabase -f /tmp/_supabase-before-clean-rotation.sql 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    docker cp supabase-db:/tmp/_supabase-before-clean-rotation.sql $dbBackupPath 2>&1 | Out-Null
    Write-Host "  OK: _supabase DB backed up" -ForegroundColor Green
} else {
    Write-Host "  SKIP: _supabase DB empty or missing - no backup needed" -ForegroundColor Gray
}

# =============================================================================
# GENERATE NEW SECRETS
# =============================================================================

Write-Host ""
Write-Host "[3/10] Generating new secrets..." -ForegroundColor Yellow

$newPostgresPassword = Get-AlphaNumSecret -Length 48
Write-Host "  POSTGRES_PASSWORD: generating" -ForegroundColor Gray

$newJwtSecret = Get-AlphaNumSecret -Length 64
Write-Host "  JWT_SECRET: generating" -ForegroundColor Gray

$newSecretKeyBase = Get-Base64Secret -ByteCount 48
Write-Host "  SECRET_KEY_BASE: generating" -ForegroundColor Gray

# VAULT_ENC_KEY must be EXACTLY 32 hex chars (16 bytes)
$newVaultEncKey = Get-HexSecret -ByteCount 16
if ($newVaultEncKey.Length -ne 32) {
    Write-Error "VAULT_ENC_KEY must be exactly 32 characters, got $($newVaultEncKey.Length)"
    Pop-Location
    exit 1
}
Write-Host "  VAULT_ENC_KEY: generating" -ForegroundColor Gray

$newPgMetaCryptoKey = Get-Base64Secret -ByteCount 24
Write-Host "  PG_META_CRYPTO_KEY: generating" -ForegroundColor Gray

# =============================================================================
# UPDATE .env
# =============================================================================

Write-Host ""
Write-Host "[4/10] Patching .env..." -ForegroundColor Yellow

$envContent = Read-TextNoBom -Path $EnvPath
$envContent = $envContent -replace '(?m)^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$newPostgresPassword"
$envContent = $envContent -replace '(?m)^JWT_SECRET=.*', "JWT_SECRET=$newJwtSecret"
$envContent = $envContent -replace '(?m)^SECRET_KEY_BASE=.*', "SECRET_KEY_BASE=$newSecretKeyBase"
$envContent = $envContent -replace '(?m)^VAULT_ENC_KEY=.*', "VAULT_ENC_KEY=$newVaultEncKey"
$envContent = $envContent -replace '(?m)^PG_META_CRYPTO_KEY=.*', "PG_META_CRYPTO_KEY=$newPgMetaCryptoKey"

Write-TextNoBom -Path $EnvPath -Text $envContent
Write-Host "  OK: .env updated (keys, not values)" -ForegroundColor Green

# =============================================================================
# GENERATE JWT KEYS
# =============================================================================

Write-Host ""
Write-Host "[5/10] Generating ANON_KEY and SERVICE_ROLE_KEY..." -ForegroundColor Yellow

$newAnonKey = New-LegacyJwt -Role "anon" -Secret $newJwtSecret
$newServiceRoleKey = New-LegacyJwt -Role "service_role" -Secret $newJwtSecret

# Patch .env with new keys
$envContent = Read-TextNoBom -Path $EnvPath
$envContent = $envContent -replace '(?m)^ANON_KEY=.*', "ANON_KEY=$newAnonKey"
$envContent = $envContent -replace '(?m)^SERVICE_ROLE_KEY=.*', "SERVICE_ROLE_KEY=$newServiceRoleKey"
Write-TextNoBom -Path $EnvPath -Text $envContent

Write-Host "  OK: JWT keys generated" -ForegroundColor Green

# =============================================================================
# UPDATE DATABASE
# =============================================================================

Write-Host ""
Write-Host "[6/10] Updating database role passwords..." -ForegroundColor Yellow

$roles = @("postgres", "authenticator", "pgbouncer", "supabase_admin", "supabase_auth_admin", "supabase_functions_admin", "supabase_storage_admin")

foreach ($role in $roles) {
    docker exec supabase-db psql -U postgres -d postgres -c "ALTER ROLE $role WITH PASSWORD '$newPostgresPassword';" 2>&1 | Out-Null
    Write-Host "  OK: $role password updated" -ForegroundColor Gray
}

# Update JWT GUC
docker exec supabase-db psql -U postgres -d postgres -c "ALTER DATABASE postgres SET app.settings.jwt_secret TO '$newJwtSecret';" 2>&1 | Out-Null
docker exec supabase-db psql -U postgres -d postgres -c "ALTER DATABASE postgres SET app.settings.jwt_exp TO '3600';" 2>&1 | Out-Null
Write-Host "  OK: Database JWT settings updated" -ForegroundColor Green

# =============================================================================
# RECREATE ALL SERVICES
# =============================================================================

Write-Host ""
Write-Host "[7/10] Recreating all services..." -ForegroundColor Yellow

$null = docker compose up -d --force-recreate --remove-orphans db auth rest storage supavisor kong meta studio functions realtime
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker compose recreate failed"
    Pop-Location
    exit 1
}
Write-Host "  OK: Services recreated" -ForegroundColor Green

Start-Sleep -Seconds 60
Write-Host "  INFO: Waited 60s for services to stabilize" -ForegroundColor Gray

# =============================================================================
# VAULT_ENC_KEY RESET (if needed)
# =============================================================================

Write-Host ""
Write-Host "[8/10] Checking Supavisor health..." -ForegroundColor Yellow

$supavisorLogs = docker compose logs --tail=30 supavisor 2>&1
if ($supavisorLogs -match "Unknown cipher|invalid key|badarg") {
    Write-Host "  WARN: Supavisor decrypt failed - resetting _supabase DB..." -ForegroundColor Yellow

    # Terminate connections before drop
    docker exec supabase-db psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '_supabase' AND pid <> pg_backend_pid();" 2>&1 | Out-Null

    # Drop and recreate _supabase
    docker exec supabase-db psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS _supabase;" 2>&1 | Out-Null
    docker exec supabase-db psql -U postgres -d postgres -c "CREATE DATABASE _supabase;" 2>&1 | Out-Null
    Write-Host "  OK: _supabase DB reset" -ForegroundColor Green

    # Recreate Supavisor
    docker compose up -d --force-recreate supavisor 2>&1 | Out-Null
    Write-Host "  OK: Supavisor recreated" -ForegroundColor Green

    Start-Sleep -Seconds 30
} else {
    Write-Host "  OK: Supavisor healthy" -ForegroundColor Green
}

# =============================================================================
# VALIDATION
# =============================================================================

Write-Host ""
Write-Host "[9/10] Running validation..." -ForegroundColor Yellow

$envContent = Read-TextNoBom -Path $EnvPath
$anonKey = ($envContent -split "`n" | Select-String '^ANON_KEY=').ToString().Split('=', 2)[1]

# Test REST
try {
    $restResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/rest/v1/" -Headers @{"apikey" = $anonKey} -UseBasicParsing -ErrorAction Stop
    if ($restResult.StatusCode -eq 200) {
        Write-Host "  OK: REST /rest/v1/ - 200 OK" -ForegroundColor Green
    } else {
        Write-Warning "  WARN: REST /rest/v1/ - HTTP $($restResult.StatusCode)"
    }
} catch {
    Write-Warning "  WARN: REST /rest/v1/ - $($_.Exception.Message)"
}

# Test Auth
try {
    $authResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/health" -Headers @{"apikey" = $anonKey} -UseBasicParsing -ErrorAction Stop
    if ($authResult.StatusCode -eq 200) {
        Write-Host "  OK: Auth /auth/v1/health - 200 OK" -ForegroundColor Green
    } else {
        Write-Warning "  WARN: Auth /auth/v1/health - HTTP $($authResult.StatusCode)"
    }
} catch {
    Write-Warning "  WARN: Auth /auth/v1/health - $($_.Exception.Message)"
}

# =============================================================================
# CLOUDFLARE HANDOFF
# =============================================================================

Write-Host ""
Write-Host "[10/10] Writing Cloudflare handoff..." -ForegroundColor Yellow

$handoffPath = Join-Path $RootDir ".rotation-output.local.txt"

$handoffContent = @"
# CLOUDFLARE RUNTIME ENVIRONMENT VARIABLES
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# DO NOT COMMIT THIS FILE

NEXT_PUBLIC_SUPABASE_URL=https://supabase.sbbl-hq.icu
NEXT_PUBLIC_SUPABASE_ANON_KEY=<redacted>
SERVER_SUPABASE_SERVICE_ROLE_KEY=<redacted>
"@

Set-Content -Path $handoffPath -Value $handoffContent -Encoding UTF8
Write-Host "  OK: Handoff written to $handoffPath" -ForegroundColor Green
Write-Host "  INFO: Actual keys in .env - copy from there for Cloudflare" -ForegroundColor Yellow

# =============================================================================
# SUMMARY
# =============================================================================

Pop-Location

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  ROTATION COMPLETE" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy ANON_KEY from .env to Cloudflare Pages env vars" -ForegroundColor White
Write-Host "  2. Copy SERVICE_ROLE_KEY to Cloudflare Workers secrets if needed" -ForegroundColor White
Write-Host "  3. Redeploy Cloudflare app and smoke test" -ForegroundColor White
Write-Host ""

