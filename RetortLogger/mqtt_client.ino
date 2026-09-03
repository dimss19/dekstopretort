// ============================================================
//  mqtt_client.ino  –  MQTT publish + subscribe + commands + ack
//  Library: PubSubClient
// ============================================================

#include <PubSubClient.h>

extern AppConfig   cfg;
extern RetortState state;
extern int gLastMqttState;
extern char gLastTs[32];
extern char gLastIso[26];

extern volatile bool gFwdHasBacklog;
extern bool gBootEventPending;
extern const char* gResetReason;

void saveWatchdogPending(bool pending);

static WiFiClient   mqttWifi;
static PubSubClient mqtt(mqttWifi);

// Cepat dulu (3s), naik ke sedang (8s) setelah gagal berulang; timeout socket 2s.
#define MQTT_SOCKET_TIMEOUT_S   2
#define MQTT_RECON_FAST_MS      3000
#define MQTT_RECON_MED_MS       8000
#define MQTT_FAIL_TO_MED        4

static unsigned long lastRecon = 0;
static unsigned long lastPub   = 0;
static uint8_t       mqttFailStreak = 0;

static unsigned long mqttReconIntervalMs() {
  return (mqttFailStreak >= MQTT_FAIL_TO_MED) ? MQTT_RECON_MED_MS : MQTT_RECON_FAST_MS;
}

void savePatternSteps(const PatternStep* steps, uint8_t count);
extern PatternStep gPatternSteps[20];
extern uint8_t     gPatternStepCount;

static void mqttHandleAck(const char* json) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;
  const char* target = doc["id"] | "";
  const char* filename = doc["file"] | "";
  const char* transferId = doc["transfer_id"] | "";
  const char* status = doc["status"] | "";
  const char* message = doc["message"] | "";
  if (strcmp(target, cfg.machineId) != 0) return;
  forwardOnAck(filename, transferId, status, message);
}

static void mqttHandlePattern(const char* json) {
  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;

  const char* target = doc["machine_id"] | "";
  if (target[0] != '\0' && strcasecmp(target, cfg.machineId) != 0) return;

  JsonArray steps = doc["steps"];
  if (steps.isNull()) return;

  uint8_t count = 0;
  for (JsonObject s : steps) {
    if (count >= 20) break;
    gPatternSteps[count].stepNumber = s["step_number"] | count;
    const char* sName = s["step_name"] | "";
    if (sName[0] != '\0') {
      strncpy(gPatternSteps[count].name, sName, sizeof(gPatternSteps[count].name) - 1);
    } else {
      snprintf(gPatternSteps[count].name, sizeof(gPatternSteps[count].name), "Step %u", (unsigned)(count + 1));
    }
    float sv = s["target_sv"] | 121.0f;
    if (sv > 300.0f) sv = sv / 10.0f;
    gPatternSteps[count].targetSv = sv;
    gPatternSteps[count].duration = s["duration"] | 60;

    const char* endAct = s["end_action"] | "CONT";
    if (strcasecmp(endAct, "HOLD") == 0) gPatternSteps[count].endAction = 1;
    else if (strcasecmp(endAct, "STOP") == 0) gPatternSteps[count].endAction = 2;
    else gPatternSteps[count].endAction = 0;

    count++;
  }

  savePatternSteps(gPatternSteps, count);
  Serial.printf("[MQTT] Pattern steps saved to NVS (%u steps) for machine %s\n", (unsigned)count, cfg.machineId);

  uint8_t patnNum = doc["pattern_number"] | 0;
  const char* tuStr = doc["time_unit"] | "MM.SS";
  uint8_t tuVal = (strcasecmp(tuStr, "HH.MM") == 0) ? 1 : 0;
  uint8_t endState = 0;
  if (count > 0) {
    endState = gPatternSteps[count - 1].endAction;
  }

#if USE_MODBUS
  bool mbOk = tnlWritePattern(patnNum, gPatternSteps, count, tuVal, endState);
#else
  bool mbOk = true;
#endif

  // Publish ACK to retort/system
  char ackBuf[160];
  snprintf(ackBuf, sizeof(ackBuf),
           "{\"id\":\"%s\",\"event\":\"%s\",\"count\":%u,\"pattern\":%u}",
           cfg.machineId, mbOk ? "pattern_sync_ok" : "pattern_sync_err",
           (unsigned)count, (unsigned)patnNum);
  mqtt.publish("retort/system", ackBuf, false);
}

static void mqttCb(char* topic, byte* payload, unsigned int len) {
  if (len == 0 || len > 1024) return;
  char buf[1025];
  memcpy(buf, payload, len);
  buf[len] = '\0';

  if (strcmp(topic, MQTT_ACK_TOPIC) == 0) {
    mqttHandleAck(buf);
    return;
  }

  if (strstr(topic, "pattern/push") != NULL || strstr(topic, "pattern/set") != NULL) {
    mqttHandlePattern(buf);
    return;
  }

  if (strcmp(topic, cfg.mqttCmdTopic) != 0) return;

  Serial.printf("[MQTT] Cmd: %s\n", buf);

  char* colon = strchr(buf, ':');
  if (colon) {
    *colon = '\0';
    if (strcasecmp(colon + 1, cfg.machineId) != 0) {
      Serial.printf("[MQTT] Cmd ignored (target %s, this %s)\n", colon + 1, cfg.machineId);
      return;
    }
  }

  if (strcmp(buf, "START") == 0) startProcess();
  else if (strcmp(buf, "STOP") == 0) stopProcess();
  else if (strcmp(buf, "STATUS") == 0) mqttPublishState();
}

