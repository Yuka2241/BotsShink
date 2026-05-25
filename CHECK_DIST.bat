@echo off
setlocal
cd /d "%~dp0"
title BotsShink - Check dist

echo ========================================
echo          BotsShink Dist Check
echo ========================================
echo.

if not exist dist (
  echo dist folder does not exist yet.
  pause
  exit /b 0
)

echo Files in dist:
dir dist /b

echo.
if exist "dist\BotsShink-Setup-1.24.0.exe" echo FOUND installer: dist\BotsShink-Setup-1.24.0.exe
if exist "dist\BotsShink-Portable-1.24.0.exe" echo FOUND portable: dist\BotsShink-Portable-1.24.0.exe
if exist "dist\win-unpacked\BotsShink.exe" echo FOUND unpacked: dist\win-unpacked\BotsShink.exe

echo.
pause
