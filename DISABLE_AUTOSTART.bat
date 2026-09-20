@echo off
title Nonaktifkan Auto-Start SCADA Retort
cd /d "%~dp0"

echo ======================================================================
echo          NONAKTIFKAN AUTO-START SCADA RETORT PADA BOOT WINDOWS
echo ======================================================================
echo.

set SHORTCUT_NAME=SCADA_Retort_AutoStart.lnk

powershell -NoProfile -Command ^
    "$startup = [Environment]::GetFolderPath('Startup'); " ^
    "$path = \"$startup\%SHORTCUT_NAME%\"; " ^
    "if (Test-Path $path) { Remove-Item -Force $path; Write-Host '[SUKSES] Auto-Start berhasil dinonaktifkan.' } else { Write-Host '[INFO] Auto-Start sebelumnya belum aktif.' }"

echo.
pause
