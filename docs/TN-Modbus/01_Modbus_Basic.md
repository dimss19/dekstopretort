# 01 - Dasar-dasar Modbus pada TN Series

Dokumen ini memberikan pemahaman dasar tentang protokol Modbus yang digunakan pada Autonics TN Series. Perangkat ini mendukung dua mode transmisi: **Modbus RTU** dan **Modbus ASCII**.

Modbus adalah protokol industri yang dikembangkan pada tahun 1979 untuk komunikasi serial antar perangkat. Protokol ini sangat stabil dan luas digunakan dalam sistem otomatisasi industri, SCADA, dan perangkat IoT.

## 1. Modbus RTU Protocol

Modbus RTU (Remote Terminal Unit) mentransmisikan data dalam format **biner kontinu**. Ini membuatnya jauh lebih efisien dan cepat dibandingkan transmisi ASCII. 

Dalam RTU, struktur frame tidak secara eksplisit menggunakan karakter *start* atau *end* (seperti `\r\n`), melainkan menggunakan jeda waktu / *silent interval* (minimal 3.5 waktu karakter) di antara frame untuk mendeteksi awal dan akhir paket.

### 1.1 Struktur Frame Modbus RTU

Struktur dasar request dari *Master* (misal: ESP32/PLC) ke *Slave* (TN Controller) adalah sebagai berikut:

| Slave Address | Function Code | Starting Address | Data / Quantity | CRC Check |
|---------------|---------------|------------------|-----------------|-----------|
| 1-byte        | 1-byte        | 2-byte           | 2-byte          | 2-byte    |

**Keterangan:**
- **Slave Address**: Alamat unit TN Controller (1-99).
- **Function Code**: Instruksi yang ingin dijalankan (baca/tulis).
- **Starting Address**: Alamat register tujuan.
- **Data / Quantity**: Nilai data yang akan ditulis, atau jumlah register yang ingin dibaca.
- **CRC Check**: Checksum (Cyclic Redundancy Check) 16-bit untuk memastikan paket tidak *corrupt*.

## 2. Modbus ASCII Protocol

Modbus ASCII mengonversi setiap *byte* (8-bit biner) menjadi dua karakter ASCII (16-bit) sebelum dikirim. Hal ini mengurangi kecepatan transmisi dan efisiensi jika dibandingkan RTU, namun sangat mempermudah proses *debugging* karena data dapat dibaca langsung sebagai teks (misalnya dengan terminal serial standar).

### 2.1 Struktur Frame Modbus ASCII

Dalam ASCII, frame ditandai secara jelas oleh karakter *Start* (titik dua `:`) dan *End* (CRLF / `\r\n`).

| Start | Slave Address | Function Code | Data | LRC Check | End |
|-------|---------------|---------------|------|-----------|-----|
| 1-char `:` (0x3A) | 2-char | 2-char | N-char | 2-char | 2-char (CR+LF) |

**Keterangan:**
- **Start**: Selalu diawali dengan karakter `:` (colon).
- **LRC Check**: Checksum Longitudinal Redundancy Check.
- **End**: Ditutup dengan karakter *Carriage Return* dan *Line Feed* (0x0D dan 0x0A).

---

## 3. Function Code yang Tersedia

Berikut adalah tabel Function Code yang didukung oleh Autonics TN Series:

| Function Code | Hex | Nama Fungsi | Deskripsi | Reference Type |
|---------------|-----|-------------|-----------|----------------|
| `01` | `0x01` | Read Coil Status | Membaca status ON/OFF dari Coil | 0X |
| `02` | `0x02` | Read Input Status | Membaca status ON/OFF dari Input (Read Only) | 1X |
| `03` | `0x03` | Read Holding Registers | Membaca data biner register Parameter | 4X |
| `04` | `0x04` | Read Input Registers | Membaca data biner register Input (PV, dll) | 3X |
| `05` | `0x05` | Force Single Coil | Mengubah satu koil menjadi ON (0xFF00) atau OFF (0x0000) | 0X |
| `06` | `0x06` | Preset Single Register | Menulis data biner ke satu Holding Register | 4X |
| `16` | `0x10` | Preset Multiple Registers | Menulis data biner ke beberapa Holding Registers berurutan | 4X |

> [!TIP]
> **Praktik Terbaik:** Saat menulis parameter ke *TN Controller*, sangat disarankan untuk menggunakan **Preset Single Register (0x06)** dibandingkan Preset Multiple Registers (0x10) untuk menghindari masalah ketika menulis ke parameter dengan nilai batas (minimum/maximum) spesifik, kecuali saat *downloading* data konfigurasi massal.

---

## 4. Exception Handling (Penanganan Error)

Jika Master mengirimkan permintaan yang valid namun Slave (TN Controller) tidak dapat mengeksekusinya (misal address salah, atau data di luar batas), Slave akan membalas dengan **Exception Response**.

Dalam respons ini, fungsi utama (*Function Code*) akan dijumlahkan dengan `0x80` sebagai tanda bahwa respons tersebut adalah *error*.

**Format Exception Response (RTU):**

| Slave Address | Function Code + 0x80 | Exception Code | CRC Check |
|---------------|----------------------|----------------|-----------|
| 1-byte        | 1-byte               | 1-byte         | 2-byte    |

Contoh: Jika Master mengirim `0x03` dan gagal, TN akan membalas dengan `0x83` (`0x03 + 0x80`), diikuti oleh Exception Code.

### Daftar Exception Code TN Series

| Exception Code | Nama Error | Deskripsi / Penyebab | Solusi |
|----------------|------------|----------------------|--------|
| **01** | `ILLEGAL FUNCTION` | *Function Code* tidak didukung. | Gunakan fungsi yang terdaftar pada tabel di atas. |
| **02** | `ILLEGAL DATA ADDRESS` | Alamat register tidak valid atau tidak ada. | Pastikan address dan rentangnya (termasuk *quantity* pembacaan) sesuai dengan manual. |
| **03** | `ILLEGAL DATA VALUE` | Nilai yang diminta untuk ditulis tidak valid. | Pastikan rentang data (*Range*) yang Anda tulis sesuai dengan parameter tersebut (misal tidak melebihi H-SV atau L-SV). |
| **04** | `SLAVE DEVICE FAILURE` | Slave tidak dapat mengeksekusi (*locked*). | Terjadi jika parameter *locked*, penulisan *prohibited*, atau command tidak bisa diproses. Periksa *Lock Parameter* di menu utama. |
| **06** | `SLAVE DEVICE BUSY` | Slave sibuk. | Perangkat sedang dalam state yang tidak mengizinkan command. Coba lagi setelah beberapa waktu. |
