# FORMAT.md — Pin/Port Test Autonics TN Series (TNS / TNH / TNL)

Panduan peta pin, fungsi terminal, wiring LED box, dan prosedur test pin/port berbasis LED.
Universal untuk ketiga ukuran fisik TN: TNS (48×48), TNH (48×96), TNL (96×96).

> **Aturan emas:** nomor terminal TIDAK pernah sama antar seri. Selalu cocokkan dengan tabel per versi di bawah.

---

## 1. Peta Pin per Seri

### TNS (48×48 mm)

| Terminal | Fungsi | Keterangan |
|---:|---|---|
| 1–2 | Control OUT1 | Output kontrol 1 (Relay / SSR / Current) |
| 3–4 | Control OUT2 | Output kontrol 2 (Relay / SSR / Current) |
| 5–6 | Power | 100–240 VAC |
| 13–14 | AL1 | Alarm output 1 (Relay NO: 250 VAC 3 A) |
| 15–16 | AL2 | Alarm output 2 |
| 17–18 | CT | Input Current Transformer (HBA) |
| RS485(A+) / RS485(B-) | Komunikasi | Modbus RTU/ASCII |
| — | Transmission output | 4–20 mA (model tertentu) |
| — | Sensor input | Thermocouple / RTD |
| — | Digital input | DI-1 s/d DI-6 (model tertentu) |

### TNH (48×96 mm) — 24 terminal

| Terminal | Fungsi | Keterangan |
|---:|---|---|
| 1–2 | CT1 | Input Current Transformer 1 (HBA) |
| 3–4 | Control OUT1 | Output kontrol 1 |
| 5–6 | Control OUT2 | Output kontrol 2 |
| 7–8 | AL1 | Alarm output 1 |
| 9–10 | AL2 | Alarm output 2 |
| 11–12 | Power | 100–240 VAC |
| 13 | RS485(A+) | Komunikasi |
| 14 | RS485(B-) | Komunikasi |
| 15–16 | AL3 | Alarm output 3 |
| 17–18 | AL4 / Trans. OUT | AL4 (relay) atau Transmission output 4–20 mA, tergantung opsi model |
| 19–20 | CT2 | Input Current Transformer 2 / DI, tergantung opsi model |
| 21–23 | Digital IN DI-1/2/3 | Input digital (model tertentu) |
| 24 | B' | Sensor B' (RTD/TC sensing) |
| — | Sensor input | Thermocouple / RTD |
| — | Front loader port | Koneksi DAQMaster (TNH/TNL) |

### TNL (96×96 mm)

| Terminal | Fungsi | Keterangan |
|---:|---|---|
| 3–4 | Control OUT1 | Output kontrol 1 |
| 5–6 | Control OUT2 | Output kontrol 2 |
| 7–8 | AL1 | Alarm output 1 |
| 9–10 | AL2 | Alarm output 2 |
| 11–12 | Power | 100–240 VAC |
| 13 | RS485(B-) | Komunikasi |
| 14 | RS485(A+) | Komunikasi |
| 25–26 | Transmission output | 4–20 mA |
| — | AL3 / AL4 / AL5 / AL6 | Model alarm 4/6 |
| — | CT1 / CT2 | Input Current Transformer |
| — | Sensor input | Thermocouple / RTD |
| — | Digital input | DI-1 s/d DI-6 |

---

## 2. Fungsi Tiap Pin (Penjelasan)

| Pin / Kanal | Fungsi | Cara kerja saat test |
|---|---|---|
| **Power (5–6 / 11–12)** | Catu daya 100–240 VAC | Tidak di-test lewat LED box; cukup pastikan display menyala |
| **Control OUT1** | Output kontrol utama (Heater). Relay: kontak NO 250 VAC 3 A; SSR: 12 VDC ±2 V ≤20 mA; Current: 4–20 mA | Toggle via Modbus: RUN + mode Manual + MV Heater → LED1 |
| **Control OUT2** | Output kontrol sekunder (Cooler). Karakteristik sama dengan OUT1 | Toggle via Modbus: RUN + mode Manual + MV Cooler → LED2 |
| **AL1 – AL6** | Output alarm (Relay NO 250 VAC 3 A). Menyala saat kondisi event alarm terpenuhi | Konfigurasi Event alarm absolute-high (batas di bawah PV ruangan) → alarm trip → LED mengikuti |
| **RS485 A+/B-** | Komunikasi serial 2-wire half duplex | Sudah terverifikasi otomatis: script bisa baca/tulis register |
| **CT1 / CT2** | Input arus transformer (deteksi heater putus / HBA) | Tidak di-test (membutuhkan clamp arus) |
| **Transmission output** | Output transmit analog 4–20 mA (≤500 Ω) | Tidak di-test dengan LED box |
| **Sensor input** | Termokopel / RTD / analog input | Tidak di-test dengan LED box |
| **Digital input** | Input digital eksternal (konfigurasi event) | Tidak di-test dengan LED box |

