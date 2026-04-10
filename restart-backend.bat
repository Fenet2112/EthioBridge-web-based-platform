@echo off
echo Stopping all Node processes...
taskkill /F /IM node.exe 2>nul

echo Waiting for port to be released...
timeout /t 3 /nobreak >nul

echo Starting backend server...
cd backend
start cmd /k "npm start"

echo Backend restart initiated!
echo Check the new window for server status.
pause
