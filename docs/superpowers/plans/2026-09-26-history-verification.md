# History Verification + Group + F0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Batch sterilisasi yang selesai otomatis berlabel UNVERIFIED, bisa diverifikasi operator lewat form inline 8 field + dropdown group, dengan F0 sistem otomatis dan aturan VALID/FAIL strict, di satu historian bersama TN+ESP.

**Architecture:** Kolom verifikasi di tabel `tn_process_histories` + tabel kecil `history_groups` (2 baris seed); endpoint verify (dengan override FAIL backend) dan rename group; komponen `HistorianList` dipakai `Operations.tsx` dan `Esp/Monitor.tsx`; helper F0 PHP + penyesuaian `calculateF0` TS ke Tref 121.1.

**Tech Stack:** Laravel (PHP), MySQL/SQLite, React + Inertia, TypeScript, PHPUnit, Vitest.

## Global Constraints

- Satu role operator, tanpa admin; TIDAK ada role/permission baru.
- Perbandingan F0 strict tanpa toleransi: nilai round 2 desimal, operator `<` murni.
- Metode F0 1-titik: `F0 = jumlah(10^((T-121.1)/10)) x (1/60)`, hanya T >= 100C, round 2 desimal.
- Group tepat 2 slot, hanya rename + warna; TIDAK ada tambah/hapus group.
- Rute existing tidak berubah; rute baru sejajar pola `/tn/history/...`.
- Kolom enum di DB memakai `string` + validasi controller (aman lintas MySQL/SQLite).
- Setiap task diakhiri commit; setiap task menjalankan test yang relevan.

---

## File Structure

- `database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php` (baru): kolom verifikasi + tabel `history_groups` + seed 2 baris.
- `app/Models/HistoryGroup.php` (baru): `hasMany` histories.
- `app/Models/TnProcessHistory.php` (ubah): casts baru + relasi `group()`.
- `app/Services/F0Calculator.php` (baru): `fromLogs(array): float`.
- `app/Http/Controllers/TnMonitorController.php` (ubah): `verifyHistory()` + `updateHistoryGroup()`.
- `routes/web.php` (ubah): `tn.history.verify` + `tn.history-groups.update`; kirim `groups` ke historian TN.
- `app/Http/Controllers/EspMonitorController.php` (ubah): kirim `groups` ke view ESP.
- `resources/js/Pages/Tn/retortTelemetry.ts` (ubah): Tref 121.11 -> 121.1.
- `resources/js/Components/History/historyHelpers.ts` (baru): `getHistoryStatus`, `compareF0`, `filterHistories`.
- `resources/js/Components/History/HistorianList.tsx` (baru, pindahan dari `Operations.tsx`): list + filter + chip group + rename + badge.
- `resources/js/Pages/Operations.tsx` (ubah): pakai `HistorianList`, hapus duplikasi lokal.
- `resources/js/Components/History/ProcessDetailView.tsx` (ubah): stat F0 + VALID/FAIL + form inline + export.
- `resources/js/Pages/Esp/Monitor.tsx` (ubah): tab history pakai `HistorianList`, hapus duplikasi lokal.
- Test: `tests/Feature/HistoryVerificationSchemaTest.php`, `tests/Unit/F0CalculatorTest.php`, `tests/Feature/HistoryVerificationTest.php`, `resources/js/Components/History/__tests__/historyHelpers.test.ts`, tambah di `resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts`.

---

### Task 1: Migration verifikasi + group + model

**Files:**
- Create: `database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php`
- Create: `app/Models/HistoryGroup.php`
- Modify: `app/Models/TnProcessHistory.php`
- Test: `tests/Feature/HistoryVerificationSchemaTest.php`

**Interfaces:**
- Consumes: tabel `tn_process_histories` existing (kolom `end_time` nullable, `log_data` nullable).
- Produces: kolom verifikasi + relasi `TnProcessHistory::group()` dan `HistoryGroup::histories()` untuk Task 3, 6, 7.

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature;

