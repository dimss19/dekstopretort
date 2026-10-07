# PID Group Parameter

Grup parameter ini berisi pengaturan konstanta PID (P, I, dan D) yang dikelompokkan menjadi **8 grup berbeda** (Grup 0 hingga Grup 7). Fitur ini sangat berguna ketika proses memanaskan/mendinginkan memiliki karakteristik termal yang berbeda-beda pada suhu tertentu, atau jika Anda menggunakan mode [Zone PID](07_PID_Control.md) maupun [Pattern Control](09_Pattern_Parameter.md).

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400351` hingga `400450`
- **Tipe Data Utama:** INT16

---

## Memilih PID Group

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **PID Group Number** | 400351 | `0x015E` | Menentukan Grup PID mana yang ingin digunakan secara manual (Jika tidak menggunakan Zone PID).<br>`0`: PID.0 hingga `7`: PID.7 | `0` (PID.0) |

---

## Daftar Parameter Tiap Grup

Masing-masing dari ke-8 grup PID (PID 0 hingga PID 7) memiliki 6 parameter yang identik fungsinya, namun nilainya dapat diatur berbeda. Tiga parameter untuk pemanasan (Heating) dan tiga parameter untuk pendinginan (Cooling).

### Format Rentang Nilai (Sama untuk semua grup)
- **Heating/Cooling Proportional Band**: `000.1` hingga `999.9` (℃/℉/%). Default: `100` (10.0)
- **Heating/Cooling Integral Time**: `0` hingga `9999` Detik. Default: `240`
- **Heating/Cooling Derivative Time**: `0` hingga `9999` Detik. Default: `49`

### PID Grup 0
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **0.Heating P** | 400352 | `0x015F` | **0.Cooling P** | 400355 | `0x0162` |
| **0.Heating I** | 400353 | `0x0160` | **0.Cooling I** | 400356 | `0x0163` |
| **0.Heating D** | 400354 | `0x0161` | **0.Cooling D** | 400357 | `0x0164` |

### PID Grup 1
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **1.Heating P** | 400358 | `0x0165` | **1.Cooling P** | 400361 | `0x0168` |
| **1.Heating I** | 400359 | `0x0166` | **1.Cooling I** | 400362 | `0x0169` |
| **1.Heating D** | 400360 | `0x0167` | **1.Cooling D** | 400363 | `0x016A` |

### PID Grup 2
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **2.Heating P** | 400364 | `0x016B` | **2.Cooling P** | 400367 | `0x016E` |
| **2.Heating I** | 400365 | `0x016C` | **2.Cooling I** | 400368 | `0x016F` |
| **2.Heating D** | 400366 | `0x016D` | **2.Cooling D** | 400369 | `0x0170` |

### PID Grup 3
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **3.Heating P** | 400370 | `0x0171` | **3.Cooling P** | 400373 | `0x0174` |
| **3.Heating I** | 400371 | `0x0172` | **3.Cooling I** | 400374 | `0x0175` |
| **3.Heating D** | 400372 | `0x0173` | **3.Cooling D** | 400375 | `0x0176` |

### PID Grup 4
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **4.Heating P** | 400376 | `0x0177` | **4.Cooling P** | 400379 | `0x017A` |
| **4.Heating I** | 400377 | `0x0178` | **4.Cooling I** | 400380 | `0x017B` |
| **4.Heating D** | 400378 | `0x0179` | **4.Cooling D** | 400381 | `0x017C` |

### PID Grup 5
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **5.Heating P** | 400382 | `0x017D` | **5.Cooling P** | 400385 | `0x0180` |
| **5.Heating I** | 400383 | `0x017E` | **5.Cooling I** | 400386 | `0x0181` |
| **5.Heating D** | 400384 | `0x017F` | **5.Cooling D** | 400387 | `0x0182` |

### PID Grup 6
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **6.Heating P** | 400388 | `0x0183` | **6.Cooling P** | 400391 | `0x0186` |
| **6.Heating I** | 400389 | `0x0184` | **6.Cooling I** | 400392 | `0x0187` |
| **6.Heating D** | 400390 | `0x0185` | **6.Cooling D** | 400393 | `0x0188` |

### PID Grup 7
| Parameter | Address | Hex | Parameter | Address | Hex |
|---|---|---|---|---|---|
| **7.Heating P** | 400394 | `0x0189` | **7.Cooling P** | 400397 | `0x018C` |
| **7.Heating I** | 400395 | `0x018A` | **7.Cooling I** | 400398 | `0x018D` |
| **7.Heating D** | 400396 | `0x018B` | **7.Cooling D** | 400399 | `0x018E` |

- **Reserved**: `400400` hingga `400450` (Kosong)

---

## Kapan Harus Menggunakan Ini?

Jika Anda menggunakan kontrol Fix SV, Anda biasanya hanya perlu memodifikasi parameter PID utama di `400103` - `400108`.

Namun, Anda perlu mengatur register di grup ini apabila:
1. **Menggunakan Multi SV**: Anda ingin agar SV 0 memiliki settingan PID berbeda dengan SV 1. Anda dapat memodifikasi grup PID 0 dan PID 1 di sini, dan mengubah `PID Group Number` via PLC saat Anda beralih SV.
2. **Menggunakan Zone PID**: Saat suhu berpindah zona, alat akan otomatis menarik nilai PID dari grup-grup ini (misal zona 1 menarik PID Grup 1, zona 2 menarik PID Grup 2).
3. **Menggunakan Pattern Control**: Dalam mode PROG, setiap "Pattern" memiliki parameter [Pattern PID Select](09_Pattern_Parameter.md#1-pengaturan-dasar-pattern). Pola yang sedang berjalan akan menggunakan nilai konstanta PID dari grup yang Anda konfigurasikan di halaman ini.
