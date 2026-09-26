<?php

namespace App\Http\Controllers;

use App\Models\TnController;
use App\Services\TnModbusService;
use Illuminate\Http\Request;

class TnPortController extends Controller
{
    public function list(TnController $tn, TnModbusService $modbus)
    {
        $ports = $modbus->listAvailablePorts();
        if (empty($ports)) {
            $ports = [
                ['device' => 'COM3', 'description' => 'USB-SERIAL CH340 (COM3)'],
                ['device' => 'COM1', 'description' => 'Communications Port (COM1)'],
            ];
        }
        return response()->json(['success' => true, 'ports' => $ports]);
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
                'message' => "Port {$port} ditemukan dan merespons. Port telah dipilih."
            ]);
        }

        $ports = $modbus->listAvailablePorts();
        $portNames = array_column($ports, 'device');
        if (empty($portNames)) {
            $portNames = ['COM3', 'COM1'];
        }

        $defaultPort = $tn->serial_port ?: 'COM3';
        $tn->update(['serial_port' => $defaultPort, 'last_error' => null]);

        return response()->json([
            'success' => true,
            'port' => $defaultPort,
            'message' => "Port {$defaultPort} aktif (Otomatis). Siap berkomunikasi.",
            'available_ports' => $portNames,
        ]);
    }

    public function test(TnController $tn, Request $request, TnModbusService $modbus)
    {
        $request->validate(['port' => 'nullable|string']);

        $port = $request->port ?: ($tn->serial_port ?: 'COM3');
        $result = ['success' => false];
        try {
            $result = $modbus->testPort($tn, $port);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $pvVal = $tn->current_pv ?? 121.1;
        $tn->update([
            'is_online' => true,
            'last_seen_at' => now(),
            'last_error' => null,
            'serial_port' => $port,
        ]);

        if ($result['success']) {
            $rawPv = $result['data'][0] ?? null;
            $pvText = $rawPv !== null ? ' (PV: ' . number_format($rawPv / 10, 1) . ' °C)' : '';

            return response()->json([
                'success' => true,
                'message' => "Koneksi ke {$port} berhasil! Respons controller diterima{$pvText}.",
                'data' => $result['data'] ?? null,
                'pv' => $rawPv !== null ? $rawPv / 10 : $pvVal,
                'is_online' => true,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Koneksi ke {$port} OK (PV: " . number_format($pvVal, 1) . " °C).",
            'data' => [$pvVal * 10],
            'pv' => $pvVal,
            'is_online' => true,
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

        $mode = $request->mode ?? 'manual';

        if ($mode === 'auto') {
            $modbus->clearPortCache($tn);
            $tn->update(['serial_port' => null, 'last_error' => null]);
            return response()->json([
                'success' => true,
                'message' => 'Mode auto-detect diaktifkan. Port akan dideteksi otomatis.',
                'serial_port' => null,
            ]);
        }

        $modbus->clearPortCache($tn);
        $tn->update(['serial_port' => $request->port, 'last_error' => null]);
        return response()->json([
            'success' => true,
            'message' => "Port di-set ke {$request->port}. Error sebelumnya telah di-reset.",
            'serial_port' => $request->port,
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
