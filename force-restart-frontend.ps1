# Force Restart Frontend with Clean Environment

Write-Host "========================================" -ForegroundColor Red
Write-Host "FORCE RESTART FRONTEND" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Step 1: Kill all Node processes
Write-Host "Step 1: Killing all Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "✓ Killed $($nodeProcesses.Count) Node process(es)" -ForegroundColor Green
} else {
    Write-Host "✓ No Node processes running" -ForegroundColor Green
}

Start-Sleep -Seconds 2

# Step 2: Clear frontend cache
Write-Host ""
Write-Host "Step 2: Clearing frontend cache..." -ForegroundColor Yellow
$cachePath = "frontend\node_modules\.cache"
if (Test-Path $cachePath) {
    Remove-Item -Path $cachePath -Recurse -Force
    Write-Host "✓ Cache cleared" -ForegroundColor Green
} else {
    Write-Host "✓ No cache to clear" -ForegroundColor Green
}

# Step 3: Verify .env
Write-Host ""
Write-Host "Step 3: Verifying .env file..." -ForegroundColor Yellow
if (Test-Path "frontend\.env") {
    $envContent = Get-Content "frontend\.env"
    Write-Host "Current .env content:" -ForegroundColor Cyan
    $envContent | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    
    if ($envContent -match "localhost:5000") {
        Write-Host "✓ .env is correct" -ForegroundColor Green
    } else {
        Write-Host "✗ .env needs fixing!" -ForegroundColor Red
        Write-Host "Fixing .env file..." -ForegroundColor Yellow
        Set-Content -Path "frontend\.env" -Value "REACT_APP_API_URL=http://localhost:5000`nREACT_APP_SOCKET_URL=http://localhost:5000"
        Write-Host "✓ .env fixed" -ForegroundColor Green
    }
} else {
    Write-Host "✗ .env file not found! Creating..." -ForegroundColor Red
    Set-Content -Path "frontend\.env" -Value "REACT_APP_API_URL=http://localhost:5000`nREACT_APP_SOCKET_URL=http://localhost:5000"
    Write-Host "✓ .env created" -ForegroundColor Green
}

# Step 4: Start frontend
Write-Host ""
Write-Host "Step 4: Starting frontend with fresh environment..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT: CLEAR YOUR BROWSER CACHE!" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After the browser opens:" -ForegroundColor Yellow
Write-Host "  1. Press Ctrl+Shift+Delete" -ForegroundColor White
Write-Host "  2. Select 'Cached images and files'" -ForegroundColor White
Write-Host "  3. Click 'Clear data'" -ForegroundColor White
Write-Host ""
Write-Host "OR just use Incognito mode (Ctrl+Shift+N)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to start the frontend..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Starting frontend on http://localhost:3000..." -ForegroundColor Green
Write-Host ""

# Set environment variable and start
$env:REACT_APP_API_URL = "http://localhost:5000"
$env:REACT_APP_SOCKET_URL = "http://localhost:5000"

Set-Location frontend
npm start
