@echo off
cd /d "%~dp0"
echo ========================================
echo      BotsShink Release File Check
echo ========================================
echo.
echo Required GitHub Release tag: v1.27.0
echo Required upload files:
echo.
if exist "dist\BotsShink-Web-Setup-1.27.0.exe" (echo OK     dist\BotsShink-Web-Setup-1.27.0.exe) else (echo MISSING dist\BotsShink-Web-Setup-1.27.0.exe)
if exist "dist\botsshink-1.27.0-x64.nsis.7z" (echo OK     dist\botsshink-1.27.0-x64.nsis.7z) else (echo MISSING dist\botsshink-1.27.0-x64.nsis.7z)
if exist "dist\latest.yml" (echo OK     dist\latest.yml) else (echo MISSING dist\latest.yml)
echo.
pause
