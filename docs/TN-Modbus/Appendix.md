# Appendix & Troubleshooting

Dokumen ini berisi informasi tambahan teknis terkait implementasi Modbus pada Autonics TN Series.

---

## 1. Frame RTU vs ASCII

Perbandingan format *packet frame* yang dikirim pada kedua jenis transmisi.

### A. Modbus RTU
RTU menggunakan representasi data *binary* padat.
- **Start/End:** Jeda diam (Silent interval) 3.5 waktu karakter.
- **Request/Response:** `Slave Addr (1B) | Function (1B) | Data (N-bytes) | CRC16 (2B)`

### B. Modbus ASCII
ASCII mengubah setiap *byte* menjadi 2 karakter yang dapat dibaca manusia.
- **Start:** Karakter `:` (Colon, `0x3A`).
- **End:** Karakter `CR` + `LF` (`0x0D` + `0x0A`).
- **Request/Response:** `: | Slave Addr (2C) | Function (2C) | Data (N-char) | LRC (2C) | CR LF`

*(1B = 1 Byte, 2C = 2 Char)*

---

## 2. Checksum (CRC16 & LRC)

- **CRC16 (Modbus RTU):** Dihitung secara matematis (XOR dan Shift) terhadap seluruh *byte* di dalam frame kecuali 2 byte terakhir (tempat CRC diletakkan). Nilai polinomial yang digunakan standar Modbus: `0xA001`.
- **LRC (Modbus ASCII):** Dihitung dengan menjumlahkan secara berturut-turut (secara biner) isi pesan (kecuali titik dua awalan dan CR/LF akhir), tanpa *carry*, lalu dikomplemenkan dua (Two's Complement).

---

## 3. Register Type & Addressing Modbus

Protokol Modbus mengelompokkan datanya menjadi 4 tipe register dasar (Reference Type):

| Reference | Tipe Register | Hak Akses | Function Code TN Series | Contoh Parameter TN |
|:---:|---|---|:---:|---|
| **0X** | Coil Status | Read / Write | `01`, `05` | RUN/STOP, Auto-Tuning, Alarm Reset |
| **1X** | Discrete Input | Read Only | `02` | Status LED Panel, Status DI 1-6 |
| **3X** | Input Register | Read Only | `04` | Suhu Aktual (PV), Versi Firmware |
| **4X** | Holding Register| Read / Write | `03`, `06`, `16`| Target Suhu (SV), PID, Alarm, Pola |

**Addressing TN Series:**
Alamat pada dokumentasi TN (misal: `400006`) adalah "Absolute Modbus Reference". Dalam pemrograman kode (*Offset/Data Address*), Anda perlu mengurangi angka awalan tipenya dan dikurang 1.
- `400006` -> Offset `0005` (Hex `0x0005`)
- `100027` -> Offset `0026` (Hex `0x001A`)
- `301001` -> Offset `1000` (Hex `0x03E8`)

---

## 4. Function & Exception Code

### Function Code
- `01`: Read Coil Status
- `02`: Read Discrete Input Status
- `03`: Read Holding Registers
- `04`: Read Input Registers
- `05`: Force Single Coil
- `06`: Preset Single Register
- `16` (`0x10`): Preset Multiple Registers

### Exception Code
Bila Anda mendapatkan respons dengan nilai *Function Code* ditambah `0x80` (contoh kirim `03`, dapat `83`), maka terjadi *error*. Berikut adalah makna Exception Code yang mengikutinya:

- `01` **ILLEGAL FUNCTION**: Fungsi tidak didukung oleh TN.
- `02` **ILLEGAL DATA ADDRESS**: Alamat offset (*Starting Address*) atau jumlah yang di-*request* berada di luar rentang.
- `03` **ILLEGAL DATA VALUE**: Anda mencoba menulis nilai di luar batasan parameter.
- `04` **SLAVE DEVICE FAILURE**: Gagal menulis karena parameter di-*Lock*, atau perintah ditolak.
- `06` **SLAVE DEVICE BUSY**: Unit tidak bisa merespons karena sedang sibuk memproses hal lain.

---

## 5. Troubleshooting & FAQ

### T: Saya mendapat "Timeout Error" atau Modbus Master tidak menerima balasan sama sekali.
1. Periksa **Kabel RS485 (A dan B)**. Terkadang menukar kabel D+ (A) dan D- (B) dapat menyelesaikan masalah.
2. Periksa **Baudrate, Parity, dan Stop Bit** (`400603` - `400605`) apakah sudah identik dengan konfigurasi Master Anda.
3. Pastikan **Slave Address / ID** perangkat sudah benar.
4. Periksa apakah perangkat lain di jalur RS485 memiliki ID yang bentrok (konflik ID).

### T: Saya mendapat balasan dengan kode exception `02` (Illegal Data Address).
1. Modbus Master library Anda mungkin menggunakan *base-0* sementara Anda memasukkan *base-1*. Cobalah kurangi alamat Anda sebesar `1`.
2. Anda mencoba membaca terlalu banyak register sekaligus (`Quantity` melewati batas). TN Series hanya bisa membaca blok memori kontinu. Jika ada *gap* yang *Reserved*, jangan dibaca sekaligus.

### T: Saya mendapat exception `04` (Slave Device Failure) ketika mencoba menulis nilai SV.
1. Pastikan Anda berada dalam *mode kontrol manual* atau pengaturan tidak dibatasi oleh `Lock Parameter All` (`400725`).
2. Pastikan `Communication Write` (`400607`) bernilai `0` (EN.A). Jika nilainya `1` (DIS.A), TN Series menolak perintah penulisan (Write).

### T: Suhu aktual (PV) terbaca `31000`. Apa artinya?
Angka `31000` (OPEN) mengindikasikan bahwa kabel sensor putus atau termokopel/RTD tidak terpasang dengan baik ke unit TN.

### T: Pembacaan suhu saya berbeda ratusan/ribuan derajat!
Periksa pengaturan *Decimal Point* (`301002`). Nilai yang dikembalikan TN adalah `INT16` (Integer murni tanpa koma). Jika suhu aktual adalah `25.5 ℃`, perangkat akan mengirim angka `255`. Anda harus membagi angka tersebut secara mandiri di sisi perangkat *Master* / *Backend* sesuai dengan *Decimal Point* perangkat.

### T: Saya menggunakan Modbus TCP, apakah TN Series mendukungnya?
Tidak langsung. TN Series adalah perangkat RS485 (RTU/ASCII). Anda perlu menggunakan perangkat tambahan seperti **RS485 to Ethernet/Wi-Fi Converter** (Serial Device Server/Gateway) untuk mengubah paket TCP ke RTU sebelum dikirim ke TN Series.
