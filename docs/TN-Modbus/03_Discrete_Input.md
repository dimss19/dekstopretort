# Discrete Input Map

Grup ini berisi parameter yang beroperasi pada tingkat bit/coil **Read Only** (1X reference). Parameter ini utamanya merepresentasikan status indikator di panel depan (LEDs), status input digital (DI), status event, dan status alarm pada perangkat Autonics TN Series.

- **Function Code:** `02` (Read Input Status)
- **Data Type:** Boolean / BIT (0: OFF, 1: ON)
- **Rentang Address:** `100001` hingga `100100`

---

## Daftar Register Discrete Input

### 1. Panel Indicator (Unit & Satuan)

Merepresentasikan lampu indikator satuan yang menyala di panel depan.

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **℃ indicator** | 100001 | `0x0000` | Indikator satuan suhu Celcius (`0: OFF`, `1: ON`) |
| **℉ indicator** | 100002 | `0x0001` | Indikator satuan suhu Fahrenheit (`0: OFF`, `1: ON`) |
| **% indicator (2-level)** | 100003 | `0x0002` | Indikator persentase (2-level) (`0: OFF`, `1: ON`) |
| **S indicator (2-level)** | 100004 | `0x0003` | Indikator waktu satuan detik (`0: OFF`, `1: ON`) |
| **A indicator (2-level)** | 100005 | `0x0004` | Indikator arus (Ampere) 2-level (`0: OFF`, `1: ON`) |
| **H:M indicator (3-level)** | 100006 | `0x0005` | Indikator waktu Jam:Menit (HH.MM) (`0: OFF`, `1: ON`) |
| **M:S indicator (3-level)** | 100007 | `0x0006` | Indikator waktu Menit:Detik (MM.SS) (`0: OFF`, `1: ON`) |
| **A indicator (3-level)** | 100008 | `0x0007` | Indikator arus (Ampere) 3-level (`0: OFF`, `1: ON`) |
| **% indicator (3-level)** | 100009 | `0x0008` | Indikator persentase (3-level) (`0: OFF`, `1: ON`) |

### 2. Panel Indicator (Status Kontrol & Tampilan)

Status LED yang menunjukkan informasi apa yang sedang ditampilkan di layar atau mode operasi.

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **MV indicator (3-level)** | 100010 | `0x0009` | Indikator nilai Control Output (MV) di layar ke-3 |
| **P/S indicator (3-level)** | 100011 | `0x000A` | Indikator Operation pattern/segment (step) |
| **TM indicator (3-level)** | 100012 | `0x000B` | Indikator Operation time |
| **CT indicator (3-level)** | 100013 | `0x000C` | Indikator input Current Transformer (CT) |
| **1 indicator (3-level)** | 100014 | `0x000D` | Indikator display nilai MV orde 1 |
| **2 indicator (3-level)** | 100015 | `0x000E` | Indikator display nilai MV orde 2 |
| **LOCK indicator** | 100016 | `0x000F` | Indikator pengunci tombol depan (*Front key lock*) |
| **PROG indicator** | 100017 | `0x0010` | Indikator kontrol Pattern (Program) aktif |
| **WAIT indicator** | 100018 | `0x0011` | Indikator status WAIT (menunggu) |
| **MAN indicator** | 100024 | `0x0017` | Indikator mode kontrol Manual |
| **STOP indicator** | 100025 | `0x0018` | Indikator Kontrol dalam posisi STOP |
| **HOLD indicator** | 100026 | `0x0019` | Indikator kontrol Pattern sedang dijeda (Pause) |
| **↗ indicator** | 100033 | `0x0020` | Suhu sedang naik (Ramp Up) |
| **→ indicator** | 100034 | `0x0021` | Suhu dipertahankan (Maintain) |
| **↘ indicator** | 100035 | `0x0022` | Suhu sedang turun (Ramp Down) |

### 3. Output & Alarm Indicator

