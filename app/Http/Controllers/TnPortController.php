<?php

namespace App\Http\Controllers;

use App\Models\TnController;
use App\Services\TnModbusService;
use Illuminate\Http\Request;

class TnPortController extends Controller
{
    public function list(TnController $tn, Request $request, TnModbusService $modbus)
    {
        $forceFresh = $request->boolean('fresh');
        $ports = $modbus->listAvailablePorts($forceFresh);

        $validDevices = array_column($ports, 'device');
        $validDevicesUpper = array_map('strtoupper', $validDevices);
        $currentPort = $tn->serial_port;

        if (!empty($validDevices)) {
            if ($currentPort && strtoupper($currentPort) !== 'AUTO' && !in_array(strtoupper($currentPort), $validDevicesUpper)) {
                $currentPort = $validDevices[0];
                $tn->update(['serial_port' => $currentPort]);
            }
        } else {
            if ($currentPort && strtoupper($currentPort) !== 'AUTO') {
                $tn->update(['serial_port' => 'AUTO']);
                $currentPort = 'AUTO';
            }
        }

        return response()->json([
            'success' => true,
            'current_port' => $currentPort ?: 'AUTO',
            'ports' => $ports,
        ]);
    }

    public function scan(TnController $tn, TnModbusService $modbus)
    {
        $modbus->clearPortCache($tn);
        $port = null;
        try {
            $port = $modbus->scanPorts($tn);
        } catch (\Throwable $e) {
            $port = null;
        }

        if ($port) {
            $tn->update(['serial_port' => $port, 'last_error' => null]);
            return response()->json([
                'success' => true,
                'port' => $port,
                'message' => "Port {$port} terdeteksi dan berhasil merespons controller."
            ]);
        }

        $ports = $modbus->listAvailablePorts();
        $portNames = array_column($ports, 'device');

        $defaultPort = $tn->serial_port ?: 'AUTO';
        $tn->update(['serial_port' => $defaultPort, 'last_error' => null]);

        return response()->json([
            'success' => true,
            'port' => $defaultPort,
            'message' => "Port diatur ke {$defaultPort}.",
            'available_ports' => $portNames,
        ]);
    }

    public function test(TnController $tn, Request $request, TnModbusService $modbus)
    {
        $request->validate(['port' => 'nullable|string']);

        $port = $request->port ?: ($tn->serial_port ?: 'AUTO');
        $result = ['success' => false];
        try {
            $result = $modbus->testPort($tn, $port);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        if ($result['success']) {
            $rawPv = $result['data'][0] ?? null;
            $pvVal = $rawPv !== null ? ($rawPv / 10) : ($tn->current_pv ?? 0.0);
            $tn->update([
                'is_online' => true,
                'last_seen_at' => now(),
                'last_error' => null,
                'serial_port' => $port,
            ]);

            return response()->json([
                'success' => true,
                'message' => "Koneksi ke {$port} berhasil! (PV: " . number_format($pvVal, 1) . " °C)",
                'pv' => $pvVal,
                'is_online' => true,
                'serial_port' => $port,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => "Koneksi ke {$port} gagal: " . ($result['error'] ?? 'Tidak ada respons dari controller'),
            'is_online' => false,
            'serial_port' => $port,
        ]);
    }

    public function togglePin(TnController $tn, Request $request, TnModbusService $modbus)
    {
        $request->validate([
            'channel' => 'required|string',
            'port' => 'nullable|string',
        ]);

        $result = ['success' => false];
        try {
            $result = $modbus->togglePin($tn, $request->channel, $request->port);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'] ?? "Pin {$request->channel} ({$tn->model_type}) berhasil dipicu aktif selama 2 detik.",
            'channel' => $request->channel,
        ]);
    }

    public function select(TnController $tn, Request $request, TnModbusService $modbus)
    {
        $request->validate([
            'port' => 'required|string',
            'mode' => 'sometimes|in:manual,auto',
        ]);

        $rawPort = trim($request->port);
        $isAuto = strtoupper($rawPort) === 'AUTO' || ($request->mode ?? '') === 'auto';
        $portToSave = $isAuto ? 'AUTO' : strtoupper($rawPort);

        $modbus->clearPortCache($tn);
        $tn->update(['serial_port' => $portToSave, 'last_error' => null]);

        return response()->json([
            'success' => true,
            'message' => $isAuto ? 'Mode Auto-Detect diaktifkan.' : "Port serial berhasil diatur ke {$portToSave}.",
            'serial_port' => $portToSave,
        ]);
    }

    public function status(TnController $tn)
    {
        $lastError = $tn->last_error;

        return response()->json([
            'success' => true,
            'is_online' => $tn->is_online,
            'serial_port' => $tn->serial_port,
            'last_seen_at' => $tn->last_seen_at,
            'last_error' => $lastError,
            'last_error_preview' => $lastError ? \Illuminate\Support\Str::limit($lastError, 120) : null,
        ]);
    }
}
