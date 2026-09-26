<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Contracts\Console\Isolatable;
use App\Models\TnController;
use App\Models\TnReading;
use App\Services\TnModbusService;
use App\Services\TnRegisterMap;
use App\Events\TnDataReceived;
use Carbon\Carbon;

class PollTnControllers extends Command implements Isolatable
{
    protected $signature = 'tn:poll {--interval=1 : Polling interval in seconds} {--once : Poll controllers once and exit} {--controller= : Poll one TN controller id only}';
    protected $description = 'Poll TN Controllers for monitoring data';

    public function handle(TnModbusService $modbus)
    {
        $interval = (int) $this->option('interval');
        $this->info("Starting TN Controller polling every {$interval} second(s)...");

        do {
            $start = microtime(true);
            $controllerOption = $this->option('controller');
            $controllers = TnController::query()
                ->when($controllerOption, function ($query, $val) {
                    $query->where(function ($q) use ($val) {
                        $q->where('id', $val)
                          ->orWhere('slave_id', $val)
                          ->orWhere('model_type', strtoupper($val))
                          ->orWhere('name', 'like', "%{$val}%");
                    });
                })
                ->get();

            if ($controllers->isEmpty()) {
                $this->warn("No TN controllers found matching '{$controllerOption}'.");
                if ($this->option('once')) break;
                sleep($interval);
                continue;
            }

            $allResults = $modbus->readAllControllers($controllers);
            $seenSlaves = [];

            if (!empty($allResults)) {
                foreach ($allResults as $slaveId => $ctrlResult) {
                    $controller = $controllers->firstWhere('slave_id', $slaveId);
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
                            'created_at' => Carbon::now(),
                        ]);

                        // Backend History Tracking
                        $mv = $data[4] ?? 0;
                        $cacheKey = "tn_active_history_{$controller->id}";
                        $activeHistoryId = \Illuminate\Support\Facades\Cache::get($cacheKey);

                        if ($mv > 0 && !$activeHistoryId) {
                            $history = \App\Models\TnProcessHistory::create([
                                'tn_controller_id' => $controller->id,
                                'start_time' => Carbon::now(),
                            ]);
                            \Illuminate\Support\Facades\Cache::forever($cacheKey, $history->id);
                        } elseif ($mv == 0 && $activeHistoryId) {
                            $history = \App\Models\TnProcessHistory::find($activeHistoryId);
                            if ($history) {
                                $endTime = Carbon::now();
                                $readings = TnReading::where('tn_controller_id', $controller->id)
                                    ->where('created_at', '>=', $history->start_time)
                                    ->where('created_at', '<=', $endTime)
                                    ->orderBy('created_at')
                                    ->get()
                                    ->toArray();
                                $history->update([
                                    'end_time' => $endTime,
                                    'log_data' => $readings,
                                ]);
                            }
                            \Illuminate\Support\Facades\Cache::forget($cacheKey);
                        }

                        $wasOnline = $controller->is_online;
                        $controller->update([
                            'is_online' => true,
                            'last_seen_at' => Carbon::now(),
                            'last_error' => null,
                        ]);

                        static $isReverbAlive = null;
                        static $lastReverbCheck = 0;

                        if (time() - $lastReverbCheck > 5) {
                            $lastReverbCheck = time();
                            $fp = @fsockopen('127.0.0.1', 8080, $errno, $errstr, 0.02);
                            if ($fp) {
                                $isReverbAlive = true;
                                fclose($fp);
                            } else {
                                $isReverbAlive = false;
                            }
                        }

                        if ($isReverbAlive) {
                            try {
                                event(new TnDataReceived($controller, $reading));
                            } catch (\Throwable $e) {
                                $isReverbAlive = false;
                            }
                        }

                        if (!$wasOnline) {
                            $this->info("Controller {$controller->name} (slave {$slaveId}) is now online.");
                        }
                    } else {
                        $wasOnline = $controller->is_online;
                        $controller->update([
                            'is_online' => false,
                            'last_error' => \Illuminate\Support\Str::limit($ctrlResult['error'] ?? 'Unknown error', 250),
                        ]);
                        if ($wasOnline) {
                            $this->error("Controller {$controller->name} (slave {$slaveId}) went offline: {$ctrlResult['error']}");
                        }
                    }
                }
            }

            // Mark controllers not in batch result as offline
            foreach ($controllers as $controller) {
                if (!in_array($controller->slave_id, $seenSlaves)) {
                    $wasOnline = $controller->is_online;
                    $controller->update([
                        'is_online' => false,
                        'last_error' => 'No response from slave in batch poll.',
                    ]);
                    if ($wasOnline) {
                        $this->warn("Controller {$controller->name} (slave {$controller->slave_id}) went offline: No data in batch response.");
                    }
                }
            }

            $elapsed = microtime(true) - $start;
            $sleep = max(0, $interval - $elapsed);
            if (!$this->option('once') && $sleep > 0) {
                usleep((int)($sleep * 1000000));
            }
        } while (!$this->option('once'));
    }
}
