# Tutorial Pin Test TN Series — Panduan Praktis

**Tujuan:** mengetes pin/port (OUT1, OUT2, AL1–AL6) pada kontroler suhu Autonics TN (TNS/TNH/TNL)
dengan LED box, lewat komputer (tanpa ESP).

**Ada 2 cara menjalankan test:**
1. **Cara WEB (paling mudah)** — klik-klik di browser → `tn_test_web.py`
2. **Cara CLI (teknis)** — ketik perintah di terminal → `tn_pin_test.py`

---

## 0. Sekilas Cara Kerja (baca ini dulu, 1 menit)

```
PC ──usb──▶ RS485 Converter ──kabel A/B──▶ Kontroler TN ──kabel output──▶ LED Box
  │                                           │
  └─ kirim perintah "nyalakan OUT1" via Modbus ┘
                                                ▼
                              LED di box menyala → teknisi jawab "YA/NYA" → hasil dicatat
```

- **Kontroler TN** = otak yang dites (TNS/TNH/TNL)
- **RS485 Converter** = alat kecil USB yang membuat PC bisa "ngobrol" dengan TN
- **LED Box** = kotak berisi 8 lampu LED + terminal, dipasang ke pin output TN

> Sebelum mulai, pastikan: TN **belum dipasang** ke mesin (test di meja), dan TN dalam kondisi **STOP** (bukan RUN).

---

## 1. Siapkan Hardware

### Yang perlu disiapkan

| No | Bahan | Jumlah | Keterangan |
|---|---|---|---|
| 1 | LED Box (kanal OUT1, OUT2, AL1–AL6) | 1 | Rakit sesuai `format.md` bagian 3 |
| 2 | USB-RS485 Converter | 1 | Tipe half duplex, ada skrup A dan B |
| 3 | Kabel twisted pair | 1 rol | Kabel serabut 2 inti |
| 4 | PC + Python | 1 | Windows / Linux / Mac |
| 5 | Kontroler TN yang mau dites | 1 | TNS / TNH / TNL |

### Instal Python (sekali saja)

Buka **Command Prompt** (ketik `cmd` di Start Menu), lalu jalankan:

```
pip install -r scripts\requirements.txt
```

Tunggu sampai selesai (muncul tulisan *Successfully installed*).

---

## 2. Rangkai Kabel (Wiring)

> ⚠️ **Matikan daya TN dulu** sebelum memasang kabel!

Peta terminal penting (dari `format.md`):

| Fungsi | TNS (kecil) | TNH (sedang) | TNL (besar) |
|---|---|---|---|
| OUT1 | 1–2 | 3–4 | 3–4 |
| OUT2 | 3–4 | 5–6 | 5–6 |
| AL1 | 13–14 | 7–8 | 7–8 |
| AL2 | 15–16 | 9–10 | 9–10 |
| AL3 | — | 15–16 | (sesuai model) |
| AL4 | — | 17–18 | (sesuai model) |
| Power | 5–6 | 11–12 | 11–12 |
| RS485 A+ | skrup A | 13 | 14 |
| RS485 B- | skrup B | 14 | 13 |

**Urutan rangkai (contoh TNL):**

```
Langkah 1: TN pin 7-8  ───► LED Box kanal AL1
Langkah 2: TN pin 9-10 ───► LED Box kanal AL2
Langkah 3: TN pin 3-4  ───► LED Box kanal OUT1
Langkah 4: TN pin 5-6  ───► LED Box kanal OUT2
Langkah 5: TN pin 14 (A+) ─► Converter skrup A
Langkah 6: TN pin 13 (B-) ─► Converter skrup B
Langkah 7: Converter ──usb──► PC
Langkah 8: TN pin 11-12 ──► Listrik 220V (daya TN)
```

> Pakai kabel twisted pair (dua inti dipilin) untuk RS485. Jangan dekatkan kabel RS485 dengan kabel listrik.

---

