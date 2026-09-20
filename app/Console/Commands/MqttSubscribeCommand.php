<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpMqtt\Client\Facades\MQTT;
use App\Events\SensorDataReceived;
use App\Events\OtaProgressUpdated;

class MqttSubscribeCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'mqtt:subscribe';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Subscribe to MQTT topics and listen for messages';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting MQTT Listener...');
        $csvStorageDir = storage_path('app/mqtt-csv');
        if (!is_dir($csvStorageDir)) {
            mkdir($csvStorageDir, 0755, true);
        }

        // Active CSV upload tracking [key => ['file_path' => ..., 'size' => ..., 'sha256' => ...]]
        $activeUploads = [];

        while (true) {
            try {
                $this->info('Connecting to MQTT broker...');
                $mqtt = MQTT::connection();

                // Topic: retort/data (sensor data realtime)
                $mqtt->subscribe('retort/data', function (string $topic, string $message) {
                    $payload = json_decode($message, true);
                    if (!is_array($payload)) return;

                    $machineCode = $payload['machine_code'] ?? $payload['id'] ?? 'RT-001';

                    // Normalize payload fields for unified consumption
                    $normalized = [
                        'machine_code' => $machineCode,
                        'id' => $machineCode,
                        'pv' => isset($payload['actual']) ? (float)$payload['actual'] : (isset($payload['pv']) ? (float)$payload['pv'] : null),
                        'sv' => isset($payload['setting']) ? (float)$payload['setting'] : (isset($payload['sv']) ? (float)$payload['sv'] : null),
                        'actual' => isset($payload['actual']) ? (float)$payload['actual'] : (isset($payload['pv']) ? (float)$payload['pv'] : null),
                        'setting' => isset($payload['setting']) ? (float)$payload['setting'] : (isset($payload['sv']) ? (float)$payload['sv'] : null),
                        'mv' => isset($payload['mv']) ? (float)$payload['mv'] : 0.0,
                        'phase' => $payload['phase'] ?? 'IDLE',
                        'ps' => $payload['ps'] ?? '00.00',
                        'tot' => $payload['tot'] ?? '00:00',
                        'stp' => $payload['stp'] ?? '00:00',
                        'pattern' => $payload['pattern'] ?? 0,
                        'step' => $payload['step'] ?? 0,
                        'run' => filter_var($payload['run'] ?? false, FILTER_VALIDATE_BOOLEAN),
                        'logging' => filter_var($payload['logging'] ?? false, FILTER_VALIDATE_BOOLEAN),
                        'ts' => $payload['ts'] ?? now()->toDateTimeString(),
                        'iso' => $payload['iso'] ?? now()->toIso8601String(),
                        'recorded_at' => now()->toDateTimeString(),
                    ];

                    // Broadcast to private websocket channel
                    broadcast(new SensorDataReceived($machineCode, $normalized));

                    // Cache device state and recent ESP telemetry
                    \Illuminate\Support\Facades\Cache::put("device.{$machineCode}.run", $normalized['run'], now()->addMinutes(5));
                    \Illuminate\Support\Facades\Cache::put("device.{$machineCode}.last_seen", now()->timestamp, now()->addMinutes(5));
                    \Illuminate\Support\Facades\Cache::put("esp_latest_telemetry_{$machineCode}", $normalized, now()->addMinutes(15));
                    
                    // Increment SSE sequence for realtime stream push
                    \Illuminate\Support\Facades\Cache::increment("esp_telemetry_seq_{$machineCode}");

                    // Keep rolling buffer of last 120 telemetry points for live chart initialization
                    $historyKey = "esp_telemetry_history_{$machineCode}";
                    $history = \Illuminate\Support\Facades\Cache::get($historyKey, []);
                    if (!is_array($history)) $history = [];
                    $history[] = $normalized;
                    if (count($history) > 120) {
                        $history = array_slice($history, -120);
                    }
                    \Illuminate\Support\Facades\Cache::put($historyKey, $history, now()->addHours(2));
                });

                // Topic: retort/system (Watchdog / Boot / Pattern Events from ESP32)
                $mqtt->subscribe('retort/system', function (string $topic, string $message) {
                    $payload = json_decode($message, true);
                    if (!is_array($payload)) return;

                    $machineCode = $payload['id'] ?? $payload['machine_code'] ?? 'RT-001';
                    $this->info("Received system event for {$machineCode}: " . $message);
                    \Illuminate\Support\Facades\Cache::put("esp_latest_system_event_{$machineCode}", $payload, now()->addHours(6));
                });

                // Topic: retort/csv/meta (ESP32 completed process CSV metadata)
                $mqtt->subscribe('retort/csv/meta', function (string $topic, string $message) use (&$activeUploads, $csvStorageDir) {
                    $payload = json_decode($message, true);
                    if (!is_array($payload)) return;

                    $machineCode = $payload['id'] ?? 'RT-001';
                    $filename = basename($payload['file'] ?? 'process.txt');
                    $transferId = $payload['transfer_id'] ?? uniqid();
                    $size = (int)($payload['size'] ?? 0);
                    $sha256 = strtolower(trim($payload['sha256'] ?? ''));

                    $key = "{$machineCode}_{$transferId}_{$filename}";
                    $partPath = "{$csvStorageDir}/{$key}.part";
                    file_put_contents($partPath, '');

                    $activeUploads[$key] = [
                        'machine_code' => $machineCode,
                        'file' => $filename,
                        'transfer_id' => $transferId,
                        'size' => $size,
                        'sha256' => $sha256,
                        'path' => $partPath,
                    ];

                    $this->info("[DATA META] {$machineCode}/{$filename} ({$size} bytes, id: {$transferId})");
                });

                // Topic: retort/csv/chunk (ESP32 completed process data chunks)
                $mqtt->subscribe('retort/csv/chunk', function (string $topic, string $message) use (&$activeUploads) {
                    $payload = json_decode($message, true);
                    if (!is_array($payload)) return;

                    $machineCode = $payload['id'] ?? 'RT-001';
                    $filename = basename($payload['file'] ?? 'process.txt');
                    $transferId = $payload['transfer_id'] ?? '';
                    $key = "{$machineCode}_{$transferId}_{$filename}";

                    if (!isset($activeUploads[$key])) return;

                    $chunkData = base64_decode($payload['data'] ?? '', true);
                    if ($chunkData !== false) {
                        file_put_contents($activeUploads[$key]['path'], $chunkData, FILE_APPEND);
                    }
                });

                // Topic: retort/csv/end (ESP32 finished sending chunks -> verify & import)
                $mqtt->subscribe('retort/csv/end', function (string $topic, string $message) use (&$activeUploads, $mqtt) {
                    $payload = json_decode($message, true);
                    if (!is_array($payload)) return;

                    $machineCode = $payload['id'] ?? 'RT-001';
                    $filename = basename($payload['file'] ?? 'process.txt');
                    $transferId = $payload['transfer_id'] ?? '';
                    $key = "{$machineCode}_{$transferId}_{$filename}";

                    if (!isset($activeUploads[$key])) {
                        $this->warn("[CSV END] No active upload found for key {$key}");
                        return;
                    }

                    $upload = $activeUploads[$key];
                    unset($activeUploads[$key]);

                    $partPath = $upload['path'];
                    $expectedSha = $upload['sha256'];

                    if (!file_exists($partPath)) {
                        $this->error("[CSV ERR] Part file not found: {$partPath}");
                        $this->sendCsvAck($mqtt, $machineCode, $filename, $transferId, 'error', 'File not found');
                        return;
                    }

                    $actualSha = strtolower(hash_file('sha256', $partPath));
                    if (!empty($expectedSha) && $actualSha !== $expectedSha) {
                        $this->error("[CSV ERR] SHA256 mismatch: actual {$actualSha} vs expected {$expectedSha}");
                        @unlink($partPath);
                        $this->sendCsvAck($mqtt, $machineCode, $filename, $transferId, 'error', 'Checksum mismatch');
                        return;
                    }

                    // Parse and import CSV rows into TnProcessHistory
                    try {
                        $count = $this->importCompletedCsv($machineCode, $filename, $partPath);
                        $this->info("[CSV OK] Successfully imported {$count} rows for {$machineCode}/{$filename}");
                        $this->sendCsvAck($mqtt, $machineCode, $filename, $transferId, 'imported', "Imported {$count} readings");
                    } catch (\Throwable $e) {
                        $this->error("[CSV ERR] Failed to import: " . $e->getMessage());
                        $this->sendCsvAck($mqtt, $machineCode, $filename, $transferId, 'error', $e->getMessage());
                    } finally {
                        @unlink($partPath);
                    }
                });

                // Topic: retort/{machine_code}/ota/status
                $mqtt->subscribe('retort/+/ota/status', function (string $topic, string $message) {
                    $parts = explode('/', $topic);
                    if (count($parts) >= 4) {
                        $machineCode = $parts[1];
                        $payload = json_decode($message, true);
                        if ($payload) {
                            $status = $payload['status'] ?? 'unknown';
                            $progress = $payload['progress'] ?? 0;
                            $errorMsg = $payload['error_message'] ?? null;

                            broadcast(new OtaProgressUpdated(
                                $machineCode,
                                $status,
                                $progress,
                                $errorMsg
                            ));

                            // Update database for Rule 3
                            $device = \App\Models\Device::where('machine_code', $machineCode)->first();
                            if ($device) {
                                $latestDeployment = $device->otaDeployments()->latest()->first();
                                if ($latestDeployment) {
                                    $latestDeployment->update([
                                        'status' => $status,
                                        'progress' => $progress,
                                        'error_message' => $errorMsg,
                                        'completed_at' => in_array($status, ['success', 'failed', 'rollback']) ? now() : null,
                                    ]);
                                }
                            }
                        }
                    }
                });

                // Topic: retort/{machine_code}/config/ack
                $mqtt->subscribe('retort/+/config/ack', function (string $topic, string $message) {
                    $parts = explode('/', $topic);
                    if (count($parts) >= 4) {
                        $machineCode = $parts[1];
                        $this->info("Received config ACK for $machineCode: $message");
                    }
                });

                $this->info('MQTT Connected & Subscribed. Entering event loop...');
                $mqtt->loop(true);
            } catch (\Throwable $e) {
                $this->error('MQTT Exception: ' . $e->getMessage());
                $this->warn('Reconnecting in 5 seconds...');
                sleep(5);
            }
        }
    }

    /**
     * Send ACK back to ESP32 on retort/csv/ack
     */
    protected function sendCsvAck($mqtt, string $machineCode, string $filename, string $transferId, string $status, string $message): void
    {
        $ack = [
            'id' => $machineCode,
            'file' => $filename,
            'transfer_id' => $transferId,
            'status' => $status,
            'message' => substr($message, 0, 120),
        ];
        try {
            $mqtt->publish('retort/csv/ack', json_encode($ack), 1);
            $this->info("[CSV ACK] Sent ACK {$status} to {$machineCode}/{$filename}");
        } catch (\Throwable $e) {
            $this->error("[CSV ACK ERR] " . $e->getMessage());
        }
    }

    /**
     * Parse CSV or TXT file and store to TnProcessHistory
     */
    public function importCompletedFile(string $machineCode, string $filename, string $filePath): int
    {
        return $this->importCompletedCsv($machineCode, $filename, $filePath);
    }

    /**
     * Parse CSV or TXT file and store to TnProcessHistory (backward-compatible)
     */
    protected function importCompletedCsv(string $machineCode, string $filename, string $filePath): int
    {
        $handle = fopen($filePath, 'rb');
        if (!$handle) {
            throw new \RuntimeException("Cannot open file {$filePath}");
        }

        // Peek first line to detect delimiter (\t for TXT, , for CSV)
        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);
            throw new \RuntimeException("File is empty");
        }

        $firstLineTrimmed = trim($firstLine, "\r\n");
        $delimiter = str_contains($firstLineTrimmed, "\t") ? "\t" : ",";

        // Parse header line
        $rawHeaders = str_getcsv($firstLineTrimmed, $delimiter);
        if (!is_array($rawHeaders) || empty($rawHeaders)) {
            fclose($handle);
            throw new \RuntimeException("File header not found");
        }

        // Normalize headers to lowercase for robust matching
        $lowerIndexes = [];
        foreach ($rawHeaders as $idx => $headerName) {
            $cleaned = strtolower(trim((string)$headerName, " \t\n\r\0\x0B\xEF\xBB\xBF"));
            if ($cleaned !== '') {
                $lowerIndexes[$cleaned] = $idx;
            }
        }

        $rows = [];
        while (($line = fgets($handle)) !== false) {
            $line = trim($line, "\r\n");
            if ($line === '') continue;

            $values = str_getcsv($line, $delimiter);
            if ($values === [null] || $values === [] || !is_array($values)) continue;

            $getVal = function(string $key) use ($values, $lowerIndexes) {
                $k = strtolower($key);
                return isset($lowerIndexes[$k]) && isset($values[$lowerIndexes[$k]]) ? $values[$lowerIndexes[$k]] : null;
            };

            $actualVal = $getVal('actual');
            $actual = ($actualVal !== null && is_numeric($actualVal)) ? (float)$actualVal : 0.0;

            $settingVal = $getVal('setting');
            $setting = ($settingVal !== null && is_numeric($settingVal)) ? (float)$settingVal : null;

            $mvVal = $getVal('mv');
            $mv = ($mvVal !== null && is_numeric($mvVal)) ? (float)$mvVal : 0.0;

            $phaseVal = $getVal('phase');
            $phase = ($phaseVal !== null) ? trim((string)$phaseVal) : 'IDLE';

            $iso = $getVal('iso');
            $tj = $getVal('tanggal jam');
            $ts = ($iso && trim((string)$iso) !== '') ? trim((string)$iso) : ($tj ? trim((string)$tj) : null);

            try {
                $recordedAt = \Carbon\Carbon::parse((string)$ts, 'Asia/Jakarta')->timezone('Asia/Jakarta')->format('Y-m-d H:i:s');
            } catch (\Throwable) {
                $recordedAt = now()->timezone('Asia/Jakarta')->format('Y-m-d H:i:s');
            }

            $rows[] = [
                'pv' => $actual,
                'sv' => $setting,
                'actual' => $actual,
                'setting' => $setting,
                'mv' => $mv,
                'heating_mv' => $mv,
                'phase' => $phase,
                'process_status' => $phase,
                'created_at' => $recordedAt,
                'recorded_at' => $recordedAt,
            ];
        }
        fclose($handle);

        if (empty($rows)) {
            throw new \RuntimeException("CSV does not contain valid sensor data");
        }

        usort($rows, fn($a, $b) => strcmp($a['recorded_at'], $b['recorded_at']));

        $startTime = $rows[0]['recorded_at'];
        $endTime = $rows[count($rows) - 1]['recorded_at'];

        // Resolve or create TnController
        $machine = \App\Models\Machine::where('machine_code', $machineCode)->first();
        $controller = null;
        if ($machine) {
            $controller = \App\Models\TnController::where('machine_id', $machine->id)->first();
        }
        if (!$controller) {
            $controller = \App\Models\TnController::first();
        }
        if (!$controller) {
            $controller = \App\Models\TnController::create([
                'name' => "Autonics TN ({$machineCode})",
                'slave_id' => 1,
                'model_type' => 'TNL',
                'control_model' => 'program',
                'is_online' => true,
            ]);
        }

        // Avoid duplicate insertion if exact same process timestamps exist
        $existing = \App\Models\TnProcessHistory::where('tn_controller_id', $controller->id)
            ->where('start_time', $startTime)
            ->where('end_time', $endTime)
            ->first();

        if (!$existing) {
            \App\Models\TnProcessHistory::create([
                'tn_controller_id' => $controller->id,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'log_data' => $rows,
            ]);
        }

        return count($rows);
    }
}
