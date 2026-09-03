#pragma once
#include <stdint.h>
#include <stdbool.h>
#if __has_include(<Arduino.h>)
#include <Arduino.h>
#endif

// ============================================================
//  RetortTypes.h - Common structures and types
// ============================================================

struct AppConfig {
  char wifiSSID[33];
  char wifiPass[65];
  char mqttBroker[65];
  uint16_t mqttPort;
  char mqttUser[33];
  char mqttPass[65];
  char mqttPubTopic[65];
  char mqttCmdTopic[65];
  float targetTemp;
  uint32_t holdingTimeSec;
  float heatingRate;
  float coolingRate;
  char machineId[33];
  char passHash[65];
};

enum RetortPhase : uint8_t {
  PHASE_IDLE = 0,
  PHASE_HEATING,
  PHASE_HOLDING,
  PHASE_COOLING
};

struct RetortState {
  RetortPhase phase;
  float temperature;  // PV (actual)
  float setpoint;     // SV (setting)
  float pressure;
  float mv;           // MV output kontrol (%) — Heating/Cooling MV terbesar
  bool ctrlRun;       // status RUN/STOP controller (true = RUN)
  uint8_t pattern;    // TNL Program_PATN_CURR (FC04 0x03FB)
  uint8_t step;       // TNL Program_Step_CURR (FC04 0x03FC)
  char totMs[8];      // TNL Program_Process_Time — mirror TOT M:S
  char stpMs[8];      // sisa waktu step (Program_Rest_Time) — mirror STP M:S
  unsigned long phaseStartMs;
  bool wifiConnected;
  bool mqttConnected;
  bool sdReady;
  bool logging;       // true = sesi perekaman CSV aktif (auto-trigger)
};

struct PatternStep {
  uint8_t  stepNumber;
  char     name[24];
  float    targetSv;
  uint32_t duration;
  uint8_t  endAction; // 0=CONT, 1=HOLD, 2=STOP
};

bool tnlWritePattern(uint8_t patnNum, const PatternStep* steps, uint8_t stepCount, uint8_t timeUnit, uint8_t endState);