## 3. Cara TERMUDAH — Test lewat Browser (Web UI)

### 3.1 Jalankan web test

Buka Command Prompt di folder proyek, jalankan:

```
python scripts\tn_test_web.py --com COM3
```

> Ganti `COM3` nanti dengan port yang benar — lihat langkah 3.2.
> Kalau muncul pesan `TN Test Bench: http://127.0.0.1:8081` berarti sukses.

### 3.2 Cek COM port beneran

Buka **Device Manager** di Windows (klik kanan tombol Start → Device Manager).
Cari bagian **Ports (COM & LPT)**, lihat nama kom, misal `USB Serial Port (COM5)`.

- Kalau tidak muncul → driver converter belum terpasang. Install driver (CH340/FTDI sesuai merek), colok ulang.
- Kalau muncul `COM5`, ganti `--com COM3` jadi `--com COM5`.

### 3.3 Buka browser & tes

1. Buka Google Chrome/Edge, ketik alamat: `http://127.0.0.1:8081`
2. Atur **COM port** di dropdown (pilih dari daftar yang muncul otomatis)
3. Atur model: pilih `tnl` / `tnh` / `tns` sesuai TN yang kamu punya
4. Atur jumlah alarm (`n_alarm`): `2` untuk TNS, `4` untuk TNH, `6` untuk TNL
5. Klik tombol **Test Koneksi** 👉 harus muncul `SV=...` hijau. Kalau merah, lihat troubleshooting bagian 6.
6. Klik tombol **OUT1** → lihat LED box kanal OUT1, harus nyala ~2 detik lalu mati sendiri.
7. Klik **OUT2**, lalu **Sweep AL** untuk tes semua alarm berurutan.

**Cara baca hasil di layar:**

| Warna | Arti |
|---|---|
| 🟢 hijau `pass` | Kanal OK — LED menyala sesuai perintah |
| 🔴 merah `fail` | Ada masalah — cek bagian 6 |

Setiap hasil langsung tercatat di layar: `OUT1 (3-4) status=True` artinya OUT1 di pin 3–4 hidup normal.

### 3.4 Selesai

Tutup saja window Command Prompt (atau tekan `Ctrl+C`) untuk menghentikan web test.
TN otomatis dikembalikan ke posisi STOP.

---

## 4. Cara CLI — Test lewat Terminal

### 4.1 Coba dulu tanpa hardware (dry-run)

Pastikan perintah berjalan benar sebelum pasang TN:

```
python scripts\tn_pin_test.py --model tnl --slave 1 --dry-run
```

Harusnya muncul semua kanal `PASS` (ini simulasi, bukan test beneran).

### 4.2 Jalankan test beneran

```
python scripts\tn_pin_test.py --port COM3 --model tnl --slave 1 --n-alarm 6

python scripts\tn_pin_test.py --port COM3 --model tnh --slave 1 --n-alarm 4

python scripts\tn_pin_test.py --port COM3 --model tns --slave 1 --n-alarm 2
```

Pilih salah satu sesuai model. `--slave 1` = nomor alamat TN di panel (cocokkan dengan setting TN).

### 4.3 Saat test berjalan

```
[OUT1] Control Output 1 (Heater) (terminal 3-4)
  LED [OUT1] menyala? (Y/n): y     ← lihat LED box! nyala? ketik y lalu Enter
[OUT2] Control Output 2 (Cooler) (terminal 3-4)
  LED [OUT2] menyala? (Y/n): n     ← LED mati? ketik n lalu Enter
```

- `y` atau Enter saja → **PASS**
- `n` → **FAIL** (dicatat, jangan panik, lanjut kanal berikut)
- `Ctrl+C` → batalkan test

### 4.4 Hasil

Buka file `tn_pin_test_report.md` di folder proyek:

| Kanal | Terminal | Fungsi | Hasil |
|---|---|---|---|
| OUT1 | 3-4 | Control Output 1 (Heater) | PASS |
| AL2 | 9-10 | Alarm Output 2 | FAIL |
| AL3 | 15-16 | Alarm Output 3 | PASS |

