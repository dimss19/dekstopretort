<?php

namespace App\Services;

use Symfony\Component\Process\Process;
use App\Models\TnController;
use Illuminate\Support\Facades\Cache;

class TnModbusService
{
    protected string $scriptPath;
    protected string $pythonPath;
    protected $workerProcess = null;
    protected array $workerPipes = [];
    protected ?string $workerPort = null;

    public function __construct()
    {
        $this->scriptPath = base_path('scripts/modbus_bridge.py');
        $this->pythonPath = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';
    }

    public function __destruct()
    {
        $this->stopWorker();
    }

    public function stopWorker(): void
    {
        if ($this->workerProcess && is_resource($this->workerProcess)) {
            if (isset($this->workerPipes[0]) && is_resource($this->workerPipes[0])) {
                @fwrite($this->workerPipes[0], json_encode(['command' => 'exit']) . "\n");
                @fflush($this->workerPipes[0]);
            }
            foreach ($this->workerPipes as $pipe) {
                if (is_resource($pipe)) {
                    @fclose($pipe);
                }
            }
            @proc_terminate($this->workerProcess);
            @proc_close($this->workerProcess);
        }
        $this->workerProcess = null;
        $this->workerPipes = [];
        $this->workerPort = null;
    }

    protected function getWorker(string $port, int $baud, string $parity, int $stopbits, float $timeout): ?array
    {
        if ($this->workerProcess && is_resource($this->workerProcess)) {
            $status = proc_get_status($this->workerProcess);
            if (!empty($status['running']) && $this->workerPort === $port) {
                return $this->workerPipes;
            }
            $this->stopWorker();
        }

        $exePath = PHP_OS_FAMILY === 'Windows' ? base_path('scripts/modbus_bridge.exe') : base_path('scripts/modbus_bridge');
        if (file_exists($exePath)) {
            $cmd = [$exePath];
        } else {
            $cmd = [$this->pythonPath, '-u', $this->scriptPath];
        }

        $cmd = array_merge($cmd, [
            '--port', $port,
            '--baud', (string) $baud,
            '--parity', $parity,
            '--stopbits', (string) $stopbits,
            '--timeout', (string) $timeout,
            'worker',
            '--tcp-port', (string) config('tn.tcp_port', 5029)
        ]);

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($cmd, $descriptors, $pipes, null, null);
        if (!is_resource($process)) {
            return null;
        }

        stream_set_timeout($pipes[1], 3);
        $readyLine = fgets($pipes[1]);
        $ready = json_decode($readyLine ?: '', true);

        if (!($ready['ready'] ?? false)) {
            foreach ($pipes as $p) {
                if (is_resource($p)) fclose($p);
            }
            @proc_close($process);
            return null;
        }

        $this->workerProcess = $process;
        $this->workerPipes = $pipes;
        $this->workerPort = $port;

        return $this->workerPipes;
    }

    public function tryExecuteViaTcp(string $command, TnController $controller, array $args = []): ?array
    {
        $tcpPort = (int) config('tn.tcp_port', 5029);
        $fp = null;
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $fp = @fsockopen('127.0.0.1', $tcpPort, $errno, $errstr, 1.5);
            if ($fp) {
                break;
            }
            usleep(50000);
        }

        if (!$fp) {
            return null;
        }

        stream_set_timeout($fp, 5);

        $payload = [
            'command' => $command,
            'slave' => (int) $controller->slave_id,
        ];

        for ($i = 0; $i < count($args); $i++) {
            if (is_string($args[$i]) && str_starts_with($args[$i], '--') && isset($args[$i + 1])) {
                $key = substr($args[$i], 2);
                $val = $args[$i + 1];
                if (is_numeric($val)) {
                    $val = str_contains($val, '.') ? (float) $val : (int) $val;
                }
                $payload[$key] = $val;
                $i++;
            }
        }

        $req = json_encode($payload) . "\n";
        @fwrite($fp, $req);
        $line = @fgets($fp);
        @fclose($fp);

        if (!$line) {
            return null;
        }

        $decoded = json_decode(trim($line), true);
        return is_array($decoded) ? $decoded : null;
    }

    protected function buildEnv(): array
    {
        $env = [];
        foreach ($_SERVER as $k => $v) {
            if (is_scalar($v)) {
                $env[$k] = (string) $v;
            }
        }
        if (!isset($env['SystemRoot'])) $env['SystemRoot'] = getenv('SystemRoot') ?: 'C:\\Windows';
        return $env;
    }

    protected function runPython(array $args, int $timeout = 10): array
    {
        $exePath = PHP_OS_FAMILY === 'Windows' ? base_path('scripts/modbus_bridge.exe') : base_path('scripts/modbus_bridge');
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
        return Cache::remember('tn_available_serial_ports', 10, function () {
            $result = $this->runPython(['list_ports'], 10);
            if ($result['success'] && isset($result['ports'])) {
                return $result['ports'];
            }
            return [];
        });
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
        // 1. Coba eksekusi lewat TCP worker bridge (jika worker aktif di background, respon ~15ms)
        $tcpResult = $this->tryExecuteViaTcp($command, $controller, $args);
        if ($tcpResult !== null && (isset($tcpResult['success']) || isset($tcpResult['error']))) {
            return $tcpResult;
        }

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
        $slaves = $controllers->pluck('slave_id')->map(fn($id) => (int)$id)->values()->all();
        $port = $this->resolveControllerPort($first);

        if (!$port || strtoupper((string) $port) === 'AUTO') {
            $this->clearPortCache($first);
            return [];
        }

        $baud = (int) ($first->baudrate ?? config('tn.baudrate'));
        $parity = $first->parity ?? config('tn.parity');
        $stopbits = (int) ($first->stopbits ?? config('tn.stopbits'));
        $timeout = (float) config('tn.timeout', 1);
        $pollTimeout = min($timeout, 0.4);

        // 1. Gunakan persistent worker jika tersedia (~124ms tanpa overhead spawn python)
        $pipes = $this->getWorker($port, $baud, $parity, $stopbits, $pollTimeout);
        if ($pipes && is_resource($pipes[0]) && is_resource($pipes[1])) {
            $req = json_encode([
                'command' => 'read_all',
                'slaves' => $slaves,
                'addr' => 1000,
                'count' => 27
            ]) . "\n";

            stream_set_timeout($pipes[1], (int) ceil(($pollTimeout * count($slaves)) + 2));
            if (@fwrite($pipes[0], $req) !== false) {
                $respLine = @fgets($pipes[1]);
                if ($respLine) {
                    $result = json_decode(trim($respLine), true);
                    if ($result && isset($result['controllers'])) {
                        return $result['controllers'];
                    }
                }
            }

            // Jika pembacaan worker gagal, stop worker untuk recovery
            $this->stopWorker();
        }

        // 2. Fallback: file lock + runPython biasa
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

            $slavesStr = implode(',', $slaves);
            $result = $this->runPython([
                '--port', $port,
                '--baud', (string)$baud,
                '--parity', $parity,
                '--stopbits', (string)$stopbits,
                '--timeout', (string)$pollTimeout,
                'read_all',
                '--slaves', $slavesStr,
                '--addr', '1000',
                '--count', '27',
            ], (int) ceil(($pollTimeout * count($slaves)) + 5));

            if (!$result['success'] || !isset($result['controllers'])) {
                if ($this->isConnectionError($result['error'] ?? '')) {
                    $this->clearPortCache($first);
                    if (strtoupper((string) $first->serial_port) !== 'AUTO') {
                        $first->update(['serial_port' => 'AUTO']);
                    }
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