static bool mqttPublishWatchdogEvent() {
  if (!gBootEventPending || !mqtt.connected()) return false;

  char bootBuf[192];
  snprintf(bootBuf, sizeof(bootBuf),
    "{\"id\":\"%s\",\"event\":\"watchdog\",\"reason\":\"%s\",\"iso\":\"%s\",\"ts\":\"%s\"}",
    cfg.machineId, gResetReason, gLastIso, gLastTs);

  if (!mqtt.publish("retort/system", bootBuf, false)) {
    Serial.println(F("[MQTT] Watchdog publish FAILED — retry"));
    return false;
  }

  gBootEventPending = false;
  saveWatchdogPending(false);
  Serial.printf("[MQTT] Watchdog event published: %s @ %s\n", gResetReason, gLastTs);
  mqttPublishState();
  return true;
}

static bool mqttRecon() {
  if (WiFi.status() != WL_CONNECTED) return false;
  bool ok;
  if (cfg.mqttUser[0]) ok = mqtt.connect(cfg.machineId, cfg.mqttUser, cfg.mqttPass);
  else ok = mqtt.connect(cfg.machineId);
  if (ok) {
    mqttFailStreak = 0;
    mqtt.subscribe(cfg.mqttCmdTopic);
    mqtt.subscribe(MQTT_ACK_TOPIC);

    char patnTopic[80];
    snprintf(patnTopic, sizeof(patnTopic), "retort/%s/pattern/push", cfg.machineId);
    mqtt.subscribe(patnTopic);
    mqtt.subscribe("retort/pattern/push");

    state.mqttConnected = true;
    gLastMqttState = 0;
    Serial.printf("[MQTT] Connected. Sub: %s + %s + %s\n", cfg.mqttCmdTopic, MQTT_ACK_TOPIC, patnTopic);

    mqttPublishWatchdogEvent();
  } else {
    if (mqttFailStreak < 255) mqttFailStreak++;
    state.mqttConnected = false;
    gLastMqttState = mqtt.state();
    Serial.printf("[MQTT] Gagal, state=%d (broker=%s:%d, retry=%us)\n",
                  gLastMqttState, cfg.mqttBroker, cfg.mqttPort,
                  (unsigned)(mqttReconIntervalMs() / 1000));
  }
  return ok;
}

void setupMQTT() {
  if (cfg.mqttBroker[0] == '\0') {
    Serial.println(F("[MQTT] No broker – disabled."));
    return;
  }
  mqtt.setServer(cfg.mqttBroker, cfg.mqttPort);
  mqtt.setCallback(mqttCb);
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(1024);
  mqtt.setSocketTimeout(MQTT_SOCKET_TIMEOUT_S);
  // Percobaan connect pertama segera setelah WiFi siap (tanpa tunggu interval).
  lastRecon = millis() - mqttReconIntervalMs();
}

void loopMQTT() {
  if (cfg.mqttBroker[0] == '\0') return;
  if (!mqtt.connected()) {
    state.mqttConnected = false;
#if USE_STORE_FORWARD
    forwardOnMqttLost();
#endif
    unsigned long now = millis();
    if (now - lastRecon >= mqttReconIntervalMs()) { lastRecon = now; mqttRecon(); }
    return;
  }
  mqtt.loop();
  unsigned long now = millis();
  if (gBootEventPending) {
    static unsigned long lastWdtRetry = 0;
    if (now - lastWdtRetry >= 5000) {
      lastWdtRetry = now;
      mqttPublishWatchdogEvent();
    }
  }
  if (now - lastPub >= 1000) {
    lastPub = now;
    mqttPublishState();
  }

#if USE_STORE_FORWARD
  forwardTick();
#endif
}

bool mqttIsConnected() { return mqtt.connected(); }

bool mqttPublishRaw(const char* payload) {
  if (!mqtt.connected()) return false;
  return mqtt.publish(cfg.mqttPubTopic, payload, false);
}

bool mqttPublishTopic(const char* topic, const char* payload) {
  if (!mqtt.connected()) return false;
  return mqtt.publish(topic, payload, false);
}

void mqttPublishState() {
  if (!mqtt.connected()) return;
  char ps[8];
  tnlFormatPs(ps, sizeof(ps));
  char buf[460];
  snprintf(buf, sizeof(buf),
    "{\"id\":\"%s\",\"ts\":\"%s\",\"iso\":\"%s\",\"phase\":\"%s\","
    "\"actual\":%.1f,\"setting\":%.1f,\"mv\":%.1f,"
    "\"ps\":\"%s\",\"tot\":\"%s\",\"stp\":\"%s\","
    "\"pattern\":%u,\"step\":%u,"
    "\"run\":%s,\"logging\":%s,\"backfill\":false}",
    cfg.machineId, gLastTs, gLastIso, phaseName(state.phase),
    state.temperature, state.setpoint, mvSimEffectivePercent(),
    ps, state.totMs, state.stpMs,
    (unsigned)state.pattern, (unsigned)state.step,
    state.ctrlRun ? "true" : "false",
    state.logging ? "true" : "false");
  mqtt.publish(cfg.mqttPubTopic, buf, false);
}
