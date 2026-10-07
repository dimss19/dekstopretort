# Communication Parameter Group

Grup ini mencakup seluruh pengaturan antarmuka komunikasi RS485 pada Autonics TN Series. Anda harus memastikan bahwa konfigurasi *Baudrate*, *Parity*, *Stop Bit*, dan *Slave Address* di sini **sama persis** dengan yang dikonfigurasi pada program *Master* (seperti ESP32, PLC, atau sistem SCADA). Grup ini juga mengatur konfigurasi khusus jika TN Series terhubung secara *ladderless* (tanpa *coding* manual) langsung ke PLC merek tertentu.

- **Function Code:** `03` (Read), `06` (Write Single), `16` (Write Multiple)
- **Rentang Address:** `400601` hingga `400700`
- **Tipe Data Utama:** INT16

---

## 1. Pengaturan Dasar Serial RS485

Parameter ini sangat krusial. Kegagalan komunikasi `Timeout` atau `CRC Error` paling sering disebabkan oleh ketidakcocokan parameter di bagian ini.

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **RS485 Protocol** | 400601 | `0x0258` | Memilih protokol komunikasi.<br>`0`: Modbus RTU<br>`1`: Modbus ASCII<br>`2`: SYNC (Sinkron antar unit TN)<br>`3`: MELC (PLC Mitsubishi)<br>`4`: SYSM (PLC Omron)<br>`5`: XG (PLC LS/XGB) | `0` (RTU) |
| **Unit Address** | 400602 | `0x0259` | Alamat/ID *Slave* Modbus perangkat ini.<br>`1` hingga `99` | `1` |
| **Bit Per Second** | 400603 | `0x025A` | Baudrate (Kecepatan komunikasi) x100 bps.<br>`0`: 9600 bps<br>`1`: 19200 bps<br>`2`: 38400 bps<br>`3`: 57600 bps<br>`4`: 115200 bps | `0` (96) |
| **Parity Bit** | 400604 | `0x025B` | Bit Paritas untuk pengecekan error.<br>`0`: NONE (Tidak ada)<br>`1`: EVEN (Genap)<br>`2`: ODD (Ganjil) | `0` (NONE) |
| **Stop Bit** | 400605 | `0x025C` | Jumlah *Stop Bit*.<br>`0`: 1 Bit<br>`1`: 2 Bit | `1` (2 Bit) |
| **Response Waiting Time** | 400606 | `0x025D` | Waktu jeda (delay) perangkat membalas pesan setelah menerima perintah dari *Master*.<br>`5` hingga `99` ms | `20` |
| **Communication Write** | 400607 | `0x025E` | Mengizinkan penulisan via Komunikasi.<br>`0`: EN.A (Enable / Boleh)<br>`1`: DIS.A (Disable / Dilarang) | `0` (EN.A) |

> [!WARNING]
> Jika Anda menyetel **Communication Write** ke `DIS.A` (Disable), maka seluruh fungsi `0x06` dan `0x10` akan ditolak oleh unit, dan unit akan membalas dengan `Exception Code 04 (SLAVE DEVICE FAILURE)`. Hanya fungsi `0x03` dan `0x04` yang akan bekerja.

---

## 2. Pengaturan Komunikasi PLC (Ladderless)

TN Series mendukung fitur "Ladderless Communication". Artinya, jika disambungkan ke PLC yang didukung (Mitsubishi, Omron, atau LS), TN Series dapat secara otomatis membaca/menulis memori PLC tanpa perlu menulis *ladder logic* yang rumit di PLC. Parameter berikut mengatur pemetaan (*mapping*) alamat memori tersebut.

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Max Unit** | 400608 | `0x025F` | Jumlah unit maksimal yang saling terhubung dalam jaringan ini (`1` hingga `32`). | `1` |
| **PLC Station Number** | 400609 | `0x0260` | Alamat/Node PLC tujuan (`0` hingga `31`). | `0` |
| **CPU Number setting** | 400610 | `0x0261` | Nomor CPU PLC (`0` hingga `255`). | `255` |
| **PLC Register Type** | 400611 | `0x0262` | Area memori PLC yang akan dibaca/ditulis. Bergantung pada merk PLC (D-Register, M-Register, W-Register, dll). | `0` |
| **Register Start Number_H**| 400612 | `0x0263` | Alamat awal (High byte) register di PLC. | `0` |
| **Register Start Number_L**| 400613 | `0x0264` | Alamat awal (Low byte) register di PLC. | `0` |
| **PLC Start Time** | 400614 | `0x0265` | Waktu jeda (ms) dari alat menyala hingga komunikasi *ladderless* dimulai. | `3000` |
| **PLC Reception Waiting** | 400615 | `0x0266` | *Timeout* menunggu balasan dari PLC (`100` hingga `9999` ms). | `1000` |

---

## 3. Pemetaan PLC (Monitoring & Write)

Anda bisa menentukan data apa saja yang ingin dikirimkan otomatis ke PLC (Monitoring) dan data apa saja yang ingin ditarik otomatis dari PLC (Write). Nilai yang dimasukkan (`0-37`) merujuk pada urutan **User Parameter Group Setting Range**. Lihat [User Parameter Group](16_User_Parameter.md) untuk detail nomor datanya.

| Parameter Mapping | Rentang Address | Jumlah Parameter | Default |
|---|---|---|---|
| **PLC Monitoring 0 - 15** | `400616` hingga `400631` | 16 | (Bervariasi) |
| **PLC Write Parameter 0 - 37**| `400632` hingga `400669` | 38 | (Bervariasi) |

| Tambahan | Address | Hex | Deskripsi | Default |
|---|---|---|---|---|
| **PLC Setting Copy** | 400670 | `0x029D` | Meng-copy konfigurasi *mapping* PLC ke perangkat TN lain yang sinkron.<br>`0`: OFF, `1`: ON | `0` (OFF) |
| **Reserved** | 400671 - 400700 | - | Jangan digunakan | - |
