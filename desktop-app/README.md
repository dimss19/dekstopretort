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

## 🚚 Distribusi ke Klien Pabrik

Untuk instalasi di komputer klien pabrik:
1. Salin file `desktop-app\dist\SCADA-Retort-1.0.0-Setup.exe` ke USB flashdisk atau transfer ke PC target.
2. Jalankan installer `.exe` di komputer klien (tanpa perlu install PHP, Node.js, atau database apapun).
3. Jika komputer klien menggunakan kabel konverter USB-RS485 CH340, jalankan driver dari folder `drivers\install_driver_ch340.bat` satu kali.
