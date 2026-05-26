@echo off
setlocal
cd /d "%~dp0"
set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_CACHE=%LOCALAPPDATA%\electron-builder\Cache

set APP_VERSION=1.35.0
set RELEASE_TAG=v1.35.0

echo ========================================
echo   BotsShink GitHub Web Installer Build
echo ========================================
echo.
echo GitHub repo:
echo https://github.com/Yuka2241/BotsShink
echo.
echo This builds a small web installer:
echo BotsShink-Web-Setup-%APP_VERSION%.exe
echo.
echo Upload to GitHub Release tag %RELEASE_TAG%:
echo   1) BotsShink-Web-Setup-%APP_VERSION%.exe
echo   2) botsshink-%APP_VERSION%-x64.nsis.7z
echo   3) latest.yml
echo.

echo Node version:
node -v
if errorlevel 1 goto node_error

echo NPM version:
call npm -v
if errorlevel 1 goto npm_error

echo.
echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto install_error

echo.
echo Building GitHub web installer. This may take 2-10 minutes.
call npm run build:web
if errorlevel 1 goto build_error

echo.
echo ========================================
echo BUILD FINISHED
echo ========================================
echo Look for release files in:
echo   dist
echo   dist\nsis-web
echo.
if exist "dist\nsis-web\BotsShink-Web-Setup-%APP_VERSION%.exe" echo OK: dist\nsis-web\BotsShink-Web-Setup-%APP_VERSION%.exe
if exist "dist\nsis-web\botsshink-%APP_VERSION%-x64.nsis.7z" echo OK: dist\nsis-web\botsshink-%APP_VERSION%-x64.nsis.7z
if exist "dist\nsis-web\latest.yml" echo OK: dist\nsis-web\latest.yml
if exist "dist\BotsShink-Web-Setup-%APP_VERSION%.exe" echo OK: dist\BotsShink-Web-Setup-%APP_VERSION%.exe
if exist "dist\botsshink-%APP_VERSION%-x64.nsis.7z" echo OK: dist\botsshink-%APP_VERSION%-x64.nsis.7z
if exist "dist\latest.yml" echo OK: dist\latest.yml
echo.
explorer "%CD%\dist"
pause
exit /b 0

:node_error
echo ERROR: Node.js is not installed or not in PATH.
pause
exit /b 1

:npm_error
echo ERROR: npm is not available.
pause
exit /b 1

:install_error
echo ERROR: npm install failed.
echo If ENOSPC appears, free disk space on C drive and try again.
pause
exit /b 1

:build_error
echo ERROR: web installer build failed.
pause
exit /b 1
