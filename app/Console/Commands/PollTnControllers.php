<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\TnController;
use App\Models\TnReading;
use App\Services\TnModbusService;
use App\Services\TnRegisterMap;
use App\Events\TnDataReceived;
use Carbon\Carbon;

class PollTnControllers extends Command
{
    protected $signature = 'tn:poll {--interval=1 : Polling interval in seconds} {--once : Poll controllers once and exit} {--controller= : Poll one TN controller id only}';
    protected $description = 'Poll TN Controllers for monitoring data';

    public function handle(TnModbusService $modbus)
    {
        set_time_limit(0);
        ini_set('max_execution_time', '0');
        \Illuminate\Support\Facades\DB::disableQueryLog();

        $baseInterval = max(1, (int) $this->option('interval'));
        $this->info("Starting TN Controller polling every {$baseInterval} second(s)...");

        // Set status awal controller offline sampai Modbus terhubung
        TnController::query()->update([
            'is_online' => false,
            'last_error' => 'Menghubungkan ke controller Autonics TN...',
        ]);

        $lastOfflineProbeTime = 0.0;
        $offlineProbeInterval = 20.0; // Probe at most 1 offline controller every 20 seconds
        $offlineIndex = 0;

        // Initialize target second to next whole integer second
        $targetSecond = floor(microtime(true)) + 1;

        do {
            set_time_limit(0);
            if (!$this->option('once')) {
                $now = microtime(true);
                $sleepSeconds = $targetSecond - $now;

                if ($sleepSeconds > 0) {
                    usleep((int)($sleepSeconds * 1000000));
                } elseif ($now - $targetSecond > 2.0) {
                    // Severe system clock drift or sleep, resync
                    $targetSecond = floor($now);
                }
            }

            $cycleTime = Carbon::createFromTimestamp($targetSecond);

            $controllerOption = $this->option('controller');
            $allControllers = TnController::query()
                ->when($controllerOption, function ($query, $val) {
                    $query->where(function ($q) use ($val) {
                        $q->where('id', $val)
                          ->orWhere('slave_id', $val)
                          ->orWhere('model_type', strtoupper($val))
                          ->orWhere('name', 'like', "%{$val}%");
                    });
                })
                ->get();

            if ($allControllers->isEmpty()) {
                $this->warn("No TN controllers found matching '{$controllerOption}'.");
                if ($this->option('once')) break;
                $targetSecond += $baseInterval;
                continue;
            }

            // Smart batching to guarantee 1-second continuous logging:
            // 1. All currently ONLINE controllers are polled every interval (1 sec).
            // 2. If some are online, probe at most ONE offline controller every 20 seconds (round-robin).
            //    This guarantees offline slaves NEVER delay or interrupt the active 1Hz bus.
            // 3. If ALL are offline, probe all every 2 seconds for initial connection.
            $onlineControllers = $allControllers->where('is_online', true)->values();
            $offlineControllers = $allControllers->where('is_online', false)->values();
            $anyOnline = $onlineControllers->isNotEmpty();

            if ($anyOnline) {
                $controllersToPoll = $onlineControllers;
                $now = microtime(true);
                if ($offlineControllers->isNotEmpty() && ($now - $lastOfflineProbeTime) >= $offlineProbeInterval) {
                    $offlineCtrl = $offlineControllers[$offlineIndex % $offlineControllers->count()];
                    $offlineIndex++;
                    $lastOfflineProbeTime = $now;
                    $controllersToPoll = $controllersToPoll->concat([$offlineCtrl]);
                }
            } else {
                $controllersToPoll = $allControllers;
            }

            $allResults = $modbus->readAllControllers($controllersToPoll);
            $seenSlaves = [];

            if (!empty($allResults)) {
                foreach ($allResults as $slaveId => $ctrlResult) {
                    $controller = $controllersToPoll->firstWhere('slave_id', $slaveId);
                    if (!$controller) continue;
                    $seenSlaves[] = $slaveId;

                    if ($ctrlResult['success']) {
                        $data = $ctrlResult['data'];
                        if (count($data) < 24) {
                            $this->error("{$controller->name}: Expected 27 registers, got " . count($data));
                            continue;
                        }

                        $statusFlags = TnRegisterMap::decodeStatusFlag($data[7]);

                        $reading = TnReading::create([
                            'tn_controller_id' => $controller->id,
                            'pv' => $data[0],
                            'decimal_point' => $data[1],
                            'sv' => $data[3],
                            'heating_mv' => $data[4],
                            'cooling_mv' => $data[5],
                            'run_status' => $statusFlags['run_status'],
                            'auto_manual' => $statusFlags['auto_manual'],
                            'out1_active' => $statusFlags['out1_active'],
                            'out2_active' => $statusFlags['out2_active'],
                            'at_running' => $statusFlags['at_running'],
                            'alarm_bits' => $data[11],
                            'event_bits' => $data[10],
                            'ct1_current' => $data[12],
                            'ct2_current' => $data[13],
                            'pattern_current' => $data[19],
                            'step_current' => $data[20],
                            'process_time' => $data[21],
                            'rest_time' => $data[23],
                            'created_at' => $cycleTime,
                            'updated_at' => $cycleTime,
                        ]);

                        // Backend History Tracking:
                        // Process is active if controller is in RUN mode (PROG/RUN bit active),
                        // or Program Process Time (TOT) is advancing (> 0), or heating/cooling outputs are active.
                        $isStopBit = (bool)($statusFlags['run_status'] ?? false);
                        $isProgBit = (bool)($statusFlags['prog_status'] ?? false);
                        $runReg = (int)($data[14] ?? 1); // 0: RUN, 1: STOP
                        $totTime = (int)($data[21] ?? 0);
                        $mvHeat = (float)($data[4] ?? 0);
                        $mvCool = (float)($data[5] ?? 0);

                        $isProcessActive = (!$isStopBit) || $isProgBit || ($runReg === 0) || ($totTime > 0) || ($mvHeat > 0) || ($mvCool > 0);

                        $cacheKey = "tn_active_history_{$controller->id}";
                        $idleKey = "tn_history_idle_{$controller->id}";
                        $activeHistoryId = \Illuminate\Support\Facades\Cache::get($cacheKey);

                        if ($isProcessActive) {
                            \Illuminate\Support\Facades\Cache::forget($idleKey);

                            if (!$activeHistoryId) {
                                $history = \App\Models\TnProcessHistory::create([
                                    'tn_controller_id' => $controller->id,
                                    'start_time' => $cycleTime,
                                ]);
                                \Illuminate\Support\Facades\Cache::forever($cacheKey, $history->id);
                            }
                        } elseif ($activeHistoryId) {
                            // Debounce process stop: require 5 consecutive idle seconds before finalizing
                            $idleCount = (int) \Illuminate\Support\Facades\Cache::get($idleKey, 0) + 1;
                            \Illuminate\Support\Facades\Cache::put($idleKey, $idleCount, 60);

                            if ($idleCount >= 5) {
                                $history = \App\Models\TnProcessHistory::find($activeHistoryId);
                                if ($history) {
                                    $endTime = $cycleTime;
                                    $readings = TnReading::where('tn_controller_id', $controller->id)
                                        ->where('created_at', '>=', $history->start_time)
                                        ->where('created_at', '<=', $endTime)
                                        ->orderBy('created_at')
                                        ->get()
                                        ->toArray();

                                    // Only preserve batches with meaningful data points (>= 5 readings)
                                    if (count($readings) >= 5) {
                                        $history->update([
                                            'end_time' => $endTime,
                                            'log_data' => $readings,
                                        ]);
                                    } else {
                                        $history->delete();
                                    }
                                }
                                \Illuminate\Support\Facades\Cache::forget($cacheKey);
                                \Illuminate\Support\Facades\Cache::forget($idleKey);
                            }
                        }

                        $wasOnline = $controller->is_online;
                        $controller->update([
                            'is_online' => true,
                            'last_seen_at' => $cycleTime,
                            'last_error' => null,
                        ]);

                        // Broadcasting is disabled in desktop polling to prevent 2-second cURL timeouts
                        if (env('ENABLE_REVERB_BROADCAST', false)) {
                            try {
                                event(new TnDataReceived($controller, $reading));
                            } catch (\Throwable $e) {
                                // Silent fail
                            }
                        }

                        if (!$wasOnline) {
                            $this->info("Controller {$controller->name} (slave {$slaveId}) is now online.");
                        }
                    } else {
                        $wasOnline = $controller->is_online;
                        if ($wasOnline || $controller->last_error !== ($ctrlResult['error'] ?? '')) {
                            $controller->update([
                                'is_online' => false,
                                'last_error' => \Illuminate\Support\Str::limit($ctrlResult['error'] ?? 'Unknown error', 250),
                            ]);
                        }
                        if ($wasOnline) {
                            $this->error("Controller {$controller->name} (slave {$slaveId}) went offline: {$ctrlResult['error']}");
                        }
                    }
                }
            }

            // Mark controllers that were polled but didn't respond as offline
            foreach ($controllersToPoll as $controller) {
                if (!in_array($controller->slave_id, $seenSlaves)) {
                    $wasOnline = $controller->is_online;
                    if ($wasOnline) {
                        $controller->update([
                            'is_online' => false,
                            'last_error' => 'No response from slave in batch poll.',
                        ]);
                        $this->warn("Controller {$controller->name} (slave {$controller->slave_id}) went offline: No data in batch response.");
                    }
                }
            }

            $targetSecond += $baseInterval;
        } while (!$this->option('once'));
    }
}
