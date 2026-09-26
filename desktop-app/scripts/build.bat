@echo off
title Build SCADA Retort Desktop (.exe) - PT Indah Mesin
cd /d "%~dp0\..\.."
cls

echo ======================================================================
echo           BUILD SCADA RETORT DESKTOP APP (.EXE) - PT INDAH MESIN
echo ======================================================================
echo.

:: 1. Verifikasi Environment
echo [1/4] Memeriksa Environment Build...
if not exist "packages\nativephp\php-bin\bin\win\x64\php-8.3.zip" (
    echo [ERROR] Package PHP Binary Windows tidak ditemukan di 'packages\nativephp\php-bin'.
    pause
    exit /b 1
)

:: 2. Build Frontend Assets
echo [2/4] Mengkompilasi Aset Frontend (React + Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Gagal mengkompilasi frontend assets!
    pause
    exit /b 1
)
echo [OK] Aset frontend berhasil dikompilasi ke public\build.
echo.

:: 3. Optimasi Cache Laravel
echo [3/4] Mengoptimasi Cache Laravel...
php artisan config:clear
php artisan route:clear
php artisan view:clear
echo [OK] Cache dibersihkan.
echo.

:: 4. Build Executable Windows
echo [4/4] Membuat Installer Desktop Windows (.exe)...
echo Ini mungkin membutuhkan beberapa menit untuk membungkus Electron dan PHP Runtime.
php artisan native:build win
if %errorlevel% neq 0 (
    echo [ERROR] Build NativePHP gagal!
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo   BUILD BERHASIL!
echo ======================================================================
echo File installer telah dibuat di dalam folder 'dist\'.
echo Anda dapat mendistribusikan file .exe tersebut langsung ke komputer klien pabrik.
echo.
pause