Membaca apakah output relay / SSR, maupun alarm sedang memicu / *trigger*.

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **HBA1 indicator** | 100019 | `0x0012` | CT1 input brake alarm (`1`: Heater Putus) |
| **HBA2 indicator** | 100020 | `0x0013` | CT2 input brake alarm (`1`: Heater Putus) |
| **OUT1 indicator** | 100021 | `0x0014` | Status Control Output 1 (Heater) aktif |
| **OUT2 indicator** | 100022 | `0x0015` | Status Control Output 2 (Cooler) aktif |
| **AT indicator** | 100023 | `0x0016` | Proses Auto-Tuning sedang berlangsung |
| **AL1 indicator** | 100027 | `0x001A` | Output Alarm 1 aktif |
| **AL2 indicator** | 100028 | `0x001B` | Output Alarm 2 aktif |
| **AL3 indicator** | 100029 | `0x001C` | Output Alarm 3 aktif |
| **AL4 indicator** | 100030 | `0x001D` | Output Alarm 4 aktif |
| **AL5 indicator** | 100031 | `0x001E` | Output Alarm 5 aktif |
| **AL6 indicator** | 100032 | `0x001F` | Output Alarm 6 aktif |

### 4. Status Digital Input (DI)

Digunakan untuk membaca status pin *Digital Input* pada unit, apakah dalam posisi *terhubung* (ON) atau *terbuka* (OFF).

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **DI-1 input** | 100036 | `0x0023` | Status terminal DI-1 (`1`: ON / Short) |
| **DI-2 input** | 100037 | `0x0024` | Status terminal DI-2 (`1`: ON / Short) |
| **DI-3 input** | 100038 | `0x0025` | Status terminal DI-3 (`1`: ON / Short) |
| **DI-4 input** | 100039 | `0x0026` | Status terminal DI-4 (`1`: ON / Short) |
| **DI-5 input** | 100040 | `0x0027` | Status terminal DI-5 (`1`: ON / Short) |
| **DI-6 input** | 100041 | `0x0028` | Status terminal DI-6 (`1`: ON / Short) |

### 5. Status Event

Status event logic yang ada dalam pengaturan alat.

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **EVENT 0 status** | 100042 | `0x0029` | Status Event 0 aktif |
| **EVENT 1 status** | 100043 | `0x002A` | Status Event 1 aktif |
| **EVENT 2 status** | 100044 | `0x002B` | Status Event 2 aktif |
| **EVENT 3 status** | 100045 | `0x002C` | Status Event 3 aktif |
| **EVENT 4 status** | 100046 | `0x002D` | Status Event 4 aktif |
| **EVENT 5 status** | 100047 | `0x002E` | Status Event 5 aktif |
| **EVENT 6 status** | 100048 | `0x002F` | Status Event 6 aktif |
| **EVENT 7 status** | 100049 | `0x0030` | Status Event 7 aktif |
| **EVENT 8 status** | 100050 | `0x0031` | Status Event 8 aktif |
| **EVENT 9 status** | 100051 | `0x0032` | Status Event 9 aktif |
| **Reserved** | 100052 - 100100 | - | Jangan digunakan |

---

## Contoh Modbus (Membaca Status Alarm 1)

Membaca status **AL1 indicator** (Address `100027`).

**Request dari Master:**
- Function Code: `02`
- Starting Address: `0x001A` (100027 - 100001 = 26 = `1A` hex)
- Quantity: `0x0001`

**Contoh kode Arduino/ESP32 (ModbusMaster):**

```cpp
#include <ModbusMaster.h>

ModbusMaster node;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  node.begin(1, Serial2);
}

void loop() {
  uint8_t result;
  
  // Function Code 02 (Read Discrete Inputs), offset 0x001A, jumlah 1 bit
  result = node.readDiscreteInputs(0x001A, 1);
  
  if (result == node.ku8MBSuccess) {
    // getResponseBuffer mengembalikan 16-bit word, bit ke-0 adalah hasil dari coil pertama
    bool isAlarm1Active = bitRead(node.getResponseBuffer(0), 0);
    
    if (isAlarm1Active) {
      Serial.println("ALARM 1 MENYALA!");
    } else {
      Serial.println("Alarm 1 Aman.");
    }
  }
  delay(1000);
}
```