**Ringkasan:** 7/8 PASS ← intinya di baris ini!

---

## 5. Arti Hasil Test

| Hasil | Artinya | Yang harus dilakukan |
|---|---|---|
| **PASS** | Pin bagus — perintah nyala, LED ikut nyala | Tidak ada — lanjut |
| **FAIL** | LED tidak menyala walau TN bilang output ON | Cek relay di dalam TN rusak? Atau kabel dari TN ke LED Box salah pasang? |
| **COMM FAIL** | PC tidak bisa ngobrol sama TN (RS485 bermasalah) | Kabel A/B terbalik? Port COM salah? Baud salah? |
| **ABORT** | Test dibatalkan (Ctrl+C) | Ulangi dari awal |

---

## 6. Troubleshooting (Kalau Ada Masalah)

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| 💻 "Tidak bisa konek ke port" | Port COM salah | Cek Device Manager, pilih port yang benar |
| ⏱️ Timeout / COMM FAIL | Kabel A dan B terbalik | **Tukar** kabel A+ ↔ B- (paling sering ini!) |
| ⏱️ Timeout terus | Setting komunikasi TN beda | Cocokkan `--baud --parity --stopbits` dengan setting di TN (default: `9600 N 2`) |
| 🔴 AL semua gagal | `n_alarm` kepilih lebih besar dari kapasitas model | TNS = 2, TNH = 4, TNL = 6 |
| 🔴 OUT tidak nyala | TN tipe current output, bukan relay/SSR | Cek tipe model di badan TN (huruf R = relay, S = SSR, C = current) |
| 🔴 LED box tidak nyala sama sekali | Baterai/resistor LED salah | Cek rangkain LED box di `format.md` bagian 3 |
| 📄 Report tidak muncul | Folder tidak boleh ditulis | Pindah lokasi, jalankan ulang dari folder dengan izin tulis |

**Tips penting:**
- Cek koneksi dulu dengan tombol **Test Koneksi** sebelum tes pin — ini memastikan RS485 jelas jalan.
- Tes ulang paling cepat: matikan daya TN 5 detik, nyalakan lagi, ulangi test.

---

## 7. Daftar Perintah (Cheat Sheet)

### Web UI

```
python scripts\tn_test_web.py --com COM3
```

### CLI

```bash
# dry-run (latihan, tanpa hardware)
python scripts/tn_pin_test.py --model tnl --dry-run

# TNL 6 alarm
python scripts/tn_pin_test.py --port COM3 --model tnl --slave 1 --n-alarm 6

# TNH 4 alarm
python scripts/tn_pin_test.py --port COM3 --model tnh --slave 1 --n-alarm 4

# TNS 2 alarm
python scripts/tn_pin_test.py --port COM3 --model tns --slave 1 --n-alarm 2
```

| Opsi | Fungsinya | Contoh |
|---|---|---|
| `--port` | COM port | `--port COM3` |
| `--model` | Model TN | `--model tnl` |
| `--slave` | Alamat TN (1–99) | `--slave 1` |
| `--baud` | Kecepatan (default 9600) | `--baud 115200` |
| `--n-alarm` | Jumlah alarm | `--n-alarm 4` |
| `--dry-run` | Latihan tanpa hardware | (tanpa nilai) |

---

## 8. Keselamatan (WAJIB BACA)

- ✅ Test hanya untuk TN **yang belum terpasang** — script mengubah parameter alarm & mode Manual TN.
- ✅ **Putuskan heater/beban** sebelum test — output relay bisa menyala selama tes.
- ✅ Matikan daya TN sebelum pasang/lepas kabel.
- ❌ Jangan pegang kabel terminal saat TN menyala.
- ✅ Setelah test, TN otomatis dikembalikan ke STOP — tapi periksa ulang dengan mata kepala sendiri.