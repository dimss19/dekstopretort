# Input Parameter Group

Grup parameter ini berisi semua konfigurasi yang berkaitan dengan *sensor input* (jenis termokopel, RTD, atau sinyal analog), batasan suhu pengoperasian, filter digital, hingga konfigurasi output transmisi analog (jika perangkat mendukung *Transmission Output*).

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400151` hingga `400200`
- **Tipe Data Utama:** INT16

---

## Daftar Register Input Parameter

| Nama Parameter | Address | Hex | Deskripsi & Range | Default |
|---|---|---|---|---|
| **Input Type** | 400151 | `0x0096` | Memilih jenis sensor input. Referensi ke [Tabel Tipe Sensor](#tabel-tipe-sensor-dan-rentang) di bawah. | `0` (KCA.H) |
| **Unit** | 400152 | `0x0097` | Satuan suhu yang digunakan.<br>`0`: ℃, `1`: ℉ | `0` (℃) |
| **Low Input Range** | 400153 | `0x0098` | *(Analog Input)* Batas bawah rentang input analog. | `0` |
| **High Input Range** | 400154 | `0x0099` | *(Analog Input)* Batas atas rentang input analog. | `1000` |
| **Scale Decimal Point** | 400155 | `0x009A` | *(Analog Input)* Posisi titik desimal skala.<br>`0`: 0, `1`: 0.0, `2`: 0.00, `3`: 0.000 | `1` (0.0) |
| **Low Scale** | 400156 | `0x009B` | *(Analog Input)* Nilai skala batas bawah.<br>`-1999` hingga `9999` | `0` |
| **High Scale** | 400157 | `0x009C` | *(Analog Input)* Nilai skala batas atas.<br>`-1999` hingga `9999` | `1000` |
| **Display Unit Lamp** | 400158 | `0x009D` | *(Analog Input)* Lampu indikator satuan.<br>`0`: ℃, `1`: ℉, `2`: %, `3`: OFF | `2` (%) |
| **Input Bias** | 400159 | `0x009E` | Kompensasi / Koreksi nilai input (kalibrasi).<br>Rentang tanpa desimal: `-999` hingga `999`<br>Dengan 1 desimal: `-1999` hingga `9999` | `0` |
| **Input Digital Filter** | 400160 | `0x009F` | Filter digital (Moving average) untuk meredam *noise* pembacaan sensor.<br>`1` hingga `1200` (Merepresentasikan `0.1` hingga `120.0` detik) | `1` (0.1s) |
| **SV Low Limit** | 400161 | `0x00A0` | Batas bawah Set Value (Target Suhu) yang diizinkan untuk diatur oleh user. | `-200` |
| **SV High Limit** | 400162 | `0x00A1` | Batas atas Set Value (Target Suhu) yang diizinkan untuk diatur oleh user. | `1350` |
| **Analog Output1 Mode** | 400163 | `0x00A2` | Mode transmisi analog out.<br>`0`: PV, `1`: SV, `2`: H-MV, `3`: C-MV | `0` (PV) |
| **Analog Output Range** | 400164 | `0x00A3` | Rentang arus transmisi analog out.<br>`0`: 4-20 mA, `1`: 0-20 mA | `0` (4-20) |
| **Low Out1 Scale** | 400165 | `0x00A4` | Nilai referensi batas bawah (0mA/4mA) output transmisi. | `-200` |
| **High Out1 Scale** | 400166 | `0x00A5` | Nilai referensi batas atas (20mA) output transmisi. | `1350` |
| **Reserved** | 400167-400200 | - | - | - |

---

## Tabel Tipe Sensor dan Rentang

Tabel ini digunakan untuk mengisi nilai register **Input Type (400151)**. Jika Anda memiliki Thermocouple Tipe K dengan 1 angka desimal, Anda harus menulis nilai `1` ke register tersebut.

| Nilai (Value) | Tipe Input | Desimal | Tampilan Layar | Rentang Suhu (℃) | Rentang Suhu (℉) |
|:---:|---|:---:|---|---|---|
| **0** | K (CA) | 1 | `KCaH` | -200 ~ 1,350 | -328 ~ 2,462 |
| **1** | K (CA) | 0.1 | `KCaL` | -199.9 ~ 999.9 | -199.9 ~ 999.9 |
| **2** | J (IC) | 1 | `JIcH` | -200 ~ 800 | -328 ~ 1,472 |
| **3** | J (IC) | 0.1 | `JIcL` | -199.9 ~ 800.0 | -199.9 ~ 999.9 |
| **4** | E (CR) | 1 | `ECrH` | -200 ~ 800 | -328 ~ 1,472 |
| **5** | E (CR) | 0.1 | `ECrL` | -199.9 ~ 800.0 | -199.9 ~ 999.9 |
| **6** | T (CC) | 1 | `TCcH` | -200 ~ 400 | -328 ~ 752 |
| **7** | T (CC) | 0.1 | `TCcL` | -199.9 ~ 400.0 | -199.9 ~ 752.0 |
| **8** | B (PR) | 1 | `b PR` | 0 ~ 1,800 | 32 ~ 3,272 |
| **9** | R (PR) | 1 | `R PR` | 0 ~ 1,750 | 32 ~ 3,182 |
| **10** | S (PR) | 1 | `S PR` | 0 ~ 1,750 | 32 ~ 3,182 |
| **11** | N (NN) | 1 | `N NN` | -200 ~ 1,300 | -328 ~ 2,372 |
| **12** | C (TT) | 1 | `C tt` | 0 ~ 2,300 | 32 ~ 4,172 |
| **13** | G (TT) | 1 | `G tt` | 0 ~ 2,300 | 32 ~ 4,172 |
| **14** | L (IC) | 1 | `LIcH` | -200 ~ 900 | -328 ~ 1,652 |
| **15** | L (IC) | 0.1 | `LIcL` | -199.9 ~ 900.0 | -199.9 ~ 999.9 |
| **16** | U (CC) | 1 | `UCcH` | -200 ~ 400 | -328 ~ 752 |
| **17** | U (CC) | 0.1 | `UCcL` | -199.9 ~ 400.0 | -199.9 ~ 752.0 |
| **18** | Platinel II | 1 | `PLII` | 0 ~ 1,390 | 32 ~ 2,534 |
| **19** | L (RUS) | 1 | `L r.H`| -200 ~ 800 | -328 ~ 1,472 |
| **20** | L (RUS) | 0.1 | `L r.L`| -199.9 ~ 800.0 | -199.9 ~ 999.9 |
| **21** | Cu50 Ω | 0.1 | `CU 5` | -199.9 ~ 200.0 | -199.9 ~ 392.0 |
| **22** | Cu100 Ω | 0.1 | `CU10` | -199.9 ~ 200.0 | -199.9 ~ 392.0 |
| **23** | JPt100 Ω | 1 | `JPt.H`| -200 ~ 650 | -328 ~ 1,202 |
| **24** | JPt100 Ω | 0.1 | `JPt.L`| -199.9 ~ 650.0 | -199.9 ~ 999.9 |
| **25** | DPt50 Ω | 0.1 | `dPt5` | -199.9 ~ 600.0 | -199.9 ~ 999.9 |
| **26** | DPt100 Ω | 1 | `dPt.H`| -200 ~ 650 | -328 ~ 1,202 |
| **27** | DPt100 Ω | 0.1 | `dPt.L`| -199.9 ~ 650.0 | -199.9 ~ 999.9 |
| **28** | Nickel120 Ω | 1 | `NI 12`| -80 ~ 260 | -112 ~ 500 |
| **29** | 0 ~ 10 V | Set desimal | `AV 1` | \- | \- |
| **30** | 0 ~ 5 V | Set desimal | `AV 2` | \- | \- |
| **31** | 1 ~ 5 V | Set desimal | `AV 3` | \- | \- |
| **32** | 0 ~ 100 mV | Set desimal | `AMV1` | \- | \- |
| **33** | 0 ~ 20 mA | Set desimal | `AMA1` | \- | \- |
| **34** | 4 ~ 20 mA | Set desimal | `AMA2` | \- | \- |

> [!WARNING]
> Ketika Anda mengubah tipe input sensor (misal dari KCA.H ke RTD PT100), beberapa parameter yang terkait (seperti `SV Low Limit` dan `SV High Limit`) mungkin akan otomatis tereset oleh perangkat sesuai dengan batas aman sensor yang baru. Selalu periksa kembali parameter operasional Anda setelah mengganti tipe input.
