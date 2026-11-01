@echo off
setlocal
cd /d "%~dp0"
title Tidal Throne - Dev Server

where node >nul 2>nul
if errorlevel 1 (
  echo [Tidal Throne] Node.js was not found.
  echo Install Node.js 18 or newer, then run this launcher again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Tidal Throne] npm was not found.
  echo Repair the Node.js installation, then run this launcher again.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo [Tidal Throne] Installing dependencies for the first launch...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [Tidal Throne] Dependency installation failed.
    pause
    exit /b 1
  )
)

set "GAME_URL="
for /f "usebackq delims=" %%U in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = 5173..5183; foreach ($port in $ports) { try { $url = 'http://127.0.0.1:' + $port + '/'; $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($response.StatusCode -eq 200 -and $response.Content -match 'tidal-throne-game') { Write-Output $url; exit 0 } } catch {} }"`) do set "GAME_URL=%%U"
if defined GAME_URL (
  echo [Tidal Throne] The game is already running. Opening it now...
  start "" "%GAME_URL%"
  exit /b 0
)

echo [Tidal Throne] Starting the game and opening your browser...
echo If port 5173 is busy, Vite will select the next available port.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo.
call npm run start:game

if errorlevel 1 (
  echo.
  echo [Tidal Throne] The game server stopped with an error.
  pause
)
