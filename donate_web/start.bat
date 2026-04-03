@echo off
echo [DLG] --- Reactor Ignition Sequence ---
echo.

echo [*] FORCE Killing ALL Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [*] Verifying Core Modules...
cd /d "%~dp0"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [!] ERROR: Dependency installation failed. Check your internet!
    pause
    exit /b
)
echo.
echo [*] Powering up the DLG Backend...
echo [*] Connection: MongoDB Atlas
echo.
node server.js
if %ERRORLEVEL% NEQ 0 (
    echo [!] ERROR: The Reactor has crashed! Check the error above.
)
pause
