# Pattern Parameter Group

Grup parameter ini dikhususkan untuk **Pattern Control Mode** (Mode PROG). Saat Mode Operasi (Register `400007`) diatur ke `1` (PROG), alat akan mengikuti urutan Set Value (SV) dan Waktu yang telah diprogramkan dalam "Steps" dan "Patterns".

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400201` hingga `400300`
- **Tipe Data Utama:** INT16

---

## 1. Pengaturan Dasar Pattern

Bagian ini mengatur bagaimana profil pola beroperasi, kondisi saat dimulai, jumlah perulangan, dan tindakan saat pola berakhir.

| Nama Parameter | Address | Hex | Deskripsi / Range | Default |
|---|---|---|---|---|
| **Time unit** | 400201 | `0x00C8` | Satuan waktu program.<br>`0`: Menit.Detik (MM.SS), `1`: Jam.Menit (HH.MM) | `0` (MM.SS) |
| **Pattern start condition** | 400202 | `0x00C9` | Kondisi awal saat pola dijalankan.<br>`0`: **SSV** (Mulai dari Starting SV)<br>`1`: **SPV** (Mulai dari Suhu Aktual / PV saat ini) | `0` (SSV) |
| **Wait operation width setting**| 400203 | `0x00CA` | Toleransi *Standby Action* (Menunggu hingga PV mencapai batas target sebelum lanjut ke step berikutnya).<br>Temp H/Analog: `0` (OFF) ~ `999`<br>Temp L: `0.0` (OFF) ~ `999.9` | Temp H: `2`, Temp L: `20` (2.0) |
| **Wait operation time** | 400204 | `0x00CB` | Waktu maksimal untuk menunggu (Standby Time).<br>`00.00` (OFF) hingga `99.59`<br>`99.60` (CONT - Menunggu selamanya) | `00.00` |
| **Pattern number** | 400205 | `0x00CC` | Memilih Pola yang akan diedit / dijalankan.<br>`0`: PTN.0 hingga `9`: PTN.9 | `0` (PTN.0) |
| **Pattern repetitions number** | 400206 | `0x00CD` | Jumlah perulangan pola.<br>`0` hingga `9999`<br>`10000`: CONT (Looping terus menerus) | `0` |
| **Pattern End State** | 400207 | `0x00CE` | Status/Aksi setelah pola selesai berjalan.<br>`0`: **STOP** (Berhenti)<br>`1`: **HOLD** (Tahan di SV terakhir)<br>`2`: **NEXT** (Lanjut ke Pattern berikutnya)<br>`3`: **PRE** (Kembali ke Pattern sebelumnya) | `0` (STOP) |
| **Pattern PID Select** | 400208 | `0x00CF` | Grup PID mana yang akan digunakan untuk Pola ini.<br>`0`: PID.0 hingga `7`: PID.7 | `0` (PID.0) |
| **Step quantity** | 400209 | `0x00D0` | Jumlah *step* (langkah) yang ada di dalam Pola yang dipilih ini.<br>`0` hingga `20` step | `0` |

---

## 2. Pengaturan Step (0 - 19)

Masing-masing Pattern dapat memiliki maksimal 20 Step (Langkah). Setiap langkah mendefinisikan Target Suhu (SV) dan Waktu yang dibutuhkan untuk mencapai / menahan suhu tersebut (TIM). 

**Address Range**: `400210` hingga `400249`

| Step | SV Parameter Address | Default | TIM Parameter Address | Default |
|:---:|---|---|---|---|
| **0** | `400210` (0x00D1) | 0 | `400211` (0x00D2) | 00.00 |
| **1** | `400212` (0x00D3) | 0 | `400213` (0x00D4) | 00.00 |
| **2** | `400214` (0x00D5) | 0 | `400215` (0x00D6) | 00.00 |
| **3** | `400216` (0x00D7) | 0 | `400217` (0x00D8) | 00.00 |
| **4** | `400218` (0x00D9) | 0 | `400219` (0x00DA) | 00.00 |
| **5** | `400220` (0x00DB) | 0 | `400221` (0x00DC) | 00.00 |
| **6** | `400222` (0x00DD) | 0 | `400223` (0x00DE) | 00.00 |
| **7** | `400224` (0x00DF) | 0 | `400225` (0x00E0) | 00.00 |
| **8** | `400226` (0x00E1) | 0 | `400227` (0x00E2) | 00.00 |
| **9** | `400228` (0x00E3) | 0 | `400229` (0x00E4) | 00.00 |
| **10** | `400230` (0x00E5) | 0 | `400231` (0x00E6) | 00.00 |
| **11** | `400232` (0x00E7) | 0 | `400233` (0x00E8) | 00.00 |
| **12** | `400234` (0x00E9) | 0 | `400235` (0x00EA) | 00.00 |
| **13** | `400236` (0x00EB) | 0 | `400237` (0x00EC) | 00.00 |
| **14** | `400238` (0x00ED) | 0 | `400239` (0x00EE) | 00.00 |
| **15** | `400240` (0x00EF) | 0 | `400241` (0x00F0) | 00.00 |
| **16** | `400242` (0x00F1) | 0 | `400243` (0x00F2) | 00.00 |
| **17** | `400244` (0x00F3) | 0 | `400245` (0x00F4) | 00.00 |
| **18** | `400246` (0x00F5) | 0 | `400247` (0x00F6) | 00.00 |
| **19** | `400248` (0x00F7) | 0 | `400249` (0x00F8) | 00.00 |

### Keterangan Nilai
- **STEP_SV_X** : Set Value (Target Suhu) untuk step X. Rentang nilainya antara `L-SV` hingga `H-SV`.
- **STEP_TIM_X** : Durasi waktu yang diberikan pada step X. Format angkanya adalah kombinasi waktu berdasarkan *Time unit*. Nilai antara `00.00` hingga `99.59`.

> [!WARNING]
> Nilai waktu (TIM) tidak dikonversi sebagai desimal murni. `99.59` di Modbus akan ditulis sebagai integer `9959` yang secara visual di layar alat diterjemahkan menjadi "99 Menit 59 Detik" (atau "99 Jam 59 Menit"). Oleh karena itu, jangan mengirimkan nilai yang format dua digit belakangnya melebihi 59 (misal: 9980).

- **Reserved**: `400250` hingga `400300` (Kosong)
