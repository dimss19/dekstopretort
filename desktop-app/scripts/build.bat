@echo off
title Build SCADA Retort Desktop (.exe) - PT Indah Mesin
cd /d "%~dp0\..\.."
cls

echo ======================================================================
echo           BUILD SCADA RETORT DESKTOP APP (.EXE) - PT INDAH MESIN
echo          Bundled: PHP 8.3 + SQLite + Modbus Bridge + CH340 Driver
echo ======================================================================
echo.

:: 1. Verifikasi Environment & Bundling Runtime PHP 8.3
echo [1/5] Memeriksa Environment & Bundling Runtime PHP 8.3...
if not exist "packages\nativephp\php-bin\bin\win\x64\php-8.3.zip" (
    echo [ERROR] Package PHP Binary Windows tidak ditemukan di 'packages\nativephp\php-bin'.
    pause
    exit /b 1
)
echo [OK] Runtime PHP 8.3 Portable siap dibundel otomatis.
:: 2. Sinkronisasi Logo Aplikasi (Master: desktop-app\assets\icon.png)
echo [2/6] Menyelaraskan Logo Aplikasi ke Format ICO, ICNS, dan PNG...
python desktop-app\scripts\convert_icon.py
echo [OK] Logo aplikasi tersinkronisasi.
echo.

:: 3. Kompilasi Modbus Bridge Standalone EXE (Zero Python Dependency)
echo [3/6] Menyiapkan Standalone Modbus Bridge EXE (Zero Python Dependency)...
if not exist "scripts\modbus_bridge.exe" (
    call pyinstaller --onefile --console --name modbus_bridge --distpath scripts scripts\modbus_bridge.py
)
if exist "scripts\modbus_bridge.exe" (
    echo [OK] modbus_bridge.exe siap. Komputer klien tidak butuh instal Python.
) else (
    echo [WARN] modbus_bridge.exe tidak ditemukan, fallback ke script python.
)
echo.

:: 4. Build Frontend Assets
echo [4/6] Mengkompilasi Aset Frontend (React + Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Gagal mengkompilasi frontend assets!
    pause
    exit /b 1
)
echo [OK] Aset frontend berhasil dikompilasi ke public\build.
echo.

:: 5. Optimasi Cache Laravel
echo [5/6] Mengoptimasi Cache Laravel...
php artisan config:clear
php artisan route:clear
php artisan view:clear
echo [OK] Cache dibersihkan.
echo.

:: 6. Build Executable Windows NSIS Wizard Installer
echo [6/6] Membuat Wizard Installer Desktop Windows (.exe)...
echo Ini akan membungkus Electron, PHP 8.3, Modbus Bridge, dan Driver CH340 ke dalam NSIS Setup Wizard.
php artisan native:build win x64 --no-interaction
if %errorlevel% neq 0 (
    echo [ERROR] Build NativePHP gagal!
    pause
    exit /b 1
)

if not exist "desktop-app\dist" mkdir "desktop-app\dist"
for %%F in (nativephp\electron\dist\*-setup.exe nativephp\electron\dist\*-Setup.exe) do (
    copy /y "%%F" "desktop-app\dist\SCADA-Retort-1.0.0-Setup.exe" >nul
)

echo.
echo ======================================================================
echo   BUILD BERHASIL!
echo ======================================================================
echo File installer telah dibuat di:
echo - desktop-app\dist\SCADA-Retort-1.0.0-Setup.exe
echo.
echo Installer dilengkapi:
echo  1. Wizard Pemilihan Lokasi Folder Instalasi (C:\Program Files\...)
echo  2. Persetujuan Lisensi EULA Resmi PT Indah Mesin
echo  3. Auto-bundling PHP 8.3 Portable Runtime (Zero PHP Setup)
echo  4. Auto-bundling Standalone Modbus Bridge (Zero Python Setup)
echo  5. Auto-bundling & Instalasi Otomatis Driver USB-RS485 CH340
echo  6. Akses Langsung Dashboard SCADA Retort (Bebas Login Web)
echo.
pause
