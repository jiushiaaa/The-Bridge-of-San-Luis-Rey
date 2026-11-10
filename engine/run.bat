@echo off
setlocal enabledelayedexpansion
rem ==== ASCII ONLY ====
rem This file MUST stay pure ASCII (no CJK / non-English characters, no chcp).
rem Non-ASCII bytes here corrupt under cmd.exe code pages and break the script.
rem See doc/10-constraints-decisions.md for the English-only rule.
cd /d %~dp0

if not exist frontend\node_modules (
  echo [1/3] Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
)

if not exist frontend\dist (
  echo [2/3] Building frontend...
  cd frontend
  call npm run build
  cd ..
)

echo [3/3] Select a work to launch:
echo   1. xdd      (Siddhartha)
echo   2. bad      (Bad Blood)
echo   3. murder   (Chronicle of a Death Foretold)
echo   4. weicheng (Fortress Besieged)
set /p choice=Enter 1/2/3/4 (default 1):
if "%choice%"=="2" (
  set "GAME_URL=http://localhost:6872/?game=bad"
) else if "%choice%"=="3" (
  set "GAME_URL=http://localhost:6872/?game=murder"
) else if "%choice%"=="4" (
  set "GAME_URL=http://localhost:6872/?game=weicheng"
) else (
  set "GAME_URL=http://localhost:6872/?game=xdd"
)

rem Free port 6872 if a previous backend instance is still listening
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":6872 .*LISTENING"') do taskkill /f /pid %%p >nul 2>&1

rem Open the browser ~2s later (backend needs a moment to start listening);
rem this temporary minimized window closes itself right after.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %GAME_URL%"

echo.
echo ============================================================
echo  Backend runs in THIS window (http://localhost:6872).
echo  Keep this window open while playing or editing.
echo  Closing this window (or Ctrl+C) stops the backend.
echo ============================================================
echo.

rem Run backend in foreground so it is bound to this window's lifetime:
rem the server stays resident until you close the window.
node backend\server.js
