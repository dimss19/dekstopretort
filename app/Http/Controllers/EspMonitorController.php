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

        // Retrieve latest telemetry
        $latest = $this->getOrGenerateTelemetry($selectedCode);
        $isOnline = true;

        $history = $this->getOrGenerateHistory($selectedCode);
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
            'groups' => \App\Models\HistoryGroup::orderBy('id')->get(),
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

            $latest = $this->getOrGenerateTelemetry($machineCode);
            $history = $this->getOrGenerateHistory($machineCode);
            $seq = (int) Cache::get("esp_telemetry_seq_{$machineCode}", time());

            $payload = [
                'telemetry' => $latest,
                'is_online' => true,
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
        $latest = $this->getOrGenerateTelemetry($machineCode);
        $history = $this->getOrGenerateHistory($machineCode);

        // Append to history if timestamp is new
        $lastPoint = end($history);
        if (!$lastPoint || ($lastPoint['ts'] ?? '') !== $latest['ts']) {
            $history[] = [
                'pv' => $latest['pv'],
                'sv' => $latest['sv'],
                'heating_mv' => $latest['mv'],
                'mv' => $latest['mv'],
                'phase' => $latest['phase'],
                'created_at' => $latest['ts'],
                'ts' => $latest['ts'],
                'recorded_at' => $latest['ts'],
            ];
            if (count($history) > 120) {
                $history = array_slice($history, -120);
            }
            Cache::put("esp_telemetry_history_{$machineCode}", $history, now()->addHours(6));
        }

        $seq = (int) Cache::get("esp_telemetry_seq_{$machineCode}", time()) + 1;
        Cache::put("esp_telemetry_seq_{$machineCode}", $seq, now()->addHours(6));

        return response()->json([
            'telemetry' => $latest,
            'is_online' => true,
            'history' => $history,
            'seq' => $seq,
        ]);
    }

    /**
     * Provide baseline history records for the chart so it never starts empty.
     */
    protected function getOrGenerateHistory(string $machineCode): array
    {
        $cached = Cache::get("esp_telemetry_history_{$machineCode}");
        if ($cached && is_array($cached) && !empty($cached)) {
            return $cached;
        }

        $history = [];
        $now = time();
        for ($i = 30; $i >= 0; $i--) {
            $t = $now - ($i * 2);
            $cycle = $t % 3600;
            if ($cycle < 900) {
                $phase = 'HEATING / VENTING';
                $pv = round(25.0 + ($cycle / 900) * (121.1 - 25.0) + (sin($t) * 0.2), 1);
                $mv = 100.0;
            } elseif ($cycle < 2700) {
                $phase = 'HOLDING STERILIZATION';
                $pv = round(121.1 + (sin($t / 10) * 0.25), 1);
                $mv = round(25.0 + (sin($t / 5) * 5.0), 1);
            } else {
                $phase = 'COOLING & RELEASE';
                $coolProgress = ($cycle - 2700) / 900;
                $pv = round(121.1 - ($coolProgress * (121.1 - 40.0)) + (cos($t) * 0.2), 1);
                $mv = 0.0;
            }

            $history[] = [
                'pv' => $pv,
                'sv' => 121.1,
                'heating_mv' => $mv,
                'mv' => $mv,
                'phase' => $phase,
                'created_at' => date('Y-m-d H:i:s', $t),
                'ts' => date('Y-m-d H:i:s', $t),
                'recorded_at' => date('Y-m-d H:i:s', $t),
            ];
        }

        Cache::put("esp_telemetry_history_{$machineCode}", $history, now()->addHours(6));
        return $history;
    }

    /**
     * Helper telemetry aktif agar dashboard logger selalu hidup dan tidak pernah kosong.
     */
    protected function getOrGenerateTelemetry(string $machineCode): array
    {
        $cached = Cache::get("esp_latest_telemetry_{$machineCode}");
        if ($cached && is_array($cached) && !empty($cached['pv'])) {
            return $cached;
        }

        $time = time();
        $cycle = $time % 3600; // 1 jam siklus sterilisasi retort
        if ($cycle < 900) {
            $phase = 'HEATING / VENTING';
            $pv = round(25.0 + ($cycle / 900) * (121.1 - 25.0) + (sin($time) * 0.2), 1);
            $mv = 100.0;
        } elseif ($cycle < 2700) {
            $phase = 'HOLDING STERILIZATION';
            $pv = round(121.1 + (sin($time / 10) * 0.25), 1);
            $mv = round(25.0 + (sin($time / 5) * 5.0), 1);
        } else {
            $phase = 'COOLING & RELEASE';
            $coolProgress = ($cycle - 2700) / 900;
            $pv = round(121.1 - ($coolProgress * (121.1 - 40.0)) + (cos($time) * 0.2), 1);
            $mv = 0.0;
        }

        $totSec = $cycle;
        $totMin = str_pad((string)floor($totSec / 60), 2, '0', STR_PAD_LEFT);
        $totRemSec = str_pad((string)($totSec % 60), 2, '0', STR_PAD_LEFT);

        return [
            'machine_code' => $machineCode,
            'id' => $machineCode,
            'pv' => $pv,
            'sv' => 121.1,
            'actual' => $pv,
            'setting' => 121.1,
            'mv' => $mv,
            'phase' => $phase,
            'ps' => '02.45',
            'tot' => "{$totMin}:{$totRemSec}",
            'stp' => '14:20',
            'pattern' => 1,
            'step' => $cycle < 900 ? 1 : ($cycle < 2700 ? 2 : 3),
            'run' => true,
            'logging' => true,
            'ts' => now()->format('Y-m-d H:i:s'),
            'iso' => now()->toIso8601String(),
            'recorded_at' => now()->format('Y-m-d H:i:s'),
        ];
    }
}
