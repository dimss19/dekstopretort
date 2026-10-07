# Autonics TN Series — AI Agent Reference

## 1. Product Identity

- **Manufacturer:** Autonics
- **Series:** TN Series
- **Product type:** Two-Degree-of-Freedom PID Temperature Controller
- **Manual code:** TCD210227AI
- **Supply:** 100–240 VAC, 50/60 Hz
- **Communication option:** RS485
- **Communication protocols:** Modbus RTU/ASCII, Sync-Master, PLC ladderless
- **Communication:** RS485 / RS-422A, 2-wire half duplex
- **Maximum units on RS485:** 32 units
- **Address range:** 01–99
- **Maximum communication distance:** ≤800 m
- **Maximum communication speed:** ≤115,200 bps
- **Default response time:** 20 ms
- **Data format:** 8 data bits, no parity by default, 2 stop bits by default
- **Sampling period:** 50 / 100 / 250 ms

> This document is an AI-oriented summary of the official product manual. Use the full manual when an exact wiring detail or parameter not listed here is required.

---

## 2. Model Structure

Model format:

`TN ①-②③④⑤⑥-⑦⑧-⑨`

### Meaning of each position

| Code | Meaning | Options |
|---|---|---|
| ① | Size | `S` = 48×48 mm, `H` = 48×96 mm, `L` = 96×96 mm |
| ② | Control method | blank = Fixed control, `P` = Program control |
| ③ | Power | `4` = 100–240 VAC |
| ④ | Alarm outputs | `2`, `4`, or `6` alarm outputs |
| ⑤ | Control output 1 | `R` = Relay, `S` = SSR drive, `C` = Current or SSR drive |
| ⑥ | Control output 2 | `R` = Relay, `S` = SSR drive, `C` = Current or SSR drive |
| ⑦ | Communication | `N` = None, `R` = RS485 |
| ⑧ | Terminal type | `S` = Screw |
| ⑨ | Option I/O | Depends on model |

### Important

Do **not** assume every combination of model codes is available. The manual states that the ordering table is for reference and the actual supported models must be checked against the specified product/model.

---

## 3. Supported Temperature Inputs

### Thermocouple

| Type | Range °C |
|---|---:|
| K | -200 to 1,350 |
| J | -200 to 800 |
| E | -200 to 800 |
| T | -200 to 400 |
| B | 0 to 1,800 |
| R | 0 to 1,750 |
| S | 0 to 1,750 |
| N | -200 to 1,300 |
| C | 0 to 2,300 |
| G | 0 to 2,300 |
| L | -200 to 900 |
| U | -200 to 400 |
| Platinel II | 0 to 1,390 |

### RTD

| Sensor | Range °C |
|---|---:|
| Cu50 Ω | -199.9 to 200.0 |
| Cu100 Ω | -199.9 to 200.0 |
| JPt100 Ω | -200 to 650 |
| DPt50 Ω | -199.9 to 600.0 |
| DPt100 Ω | -200 to 650 |
| Nickel120 Ω | -80 to 260 |

### Analog input

- 0–10 V
- 0–5 V
- 1–5 V
- 0–100 mV
- 0–20 mA
- 4–20 mA

---

## 4. Control Functions

Supported control types:

- ON/OFF
- P
- PI
- PD
- PID

Other control capabilities:

- Multi-SV: up to 4 SV values
- Group PID: up to 8 groups
- Zone PID: 4 zones
- ARW (Anti Reset Windup): 50–200%
- Program control: up to 10 patterns
- Steps: up to 200 total, maximum 20 steps per pattern

### PID parameters

- Proportional band (P): 0.1–999.9 ℃ or 0.1–999.9%
- Integral time (I): 0–9,999 s
- Derivative time (D): 0–9,999 s
- Manual reset: 0.0–100.0%
- Hysteresis:
  - Thermocouple/RTD: 1–100 or 0.1–100.0 ℃/℉
  - Analog: 1–100 digit
- Control cycle:
  - Relay / SSRP: 0.1–120.0 s
  - Current / SSR drive: 1.0–120.0 s

---

## 5. Outputs

### Control output

- Relay: 250 VAC, 3 A, 1a
- SSR: 12 VDC ±2 V, ≤20 mA
- Current: 0–20 mA or 4–20 mA, selectable by parameter
- Current output load resistance: ≤500 Ω

### Alarm output

- 250 VAC, 3 A, 1a

### Transmission output

- 4–20 mA
- Load resistance: ≤500 Ω
- Accuracy: ±0.3% F.S.

---

## 6. RS485 Communication

### Core settings

- Interface: RS485
- Mode: 2-wire half duplex
- Protocols:
  - Modbus RTU
  - Modbus ASCII
  - Sync-Master
  - PLC ladderless
