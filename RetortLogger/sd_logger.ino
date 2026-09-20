// ============================================================
//  sd_logger.ino  –  MicroSD TXT logging (tab-separated)
//  Pin: CS=10, MOSI=11, CLK=12, MISO=13
// TXT: Actual \t Setting \t MV \t Phase \t ISO
// ============================================================

#if USE_SD

#include <SD.h>
#include <SPI.h>

extern AppConfig   cfg;
extern RetortState state;
extern volatile bool gLogStartReq;
extern volatile bool gLogStopReq;
extern char gLastClock[32];
extern char gLastIso[26];
extern bool sdLock(uint32_t ms);
extern void sdUnlock();
extern float mvSimEffectivePercent();
extern const char* phaseName(RetortPhase p);

#define SD_LOG_DIR "/retort"
#define CSV_RING_N     300
#define CSV_LINE_MAX   96

static File logFile;
static char logPath[48] = {0};

// Ring buffer baris log — jaring bila SD sesaat sibuk (anti-drop saat logging).
static char gRing[CSV_RING_N][CSV_LINE_MAX];
static uint16_t gRingHead = 0;
static uint16_t gRingCount = 0;
volatile uint16_t gRingDepth = 0;
volatile uint32_t gCsvDropped = 0;

// Path file log aktif. Setelah ditutup dibuat marker .ready untuk uploader file.
const char* sdCurrentLogPath() { return logPath; }

static void ringReset() {
  gRingHead = 0;
  gRingCount = 0;
  gRingDepth = 0;
}

static void formatCsvLine(char* line, size_t len) {
  snprintf(line, len, "%.1f\t%.1f\t%.1f\t%s\t%s\n",
           state.temperature, state.setpoint, mvSimEffectivePercent(),
           phaseName(state.phase), gLastIso);
}

static void ringPush(const char* line) {
  if (gRingCount >= CSV_RING_N) {
    gCsvDropped++;
    Serial.println(F("[SD] Ring penuh — baris log dibuang (ganti kartu SD)"));
    return;
  }
  uint16_t idx = (uint16_t)((gRingHead + gRingCount) % CSV_RING_N);
  strncpy(gRing[idx], line, CSV_LINE_MAX - 1);
  gRing[idx][CSV_LINE_MAX - 1] = '\0';
  gRingCount++;
  gRingDepth = gRingCount;
}

static bool ringWriteLine(const char* line) {
  if (!logFile) return false;
  return logFile.print(line) > 0;
}

static void ringFlush() {
  while (gRingCount > 0 && logFile) {
    if (!ringWriteLine(gRing[gRingHead])) break;
    logFile.flush();
    gRingHead = (uint16_t)((gRingHead + 1) % CSV_RING_N);
    gRingCount--;
    gRingDepth = gRingCount;
  }
}

static void ensureDir() {
  if (!SD.exists(SD_LOG_DIR)) SD.mkdir(SD_LOG_DIR);
}

static void openNewLog() {
  // Nama file sortable & tak ambigu: "YYYYMMDD_HHMMSS.txt" (24 jam).
  // Aman dibaca RTC di sini karena openNewLog dipanggil dari loggerTask
  // (task yang sama yang memiliki akses I2C/RTC → tak ada race).
  char clean[20] = {0};
  getTimestampFile(clean, sizeof(clean));
  if (clean[0] == '\0') snprintf(clean, sizeof(clean), "%lu", millis());
  snprintf(logPath, sizeof(logPath), "%s/%s.txt", SD_LOG_DIR, clean);
  ensureDir();
  logFile = SD.open(logPath, FILE_APPEND);
  if (logFile) {
    if (logFile.size() == 0) {
      // Format TXT tab-separated: Actual, Setting, MV, Phase, ISO (hemat ~35% bandwidth)
      logFile.println(F("Actual\tSetting\tMV\tPhase\tISO"));
    }
    Serial.printf("[SD] Log: %s\n", logPath);
  }
}

void setupSDLogger() {
  SPI.begin(PIN_SD_CLK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  if (!SD.begin(PIN_SD_CS)) {
    Serial.println(F("[SD] Mount failed!"));
    state.sdReady = false;
    return;
  }
  state.sdReady = true;
  ensureDir();
  uint64_t t = SD.totalBytes();
  uint64_t u = SD.usedBytes();
  Serial.printf("[SD] OK. Total=%lluMB Free=%lluMB\n",
                t / 1048576ULL, (t - u) / 1048576ULL);
  // File log dibuka saat sesi dimulai (Start), bukan saat boot.
}

// Mulai/akhiri sesi log dipanggil dari web/MQTT (core lain). JANGAN sentuh SD
// di sini — cukup set flag. Pembukaan/penutupan file dilakukan task logger
// (lewat sdServiceLog) agar SEMUA akses SD terjadi di satu konteks.
void sdStartLog() { gLogStartReq = true; }
void sdStopLog()  { gLogStopReq  = true; }

// loop() utama tidak lagi menulis SD (pindah ke task logger).
void loopSDLogger() {}

// Tulis satu baris CSV. Dipanggil sdServiceLog (sudah memegang kunci SD).
void sdLogEntry() {
  if (!state.sdReady || !logFile) return;
  char line[CSV_LINE_MAX];
  formatCsvLine(line, sizeof(line));
  if (ringWriteLine(line)) logFile.flush();
}

// Dipanggil tiap 1 detik dari loggerTask. Menangani start/stop rekam dan
// menulis baris CSV, SEMUA di bawah kunci SD (aman terhadap akses web).
void sdServiceLog() {
  if (!state.sdReady) return;

  char line[CSV_LINE_MAX] = {0};
  const bool hasLine = state.logging;
  if (hasLine) formatCsvLine(line, sizeof(line));

  if (!sdLock(2000)) {
    if (hasLine) ringPush(line);
    return;
  }

  if (gLogStartReq) {
    gLogStartReq = false;
    ringReset();
    gCsvDropped = 0;
    if (logFile) { logFile.flush(); logFile.close(); }
    openNewLog();
  }
  if (gLogStopReq) {
    gLogStopReq = false;
    if (logFile) {
      ringFlush();
      logFile.flush();
      logFile.close();
      Serial.printf("[SD] Log closed: %s\n", logPath);
      char readyPath[72];
      snprintf(readyPath, sizeof(readyPath), "%s.ready", logPath);
      File marker = SD.open(readyPath, FILE_WRITE);
      if (marker) {
        marker.print(F("ready"));
        marker.close();
        Serial.printf("[SD] CSV queued: %s\n", readyPath);
      } else {
        Serial.printf("[SD] Gagal membuat marker upload: %s\n", readyPath);
      }
    }
    ringReset();
  }
  if (hasLine && logFile) {
    ringFlush();
    if (!ringWriteLine(line)) {
      ringPush(line);
    } else {
      logFile.flush();
    }
  }

  sdUnlock();
}

#else

volatile uint16_t gRingDepth = 0;
volatile uint32_t gCsvDropped = 0;

void setupSDLogger() {}
void loopSDLogger() {}
void sdLogEntry() {}
void sdServiceLog() {}
void sdStartLog() {}
void sdStopLog() {}

#endif
