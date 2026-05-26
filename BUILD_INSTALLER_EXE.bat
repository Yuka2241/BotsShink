@echo off
setlocal
cd /d "%~dp0"
title BotsShink - Installer Build

set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_DISABLE_UPDATE_CHECK=true
set npm_config_fund=false
set npm_config_audit=false

echo ========================================
echo      BotsShink Installer Build
echo ========================================
echo.
echo This builds: dist\BotsShink-Setup-1.35.0.exe
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm not found. Reinstall Node.js LTS.
  pause
  exit /b 1
)

echo Node version:
node -v
echo NPM version:
call npm -v
echo.

echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed.
  echo If ENOSPC appears, free disk space on C drive and try again.
  pause
  exit /b 1
)

echo.
echo Building installer. This may take 2-10 minutes.
echo.
call npm run build:installer
if errorlevel 1 (
  echo.
  echo ERROR: installer build failed.
  pause
  exit /b 1
)

echo.
if exist "dist\BotsShink-Setup-1.35.0.exe" (
  echo DONE: dist\BotsShink-Setup-1.35.0.exe
) else (
  echo Build ended, but expected file was not found.
  echo Open dist folder and check the exact file name.
)
echo.
pause
