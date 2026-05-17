$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# =============================================================================
# SUPABASE SECRET ROTATION ROLLBACK SCRIPT
# =============================================================================
# Rolls back secret rotation to pre-rotation state
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-secret-rotation.ps1
# =============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path $ScriptDir ".env"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  SUPABASE SECRET ROTATION ROLLBACK" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# FIND LATEST BACKUP
# =============================================================================

Write-Host "[1/4] Finding latest .env backup..." -ForegroundColor Yellow

$backups = Get-ChildItem -Path $ScriptDir -Filter ".env.bak-clean-rotation-*" -ErrorAction SilentlyContinue
if ($backups.Count -eq 0) {
    Write-Error "No backups found. Cannot rollback."
    exit 1
}

$latestBackup = $backups | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "  Found: $($latestBackup.Name)" -ForegroundColor Green

# =============================================================================
# RESTORE .env
# =============================================================================

Write-Host ""
Write-Host "[2/4] Restoring .env from backup..." -ForegroundColor Yellow

Copy-Item $latestBackup.FullName $EnvPath -Force
Write-Host "  ✅ .env restored" -ForegroundColor Green

# =============================================================================
# RESTORE _supabase DATABASE
# =============================================================================

Write-Host ""
Write-Host "[3/4] Checking for _supabase backup..." -ForegroundColor Yellow

$dbBackup = Get-ChildItem -Path $ScriptDir -Filter "_supabase-before-*.sql" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($dbBackup) {
    Write-Host "  Restoring _supabase DB from $dbBackup..." -ForegroundColor Yellow
    docker exec -i supabase-db psql -U postgres -d postgres < $dbBackup.FullName 2>&1 | Out-Null
    Write-Host "  ✅ _supabase DB restored" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  No _supabase backup found - skipping DB restore" -ForegroundColor Yellow
}

# =============================================================================
# RECREATE SERVICES
# =============================================================================

Write-Host ""
Write-Host "[4/4] Recreating services with old config..." -ForegroundColor Yellow

Push-Location $ScriptDir
docker compose up -d --force-recreate db auth rest storage supavisor kong 2>&1 | Out-Null
Write-Host "  ✅ Services recreated" -ForegroundColor Green

Start-Sleep -Seconds 45
Pop-Location

# =============================================================================
# VALIDATE
# =============================================================================

Write-Host ""
Write-Host "Running validation..." -ForegroundColor Yellow

$anonKey = ((Get-Content $EnvPath | Select-String '^ANON_KEY=').ToString().Split('=', 2)[1])
if ($anonKey) {
    $restResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/rest/v1/" -Headers @{"apikey" = $anonKey} -UseBasicParsing -ErrorAction SilentlyContinue
    $authResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/health" -Headers @{"apikey" = $anonKey} -UseBasicParsing -ErrorAction SilentlyContinue

    Write-Host "  REST: HTTP $($restResult.StatusCode)" -ForegroundColor $(if ($restResult.StatusCode -eq 200) { "Green" } else { "Yellow" })
    Write-Host "  Auth: HTTP $($authResult.StatusCode)" -ForegroundColor $(if ($authResult.StatusCode -eq 200) { "Green" } else { "Yellow" })
}

# =============================================================================
# SUMMARY
# =============================================================================

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  ✅ ROLLBACK COMPLETE" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Stack restored to pre-rotation state." -ForegroundColor Yellow
Write-Host "Production remains BLOCKED until clean rotation succeeds." -ForegroundColor Yellow
