$ErrorActionPreference = "Continue"

$anonKey = (Get-Content ".env" | Select-String '^ANON_KEY=').ToString().Split('=', 2)[1]

Write-Host "DEBUG: Testing signup with verbose error..." -ForegroundColor Yellow
$signupBody = @{
    email = "test@example.com"
    password = "TestPass123!"
} | ConvertTo-Json

try {
    $signupResult = Invoke-WebRequest -Uri "https://supabase.sbbl-hq.icu/auth/v1/signup" `
        -Headers @{
            'apikey' = $anonKey
            'Content-Type' = 'application/json'
        } `
        -Method POST `
        -Body $signupBody `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "Status: $($signupResult.StatusCode)" -ForegroundColor Green
    Write-Host "Content: $($signupResult.Content)" -ForegroundColor Green
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Response Body: $body" -ForegroundColor Red
    }
}

# Check auth container logs
Write-Host ""
Write-Host "Auth container logs:" -ForegroundColor Yellow
docker compose logs auth --tail 20
