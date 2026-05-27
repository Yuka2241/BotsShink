@echo off
setlocal
cd /d "%~dp0"
title BotsShink - Clean Installer Build

set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_DISABLE_UPDATE_CHECK=true
set npm_config_fund=false
set npm_config_audit=false

echo ========================================
echo    BotsShink Clean Installer Build
echo ========================================
echo.
echo This will delete node_modules and dist, then build installer.
echo Output: dist\BotsShink-Setup-1.36.0.exe
echo.

if exist node_modules (
  echo Removing node_modules...
  rmdir /s /q node_modules
)
if exist package-lock.json (
  echo Removing package-lock.json...
  del /f /q package-lock.json
)
if exist dist (
  echo Removing dist...
  rmdir /s /q dist
)

echo Cleaning npm cache...
call npm cache clean --force

echo.
echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo ERROR: npm install failed. Free disk space on C drive and try again.
  pause
  exit /b 1
)

echo.
echo Building installer. This may take 2-10 minutes.
call npm run build:installer
if errorlevel 1 (
  echo ERROR: installer build failed.
  pause
  exit /b 1
)

echo.
if exist "dist\BotsShink-Setup-1.36.0.exe" (
  echo DONE: dist\BotsShink-Setup-1.36.0.exe
) else (
  echo Build ended, but expected file was not found. Check dist folder.
)
echo.
pause
