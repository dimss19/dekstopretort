# SCADA Retort Desktop

Sistem Pengawasan, Kontrol, dan Akuisisi Data (SCADA) untuk Mesin Retort Sterilisasi Industri. Dikembangkan untuk CV Indah Mesin menggunakan arsitektur desktop hybrid berbasis NativePHP (Electron, Laravel, React, dan Inertia.js) dengan komunikasi Modbus RTU / RS485 ke Temperature Controller Autonics Seri TN.

---

## Daftar Isi

- [Deskripsi Sistem](#deskripsi-sistem)
- [Fitur Utama](#fitur-utama)
- [Arsitektur Perangkat Lunak](#arsitektur-perangkat-lunak)
- [Spesifikasi Teknis](#spesifikasi-teknis)
- [Persyaratan Sistem](#persyaratan-sistem)
- [Panduan Instalasi Klien](#panduan-instalasi-klien)
- [Panduan Pengembangan (Development Setup)](#panduan-pengembangan-development-setup)
- [Kompilasi dan Pembuatan Paket (Packaging & Build)](#kompilasi-dan-pembuatan-paket-packaging--build)
- [Otomatisasi Rilis (CI/CD GitHub Actions)](#otomatisasi-rilis-cicd-github-actions)
- [Lisensi dan Hak Cipta](#lisensi-dan-hak-cipta)

---

## Deskripsi Sistem

SCADA Retort Desktop dirancang untuk mengotomatisasi pemantauan dan pencatatan siklus sterilisasi termal pada mesin retort. Sistem berkomunikasi langsung dengan pengendali suhu Autonics seri TN (TNS, TNH, TNL) melalui antarmuka serial RS485 menggunakan protokol Modbus RTU.

Aplikasi dikemas sebagai aplikasi desktop mandiri (standalone executable), memungkinkan instalasi langsung di lingkungan pabrik tanpa ketergantungan pada server web eksternal, instalasi database server terpisah, maupun interpreter runtime tambahan.

---

## Fitur Utama

### 1. Sinkronisasi Data Real-Time
- **Monitoring Faceplate**: Representasi digital dari panel instrumen perangkat keras Autonics TN yang menampilkan Process Value (PV), Set Value (SV), Manipulated Variable (MV), Pattern aktif, Step aktif, dan sisa waktu proses.
- **SCADA Mimic View**: Visualisasi grafis 3D proses retort yang menyajikan status operasional mesin, animasi katup pemanas/pendingin, dan indikator alarm secara real-time.
- **Hardware Annunciator Strip**: Indikasi visual untuk status keluaran pemanas (OUT1 HEAT) dan pendingin (OUT2 COOL) yang sinkron dengan kondisi fisik aktuator.
- **Blinking Standby Indicator**: Tampilan SV otomatis berkedip bergantian antara status dan nilai target saat mesin dalam kondisi siaga atau berhenti, sesuai dengan karakteristik display pengendali fisik.

### 2. Navigasi Cepat Antarmuka
- Integrasi tombol pintas papan ketik:
  - **F1**: Membuka tampilan Monitoring Faceplate.
  - **F2**: Membuka tampilan SCADA Mimic View.

### 3. Komunikasi Modbus RTU Mandiri
- Dilengkapi modul bridge serial berkinerja tinggi yang berjalan sebagai proses latar belakang tanpa memerlukan instalasi Python terpisah di komputer klien.
- Deteksi otomatis port serial USB-to-RS485 (chipset CH340, FTDI, CP2102, Prolific).

### 4. Perekaman Data Historis (Data Historian)
- Penyimpanan data telemetri berkala ke database lokal terisolasi.
- Visualisasi grafik termal proses sterilisasi untuk verifikasi kecukupan panas (nilai Fo).
- Ekspor log data operasional ke format CSV dan PDF untuk audit mutu pangan dan kepatuhan regulasi.

---

## Arsitektur Perangkat Lunak

Aplikasi menggunakan pendekatan hybrid yang menggabungkan keandalan backend Laravel dengan fleksibilitas antarmuka modern React:

```
[ Antarmuka Pengguna ]
React 18 + Inertia.js + Tailwind CSS + Lucide Icons
        |
[ Shell Desktop ]
Electron Shell (NativePHP Desktop Driver)
        |
[ Backend Lokal ]
Embedded PHP 8.3 Runtime + Laravel Framework + SQLite Database
        |
[ Lapisan Komunikasi Perangkat Keras ]
Modbus RTU Engine (Serial RS485 Communication)
        |
[ Pengendali Fisik Mesin ]
Autonics Temperature Controller Seri TN (TNS / TNH / TNL)
```

---

## Spesifikasi Teknis

| Komponen | Spesifikasi / Teknologi |
| :--- | :--- |
| Framework Aplikasi | Laravel 11 / 13 |
| Desktop Runtime | NativePHP Electron Shell |
| Antarmuka Pengguna | React 18, Inertia.js, TypeScript |
| Runtime Bahasa | PHP 8.3 Portable (Embedded) |
| Database Klien | SQLite (Tersimpan lokal di direktori data aplikasi) |
| Protokol Industri | Modbus RTU over RS-485 |
| Baud Rate Standar | 9600 bps, 8 Data Bits, No Parity, 1 Stop Bit (9600-8-N-1) |
| Pengendali yang Didukung | Autonics TNS, TNH, TNL Series |

---

## Persyaratan Sistem

### Sistem Operasi yang Didukung
- **Windows**: Windows 10 atau Windows 11 (64-bit)
- **macOS**: macOS 12 (Monterey), macOS 13 (Ventura), macOS 14 (Sonoma), atau yang lebih baru (Apple Silicon & Intel)

### Perangkat Keras Minimum
- Prosesor: Intel Core i3 / AMD Ryzen 3 / Apple M1 atau setara
- Memori RAM: Minimal 4 GB (Disarankan 8 GB)
- Ruang Penyimpanan Kosong: Minimal 500 MB
- Port: Minimal 1 port USB 2.0/3.0 untuk adaptor USB-to-RS485

---

## Panduan Instalasi Klien

### Instalasi di Windows
1. Unduh berkas penginstal terbaru `SCADA-Retort-<versi>-Setup.exe` dari halaman [GitHub Releases](https://github.com/dimss19/dekstopretort/releases).
2. Jalankan berkas installer dan ikuti petunjuk wizard instalasi hingga selesai.
3. Hubungkan kabel adaptor USB-to-RS485 dari mesin retort ke komputer. Jika driver belum terpasang, gunakan penginstal driver CH340 yang disertakan pada folder instalasi.
4. Buka aplikasi melalui pintasan desktop "SCADA Retort".

### Instalasi di macOS
1. Unduh berkas disk image yang sesuai dari halaman [GitHub Releases](https://github.com/dimss19/dekstopretort/releases):
   - Arsitektur Apple Silicon (M1/M2/M3/M4): `SCADA Retort-<versi>-arm64.dmg`
   - Arsitektur Intel: `SCADA Retort-<versi>-x64.dmg`
2. Buka berkas `.dmg` dan seret ikon "SCADA Retort" ke dalam folder `Applications`.
3. Buka aplikasi melalui Launchpad atau folder Applications.

---

## Panduan Pengembangan (Development Setup)

### Prasyarat Pengembangan
Pastikan perangkat kerja pengembangan telah terpasang:
- PHP 8.3 dengan ekstensi `mbstring`, `pdo_sqlite`, `xml`, `curl`, `ctype`, `intl`, `bcmath`
- Composer 2.7+
- Node.js 20 LTS atau 22 LTS & npm

### Langkah Pemasangan
1. Salin repositori ke direktori kerja lokal:
   ```bash
   git clone https://github.com/dimss19/dekstopretort.git
   cd dekstopretort
   ```

2. Pasang dependensi PHP dan Node.js:
   ```bash
   composer install
   npm install
   ```

3. Konfigurasi berkas lingkungan:
   ```bash
   copy .env.example .env
   php artisan key:generate
   ```

4. Jalankan migrasi database lokal:
   ```bash
   php artisan migrate
   ```

5. Jalankan kompilasi frontend dan pengujian unit:
   ```bash
   npm run build
   npx vitest run
   ```

6. Jalankan aplikasi pada lingkungan pengembangan:
   ```bash
   php artisan native:run
   ```

---

## Kompilasi dan Pembuatan Paket (Packaging & Build)

### Pembuatan Penginstal Windows (.exe)
Untuk memproduksi installer Windows NSIS Wizard di lingkungan Windows:
```bash
# Melalui script batch otomatis
desktop-app\scripts\build.bat

# Atau langsung melalui Artisan
php artisan native:build win x64 --no-interaction
```
Berkas keluaran installer akan tersedia di:
- `desktop-app/dist/SCADA-Retort-1.5.1-Setup.exe`
- `nativephp/electron/dist/SCADA Retort-1.5.1-setup.exe`

### Pembuatan Paket macOS (.dmg)
Pembuatan berkas `.dmg` memerlukan utilitas native macOS (`hdiutil`). Disarankan untuk menggunakan alur otomatisasi GitHub Actions yang telah dikonfigurasi.

---

## Otomatisasi Rilis (CI/CD GitHub Actions)

Repositori ini telah dilengkapi alur kerja otomatisasi di `.github/workflows/release.yml`. Alur kerja akan dieksekusi secara otomatis setiap kali tag versi baru diunggah ke repositori:

```bash
git tag v1.5.1
git push origin v1.5.1
```

Tahapan alur kerja rilis mencakup:
1. **Pengujian Otomatis (`test`)**: Menjalankan seluruh pengujian unit front-end (Vitest).
2. **Kompilasi macOS (`build-mac`)**: Menggunakan runner `macos-latest` untuk memproduksi disk image untuk arsitektur Intel (`x64`) dan Apple Silicon (`arm64`).
3. **Kompilasi Windows (`build-win`)**: Menggunakan runner `windows-latest` untuk memproduksi penginstal installer Windows NSIS Wizard (`x64`).
4. **Publikasi Rilis (`publish-release`)**: Mengumpulkan seluruh artefak instalasi dan menerbitkannya secara otomatis ke GitHub Releases.

---

## Lisensi dan Hak Cipta

Seluruh hak cipta, desain mekanikal sistem, dan kode sumber aplikasi ini dimiliki secara resmi oleh:

**CV Indah Mesin**  
Website: https://indahmesin.com  
Hak Cipta (c) 2026 CV Indah Mesin. Seluruh hak cipta dilindungi undang-undang.
