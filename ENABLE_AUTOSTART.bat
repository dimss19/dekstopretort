@echo off
title Aktifkan Auto-Start SCADA Retort Saat Boot Windows
cd /d "%~dp0"

echo ======================================================================
echo    AKTIFKAN AUTO-START SCADA RETORT SAAT WINDOWS MENYALA (BOOT)
echo ======================================================================
echo.

set TARGET_FILE=%~dp0START_SCADA.bat
set WORKING_DIR=%~dp0
set SHORTCUT_NAME=SCADA_Retort_AutoStart.lnk

powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$startup = [Environment]::GetFolderPath('Startup'); " ^
    "$sc = $ws.CreateShortcut(\"$startup\%SHORTCUT_NAME%\"); " ^
    "$sc.TargetPath = '%TARGET_FILE%'; " ^
    "$sc.WorkingDirectory = '%WORKING_DIR%'; " ^
    "$sc.Description = 'SCADA Retort AutoStart'; " ^
    "$sc.Save();"

if %errorlevel% equ 0 (
    echo [SUKSES] Auto-Start telah AKTIF!
    echo          Setiap kali komputer/Windows dinyalakan, SCADA Retort
    echo          akan otomatis dijalankan di latar belakang.
) else (
    echo [GAGAL] Gagal mendaftarkan Auto-Start ke folder Windows Startup.
)

echo.
pause
