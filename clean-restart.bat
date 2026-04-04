@echo off
echo ========================================
echo EthioBridge Clean Restart
echo ========================================
echo.

echo Step 1: Stopping any running servers...
echo Please close any terminal windows running npm/node
echo Press any key when ready...
pause > nul

echo.
echo Step 2: Clearing frontend cache...
cd frontend
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo ✓ Frontend cache cleared
) else (
    echo ✓ No cache to clear
)
cd ..

echo.
echo Step 3: Verifying configuration...
echo Checking frontend/.env...
findstr "localhost:5000" frontend\.env > nul
if %errorlevel% == 0 (
    echo ✓ Frontend .env is correct
) else (
    echo ✗ Frontend .env needs fixing
    echo   Should contain: REACT_APP_API_URL=http://localhost:5000
)

echo.
echo Step 4: Starting backend...
start "EthioBridge Backend" cmd /k "cd backend && echo Starting backend on port 5000... && npm start"

echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo.
echo Step 5: Starting frontend...
start "EthioBridge Frontend" cmd /k "cd frontend && echo Starting frontend on port 3000... && npm start"

echo.
echo ========================================
echo ✓ Servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo Admin:    http://localhost:3000/admin/login
echo.
echo IMPORTANT: Clear your browser cache!
echo   1. Press Ctrl + Shift + Delete
echo   2. Clear "Cached images and files"
echo   3. Or use Incognito mode
echo.
echo Press any key to exit...
pause > nul
