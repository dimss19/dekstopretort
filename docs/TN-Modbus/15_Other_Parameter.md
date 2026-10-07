# Other Parameter Group & Masking Address

Grup ini mencakup pengaturan sistem lain-lain (*miscellaneous*) pada Autonics TN Series, seperti inisialisasi awal saat dinyalakan (Power ON), fungsi input digital (Digital Input), perlindungan password, fungsi tombol pintas (Shortcut), serta fitur *Masking Address* (menyembunyikan parameter di layar).

- **Function Code:** `03` (Read), `06` (Write Single), `16` (Write Multiple)
- **Rentang Address (Other):** `400701` hingga `400750`
- **Rentang Address (Masking):** `401001` hingga `401021`
- **Tipe Data Utama:** INT16

---

## 1. Pengaturan Saat Dinyalakan (Power ON) & Output Error

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Power ON, Run/Stop** | 400701 | `0x02BC` | Status operasi awal saat alat pertama kali dinyalakan.<br>`0`: RUN, `1`: STOP | `1` (STOP) |
| **Alarm Out, Control Output** | 400702 | `0x02BD` | Tindakan terhadap kontrol output saat alarm berbunyi.<br>`0`: CONT (Lanjut normal), `1`: OFF (Output mati) | `0` (CONT) |
| **Initial Manual MV** | 400703 | `0x02BE` | Referensi awal Manual MV saat alat dipindah ke mode manual.<br>`0`: AUTO (Ikuti perhitungan terakhir PID)<br>`1`: PrMV (Gunakan Preset Manual MV) | `0` (AUTO) |
| **Preset Manual MV** | 400704 | `0x02BF` | Nilai awal Manual MV jika `Initial Manual MV` = PrMV.<br>Rentang: `-100.0` hingga `100.0 %` | `000.0` |
| **Error MV** | 400705 | `0x02C0` | Nilai output (MV) yang dikeluarkan jika terjadi Error Sensor (SBA).<br>Rentang: `-100.0` hingga `100.0 %` | `000.0` |
| **Stop MV** | 400706 | `0x02C1` | Nilai output saat perangkat dalam status STOP.<br>Rentang: `-100.0` hingga `100.0 %` | `000.0` |
| **Stop AlarmOut** | 400707 | `0x02C2` | Perilaku output alarm saat status alat STOP.<br>`0`: CONT, `1`: OFF | `0` (CONT) |
| **Open AlarmOut** | 400708 | `0x02C3` | Perilaku High-Limit Alarm saat Error Sensor.<br>`0`: CONT, `1`: OFF | `0` (CONT) |

---

## 2. Pengaturan Soft Start (Pemanasan Perlahan)

Soft start digunakan untuk membatasi output MV ke nilai tertentu selama durasi awal mesin dinyalakan, agar suhu tidak "kaget" atau naik terlalu cepat.

| Nama Parameter | Address | Hex | Deskripsi | Default |
|---|---|---|---|---|
| **SoftStart_TIME** | 400709 | `0x02C4` | Durasi Soft Start beroperasi (`0` hingga `9999`) | `0` |
| **SoftStart_TIME_UNIT** | 400710 | `0x02C5` | Satuan waktu Soft Start.<br>`0`: Detik, `1`: Menit, `2`: Jam | `0` (Sec) |
| **SoftStart_TIME_MV** | 400711 | `0x02C6` | Batas maksimum Output MV selama Soft Start.<br>`0` hingga `1000` (`0.0 - 100.0 %`) | `0` |

---

## 3. Fungsi Digital Input (DI-1 hingga DI-6)

Alat ini memiliki 6 terminal input digital (jika perangkat keras mendukung) yang bisa dipicu secara eksternal (misalnya melalui sakelar mekanis atau PLC). Anda dapat menetapkan fungsinya menggunakan tabel di bawah.

