================================================================================
PANDUAN KONEKSI & DRIVER USB-TO-RS485 CH340/CH341 - CV INDAH MESIN
================================================================================

1. CARA PASANG DRIVER:
   - Klik kanan pada file "install_driver_ch340.bat" -> pilih "Run as administrator".
   - Klik tombol "INSTALL" pada jendela biru CH341SER yang muncul.
   - Tunggu hingga ada notifikasi "Driver install success!".

2. SKEMA PENGKABELAN TERMINAL RS-485 KE CONTROLLER AUTONICS:
   - Autonics TNS (Ukuran 48x48 mm):
     * Terminal A (+)  --> Skrup A (+) Dongle USB
     * Terminal B (-)  --> Skrup B (-) Dongle USB
     * Power Listrik   --> Pin 5 & 6 (220V AC)

   - Autonics TNH (Ukuran 48x96 mm):
     * Pin 13 (A+)     --> Skrup A (+) Dongle USB
     * Pin 14 (B-)     --> Skrup B (-) Dongle USB
     * Power Listrik   --> Pin 11 & 12 (220V AC)

   - Autonics TNL (Ukuran 96x96 mm):
     * Pin 14 (A+)     --> Skrup A (+) Dongle USB
     * Pin 13 (B-)     --> Skrup B (-) Dongle USB
     * Power Listrik   --> Pin 11 & 12 (220V AC)

3. CARA CEK PORT COM DI WINDOWS:
   - Tekan tombol Windows + X di keyboard -> pilih "Device Manager".
   - Buka bagian "Ports (COM & LPT)".
   - Perhatikan nama yang muncul, contoh: "USB-SERIAL CH340 (COM3)".
   - Nomor COM tersebut (misal COM3) yang digunakan saat monitoring di web SCADA.
================================================================================
