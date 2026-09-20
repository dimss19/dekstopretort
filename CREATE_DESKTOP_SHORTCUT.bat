@echo off
title Buat Shortcut Desktop - SCADA Retort
cd /d "%~dp0"

echo ======================================================================
echo    MEMBUAT SHORTCUT DESKTOP SCADA RETORT - PT INDAH MESIN
echo ======================================================================
echo.

set TARGET_FILE=%~dp0START_SCADA.bat
set WORKING_DIR=%~dp0
set SHORTCUT_NAME=SCADA Retort - Indah Mesin.lnk

powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$desk = [Environment]::GetFolderPath('Desktop'); " ^
    "$sc = $ws.CreateShortcut(\"$desk\%SHORTCUT_NAME%\"); " ^
    "$sc.TargetPath = '%TARGET_FILE%'; " ^
    "$sc.WorkingDirectory = '%WORKING_DIR%'; " ^
    "$sc.Description = 'SCADA Retort Monitoring System - PT Indah Mesin'; " ^
    "$sc.Save();"

if %errorlevel% equ 0 (
    echo [SUKSES] Shortcut berhasil dibuat di Desktop Anda:
    echo          "Desktop\SCADA Retort - Indah Mesin"
    echo.
    echo Operator sekarang dapat membuka SCADA langsung dari layar Desktop!
) else (
    echo [GAGAL] Gagal membuat shortcut di Desktop.
)

echo.
pause
