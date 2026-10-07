# User Parameter Group

Grup parameter ini adalah fungsi khusus yang didedikasikan secara eksklusif untuk *software* **Autonics DAQMaster** atau integrasi *Ladderless PLC*. Fitur ini memungkinkan pengguna untuk membuat "grup kustom" sendiri yang berisi referensi (pointer) ke parameter-parameter penting yang paling sering diakses, sehingga mengurangi waktu polling (membaca/menulis) data berulang-ulang dari register yang letaknya berjauhan.

- **Function Code:** `03` (Read), `06` (Write Single), `16` (Write Multiple)
- **Tipe Data Utama:** INT16

---

## 1. Mekanisme User Parameter

Fitur ini bekerja mirip seperti fungsi *pointer* dalam pemrograman C. Anda tidak langsung membaca nilai PV atau MV di sini, melainkan:
1. Anda menulis **ID Parameter (Setting Range)** ke dalam **User parameter group Address** (`401022` - `401051`).
2. Setelah itu, jika Anda membaca **User parameter group Data** (`402001` - `402030`), Anda akan mendapatkan *nilai aktual* dari parameter yang ID-nya Anda tunjuk di langkah 1.

Ada total **30 slot** yang bisa Anda konfigurasi.

---

## 2. Register: User Parameter Group Address

Register ini digunakan untuk *mengatur* (menunjuk) ID Parameter mana yang ingin Anda pantau / tulis. Rentang Address: `401022` (03FD) hingga `401051` (041A). 

| Nama Parameter | Address | Default | Kegunaan |
|---|---|---|---|
| **User parameter group address_1** | 401022 | 0 | ID Parameter untuk slot 1 |
| **User parameter group address_2** | 401023 | 0 | ID Parameter untuk slot 2 |
| ... berlanjut hingga ... | ... | ... | ... |
| **User parameter group address_30**| 401051 | 0 | ID Parameter untuk slot 30 |

*(Alamat `401052` hingga `401100` adalah Reserved)*

---

## 3. Register: User Parameter Group Data

Register ini digunakan untuk **membaca nilai** atau **menulis nilai** ke parameter yang telah Anda *mapping* di Grup Address di atas. Rentang Address: `402001` (07D0) hingga `402030` (07ED).

| Nama Parameter | Address | Default | Kegunaan |
|---|---|---|---|
| **User parameter group data_1** | 402001 | 0 | Nilai dari parameter di slot 1 |
| **User parameter group data_2** | 402002 | 0 | Nilai dari parameter di slot 2 |
| ... berlanjut hingga ... | ... | ... | ... |
| **User parameter group data_30**| 402030 | 0 | Nilai dari parameter di slot 30 |

*(Alamat `402031` hingga `402050` adalah Reserved)*

---

## 4. User Parameter Group Setting Range (Daftar ID Parameter)

Angka di bawah ini adalah nilai (ID) yang harus Anda tuliskan ke **User parameter group Address** (Tabel 2).

### A. Monitoring Parameter (Read Only)

ID parameter `1` hingga `19` adalah parameter pemantauan (*Monitoring*). Anda hanya bisa membaca nilainya di *User Parameter Group Data*.

