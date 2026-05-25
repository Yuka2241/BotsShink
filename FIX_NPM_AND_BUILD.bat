@echo off
setlocal
cd /d "%~dp0"
title BotsShink - Fix NPM and Build

echo ========================================
echo       BotsShink Fix NPM and Build
echo ========================================
echo.

echo Removing broken install files...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo Cleaning npm cache...
call npm cache clean --force

echo Starting installer build...
call BUILD_INSTALLER_EXE.bat