> Lingkup test otomatis (script): **OUT1, OUT2, AL1–AL6** + verifikasi komunikasi RS485.

---

## 3. Wiring LED Box (Universal 8 Kanal)

Setiap kanal LED box = 1 pasang terminal sekrup + rangkaian indikator. Rangkaian yang sama berlaku untuk relay AC (250 VAC) maupun SSR (12 VDC).

```
Terminal TN (OUT/AL) ──┬── Diode Bridge (4× 1N4007) ──┬── LED ──┬── Resistor ── Terminal TN lain
                       └──────────────────────────────┴─────────┴──────────────┘
```

**Skema per kanal:**

- 4× dioda `1N4007` disusun bridge (agar polaritas tetap sama untuk AC maupun DC)
- 1× LED indikator (3–20 mA)
- 1× resistor pembatas arus:
  - Untuk 250 VAC relay: `R = (250 − 2) / 0.01 ≈ 24 kΩ` (0.5 W), pakai ~22–27 kΩ
  - Untuk 12 VDC SSR: `R = (12 − 2) / 0.01 ≈ 1 kΩ` (0.25 W)

> Jika ada 2 sumber tegangan berbeda, pasang resistor per tegangan yang dipakai —
> praktisnya box dibuat untuk **satu model tegangan** per sesi test (sesuai model TN yang diuji).

**BOM 8 kanal:** 32× 1N4007, 8× LED (boleh warna berbeda per kanal), 8× resistor 24 kΩ
(atau 1 kΩ untuk SSR), 8× terminal blok 2 pin, 1× kotak panel, kabel jumper.

**Label kanal:** `OUT1, OUT2, AL1, AL2, AL3, AL4, AL5, AL6` (atau sesuai jumlah alarm model).

---

## 4. Register Modbus yang Digunakan Script Test

| Fungsi | Address | FC | Nilai |
|---|---|---|---|
| RUN / STOP (coil) | `000001` | 05 | `0`=RUN, `1`=STOP |
| Auto/Manual | `400003` | 06 | `1`=MAN (boleh tulis MV) |
| MV Heater (OUT1) | `400004` | 06 | `0`–`1000` (0.0–100.0%) |
| MV Cooler (OUT2) | `400005` | 06 | `0`–`1000` |
| Alarm Mode.n (Event n) | `400452 + 8n` | 06 | `5`=PV[[ (abs high) |
| Alarm High.n | `400454 + 8n` | 06 | batas di bawah PV ruangan (mis. `100`) |
| Alarm Output Connection.n | `400459 + 8n` | 06 | `n`=AL.n |
| Alarm Type.n (output) | `400553 + 5(n−1)` | 06 | `0`=AL-A (standard) |
| Alarm NO/NC.n | `400554 + 5(n−1)` | 06 | `0`=NO |
| OUT1 indicator | `100021` | 02 | verifikasi balik |
| OUT2 indicator | `100022` | 02 | verifikasi balik |
| ALn indicator | `100026 + n` | 02 | verifikasi balik (AL1=100027 … AL6=100032) |

---

## 5. Prosedur Test (Ringkas)

1. Putuskan daya TN. Pasang LED box ke terminal output yang akan dites sesuai peta pin seri (bagian 1).
2. Nyalakan TN, biarkan warm-up >20 menit agar PV akurat (sensor ruangan).
3. Hubungkan PC ke RS485 (A+, B-), pastikan setting komunikasi TN sesuai default (8N2, 9600–115200).
4. Jalankan `tn_pin_test.py` (lihat tutorial eksekusi) dengan argumen model yang benar.
5. Ikuti prompt: tiap kanal dinyalakan 2 detik → jawab `Y` (LED nyala) / `N` (tidak nyala).
6. Laporan otomatis disimpan: `tn_pin_test_report.md`.

---

## 6. Kriteria PASS/FAIL

| Kondisi | Hasil |
|---|---|
| Discrete status = ON saat ditoggle ON, OFF saat ditoggle OFF, LED box sesuai jawaban teknisi | **PASS** |
| Modbus timeout / exception setelah retry | **COMM FAIL** |
| Coil status berubah tapi LED tidak menyala (jawaban N) | **WIRING FAIL** (relay rusak / salah pasang terminal) |
| Tidak ada jawaban (user abort) | **ABORT** |