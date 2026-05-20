# DEFCON PATCH V2 — CORS Preflight + GoTrue Validation
# Run AFTER defcon_cors_patch.py has been applied and Kong restarted.
#
# Usage:
#   .\validate_cors_preflight.ps1
#
# Requirements: curl.exe (ships with Windows 10 1803+)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Stamp = Get-Date -Format yyyyMMdd-HHmmss

# ── 1. Discover ActiveRoot from live Kong container ────────────────────────────

$ActiveRoot = docker inspect supabase-kong `
  --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ActiveRoot)) {
  throw "Cannot determine active Docker Compose working_dir from supabase-kong."
}
Write-Host "ActiveRoot: $ActiveRoot"

# ── 2. Read anon key from .env ─────────────────────────────────────────────────

$EnvPath = Join-Path $ActiveRoot ".env"
if (-not (Test-Path $EnvPath)) { throw ".env not found at: $EnvPath" }

$AnonLine = Get-Content $EnvPath | Where-Object { $_ -match "^ANON_KEY=" } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($AnonLine)) { throw "ANON_KEY not found in .env" }
$AnonKey = $AnonLine.Substring("ANON_KEY=".Length).Trim()

# ── 3. CORS OPTIONS preflight ──────────────────────────────────────────────────

$RequiredHeaders = "accept,accept-profile,accept-version,authorization," +
  "cache-control,content-length,content-md5,content-profile,content-type," +
  "date,if-match,if-modified-since,if-none-match,prefer,range," +
  "x-requested-with,apikey,x-client-info,x-supabase-api-version,x-upsert"

$HeadersFile = Join-Path $env:TEMP "sbbl-cors-headers-$Stamp.txt"
$BodyFile    = Join-Path $env:TEMP "sbbl-cors-body-$Stamp.txt"

$HttpCode = curl.exe -sS -o $BodyFile -D $HeadersFile -w "%{http_code}" `
  -X OPTIONS "https://supabase.sbbl-hq.icu/auth/v1/token?grant_type=password" `
  -H "Origin: https://sbbl-hq.icu" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: $RequiredHeaders"

Write-Host "`nPreflight HTTP = $HttpCode"
Write-Host "--- Response headers ---"
Get-Content $HeadersFile

if ($HttpCode -ne "200" -and $HttpCode -ne "204") {
  throw "CORS preflight failed: expected 200/204, got $HttpCode"
}

$AllHeadersRaw = Get-Content $HeadersFile -Raw
$AllowOrigin = ($AllHeadersRaw -split "`n" | Where-Object { $_ -imatch "^access-control-allow-origin:" } | Select-Object -First 1)
if ($AllowOrigin -notmatch "https://sbbl-hq\.icu") {
  throw "access-control-allow-origin missing or wrong: $AllowOrigin"
}

$AllowHeaders = ($AllHeadersRaw -split "`n" | Where-Object { $_ -imatch "^access-control-allow-headers:" } | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($AllowHeaders)) {
  throw "access-control-allow-headers header is missing from preflight response"
}
$AllowHeadersLow = $AllowHeaders.ToLowerInvariant()

$Missing = @()
$RequiredHeaders.Split(",") | ForEach-Object {
  $h = $_.Trim().ToLowerInvariant()
  if ($AllowHeadersLow -notmatch "(^|,\s*)$([regex]::Escape($h))(\s*,|$)") {
    $Missing += $h
  }
}
if ($Missing.Count -gt 0) {
  throw "Preflight missing allowed headers: $($Missing -join ', ')"
}

Write-Host "`nCORS PREFLIGHT GREEN."

# ── 4. POST to /auth/v1/token — verify route reaches GoTrue ───────────────────

$PostCode = curl.exe -sS -o NUL -w "%{http_code}" `
  -X POST "https://supabase.sbbl-hq.icu/auth/v1/token?grant_type=password" `
  -H "Origin: https://sbbl-hq.icu" `
  -H "Content-Type: application/json" `
  -H "apikey: $AnonKey" `
  -H "x-supabase-api-version: 2024-01-01" `
  -d '{\"email\":\"smoke-test-nobody@invalid.example\",\"password\":\"x\"}'

Write-Host "POST /auth/v1/token HTTP = $PostCode"

if ($PostCode -match "^5" -or $PostCode -eq "000") {
  throw "POST did not reach GoTrue cleanly. HTTP=$PostCode"
}

Write-Host "AUTH ROUTE GREEN: POST reached GoTrue (HTTP $PostCode = expected 400/422 for bad credentials)."
Write-Host "`n=== VALIDATION COMPLETE ==="
Write-Host "ActiveRoot  : $ActiveRoot"
Write-Host "Preflight   : $HttpCode"
Write-Host "POST GoTrue : $PostCode"
