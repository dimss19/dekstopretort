<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Services\MqttService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class EspMonitorController extends Controller
{
    /**
     * Display the ESP32 Retort Logger live monitoring dashboard.
     */
    public function index(Request $request)
    {
        $request->session()->put('active_mode', 'esp');
        $request->session()->forget(['active_tn_id', 'active_tn_model']);

        $devices = Device::all();
        $selectedCode = $request->query('machine_code', $devices->first()?->machine_code ?? 'RT-001');

        $device = $devices->firstWhere('machine_code', $selectedCode) ?? (object)[
            'id' => 1,
            'machine_code' => $selectedCode,
            'name' => 'ESP Retort Logger',
            'firmware_version' => '1.0.0',
            'mqtt_broker' => config('mqtt.host', '127.0.0.1'),
            'mqtt_port' => 1883,
            'is_online' => false,
        ];

        // Retrieve real telemetry and connectivity status
        $isOnline = $this->checkIsOnline($selectedCode);
        $latest = $this->getRealTelemetry($selectedCode, $isOnline);
        $history = $this->getHistory($selectedCode);
        $systemEvent = Cache::get("esp_latest_system_event_{$selectedCode}");

        $processHistories = \App\Models\TnProcessHistory::with('controller.machine')
            ->latest('start_time')
            ->take(30)
            ->get();

        // Default or cached pattern steps for this ESP logger
        $cachedPattern = Cache::get("esp_pattern_{$selectedCode}");
        if ($cachedPattern && isset($cachedPattern['steps'])) {
            foreach ($cachedPattern['steps'] as &$step) {
                if (isset($step['target_sv']) && $step['target_sv'] > 300) {
                    $step['target_sv'] = (float)($step['target_sv'] / 10);
                }
            }
            $pattern = $cachedPattern;
        } else {
            $pattern = [
                'time_unit' => 'MM.SS',
                'pattern_number' => 0,
                'steps' => [
                    ['step_number' => 0, 'step_name' => 'Step 1', 'target_sv' => 117.0, 'duration' => 2, 'end_action' => 'CONT'],
                    ['step_number' => 1, 'step_name' => 'Step 2', 'target_sv' => 117.0, 'duration' => 35, 'end_action' => 'CONT'],
                    ['step_number' => 2, 'step_name' => 'Step 2', 'target_sv' => 125.0, 'duration' => 3, 'end_action' => 'CONT'],
                    ['step_number' => 3, 'step_name' => 'Step 3', 'target_sv' => 125.0, 'duration' => 100, 'end_action' => 'CONT'],
                ]
            ];
        }

        return Inertia::render('Esp/Monitor', [
            'device' => $device,
            'devices' => $devices,
            'initialTelemetry' => $latest,
            'history' => $history,
            'isOnline' => (bool)$isOnline,
            'systemEvent' => $systemEvent,
            'histories' => $processHistories,
            'initialPattern' => $pattern,
        ]);
    }

    /**
     * Save Pattern steps and sync to ESP32 via MQTT.
     */
    public function savePattern(Request $request, MqttService $mqttService)
    {
        $validated = $request->validate([
            'machine_code' => ['required', 'string'],
            'time_unit' => ['nullable', 'string', 'in:MM.SS,HH.MM'],
            'pattern_number' => ['nullable', 'integer', 'min:0', 'max:9'],
            'pattern_end_state' => ['nullable', 'string', 'in:STOP,HOLD,NEXT,PRE'],
            'steps' => ['required', 'array', 'min:1', 'max:20'],
            'steps.*.step_name' => ['nullable', 'string', 'max:50'],
            'steps.*.target_sv' => ['required', 'numeric'],
            'steps.*.duration' => ['required', 'numeric', 'min:0'],
            'steps.*.end_action' => ['nullable', 'string', 'in:CONT,HOLD,STOP'],
        ]);

        $machineCode = $validated['machine_code'];
        $steps = [];

        foreach ($validated['steps'] as $idx => $s) {
            $steps[] = [
                'step_number' => $idx,
                'step_name' => $s['step_name'] ?? "Step " . ($idx + 1),
                'target_sv' => (float)$s['target_sv'],
                'duration' => (int)$s['duration'],
                'end_action' => $s['end_action'] ?? 'CONT',
            ];
        }

        $patternData = [
            'machine_code' => $machineCode,
            'time_unit' => $validated['time_unit'] ?? 'MM.SS',
            'pattern_number' => $validated['pattern_number'] ?? 0,
            'pattern_end_state' => $validated['pattern_end_state'] ?? 'STOP',
            'steps' => $steps,
            'updated_at' => now()->toIso8601String(),
        ];

        // Store in cache
        Cache::put("esp_pattern_{$machineCode}", $patternData, now()->addDays(30));

        // Publish via MQTT
        $device = Device::where('machine_code', $machineCode)->first() ?? (object)['machine_code' => $machineCode];
        $mqttPublished = $mqttService->publishPattern($device, $patternData);

        return back()->with('success', $mqttPublished
            ? 'Pattern berhasil disimpan dan disinkronkan ke ESP via MQTT!'
            : 'Pattern berhasil disimpan (MQTT gagal dikirim, periksa koneksi broker).');
    }

    /**
     * Server-Sent Events (SSE): Push real-time telemetry updates cleanly without thread starvation.
     */
    public function stream(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $machineCode = $request->query('machine_code', 'RT-001');

        return response()->stream(function () use ($machineCode) {
            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $isOnline = $this->checkIsOnline($machineCode);
            $latest = $this->getRealTelemetry($machineCode, $isOnline);
            $history = $this->getHistory($machineCode);
            $seq = (int) Cache::get("esp_telemetry_seq_{$machineCode}", time());

            $payload = [
                'telemetry' => $latest,
                'is_online' => $isOnline,
                'history' => $history,
                'seq' => $seq,
            ];

            echo 'data: ' . json_encode($payload, JSON_UNESCAPED_UNICODE) . "\n\n";
            echo ": ok\n\n";
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'close',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Polling endpoint for fast JSON live telemetry.
     */
    public function liveData(Request $request)
    {
        $machineCode = $request->query('machine_code', 'RT-001');
        $isOnline = $this->checkIsOnline($machineCode);
        $latest = $this->getRealTelemetry($machineCode, $isOnline);
        $history = $this->getHistory($machineCode);

        // Only append to history if ESP is online and valid reading
        if ($isOnline && isset($latest['pv']) && $latest['pv'] !== null) {
            $lastPoint = end($history);
            if (!$lastPoint || ($lastPoint['ts'] ?? '') !== ($latest['ts'] ?? '')) {
                $history[] = [
                    'pv' => $latest['pv'],
                    'sv' => $latest['sv'] ?? 121.0,
                    'heating_mv' => $latest['mv'] ?? 0,
                    'mv' => $latest['mv'] ?? 0,
                    'phase' => $latest['phase'] ?? 'IDLE',
                    'created_at' => $latest['ts'] ?? now()->toIso8601String(),
                    'ts' => $latest['ts'] ?? now()->toIso8601String(),
                    'recorded_at' => $latest['ts'] ?? now()->toIso8601String(),
                ];
                if (count($history) > 120) {
                    $history = array_slice($history, -120);
                }
                Cache::put("esp_telemetry_history_{$machineCode}", $history, now()->addHours(6));
            }
        }

        $seq = (int) Cache::get("esp_telemetry_seq_{$machineCode}", time());

        return response()->json([
            'telemetry' => $latest,
            'is_online' => $isOnline,
            'history' => $history,
            'seq' => $seq,
        ]);
    }

    /**
     * Realtime connectivity and IP status endpoint.
     */
    public function status(Request $request)
    {
        $machineCode = $request->query('machine_code', 'RT-001');
        $isOnline = $this->checkIsOnline($machineCode);
        $detectedIp = Cache::get("esp_ip_{$machineCode}") ?? Cache::get("esp_ip");
        $lastSeen = Cache::get("esp_last_seen_{$machineCode}") ?? Cache::get("esp_last_seen");

        return response()->json([
            'is_online' => $isOnline,
            'ip' => $isOnline && $detectedIp ? $detectedIp : null,
            'detected_ip' => $detectedIp,
            'last_seen' => $lastSeen,
        ]);
    }

    /**
     * Check if ESP has published within the last 25 seconds.
     */
    protected function checkIsOnline(string $machineCode): bool
    {
        $lastSeen = Cache::get("esp_last_seen_{$machineCode}") ?? Cache::get("esp_last_seen");
        return (bool)($lastSeen && (time() - (int)$lastSeen) < 25);
    }

    /**
     * Retrieve real telemetry from cache or standby structure if offline.
     */
    protected function getRealTelemetry(string $machineCode, bool $isOnline): array
    {
        $cached = Cache::get("esp_latest_telemetry_{$machineCode}");
        if ($cached && is_array($cached)) {
            if (!$isOnline) {
                $cached['phase'] = 'OFFLINE';
                $cached['run'] = false;
            }
            return $cached;
        }

        return [
            'machine_code' => $machineCode,
            'id' => $machineCode,
            'pv' => null,
            'sv' => null,
            'actual' => null,
            'setting' => null,
            'mv' => 0.0,
            'phase' => 'OFFLINE',
            'ps' => '00.00',
            'tot' => '00:00',
            'stp' => '00:00',
            'pattern' => 0,
            'step' => 0,
            'run' => false,
            'logging' => false,
            'ts' => now()->format('Y-m-d H:i:s'),
            'iso' => now()->toIso8601String(),
            'recorded_at' => now()->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * Get real history points cached from live MQTT stream.
     */
    protected function getHistory(string $machineCode): array
    {
        $cached = Cache::get("esp_telemetry_history_{$machineCode}");
        return (is_array($cached) && !empty($cached)) ? $cached : [];
    }
}
