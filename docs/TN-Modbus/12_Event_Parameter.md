# Event Parameter Group

Grup parameter ini mengelola kondisi (Event) yang dapat memicu alarm atau sinyal output eksternal. Anda dapat mengkonfigurasi hingga **10 Event (Event 0 hingga Event 9)**. Setiap Event bisa dikaitkan dengan satu mode operasi (misal: Alarm suhu berlebih, sensor putus, atau status perangkat).

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400451` hingga `400550`
- **Tipe Data Utama:** INT16

---

## 1. Pengaturan Event Utama

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Event Setting** | 400451 | `0x01C2` | Menentukan Event mana (Event 0 - 9) yang ingin disetel konfigurasinya secara manual jika diatur via *front panel* alat. | `0` (EV.0) |

> [!NOTE]
> Pada komunikasi Modbus, Anda tidak perlu repot mengubah register `400451` terlebih dahulu. Anda bisa langsung menulis/membaca ke address register Event spesifik yang dijabarkan di bawah.

---

## 2. Struktur Register Tiap Event (Event 0 - Event 9)

Setiap Event memiliki **8 register parameter** yang saling berurutan. Format dan kegunaannya identik, hanya address awalnya yang berbeda.

### Alamat Dasar Tiap Event

| Event | Rentang Address | Event | Rentang Address |
|:---:|---|:---:|---|
| **Event 0** | `400452` - `400459` | **Event 5** | `400492` - `400499` |
| **Event 1** | `400460` - `400467` | **Event 6** | `400500` - `400507` |
| **Event 2** | `400468` - `400475` | **Event 7** | `400508` - `400515` |
| **Event 3** | `400476` - `400483` | **Event 8** | `400516` - `400523` |
| **Event 4** | `400484` - `400491` | **Event 9** | `400524` - `400531` |

*(Register `400532` hingga `400550` adalah Reserved / Kosong)*

---

### Daftar Parameter per Event

Berikut adalah parameter di dalam setiap Event. Sebagai contoh, alamat di bawah ini menggunakan **Event 0**. Untuk Event 1, tambahkan `+8` pada address, dan seterusnya.

| Nama Parameter | Address | Range & Deskripsi | Default |
|---|---|---|---|
| **Alarm Mode.n** | 400452 | Mode/jenis operasi Event. <br>Lihat **Tabel Alarm Operation Mode** di bawah. | `1` (DV[[) |
| **Alarm_Low.n** | 400453 | Batas bawah untuk memicu alarm.<br>Untuk *Deviation*: `-F.S` hingga `F.S`<br>Untuk *Absolute*: Dalam rentang tampilan PV. | `1550` |
| **Alarm_High.n** | 400454 | Batas atas untuk memicu alarm.<br>Untuk *Deviation*: `-F.S` hingga `F.S`<br>Untuk *Absolute*: Dalam rentang tampilan PV. | `1550` |
| **Alarm_Hysteresis.n** | 400455 | Histeresis (selisih suhu saat ON dan OFF) untuk mencegah alarm berkedip/flicker.<br>`1` hingga `100` digit | `1` |
| **LBA Time.n** | 400456 | Waktu pemantauan Loop Break Alarm (LBA).<br>`0` hingga `9999` Detik | `0` |
| **LBA Band.n** | 400457 | Batas deteksi LBA (Suhu tidak naik walau heater 100%). | Temp H: `2` |
| **Pattern Alarm Position.n**| 400458 | *(Mode Pattern)* Kapan event ini aktif.<br>`0-9`: PTN.0-PTN.9 / ALL<br>`0-19`: ST.0-ST.19 / ALL | `ALL` |
| **Alarm Output Connection.n**| 400459 | Relasi (Mapping) ke output alarm fisik mana event ini akan diteruskan.<br>`0`: OFF, `1`: AL.1, `2`: AL.2, `3`: AL.3, `4`: AL.4, `5`: AL.5, `6`: AL.6, `7`: AL.7 | `1` (AL.1) |

---

## Tabel Alarm Operation Mode

Tabel ini digunakan untuk mengatur jenis perilaku Alarm yang dimasukkan ke register **Alarm Mode.n**.

| Nilai (Value) | Mode / Singkatan | Deskripsi Mode Alarm / Event |
|:---:|---|---|
| `0` | OFF | Tidak digunakan (*Disabled*) |
| `1` | DV[[ | Alarm *High-limit* berdasarkan penyimpangan dari SV (Deviation) |
| `2` | ]]DV | Alarm *Low-limit* berdasarkan penyimpangan dari SV (Deviation) |
| `3` | ]DV[ | Alarm *High/Low limit* (di atas dan di bawah SV) |
| `4` | [DV] | Alarm *Reverse High/Low limit* (Aman jika di luar batas) |
| `5` | PV[[ | Alarm *High-limit* berdasarkan Suhu Mutlak / Absolut (PV) |
| `6` | ]]PV | Alarm *Low-limit* berdasarkan Suhu Mutlak / Absolut (PV) |
| `7` | LBA | Loop Break Alarm (Sensor rusak atau SSR rusak, suhu tidak berubah saat output jalan penuh) |
| `8` | SBA | Sensor Break Alarm (Kabel sensor putus) |
| `9` | HBA1 | Heater Break Alarm (CT1 mendeteksi arus putus) |
| `10` | HBA2 | Heater Break Alarm (CT2 mendeteksi arus putus) |
| `11` | RUN | Sinyal aktif saat perangkat dalam status RUN |
| `12` | STOP | Sinyal aktif saat perangkat dalam status STOP |
| `13` | PAUS | Sinyal aktif saat alat / pattern di-PAUSE |
| `14` | P.ST | *(Pattern)* Menyala saat Pola / Pattern dimulai |
| `15` | P.END | *(Pattern)* Menyala saat Pola / Pattern selesai |
| `16` | P.OT | *(Pattern)* Menyala saat memasuki titik delay (Pattern delay point) |
| `17` | S.ST | *(Pattern)* Menyala saat sebuah *Step* dimulai |
| `18` | S.END | *(Pattern)* Menyala saat sebuah *Step* selesai |
| `19` | S.OT | *(Pattern)* Menyala saat memasuki titik delay dari *Step* |
