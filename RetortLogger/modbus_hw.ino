// ============================================================
//  modbus_hw.ino  –  Autonics TNL-P46RR-RS-035 via RS485
//  Satu blok FC04 0x03E8..0x03FF: PV, SV, MV, RUN, P/S, TOT, STP.
//  Raw Modbus RTU + gap antar frame RS485.
//  Dipanggil dari loggerTask (core 1) tiap 1 detik.
// ============================================================

#if USE_MODBUS

extern AppConfig   cfg;
extern RetortState state;

// FC04 Input Register — blok kontigu PV .. Program_Rest_Time (TN-Modbus 301001..301024)
#define TNL_REG_BLOCK      0x03E8
#define TNL_BLOCK_N        24   // 0x03E8 .. 0x03FF
#define OFF_PV             0    // 301001
#define OFF_DP             1
#define OFF_SV             3    // 301004
#define OFF_HMV            4
#define OFF_CMV            5
#define OFF_RUN_MON        14   // 301015 0x03F6
#define OFF_PATN           19   // 301020 0x03FB
#define OFF_STEP           20
#define OFF_PROC_TIME      21   // TOT 301022
#define OFF_REST_TIME      23   // STP 301024 (skip wait @22)

#define TNL_REG_TIME_UNIT  0x00C8 // FC03 400201: 0=MM.SS, 1=HH.MM
#define TNL_DI_FC02_ADDR   0x0023
#define TNL_SLAVE_ID       1
#define MB_BAUD            9600
#define MB_FORMAT          SERIAL_8N1
#define MB_TIMEOUT_MS      200
#define MB_INTERFRAME_MS   5     // ≥3.5 char time @9600

#define USE_AUTO_TRIGGER   true
#define MV_ON_RAW          0
#define STOP_DEBOUNCE_N    5

#define TNL_PV_OPEN        31000
#define TNL_PV_HHHH        30000
#define TNL_PV_LLLL       -30000

static bool gDi1On = false;
bool tnlDiIsActive() { return gDi1On; }

static SemaphoreHandle_t gMbMutex = NULL;
static uint16_t lastDp = 1;
static uint8_t  gTimeUnit = 0;
static uint8_t  gTuReloadSec = 0;
static uint8_t  gDebugSec = 0;

static bool mbRead(uint8_t fc, uint16_t addr, uint8_t count, uint16_t* out);
static bool mbWriteSingle(uint16_t addr, uint16_t value);
static bool mbWriteMultiple(uint16_t addr, uint8_t count, const uint16_t* values);


static void tnlFormatTimeRaw(uint16_t raw, uint8_t timeUnit, char* out, size_t outLen) {
  uint16_t hi = raw / 100;
  uint16_t lo = raw % 100;
  if (timeUnit == 1) {
    snprintf(out, outLen, "%02u:%02u", (unsigned)hi, (unsigned)lo);
  } else {
    if (lo > 59) lo = 59;
    snprintf(out, outLen, "%02u:%02u", (unsigned)hi, (unsigned)lo);
  }
}

static void mbInterFrameGap() {
  delay(MB_INTERFRAME_MS);
}

static void tnlLoadTimeUnit() {
  uint16_t tuRaw = 0;
  if (mbRead(0x03, TNL_REG_TIME_UNIT, 1, &tuRaw)) {
    gTimeUnit = (uint8_t)(tuRaw & 1);
  }
}

static void tnlApplyProgramFromBlock(const uint16_t* r) {
  state.pattern = (uint8_t)r[OFF_PATN];
  state.step    = (uint8_t)r[OFF_STEP];
  if (state.pattern > 9)  state.pattern = 9;
  if (state.step > 19)    state.step = 19;

  uint8_t tu = gTimeUnit;
  tnlFormatTimeRaw(r[OFF_PROC_TIME], tu, state.totMs, sizeof(state.totMs));
  tnlFormatTimeRaw(r[OFF_REST_TIME], tu, state.stpMs, sizeof(state.stpMs));
}

static inline void mbTx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, HIGH);
#endif
}
static inline void mbRx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, LOW);
#endif
}

