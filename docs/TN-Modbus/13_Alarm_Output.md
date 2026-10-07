# Alarm Output Parameter Group

Setelah Anda mengonfigurasi kondisi di [Event Parameter](12_Event_Parameter.md), Anda dapat mendefinisikan *bagaimana* alarm fisik / logis pada perangkat bereaksi ketika event tersebut aktif. Grup parameter ini mengatur opsi *latching*, status relai (NO/NC), delay ON/OFF, serta *logic gate* (AND/OR).

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400551` hingga `400600`
- **Tipe Data Utama:** INT16

---

## 1. Pemilihan Terminal Alarm

| Nama Parameter | Address | Hex | Range & Deskripsi | Default |
|---|---|---|---|---|
| **Alarm Output.n** | 400551 | `0x0226` | Penugasan terminal alarm (Alarm output terminal).<br>`0`: AL.1, `1`: AL.2, `2`: AL.3, `3`: AL.4, `4`: AL.5, `5`: AL.6, `6`: AL.7 | `0` (AL.1) |

---

## 2. Struktur Register Tiap Alarm (Alarm 1 - Alarm 7)

Terdapat 7 buah konfigurasi output alarm. Masing-masing alarm memiliki 5 register yang mengatur perilaku output alarm tersebut.

### Alamat Dasar Tiap Alarm

| Alarm | Rentang Address | Alarm | Rentang Address |
|:---:|---|:---:|---|
| **Alarm 1** | `400552` - `400556` | **Alarm 5** | `400572` - `400576` |
| **Alarm 2** | `400557` - `400561` | **Alarm 6** | `400577` - `400581` |
| **Alarm 3** | `400562` - `400566` | **Alarm 7** | `400582` - `400586` |
| **Alarm 4** | `400567` - `400571` | **Reserved**| `400587` - `400600` |

---

### Daftar Parameter per Alarm

Berikut adalah contoh untuk **Alarm 1** (Address mulai `400552`). Untuk alarm lainnya, fungsi parameternya sama namun ditambahkan kelipatan `+5` ke address tersebut.

| Nama Parameter | Address | Range & Deskripsi | Default |
|---|---|---|---|
| **Alarm Logic.n** | 400552 | Menentukan logika pemicu jika beberapa *Event* diarahkan ke alarm yang sama.<br>`0`: **OR** (Bila salah satu Event aktif, Alarm aktif)<br>`1`: **AND** (Bila semua Event aktif, Alarm aktif) | `0` (OR) |
| **Alarm Type.n** | 400553 | Opsi / Sifat dari Alarm.<br>Lihat **Tabel Alarm Option** di bawah. | `0` (AL-A) |
| **Alarm NO/NC.n** | 400554 | Tipe kontak relai.<br>`0`: **NO** (Normally Open)<br>`1`: **NC** (Normally Closed) | `0` (NO) |
| **Alarm ON Delay Time.n** | 400555 | Waktu tunda (*delay*) sebelum alarm diaktifkan saat kondisi terpenuhi.<br>`0` hingga `3600` Detik | `0` |
| **Alarm OFF Delay Time.n**| 400556 | Waktu tunda (*delay*) sebelum alarm dimatikan saat kondisi sudah kembali normal.<br>`0` hingga `3600` Detik | `0` |

> [!NOTE]
> Pada manual aslinya, parameter `Alarm NO/NC`, `ON Delay`, dan `OFF Delay` untuk semua alarm terkadang ditulis sebagai `Alarm1 ...`. Hal ini merupakan salah cetak (typo) di manual; fungsinya sebenarnya mengikuti nomor alarm grupnya masing-masing.

---

## Tabel Alarm Option (Alarm Type)

Tabel ini digunakan untuk mengisi register **Alarm Type.n**. Opsi ini menentukan bagaimana alarm merespons saat sistem baru saja dinyalakan atau saat parameter berubah.

| Nilai | Opsi Alarm | Deskripsi Sifat Alarm |
|:---:|---|---|
| `0` | **AL-A** | **Standard alarm**: Alarm akan langsung menyala apabila kondisi pemicu terpenuhi. |
| `1` | **AL-B** | **Alarm latch**: Alarm akan terkunci (tetap menyala) meskipun suhu sudah kembali normal. Untuk mematikannya, perlu mengirim perintah [Alarm Reset](02_Coil_Map.md#3-alarm-reset). |
| `2` | **AL-C** | **Standby alarm 1**: Alarm diabaikan jika kondisi terpenuhi saat alat baru pertama kali dinyalakan. Alarm baru akan aktif jika suhu sudah pernah masuk batas normal, lalu melewati batas kembali. |
| `3` | **AL-D** | **Standby alarm latch 1**: Kombinasi *Standby alarm 1* dan *Latch*. |
| `4` | **AL-E** | **Standby alarm 2**: Sama seperti Standby alarm 1, ditambah alarm juga diabaikan saat user mengubah Set Value (SV) yang menyebabkan nilai PV sesaat berada di luar batas. |
| `5` | **AL-F** | **Standby alarm latch 2**: Kombinasi *Standby alarm 2* dan *Latch*. |

---

## Contoh Modbus (Mengonfigurasi Alarm 1)

Skenario:
- Logika OR
- Tipe Alarm *Standby alarm 1* (`2`)
- Kontak NO
- Delay ON 5 detik
- Delay OFF 2 detik

```python
from pymodbus.client import ModbusSerialClient

client = ModbusSerialClient(port='COM3', baudrate=9600, timeout=1)

if client.connect():
    slave_id = 1
    
    # Register untuk Alarm 1 dimulai dari offset 551 (400552 - 400001)
    
    # 400552: Alarm Logic.1 = 0 (OR)
    # 400553: Alarm Type.1 = 2 (Standby alarm 1)
    # 400554: Alarm NO/NC.1 = 0 (NO)
    # 400555: Alarm ON Delay = 5
    # 400556: Alarm OFF Delay = 2
    
    values = [0, 2, 0, 5, 2]
    
    result = client.write_registers(address=551, values=values, slave=slave_id)
    
    if not result.isError():
        print("Konfigurasi Alarm 1 berhasil diperbarui.")
    else:
        print("Gagal mengonfigurasi Alarm 1.")
        
    client.close()
```