use App\Models\HistoryGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HistoryVerificationSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_verification_columns_exist(): void
    {
        foreach (['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id'] as $col) {
            $this->assertTrue(Schema::hasColumn('tn_process_histories', $col), "missing column {$col}");
        }
    }

    public function test_two_groups_seeded(): void
    {
        $this->assertSame(2, HistoryGroup::count());
        $this->assertSame(['Group 1', 'Group 2'], HistoryGroup::orderBy('id')->pluck('name')->all());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=HistoryVerificationSchemaTest`
Expected: FAIL (class HistoryGroup not found / columns missing)

- [ ] **Step 3: Write migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('history_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->string('color', 7)->default('#2563eb');
            $table->timestamps();
        });

        DB::table('history_groups')->insert([
            ['name' => 'Group 1', 'color' => '#2563eb', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Group 2', 'color' => '#059669', 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::table('tn_process_histories', function (Blueprint $table) {
            $table->string('verification_status', 12)->default('unverified');
            $table->string('product', 100)->nullable();
            $table->string('batch_code', 50)->nullable()->unique();
            $table->string('scheduled_process', 100)->nullable();
            $table->decimal('min_f0_achieved', 8, 2)->nullable();
            $table->decimal('target_f0', 8, 2)->nullable();
            $table->string('process_deviation', 10)->nullable();
            $table->string('sterility_criterion', 10)->nullable();
            $table->string('thermal_record', 10)->nullable();
            $table->string('verified_by', 100)->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('group_id')->nullable()->constrained('history_groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tn_process_histories', function (Blueprint $table) {
            $table->dropForeign(['group_id']);
            $table->dropColumn(['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id']);
        });
        Schema::dropIfExists('history_groups');
    }
};
```

- [ ] **Step 4: Write model + casts**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoryGroup extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function histories()
    {
        return $this->hasMany(TnProcessHistory::class, 'group_id');
    }
}
```

Di `TnProcessHistory.php`, tambah ke `$casts`:

```php
'verification_status' => 'string',
'min_f0_achieved' => 'decimal:2',
'target_f0' => 'decimal:2',
'verified_at' => 'datetime',
```

dan relasi:

```php
public function group()
{
    return $this->belongsTo(HistoryGroup::class, 'group_id');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=HistoryVerificationSchemaTest`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php app/Models/HistoryGroup.php app/Models/TnProcessHistory.php tests/Feature/HistoryVerificationSchemaTest.php
git commit -m "feat: migration verifikasi history + history_groups seed 2 baris"
```

---

### Task 2: F0Calculator PHP (TDD)

**Files:**
- Create: `app/Services/F0Calculator.php`
- Test: `tests/Unit/F0CalculatorTest.php`

**Interfaces:**
- Consumes: `log_data` array (tiap item: `pv`, `decimal_point`).
- Produces: `F0Calculator::fromLogs(array $logs): float` untuk Task 3 (backend verify).

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit;

use App\Services\F0Calculator;
use PHPUnit\Framework\TestCase;

class F0CalculatorTest extends TestCase
{
    private function logs(array $pvs, int $dp = 0): array
    {
        return array_map(fn ($pv) => ['pv' => $pv, 'decimal_point' => $dp], $pvs);
    }

    public function test_constant_121_1_for_60_seconds_is_1(): void
    {
        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 121.1))));
    }

    public function test_single_point_method_not_trapezoid(): void
    {
        $this->assertSame(0.05, F0Calculator::fromLogs($this->logs([120, 121, 122])));
    }

    public function test_below_100_contributes_zero(): void
    {
        $this->assertSame(0.0, F0Calculator::fromLogs($this->logs(array_fill(0, 600, 90))));
    }

    public function test_decimal_point_and_overscale_normalized(): void
    {
        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 1)));
        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 0)));
    }
}
```

Nilai ekspektasi: L(120)=0.77625, L(121)=0.97724, L(122)=1.23027; jumlah/60=0.04973 -> 0.05. Trapezoid memberi 0.03, jadi test ini mengunci metode 1-titik.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=F0CalculatorTest`
Expected: FAIL (class not found)

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Services;

