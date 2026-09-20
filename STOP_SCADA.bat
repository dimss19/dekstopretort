@echo off
title Hentikan SCADA Retort Server
cd /d "%~dp0"
echo ======================================================================
echo             MENGHENTIKAN SERVER SCADA RETORT
echo ======================================================================
echo.

taskkill /f /im php.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Server SCADA berhasil dihentikan.
) else (
    echo [INFO] Tidak ada server SCADA yang sedang berjalan.
)

echo.
timeout /t 3 >nul
exit
