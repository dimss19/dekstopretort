# 🖥️ SCADA Retort - Desktop App Edition (.exe)

Aplikasi Desktop Windows untuk Sistem SCADA Retort PT Indah Mesin, dibangun menggunakan **NativePHP for Laravel (Electron Shell)**.

---

## 📁 Struktur Folder Desktop

```
desktop-app/
├── assets/
│   ├── icon.ico            # Icon aplikasi multi-resolusi (16x16 s/d 256x256)
│   └── icon.png            # Master logo PT Indah Mesin (transparan)
├── scripts/
│   ├── build.bat           # 1-Click Script untuk membuild installer Windows (.exe)
│   └── convert_icon.py     # Script Python untuk generate icon.ico dari icon.png
└── README.md               # Dokumentasi ini
```

---

## ⚙️ Karakteristik & Konfigurasi

- **Database Client**: Menggunakan database **SQLite** (`database/nativephp.sqlite`), otomatis dikelola secara lokal di komputer klien tanpa perlu instalasi database PostgreSQL/MySQL terpisah.
- **Database Server**: Server web/cloud tetap menggunakan **PostgreSQL** (`.env`). Codebase shared mendukung dual mode tanpa konflik.
- **Auto-Update**: **Dinonaktifkan** (`updater.enabled = false`). Pembaruan sistem dikirimkan langsung berupa file installer baru ke klien.
- **Icon & Branding**: Logo resmi PT Indah Mesin (Gear + Globe) diterapkan pada window bar, taskbar Windows, system tray, dan shortcut installer.

---

## 🛠️ Cara Menjalankan Mode Pengembangan (Development)

Untuk menjalankan desktop app di lingkungan lokal developer:

```bash
# Jalankan development server NativePHP
php artisan native:run
```

Jendela aplikasi desktop Electron akan otomatis terbuka menampilkan dashboard SCADA Retort.

---

## 📦 Cara Membuild Installer Windows (.exe)

Cukup jalankan script batch otomatis:

1. Double-click file:
   ```
   desktop-app\scripts\build.bat
   ```
   *Atau jalankan dari terminal:*
   ```bash
   php artisan native:build win
   ```

2. Output installer akan otomatis dihasilkan di folder:
   ```
   desktop-app/dist/
   └── SCADA-Retort-1.0.0-Setup.exe
   ```
   *(Serta di `nativephp/electron/dist/Laravel-1.0.0-setup.exe`)*

---

## 🍏 Cara Membuild Installer macOS (.dmg)

Apple mewajibkan lingkungan macOS (tool native `hdiutil` & sistem file APFS) untuk memproduksi file `.dmg`. Binary PHP 8.3 untuk macOS Intel (`x64`) dan Apple Silicon (`arm64`) serta icon `.icns` telah disiapkan di repositori.

Ada 2 cara untuk membuild `.dmg`:

### Pilihan 1: Otomatis via GitHub Actions (Cloud Mac Runner) - Direkomendasikan
1. Push branch `desktopapp` ke GitHub repositori Anda.
2. Masuk ke tab **Actions** di GitHub, pilih workflow **"Build macOS Desktop App (.dmg)"**, lalu klik tombol **"Run workflow"**.
3. GitHub akan menjalankan mesin Mac virtual secara gratis, mengompilasi kedua versi:
   - `SCADA Retort-1.0.0-x64.dmg` (Intel Mac)
   - `SCADA Retort-1.0.0-arm64.dmg` (Apple Silicon M1/M2/M3/M4)
4. Download kedua file `.dmg` langsung dari tab Artifacts hasil build.

### Pilihan 2: Build di Komputer Mac Lokal (MacBook / Mac Mini)
Jika Anda memiliki komputer Mac:
```bash
chmod +x desktop-app/scripts/build-mac.sh
./desktop-app/scripts/build-mac.sh
```
File `.dmg` untuk kedua arsitektur akan otomatis terbentuk di folder `desktop-app/dist/`.

---

## 🚚 Distribusi ke Klien Pabrik

Untuk instalasi di komputer klien pabrik:
1. **Windows**: Salin file `desktop-app\dist\SCADA-Retort-1.0.0-Setup.exe` ke USB flashdisk atau transfer ke PC target.
   - Jalankan installer `.exe` di PC target (tanpa perlu install PHP, Node.js, atau database apapun).
   - Jika menggunakan kabel USB-RS485 CH340, jalankan driver dari folder `drivers\install_driver_ch340.bat` satu kali.
2. **macOS**: Kirim file `.dmg` sesuai arsitektur Mac klien (`arm64` untuk M1/M2/M3/M4, atau `x64` untuk Intel Mac). Klien cukup membuka `.dmg` dan drag icon ke folder `Applications`.

