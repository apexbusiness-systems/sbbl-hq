#Requires -Version 5.1
<#
.SYNOPSIS
    SBBL HQ — Cloudflare Pages deploy script (April 2 release cut)

.DESCRIPTION
    Builds the project, deploys to Cloudflare Pages via Wrangler, then purges
    the Cloudflare edge cache for the production zone.

    Required environment variables (must be set before running):
      $env:CF_TOKEN     — Cloudflare API token with Cache Purge + Pages Deploy permissions
                          NEVER hardcode this value in source control.

    Optional environment variables:
      $env:CF_ZONE_ID   — Cloudflare Zone ID for sbbl-hq.icu (enables cache purge step)
                          If not set, the cache purge step is skipped with a warning.

.EXAMPLE
    # Set credentials, then deploy:
    $env:CF_TOKEN   = 'your-cloudflare-api-token'
    $env:CF_ZONE_ID = 'your-zone-id'
    .\deploy.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Resolve paths ─────────────────────────────────────────────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir  # deploy.ps1 lives at repo root

# ── Credential validation ─────────────────────────────────────────────────────
$Token  = $env:CF_TOKEN
$ZoneId = $env:CF_ZONE_ID

if (-not $Token) {
    Write-Error @"
BLOCKED: CF_TOKEN — Cloudflare API bearer token is not set.

To fix:
  `$env:CF_TOKEN = 'your-cloudflare-api-token'

Then re-run: .\deploy.ps1
"@
    exit 1
}

# ── Step 1: Build ──────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '[1/3] Building project...' -ForegroundColor Cyan

Set-Location $ProjectRoot
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Build failed (npm run build). Fix errors above, then re-run.'
    exit 1
}

Write-Host '      Build complete.' -ForegroundColor Green

# ── Step 2: Deploy to Cloudflare Pages ────────────────────────────────────────
Write-Host ''
Write-Host '[2/3] Deploying to Cloudflare Pages (npm run cf:deploy)...' -ForegroundColor Cyan

& npm run cf:deploy
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Cloudflare Pages deploy failed (npm run cf:deploy). Check Wrangler output above.'
    exit 1
}

Write-Host '      Deploy complete.' -ForegroundColor Green

# ── Step 3: Purge Cloudflare edge cache ───────────────────────────────────────
Write-Host ''

if (-not $ZoneId) {
    Write-Host '[3/3] Skipping cache purge — CF_ZONE_ID is not set.' -ForegroundColor Yellow
    Write-Host '      To enable: $env:CF_ZONE_ID = ''your-zone-id''' -ForegroundColor Yellow
} else {
    Write-Host "[3/3] Purging Cloudflare cache for zone $ZoneId..." -ForegroundColor Cyan

    $PurgeUri  = "https://api.cloudflare.com/client/v4/zones/$ZoneId/purge_cache"
    $PurgeBody = '{"purge_everything":true}'

    try {
        $Response = Invoke-RestMethod `
            -Uri         $PurgeUri `
            -Method      Post `
            -Headers     @{
                'Authorization' = "Bearer $Token"
                'Content-Type'  = 'application/json'
            } `
            -Body        $PurgeBody

        if ($Response.success) {
            Write-Host '      Cache purged successfully.' -ForegroundColor Green
        } else {
            $Errors = ($Response.errors | ForEach-Object { $_.message }) -join '; '
            Write-Warning "Cache purge returned success=false. Errors: $Errors"
        }
    } catch {
        Write-Warning "Cache purge request failed: $_"
        Write-Warning "The deploy succeeded — cache will expire naturally (TTL)."
    }
}

# ── Done ───────────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host 'Deploy complete. Verify at: https://sbbl-hq.icu/live' -ForegroundColor Green
Write-Host ''
Write-Host 'Pre-launch checklist:' -ForegroundColor Yellow
Write-Host '  [ ] Replace Switcher Studio embed src in LiveStreamPlayer.tsx' -ForegroundColor Yellow
Write-Host '  [ ] Set STRIPE_PPV_PRICE_ID (price_ppv_single_game) in Stripe dashboard' -ForegroundColor Yellow
Write-Host '  [ ] Apply Supabase migration 20260331000200_ppv_invites.sql' -ForegroundColor Yellow
Write-Host '  [ ] Smoke-test invite flow end-to-end from two devices' -ForegroundColor Yellow
