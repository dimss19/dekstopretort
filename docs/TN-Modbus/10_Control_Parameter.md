# Control Parameter Group

Grup parameter ini berisi pengaturan mendalam mengenai karakteristik output perangkat, jenis kontrol (Pemanasan/Pendinginan), siklus *sampling*, hingga batasan-batasan dan perlindungan (*limit*) untuk nilai MV (Manipulated Value).

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400301` hingga `400350`
- **Tipe Data Utama:** INT16

---

## Daftar Register Control Parameter

### 1. Karakteristik Output & Sampling

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Operating Type** | 400301 | `0x012C` | Menentukan jenis operasi perangkat secara keseluruhan.<br>`0`: HEAT (Pemanasan), `1`: COOL (Pendinginan), `2`: H-C (Heating-Cooling) | `2` (H-C) |
| **Control Method** | 400302 | `0x012D` | Menentukan mode kontrol (Tergantung Operating Type).<br>**Standard Control (HEAT/COOL)**:<br>`0`: PID, `1`: ONOF (ON/OFF Control)<br>**Heating-Cooling Control (H-C)**:<br>`0`: P.P (PID-PID), `1`: P.ON (PID-ONOF), `2`: ON.P (ONOF-PID), `3`: ON.ON (ONOF-ONOF) | `0` (P.P) |
| **Sampling Time** | 400303 | `0x012E` | Kecepatan perangkat membaca data sensor (waktu *sampling*).<br>`0`: 50 ms, `1`: 100 ms, `2`: 250 ms | `0` (50ms) |

### 2. Konfigurasi Output 1 (Heating / Utama)

Parameter ini bergantung pada jenis *hardware* perangkat Anda (apakah mendukung Relay, SSR, atau Current).

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Output1 Type** | 400304 | `0x012F` | Tipe Output 1 jika perangkat mendukung opsi arus/SSR.<br>`0`: SSR, `1`: CURR (Current) | `1` (CURR) |
| **OUT1 SSR Function** | 400305 | `0x0130` | Metode *drive* output SSR 1.<br>`0`: STND (Standard), `1`: CYCL (Cycle control), `2`: PHAS (Phase control) | `0` (STND) |
| **OUT1 Current Range** | 400306 | `0x0131` | Rentang Output Arus 1.<br>`0`: 4-20 mA, `1`: 0-20 mA | `0` (4-20) |
| **Heating_Control Time** | 400310 | `0x0135` | Siklus kontrol Pemanasan.<br>Untuk Relay / SSRP: `000.1` hingga `120.0` Detik<br>Untuk Current output SSR: `001.0` hingga `120.0` Detik | Relay: `200` (20.0)<br>SSR: `20` (2.0) |

### 3. Konfigurasi Output 2 (Cooling / Sub)

*(Hanya relevan untuk model Heating-Cooling (H-C))*

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Output2 Type** | 400307 | `0x0132` | Tipe Output 2.<br>`0`: SSR, `1`: CURR (Current) | `1` (CURR) |
| **OUT2 SSR Function** | 400308 | `0x0133` | Metode *drive* output SSR 2.<br>`0`: STND (Standard), `1`: CYCL (Cycle), `2`: PHAS (Phase) | `0` (STND) |
| **OUT2 Current Range** | 400309 | `0x0134` | Rentang Output Arus 2.<br>`0`: 4-20 mA, `1`: 0-20 mA | `0` (4-20) |
| **Cooling_Control Time** | 400311 | `0x0136` | Siklus kontrol Pendinginan.<br>Untuk Relay / SSRP: `000.1` hingga `120.0` Detik<br>Untuk Current output SSR: `001.0` hingga `120.0` Detik | Relay: `200` (20.0)<br>SSR: `20` (2.0) |

### 4. Parameter Lanjutan (Deadband, Hysteresis & Limit)

| Nama Parameter | Address | Hex | Deskripsi | Default |
|---|---|---|---|---|
| **Dead_Overlap band** | 400312 | `0x0137` | Jarak antara titik aktif Heating dan Cooling pada mode H-C.<br>Suhu: `-999` ~ `999` (atau `-199.9` ~ `999.9` jika desimal)<br>Analog: `-99.9` ~ `99.9` %F.S | `0` |
| **Manual Reset** | 400313 | `0x0138` | Reset manual untuk menghilangkan *offset* *steady-state* pada kontrol P (Proportional) murni.<br>`0` hingga `1000` (`0.0` hingga `100.0 %`) | `500` (50.0%) |
| **Heating_ON Hysteresis**| 400314 | `0x0139` | Histeresis saat Pemanas ON (Untuk kontrol ON/OFF). | `2` |
| **Heating_OFF Offset** | 400315 | `0x013A` | Nilai koreksi penyesuaian untuk titik Pemanas OFF. | `0` |
| **Cooling_ON Hysteresis**| 400316 | `0x013B` | Histeresis saat Pendingin ON (Untuk kontrol ON/OFF). | `2` |
| **Cooling_OFF Offset** | 400317 | `0x013C` | Nilai koreksi penyesuaian untuk titik Pendingin OFF. | `0` |

### 5. MV Limits (Batasan Output)

Melindungi elemen pemanas atau sistem pendingin dengan membatasi presentase keluaran maksimum (MV).

| Nama Parameter | Address | Hex | Range | Default |
|---|---|---|---|---|
| **MV Low Limit** | 400318 | `0x013D` | Standard: `000.0` hingga `(H-MV - 0.1)` %<br>H-C: `-100.0` hingga `000.0` % | `0000` (-1000) |
| **MV High Limit**| 400319 | `0x013E` | Standard: `(L-MV + 0.1)` hingga `100.0` %<br>H-C: `000.0` hingga `100.0` % | `1000` (100.0%) |

### 6. Timer & Ramp

Fungsi *Ramp* digunakan untuk mengatur kecepatan kenaikan/penurunan suhu. Timer digunakan untuk mematikan/menghidupkan alat dalam waktu tertentu.

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Timer Mode** | 400320 | `0x013F` | Mode Timer.<br>`0`: OFF, `1`: T.ON, `2`: T.OFF, `3`: T.ONF, `4`: T.SET | `0` (OFF) |
| **On Time** | 400321 | `0x0140` | Waktu ON Timer (`00.00` hingga `99.59` HH:MM) | `0` |
| **OFF Time** | 400322 | `0x0141` | Waktu OFF Timer (`00.00` hingga `99.59` HH:MM) | `0` |
| **SET Time** | 400323 | `0x0142` | Waktu tunggu Timer / SV SET Time | `0` |
| **Ramp_Up Rate** | 400324 | `0x0143` | Kecepatan kenaikan Set Value.<br>Temp H: `0` hingga `999` digit<br>Temp L: `0` hingga `9999` (`000.0`~`999.9`) | `0` |
| **Ramp_Down Rate** | 400325 | `0x0144` | Kecepatan penurunan Set Value. (Sama seperti Ramp_Up) | `0` |
| **Ramp_Time** | 400326 | `0x0145` | Waktu/satuan hitungan untuk Ramp (contoh: naik X digit per Y detik).<br>`1` hingga `3600` Detik | `60` |

- **Reserved**: `400327` hingga `400350`
