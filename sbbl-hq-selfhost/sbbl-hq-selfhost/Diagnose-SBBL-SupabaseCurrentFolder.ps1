[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Test-HttpEndpoint {
    param([Parameter(Mandatory)][string]$Uri)
    Write-Host "`nTesting $Uri"
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec 10
        Write-Host "SUCCESS: $Uri returned a reachable response."
        $response | ConvertTo-Json -Depth 8
        return $true
    }
    catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status) {
            Write-Warning "REACHABLE_HTTP_ERROR: $Uri returned HTTP $status. This proves Kong/service routing is reachable; inspect auth/API configuration if unexpected."
            return $true
        }
        Write-Warning "UNREACHABLE: $Uri failed with: $($_.Exception.Message)"
        return $false
    }
}

function Get-ComposeServicesNeedingLogs {
    $services = [System.Collections.Generic.List[string]]::new()
    $jsonText = docker compose ps --format json 2>$null
    if ($LASTEXITCODE -eq 0 -and $jsonText) {
        try {
            $rows = $jsonText | ConvertFrom-Json
            foreach ($row in @($rows)) {
                $state = [string]$row.State
                $health = if ($row.PSObject.Properties.Name -contains 'Health') { [string]$row.Health } else { '' }
                $exitCode = if ($row.PSObject.Properties.Name -contains 'ExitCode') { [string]$row.ExitCode } else { '' }
                if ($state -match 'restart|exit|dead|created' -or $health -match 'unhealthy|starting' -or ($exitCode -and $exitCode -ne '0')) {
                    if ($row.PSObject.Properties.Name -contains 'Service' -and $row.Service) {
                        $services.Add([string]$row.Service)
                    }
                    elseif ($row.PSObject.Properties.Name -contains 'Name' -and $row.Name) {
                        $services.Add([string]$row.Name)
                    }
                }
            }
            return @($services | Select-Object -Unique)
        }
        catch {
            Write-Warning "Could not parse docker compose ps JSON; falling back to known Supabase services. $($_.Exception.Message)"
        }
    }
    return @('vector', 'auth', 'rest', 'storage', 'supavisor', 'realtime', 'kong')
}

Write-Step 'Validating current folder'
if (-not (Test-Path -LiteralPath (Join-Path (Get-Location) 'docker-compose.yml'))) {
    Write-Error "docker-compose.yml was not found in $(Get-Location). Run this script from the Supabase self-host folder that contains docker-compose.yml."
    Write-Host 'NEXT ACTION: cd to the folder containing docker-compose.yml, then rerun .\Diagnose-SBBL-SupabaseCurrentFolder.ps1.'
    exit 1
}

Write-Step 'Service status'
docker compose ps
if ($LASTEXITCODE -ne 0) {
    Write-Error 'docker compose ps failed. Docker Desktop may not be running or this folder may not be a Compose project.'
    Write-Host 'NEXT ACTION: Start Docker Desktop, verify docker compose config, then rerun diagnostics.'
    exit 1
}

Write-Step 'Logs for unhealthy, starting, exited, or restarting services only'
$targets = Get-ComposeServicesNeedingLogs
if ($targets.Count -eq 0) {
    Write-Host 'No unhealthy/restarting services detected by docker compose ps.'
}
else {
    foreach ($service in $targets) {
        Write-Host "`n--- docker compose logs --tail=120 $service ---" -ForegroundColor Yellow
        docker compose logs --tail=120 $service
    }
}

Write-Step 'Gateway/API tests'
$authOk = Test-HttpEndpoint -Uri 'http://localhost:8000/auth/v1/health'
$restOk = Test-HttpEndpoint -Uri 'http://localhost:8000/rest/v1/'

Write-Step 'Exact next action'
if ($authOk -and $restOk) {
    Write-Host 'NEXT ACTION: Run your application smoke tests against http://localhost:8000.'
}
elseif ($targets.Count -gt 0) {
    Write-Host ('NEXT ACTION: Fix the first concrete error in the logs above for: ' + ($targets -join ', ') + ', then rerun .\Repair-SBBL-SupabaseCurrentFolder.ps1.')
}
else {
    Write-Host 'NEXT ACTION: Run docker compose logs --tail=120 kong auth rest to inspect gateway routing errors, then rerun diagnostics.'
}
