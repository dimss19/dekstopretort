@echo off
title SCADA Retort Server - PT Indah Mesin
cd /d "%~dp0"
cls

echo ======================================================================
echo           SCADA RETORT SYSTEM - PT INDAH MESIN (PLUG ^& PLAY)
echo ======================================================================
echo.

:: 1. Verifikasi runtime PHP lokal
if not exist "php\php.exe" (
    echo [ERROR] Runtime PHP tidak ditemukan di dalam folder 'php\'.
    echo Pastikan folder aplikasi ini diekstrak secara utuh.
    echo.
    pause
    exit /b
)

:: 2. Opsi pasang driver USB-RS485 CH340
echo [1/3] Memeriksa Converter Driver USB-RS485 (CH340/CH341)...
echo       Jika converter kabel Autonics baru pertama kali dipasang ke PC ini,
echo       driver perlu diinstall terlebih dahulu.
echo.
set /p "DRV_CHOICE=>> Apakah Anda ingin membuka installer Driver CH340 sekarang? (Y/N, default N): "
if /i "%DRV_CHOICE%"=="y" (
    echo Membuka installer driver CH340...
    call "drivers\install_driver_ch340.bat"
    echo.
)

:: 3. Deteksi Port Bebas (8000 -> 8080 -> 8888)
echo [2/3] Memeriksa ketersediaan Port Jaringan...
set PORT=8000
netstat -ano | findstr /r /c:":8000 .*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Port 8000 sedang dipakai aplikasi lain. Mencoba Port 8080...
    set PORT=8080
    netstat -ano | findstr /r /c:":8080 .*LISTENING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] Port 8080 sedang dipakai aplikasi lain. Menggunakan Port 8888...
        set PORT=8888
    )
)

echo [OK] Menggunakan Port: %PORT%
echo.

:: 4. Jalankan Server SCADA
echo [3/3] Menjalankan Server SCADA Retort...
echo ======================================================================
echo   Aplikasi aktif di : http://localhost:%PORT%
echo   Akses LAN Pabrik  : http://[IP-KOMPUTER-INI]:%PORT%
echo ======================================================================
echo.
echo * Catatan: Jendela ini HARUS TETAP TERBUKA selama aplikasi digunakan.
echo * Tekan Ctrl+C di jendela ini jika ingin mematikan server.
echo.

:: Buka web browser setelah jeda 1.5 detik
start "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://localhost:%PORT%'"

:: Atur concurrency worker PHP CLI server agar multi-request lancar
set PHP_CLI_SERVER_WORKERS=4

:: Jalankan Laravel Development Server via PHP Portable
".\php\php.exe" artisan serve --host=0.0.0.0 --port=%PORT%

echo.
echo Server SCADA telah berhenti.
pause
