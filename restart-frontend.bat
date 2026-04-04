@echo off
echo Restarting Frontend with Clean Cache...
echo.

cd frontend

echo Clearing React cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo Cache cleared!
) else (
    echo No cache found.
)

echo.
echo Starting frontend on port 3000...
echo Make sure to clear your browser cache (Ctrl+Shift+Delete)
echo.

npm start
