<?php

namespace App\Services;

use Symfony\Component\Process\Process;
use App\Models\TnController;
use Illuminate\Support\Facades\Cache;

class TnModbusService
{
    protected string $scriptPath;
    protected string $pythonPath;

    public function __construct()
    {
        $this->scriptPath = base_path('scripts/modbus_bridge.py');
        $this->pythonPath = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';
    }

    protected function buildEnv(): array
    {
        $env = $_SERVER;
        if (!isset($env['SystemRoot'])) $env['SystemRoot'] = getenv('SystemRoot') ?: 'C:\\Windows';
        return $env;
    }

    protected function runPython(array $args, int $timeout = 10): array
    {
        $exePath = base_path('scripts/modbus_bridge.exe');
        if (file_exists($exePath)) {
            $cmd = array_merge([$exePath], $args);
        } else {
            $cmd = array_merge([$this->pythonPath, '-u', $this->scriptPath], $args);
        }

        $process = new Process(
            $cmd,
            null,
            $this->buildEnv()
        );
        $process->setTimeout($timeout);

        try {
            $process->run();
            $output = $process->getOutput();
            $stderr = $process->getErrorOutput();
            $result = json_decode($output, true);

            if (!$process->isSuccessful() && !$result) {
                $errorMsg = $stderr ?: $output;
                return ['success' => false, 'error' => trim($errorMsg)];
            }

            if (!$result) {
                return ['success' => false, 'error' => 'Invalid JSON response: ' . substr($output, 0, 200)];
            }

            if (!$result['success'] && empty($result['error']) && $stderr) {
                $result['error'] = trim($stderr);
            }

            return $result;
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function listAvailablePorts(): array
    {
        $result = $this->runPython(['list_ports'], 10);
        if ($result['success'] && isset($result['ports'])) {
            return $result['ports'];
        }
        return [];
    }

    public function scanPorts(TnController $controller): ?string
    {
        $this->clearPortCache($controller);
        return $this->resolvePort($controller,
            $controller->baudrate ?? config('tn.baudrate'),
            $controller->parity ?? config('tn.parity'),
            $controller->stopbits ?? config('tn.stopbits'),
            config('tn.timeout'));
    }

    public function testPort(TnController $controller, ?string $port = null): array
    {
        $overridePort = ($port && strtolower($port) !== 'auto') ? $port : null;
        return $this->executeCommand('test_connection', $controller, [], $overridePort);
    }

    public function togglePin(TnController $controller, string $channel, ?string $port = null): array
    {
        $overridePort = ($port && strtolower($port) !== 'auto') ? $port : null;
        return $this->executeCommand('toggle_pin', $controller, ['--channel', $channel], $overridePort);
    }

    public function clearPortCache(TnController $controller): void
    {
        Cache::forget('tn_auto_port_' . $controller->id);
    }

    protected function resolvePort(TnController $controller, $baud, $parity, $stopbits, $timeout): ?string
    {
        $cacheKey = 'tn_auto_port_' . $controller->id;
        $cachedPort = Cache::get($cacheKey);
        if ($cachedPort && is_string($cachedPort)) {
            return $cachedPort;
        }

        // Cek apakah ada COM port serial yang terpasang di sistem (sangat cepat, ~50ms)
        $availablePorts = $this->listAvailablePorts();
        if (empty($availablePorts)) {
            // Belum ada USB RS-485 yang terhubung ke PC
            Cache::forget($cacheKey);
            return null;
        }

        // Jika ada port terpasang, coba scan port yang merespons slave id controller ini
        $result = $this->runPython([
            '--baud', (string)$baud,
            '--parity', $parity,
            '--stopbits', (string)$stopbits,
            '--timeout', (string)$timeout,
            'scan_ports',
            '--slave', (string)$controller->slave_id
        ], 10);

        if ($result['success'] && !empty($result['port'])) {
            $port = $result['port'];
            Cache::put($cacheKey, $port, 15); // Cache port terverifikasi selama 15 detik
            if (strtolower((string) $controller->serial_port) === 'auto' || empty($controller->serial_port)) {
                $controller->update(['serial_port' => $port]);
            }
            return $port;
        }

        // Jika hanya ada 1 port serial USB pada PC, gunakan port tersebut
        if (count($availablePorts) === 1) {
            $singlePort = $availablePorts[0]['device'];
            Cache::put($cacheKey, $singlePort, 5);
            return $singlePort;
        }

        Cache::forget($cacheKey);
        return null;
    }

    protected function executeCommand(string $command, TnController $controller, array $args = [], ?string $overridePort = null)
    {
        $configPort = config('tn.serial_port');
        // Priority: overridePort > manual port set by user > config AUTO > config fixed port
        $configuredPort = $overridePort ?: ($controller->serial_port
            ?? (strtoupper((string) $configPort) === 'AUTO' ? 'AUTO' : $configPort));
        $baud = $controller->baudrate ?? config('tn.baudrate');
        $parity = $controller->parity ?? config('tn.parity');
        $stopbits = $controller->stopbits ?? config('tn.stopbits');
        $timeout = config('tn.timeout');

        $port = $configuredPort;
        if (strtoupper($configuredPort) === 'AUTO') {
            $port = $this->resolvePort($controller, $baud, $parity, $stopbits, $timeout);
        }

        if (!$port || strtoupper((string) $port) === 'AUTO') {
            $this->clearPortCache($controller);
            return [
                'success' => false,
                'error' => 'Auto-detect gagal: tidak ada port Modbus yang merespons. Cek USB RS485, kabel A/B, slave ID, baudrate, parity, stopbits.',
            ];
        }

        $retries = 3;
        $attempt = 0;
        $lastError = '';

        while ($attempt < $retries) {
            $lockFile = storage_path('app/modbus_port_' . md5($port) . '.lock');
            $fp = @fopen($lockFile, 'w+');
            if (!$fp) {
                $lastError = 'Cannot create lock file.';
                $attempt++;
                continue;
            }

            try {
                $lockAcquired = false;
                $lockWaitStart = microtime(true);
                while (microtime(true) - $lockWaitStart < 3.0) {
                    if (flock($fp, LOCK_EX | LOCK_NB)) {
                        $lockAcquired = true;
                        break;
                    }
                    usleep(50000);
                }

                if ($lockAcquired) {
                    $baseArgs = [
                        '--port', $port,
                        '--baud', (string)$baud,
                        '--parity', $parity,
                        '--stopbits', (string)$stopbits,
                        '--timeout', (string)$timeout,
                        $command,
                        '--slave', (string)$controller->slave_id
                    ];
                    $processArgs = array_merge($baseArgs, $args);

                    $result = $this->runPython($processArgs, ($timeout * 2) + 6);

                    if (!$result['success'] && $this->isConnectionError($result['error'] ?? '')) {
                        $this->clearPortCache($controller);

                        if (strtoupper($configuredPort) !== 'AUTO') {
                            $configuredPort = 'AUTO';
                        }

                        $port = $this->resolvePort($controller, $baud, $parity, $stopbits, $timeout);
                        if (!$port || strtoupper((string) $port) === 'AUTO') {
                            $this->clearPortCache($controller);
                            return [
                                'success' => false,
                                'error' => 'Auto-detect gagal: tidak ada port Modbus yang merespons. Cek USB RS485, kabel A/B, slave ID, baudrate, parity, stopbits.',
                            ];
                        }
                        $lastError = $result['error'];
                        $attempt++;
                        if ($attempt < $retries) {
                            usleep(200000);
                        }
                        continue;
                    }

                    return $result;
                } else {
                    $lastError = 'Timeout waiting for serial port lock (flock).';
                    $attempt++;
                }
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
                $attempt++;
            } finally {
                flock($fp, LOCK_UN);
                fclose($fp);
            }
        }

        return ['success' => false, 'error' => $lastError];
    }

    protected function isConnectionError(string $error): bool
    {
        $patterns = [
            'Could not connect', 'No working Modbus port found', 'PermissionError',
            'FileNotFoundError', 'No response', 'timed out', 'Timed out',
            'Connection refused', 'Device not connected', 'could not open port',
            'The system cannot find', 'Access is denied', 'Port is closed',
        ];
        foreach ($patterns as $pattern) {
            if (str_contains($error, $pattern)) return true;
        }
        return false;
    }

    public function readAllControllers(\Illuminate\Support\Collection $controllers): array
    {
        if ($controllers->isEmpty()) return [];

        $first = $controllers->first();
        $slaves = $controllers->pluck('slave_id')->implode(',');
        $port = $this->resolveControllerPort($first);

        if (!$port || strtoupper((string) $port) === 'AUTO') {
            $this->clearPortCache($first);
            return [];
        }

        $lockFile = storage_path('app/modbus_port_' . md5($port) . '.lock');
        $fp = @fopen($lockFile, 'w+');
        if (!$fp) return [];

        try {
            $lockAcquired = false;
            $lockWaitStart = microtime(true);
            while (microtime(true) - $lockWaitStart < 3.0) {
                if (flock($fp, LOCK_EX | LOCK_NB)) {
                    $lockAcquired = true;
                    break;
                }
                usleep(50000);
            }

            if (!$lockAcquired) {
                return [];
            }

            $result = $this->runPython([
                '--port', $port,
                '--baud', (string)($first->baudrate ?? config('tn.baudrate')),
                '--parity', $first->parity ?? config('tn.parity'),
                '--stopbits', (string)($first->stopbits ?? config('tn.stopbits')),
                '--timeout', (string)config('tn.timeout'),
                'read_all',
                '--slaves', $slaves,
                '--addr', '1000',
                '--count', '27',
            ], (config('tn.timeout') * 2) + 5);

            if (!$result['success'] || !isset($result['controllers'])) {
                if ($this->isConnectionError($result['error'] ?? '')) {
                    $this->clearPortCache($first);
                }
                return [];
            }

            return $result['controllers'];
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    protected function resolveControllerPort(TnController $controller): ?string
    {
        $configPort = config('tn.serial_port');
        $configuredPort = $controller->serial_port
            ?? (strtoupper((string) $configPort) === 'AUTO' ? 'AUTO' : $configPort);

        if (empty($configuredPort) || strtoupper($configuredPort) === 'AUTO') {
            return $this->resolvePort($controller,
                $controller->baudrate ?? config('tn.baudrate'),
                $controller->parity ?? config('tn.parity'),
                $controller->stopbits ?? config('tn.stopbits'),
                config('tn.timeout'));
        }

        // Jika port spesifik diset (e.g. COM3), pastikan port tersebut masih ada di sistem
        $available = $this->listAvailablePorts();
        $portExists = false;
        foreach ($available as $p) {
            if (strcasecmp($p['device'] ?? '', $configuredPort) === 0) {
                $portExists = true;
                break;
            }
        }

        // Jika port spesifik tidak terpasang di Windows, coba auto-resolve
        if (!$portExists) {
            $this->clearPortCache($controller);
            return $this->resolvePort($controller,
                $controller->baudrate ?? config('tn.baudrate'),
                $controller->parity ?? config('tn.parity'),
                $controller->stopbits ?? config('tn.stopbits'),
                config('tn.timeout'));
        }

        return $configuredPort;
    }

    public function testConnection(TnController $controller)
    {
        return $this->executeCommand('test_connection', $controller);
    }

    public function readInputRegisters(TnController $controller, int $address, int $count)
    {
        return $this->executeCommand('read_input', $controller, [
            '--addr', (string)$address,
            '--count', (string)$count
        ]);
    }

    public function readHoldingRegisters(TnController $controller, int $address, int $count)
    {
        return $this->executeCommand('read_holding', $controller, [
            '--addr', (string)$address,
            '--count', (string)$count
        ]);
    }

    public function writeSingleRegister(TnController $controller, int $address, int $value)
    {
        return $this->executeCommand('write_register', $controller, [
            '--addr', (string)$address,
            '--value', (string)$value
        ]);
    }

    public function writeSingleCoil(TnController $controller, int $address, bool $value)
    {
        return $this->executeCommand('write_coil', $controller, [
            '--addr', (string)$address,
            '--value', $value ? '1' : '0'
        ]);
    }

    public function writeMultipleRegisters(TnController $controller, int $address, array $values)
    {
        return $this->executeCommand('write_registers', $controller, [
            '--addr', (string)$address,
            '--values', implode(',', $values)
        ]);
    }
}
