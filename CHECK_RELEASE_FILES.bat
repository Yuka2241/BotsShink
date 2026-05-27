@echo off
cd /d "%~dp0"
set APP_VERSION=1.36.0
set RELEASE_TAG=v1.36.0

echo ========================================
echo      BotsShink Release File Check
echo ========================================
echo.
echo Required GitHub Release tag: %RELEASE_TAG%
echo Required upload files:
echo.
if exist "dist\nsis-web\BotsShink-Web-Setup-%APP_VERSION%.exe" (echo OK     dist\nsis-web\BotsShink-Web-Setup-%APP_VERSION%.exe) else if exist "dist\BotsShink-Web-Setup-%APP_VERSION%.exe" (echo OK     dist\BotsShink-Web-Setup-%APP_VERSION%.exe) else (echo MISSING BotsShink-Web-Setup-%APP_VERSION%.exe)
if exist "dist\nsis-web\botsshink-%APP_VERSION%-x64.nsis.7z" (echo OK     dist\nsis-web\botsshink-%APP_VERSION%-x64.nsis.7z) else if exist "dist\botsshink-%APP_VERSION%-x64.nsis.7z" (echo OK     dist\botsshink-%APP_VERSION%-x64.nsis.7z) else (echo MISSING botsshink-%APP_VERSION%-x64.nsis.7z)
if exist "dist\nsis-web\latest.yml" (echo OK     dist\nsis-web\latest.yml) else if exist "dist\latest.yml" (echo OK     dist\latest.yml) else (echo MISSING latest.yml)
echo.
pause
