@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   BotsShink Clean GitHub Web Build
echo ========================================
echo.
echo Removing old node_modules and dist...
if exist node_modules rmdir /s /q node_modules
if exist dist rmdir /s /q dist
if exist package-lock.json del /q package-lock.json
call npm cache clean --force
call BUILD_WEB_INSTALLER_GITHUB.bat
