@echo off
color 0A
echo.
echo ========================================
echo   ETHIOBRIDGE COMPLETE FIX
echo ========================================
echo.
echo This will fix the connection timeout error
echo.

echo Step 1: Stopping all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak > nul
echo ✓ Done
echo.

echo Step 2: Fixing frontend .env file...
cd frontend
echo REACT_APP_API_URL=http://localhost:5000> .env
echo REACT_APP_SOCKET_URL=http://localhost:5000>> .env
echo ✓ .env file updated
echo.

echo Step 3: Clearing React cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo ✓ Cache cleared
) else (
    echo ✓ No cache found
)
cd ..
echo.

echo Step 4: Verifying backend .env...
cd backend
findstr "PORT=5000" .env > nul
if %errorlevel% == 0 (
    echo ✓ Backend .env is correct
) else (
    echo ✗ Backend .env needs checking
)
cd ..
echo.

echo ========================================
echo   CONFIGURATION COMPLETE
echo ========================================
echo.
echo Now starting servers...
echo.

echo Starting Backend...
start "EthioBridge Backend" cmd /k "cd backend && echo Backend starting on port 5000... && npm start"

timeout /t 3 /nobreak > nul

echo Starting Frontend...
start "EthioBridge Frontend" cmd /k "cd frontend && echo Frontend starting on port 3000... && set REACT_APP_API_URL=http://localhost:5000 && npm start"

echo.
echo ========================================
echo   SERVERS STARTING!
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo ⚠️  CRITICAL: CLEAR YOUR BROWSER CACHE!
echo.
echo After the browser opens:
echo   1. Press Ctrl+Shift+Delete
echo   2. Select "Cached images and files"
echo   3. Click "Clear data"
echo.
echo OR use Incognito mode (Ctrl+Shift+N)
echo.
echo The error will persist until you clear the cache!
echo.
pause
