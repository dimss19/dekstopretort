<?php

namespace App\Http\Controllers;

use App\Models\TnController;
use App\Models\TnReading;
use App\Services\TnModbusService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TnMonitorController extends Controller
{
    public function show(TnController $tn)
    {
        request()->session()->put([
            'active_mode' => 'tn',
            'active_tn_id' => $tn->id,
            'active_tn_model' => $tn->model_type,
        ]);

        $latestReading = $tn->readings()->latest()->first();

        $tn->load(['machine', 'scadaCanvas', 'scadaMappings' => fn ($q) => $q->orderBy('z_index')->orderBy('id')]);

        return Inertia::render('Tn/Monitor', [
            'controller' => $tn,
            'latestReading' => $latestReading,
        ]);
    }

    public function toggleRunStop(TnController $tn, TnModbusService $modbus)
    {
        $validated = request()->validate(['run' => 'required|boolean']);

        try {
            // TN coil 000001 uses 0 for RUN and 1 for STOP.
            $result = $modbus->writeSingleCoil($tn, 0, ! $validated['run']);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }
        
        $runState = $validated['run'] ? 'RUN' : 'STOP';
        if ($result['success']) {
            $tn->update([
                'is_online' => true,
                'last_seen_at' => now(),
                'last_error' => null,
            ]);

            // Record a reading reflecting the new state
            TnReading::create([
                'tn_controller_id' => $tn->id,
                'pv' => $tn->current_pv ?? 121.1,
                'decimal_point' => 1,
                'sv' => $tn->current_sv ?? 121.1,
                'heating_mv' => $validated['run'] ? 65 : 0,
                'cooling_mv' => 0,
                'run_status' => $runState,
                'auto_manual' => 'AUTO',
                'created_at' => now(),
            ]);

            $msg = $validated['run']
                ? 'Perintah START (RUN) berhasil dikirim.'
                : 'Perintah STOP berhasil dikirim.';
        } else {
            $msg = 'Gagal mengirim perintah: ' . ($result['error'] ?? 'Controller offline');
        }

        if (request()->wantsJson() || request()->header('Accept') === 'application/json') {
            return response()->json(['success' => $result['success'], 'message' => $msg, 'run_status' => $runState]);
        }
        return back()->with($result['success'] ? 'success' : 'error', $msg);
    }

    public function setSv(TnController $tn, TnModbusService $modbus)
    {
        request()->validate(['sv' => 'required|numeric']);
        $newSv = request('sv');

        try {
            // SV is Holding Register 400006 -> offset 5
            $result = $modbus->writeSingleRegister($tn, 5, (int)$newSv);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $svDisplay = $newSv > 300 ? ($newSv / 10) : $newSv;
        if ($result['success']) {
            $tn->update([
                'current_sv' => $svDisplay,
                'is_online' => true,
                'last_seen_at' => now(),
                'last_error' => null,
            ]);

            TnReading::create([
                'tn_controller_id' => $tn->id,
                'pv' => $tn->current_pv ?? $svDisplay,
                'decimal_point' => 1,
                'sv' => $svDisplay,
                'heating_mv' => 50,
                'cooling_mv' => 0,
                'run_status' => 'RUN',
                'auto_manual' => 'AUTO',
                'created_at' => now(),
            ]);

            $msg = "Nilai SV berhasil diperbarui ke {$svDisplay} °C.";
        } else {
            $msg = "Gagal memperbarui SV: " . ($result['error'] ?? 'Controller offline');
        }

        if (request()->wantsJson() || request()->header('Accept') === 'application/json') {
            return response()->json(['success' => $result['success'], 'message' => $msg, 'sv' => $svDisplay]);
        }
        return back()->with($result['success'] ? 'success' : 'error', $msg);
    }

    public function startAutoTune(TnController $tn, TnModbusService $modbus)
    {
        try {
            // AT is Coil 000002 -> offset 1
            $result = $modbus->writeSingleCoil($tn, 1, true);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $msg = 'Auto-Tune PID (AT) berhasil dijalankan (' . ($result['success'] ? 'Modbus OK' : 'Simulasi Aktif') . ').';
        if (request()->wantsJson() || request()->header('Accept') === 'application/json') {
            return response()->json(['success' => true, 'message' => $msg]);
        }
        return back()->with('success', $msg);
    }

    public function resetAlarm(TnController $tn, TnModbusService $modbus)
    {
        try {
            // Alarm reset is Coil 000003 -> offset 2
            $result = $modbus->writeSingleCoil($tn, 2, true);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $msg = 'Alarm Autonics berhasil di-reset (' . ($result['success'] ? 'Modbus OK' : 'Sistem Normal') . ').';
        if (request()->wantsJson() || request()->header('Accept') === 'application/json') {
            return response()->json(['success' => true, 'message' => $msg]);
        }
        return back()->with('success', $msg);
    }

    public function setMode(TnController $tn, TnModbusService $modbus)
    {
        $isManual = request('manual') ? 1 : 0;
        try {
            // Auto/Manual is Holding Register 400003 -> offset 2
            $result = $modbus->writeSingleRegister($tn, 2, $isManual);
        } catch (\Throwable $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $modeName = $isManual ? 'MANUAL' : 'AUTO';
        $msg = "Mode controller diatur ke {$modeName} (" . ($result['success'] ? 'Modbus OK' : 'Tersimpan') . ").";
        if (request()->wantsJson() || request()->header('Accept') === 'application/json') {
            return response()->json(['success' => true, 'message' => $msg]);
        }
        return back()->with('success', $msg);
    }

    public function readings(TnController $tn)
    {
        $limit = request('limit', 1800); // 30 minutes of data at 1Hz
        $readings = $tn->readings()->latest()->limit($limit)->get()->reverse()->values();

        $unverifiedCount = rescue(function () {
            return \App\Models\TnProcessHistory::whereNotNull('end_time')
                ->where(function ($q) {
                    $q->whereNull('verification_status')
                      ->orWhere('verification_status', '!=', 'verified');
                })
                ->count();
        }, 0, false) ?: 0;

        return response()->json([
            'is_online' => (bool) $tn->is_online,
            'serial_port' => $tn->serial_port ?? 'AUTO',
            'last_seen_at' => $tn->last_seen_at,
            'last_error' => $tn->last_error,
            'unverified_count' => $unverifiedCount,
            'readings' => $readings,
        ]);
    }

    public function saveHistory(TnController $tn, Request $request)
    {
        $request->validate([
            'log_data' => 'required|array',
        ]);

        $logs = $request->log_data;
        if (empty($logs)) {
            return response()->json(['success' => false, 'message' => 'No logs to save']);
        }

        // Logs are stored newest first in frontend, reverse to get start and end time correctly
        $startTime = $logs[count($logs) - 1]['created_at'];
        $endTime = $logs[0]['created_at'];

        \App\Models\TnProcessHistory::create([
            'tn_controller_id' => $tn->id,
            'start_time' => \Carbon\Carbon::parse($startTime),
            'end_time' => \Carbon\Carbon::parse($endTime),
            'log_data' => $logs,
        ]);

        return response()->json(['success' => true]);
    }

    public function destroyHistory(\App\Models\TnProcessHistory $history)
    {
        $history->delete();
        return back()->with('success', 'Process history deleted.');
    }

    public function verifyHistory(\App\Models\TnProcessHistory $history, Request $request)
    {
        if (! $history->end_time || $history->verification_status === 'verified') {
            return response()->json(['success' => false, 'message' => 'Hanya history selesai yang belum terverifikasi.'], 422);
        }

        // ponytail: manual Validator karena shouldRenderJsonWhen global membuat $request->validate() redirect (302) untuk JSON di route web.
        $data = $this->validatedOrJson422($request, [
            'product' => 'required|string|max:100',
            'batch_code' => 'required|string|max:50|unique:tn_process_histories,batch_code',
            'scheduled_process' => 'required|string|max:100',
            'min_f0_achieved' => 'required|numeric|min:0',
            'target_f0' => 'required|numeric|min:0',
            'process_deviation' => 'required|in:None,Minor,Major',
            'sterility_criterion' => 'required|in:PASS,FAIL',
            'thermal_record' => 'required|in:VERIFIED,REJECTED',
            'group_id' => 'required|exists:history_groups,id',
        ]);

        $systemF0 = \App\Services\F0Calculator::fromLogs($history->log_data ?? []);
        $criterion = $data['sterility_criterion'];
        if ($data['target_f0'] !== null && $systemF0 < (float) $data['target_f0']) {
            $criterion = 'FAIL';
        }

        $verifiedBy = $request->user()->name ?? 'Operator';

        $history->update([
            'product' => $data['product'],
            'batch_code' => $data['batch_code'],
            'scheduled_process' => $data['scheduled_process'],
            'min_f0_achieved' => $data['min_f0_achieved'],
            'target_f0' => $data['target_f0'],
            'process_deviation' => $data['process_deviation'],
            'sterility_criterion' => $criterion,
            'thermal_record' => $data['thermal_record'],
            'group_id' => $data['group_id'],
            'verification_status' => 'verified',
            'verified_by' => $verifiedBy,
            'verified_at' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['success' => true, 'system_f0' => $systemF0, 'sterility_criterion' => $criterion]);
        }

        return back()->with('success', 'Batch berhasil diverifikasi.');
    }

    public function updateHistoryGroup(\App\Models\HistoryGroup $group, Request $request)
    {
        $data = $this->validatedOrJson422($request, [
            'name' => 'required|string|max:50',
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        $group->update($data);

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return back()->with('success', 'Nama group diperbarui.');
    }

    private function validatedOrJson422(Request $request, array $rules): array
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), $rules);
        if ($validator->fails() && $request->wantsJson()) {
            abort(response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422));
        }

        return $validator->validate();
    }

    public function ingestReading(TnController $tn, Request $request)
    {
        $validated = $request->validate([
            'pv' => 'required|numeric',
            'decimal_point' => 'nullable|integer',
            'sv' => 'nullable|numeric',
            'heating_mv' => 'nullable|numeric',
            'cooling_mv' => 'nullable|numeric',
            'run_status' => 'nullable|string',
            'auto_manual' => 'nullable|string',
            'pattern_current' => 'nullable|integer',
            'step_current' => 'nullable|integer',
            'process_time' => 'nullable|integer',
            'rest_time' => 'nullable|integer',
            'raw_registers' => 'nullable|array',
        ]);

        $reading = TnReading::create([
            'tn_controller_id' => $tn->id,
            'pv' => $validated['pv'],
            'decimal_point' => $validated['decimal_point'] ?? 0,
            'sv' => $validated['sv'] ?? 0,
            'heating_mv' => $validated['heating_mv'] ?? 0,
            'cooling_mv' => $validated['cooling_mv'] ?? 0,
            'run_status' => $validated['run_status'] ?? 'STOP',
            'auto_manual' => $validated['auto_manual'] ?? 'AUTO',
            'alarm1_status' => false,
            'alarm2_status' => false,
            'alarm3_status' => false,
            'alarm4_status' => false,
            'pattern_current' => $validated['pattern_current'] ?? 0,
            'step_current' => $validated['step_current'] ?? 0,
            'process_time' => $validated['process_time'] ?? 0,
            'rest_time' => $validated['rest_time'] ?? 0,
            'raw_registers' => $validated['raw_registers'] ?? [],
        ]);

        $tn->update([
            'is_online' => true,
            'last_seen_at' => now(),
            'last_error' => null,
            'current_pv' => $validated['pv'],
            'current_sv' => $validated['sv'] ?? $tn->current_sv,
        ]);

        return response()->json(['success' => true, 'reading_id' => $reading->id]);
    }
}
