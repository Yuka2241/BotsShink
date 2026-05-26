@echo off
setlocal
cd /d "%~dp0"
set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_CACHE=%LOCALAPPDATA%\electron-builder\Cache

echo ========================================
echo   BotsShink GitHub Web Installer Build
echo ========================================
echo.
echo GitHub repo:
echo https://github.com/Yuka2241/BotsShink
echo.
echo This builds a small web installer:
echo dist\BotsShink-Web-Setup-1.27.0.exe
echo.
echo IMPORTANT:
echo After build, upload these files to GitHub Release tag v1.27.0:
echo   1) dist\BotsShink-Web-Setup-1.27.0.exe
echo   2) dist\botsshink-1.27.0-x64.nsis.7z
echo   3) dist\latest.yml

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
echo Upload these files to GitHub Releases tag v1.27.0:
echo.
if exist "dist\BotsShink-Web-Setup-1.27.0.exe" echo OK: dist\BotsShink-Web-Setup-1.27.0.exe
if exist "dist\botsshink-1.27.0-x64.nsis.7z" echo OK: dist\botsshink-1.27.0-x64.nsis.7z
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