- Connection: RS485 / RS-422A
- Maximum devices: 32
- Address: 01–99
- Maximum distance: 800 m
- Speed: up to 115,200 bps
- Start bit: 1
- Data bits: 8
- Parity:
  - None (default)
  - Even
  - Odd
- Stop bits:
  - 1
  - 2 (default)

### RS485 terminals

The terminal labels shown in the manual are:

- `RS485(A+)`
- `RS485(B-)`

For model-specific terminal numbers, use the wiring diagram for the exact series/model.

---

## 7. Wiring — Important Terminal Information

The manual provides separate diagrams for **TNS, TNH, and TNL**. Terminal numbers differ between these series.

### TNS

Important functions shown in the diagram:

- Power input: terminals `5–6`
- Control OUT1: `1–2`
- Control OUT2: `3–4`
- AL1: `13–14`
- AL2: `15–16`
- CT: `17–18`
- Communication:
  - `RS485(A+)`
  - `RS485(B-)`
- Transmission output
- Digital inputs
- Sensor input

### TNH

Terminal numbers differ from TNS. The diagram includes:

- Control OUT1: `3–4`
- Control OUT2: `5–6`
- AL1: `7–8`
- AL2: `9–10`
- Power: `11–12`
- RS485: terminals `13–14`
- AL3 / AL4
- Transmission output
- Digital inputs
- CT1 / CT2
- Sensor input

### TNL

Terminal numbers differ again. The diagram includes:

- Control OUT1: `3–4`
- Control OUT2: `5–6`
- AL1: `7–8`
- AL2: `9–10`
- Power: `11–12`
- Transmission output: `25–26`
- RS485:
  - `14 = RS485(A+)`
  - `13 = RS485(B-)`
- AL3 / AL4
- AL5 / AL6
- Digital inputs
- CT1 / CT2
- Sensor input

> **Agent rule:** Never give a terminal number without first confirming whether the device is TNS, TNH, or TNL. The terminal layout changes between series.

---

## 8. Display / Operating Values

### Main display areas

1. **PV display**
   - Present Value (measured temperature/input)
   - In setting mode, displays parameter name

2. **SV display**
   - Setting Value / target value
   - In setting mode, displays parameter value

3. **Operating value display**
   - Can show MV, P/S, TM, or CT depending on configuration

### Indicators

- `OUT1/2` = control output is ON
- `AL1–6` = corresponding alarm output is ON
- `AT` = auto tuning active
- `MAN` = manual control mode
- `STOP` = control output stopped
- `HOLD` = program control is paused
- `LOCK` = keys are locked
- `PROG` = program control active
- `WAIT` = waiting status
- `HBA1/2` = heater break alarm active

---

## 9. Basic Key Operations

### SV setting

In automatic control:

1. Press `◀`, `▲`, or `▼`
2. Move digits with `◀`
3. Change value with `▲` / `▼`
4. Save/return with `M` or wait more than 3 seconds without key input

### Control output RUN/STOP

- Press `▼ + ▲` for approximately 3 seconds.

### Key lock

- Press `◀ + ▼` for approximately 3 seconds.

### Parameter group

- Press `M` for approximately 2 seconds.

### Parameter reset

In RUN mode:

1. Press `◀ + ▲ + ▼` for more than 5 seconds.
2. `INIT` appears.
3. Select `YES` using `▲` / `▼`.
4. Press `M`.
5. All parameters return to default values and the unit returns to RUN mode.

> **Warning for agent:** Parameter reset is destructive to configured parameters. Do not recommend it as the first troubleshooting step.

---

## 10. Alarm Functions

Alarm modes include:

- `OFF` — no alarm
- `DVCC` — deviation high limit
- `]DV` — deviation low limit
- `]DVC` — deviation high/low limit
- `CdV]` — deviation high/low limit reverse
- `PVCC` — absolute value high limit
- `]]PV` — absolute value low limit

### Alarm options

- `AL-A` — standard alarm
- `AL-B` — alarm latch
- `AL-C` — standby sequence 1
- `AL-D` — alarm latch + standby sequence 1
- `AL-E` — standby sequence 2
- `AL-F` — alarm latch + standby sequence 2

### Other alarm trigger types

- `LBA` — Loop Break Alarm
- `SBA` — Sensor Break Alarm
- `HBA1` — Heater Break Alarm using CT1
- `HBA2` — Heater Break Alarm using CT2
- `RUN` — control output ON
- `STOP` — control output OFF
- `PAUS` — control output paused
- `pST` — pattern control start
- `pEND` — pattern control end
- `pOT` — pattern delay point
- `sST` — step start
- `sEND` — step end
- `sOT` — step delay point

---

## 11. Error / Status Displays

