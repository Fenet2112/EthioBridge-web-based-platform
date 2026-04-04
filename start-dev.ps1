# EthioBridge Development Server Startup Script

Write-Host "Starting EthioBridge Development Servers..." -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "Starting Backend Server on port 5000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm start"

# Wait for backend to initialize
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend Server on port 3000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm start"

Write-Host ""
Write-Host "Both servers are starting!" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Admin Panel: http://localhost:3000/admin/login" -ForegroundColor Magenta
Write-Host ""
