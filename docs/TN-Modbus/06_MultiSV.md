# Multi SV Parameter Group

Grup parameter ini digunakan untuk mengonfigurasi fitur **Multi Set Value (Multi SV)**. Fitur ini memungkinkan Anda menyimpan hingga 4 nilai target suhu (SV) yang berbeda dan dapat dipanggil/diganti dengan cepat, baik melalui Modbus maupun menggunakan pin terminal input digital (DI) pada perangkat.

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400051` hingga `400100`
- **Tipe Data Utama:** INT16

---

## Daftar Register Multi SV

### 1. Multi-SV Select

Parameter ini digunakan untuk memilih SV mana yang saat ini sedang aktif dan digunakan sebagai referensi oleh sistem kontrol PID.

- **Address**: `400051`
- **Hex**: `0x0032`
- **Access**: Read / Write
- **Data Type**: INT16
- **Default**: `0` (SV.0)

| Value | Arti |
|---|---|
| `0` | **SV.0** - Menggunakan profil Suhu Target ke-0 |
| `1` | **SV.1** - Menggunakan profil Suhu Target ke-1 |
| `2` | **SV.2** - Menggunakan profil Suhu Target ke-2 |
| `3` | **SV.3** - Menggunakan profil Suhu Target ke-3 |

---

### 2. SV-0 Setting Value

Nilai suhu target untuk profil SV-0.

- **Address**: `400052`
- **Hex**: `0x0033`
- **Access**: Read / Write
- **Data Type**: INT16
- **Range**: Dari `L-SV` (Batas Bawah) hingga `H-SV` (Batas Atas). Memperhitungkan titik desimal.
- **Default**: `0`

---

### 3. SV-1 Setting Value

Nilai suhu target untuk profil SV-1.

- **Address**: `400053`
- **Hex**: `0x0034`
- **Access**: Read / Write
- **Data Type**: INT16
- **Range**: Dari `L-SV` (Batas Bawah) hingga `H-SV` (Batas Atas).
- **Default**: `0`

---

### 4. SV-2 Setting Value

Nilai suhu target untuk profil SV-2.

- **Address**: `400054`
- **Hex**: `0x0035`
- **Access**: Read / Write
- **Data Type**: INT16
- **Range**: Dari `L-SV` (Batas Bawah) hingga `H-SV` (Batas Atas).
- **Default**: `0`

---

### 5. SV-3 Setting Value

Nilai suhu target untuk profil SV-3.

- **Address**: `400055`
- **Hex**: `0x0036`
- **Access**: Read / Write
- **Data Type**: INT16
- **Range**: Dari `L-SV` (Batas Bawah) hingga `H-SV` (Batas Atas).
- **Default**: `0`

---

### 6. Reserved

Area ini tidak digunakan, dibiarkan kosong untuk keperluan *firmware* pabrikan.

- **Address**: `400056` hingga `400100`
- **Hex**: `0x0037` hingga `0x0063`

---

## Hubungan dengan Parameter Lain

- Parameter `Set_Value` (Address `400006`) akan secara otomatis mengikuti / sinkron dengan nilai profil SV yang dipilih di `400051`.
- Jika pengaturan *Multi SV* juga dikendalikan via hardware / sakelar fisik eksternal, Anda harus mengatur fungsi *Digital Input* untuk mode **MT.SV** (Lihat [Other Parameter Group](15_Other_Parameter.md) pada `400713` dst).
- Saat *Digital Input* memaksakan mode SV tertentu (misalnya saklar eksternal tertutup), penulisan Modbus ke register `400051` mungkin diabaikan atau dibatalkan oleh perangkat keras.

---

## Contoh Kode (Mengatur dan Memilih SV)

Dalam skenario di bawah ini, kita akan:
1. Menyetel SV-1 (Target suhu 1) ke 100℃
2. Menyetel SV-2 (Target suhu 2) ke 250℃
3. Mengubah pemilihan target menjadi SV-2.

Asumsi Modbus ID TN Controller adalah 1, dan tidak ada titik desimal.

```python
from pymodbus.client import ModbusSerialClient

client = ModbusSerialClient(port='COM3', baudrate=9600, timeout=1)

if client.connect():
    slave_id = 1
    
    # 1. Menulis nilai ke SV-1 (Address 400053 -> offset 52)
    client.write_register(address=52, value=100, slave=slave_id)
    print("SV-1 disetel ke 100 C")
    
    # 2. Menulis nilai ke SV-2 (Address 400054 -> offset 53)
    client.write_register(address=53, value=250, slave=slave_id)
    print("SV-2 disetel ke 250 C")
    
    # 3. Pindah ke SV-2 dengan mengubah Multi-SV Select (Address 400051 -> offset 50)
    # Nilai 2 berarti memilih SV-2
    client.write_register(address=50, value=2, slave=slave_id)
    print("Kontrol PID sekarang menggunakan SV-2")
    
    client.close()
```