| Terminal | Address | Hex | Default | Terminal | Address | Hex | Default |
|---|---|---|---|---|---|---|---|
| **DI-1** | 400713 | `0x02C8` | `0` | **DI-4** | 400716 | `0x02CB` | `0` |
| **DI-2** | 400714 | `0x02C9` | `0` | **DI-5** | 400717 | `0x02CC` | `0` |
| **DI-3** | 400715 | `0x02CA` | `0` | **DI-6** | 400718 | `0x02CD` | `0` |

**Tabel Fungsi Digital Input:**

| Value | Fungsi | Deskripsi |
|:---:|---|---|
| `0` | **OFF** | Tidak ada fungsi (DI diabaikan) |
| `1` | **STOP** | Mengubah alat menjadi STOP / RUN |
| `2` | **PAUS** | Menahan nilai SV saat ini (Pause) |
| `3` | **AL.RE** | Reset semua output alarm (Alarm Reset) |
| `4` | **A/M** | Pindah mode Auto / Manual |
| `5` | **AT** | Memulai / Mematikan Auto-Tuning |
| `6` | **MT.SV** | Pindah Mode Multi SV *(Hanya mendukung DI-1 dan DI-2)* |

---

## 4. Keamanan & Konfigurasi Shortcut (Front Panel)

Parameter ini mengatur keamanan (kunci sandi) serta apa yang terjadi ketika tombol fisik di panel depan ditekan (Tombol `U` dan kombinasinya).

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **User Switch Setting** | 400719 | `0x02CE` | Menekan tombol `U` akan pindah ke grup parameter apa. |
| **Shortcut Setting 1** | 400720 | `0x02CF` | Fungsi kombinasi `U + ◀` (Default: `3` AL.RE) |
| **Shortcut Setting 2** | 400721 | `0x02D0` | Fungsi kombinasi `U + ▼` (Default: `0` OFF) |
| **Shortcut Setting 3** | 400722 | `0x02D1` | Fungsi kombinasi `U + ▲` (Default: `0` OFF) |
| **User Level** | 400723 | `0x02D2` | Tingkat pengguna.<br>`0`: STND (Standar), `1`: HIGH (Ahli/Tingkat Lanjut) |
| **Password Setting** | 400724 | `0x02DD` | Atur Password.<br>`0000`: Bebas Akses<br>`0001`: Read Only (Hanya bisa baca)<br>`0002 - 9999`: Password untuk mengubah parameter |
| **Lock Parameter All** | 400725 | `0x02DE` | Mengunci seluruh tombol di panel depan.<br>`0`: OFF (Tidak terkunci), `1`: ON (Terkunci) |
| **Parameter Initialize** | 400726 | `0x02DF` | Reset ke pengaturan pabrik (Factory Reset).<br>`0`: NO, `1`: YES |

---

## 5. Masking Address (Menyembunyikan Parameter di Layar)

Fitur Masking Address digunakan untuk menyembunyikan parameter tertentu agar tidak muncul saat pengguna menavigasi menu melalui layar/panel depan (Display). Pengaturan ini diatur melalui **Bit Masking**.

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **ONE_TIME_DOWN** | 401001 | `0x03E8` | Password *Bit mask setting*: Tulis `1075` untuk mengakses Masking<br>Password *Batch download*: Tulis `1076` |
| **BIT_MASK_1** | 401002 | `0x03E9` | (16-bit word) Masking untuk parameter Monitoring 1 |
| **BIT_MASK_2** | 401003 | `0x03EA` | (16-bit word) Masking untuk parameter Monitoring 2 |
| **BIT_MASK_n** | ... | ... | ... berlanjut hingga `BIT_MASK_18` (Address `401019`) |

> [!CAUTION]
> Jangan mengubah **BIT_MASK** kecuali Anda tahu persis bit mana yang merepresentasikan parameter di layar, karena kesalahan pengisian dapat membuat parameter penting tidak bisa diakses sama sekali oleh operator dari layar perangkat. Biasakan menggunakan *software* PC Autonics DAQMaster jika ingin mengubah *masking display*.