class F0Calculator
{
    public const TREF = 121.1;
    public const Z = 10.0;
    public const DT_MINUTES = 1 / 60;

    public static function fromLogs(array $logs): float
    {
        $f0 = 0.0;
        foreach ($logs as $log) {
            $pv = (float) ($log['pv'] ?? 0);
            $dp = (int) ($log['decimal_point'] ?? 0);
            if ($dp > 0) {
                $pv /= 10 ** $dp;
            }
            if ($pv > 300) {
                $pv /= 10;
            }
            if ($pv < 100) {
                continue;
            }
            $f0 += (10 ** (($pv - self::TREF) / self::Z)) * self::DT_MINUTES;
        }

        return round($f0, 2);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=F0CalculatorTest`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/Services/F0Calculator.php tests/Unit/F0CalculatorTest.php
git commit -m "feat: F0Calculator 1-titik Tref 121.1 + unit test"
```

---

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

### Task 4: calculateF0 TS ke Tref 121.1

**Files:**
- Modify: `resources/js/Pages/Tn/retortTelemetry.ts` (baris 239: `121.11` -> `121.1`, update komentar rumus)
- Modify: `resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts` (tambah test diskriminator)

**Interfaces:**
- Consumes: tidak ada (pure function).
- Produces: `calculateF0` akurat Tref 121.1 untuk Task 7 (tampilan F0 + VALID/FAIL live).

- [ ] **Step 1: Write the failing test** (tambah di file test existing)

```ts
it('uses single-point method with Tref 121.1 (not trapezoid)', () => {
    expect(calculateF0([120, 121, 122], 1)).toBe(0.05);
});
```

Test existing (60x121.11 -> 1, dst) tetap hijau karena suhu konstan.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- retortTelemetry`
Expected: FAIL (dapat 0.03 ala trapezoid-ish/offset Tref lama; yang pasti bukan 0.05)

- [ ] **Step 3: Write minimal implementation**

```ts
export function calculateF0(temperatures: number[], intervalSeconds: number = 1): number {
    let f0 = 0;
    const dtMinutes = intervalSeconds / 60;
    for (const temp of temperatures) {
        if (temp >= 100) {
            f0 += dtMinutes * Math.pow(10, (temp - 121.1) / 10);
        }
    }
    return Math.round(f0 * 100) / 100;
}
```

Hanya konstanta `121.11` -> `121.1`; struktur loop 1-titik dipertahankan.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- retortTelemetry`
Expected: PASS (semua testincl. 3 test lama)

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Tn/retortTelemetry.ts resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
git commit -m "fix: calculateF0 Tref 121.1 metode 1-titik + test"
```

---

### Task 5: Helper history + ekstrak HistorianList (tanpa ubah perilaku)

**Files:**
- Create: `resources/js/Components/History/historyHelpers.ts`
- Create: `resources/js/Components/History/__tests__/historyHelpers.test.ts`
- Create: `resources/js/Components/History/HistorianList.tsx` (pindahan komponen `Historian` dari `Operations.tsx`, props `{ histories?: any[] }` saja)
- Modify: `resources/js/Pages/Operations.tsx` (pakai `HistorianList`, hapus definisi lokal)

**Interfaces:**
- Consumes: bentuk item history existing (`id`, `start_time`, `end_time`, `log_data`, `controller`).
- Produces: `getHistoryStatus`, `compareF0`, `filterHistories`, komponen `HistorianList` untuk Task 6, 7, 9.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { compareF0, filterHistories, getHistoryStatus } from '../historyHelpers';

describe('historyHelpers', () => {
    it('marks null end_time as running', () => {
        expect(getHistoryStatus({ end_time: null })).toBe('running');
        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z', verification_status: 'verified' })).toBe('verified');
        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z' })).toBe('unverified');
    });

    it('compares F0 strictly without tolerance', () => {
        expect(compareF0(5.21, 4.5)).toBe('VALID');
        expect(compareF0(4.5, 4.5)).toBe('VALID');
        expect(compareF0(4.49, 4.5)).toBe('FAIL');
        expect(compareF0(1.0, null)).toBeNull();
    });

    it('filters by status, group and query', () => {
        const list = [
            { id: 1, end_time: null, product: 'Rendang', batch_code: 'B-1', group_id: null },
            { id: 2, end_time: '2026-09-26T10:00:00Z', verification_status: 'verified', product: 'Rendang', batch_code: 'B-2', group_id: 1 },
            { id: 3, end_time: '2026-09-26T10:00:00Z', product: 'Kari', batch_code: 'B-3', group_id: 2 },
        ];
        expect(filterHistories(list, { status: 'running', groupId: 'all', query: '' }).map((h) => h.id)).toEqual([1]);
        expect(filterHistories(list, { status: 'all', groupId: 2, query: '' }).map((h) => h.id)).toEqual([3]);
        expect(filterHistories(list, { status: 'all', groupId: 'all', query: 'rendang' }).map((h) => h.id)).toEqual([1, 2]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- historyHelpers`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
export type HistoryStatus = 'running' | 'unverified' | 'verified';

export function getHistoryStatus(h: { end_time?: string | null; verification_status?: string }): HistoryStatus {
    if (!h.end_time) return 'running';
    return h.verification_status === 'verified' ? 'verified' : 'unverified';
}

export function compareF0(systemF0: number, targetF0: number | null | undefined): 'VALID' | 'FAIL' | null {
    if (targetF0 === null || targetF0 === undefined || Number.isNaN(systemF0)) return null;
    return systemF0 < targetF0 ? 'FAIL' : 'VALID';
}

export interface HistoryFilter {
    status: 'all' | HistoryStatus;
    groupId: 'all' | number;
    query: string;
}

export function filterHistories<T extends { end_time?: string | null; verification_status?: string; group_id?: number | null; product?: string | null; batch_code?: string | null }>(list: T[], f: HistoryFilter): T[] {
    const q = f.query.trim().toLowerCase();
    return list.filter((h) => {
        if (f.status !== 'all' && getHistoryStatus(h) !== f.status) return false;
        if (f.groupId !== 'all' && h.group_id !== f.groupId) return false;
        if (q && !`${h.product ?? ''} ${h.batch_code ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
    });
}
```

- [ ] **Step 4: Ekstrak komponen** — pindahkan fungsi `Historian` dari `Operations.tsx` (baris 102-452: filter periode, card grid, modal detail, download, delete) apa adanya menjadi `HistorianList.tsx` (export default, props `{ histories?: any[] }`), lalu `Operations.tsx` cukup render `<HistorianList histories={histories} />`. TIDAK ada perubahan perilaku di task ini.

- [ ] **Step 5: Run tests to verify**

Run: `npm test -- historyHelpers` dan `npm test`
Expected: PASS semua

- [ ] **Step 6: Commit**

```bash
git add resources/js/Components/History/historyHelpers.ts resources/js/Components/History/__tests__/historyHelpers.test.ts resources/js/Components/History/HistorianList.tsx resources/js/Pages/Operations.tsx
git commit -m "refactor: ekstrak HistorianList + historyHelpers teruji"
```

---

### Task 6: Badge + filter status + chip group + rename

**Files:**
- Modify: `resources/js/Components/History/HistorianList.tsx` (props tambah `groups?: { id: number; name: string; color: string }[]`)
- Modify: `routes/web.php` (closure `/historian` kirim `groups`)
- Test: tambah test `filterHistories` group di file test Task 5 bila belum mencakup (sudah mencakup groupId); tambah test rename viaPUT manual + full suite Task 3 hijau.

**Interfaces:**
- Consumes: `groups` dari backend, `getHistoryStatus`/`filterHistories` (Task 5), rute `tn.history-groups.update` (Task 3).
- Produces: `HistorianList` dengan filter lengkap untuk Task 9 (ESP reuse).

- [ ] **Step 1: Tambah state filter** di `HistorianList`: `statusFilter: 'all' | HistoryStatus` (default `'all'`), `groupFilter: 'all' | number` (default `'all'`), `query` string. Ganti `filteredHistories` memakai `filterHistories(histories, { status: statusFilter, groupId: groupFilter, query })` digabung filter periode existing.

- [ ] **Step 2: Badge 3 state** di tiap card: `running` -> "Proses Berjalan" (amber pulse, seperti existing); `unverified` -> "UNVERIFIED" (amber solid); `verified` -> "VERIFIED" (emerald + title `by {verified_by} · {verified_at}`).

- [ ] **Step 3: Chip group di atas list**: `[Semua | {group.name} ...]` dengan warna dot dari `group.color`; klik set `groupFilter`. Ikon pensil kecil per chip group membuka popover inline (input nama + input color) yang `router.put(route('tn.history-groups.update', group.id), { name, color })`.

- [ ] **Step 4: Toolbar status + search**: tombol `Semua / Verified / Unverified / Berjalan` dan input search placeholder "Cari product / batch...".

- [ ] **Step 5: Backend `groups`**: di closure `/historian` tambah `'groups' => \App\Models\HistoryGroup::orderBy('id')->get()`, teruskan ke `HistorianList` via props page (`Operations.tsx` terima `groups` dan teruskan).

- [ ] **Step 6: Run tests**

Run: `php artisan test --filter=HistoryVerificationTest` dan `npm test -- historyHelpers`
Expected: PASS (rename group sudah dicakup Task 3)

- [ ] **Step 7: Commit**

```bash
git add resources/js/Components/History/HistorianList.tsx resources/js/Pages/Operations.tsx routes/web.php
git commit -m "feat: badge verifikasi + filter status + chip group rename"
```

---

### Task 7: Detail F0 + VALID/FAIL + form inline

**Files:**
- Modify: `resources/js/Components/History/ProcessDetailView.tsx` (props tambah `groups?: { id: number; name: string; color: string }[]`; `HistorianList` teruskan `groups` ke sini)
- Test: manual checklist + `npx tsc --noEmit` (tidak ada error baru)

**Interfaces:**
- Consumes: `calculateF0` (Task 4), `compareF0` (Task 5), rute `tn.history.verify` (Task 3), `groups`.
- Produces: form tersubmit -> backend verify; tidak ada kontrak baru.

- [ ] **Step 1: Stat F0 sistem** — di header card tambah baris "F0 sistem (otomatis): X.XX min" dihitung dari `logs` (mapping pv/dp seperti `statsData` existing) via `calculateF0(temps, 1)`.

- [ ] **Step 2: Indikator VALID/FAIL live** — jika batch `unverified`: baca input Target F0 yang sedang diketik, tampilkan badge hijau "VALID" bila `compareF0(systemF0, target) === 'VALID'`, merah "FAIL" bila `'FAIL'`, sembunyikan bila target kosong. Jika `verified`: badge dari `sterility_criterion` + F0 tersimpan.

- [ ] **Step 3: Form inline** (hanya bila `end_time` terisi + `unverified`): 8 field sesuai spec — Product text, Batch text, Scheduled Process text, Minimum F0 number step 0.01, Target F0 number step 0.01, Process deviation select (None/Minor/Major default None), Sterility criterion select (PASS/FAIL), Thermal record select (VERIFIED/REJECTED), Group select (opsi dari `groups`, default id pertama). Semua required. Bila live-compare FAIL: select criterion terkunci `FAIL` (disabled) + teks peringatan. Submit `router.post(route('tn.history.verify', batch.id), payload)`; bila `verified`: blok read-only 8 field + `verified_by/at`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit`
Expected: PASS (nol error)
Manual: buka history selesai -> F0 tampil -> isi Target di atas F0 -> VALID hijau; isi Target di bawah -> FAIL merah + criterion terkunci; submit -> badge card jadi VERIFIED; submit ulang via API -> 422.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Components/History/ProcessDetailView.tsx resources/js/Components/History/HistorianList.tsx
git commit -m "feat: F0 otomatis + VALID/FAIL + form verifikasi inline"
```

---

### Task 8: Export ikut verifikasi

**Files:**
- Modify: `resources/js/Components/History/ProcessDetailView.tsx` (3 builder: `handleDownloadPDF`, `handleDownloadExcel`, `handleDownloadCSV`)
- Test: `php artisan test --filter=EspMonitorAndCsvTest` (tidak regresi) + manual checklist

**Interfaces:**
- Consumes: field verifikasi + `groups` + F0 dari Task 7.
- Produces: tidak ada kontrak baru.

- [ ] **Step 1: PDF** — di summary table tambah baris Status (VERIFIED/UNVERIFIED/Berjalan), Product, Batch, Group, F0 sistem, VALID/FAIL, Diverifikasi oleh/tanggal; bila unverified tulis "Belum diverifikasi".

- [ ] **Step 2: Excel** — baris KPI yang sama di tabel ringkasan.

- [ ] **Step 3: CSV** — blok meta tambah Status, Product, Batch, Group, F0 sistem, VALID/FAIL, Diverifikasi oleh/tanggal.

- [ ] **Step 4: Run test**

Run: `php artisan test --filter=EspMonitorAndCsvTest`
Expected: PASS
Manual: export 1 batch verified (cek blok verifikasi) + 1 unverified (cek tulisan "Belum diverifikasi").

- [ ] **Step 5: Commit**

```bash
git add resources/js/Components/History/ProcessDetailView.tsx
git commit -m "feat: export PDF/Excel/CSV ikut blok verifikasi"
```

---

### Task 9: ESP reuse HistorianList + final gate

**Files:**
- Modify: `app/Http/Controllers/EspMonitorController.php` (tambah `groups` ke data Inertia)
- Modify: `resources/js/Pages/Esp/Monitor.tsx` (tab history render `<HistorianList histories={histories} groups={groups} />`; hapus state `period/customDate/selectedBatch/activeMenu`, `filteredHistories`, `handleDownload`, `handleDeleteHistory` lokal +-150 baris; tambah `groups` ke interface `Props`)
- Test: full suite + tsc + manual

**Interfaces:**
- Consumes: `HistorianList` final (Task 6), `groups` backend.
- Produces: selesai — satu historian untuk TN + ESP.

- [ ] **Step 1: Backend groups** — di `index()` tambah `'groups' => \App\Models\HistoryGroup::orderBy('id')->get(),` ke data Inertia.

- [ ] **Step 2: Ganti tab history** — blok `selectedBatch ? <ProcessDetailView/> : (Historian...)` diganti `<HistorianList histories={histories} groups={groups} />`; hapus duplikasi lokal. Aturan lock-detail-saat-running versi ESP ikut aturan bersama (running bisa dibuka, tanpa form).

- [ ] **Step 3: Final gate**

Run: `php artisan test`
Expected: PASS semua suite
Run: `npm test`
Expected: PASS semua suite
Run: `npx tsc --noEmit`
Expected: PASS
Manual: `/historian` dan `/esp/monitor` tab history menampilkan data, badge, filter, group, verifikasi yang sama.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/EspMonitorController.php resources/js/Pages/Esp/Monitor.tsx
git commit -m "refactor: history ESP pakai HistorianList bersama"
```
