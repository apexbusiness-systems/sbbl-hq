[CmdletBinding()]
param(
    [switch]$NoRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function ConvertTo-Base64Url {
    param([Parameter(Mandatory)][byte[]]$Bytes)
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertFrom-Base64UrlString {
    param([Parameter(Mandatory)][string]$Value)
    $padded = $Value.Replace('-', '+').Replace('_', '/')
    switch ($padded.Length % 4) {
        2 { $padded += '==' }
        3 { $padded += '=' }
        1 { throw "Invalid base64url length." }
    }
    return [Convert]::FromBase64String($padded)
}

function New-RandomSecret {
    param([int]$ByteCount = 32)
    $bytes = [byte[]]::new($ByteCount)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return (ConvertTo-Base64Url -Bytes $bytes)
}

function New-SupabaseJwt {
    param(
        [Parameter(Mandatory)][string]$Role,
        [Parameter(Mandatory)][string]$Secret
    )
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $payload = [ordered]@{
        role = $Role
        iss  = 'supabase'
        iat  = $now
        exp  = $now + (10 * 365 * 24 * 60 * 60)
    }
    $headerJson = @{ alg = 'HS256'; typ = 'JWT' } | ConvertTo-Json -Compress
    $payloadJson = $payload | ConvertTo-Json -Compress
    $header = ConvertTo-Base64Url -Bytes ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $body = ConvertTo-Base64Url -Bytes ([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsigned = "$header.$body"
    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
    try {
        $signature = ConvertTo-Base64Url -Bytes ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
    }
    finally {
        $hmac.Dispose()
    }
    return "$unsigned.$signature"
}

function Test-SupabaseJwt {
    param(
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][string]$Secret,
        [Parameter(Mandatory)][string]$ExpectedRole
    )
    try {
        $parts = $Token.Split('.')
        if ($parts.Count -ne 3) { return $false }
        $unsigned = "$($parts[0]).$($parts[1])"
        $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
        try {
            $expectedSig = ConvertTo-Base64Url -Bytes ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
        }
        finally {
            $hmac.Dispose()
        }
        if ($expectedSig -ne $parts[2]) { return $false }
        $payloadJson = [Text.Encoding]::UTF8.GetString((ConvertFrom-Base64UrlString -Value $parts[1]))
        $payload = $payloadJson | ConvertFrom-Json
        if ($payload.role -ne $ExpectedRole) { return $false }
        if ($payload.exp -and ([int64]$payload.exp -le [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())) { return $false }
        return $true
    }
    catch {
        return $false
    }
}

function Read-DotEnv {
    param([Parameter(Mandatory)][string]$Path)
    $map = [ordered]@{}
    $lines = @()
    if (Test-Path -LiteralPath $Path) {
        $lines = Get-Content -LiteralPath $Path
        foreach ($line in $lines) {
            if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
            $key, $value = $line -split '=', 2
            $key = $key.Trim()
            if (-not $key) { continue }
            $value = $value.Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $map[$key] = $value
        }
    }
    return [pscustomobject]@{ Lines = $lines; Map = $map }
}

function Set-DotEnvValue {
    param(
        [Parameter(Mandatory)][System.Collections.Generic.List[string]]$Lines,
        [Parameter(Mandatory)][string]$Key,
        [Parameter(Mandatory)][string]$Value
    )
    $escaped = $Value.Replace('\\', '\\').Replace('"', '\"')
    $replacement = "$Key=$escaped"
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") {
            $Lines[$i] = $replacement
            return
        }
    }
    $Lines.Add($replacement)
}

function Assert-CommandSucceeded {
    param(
        [Parameter(Mandatory)][string]$CommandName,
        [Parameter(Mandatory)][scriptblock]$ScriptBlock
    )
    & $ScriptBlock
    if ($LASTEXITCODE -ne 0) {
        throw "$CommandName failed with exit code $LASTEXITCODE. Fix the printed error before continuing."
    }
}

Write-Step 'Validating current Supabase self-host folder'
$composePath = Join-Path (Get-Location) 'docker-compose.yml'
if (-not (Test-Path -LiteralPath $composePath)) {
    throw "docker-compose.yml was not found in $(Get-Location). Run this script from the Supabase self-host folder that contains docker-compose.yml."
}

$envPath = Join-Path (Get-Location) '.env'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (Test-Path -LiteralPath $envPath) {
    $backupPath = Join-Path (Get-Location) ".env.backup-$timestamp"
    Copy-Item -LiteralPath $envPath -Destination $backupPath -Force
    Write-Host "Backed up .env to $backupPath"
}
else {
    New-Item -ItemType File -Path $envPath -Force | Out-Null
    Write-Host 'Created missing .env file.'
}

Write-Step 'Repairing required environment keys without printing secret values'
$dotenv = Read-DotEnv -Path $envPath
$lines = [System.Collections.Generic.List[string]]::new()
foreach ($line in $dotenv.Lines) { $lines.Add($line) }
$env = $dotenv.Map
$changes = [System.Collections.Generic.List[string]]::new()

$secretKeys = @('POSTGRES_PASSWORD', 'JWT_SECRET', 'SECRET_KEY_BASE', 'VAULT_ENC_KEY', 'PG_META_CRYPTO_KEY', 'LOGFLARE_PUBLIC_ACCESS_TOKEN', 'LOGFLARE_PRIVATE_ACCESS_TOKEN')
foreach ($key in $secretKeys) {
    if (-not $env.Contains($key) -or [string]::IsNullOrWhiteSpace([string]$env[$key]) -or [string]$env[$key] -match '^(changeme|change-me|your-|replace|example|placeholder)') {
        $length = if ($key -eq 'POSTGRES_PASSWORD') { 24 } else { 32 }
        $env[$key] = New-RandomSecret -ByteCount $length
        Set-DotEnvValue -Lines $lines -Key $key -Value $env[$key]
        $changes.Add("generated $key")
    }
}

$defaults = [ordered]@{
    DOCKER_SOCKET_LOCATION = '/var/run/docker.sock'
    SUPABASE_PUBLIC_URL    = 'http://localhost:8000'
    API_EXTERNAL_URL       = 'http://localhost:8000'
    SITE_URL               = 'http://localhost:3000'
}
foreach ($pair in $defaults.GetEnumerator()) {
    if (-not $env.Contains($pair.Key) -or [string]::IsNullOrWhiteSpace([string]$env[$pair.Key])) {
        $env[$pair.Key] = $pair.Value
        Set-DotEnvValue -Lines $lines -Key $pair.Key -Value $pair.Value
        $changes.Add("set $($pair.Key)")
    }
}

if (-not (Test-SupabaseJwt -Token ([string]$env['ANON_KEY']) -Secret ([string]$env['JWT_SECRET']) -ExpectedRole 'anon')) {
    $env['ANON_KEY'] = New-SupabaseJwt -Role 'anon' -Secret ([string]$env['JWT_SECRET'])
    Set-DotEnvValue -Lines $lines -Key 'ANON_KEY' -Value $env['ANON_KEY']
    $changes.Add('generated ANON_KEY')
}
if (-not (Test-SupabaseJwt -Token ([string]$env['SERVICE_ROLE_KEY']) -Secret ([string]$env['JWT_SECRET']) -ExpectedRole 'service_role')) {
    $env['SERVICE_ROLE_KEY'] = New-SupabaseJwt -Role 'service_role' -Secret ([string]$env['JWT_SECRET'])
    Set-DotEnvValue -Lines $lines -Key 'SERVICE_ROLE_KEY' -Value $env['SERVICE_ROLE_KEY']
    $changes.Add('generated SERVICE_ROLE_KEY')
}

Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8
if ($changes.Count -eq 0) {
    Write-Host 'No .env key changes were required.'
}
else {
    Write-Host ('Applied changes: ' + ($changes -join ', '))
}

Write-Step 'Validating compose configuration'
Assert-CommandSucceeded -CommandName 'docker compose config' -ScriptBlock { docker compose config --quiet }
Write-Host 'docker compose config passed.'

if ($NoRestart) {
    Write-Step 'NoRestart requested; skipping service recreation'
    Write-Host 'Next action: run .\Repair-SBBL-SupabaseCurrentFolder.ps1 to recreate affected services.'
    exit 0
}

Write-Step 'Recreating affected Supabase services'
Assert-CommandSucceeded -CommandName 'docker compose up' -ScriptBlock {
    docker compose up -d --force-recreate analytics vector auth rest storage supavisor realtime kong
}

Write-Step 'Post-run checks'
docker compose ps
Write-Host "`nGateway health probe:"
try {
    Invoke-RestMethod -Uri 'http://localhost:8000/auth/v1/health' -Method Get -TimeoutSec 10 | ConvertTo-Json -Depth 8
    Write-Host 'Next action: run .\Diagnose-SBBL-SupabaseCurrentFolder.ps1 for targeted service diagnostics.'
}
catch {
    Write-Warning "Gateway reachable check did not succeed: $($_.Exception.Message)"
    Write-Host 'Next action: run .\Diagnose-SBBL-SupabaseCurrentFolder.ps1 and inspect the printed unhealthy service logs.'
}
