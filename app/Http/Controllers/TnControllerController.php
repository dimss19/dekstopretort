<?php

namespace App\Http\Controllers;

use App\Models\TnController;
use App\Services\TnModbusService;
use Inertia\Inertia;
use Symfony\Component\Process\Process;

class TnControllerController extends Controller
{
    public function index()
    {
        $controllerId = request()->session()->get('active_tn_id');

        if ($controllerId && $controller = TnController::find($controllerId)) {
            return redirect()->route('tn.monitor', $controller->id);
        }

        return redirect()->route('dashboard')->with('info', 'Pilih tipe controller terlebih dahulu.');
    }

    public function quickStart(string $model)
    {
        $model = strtoupper($model);
        abort_unless(in_array($model, ['TNS', 'TNH', 'TNL'], true), 404);

        $controller = TnController::query()
            ->where('model_type', $model)
            ->orderBy('id')
            ->first();

        if (!$controller) {
            $machine = \App\Models\Machine::firstOrCreate(
                ['machine_code' => "RT-{$model}"],
                ['machine_name' => "Retort {$model}", 'description' => "Production retort machine ({$model})", 'location' => 'Production Area', 'status' => 'Active']
            );

            $slaveId = $model === 'TNS' ? 1 : ($model === 'TNH' ? 2 : 3);
            $controller = TnController::create([
                'machine_id' => $machine->id,
                'name' => "{$model} Controller",
                'model_type' => $model,
                'slave_id' => $slaveId,
                'control_model' => 'program',
                'serial_port' => config('tn.serial_port', 'COM3'),
                'baudrate' => config('tn.baudrate', 9600),
                'parity' => config('tn.parity', 'N'),
                'stopbits' => config('tn.stopbits', 2),
                'communication' => 'RS485',
                'is_online' => true,
            ]);
        }

        if (empty($controller->serial_port)) {
            $controller->update(['serial_port' => config('tn.serial_port', 'COM3')]);
        }

        request()->session()->put([
            'active_tn_id' => $controller->id,
            'active_tn_model' => $controller->model_type,
        ]);

        return redirect()->route('tn.monitor', $controller->id);
    }

    public function show(TnController $tn)
    {
        return redirect()->route('tn.monitor', $tn->id);
    }

    public function destroy(TnController $tn)
    {
        $tn->delete();
        return redirect()->route('tn.index')->with('success', 'TN Controller deleted successfully.');
    }

    private function detectSerialPort(): string
    {
        $fallback = config('tn.serial_port', 'AUTO');
        $scriptPath = base_path('scripts/modbus_bridge.py');
        $env = $_SERVER;
        if (!isset($env['SystemRoot'])) $env['SystemRoot'] = getenv('SystemRoot') ?: 'C:\\Windows';

        try {
            $python = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';
            $process = new Process([$python, $scriptPath, 'list_ports'], null, $env);
            $process->setTimeout(10);
            $process->run();

            if ($process->isSuccessful()) {
                $result = json_decode($process->getOutput(), true);
                if ($result && isset($result['success']) && $result['success'] && !empty($result['ports'])) {
                    return $result['ports'][0]['device'];
                }
            }
        } catch (\Throwable $e) {
            // Fall back
        }

        if (PHP_OS_FAMILY !== 'Windows') {
            foreach (['/dev/ttyUSB*', '/dev/ttyACM*', '/dev/ttyAMA*', '/dev/ttyS*'] as $pattern) {
                $ports = glob($pattern);
                if (!empty($ports)) return $ports[0];
            }
            foreach (glob('/dev/serial/by-id/*') ?: [] as $port) {
                if (is_link($port)) return readlink($port);
            }
        }

        return $fallback;
    }

    public function testConnection(TnController $tn, TnModbusService $modbus)
    {
        $result = $modbus->testConnection($tn);
        if ($result['success']) {
            return response()->json(['message' => 'Connection successful', 'data' => $result['data']]);
        }
        return response()->json(['message' => 'Connection failed', 'error' => $result['error']], 500);
    }
}