static uint16_t mbCrc(const uint8_t* buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) {
      if (crc & 1) { crc >>= 1; crc ^= 0xA001; }
      else         { crc >>= 1; }
    }
  }
  return crc;
}

static bool mbRead(uint8_t fc, uint16_t addr, uint8_t count, uint16_t* out) {
  if (count == 0 || count > 60) return false;

  mbInterFrameGap();

  uint8_t req[8];
  req[0] = TNL_SLAVE_ID;
  req[1] = fc;
  req[2] = (addr >> 8) & 0xFF;
  req[3] = addr & 0xFF;
  req[4] = 0x00;
  req[5] = count;
  uint16_t c = mbCrc(req, 6);
  req[6] = c & 0xFF;
  req[7] = (c >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();
  mbTx();
  Serial1.write(req, 8);
  Serial1.flush();
  mbRx();

  const uint8_t need = (uint8_t)(5 + count * 2);
  uint8_t resp[128];
  if (need > sizeof(resp)) return false;

  uint8_t got = 0;
  uint32_t start = millis();
  while (millis() - start < MB_TIMEOUT_MS) {
    while (Serial1.available() && got < sizeof(resp)) resp[got++] = Serial1.read();
    if (got >= need) break;
  }
  if (got < need)              return false;
  if (resp[0] != TNL_SLAVE_ID) return false;
  if (resp[1] != fc)           return false;
  if (resp[2] != count * 2)    return false;
  uint16_t calc  = mbCrc(resp, (uint8_t)(3 + count * 2));
  uint16_t rxcrc = resp[3 + count * 2] | (resp[4 + count * 2] << 8);
  if (calc != rxcrc)           return false;
  for (uint8_t i = 0; i < count; i++)
    out[i] = (uint16_t)((resp[3 + i * 2] << 8) | resp[4 + i * 2]);
  return true;
}

static bool mbReadDiscrete(uint16_t addr, uint8_t qty, uint8_t* bitsOut) {
  mbInterFrameGap();

  uint8_t req[8];
  req[0] = TNL_SLAVE_ID;
  req[1] = 0x02;
  req[2] = (addr >> 8) & 0xFF;
  req[3] = addr & 0xFF;
  req[4] = 0x00;
  req[5] = qty;
  uint16_t c = mbCrc(req, 6);
  req[6] = c & 0xFF;
  req[7] = (c >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();
  mbTx();
  Serial1.write(req, 8);
  Serial1.flush();
  mbRx();

  uint8_t resp[16];
  uint8_t got = 0;
  uint32_t start = millis();
  while (millis() - start < MB_TIMEOUT_MS) {
    while (Serial1.available() && got < sizeof(resp)) resp[got++] = Serial1.read();
    if (got >= 5) break;
  }
  if (got < 5 || resp[0] != TNL_SLAVE_ID) return false;
  if (resp[1] & 0x80 || resp[1] != 0x02) return false;
  uint8_t bc = resp[2];
  if (got < (uint8_t)(3 + bc + 2)) return false;
  uint16_t calc = mbCrc(resp, (uint8_t)(3 + bc));
  uint16_t rxcrc = resp[3 + bc] | (resp[4 + bc] << 8);
  if (calc != rxcrc) return false;
  for (uint8_t i = 0; i < qty && i < 8; i++) {
    uint8_t byteIdx = i / 8;
    uint8_t bitIdx  = i % 8;
    bitsOut[i] = (resp[3 + byteIdx] >> bitIdx) & 1;
  }
  return true;
}

static float dpDivisor(uint16_t dp) {
  float div = 1.0f;
  for (uint16_t i = 0; i < dp && i < 3; i++) div *= 10.0f;
  return div;
}

static bool mbWriteSingle(uint16_t addr, uint16_t value) {
  mbInterFrameGap();

  uint8_t req[8];
  req[0] = TNL_SLAVE_ID;
  req[1] = 0x06;
  req[2] = (addr >> 8) & 0xFF;
  req[3] = addr & 0xFF;
  req[4] = (value >> 8) & 0xFF;
  req[5] = value & 0xFF;
  uint16_t c = mbCrc(req, 6);
  req[6] = c & 0xFF;
  req[7] = (c >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();
  mbTx();
  Serial1.write(req, 8);
  Serial1.flush();
  mbRx();

  uint8_t resp[8];
  uint8_t got = 0;
  uint32_t start = millis();
  while (millis() - start < MB_TIMEOUT_MS) {
    while (Serial1.available() && got < sizeof(resp)) resp[got++] = Serial1.read();
    if (got >= 8) break;
  }
  if (got < 8) return false;
  if (resp[0] != TNL_SLAVE_ID) return false;
  if (resp[1] != 0x06) return false;
  uint16_t calc  = mbCrc(resp, 6);
  uint16_t rxcrc = resp[6] | (resp[7] << 8);
  return (calc == rxcrc);
}

static bool mbWriteMultiple(uint16_t addr, uint8_t count, const uint16_t* values) {
  if (count == 0 || count > 50) return false;
  mbInterFrameGap();

  uint8_t byteCount = count * 2;
  uint8_t req[128];
  req[0] = TNL_SLAVE_ID;
  req[1] = 0x10; // FC16
  req[2] = (addr >> 8) & 0xFF;
  req[3] = addr & 0xFF;
  req[4] = 0x00;
  req[5] = count;
  req[6] = byteCount;
  for (uint8_t i = 0; i < count; i++) {
    req[7 + i * 2]     = (values[i] >> 8) & 0xFF;
    req[7 + i * 2 + 1] = values[i] & 0xFF;
  }
  uint8_t totalReqLen = 7 + byteCount;
  uint16_t c = mbCrc(req, totalReqLen);
  req[totalReqLen]     = c & 0xFF;
  req[totalReqLen + 1] = (c >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();
  mbTx();
  Serial1.write(req, totalReqLen + 2);
  Serial1.flush();
  mbRx();

  uint8_t resp[8];
  uint8_t got = 0;
  uint32_t start = millis();
  while (millis() - start < MB_TIMEOUT_MS) {
    while (Serial1.available() && got < sizeof(resp)) resp[got++] = Serial1.read();
    if (got >= 8) break;
  }
  if (got < 8) return false;
  if (resp[0] != TNL_SLAVE_ID) return false;
  if (resp[1] != 0x10) return false;
  uint16_t calc  = mbCrc(resp, 6);
  uint16_t rxcrc = resp[6] | (resp[7] << 8);
  return (calc == rxcrc);
}

bool tnlWritePattern(uint8_t patnNum, const PatternStep* steps, uint8_t stepCount, uint8_t timeUnit, uint8_t endState) {
  if (stepCount > 20) stepCount = 20;
  if (patnNum > 9) patnNum = 0;

  Serial.printf("[MODBUS] Writing Pattern %u (%u steps) to TNL Controller...\n", (unsigned)patnNum, (unsigned)stepCount);

  if (gMbMutex && xSemaphoreTake(gMbMutex, pdMS_TO_TICKS(1500)) != pdTRUE) {
    Serial.println(F("[MODBUS] ERR: Failed to acquire bus mutex for pattern write"));
    return false;
  }

  bool ok = true;

  // 1. Ensure controller is in PROG mode (Register 400007 / 0x0006 = 1)
  mbWriteSingle(0x0006, 1);
  delay(20);

  // 2. Select Pattern Number in register 400205 (0x00CC / offset 204)
  if (!mbWriteSingle(0x00CC, patnNum)) {
    Serial.printf("[MODBUS] ERR: failed to set pattern number %u\n", (unsigned)patnNum);
    ok = false;
  }
  delay(30);

  // 3. Write Pattern Base Configuration (400201..400209 / 0x00C8..0x00D0, 9 registers)
  uint16_t baseCfg[9];
  baseCfg[0] = (timeUnit & 1); // 400201: 0=MM.SS, 1=HH.MM
  baseCfg[1] = 0;             // 400202: 0=SSV
  baseCfg[2] = 20;            // 400203: Wait width 2.0C
  baseCfg[3] = 0;             // 400204: Wait time
  baseCfg[4] = patnNum;       // 400205: Pattern number
  baseCfg[5] = 0;             // 400206: Repetitions
  baseCfg[6] = (endState <= 3) ? endState : 0; // 400207: End State
  baseCfg[7] = 0;             // 400208: PID group
  baseCfg[8] = stepCount;     // 400209: Step count

  if (!mbWriteMultiple(0x00C8, 9, baseCfg)) {
    Serial.println(F("[MODBUS] ERR: failed to write pattern base config"));
    ok = false;
  }
  delay(30);

  // 4. Write Step Registers (400210..400249 / 0x00D1..0x00F8, 40 registers)
  uint16_t stepRegs[40];
  memset(stepRegs, 0, sizeof(stepRegs));

  float div = dpDivisor(lastDp);
  for (uint8_t i = 0; i < stepCount; i++) {
    float sv = steps[i].targetSv;
    uint16_t svRaw = (uint16_t)round(sv * div);
    uint16_t timRaw = (uint16_t)steps[i].duration;

    stepRegs[i * 2]     = svRaw;
    stepRegs[i * 2 + 1] = timRaw;
  }

  // Attempt writing 40 registers, or fallback to 2 chunks of 20
  if (!mbWriteMultiple(0x00D1, 40, stepRegs)) {
    Serial.println(F("[MODBUS] Retrying steps in 2 chunks of 20..."));
    delay(30);
    bool c1 = mbWriteMultiple(0x00D1, 20, &stepRegs[0]);
    delay(30);
    bool c2 = mbWriteMultiple(0x00D1 + 20, 20, &stepRegs[20]);
    if (!c1 || !c2) {
      Serial.println(F("[MODBUS] ERR: failed to write pattern steps"));
      ok = false;
    }
  }

  // 5. Verify pattern number was written correctly (read-back)
  delay(30);
  uint16_t verifyPn = 0;
  if (mbRead(0x03, 0x00CC, 1, &verifyPn)) {
    if (verifyPn != patnNum) {
      Serial.printf("[MODBUS] WARN: Pattern verify mismatch (wrote=%u, read=%u)\n",
                    (unsigned)patnNum, (unsigned)verifyPn);
      ok = false;
    }
  }

  if (gMbMutex) xSemaphoreGive(gMbMutex);

  if (ok) {
    Serial.printf("[MODBUS] SUCCESS: Pattern %u with %u steps applied to TNL controller!\n",
                  (unsigned)patnNum, (unsigned)stepCount);
  }
  return ok;
}


#define PHASE_BAND_C   5.0f
#define PHASE_TREND_C  0.2f
#define PHASE_IDLE_C   40.0f
static bool  havePrevPv = false;
static float prevPv     = 0.0f;

static void updatePhaseFromData() {
  float pv = state.temperature;
  float sv = state.setpoint;
  if (sv <= 1.0f) return;

  float trend = havePrevPv ? (pv - prevPv) : 0.0f;
  prevPv = pv;
  havePrevPv = true;

  float sterilTarget    = cfg.targetTemp;
  bool  svReachedSteril = (sv >= sterilTarget - PHASE_BAND_C);
  bool  pvReachedSteril = (pv >= sterilTarget - PHASE_BAND_C);
  bool  goingDown       = (trend < -PHASE_TREND_C);

  if (svReachedSteril && pvReachedSteril) {
    if (goingDown && pv < sterilTarget - PHASE_BAND_C)
      state.phase = (pv <= PHASE_IDLE_C) ? PHASE_IDLE : PHASE_COOLING;
    else
      state.phase = PHASE_HOLDING;
  } else if (svReachedSteril && !pvReachedSteril) {
    if (goingDown)
      state.phase = (pv <= PHASE_IDLE_C) ? PHASE_IDLE : PHASE_COOLING;
    else
      state.phase = PHASE_HEATING;
  } else {
    if (goingDown)
      state.phase = (pv <= PHASE_IDLE_C) ? PHASE_IDLE : PHASE_COOLING;
    else
      state.phase = PHASE_HEATING;
  }
}

static uint16_t gMvRaw = 0;

static void updateAutoTrigger() {
  if (!USE_AUTO_TRIGGER) return;

  static uint8_t stopCnt = 0;
  bool active = gDi1On || mvSimTriggerStart(gMvRaw, MV_ON_RAW);

  if (active) {
    stopCnt = 0;
    if (!state.logging) startProcess();
  } else if (state.logging) {
    if (++stopCnt >= STOP_DEBOUNCE_N) {
      stopCnt = 0;
      stopProcess();
    }
  }
}

void setupModbus() {
#if PIN_RS485_DE >= 0
  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW);
#endif
  if (!gMbMutex) {
    gMbMutex = xSemaphoreCreateMutex();
  }
  Serial1.begin(MB_BAUD, MB_FORMAT, PIN_RS485_RX, PIN_RS485_TX);
  delay(50);
  tnlLoadTimeUnit();
  Serial.println(F("[MODBUS] Autonics TNL initialized (raw RTU)."));
  Serial.printf("[MODBUS] RX=%d TX=%d DE=%d Slave=%d @%d block=0x%03X x%d tu=%u\n",
                PIN_RS485_RX, PIN_RS485_TX, PIN_RS485_DE,
                TNL_SLAVE_ID, MB_BAUD, TNL_REG_BLOCK, TNL_BLOCK_N, (unsigned)gTimeUnit);
}

void loopModbus() {
  if (gMbMutex && xSemaphoreTake(gMbMutex, pdMS_TO_TICKS(50)) != pdTRUE) {
    return;
  }

  uint16_t r[TNL_BLOCK_N];

  if (mbRead(0x04, TNL_REG_BLOCK, TNL_BLOCK_N, r)) {
    int16_t  pvRaw = (int16_t)r[OFF_PV];
    uint16_t dp    = r[OFF_DP];
    int16_t  svRaw = (int16_t)r[OFF_SV];
    if (dp <= 3) lastDp = dp;
    float div = dpDivisor(lastDp);

    if (pvRaw == TNL_PV_OPEN || pvRaw == TNL_PV_HHHH || pvRaw == TNL_PV_LLLL) {
      Serial.printf("[MODBUS] PV sensor err: %d\n", pvRaw);
    } else {
      state.temperature = (float)pvRaw / div;
    }
    state.setpoint = (float)svRaw / div;

    uint16_t hmv = r[OFF_HMV], cmv = r[OFF_CMV];
    gMvRaw = (hmv >= cmv) ? hmv : cmv;
    state.mv = (float)gMvRaw / 10.0f;

    state.ctrlRun = (r[OFF_RUN_MON] == 0);
    tnlApplyProgramFromBlock(r);

    if (++gDebugSec >= 10) {
      gDebugSec = 0;
      Serial.printf("[MODBUS] run=%s P/S=%u-%02u raw[TOT=%u STP=%u runReg=%u] TOT=%s STP=%s tu=%u\n",
                    state.ctrlRun ? "RUN" : "STOP",
                    (unsigned)state.pattern, (unsigned)state.step,
                    (unsigned)r[OFF_PROC_TIME], (unsigned)r[OFF_REST_TIME],
                    (unsigned)r[OFF_RUN_MON],
                    state.totMs, state.stpMs, (unsigned)gTimeUnit);
      if (r[OFF_PATN] == 0 && r[OFF_PROC_TIME] == 0 && r[OFF_REST_TIME] == 0) {
        Serial.println(F("[MODBUS] hint: register program=0 — pastikan Mode PROG + RUN di panel TNL"));
      }
    }
  } else {
    Serial.println(F("[MODBUS] block read miss (FC04 0x03E8 x24)"));
  }

  if (++gTuReloadSec >= 60) {
    gTuReloadSec = 0;
    tnlLoadTimeUnit();
  }

  uint8_t diBit = 0;
  if (mbReadDiscrete(TNL_DI_FC02_ADDR, 1, &diBit)) {
    gDi1On = (diBit != 0);
  }

  updatePhaseFromData();
  updateAutoTrigger();

  if (gMbMutex) xSemaphoreGive(gMbMutex);
}

#else

void setupModbus() {}
void loopModbus() {}
bool tnlDiIsActive() { return false; }
bool tnlWritePattern(uint8_t patnNum, const PatternStep* steps, uint8_t stepCount, uint8_t timeUnit, uint8_t endState) { return true; }

#endif
