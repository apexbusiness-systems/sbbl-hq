$ErrorActionPreference = "Stop"

$anonKey = (Get-Content ".env" | Select-String '^ANON_KEY=').ToString().Split('=', 2)[1]
$testEmail = "e2e-test-$(Get-Random -Maximum 99999)@sbbl-hq.icu"
$testPassword = "TestPass123!"

Write-Host "E2E AUTH TEST" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host ""

# Test 1: Signup
Write-Host "[1/4] Testing signup..." -ForegroundColor Yellow
$signupBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $signupResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/signup" `
        -Headers @{
            'apikey' = $anonKey
            'Content-Type' = 'application/json'
        } `
        -Method POST `
        -Body $signupBody `
        -UseBasicParsing

    Write-Host "  Signup HTTP: $($signupResult.StatusCode) $($signupResult.StatusDescription)" -ForegroundColor $(if ($signupResult.StatusCode -eq 200 -or $signupResult.StatusCode -eq 201) { "Green" } else { "Red" })

    $signupData = $signupResult.Content | ConvertFrom-Json
    if ($signupData.user_id) {
        Write-Host "  User ID created: $($signupData.user_id)" -ForegroundColor Green
        $userId = $signupData.user_id
    } elseif ($signupData.msg -match "already registered") {
        Write-Host "  User already exists (OK)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Signup failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Signin
Write-Host ""
Write-Host "[2/4] Testing signin..." -ForegroundColor Yellow
$signinBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $signinResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/token?grant_type=password" `
        -Headers @{
            'apikey' = $anonKey
            'Content-Type' = 'application/json'
        } `
        -Method POST `
        -Body $signinBody `
        -UseBasicParsing

    Write-Host "  Signin HTTP: $($signinResult.StatusCode) $($signinResult.StatusDescription)" -ForegroundColor $(if ($signinResult.StatusCode -eq 200) { "Green" } else { "Red" })

    $signinData = $signinResult.Content | ConvertFrom-Json
    if ($signinData.access_token) {
        Write-Host "  Access token received: YES" -ForegroundColor Green
        Write-Host "  Refresh token received: $($signinData.refresh_token -ne $null)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Signin failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: User settings / profile
Write-Host ""
Write-Host "[3/4] Testing user settings..." -ForegroundColor Yellow

if ($signinData.access_token) {
    try {
        $userResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/user" `
            -Headers @{
                'apikey' = $anonKey
                'Authorization' = "Bearer $($signinData.access_token)"
            } `
            -Method GET `
            -UseBasicParsing

        Write-Host "  User HTTP: $($userResult.StatusCode) $($userResult.StatusDescription)" -ForegroundColor $(if ($userResult.StatusCode -eq 200) { "Green" } else { "Red" })
    } catch {
        Write-Host "  User settings failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Verify JWT claims
Write-Host ""
Write-Host "[4/4] Verifying JWT claims..." -ForegroundColor Yellow

if ($signinData.access_token) {
    try {
        $jwtParts = $signinData.access_token -split '\.'
        $payloadB64 = $jwtParts[1].Replace('-', '+').Replace('_', '/')
        while ($payloadB64.Length % 4 -ne 0) { $payloadB64 += '=' }
        $payloadBytes = [System.Convert]::FromBase64String($payloadB64)
        $payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes)
        $payload = $payloadJson | ConvertFrom-Json

        Write-Host "  Role: $($payload.role)" -ForegroundColor $(if ($payload.role -eq "authenticated") { "Green" } else { "Yellow" })
        Write-Host "  Issuer: $($payload.iss)" -ForegroundColor $(if ($payload.iss -eq "supabase") { "Green" } else { "Yellow" })
        Write-Host "  Expiry valid: $($payload.exp -gt [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -ForegroundColor Green
    } catch {
        Write-Host "  JWT parse error (non-critical): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=============" -ForegroundColor Cyan
Write-Host "E2E AUTH TEST COMPLETE" -ForegroundColor Cyan

