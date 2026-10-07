# PLC Register Map

Dokumen ini menjelaskan tentang pemetaan memori internal pada **PLC Master** saat menggunakan fitur *Ladderless Communication* dengan Autonics TN Series. 

Ketika fitur ini aktif, TN Series akan bertindak layaknya *master* pada level *layer* tertentu yang secara otomatis mentransfer nilainya ke dalam blok memori PLC secara konsekutif (mulai dari register awal yang diatur pada parameter `400612` dan `400613` di [Communication Group](14_Communication.md)). Alamat D00000 di bawah ini bersifat relatif terhadap alamat awal tersebut.

---

## 1. Monitoring Group (Read Only dari sisi PLC)

Grup ini berisi status komunikasi dan data monitoring yang dikirim oleh TN Series **ke** PLC. Data ini diletakkan berurutan di memory D00000 hingga D00019.

| Offset PLC | Nama Parameter | Deskripsi |
|---|---|---|
| **D00000** | Communication State | Status Komunikasi.<br>`0` & `1` (Berulang-ulang): Normal<br>`0` atau `1` (Diam): Error Komunikasi<br>(Error location: 1000 hingga 1037) |
| **D00001** | Set Communication<br>Response state | Status respon pengaturan komunikasi.<br>`0`: Standby<br>`1`: Write Completed<br>`2`: Read Completed<br>`4`: ERROR ON |
| **D00002** | PLC Error code | Kode error Ladderless.<br>`0`: Normal connection<br>`1`: Data R/W error<br>`2`: Timeout error |
| **D00003** | Communication Address | Alamat Unit (Modbus ID) `1` hingga `32` |
| **D00004** | PLC Monitoring Param 0 | Nilai *Read* (Rd.00) dari mapping `400616` |
| **D00005** | PLC Monitoring Param 1 | Nilai *Read* (Rd.01) dari mapping `400617` |
| ... | ... | ... berlanjut hingga ... |
| **D00019** | PLC Monitoring Param 15 | Nilai *Read* (Rd.15) dari mapping `400631` |

> [!NOTE]
> Nilai `Rd.xx` merujuk pada parameter aktual yang telah Anda daftarkan pada **PLC Monitoring 0 - 15**. Lihat referensi [User Parameter Group Setting Range](16_User_Parameter.md#4-user-parameter-group-setting-range-daftar-id-parameter).

---

## 2. Setting Parameter Group (Read/Write dari sisi PLC)

Grup ini digunakan oleh PLC untuk **menulis** (mengirim instruksi) ke TN Series. Agar TN Series memproses nilai yang diletakkan PLC di memori ini, status `Request Flag` dan `Operating Mode` perlu dikelola dengan benar oleh program ladder PLC Anda.

| Offset PLC | Nama Parameter | Deskripsi |
|---|---|---|
| **D00020** | Request Flag | Status permintaan ke TN Series.<br>`0`: Inisialisasi<br>`1`: Write (Tulis data)<br>`2`: Read (Baca data)<br><br>**Mode Continuous Write (0):**<br>- Write Selesai: Flag (1) -> (1)<br>- Read Selesai: Flag (2) -> (1)<br>**Mode Single Write (1):**<br>- Write Selesai: Flag (1) -> (0)<br>- Read Selesai: Flag (2) -> (0) |
| **D00021** | Operating Mode | Mode operasi komunikasi *ladderless*.<br>`0`: Continuous Write (Menulis terus menerus)<br>`1`: Single Write (Menulis sekali saja saat diminta) |
| **D00022** | PLC Setting Param 0 | Nilai *Write* (WR.00) yang akan dikirim ke mapping `400632` |
| **D00023** | PLC Setting Param 1 | Nilai *Write* (WR.01) yang akan dikirim ke mapping `400633` |
| ... | ... | ... berlanjut hingga ... |
| **D00059** | PLC Setting Param 37 | Nilai *Write* (WR.37) yang akan dikirim ke mapping `400669` |

> [!NOTE]
> Sama seperti grup *Read*, Nilai `WR.xx` merujuk pada parameter aktual yang telah Anda daftarkan pada **PLC Write Parameter 0 - 37**.

---

## 3. Peta Memori PLC (Visualisasi Matriks)

Berikut adalah ringkasan letak memori jika dilihat dalam bentuk *word array* berurutan di dalam PLC, dari *Offset* 0 hingga *Offset* 59. Kolom merepresentasikan digit terakhir dari address memori (Contoh D0000**0**, D0000**1**, D000**10**).

| NO (Puluhan) | D0000_ (0-9) | D0001_ (10-19) | D0002_ (20-29) | D0003_ (30-39) | D0004_ (40-49) | D0005_ (50-59) |
|:---:|---|---|---|---|---|---|
| **0** | Comm. status | Rd.06 | Request Flag | WR.08 | WR.18 | WR.28 |
| **1** | Response status| Rd.07 | Operating Mode | WR.09 | WR.19 | WR.29 |
| **2** | Error status | Rd.08 | WR.00 | WR.10 | WR.20 | WR.30 |
| **3** | Address (ID) | Rd.09 | WR.01 | WR.11 | WR.21 | WR.31 |
| **4** | Rd.00 | Rd.10 | WR.02 | WR.12 | WR.22 | WR.32 |
| **5** | Rd.01 | Rd.11 | WR.03 | WR.13 | WR.23 | WR.33 |
| **6** | Rd.02 | Rd.12 | WR.04 | WR.14 | WR.24 | WR.34 |
| **7** | Rd.03 | Rd.13 | WR.05 | WR.15 | WR.25 | WR.35 |
| **8** | Rd.04 | Rd.14 | WR.06 | WR.16 | WR.26 | WR.36 |
| **9** | Rd.05 | Rd.15 | WR.07 | WR.17 | WR.27 | WR.37 |

*(Keterangan: Pada kolom `D0000_` baris ke-4, itu berarti offset **D00004**. Kolom `D0001_` baris ke-0 berarti **D00010**, dan seterusnya).*

---

### Kesimpulan Penggunaan

Fitur ini didesain spesifik untuk integrator sistem yang ingin **menghindari penulisan kode Modbus Master pada program PLC (Ladder Logic)**. Dengan sekadar mengisi register `400612` (Address) dan `400611` (Type) di TN Series, alat ini yang akan "menyuntikkan" atau "membaca" data secara langsung dari register PLC Anda, sehingga Anda hanya perlu memanipulasi register PLC lokal Anda (seperti D000 ~ D059 di Mitsubishi FX) secara langsung.
