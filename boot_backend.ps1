<#
.SYNOPSIS
Installs and boots the self-hosted Supabase + Caddy stack automatically.

.DESCRIPTION
This script automates Phase 1 of the SBBL-HQ Self-Hosted Runbook:
1. Clones the Supabase Docker repository (if not already cloned).
2. Copies custom .env, Caddy configurations, and scripts over to the deployment folder.
3. Generates the necessary keys automatically.
4. Pulls Docker images and spins up the stack with Caddy HTTPS proxy enabled.
#>

$ErrorActionPreference = "Stop"

$WorkspaceDir = (Get-Item .).FullName
$SourceBundleDir = Join-Path $WorkspaceDir "sbbl-hq-selfhost\sbbl-hq-selfhost"
$TargetDeployDir = Join-Path $WorkspaceDir "supabase-docker"

Write-Host ">>> Preparing SBBL-HQ Automated Local Self-Host Initialization..." -ForegroundColor Cyan

# 1. Clone Supabase Docker Repo if missing
if (-not (Test-Path $TargetDeployDir)) {
    Write-Host "Supabase docker repository not found. Cloning into $TargetDeployDir..."
    git clone --depth 1 https://github.com/supabase/supabase "$WorkspaceDir\supabase-source"
    Move-Item "$WorkspaceDir\supabase-source\docker" $TargetDeployDir -Force
    Remove-Item "$WorkspaceDir\supabase-source" -Recurse -Force
} else {
    Write-Host "Supabase docker repository already exists at $TargetDeployDir"
}

# 2. Copy Configs from bundle to target
Write-Host ">>> Copying custom configurations (.env, docker-compose.caddy.yml, scripts)..."
Copy-Item "$SourceBundleDir\.env" "$TargetDeployDir\.env" -Force
Copy-Item "$SourceBundleDir\docker-compose.caddy.yml" "$TargetDeployDir\docker-compose.caddy.yml" -Force

$TargetProxyDir = Join-Path $TargetDeployDir "volumes\proxy\caddy"
if (-not (Test-Path $TargetProxyDir)) {
    New-Item -ItemType Directory -Force -Path $TargetProxyDir | Out-Null
}
Copy-Item "$SourceBundleDir\volumes\proxy\caddy\Caddyfile" "$TargetProxyDir\Caddyfile" -Force

$TargetScriptsDir = Join-Path $TargetDeployDir "scripts"
if (-not (Test-Path $TargetScriptsDir)) {
    New-Item -ItemType Directory -Force -Path $TargetScriptsDir | Out-Null
}
Copy-Item "$SourceBundleDir\scripts\*" $TargetScriptsDir -Force -Recurse

# 3. Generate Keys (using bash since the script is bash-based)
Write-Host ">>> Generating JWT and API keys..."
Set-Location $TargetDeployDir
bash ./scripts/01-generate-keys.sh

# 4. Boot Stack
Write-Host ">>> Pulling docker images and starting the stack..." -ForegroundColor Cyan
docker compose pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d

Write-Host ">>> SBBL-HQ Self-Hosted Stack is booting up in the background! (restart: unless-stopped enabled)" -ForegroundColor Green
Write-Host "To monitor logs: docker compose logs -f"
Write-Host "Verify access: https://localhost/auth/v1/"
