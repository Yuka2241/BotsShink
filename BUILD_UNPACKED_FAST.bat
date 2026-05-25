@echo off
setlocal
cd /d "%~dp0"
title BotsShink - Fast Unpacked Build

set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_DISABLE_UPDATE_CHECK=true
set npm_config_fund=false
set npm_config_audit=false

echo ========================================
echo      BotsShink Fast Unpacked Build
echo ========================================
echo.
echo This builds: dist\win-unpacked\BotsShink.exe
echo.

echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

echo Building unpacked app...
call npm run dist:unpacked
if errorlevel 1 (
  echo ERROR: unpacked build failed.
  pause
  exit /b 1
)

echo.
if exist "dist\win-unpacked\BotsShink.exe" (
  echo DONE: dist\win-unpacked\BotsShink.exe
) else (
  echo Build ended, but expected file was not found. Check dist folder.
)
echo.
pause