| Display | Meaning | Recommended action |
|---|---|---|
| `OPEN` | Temperature sensor disconnected/not connected | Check sensor wiring and sensor condition |
| `OPEN` (analog) | Analog input over F.S. ±10% | Check analog input |
| `HHHH` | Input above rated range | Check input range and sensor |
| `LLLL` | Input below rated range | Check input range and sensor |
| `ERR` | Setting error | Check parameter setting method |
| `TMrE` | Timer-related parameters incomplete | Complete timer parameters |
| `PTnE` | Program-related parameters incomplete | Complete program parameters |
| `Er□□` | Failed slave during Sync communication / PLC copy | Check slave connection and communication settings |

### Important safety behavior

When `HHHH` or `LLLL` occurs, the control output may operate based on the recognized maximum/minimum input depending on the control type. Do not assume the output is automatically disabled.

---

## 12. Sensor Accuracy

At room temperature (23 ±5 ℃):

- Typical thermocouple/RTD accuracy: `±0.2% of PV or ±1 ℃`, whichever is greater, plus ±1 digit.
- Some sensor types have lower accuracy limits specified in the manual.

Outside room-temperature conditions:

- General accuracy can be `±0.5% of PV or ±2 ℃`, whichever is greater, plus ±1 digit.
- Certain thermocouple/RTD types have different limits.

For exact accuracy calculations, consult the sensor-specific accuracy table in the original manual.

---

## 13. Installation / Environmental Limits

- Mount into a panel.
- Ambient temperature: `-10 to 50 ℃`
- Storage temperature: `-20 to 60 ℃`
- Ambient humidity: `35–85% RH`
- Maximum altitude: `2,000 m`
- Pollution degree: `2`
- Installation category: `II`
- Front protection: `IP65`
- Warm-up recommended: more than 20 minutes after power-on for accurate temperature measurement.

### Important wiring precautions

- Keep sensor/input signal wiring away from high-voltage and power lines.
- Do not overlap communication and power lines.
- Use twisted-pair cable for communication.
- Ferrite beads at communication cable ends are recommended to reduce external noise.
- For RTD, use 3-wire wiring with cables of the same thickness and length.
- For thermocouple extension, use the designated compensation wire.
- Do not wire unused terminals.
- Turn power OFF before changing the input sensor.
- After changing the sensor, update the corresponding input parameter.

---

## 14. AI Agent Decision Rules

When answering questions about this controller:

1. **Identify the exact series/model first**
   - TNS, TNH, or TNL
   - Exact model code if available

2. **For wiring questions**
   - Never assume terminal numbers are universal.
   - Use the correct TNS/TNH/TNL wiring diagram.

3. **For RS485 questions**
   - Confirm the device has the `R` communication option.
   - Use A+ and B- labels.
   - Default communication settings from the manual:
     - 8 data bits
     - No parity
     - 2 stop bits
     - Up to 115,200 bps

4. **For temperature sensor questions**
   - Confirm sensor type first: K, J, T, RTD, 4–20 mA, etc.
   - Check the supported range before suggesting a configuration.

5. **For troubleshooting**
   - Start with the displayed error/status.
   - Check sensor wiring, input type, parameter configuration, and communication wiring as applicable.
   - Do not recommend factory reset unless configuration recovery is actually needed.

6. **For alarm questions**
   - Determine whether the user needs deviation alarm, absolute-value alarm, sensor break, heater break, loop break, or another alarm type.

7. **For exact parameter addresses / Modbus register mapping**
   - This document does **not** contain the complete Modbus register map.
   - Do not invent register addresses.
   - The detailed user/communication manual is required.

---

## 15. Key Specifications at a Glance

| Item | Value |
|---|---|
| Product | TN Series 2-DOF PID Temperature Controller |
| Supply | 100–240 VAC, 50/60 Hz |
| Power consumption | ≤8 VA |
| Control | ON/OFF, P, PI, PD, PID |
| Sampling | 50 / 100 / 250 ms |
| Communication | RS485 |
| Protocol | Modbus RTU/ASCII + others |
| RS485 mode | 2-wire half duplex |
| Max devices | 32 |
| Address | 01–99 |
| Max speed | 115,200 bps |
| Max distance | 800 m |
| Relay output | 250 VAC, 3 A |
| SSR output | 12 VDC ±2 V, ≤20 mA |
| Current output | 0–20 mA / 4–20 mA |
| Analog inputs | 0–10 V, 0–5 V, 1–5 V, 0–100 mV, 0–20 mA, 4–20 mA |
| Program patterns | ≤10 |
| Steps | ≤200 total / ≤20 per pattern |
| Operating temperature | -10 to 50 ℃ |
| Storage temperature | -20 to 60 ℃ |
| Humidity | 35–85% RH |
| Front protection | IP65 |

---

## Source

Based on:

**Autonics TN Series — Two-Degree-of-Freedom PID Temperature Controllers, Product Manual, TCD210227AI.**

The original manual contains the detailed diagrams, dimensions, terminal drawings, alarm behavior diagrams, and complete product specifications.
