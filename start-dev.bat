@echo off
echo Starting EthioBridge Development Servers...
echo.

REM Start backend in a new window
echo Starting Backend Server on port 5000...
start "EthioBridge Backend" cmd /k "cd backend && npm start"

REM Wait a bit for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in a new window
echo Starting Frontend Server on port 3000...
start "EthioBridge Frontend" cmd /k "cd frontend && npm start"

echo.
echo Both servers are starting!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window (servers will keep running)...
pause > nul
