# Input Register Map

Grup ini mencakup dua bagian utama yang sama-sama menggunakan **Function Code 04 (Read Input Registers)** (3X reference). Parameter dalam grup ini bersifat **Read-Only** dan biasanya menyimpan informasi perangkat (seperti nama model, versi) dan data pembacaan sensor (*Present Value*, Output saat ini).

- **Function Code:** `04` (Read Input Registers)
- **Data Type:** INT16 (Sebagian besar), Karakter ASCII (untuk nama model)
- **Rentang Address:**
  - `300001 - 300200` : Input Status (Informasi Perangkat)
  - `301001 - 301050` : Input Registers (Data Sensor & Output)

---

## 1. Input Status (Informasi Perangkat)

Menyimpan informasi identitas dan versi perangkat Autonics TN Series. Nilai default dapat berbeda tergantung pada model yang Anda miliki.

| Nama Parameter | Address | Hex | Deskripsi | Default |
|---|---|---|---|---|
| **Product number H** | 300101 | `0x0064` | Nomor Produk *High byte* | 5000 |
| **Product number L** | 300102 | `0x0065` | Nomor Produk *Low byte* | 3215 |
| **Hardware version** | 300103 | `0x0066` | Versi Hardware perangkat | - |
| **Software version** | 300104 | `0x0067` | Versi Software perangkat | - |
| **Model name 1: Series** | 300105 | `0x0068` | Nama model bagian 1 (ASCII) | TN |
| **Model name 2: Size** | 300106 | `0x0069` | Nama model bagian 2 | S- |
| **Model name 3: Func+Power** | 300107 | `0x006A` | Nama model bagian 3 | 4 |
| **Model name 4: Alarm+OUT1** | 300108 | `0x006B` | Nama model bagian 4 | 2S |
| **Model name 5: OUT2** | 300109 | `0x006C` | Nama model bagian 5 | R- |
| **Model name 6: Comm+Mount** | 300110 | `0x006D` | Nama model bagian 6 | RS |
| **Model name 7: Option** | 300111 | `0x006E` | Nama model bagian 7 | -0 |
| **Model name 8: Option** | 300112 | `0x006F` | Nama model bagian 8 | 00 |
| **Coil status Start Addr** | 300118 | `0x0075` | Alamat awal status Coil | 0 |
| **Coil status Quantity** | 300119 | `0x0076` | Jumlah status Coil (bervariasi) | 0 |
| **Input status Start Addr**| 300120 | `0x0077` | Alamat awal status Input | 0 |
| **Input status Quantity** | 300121 | `0x0078` | Jumlah status Input (bervariasi) | 0 |
| **Holding Reg Start Addr** | 300122 | `0x0079` | Alamat awal Holding Register | 0 |
| **Holding Reg Quantity** | 300123 | `0x007A` | Jumlah Holding Register (bervariasi)| 0 |
| **Input Reg Start Addr** | 300124 | `0x007B` | Alamat awal Input Register | 0 |
| **Input Reg Quantity** | 300125 | `0x007C` | Jumlah Input Register (bervariasi) | 0 |

---

## 2. Input Registers (Data Sensor & Output Aktual)

Area ini menyimpan pembacaan suhu aktual (*Present Value*), nilai output heater/cooler saat ini, serta bit-status dari fungsi alat. Area ini yang paling sering dibaca (*polling*) oleh sistem SCADA/Dashboard secara berkala.

