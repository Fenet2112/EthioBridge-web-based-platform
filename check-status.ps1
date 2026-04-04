# EthioBridge Status Checker

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EthioBridge System Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Backend (Port 5000)
Write-Host "Checking Backend (Port 5000)..." -ForegroundColor Yellow
$backend = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($backend) {
    Write-Host "✓ Backend is RUNNING on port 5000" -ForegroundColor Green
    Write-Host "  URL: http://localhost:5000" -ForegroundColor Gray
} else {
    Write-Host "✗ Backend is NOT running" -ForegroundColor Red
    Write-Host "  Start with: cd backend && npm start" -ForegroundColor Gray
}

Write-Host ""

# Check Frontend (Port 3000)
Write-Host "Checking Frontend (Port 3000)..." -ForegroundColor Yellow
$frontend = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($frontend) {
    Write-Host "✓ Frontend is RUNNING on port 3000" -ForegroundColor Green
    Write-Host "  URL: http://localhost:3000" -ForegroundColor Gray
    Write-Host "  Admin: http://localhost:3000/admin/login" -ForegroundColor Gray
} else {
    Write-Host "✗ Frontend is NOT running" -ForegroundColor Red
    Write-Host "  Start with: cd frontend && npm start" -ForegroundColor Gray
}

Write-Host ""

# Check Configuration
Write-Host "Checking Configuration..." -ForegroundColor Yellow

# Check frontend .env
if (Test-Path "frontend\.env") {
    $envContent = Get-Content "frontend\.env" -Raw
    if ($envContent -match "localhost:5000") {
        Write-Host "✓ Frontend .env is configured correctly" -ForegroundColor Green
    } else {
        Write-Host "✗ Frontend .env needs fixing" -ForegroundColor Red
        Write-Host "  Should contain: REACT_APP_API_URL=http://localhost:5000" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Frontend .env file not found" -ForegroundColor Red
}

# Check backend .env
if (Test-Path "backend\.env") {
    Write-Host "✓ Backend .env exists" -ForegroundColor Green
} else {
    Write-Host "✗ Backend .env file not found" -ForegroundColor Red
}

Write-Host ""

# Check Admin Integration
Write-Host "Checking Admin Integration..." -ForegroundColor Yellow
if (Test-Path "frontend\src\pages\admin\views") {
    Write-Host "✓ Admin views are integrated" -ForegroundColor Green
} else {
    Write-Host "✗ Admin views not found" -ForegroundColor Red
    Write-Host "  Run: Copy-Item Admin\src\pages\views frontend\src\pages\admin\views -Recurse" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($backend -and $frontend) {
    Write-Host "✓ System is READY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your application at:" -ForegroundColor White
    Write-Host "  Main App: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Admin:    http://localhost:3000/admin/login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Admin Credentials:" -ForegroundColor White
    Write-Host "  Email:    admin@ethiobridge.et" -ForegroundColor Gray
    Write-Host "  Password: fen@1234" -ForegroundColor Gray
} elseif ($backend -and -not $frontend) {
    Write-Host "⚠ Backend is running, but Frontend is not" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Start frontend with:" -ForegroundColor White
    Write-Host "  cd frontend" -ForegroundColor Cyan
    Write-Host "  npm start" -ForegroundColor Cyan
} elseif (-not $backend -and $frontend) {
    Write-Host "⚠ Frontend is running, but Backend is not" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Start backend with:" -ForegroundColor White
    Write-Host "  cd backend" -ForegroundColor Cyan
    Write-Host "  npm start" -ForegroundColor Cyan
} else {
    Write-Host "✗ System is NOT running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Start both servers with:" -ForegroundColor White
    Write-Host "  .\start-dev.bat" -ForegroundColor Cyan
    Write-Host "  or" -ForegroundColor Gray
    Write-Host "  .\clean-restart.bat" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
