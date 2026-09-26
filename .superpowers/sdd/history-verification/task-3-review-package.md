93770ce feat: endpoint verify history + rename group + feature test
 app/Http/Controllers/TnMonitorController.php |  72 +++++++++++++++++
 routes/web.php                               |   2 +
 tests/Feature/HistoryVerificationTest.php    | 114 +++++++++++++++++++++++++++
 3 files changed, 188 insertions(+)
diff --git a/app/Http/Controllers/TnMonitorController.php b/app/Http/Controllers/TnMonitorController.php
index e3deec7..61e5695 100644
--- a/app/Http/Controllers/TnMonitorController.php
+++ b/app/Http/Controllers/TnMonitorController.php
@@ -228,20 +228,92 @@ public function saveHistory(TnController $tn, Request $request)
 
         return response()->json(['success' => true]);
     }
 
     public function destroyHistory(\App\Models\TnProcessHistory $history)
     {
         $history->delete();
         return back()->with('success', 'Process history deleted.');
     }
 
+    public function verifyHistory(\App\Models\TnProcessHistory $history, Request $request)
+    {
+        if (! $history->end_time || $history->verification_status === 'verified') {
+            return response()->json(['success' => false, 'message' => 'Hanya history selesai yang belum terverifikasi.'], 422);
+        }
+
+        // ponytail: manual Validator karena shouldRenderJsonWhen global membuat $request->validate() redirect (302) untuk JSON di route web.
+        $data = $this->validatedOrJson422($request, [
+            'product' => 'required|string|max:100',
+            'batch_code' => 'required|string|max:50|unique:tn_process_histories,batch_code',
+            'scheduled_process' => 'required|string|max:100',
+            'min_f0_achieved' => 'nullable|numeric|min:0',
+            'target_f0' => 'nullable|numeric|min:0',
+            'process_deviation' => 'required|in:None,Minor,Major',
+            'sterility_criterion' => 'required|in:PASS,FAIL',
+            'thermal_record' => 'required|in:VERIFIED,REJECTED',
+            'group_id' => 'required|exists:history_groups,id',
+        ]);
+
+        $systemF0 = \App\Services\F0Calculator::fromLogs($history->log_data ?? []);
+        $criterion = $data['sterility_criterion'];
+        if ($data['target_f0'] !== null && $systemF0 < (float) $data['target_f0']) {
+            $criterion = 'FAIL';
+        }
+
+        $history->update([
+            'product' => $data['product'],
+            'batch_code' => $data['batch_code'],
+            'scheduled_process' => $data['scheduled_process'],
+            'min_f0_achieved' => $data['min_f0_achieved'],
+            'target_f0' => $data['target_f0'],
+            'process_deviation' => $data['process_deviation'],
+            'sterility_criterion' => $criterion,
+            'thermal_record' => $data['thermal_record'],
+            'group_id' => $data['group_id'],
+            'verification_status' => 'verified',
+            'verified_by' => $request->user()->name,
+            'verified_at' => now(),
+        ]);
+
+        if ($request->wantsJson()) {
+            return response()->json(['success' => true, 'system_f0' => $systemF0, 'sterility_criterion' => $criterion]);
+        }
+
+        return back()->with('success', 'Batch berhasil diverifikasi.');
+    }
+
+    public function updateHistoryGroup(\App\Models\HistoryGroup $group, Request $request)
+    {
+        $data = $this->validatedOrJson422($request, [
+            'name' => 'required|string|max:50',
+            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
+        ]);
+        $group->update($data);
+
+        if ($request->wantsJson()) {
+            return response()->json(['success' => true]);
+        }
+
+        return back()->with('success', 'Nama group diperbarui.');
+    }
+
+    private function validatedOrJson422(Request $request, array $rules): array
+    {
+        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), $rules);
+        if ($validator->fails() && $request->wantsJson()) {
+            abort(response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422));
+        }
+
+        return $validator->validate();
+    }
+
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
diff --git a/routes/web.php b/routes/web.php
index 72ba153..d7fac37 100644
--- a/routes/web.php
+++ b/routes/web.php
@@ -72,20 +72,22 @@
         // Monitor & Control
         Route::get('/{tn}/monitor', [\App\Http\Controllers\TnMonitorController::class, 'show'])->name('tn.monitor');
         Route::post('/{tn}/cmd/run-stop', [\App\Http\Controllers\TnMonitorController::class, 'toggleRunStop'])->name('tn.cmd.runstop');
         Route::post('/{tn}/cmd/set-sv', [\App\Http\Controllers\TnMonitorController::class, 'setSv'])->name('tn.cmd.setsv');
         Route::post('/{tn}/cmd/auto-tune', [\App\Http\Controllers\TnMonitorController::class, 'startAutoTune'])->name('tn.cmd.autotune');
         Route::post('/{tn}/cmd/alarm-reset', [\App\Http\Controllers\TnMonitorController::class, 'resetAlarm'])->name('tn.cmd.alarmreset');
         Route::post('/{tn}/cmd/set-mode', [\App\Http\Controllers\TnMonitorController::class, 'setMode'])->name('tn.cmd.setmode');
         Route::get('/{tn}/readings', [\App\Http\Controllers\TnMonitorController::class, 'readings'])->name('tn.readings');
         Route::post('/{tn}/history', [\App\Http\Controllers\TnMonitorController::class, 'saveHistory'])->name('tn.history.save');
         Route::delete('/history/{history}', [\App\Http\Controllers\TnMonitorController::class, 'destroyHistory'])->name('tn.history.destroy');
