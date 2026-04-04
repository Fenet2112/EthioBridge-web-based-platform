@echo off
echo ========================================
echo FORCE RESTART FRONTEND
echo ========================================
echo.

echo Step 1: Killing all Node processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% == 0 (
    echo ✓ Node processes killed
) else (
    echo ✓ No Node processes running
)

echo.
echo Step 2: Clearing frontend cache...
cd frontend
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo ✓ Cache cleared
) else (
    echo ✓ No cache to clear
)

echo.
echo Step 3: Verifying .env file...
type .env
echo.

echo.
echo Step 4: Starting frontend with fresh environment...
echo.
echo IMPORTANT: After the browser opens, press Ctrl+Shift+Delete to clear cache!
echo Or use Incognito mode (Ctrl+Shift+N)
echo.
pause

set REACT_APP_API_URL=http://localhost:5000
npm start

cd ..