| ID (Setting) | Parameter | Deskripsi |
|:---:|---|---|
| **0** | Empty | Slot kosong / Tidak digunakan |
| **1** | Present Value | PV (Suhu Aktual) |
| **2** | Heating_MV | Output pemanasan saat ini |
| **3** | Cooling_MV | Output pendinginan saat ini |
| **4** | CT1 Heater Current | Arus pemanas CT1 |
| **5** | CT2 Heater Current | Arus pemanas CT2 |
| **6** | Transfer Current_MV | Output transmisi MV |
| **7** | COMM_Status | Status Komunikasi |
| **8** | PID_GROUP_NO | Grup PID saat ini |
| **9** | Program_PATN_CURR | Pattern saat ini (Mode PROG) |
| **10** | Program_Step_CURR | Step saat ini (Mode PROG) |
| **11** | Program_Process_Time | Waktu berjalan (Mode PROG) |
| **12** | Program_Wait_Time | Waktu tunggu step |
| **13** | Program_Rest_Time | Sisa waktu step |
| **14** | Program_Repeat_CNT | Jumlah pengulangan (Repeat count) |
| **15** | Timer Remainder Time | Sisa waktu timer |
| **16** | Operating_Time | Waktu operasi sejak ON |
| **17** | EVNT_STATUS | Status Event (Bit data) |
| **18** | ALARM_STATUS | Status Alarm (Bit data) |
| **19** | DI_STATUS | Status Digital Input (Bit data) |

### B. Write Parameter (Read / Write)

ID parameter `51` hingga `287` adalah parameter operasional yang dapat Anda baca dan **tulis/ubah**. *(Banyak parameter di bawah ini identik dengan [Operation Parameter](05_Operation_Parameter.md), dll)*.

| ID (Setting) | Parameter | ID (Setting) | Parameter |
|:---:|---|:---:|---|
| **51** | RUN_STOP (0: RUN, 1: STOP) | **72** | ANTI RESET WINDUP BAND |
| **52** | Timer PAUS / Continue | **73** | ALFA (2DOF CONSTANT) |
| **53** | Auto-Manual Control | **74** | Zone_Use |
| **54** | Heating_MV (Manual) | **75-78** | Zone_RP_L, C, H, dan HYS |
| **55** | Cooling_MV (Manual) | **79-88** | Input Type, Unit, Range, Scale, Bias, Filter |
| **56** | Set_Value (Target Suhu / SV) | **89** | SV Low Limit |
| **57** | Mode Select (FIX/PROG) | **90** | SV High Limit |
| **58** | PID Control Select | **91-94** | Analog Output 1 (Mode, Range, Scale L/H) |
| **59** | Multi SV No (Memilih profil SV) | **95-103**| Pattern Setup (Time unit, Start, Wait, End State) |
| **60-63** | SV-0 hingga SV-3 Setting Value | **104-143**| Pattern STEP_SV_0 s/d STEP_TIM_19 |
| **64** | Auto-Tuning Execute | **144-156**| Control Method, Sampling, SSR Type, Heating/Cooling Control Time, Deadband |
| **65** | Autotuning Mode | **157-160**| Heating/Cooling ON Hysteresis & OFF Offset |
| **66-71** | Heating & Cooling PID Constants | **161-169**| MV Limit, Timer Mode, On/Off Time, Ramp Rate |
| **170** | PID Group Number | **257-260**| PLC Write Parameter 34 - 37 |
| **171-176** | n.Heating/Cooling PID Constants | **261** | PLC Setting Copy |
| **177** | Event Setting | **262-269**| Power ON, Alarm Out Control, Manual MV, Error MV, Stop MV |
| **178-189** | Alarm Mode.n, Low, High, Hysteresis, LBA, Output Connection (NO/NC) | **270-272**| SoftStart Time, Unit, MV |
| **190-191** | Alarm ON/OFF Delay Time.n | **273** | Alarm Reset |
| **192-206** | RS485 Protocol, Baudrate, Parity, Stop Bit, Unit Addr | **274-279**| Digital Input 0 - 5 Func |
| **207-222** | PLC Monitoring 0 - 15 | **280-283**| User Switch & Shortcut Setting 1 - 3 |
| **223-256** | PLC Write Parameter 0 - 33 | **284-287**| User Level, Password, Lock Parameter, Initialize |

> [!TIP]
> **Catatan:** ID parameter yang tertera di atas pada rentang **PLC Write Parameter** sama persis dan ekuivalen penggunaannya pada fitur *PLC ladderless communication*. Daftar ini menyatukan semua kontrol perangkat ke dalam satu indeks ID yang seragam.
