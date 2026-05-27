@echo off
setlocal
cd /d "%~dp0"
title BotsShink - Portable EXE Build

set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_DISABLE_UPDATE_CHECK=true
set npm_config_fund=false
set npm_config_audit=false

echo ========================================
echo      BotsShink Portable EXE Build
echo ========================================
echo.
echo This builds: dist\BotsShink-Portable-1.36.0.exe
echo.

echo Node version:
node -v
echo NPM version:
call npm -v
echo.

echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

echo.
echo Building portable EXE. This may take 2-10 minutes.
call npm run build:portable
if errorlevel 1 (
  echo ERROR: portable build failed.
  pause
  exit /b 1
)

echo.
if exist "dist\BotsShink-Portable-1.36.0.exe" (
  echo DONE: dist\BotsShink-Portable-1.36.0.exe
) else (
  echo Build ended, but expected file was not found. Check dist folder.
)
echo.
pause
