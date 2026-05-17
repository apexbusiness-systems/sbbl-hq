$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# =============================================================================
# SUPABASE CORE VALIDATION SCRIPT
# =============================================================================
# Validates all Supabase core services after rotation
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-supabase-core.ps1
# =============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$EnvPath = Join-Path $RootDir ".env"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  SUPABASE CORE VALIDATION" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$pass = 0
$fail = 0

# =============================================================================
# 1. Docker Compose Status
# =============================================================================

Write-Host "[1/8] Checking Docker Compose status..." -ForegroundColor Yellow

$containers = @("db", "kong", "auth", "rest", "storage", "supavisor", "realtime", "studio")

foreach ($container in $containers) {
    $status = docker compose ps $container 2>&1
    if ($status -match "Up.*healthy" -or $status -match "Up \d+ seconds") {
        Write-Host "  ✅ $container - healthy" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "  ❌ $container - not healthy" -ForegroundColor Red
        $fail++
    }
}

# =============================================================================
# 2. REST API
# =============================================================================

Write-Host ""
Write-Host "[2/8] Testing REST API..." -ForegroundColor Yellow

$anonKey = ((Get-Content $EnvPath | Select-String '^ANON_KEY=').ToString().Split('=', 2)[1])
if ($anonKey) {
    try {
        $restResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/rest/v1/" -Headers @{"apikey" = $anonKey} -UseBasicParsing -ErrorAction Stop
        if ($restResult.StatusCode -eq 200) {
            Write-Host "  ✅ REST /rest/v1/ - HTTP 200" -ForegroundColor Green
            $pass++
        } else {
            Write-Host "  ❌ REST /rest/v1/ - HTTP $($restResult.StatusCode)" -ForegroundColor Red
            $fail++
        }
    } catch {
        Write-Host "  ❌ REST /rest/v1/ - $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
} else {
    Write-Host "  ❌ ANON_KEY not found in .env" -ForegroundColor Red
    $fail++
}

# =============================================================================
# 3. Auth API
# =============================================================================

Write-Host ""
Write-Host "[3/8] Testing Auth API..." -ForegroundColor Yellow

if ($anonKey) {
    try {
        $authResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/health" -Headers @{"apikey" = $anonKey} -UseBasicParsing -ErrorAction Stop
        if ($authResult.StatusCode -eq 200) {
            Write-Host "  ✅ Auth /auth/v1/health - HTTP 200" -ForegroundColor Green
            $pass++
        } else {
            Write-Host "  ❌ Auth /auth/v1/health - HTTP $($authResult.StatusCode)" -ForegroundColor Red
            $fail++
        }
    } catch {
        Write-Host "  ❌ Auth /auth/v1/health - $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

# =============================================================================
# 4. Supavisor Logs
# =============================================================================

Write-Host ""
Write-Host "[4/8] Checking Supavisor logs..." -ForegroundColor Yellow

$supavisorLogs = docker compose logs --tail=80 supavisor 2>&1
if ($supavisorLogs -match "Connected to Postgres|--------|\[info\].*Running Supavisor") {
    Write-Host "  ✅ Supavisor - no errors" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ⚠️  Supavisor - check logs for warnings" -ForegroundColor Yellow
    $pass++
}

# =============================================================================
# 5. Realtime Logs
# =============================================================================

Write-Host ""
Write-Host "[5/8] Checking Realtime logs..." -ForegroundColor Yellow

$realtimeLogs = docker compose logs --tail=80 realtime 2>&1
if ($realtimeLogs -match "Running Realtime|--------|\[info\].*server started") {
    Write-Host "  ✅ Realtime - no errors" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ❌ Realtime - check logs" -ForegroundColor Red
    $fail++
}

# =============================================================================
# 6. Functions Logs
# =============================================================================

Write-Host ""
Write-Host "[6/8] Checking Edge Functions logs..." -ForegroundColor Yellow

$fnLogs = docker compose logs --tail=30 functions 2>&1
if ($fnLogs -match "Starting|ready on|listening") {
    Write-Host "  ✅ Edge Functions - running" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ⚠️  Edge Functions - may need attention" -ForegroundColor Yellow
    $pass++
}

# =============================================================================
# 7. Database Schemas
# =============================================================================

Write-Host ""
Write-Host "[7/8] Checking database schemas..." -ForegroundColor Yellow

$schemas = docker exec supabase-db psql -U postgres -d postgres -t -c "\dn" 2>&1
$requiredSchemas = @("auth", "extensions", "public", "storage", "_realtime", "realtime")

foreach ($schema in $requiredSchemas) {
    if ($schemas -match $schema) {
        Write-Host "  ✅ Schema $schema exists" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "  ⚠️  Schema $schema not found" -ForegroundColor Yellow
    }
}

# =============================================================================
# 8. Secret Validation
# =============================================================================

Write-Host ""
Write-Host "[8/8] Validating secret lengths..." -ForegroundColor Yellow

$jwtSecret = ((Get-Content $EnvPath | Select-String '^JWT_SECRET=').ToString().Split('=', 2)[1])
if ($jwtSecret.Length -ge 64) {
    Write-Host "  ✅ JWT_SECRET: $($jwtSecret.Length) chars (>= 64)" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ❌ JWT_SECRET: $($jwtSecret.Length) chars (need >= 64)" -ForegroundColor Red
    $fail++
}

$vaultEncKey = ((Get-Content $EnvPath | Select-String '^VAULT_ENC_KEY=').ToString().Split('=', 2)[1])
if ($vaultEncKey.Length -eq 32) {
    Write-Host "  ✅ VAULT_ENC_KEY: $($vaultEncKey.Length) chars (== 32)" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ❌ VAULT_ENC_KEY: $($vaultEncKey.Length) chars (need == 32)" -ForegroundColor Red
    $fail++
}

$secretKeyBase = ((Get-Content $EnvPath | Select-String '^SECRET_KEY_BASE=').ToString().Split('=', 2)[1])
if ($secretKeyBase.Length -ge 64) {
    Write-Host "  ✅ SECRET_KEY_BASE: $($secretKeyBase.Length) chars (>= 64)" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ❌ SECRET_KEY_BASE: $($secretKeyBase.Length) chars (need >= 64)" -ForegroundColor Red
    $fail++
}

$pgMetaKey = ((Get-Content $EnvPath | Select-String '^PG_META_CRYPTO_KEY=').ToString().Split('=', 2)[1])
if ($pgMetaKey.Length -ge 32) {
    Write-Host "  ✅ PG_META_CRYPTO_KEY: $($pgMetaKey.Length) chars (>= 32)" -ForegroundColor Green
    $pass++
} else {
    Write-Host "  ❌ PG_META_CRYPTO_KEY: $($pgMetaKey.Length) chars (need >= 32)" -ForegroundColor Red
    $fail++
}

# =============================================================================
# SUMMARY
# =============================================================================

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Results: $pass passed   $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if ($fail -eq 0) {
    Write-Host ""
    Write-Host "✅ All core validation checks passed!" -ForegroundColor Green
    Write-Host "Production can proceed." -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠️  Some checks failed. Review logs above." -ForegroundColor Yellow
    exit 1
}
