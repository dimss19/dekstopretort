# Panduan Distribusi Desktop App - SCADA Retort

Dokumentasi teknis pembuatan paket installer dan distribusi aplikasi desktop SCADA Retort untuk sistem operasi Microsoft Windows dan Apple macOS.

---

## Struktur Direktori

```
desktop-app/
├── assets/
│   ├── icon.ico            # Ikon multi-resolusi aplikasi Windows (16x16 hingga 256x256)
│   ├── icon.icns           # Ikon aplikasi macOS Apple
│   └── icon.png            # Master logo resmi CV Indah Mesin
├── scripts/
│   ├── build.bat           # Skrip otomatis kompilasi installer Windows (.exe)
│   ├── build-mac.sh        # Skrip otomatis kompilasi disk image macOS (.dmg)
│   └── convert_icon.py     # Skrip konversi master icon.png ke format ico dan icns
└── README.md               # Dokumentasi teknis distribusi ini
```

---

## Konfigurasi dan Karakteristik Lingkungan Desktop

1. **Database Klien Mandiri (Standalone Client Database)**:
   - Aplikasi menggunakan database **SQLite** (`database/nativephp.sqlite`) yang disimpan secara lokal di komputer klien.
   - Tidak memerlukan instalasi database server terpisah (seperti MySQL atau PostgreSQL) di komputer pabrik.
2. **Pembaruan Sistem (System Updates)**:
   - Pembaruan sistem didistribusikan melalui installer rilis resmi baru dari GitHub Releases untuk menjamin stabilitas mesin industri yang beroperasi di lingkungan terisolasi (offline / air-gapped).
3. **Identitas & Branding**:
   - Logo resmi CV Indah Mesin disematkan pada window header, taskbar Windows, system dock macOS, system tray, dan shortcut instalasi.

---

## Prosedur Pembuatan Installer Windows (.exe)

Kompilasi installer Windows menghasilkan installer setup mandiri (NSIS Wizard):

1. **Menggunakan Skrip Otomatis**:
   Jalankan berkas skrip melalui Command Prompt atau PowerShell:
   ```cmd
   desktop-app\scripts\build.bat
   ```

2. **Menggunakan Perintah Artisan**:
   ```bash
   php artisan native:build win x64 --no-interaction
   ```

3. **Lokasi Berkas Keluaran**:
   Berkas penginstal akan terbentuk pada lokasi:
   - `desktop-app/dist/SCADA-Retort-1.5.1-Setup.exe`
   - `nativephp/electron/dist/SCADA Retort-1.5.1-setup.exe`

Installer Windows telah membundel:
- Runtime PHP 8.3 Portable (Zero Dependency)
- Standalone Modbus RTU Engine (Zero Python Setup)
- Paket Driver USB-to-RS485 CH340
- Tautan Akses Langsung ke Antarmuka SCADA Retort

---

## Prosedur Pembuatan Disk Image macOS (.dmg)

Apple mewajibkan penggunaan utilitas native macOS (`hdiutil`) dan sistem berkas APFS/HFS+ untuk membuat berkas `.dmg`.

### Metode 1: Otomatisasi GitHub Actions (Direkomendasikan)
1. Buat dan kirim tag rilis ke repository GitHub:
   ```bash
   git tag v1.5.1
   git push origin v1.5.1
   ```
2. Alur kerja `.github/workflows/release.yml` pada GitHub Actions akan otomatis mem-build dua varian arsitektur:
   - `SCADA Retort-1.5.1-arm64.dmg` (Apple Silicon M1/M2/M3/M4)
   - `SCADA Retort-1.5.1-x64.dmg` (Intel Mac)
3. Hasil build otomatis dipublikasikan ke tab GitHub Releases.

### Metode 2: Kompilasi Lokal pada Perangkat Mac
Jika proses kompilasi dilakukan langsung pada perangkat macOS:
```bash
chmod +x desktop-app/scripts/build-mac.sh
./desktop-app/scripts/build-mac.sh
```

---

## Prosedur Penerapan di Komputer Klien (Factory Deployment)

### Penerapan pada Komputer Windows
1. Salin berkas `SCADA-Retort-1.5.1-Setup.exe` ke media penyimpanan (USB Flashdisk) atau kirimkan ke komputer target.
2. Jalankan berkas installer dan selesaikan wizard instalasi.
3. Hubungkan konverter USB-to-RS485 dari mesin retort ke komputer.
4. Apabila sistem operasi belum mengenali konverter, pasang driver melalui skrip yang tersedia pada direktori `drivers/install_driver_ch340.bat`.
5. Luncurkan aplikasi melalui shortcut "SCADA Retort".

### Penerapan pada Komputer macOS
1. Salin berkas disk image yang sesuai (`arm64` untuk Apple Silicon atau `x64` untuk Intel Mac).
2. Buka berkas `.dmg` dan seret ikon aplikasi ke direktori `Applications`.
3. Aplikasi siap dijalankan melalui Launchpad.

---

## Hak Cipta

CV Indah Mesin  
Sistem SCADA Mesin Retort Sterilisasi  
Hak Cipta (c) 2026 CV Indah Mesin. Seluruh hak cipta dilindungi undang-undang.
