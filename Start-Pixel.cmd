@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0Start-Pixel.ps1"
echo.
pause
