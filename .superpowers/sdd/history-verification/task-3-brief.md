### Task 3: Endpoint verify + rename group (TDD)

**Files:**
- Modify: `app/Http/Controllers/TnMonitorController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/HistoryVerificationTest.php`

**Interfaces:**
- Consumes: `F0Calculator::fromLogs()` (Task 2), relasi `group()` (Task 1).
- Produces: rute `tn.history.verify` dan `tn.history-groups.update` untuk Task 7 (form inline).

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature;

use App\Models\HistoryGroup;
use App\Models\Machine;
use App\Models\TnController;
use App\Models\TnProcessHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoryVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function makeHistory(bool $finished = true): TnProcessHistory
    {
        $machine = Machine::create(['machine_code' => 'RT-001', 'machine_name' => 'Retort 1']);
        $tn = TnController::create([
            'machine_id' => $machine->id,
            'name' => 'TN-1',
            'slave_id' => 1,
            'model_type' => 'TNH',
            'control_model' => 'fixed',
        ]);
        $logs = array_map(
            fn ($i) => ['pv' => 121.1, 'decimal_point' => 0, 'sv' => 121.1, 'heating_mv' => 650, 'created_at' => now()->addSeconds($i)->toIso8601String()],
            range(0, 59)
        );

        return TnProcessHistory::create([
            'tn_controller_id' => $tn->id,
            'start_time' => now()->subHour(),
            'end_time' => $finished ? now() : null,
            'log_data' => $logs,
        ]);
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'product' => 'Rendang pouch 250 g',
            'batch_code' => '20260926-01',
            'scheduled_process' => '121.1C / 25 min',
            'min_f0_achieved' => 1.0,
            'target_f0' => 0.5,
            'process_deviation' => 'None',
            'sterility_criterion' => 'PASS',
            'thermal_record' => 'VERIFIED',
            'group_id' => HistoryGroup::orderBy('id')->first()->id,
        ], $over);
    }

    public function test_verify_finished_history(): void
    {
        $user = User::factory()->create(['name' => 'Operator 1']);
        $history = $this->makeHistory();

        $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload());

        $res->assertOk()->assertJson(['success' => true, 'system_f0' => 1.0]);
        $this->assertDatabaseHas('tn_process_histories', [
            'id' => $history->id,
            'verification_status' => 'verified',
            'verified_by' => 'Operator 1',
        ]);
    }

    public function test_system_f0_below_target_forces_fail(): void
    {
        $user = User::factory()->create();
        $history = $this->makeHistory();

        $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload([
            'batch_code' => '20260926-02',
            'target_f0' => 99.0,
        ]));

        $res->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('tn_process_histories', ['id' => $history->id, 'sterility_criterion' => 'FAIL']);
    }

    public function test_verify_running_or_twice_returns_422(): void
    {
        $user = User::factory()->create();
        $running = $this->makeHistory(false);

        $this->actingAs($user)->postJson(route('tn.history.verify', $running), $this->payload())
            ->assertStatus(422);

        $done = $this->makeHistory();
        $this->actingAs($user)->postJson(route('tn.history.verify', $done), $this->payload(['batch_code' => 'X-1']));
        $this->actingAs($user)->postJson(route('tn.history.verify', $done), $this->payload(['batch_code' => 'X-2']))
            ->assertStatus(422);
    }

    public function test_rename_group_and_reject_bad_color(): void
    {
        $user = User::factory()->create();
        $group = HistoryGroup::orderBy('id')->first();

        $this->actingAs($user)->putJson(route('tn.history-groups.update', $group), ['name' => 'Rendang', 'color' => '#b45309'])
            ->assertOk();
        $this->assertDatabaseHas('history_groups', ['id' => $group->id, 'name' => 'Rendang']);

        $this->actingAs($user)->putJson(route('tn.history-groups.update', $group), ['name' => 'X', 'color' => 'red'])
            ->assertStatus(422);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=HistoryVerificationTest`
Expected: FAIL (route not defined)

- [ ] **Step 3: Write controller methods**

Tambah di `TnMonitorController.php`:

```php
public function verifyHistory(\App\Models\TnProcessHistory $history, Request $request)
{
    if (! $history->end_time || $history->verification_status === 'verified') {
        return response()->json(['success' => false, 'message' => 'Hanya history selesai yang belum terverifikasi.'], 422);
    }

    $data = $request->validate([
        'product' => 'required|string|max:100',
        'batch_code' => 'required|string|max:50|unique:tn_process_histories,batch_code',
        'scheduled_process' => 'required|string|max:100',
        'min_f0_achieved' => 'nullable|numeric|min:0',
        'target_f0' => 'nullable|numeric|min:0',
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
        'verified_by' => $request->user()->name,
        'verified_at' => now(),
    ]);

    if ($request->wantsJson()) {
        return response()->json(['success' => true, 'system_f0' => $systemF0, 'sterility_criterion' => $criterion]);
    }

    return back()->with('success', 'Batch berhasil diverifikasi.');
}

public function updateHistoryGroup(\App\Models\HistoryGroup $group, Request $request)
{
    $data = $request->validate([
        'name' => 'required|string|max:50',
        'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
    ]);
    $group->update($data);

    if ($request->wantsJson()) {
        return response()->json(['success' => true]);
    }

    return back()->with('success', 'Nama group diperbarui.');
}
```

Tambah import `use Illuminate\Http\Request;` (sudah ada) dan pastikan `TnProcessHistory`/`HistoryGroup` ter-referensi FQCN seperti di atas.

- [ ] **Step 4: Write routes**

Di `routes/web.php` dalam grup prefix `tn`, setelah route history existing:

```php
Route::post('/history/{history}/verify', [\App\Http\Controllers\TnMonitorController::class, 'verifyHistory'])->name('tn.history.verify');
Route::put('/history-groups/{group}', [\App\Http\Controllers\TnMonitorController::class, 'updateHistoryGroup'])->name('tn.history-groups.update');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=HistoryVerificationTest`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/TnMonitorController.php routes/web.php tests/Feature/HistoryVerificationTest.php
git commit -m "feat: endpoint verify history + rename group + feature test"
```

---


