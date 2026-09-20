@echo off
:: Batch script untuk install Driver USB-RS485 CH340 / CH341
title Installer Driver USB-RS485 CH340 - PT Indah Mesin
cd /d "%~dp0"

echo ======================================================================
echo   INSTALLER DRIVER USB-TO-RS485 (CH340 / CH341) - PT INDAH MESIN
echo ======================================================================
echo.
echo Memeriksa izin Administrator...

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Membutuhkan hak Administrator untuk memasang driver USB.
    echo Membuka jendela konfirmasi Administrator (UAC)...
    powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    exit /b
)

echo [OK] Izin Administrator terverifikasi.
echo.
echo Membuka program instalasi resmi WCH CH340/CH341...
echo Petunjuk:
echo  1. Klik tombol "INSTALL" pada jendela yang muncul.
echo  2. Tunggu hingga muncul pesan "Driver install success!".
echo  3. Klik OK, lalu colokkan converter USB-RS485 ke port USB komputer.
echo.

start /wait "" "%~dp0CH341SER.EXE"

echo.
echo ======================================================================
echo Pemasangan driver selesai!
echo Converter USB-RS485 sekarang akan terbaca di Windows Device Manager:
echo -> Ports (COM & LPT) -> "USB-SERIAL CH340 (COM...)"
echo ======================================================================
echo.
pause
