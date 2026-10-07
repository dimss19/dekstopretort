# Operation Parameter Group

Grup parameter ini berisi pengaturan operasional utama pada Autonics TN Series. Anda dapat menggunakan parameter ini untuk mengontrol alat (RUN/STOP), memilih mode Auto/Manual, menentukan mode operasi (FIX/PROG), serta membaca atau menulis output kendali (MV) secara manual.

- **Function Code:** 
  - `03` (Read Holding Register)
  - `06` (Preset Single Register)
  - `16` (Preset Multiple Registers)
- **Rentang Address:** `400001` hingga `400050`
- **Tipe Data Utama:** INT16

---

## Daftar Register Operation Parameter

### 1. RUN-STOP (Control output Run/Stop)

Digunakan untuk menghidupkan (RUN) atau mematikan (STOP) proses kendali suhu pada output utama.

- **Address**: `400001`
- **Hex**: `0x0000`
- **Access**: Read / Write
- **Data Type**: INT16
- **Default**: `1` (STOP)

| Value | Arti |
|---|---|
| `0` | **RUN** |
| `1` | **STOP** |

---

### 2. Timer PAUS / Continue Setting

Digunakan untuk menahan sementara (Pause) atau melanjutkan (Continue) penghitungan timer / jalannya pola (pattern).

- **Address**: `400002`
- **Hex**: `0x0001`
- **Access**: Read / Write
- **Data Type**: INT16
- **Default**: `0` (CONT)

| Value | Arti |
|---|---|
| `0` | **CONT** (Continue) |
| `1` | **PAUS** (Pause) |

---

### 3. Auto / Manual (Auto/Manual control)

Memilih apakah output dikontrol secara otomatis (oleh PID) atau secara manual oleh pengguna.

- **Address**: `400003`
- **Hex**: `0x0002`
- **Access**: Read / Write
- **Data Type**: INT16
- **Default**: `0` (AUTO)

| Value | Arti |
|---|---|
| `0` | **AUTO** - Sistem PID mengambil alih. |
| `1` | **MAN** - Pengguna dapat mengatur output manual via register `400004` / `400005`. |

---

### 4. Heating_MV (Heating MV)

Manual Value (MV) untuk pemanasan (Heater). Parameter ini hanya bisa ditulis ketika alat berada dalam mode **Manual**.

- **Address**: `400004`
- **Hex**: `0x0003`
- **Access**: Read / Write (Jika Manual)
- **Data Type**: INT16
- **Range**: `0` hingga `1000` (Merepresentasikan `0.0` hingga `100.0 %`)
- **Default**: -

> [!NOTE]
> Nilai yang dikirim harus dikalikan 10. Contoh: Jika ingin output heater sebesar 50.5%, kirimkan nilai `505`.

---

### 5. Cooling_MV (Cooling MV)

Manual Value (MV) untuk pendinginan (Cooler). Parameter ini hanya bisa ditulis jika tipe kontrol perangkat mendukung pemanasan-pendinginan (H-C) dan mode **Manual** diaktifkan.

- **Address**: `400005`
- **Hex**: `0x0004`
- **Access**: Read / Write (Jika Manual)
- **Data Type**: INT16
- **Range**: `0` hingga `1000` (Merepresentasikan `0.0` hingga `100.0 %`)
- **Default**: -

---

### 6. Set_Value (Setting value)

Target Suhu / *Set Point* (SV) yang ingin dicapai oleh perangkat. Ini adalah salah satu parameter yang paling sering diubah.

- **Address**: `400006`
- **Hex**: `0x0005`
- **Access**: Read / Write
- **Data Type**: INT16
- **Range**: Tergantung parameter L-SV (Batas Bawah) hingga H-SV (Batas Atas).
- **Satuan**: Tergantung posisi desimal (`301002`). Jika tidak ada desimal, suhu 100℃ dikirim sebagai `100`. Jika ada 1 desimal, suhu 100.5℃ dikirim sebagai `1005`.
- **Default**: `0`

---

### 7. Mode Select (Operation mode)

Memilih apakah alat beroperasi dengan suhu konstan (FIX) atau mengikuti pengaturan pola/program (PROG).

- **Address**: `400007`
- **Hex**: `0x0006`
- **Access**: Read / Write
- **Data Type**: INT16
- **Default**: `1` (PROG)

| Value | Arti |
|---|---|
| `0` | **FIX** - Fix Control Mode (Mengikuti 1 Set Value konstan) |
| `1` | **PROG** - Pattern Control Mode (Mengikuti program/pola yang sudah dikonfigurasi) |

---

### 8. PID Control Select (2-DOF PID control)

Mengaktifkan fitur 2-Degree-Of-Freedom (2-DOF) PID Control untuk respons kendali yang lebih baik tanpa *overshoot* yang berlebihan.

- **Address**: `400008`
- **Hex**: `0x0007`
- **Access**: Read / Write
- **Data Type**: INT16
- **Default**: `1` (ON)

| Value | Arti |
|---|---|
| `0` | **OFF** |
| `1` | **ON** |

---

### 9. Reserved

Area cadangan, tidak untuk digunakan.

- **Address**: `400009` hingga `400050`
- **Hex**: `0x0008` hingga `0x0031`

---

## Contoh Kode (Mengubah Set Value)

Berikut adalah contoh cara mengubah target suhu (SV) menjadi 150℃ (Asumsi tanpa titik desimal) menggunakan bahasa Python dengan *library* `pymodbus`.

```python
from pymodbus.client import ModbusSerialClient

# Inisialisasi Klien Modbus
client = ModbusSerialClient(port='COM3', baudrate=9600, timeout=1)

if client.connect():
    slave_id = 1
    new_sv = 150 # 150 Derajat Celcius
    
    # Address 400006 berarti offset 5 (400006 - 400001)
    result = client.write_register(address=5, value=new_sv, slave=slave_id)
    
    if not result.isError():
        print(f"Berhasil mengubah Set Value menjadi {new_sv}")
    else:
        print("Gagal mengubah Set Value")
        
    client.close()
```