+        Route::post('/history/{history}/verify', [\App\Http\Controllers\TnMonitorController::class, 'verifyHistory'])->name('tn.history.verify');
+        Route::put('/history-groups/{group}', [\App\Http\Controllers\TnMonitorController::class, 'updateHistoryGroup'])->name('tn.history-groups.update');
         Route::post('/{tn}/ingest-reading', [\App\Http\Controllers\TnMonitorController::class, 'ingestReading'])->name('tn.ingest-reading');
         // Port Management
         Route::get('/{tn}/port/list', [\App\Http\Controllers\TnPortController::class, 'list'])->name('tn.port.list');
         Route::post('/{tn}/port/scan', [\App\Http\Controllers\TnPortController::class, 'scan'])->name('tn.port.scan');
         Route::post('/{tn}/port/test', [\App\Http\Controllers\TnPortController::class, 'test'])->name('tn.port.test');
         Route::post('/{tn}/port/toggle-pin', [\App\Http\Controllers\TnPortController::class, 'togglePin'])->name('tn.port.toggle-pin');
         Route::post('/{tn}/port/select', [\App\Http\Controllers\TnPortController::class, 'select'])->name('tn.port.select');
         Route::get('/{tn}/port/status', [\App\Http\Controllers\TnPortController::class, 'status'])->name('tn.port.status');
     });
 
diff --git a/tests/Feature/HistoryVerificationTest.php b/tests/Feature/HistoryVerificationTest.php
new file mode 100644
index 0000000..bb585c5
--- /dev/null
+++ b/tests/Feature/HistoryVerificationTest.php
@@ -0,0 +1,114 @@
+<?php
+
+namespace Tests\Feature;
+
+use App\Models\HistoryGroup;
+use App\Models\Machine;
+use App\Models\TnController;
+use App\Models\TnProcessHistory;
+use App\Models\User;
+use Illuminate\Foundation\Testing\RefreshDatabase;
+use Tests\TestCase;
+
+class HistoryVerificationTest extends TestCase
+{
+    use RefreshDatabase;
+
+    private static int $historySeq = 0;
+
+    private function makeHistory(bool $finished = true): TnProcessHistory
+    {
+        // ponytail: counter agar machine_code/slave_id unik saat dipanggil 2x dalam satu test.
+        self::$historySeq++;
+        $machine = Machine::create(['machine_code' => 'RT-9'.self::$historySeq, 'machine_name' => 'Retort '.self::$historySeq]);
+        $tn = TnController::create([
+            'machine_id' => $machine->id,
+            'name' => 'TN-'.self::$historySeq,
+            'slave_id' => 100 + self::$historySeq,
+            'model_type' => 'TNH',
+            'control_model' => 'fixed',
+        ]);
+        $logs = array_map(
+            fn ($i) => ['pv' => 121.1, 'decimal_point' => 0, 'sv' => 121.1, 'heating_mv' => 650, 'created_at' => now()->addSeconds($i)->toIso8601String()],
+            range(0, 59)
+        );
+
+        return TnProcessHistory::create([
+            'tn_controller_id' => $tn->id,
+            'start_time' => now()->subHour(),
+            'end_time' => $finished ? now() : null,
+            'log_data' => $logs,
+        ]);
+    }
+
+    private function payload(array $over = []): array
+    {
+        return array_merge([
+            'product' => 'Rendang pouch 250 g',
+            'batch_code' => '20260926-01',
+            'scheduled_process' => '121.1C / 25 min',
+            'min_f0_achieved' => 1.0,
+            'target_f0' => 0.5,
+            'process_deviation' => 'None',
+            'sterility_criterion' => 'PASS',
+            'thermal_record' => 'VERIFIED',
+            'group_id' => HistoryGroup::orderBy('id')->first()->id,
+        ], $over);
+    }
+
+    public function test_verify_finished_history(): void
+    {
+        $user = User::factory()->create(['name' => 'Operator 1']);
+        $history = $this->makeHistory();
+
+        $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload());
+
+        $res->assertOk()->assertJson(['success' => true, 'system_f0' => 1.0]);
+        $this->assertDatabaseHas('tn_process_histories', [
+            'id' => $history->id,
+            'verification_status' => 'verified',
+            'verified_by' => 'Operator 1',
+        ]);
+    }
+
+    public function test_system_f0_below_target_forces_fail(): void
+    {
+        $user = User::factory()->create();
+        $history = $this->makeHistory();
+
+        $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload([
+            'batch_code' => '20260926-02',
+            'target_f0' => 99.0,
+        ]));
+
+        $res->assertOk()->assertJson(['success' => true]);
+        $this->assertDatabaseHas('tn_process_histories', ['id' => $history->id, 'sterility_criterion' => 'FAIL']);
+    }
+
+    public function test_verify_running_or_twice_returns_422(): void
+    {
+        $user = User::factory()->create();
+        $running = $this->makeHistory(false);
+
+        $this->actingAs($user)->postJson(route('tn.history.verify', $running), $this->payload())
+            ->assertStatus(422);
+
+        $done = $this->makeHistory();
+        $this->actingAs($user)->postJson(route('tn.history.verify', $done), $this->payload(['batch_code' => 'X-1']));
+        $this->actingAs($user)->postJson(route('tn.history.verify', $done), $this->payload(['batch_code' => 'X-2']))
+            ->assertStatus(422);
+    }
+
+    public function test_rename_group_and_reject_bad_color(): void
+    {
+        $user = User::factory()->create();
+        $group = HistoryGroup::orderBy('id')->first();
+
+        $this->actingAs($user)->putJson(route('tn.history-groups.update', $group), ['name' => 'Rendang', 'color' => '#b45309'])
+            ->assertOk();
+        $this->assertDatabaseHas('history_groups', ['id' => $group->id, 'name' => 'Rendang']);
+
+        $this->actingAs($user)->putJson(route('tn.history-groups.update', $group), ['name' => 'X', 'color' => 'red'])
+            ->assertStatus(422);
+    }
+}
