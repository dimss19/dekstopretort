# Coil Map

Grup ini berisi parameter yang beroperasi pada tingkat level bit/coil (0X reference). Ini adalah parameter diskrit yang bisa digunakan untuk mengendalikan operasi dasar dari Autonics TN Series secara real-time.

- **Function Code:** 
  - `01` (Read Coil Status) - Untuk membaca status.
  - `05` (Force Single Coil) - Untuk mengubah nilai status.
- **Data Type:** Boolean / BIT
- **Rentang Address:** `000001` hingga `000050`

---

## Daftar Register Coil

### 1. RUN / STOP

Berfungsi untuk menjalankan atau menghentikan kontrol output (pengaturan suhu) pada perangkat.

- **Address**: `000001`
- **Hex Address**: `0x0000`
- **Access**: Read / Write
- **Data Type**: BIT
- **Default**: `1` (STOP)

| Value | Arti |
|---|---|
| `0` | **RUN** - Kontrol suhu berjalan (Heater/Cooler aktif). |
| `1` | **STOP** - Kontrol suhu berhenti. |

---

### 2. Auto-Tuning Execute

Mengaktifkan proses *Auto-Tuning* agar kontroler mencari parameter PID yang optimal secara otomatis.

- **Address**: `000002`
- **Hex Address**: `0x0001`
- **Access**: Read / Write
- **Data Type**: BIT
- **Default**: `0` (OFF)

| Value | Arti |
|---|---|
| `0` | **OFF** - Mematikan Auto-Tuning / Auto-Tuning tidak berjalan. |
| `1` | **ON** - Memulai Auto-Tuning. Setelah selesai, bit ini otomatis kembali ke `0`. |

> [!NOTE]
> Parameter ini berkaitan erat dengan mode *Auto-Tuning* pada parameter kontrol PID (register `400101` dan `400102`).

---

### 3. Alarm Reset

Menghapus (mereset) output alarm yang saat ini sedang aktif (misalnya *Alarm Latch*).

- **Address**: `000003`
- **Hex Address**: `0x0002`
- **Access**: Read / Write
- **Data Type**: BIT
- **Default**: `0` (OFF)

| Value | Arti |
|---|---|
| `0` | **OFF** - Normal (tidak ada instruksi reset). |
| `1` | **ON** - Kirim instruksi untuk mematikan status alarm. Nilai ini harus dikembalikan ke `0` setelah eksekusi jika dilakukan melalui PLC. |

---

### 4. Reserved (Cadangan)

Area address ini dicadangkan untuk penggunaan internal oleh pabrikan atau fitur di masa depan. Tidak boleh digunakan.

- **Address**: `000004` hingga `000050`
- **Hex Address**: `0x0003` hingga `0x0031`
- **Access**: -
- **Data Type**: -

---

## Contoh Kode Penggunaan (ESP32)

Berikut adalah contoh cara melakukan *Force Single Coil* untuk menjalankan perintah **RUN (0)** pada perangkat menggunakan pustaka `ModbusMaster` di ESP32:

```cpp
#include <ModbusMaster.h>

ModbusMaster node;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17); // Konfigurasi Serial2 untuk RS485
  node.begin(1, Serial2); // Inisialisasi Slave ID = 1
  
  // Mengirim perintah RUN (Value 0 / 0x0000) ke Address 000001 (Offset 0x0000)
  uint8_t result = node.writeSingleCoil(0x0000, 0x0000); // 0x0000 berarti ON dalam konteks RUN/STOP (RUN = 0)
  // Catatan: node.writeSingleCoil mengirimkan 0xFF00 jika argumen ke-2 bukan 0, jadi untuk mengirim 0x0000, argumen kedua harus 0.
  
  if (result == node.ku8MBSuccess) {
    Serial.println("Perintah RUN berhasil dieksekusi!");
  } else {
    Serial.println("Gagal mengeksekusi perintah RUN.");
  }
}

void loop() {
  // Logic lainnya
}
```

> [!WARNING]
> Pada library `ModbusMaster` untuk Arduino/ESP32, penulisan coil `0` akan mengirim nilai `0x0000` (sesuai spesifikasi Modbus untuk instruksi Force Single Coil = OFF). Dalam konteks TN Series, **0 = RUN**.