| Nama Parameter | Address | Hex | Deskripsi |
|---|---|---|---|
| **Present Value (PV)** | 301001 | `0x03E8` | Nilai pembacaan sensor aktual.<br>- Range: `-1999` hingga `9999` (℃/℉/digit)<br>- `31000`: OPEN (Sensor putus/tidak ada)<br>- `30000`: HHHH (Over limit)<br>- `-30000`: LLLL (Under limit) |
| **Decimal point** | 301002 | `0x03E9` | Posisi titik desimal layar.<br>`0`: 0, `1`: 0.0, `2`: 0.00, `3`: 0.000 |
| **Display unit** | 301003 | `0x03EA` | Satuan yang ditampilkan.<br>`0`: ℃, `1`: ℉, `2`: %, `3`: OFF |
| **Set Value (SV)** | 301004 | `0x03EB` | Nilai target suhu yang sedang aktif (*Read Only*). |
| **Heating_MV** | 301005 | `0x03EC` | Nilai Control Output untuk pemanasan (Heater).<br>`0` hingga `1000` (Merepresentasikan `0.0` hingga `100.0%`) |
| **Cooling_MV** | 301006 | `0x03ED` | Nilai Control Output untuk pendinginan (Cooler).<br>`0` hingga `1000` (Merepresentasikan `0.0` hingga `100.0%`) |
| **Indicator Bit** | 301007 | `0x03EE` | Paket 16-bit dari [Discrete Input 100001 - 100016](03_Discrete_Input.md) |
| **Operation Indicator Bit** | 301008 | `0x03EF` | Paket 16-bit dari [Discrete Input 100017 - 100032](03_Discrete_Input.md) |
| **Temp Indicator Bit** | 301009 | `0x03F0` | Status indikator ↗, →, ↘ (Bit 0, 1, 2) |
| **DI Input Bit** | 301010 | `0x03F1` | Status Digital Input 1-6 pada Bit 0-5 |
| **EVENT Status Bit** | 301011 | `0x03F2` | Status EVENT 0-9 pada Bit 0-9 |
| **ALARM Status Bit** | 301012 | `0x03F3` | Status Alarm 1-7 pada Bit 0-6 |
| **CT1 Heater Current** | 301013 | `0x03F4` | Arus Heater 1 aktual (`0.0` hingga `50.0 A`) |
| **CT2 Heater Current** | 301014 | `0x03F5` | Arus Heater 2 aktual (`0.0` hingga `50.0 A`) |
| **RUN/STOP Monitoring** | 301015 | `0x03F6` | Status RUN/STOP saat ini (`0`: RUN, `1`: STOP) |
| **Auto-tuning Monitoring**| 301016 | `0x03F7` | Status Auto-tuning (`0`: OFF, `1`: ON) |
| **Transfer Current_MV** | 301017 | `0x03F8` | Nilai output transmisi (`0` hingga `100%`) |
| **COMM_Status** | 301018 | `0x03F9` | Status koneksi. `0`: Normal, `1`: Error Komunikasi. |
| **PID_GROUP_NO** | 301019 | `0x03FA` | Grup PID yang sedang berjalan (`0` hingga `7`) |
| **Program_PATN_CURR** | 301020 | `0x03FB` | (Mode Pattern) Pattern yang sedang berjalan (`0-9`) |
| **Program_Step_CURR** | 301021 | `0x03FC` | (Mode Pattern) Step yang sedang berjalan (`0-19`) |
| **Program_Process_Time**| 301022 | `0x03FD` | (Mode Pattern) Waktu berjalan (MM:SS / HH:MM) |
| **Program_Wait_Time** | 301023 | `0x03FE` | (Mode Pattern) Waktu tunggu step |
| **Program_Rest_Time** | 301024 | `0x03FF` | (Mode Pattern) Sisa waktu step (MM:SS / HH:MM) |
| **Program_Repeat_CNT** | 301025 | `0x0400` | (Mode Pattern) Jumlah pengulangan |
| **Timer Remainder Time**| 301026 | `0x0401` | Sisa waktu timer (HH:MM) |
| **Operating_Time** | 301027 | `0x0402` | Waktu operasi sejak nyala (Y.DDD) |

> [!NOTE]
> Parameter `301007` hingga `301012` adalah representasi *bit-packed* (16-bit word). Membaca register ini sangat direkomendasikan daripada membaca satu-persatu melalui fungsi *Read Discrete Input (0x02)*, karena Anda dapat menarik puluhan status LED, Alarm, dan Event hanya dalam beberapa register saja, yang akan menghemat *bandwidth* RS485.

---

## Contoh Kode (Membaca PV & Output via Pymodbus)

Berikut adalah contoh skrip Python menggunakan `pymodbus` untuk membaca Suhu Aktual (PV) dan Output Heater.

```python
from pymodbus.client import ModbusSerialClient

# Konfigurasi koneksi RS485
client = ModbusSerialClient(
    port='/dev/ttyUSB0', 
    baudrate=9600, 
    bytesize=8, 
    parity='N', 
    stopbits=1,
    timeout=1
)

if client.connect():
    # Membaca PV (Address 301001 -> Offset 1000) dan Heating MV (Offset 1004)
    # Pymodbus menggunakan offset berbasis 0, maka 301001 adalah 1000 (0x03E8)
    # Kita bisa membaca 5 register dari offset 1000 untuk mendapatkan PV hingga Heating_MV
    
    response = client.read_input_registers(address=1000, count=5, slave=1)
    
    if not response.isError():
        pv_raw = response.registers[0]
        heating_mv_raw = response.registers[4]
        
        # Format nilai jika diperlukan
        if pv_raw == 31000:
            print("Sensor Error: OPEN")
        else:
            print(f"Suhu Aktual (PV): {pv_raw}") # Sesuaikan dengan Decimal Point jika ada
            
        print(f"Heating Output: {heating_mv_raw / 10.0}%")
    else:
        print("Gagal membaca register Modbus")
        
    client.close()
```
