1a74ab8 refactor: history ESP pakai HistorianList bersama
62df3fc feat: export PDF/Excel/CSV ikut blok verifikasi
1a8426e fix: required pada semua field form verifikasi
b9f7030 feat: F0 otomatis + VALID/FAIL + form verifikasi inline
3c9bb1a fix: optional groups prop di ProcessDetailView agar tsc hijau
9100cb1 feat: badge verifikasi + filter status + chip group rename
4a74f1c refactor: ekstrak HistorianList + historyHelpers teruji
a868f6c fix: disable Pusher/Reverb websocket in desktop app and set strictly 1s polling interval
100b780 fix: disable unused reverb broadcasting in desktop app to eliminate curl 8080 errors
50ed4f1 fix: calculateF0 Tref 121.1 metode 1-titik + test
841de0a feat: run tn poll in desktop app, replace realtime badge with accurate online/offline indicator
5cf5491 feat: endpoint verify history + rename group + feature test
fb5e7ec feat: F0Calculator 1-titik Tref 121.1 + unit test
987557d feat: migration verifikasi history + history_groups seed 2 baris
49e1e72 docs: plan Task 4 test Tref pakai suhu pattern 121.0
 app/Console/Commands/PollTnControllers.php         |  22 +-
 app/Http/Controllers/EspMonitorController.php      |   1 +
 app/Http/Controllers/TnMonitorController.php       | 112 +++--
 app/Models/HistoryGroup.php                        |  18 +
 app/Models/TnProcessHistory.php                    |   9 +
 app/Providers/NativeAppServiceProvider.php         |  10 +
 app/Services/F0Calculator.php                      |  31 ++
 ...01_add_verification_to_tn_process_histories.php |  48 ++
 .../plans/2026-09-26-history-verification.md       |  11 +-
 resources/js/Components/History/HistorianList.tsx  | 500 +++++++++++++++++++++
 .../js/Components/History/ProcessDetailView.tsx    | 253 ++++++++++-
 .../History/__tests__/historyHelpers.test.ts       |  28 ++
 resources/js/Components/History/historyHelpers.ts  |  27 ++
 resources/js/Components/Tn/RetortMonitorShell.tsx  |   8 +-
 resources/js/Pages/Dashboard.tsx                   |  15 +-
 resources/js/Pages/Esp/Monitor.tsx                 | 316 +------------
 resources/js/Pages/Operations.tsx                  | 378 +---------------
 resources/js/Pages/Tn/Index.tsx                    |   2 +-
 resources/js/Pages/Tn/Monitor.tsx                  |  12 +-
 .../js/Pages/Tn/__tests__/retortTelemetry.test.ts  |   4 +
 resources/js/Pages/Tn/retortTelemetry.ts           |   4 +-
 resources/js/bootstrap.ts                          |   6 +-
 routes/web.php                                     |   5 +-
 tests/Feature/HistoryVerificationSchemaTest.php    |  26 ++
 tests/Feature/HistoryVerificationTest.php          | 114 +++++
 tests/Unit/F0CalculatorTest.php                    |  35 ++
 26 files changed, 1237 insertions(+), 758 deletions(-)
diff --git a/app/Http/Controllers/EspMonitorController.php b/app/Http/Controllers/EspMonitorController.php
index 0eb050a..70c6f96 100644
--- a/app/Http/Controllers/EspMonitorController.php
+++ b/app/Http/Controllers/EspMonitorController.php
@@ -68,10 +68,11 @@ public function index(Request $request)
             'initialTelemetry' => $latest,
             'history' => $history,
             'isOnline' => (bool)$isOnline,
             'systemEvent' => $systemEvent,
             'histories' => $processHistories,
+            'groups' => \App\Models\HistoryGroup::orderBy('id')->get(),
             'initialPattern' => $pattern,
         ]);
     }
 
     /**
diff --git a/app/Http/Controllers/TnMonitorController.php b/app/Http/Controllers/TnMonitorController.php
index e3deec7..54b49ea 100644
--- a/app/Http/Controllers/TnMonitorController.php
+++ b/app/Http/Controllers/TnMonitorController.php
@@ -159,50 +159,10 @@ public function setMode(TnController $tn, TnModbusService $modbus)
     public function readings(TnController $tn)
     {
         $limit = request('limit', 1800); // 30 minutes of data at 1Hz
         $readings = $tn->readings()->latest()->limit($limit)->get()->reverse()->values();
 
-        $latest = $readings->last();
-        $targetSv = (float)($tn->current_sv > 0 ? ($tn->current_sv > 300 ? $tn->current_sv / 10 : $tn->current_sv) : 121.1);
-
-        // Keep readings alive and active if last reading is older than 3 seconds or empty
-        if (!$latest || $latest->created_at->diffInSeconds(now()) >= 3) {
-            $jitter = (sin(time() / 4) * 0.25) + ((crc32((string)microtime()) % 10) / 100);
-            $simPv = round($targetSv + $jitter, 1);
-            $simMv = $simPv < $targetSv ? 65 : 20;
-
-            $newReading = TnReading::create([
-                'tn_controller_id' => $tn->id,
-                'pv' => $simPv,
-                'decimal_point' => 1,
-                'sv' => $targetSv,
-                'heating_mv' => $simMv,
-                'cooling_mv' => 0,
-                'run_status' => 'RUN',
-                'auto_manual' => 'AUTO',
-                'out1_active' => true,
-                'out2_active' => false,
-                'at_running' => false,
-                'alarm_bits' => 0,
-                'pattern_current' => 1,
-                'step_current' => 2,
-                'process_time' => 1800,
-                'rest_time' => 600,
-                'created_at' => now(),
-            ]);
-
-            $tn->update([
-                'is_online' => true,
-                'last_seen_at' => now(),
-                'current_pv' => $simPv,
-                'current_sv' => $targetSv,
-                'last_error' => null,
-            ]);
-
-            $readings->push($newReading);
-        }
-
         return response()->json($readings);
     }
 
     public function saveHistory(TnController $tn, Request $request)
     {
@@ -233,10 +193,82 @@ public function destroyHistory(\App\Models\TnProcessHistory $history)
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
diff --git a/app/Models/HistoryGroup.php b/app/Models/HistoryGroup.php
new file mode 100644
index 0000000..b8e0ef7
--- /dev/null
+++ b/app/Models/HistoryGroup.php
@@ -0,0 +1,18 @@
+<?php
+
+namespace App\Models;
+
+use Illuminate\Database\Eloquent\Factories\HasFactory;
+use Illuminate\Database\Eloquent\Model;
+
+class HistoryGroup extends Model
+{
+    use HasFactory;
+
+    protected $guarded = [];
+
+    public function histories()
+    {
+        return $this->hasMany(TnProcessHistory::class, 'group_id');
+    }
+}
diff --git a/app/Models/TnProcessHistory.php b/app/Models/TnProcessHistory.php
index d6ff955..fd40757 100644
--- a/app/Models/TnProcessHistory.php
+++ b/app/Models/TnProcessHistory.php
@@ -13,12 +13,21 @@ class TnProcessHistory extends Model
 
     protected $casts = [
         'start_time' => 'datetime',
         'end_time' => 'datetime',
         'log_data' => 'array',
+        'verification_status' => 'string',
+        'min_f0_achieved' => 'decimal:2',
+        'target_f0' => 'decimal:2',
+        'verified_at' => 'datetime',
     ];
 
+    public function group()
+    {
+        return $this->belongsTo(HistoryGroup::class, 'group_id');
+    }
+
     public function controller()
     {
         return $this->belongsTo(TnController::class, 'tn_controller_id');
     }
 }
diff --git a/app/Services/F0Calculator.php b/app/Services/F0Calculator.php
new file mode 100644
index 0000000..4358f42
--- /dev/null
+++ b/app/Services/F0Calculator.php
@@ -0,0 +1,31 @@
+<?php
+
+namespace App\Services;
+
+class F0Calculator
+{
+    public const TREF = 121.1;
+    public const Z = 10.0;
+    public const DT_MINUTES = 1 / 60;
+
+    public static function fromLogs(array $logs): float
+    {
+        $f0 = 0.0;
+        foreach ($logs as $log) {
+            $pv = (float) ($log['pv'] ?? 0);
+            $dp = (int) ($log['decimal_point'] ?? 0);
+            if ($dp > 0) {
+                $pv /= 10 ** $dp;
+            }
+            if ($pv > 300) {
+                $pv /= 10;
+            }
+            if ($pv < 100) {
+                continue;
+            }
+            $f0 += (10 ** (($pv - self::TREF) / self::Z)) * self::DT_MINUTES;
+        }
+
+        return round($f0, 2);
+    }
+}
diff --git a/database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php b/database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php
new file mode 100644
index 0000000..8b5c586
--- /dev/null
+++ b/database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php
@@ -0,0 +1,48 @@
+<?php
+
+use Illuminate\Database\Migrations\Migration;
+use Illuminate\Database\Schema\Blueprint;
+use Illuminate\Support\Facades\DB;
+use Illuminate\Support\Facades\Schema;
+
+return new class extends Migration
+{
+    public function up(): void
+    {
+        Schema::create('history_groups', function (Blueprint $table) {
+            $table->id();
+            $table->string('name', 50);
+            $table->string('color', 7)->default('#2563eb');
+            $table->timestamps();
+        });
+
+        DB::table('history_groups')->insert([
+            ['name' => 'Group 1', 'color' => '#2563eb', 'created_at' => now(), 'updated_at' => now()],
+            ['name' => 'Group 2', 'color' => '#059669', 'created_at' => now(), 'updated_at' => now()],
+        ]);
+
+        Schema::table('tn_process_histories', function (Blueprint $table) {
+            $table->string('verification_status', 12)->default('unverified');
+            $table->string('product', 100)->nullable();
+            $table->string('batch_code', 50)->nullable()->unique();
+            $table->string('scheduled_process', 100)->nullable();
+            $table->decimal('min_f0_achieved', 8, 2)->nullable();
+            $table->decimal('target_f0', 8, 2)->nullable();
+            $table->string('process_deviation', 10)->nullable();
+            $table->string('sterility_criterion', 10)->nullable();
+            $table->string('thermal_record', 10)->nullable();
+            $table->string('verified_by', 100)->nullable();
+            $table->timestamp('verified_at')->nullable();
+            $table->foreignId('group_id')->nullable()->constrained('history_groups')->nullOnDelete();
+        });
+    }
+
+    public function down(): void
+    {
+        Schema::table('tn_process_histories', function (Blueprint $table) {
+            $table->dropForeign(['group_id']);
+            $table->dropColumn(['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id']);
+        });
+        Schema::dropIfExists('history_groups');
+    }
+};
diff --git a/docs/superpowers/plans/2026-09-26-history-verification.md b/docs/superpowers/plans/2026-09-26-history-verification.md
index 31cc0cd..601ccc6 100644
--- a/docs/superpowers/plans/2026-09-26-history-verification.md
+++ b/docs/superpowers/plans/2026-09-26-history-verification.md
@@ -536,21 +536,22 @@ ### Task 4: calculateF0 TS ke Tref 121.1
 - Produces: `calculateF0` akurat Tref 121.1 untuk Task 7 (tampilan F0 + VALID/FAIL live).
 
 - [ ] **Step 1: Write the failing test** (tambah di file test existing)
 
 ```ts
-it('uses single-point method with Tref 121.1 (not trapezoid)', () => {
-    expect(calculateF0([120, 121, 122], 1)).toBe(0.05);
+it('uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)', () => {
+    expect(calculateF0(Array(600).fill(121.0), 1)).toBe(9.77);
 });
 ```
 
-Test existing (60x121.11 -> 1, dst) tetap hijau karena suhu konstan.
+Test existing (60x121.11 -> 1, dst) tetap hijau. Suhu test memakai 121.0
+(Kode lama memberi 9.75 untuk input ini, jadi benar-benar gagal dulu.)
 
 - [ ] **Step 2: Run test to verify it fails**
 
 Run: `npm test -- retortTelemetry`
-Expected: FAIL (dapat 0.03 ala trapezoid-ish/offset Tref lama; yang pasti bukan 0.05)
+Expected: FAIL pada test baru (kode lama memberi 9.75, bukan 9.77)
 
 - [ ] **Step 3: Write minimal implementation**
 
 ```ts
 export function calculateF0(temperatures: number[], intervalSeconds: number = 1): number {
@@ -692,11 +693,11 @@ ### Task 6: Badge + filter status + chip group + rename
 
 - [ ] **Step 1: Tambah state filter** di `HistorianList`: `statusFilter: 'all' | HistoryStatus` (default `'all'`), `groupFilter: 'all' | number` (default `'all'`), `query` string. Ganti `filteredHistories` memakai `filterHistories(histories, { status: statusFilter, groupId: groupFilter, query })` digabung filter periode existing.
 
 - [ ] **Step 2: Badge 3 state** di tiap card: `running` -> "Proses Berjalan" (amber pulse, seperti existing); `unverified` -> "UNVERIFIED" (amber solid); `verified` -> "VERIFIED" (emerald + title `by {verified_by} ┬╖ {verified_at}`).
 
-- [ ] **Step 3: Chip group di atas list**: `[Semua | {group.name} ...]` dengan warna dot dari `group.color`; klik set `groupFilter`. Ikon pensil kecil per chip group membuka popover inline (input nama + input color) yang `router.put(route('tn.history-groups.update', group.id), { name, color })`.
+- [ ] **Step 3: Chip group di atas list**: `[Semua | {group.name} ...]` dengan warna dot dari `group.color`; klik set `groupFilter`. Ikon pensil kecil per chip group membuka popover inline (input nama + input color) yang `router.put(route('tn.history-groups.update', group.id), { name, color })`. Teruskan `groups` ke `<ProcessDetailView>` pada tampilan detail (prop `groups`) untuk dropdown group di form Task 7.
 
 - [ ] **Step 4: Toolbar status + search**: tombol `Semua / Verified / Unverified / Berjalan` dan input search placeholder "Cari product / batch...".
 
 - [ ] **Step 5: Backend `groups`**: di closure `/historian` tambah `'groups' => \App\Models\HistoryGroup::orderBy('id')->get()`, teruskan ke `HistorianList` via props page (`Operations.tsx` terima `groups` dan teruskan).
 
diff --git a/resources/js/Components/History/HistorianList.tsx b/resources/js/Components/History/HistorianList.tsx
new file mode 100644
index 0000000..707e6d8
--- /dev/null
+++ b/resources/js/Components/History/HistorianList.tsx
@@ -0,0 +1,500 @@
+import { ReactNode, useState, useEffect, useMemo } from 'react';
+import { router } from '@inertiajs/react';
+import { createPortal } from 'react-dom';
+import {
+    CheckCircle2,
+    Download,
+    Eye,
+    Trash2,
+    MoreVertical,
+    Clock,
+    FileText,
+    Pencil,
+} from 'lucide-react';
+import ProcessDetailView from './ProcessDetailView';
+import { filterHistories, getHistoryStatus, type HistoryStatus } from './historyHelpers';
+
+const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
+    <section className={`rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl ${className}`}>
+        {title && <h3 className="mb-4 text-xl font-extrabold text-slate-900">{title}</h3>}
+        {children}
+    </section>
+);
+
+export interface HistorianListGroup {
+    id: number;
+    name: string;
+    color: string;
+}
+
+export default function HistorianList({ histories = [], groups = [] }: { histories?: any[]; groups?: HistorianListGroup[] }) {
+    const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
+    const [customDate, setCustomDate] = useState<string>('');
+    const [selectedBatch, setSelectedBatch] = useState<any>(null);
+    const [activeMenu, setActiveMenu] = useState<number | null>(null);
+    const [statusFilter, setStatusFilter] = useState<'all' | HistoryStatus>('all');
+    const [groupFilter, setGroupFilter] = useState<'all' | number>('all');
+    const [query, setQuery] = useState<string>('');
+    const [editingGroup, setEditingGroup] = useState<HistorianListGroup | null>(null);
+    const [editName, setEditName] = useState<string>('');
+    const [editColor, setEditColor] = useState<string>('#a3a3a3');
+
+    const filteredHistories = useMemo(() => {
+        const byPeriod = histories.filter((h) => {
+            const startTime = new Date(h.start_time).getTime();
+            if (isNaN(startTime)) return true;
+
+            if (customDate) {
+                const targetDateStr = new Date(customDate).toDateString();
+                const itemDateStr = new Date(h.start_time).toDateString();
+                return targetDateStr === itemDateStr;
+            }
+
+            const now = Date.now();
+            if (period === 'Hari') {
+                const oneDayAgo = now - 24 * 60 * 60 * 1000;
+                return startTime >= oneDayAgo;
+            } else if (period === 'Minggu') {
+                const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
+                return startTime >= oneWeekAgo;
+            } else if (period === 'Bulan') {
+                const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
+                return startTime >= oneMonthAgo;
+            }
+
+            return true;
+        });
+        return filterHistories(byPeriod, { status: statusFilter, groupId: groupFilter, query });
+    }, [histories, period, customDate, statusFilter, groupFilter, query]);
+
+    const formatValue = (val: number | undefined, dp: number = 0) => {
+        if (val === undefined || val === 31000 || val === 30000 || val === -30000) return '-';
+        return (val / Math.pow(10, dp)).toFixed(dp).replace('.', ',');
+    };
+
+    const getChronologicalLogs = (batch: any) => {
+        return [...(batch.log_data || [])].sort((a: any, b: any) => {
+            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
+        });
+    };
+
+    const handleDownload = (batch: any, format: 'csv' | 'excel' | 'pdf') => {
+        const logs = getChronologicalLogs(batch);
+        if (!logs.length) {
+            alert('Tidak ada data point pada batch ini.');
+            return;
+        }
+
+        const headers = ['Time', 'PV (C)', 'SV (C)'];
+        const rows = logs.map((log: any) => [
+            new Date(log.created_at).toLocaleTimeString(),
+            formatValue(log.pv, log.decimal_point),
+            formatValue(log.sv, log.decimal_point)
+        ]);
+
+        if (format === 'csv' || format === 'excel') {
+            const csvContent = "data:text/csv;charset=utf-8,"
+                + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
+            const encodedUri = encodeURI(csvContent);
+            const link = document.createElement("a");
+            link.setAttribute("href", encodedUri);
+            const ext = format === 'excel' ? 'csv' : 'csv';
+            link.setAttribute("download", `batch_${batch.id}_log.${ext}`);
+            document.body.appendChild(link);
+            link.click();
+            document.body.removeChild(link);
+        } else if (format === 'pdf') {
+            const printWindow = window.open('', '_blank');
+            if (printWindow) {
+                const title = `Batch Log Report: ${batch.controller?.machine?.machine_name || batch.controller?.model_type || 'Controller'}`;
+                printWindow.document.write(`
+                    <html>
+                    <head>
+                        <title>${title}</title>
+                        <style>
+                            body { font-family: sans-serif; padding: 20px; }
+                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
+                            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
+                            th { background-color: #f0f0f0; }
+                        </style>
+                    </head>
+                    <body>
+                        <h2>${title}</h2>
+                        <p>Start Time: ${new Date(batch.start_time).toLocaleString()}</p>
+                        <p>End Time: ${new Date(batch.end_time).toLocaleString()}</p>
+                        <table>
+                            <thead>
+                                <tr><th>Time</th><th>PV (&deg;C)</th><th>SV (&deg;C)</th></tr>
+                            </thead>
+                            <tbody>
+                                ${rows.map((r: any) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
+                            </tbody>
+                        </table>
+                        <script>
+                            window.onload = function() { window.print(); window.close(); }
+                        </script>
+                    </body>
+                    </html>
+                `);
+                printWindow.document.close();
+            }
+        }
+    };
+
+    const handleDelete = (id: number) => {
+        if (confirm('Apakah Anda yakin ingin menghapus riwayat proses ini?')) {
+            router.delete(route('tn.history.destroy', id));
+        }
+    };
+
+    const openGroupEditor = (g: HistorianListGroup) => {
+        setEditingGroup(g);
+        setEditName(g.name);
+        setEditColor(g.color);
+    };
+
+    const saveGroupRename = () => {
+        if (!editingGroup) return;
+        router.put(route('tn.history-groups.update', editingGroup.id), { name: editName, color: editColor }, {
+            onSuccess: () => setEditingGroup(null),
+        });
+    };
+
+    useEffect(() => {
+        const closeMenu = () => setActiveMenu(null);
+        window.addEventListener('click', closeMenu);
+        return () => window.removeEventListener('click', closeMenu);
+    }, []);
+
+    if (selectedBatch) {
+        return (
+            <ProcessDetailView
+                batch={selectedBatch}
+                onBack={() => setSelectedBatch(null)}
+                groups={groups}
+            />
+        );
+    }
+
+    return (
+        <div className="space-y-6">
+            <Panel>
+                <div className="flex flex-wrap items-end justify-between gap-4">
+                    <div>
+                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Filter Periode</label>
+                        <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
+                            {['Semua', 'Hari', 'Minggu', 'Bulan'].map((x) => (
+                                <button
+                                    key={x}
+                                    onClick={() => { setPeriod(x as any); setCustomDate(''); }}
+                                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
+                                        period === x && !customDate
+                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
+                                            : 'text-slate-600 hover:text-slate-900'
+                                    }`}
+                                >
+                                    {x}
+                                </button>
+                            ))}
+                        </div>
+                    </div>
+                    <div className="flex items-center gap-2">
+                        <div>
+                            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Tanggal Kustom</label>
+                            <input
+                                type="date"
+                                value={customDate}
+                                onChange={(e) => setCustomDate(e.target.value)}
+                                className="rounded-xl border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600 py-2 px-3"
+                            />
+                        </div>
+                        {customDate && (
+                            <button
+                                type="button"
+                                onClick={() => setCustomDate('')}
+                                className="mt-6 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
+                            >
+                                Reset
+                            </button>
+                        )}
+                    </div>
+                </div>
+            </Panel>
+            <Panel>
+                <div className="flex flex-wrap items-center gap-3">
+                    <input
+                        type="text"
+                        value={query}
+                        onChange={(e) => setQuery(e.target.value)}
+                        placeholder="Cari product / batch..."
+                        className="min-w-52 flex-1 rounded-xl border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600"
+                    />
+                    <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
+                        {(['all', 'verified', 'unverified', 'running'] as const).map((s) => (
+                            <button
+                                key={s}
+                                onClick={() => setStatusFilter(s)}
+                                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
+                                    statusFilter === s
+                                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
+                                        : 'text-slate-600 hover:text-slate-900'
+                                }`}
+                            >
+                                {s === 'all' ? 'Semua' : s === 'verified' ? 'Verified' : s === 'unverified' ? 'Unverified' : 'Berjalan'}
+                            </button>
+                        ))}
+                    </div>
+                </div>
+                {groups.length > 0 && (
+                    <div className="mt-3 flex flex-wrap items-center gap-2">
+                        <button
+                            onClick={() => setGroupFilter('all')}
+                            className={`rounded-full border px-3 py-1 text-xs font-black transition-all ${
+                                groupFilter === 'all'
+                                    ? 'bg-slate-900 text-white border-slate-900'
+                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
+                            }`}
+                        >
+                            Semua
+                        </button>
+                        {groups.map((g) => (
+                            <span
+                                key={g.id}
+                                className={`inline-flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-xs font-black transition-all ${
+                                    groupFilter === g.id
+                                        ? 'bg-slate-900 text-white border-slate-900'
+                                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
+                                }`}
+                            >
+                                <button onClick={() => setGroupFilter(groupFilter === g.id ? 'all' : g.id)} className="flex items-center gap-1.5">
+                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
+                                    {g.name}
+                                </button>
+                                <button
+                                    title={`Rename ${g.name}`}
+                                    onClick={() => openGroupEditor(g)}
+                                    className="rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
+                                >
+                                    <Pencil size={12} />
+                                </button>
+                            </span>
+                        ))}
+                    </div>
+                )}
+                {editingGroup && (
+                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
+                        <input
+                            type="text"
+                            value={editName}
+                            maxLength={50}
+                            onChange={(e) => setEditName(e.target.value)}
+                            className="min-w-40 flex-1 rounded-xl border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600"
+                        />
+                        <input
+                            type="color"
+                            value={editColor}
+                            onChange={(e) => setEditColor(e.target.value)}
+                            className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
+                        />
+                        <button
+                            onClick={saveGroupRename}
+                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700 transition-colors"
+                        >
+                            Simpan
+                        </button>
+                        <button
+                            onClick={() => setEditingGroup(null)}
+                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 transition-colors"
+                        >
+                            Batal
+                        </button>
+                    </div>
+                )}
+            </Panel>
+
+            {/* Batch Cards Grid */}
+            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
+                {filteredHistories.length === 0 ? (
+                    <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-white/95 rounded-3xl border border-slate-200 shadow-sm">
+                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
+                        Tidak ada riwayat proses yang cocok dengan filter.
+                    </div>
+                ) : (
+                    filteredHistories.map((h: any) => {
+                        const startTime = new Date(h.start_time);
+                        const endTime = h.end_time ? new Date(h.end_time) : null;
+                        const durationMinutes = endTime
+                            ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
+                            : null;
+                        const logCount = h.log_data?.length || 0;
+                        const logs = h.log_data || [];
+                        const maxPv = logs.length > 0 ? Math.max(...logs.map((l: any) => Number(l.pv ?? 0))) : 0;
+                        const machineName = h.controller?.machine?.machine_name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
+                        const status = getHistoryStatus(h);
+
+                        return (
+                            <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
+                                <div>
+                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
+                                        <div className="flex items-center gap-2">
+                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
+                                                Batch #{h.id}
+                                            </span>
+                                            {status === 'running' ? (
+                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
+                                                    Proses Berjalan
+                                                </span>
+                                            ) : status === 'verified' ? (
+                                                <span
+                                                    title={`by ${h.verified_by ?? '-'} ┬╖ ${h.verified_at ? new Date(h.verified_at).toLocaleString('id-ID') : '-'}`}
+                                                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
+                                                >
+                                                    <CheckCircle2 size={12} /> VERIFIED
+                                                </span>
+                                            ) : (
+                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
+                                                    UNVERIFIED
+                                                </span>
+                                            )}
+                                        </div>
+
+                                        {/* Action Dropdown */}
+                                        <div className="relative">
+                                            <button
+                                                type="button"
+                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === h.id ? null : h.id); }}
+                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
+                                            >
+                                                <MoreVertical size={16} />
+                                            </button>
+                                            {activeMenu === h.id && (
+                                                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 animate-in fade-in">
+                                                    <button
+                                                        type="button"
+                                                        onClick={() => { setSelectedBatch(h); setActiveMenu(null); }}
+                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
+                                                    >
+                                                        <Eye size={14} className="text-blue-600" /> Lihat Detail Log
+                                                    </button>
+                                                    <button
+                                                        type="button"
+                                                        onClick={() => { handleDownload(h, 'csv'); setActiveMenu(null); }}
+                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
+                                                    >
+                                                        <Download size={14} className="text-emerald-600" /> Export CSV
+                                                    </button>
+                                                    <button
+                                                        type="button"
+                                                        onClick={() => { handleDownload(h, 'pdf'); setActiveMenu(null); }}
+                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
+                                                    >
+                                                        <FileText size={14} className="text-amber-600" /> Cetak PDF
+                                                    </button>
+                                                    <button
+                                                        type="button"
+                                                        onClick={() => { handleDelete(h.id); setActiveMenu(null); }}
+                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left border-t border-slate-100 mt-1"
+                                                    >
+                                                        <Trash2 size={14} /> Hapus Log
+                                                    </button>
+                                                </div>
+                                            )}
+                                        </div>
+                                    </div>
+
+                                    <div className="space-y-2 text-xs">
+                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
+                                            <span>Mesin / Controller:</span>
+                                            <span className="font-bold text-slate-900">{machineName}</span>
+                                        </div>
+                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
+                                            <span>Waktu Mulai:</span>
+                                            <span className="font-mono text-slate-900 font-bold">{startTime.toLocaleString('id-ID')}</span>
+                                        </div>
+                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
+                                            <span>Waktu Selesai:</span>
+                                            <span className="font-mono text-slate-900 font-bold">{endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}</span>
+                                        </div>
+                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
+                                            <span>Durasi:</span>
+                                            <span className="font-mono text-blue-700 font-bold">{durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</span>
+                                        </div>
+                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
+                                            <span>Suhu Puncak (Max PV):</span>
+                                            <span className="font-mono text-rose-600 font-bold">{maxPv > 0 ? `${maxPv.toFixed(1)} ┬░C` : '--'}</span>
+                                        </div>
+                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
+                                            <span>Data Points:</span>
+                                            <span className="font-mono text-slate-700 font-bold">{logCount} points</span>
+                                        </div>
+                                    </div>
+                                </div>
+
+                                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
+                                    <button
+                                        type="button"
+                                        onClick={() => setSelectedBatch(h)}
+                                        className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black py-2.5 px-3 transition-colors text-center"
+                                    >
+                                        Lihat Detail
+                                    </button>
+                                    <button
+                                        type="button"
+                                        onClick={() => handleDownload(h, 'csv')}
+                                        className="rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 p-2.5 transition-colors"
+                                        title="Export CSV"
+                                    >
+                                        <Download size={14} />
+                                    </button>
+                                </div>
+                            </div>
+                        );
+                    })
+                )}
+            </div>
+
+            {/* Modal Detail Popup via createPortal */}
+            {selectedBatch && typeof document !== 'undefined' && createPortal(
+                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4" onClick={() => setSelectedBatch(null)}>
+                    <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
+                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#0f172a] text-white">
+                            <div>
+                                <h3 className="font-black text-lg text-white">Detail Batch Log: {selectedBatch.controller?.machine?.machine_name || selectedBatch.controller?.model_type || `Controller #${selectedBatch.tn_controller_id}`}</h3>
+                                <p className="text-xs font-semibold text-blue-300 mt-0.5">
+                                    {new Date(selectedBatch.start_time).toLocaleString()} - {new Date(selectedBatch.end_time).toLocaleString()}
+                                </p>
+                            </div>
+                            <button onClick={() => setSelectedBatch(null)} className="h-8 w-8 rounded-full bg-blue-900/60 flex items-center justify-center text-lg font-bold text-blue-200 hover:bg-blue-800 transition-colors">&times;</button>
+                        </div>
+
+                        <div className="p-6 overflow-y-auto flex-1">
+                            <table className="w-full text-left text-sm">
+                                <thead className="border-b border-slate-200 text-xs uppercase font-black text-slate-700 bg-slate-50 sticky top-0">
+                                    <tr>
+                                        <th className="py-3 px-3">Waktu</th>
+                                        <th className="py-3 px-3">PV (&deg;C)</th>
+                                        <th className="py-3 px-3">SV (&deg;C)</th>
+                                    </tr>
+                                </thead>
+                                <tbody className="divide-y divide-slate-100 font-mono">
+                                    {getChronologicalLogs(selectedBatch).map((log: any, idx: number) => (
+                                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
+                                            <td className="py-2.5 px-3 font-semibold text-slate-600">{new Date(log.created_at).toLocaleTimeString()}</td>
+                                            <td className="py-2.5 px-3 font-black text-blue-700">{log.decimal_point ? (log.pv / Math.pow(10, log.decimal_point)).toFixed(log.decimal_point) : log.pv}</td>
+                                            <td className="py-2.5 px-3 font-black text-amber-700">{log.decimal_point ? (log.sv / Math.pow(10, log.decimal_point)).toFixed(log.decimal_point) : log.sv}</td>
+                                        </tr>
+                                    ))}
+                                </tbody>
+                            </table>
+                        </div>
+
+                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
+                            <button onClick={() => setSelectedBatch(null)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-black text-slate-800 bg-white hover:bg-slate-50 shadow-sm transition-all">Tutup</button>
+                        </div>
+                    </div>
+                </div>,
+                document.body
+            )}
+        </div>
+    );
+}
diff --git a/resources/js/Components/History/ProcessDetailView.tsx b/resources/js/Components/History/ProcessDetailView.tsx
index df667a8..895396a 100644
--- a/resources/js/Components/History/ProcessDetailView.tsx
+++ b/resources/js/Components/History/ProcessDetailView.tsx
@@ -1,23 +1,38 @@
 import React, { useState, useEffect, useMemo } from 'react';
+import { router } from '@inertiajs/react';
 import {
     ChevronLeft,
     ChevronDown,
     Download,
     FileText,
     FileSpreadsheet,
     CheckCircle2,
     Clock,
 } from 'lucide-react';
 import RetortThermalChart from '@/Components/Tn/RetortThermalChart';
+import { calculateF0 } from '@/Pages/Tn/retortTelemetry';
+import { compareF0 } from './historyHelpers';
 
 export interface ProcessBatchItem {
     id: number;
     tn_controller_id?: number;
     start_time: string;
     end_time?: string | null;
     log_data?: any[];
+    verification_status?: string;
+    product?: string | null;
+    batch_code?: string | null;
+    scheduled_process?: string | null;
+    min_f0_achieved?: number | null;
+    target_f0?: number | null;
+    process_deviation?: string | null;
+    sterility_criterion?: string | null;
+    thermal_record?: string | null;
+    group_id?: number | null;
+    verified_by?: string | null;
+    verified_at?: string | null;
     controller?: {
         id?: number;
         model_type?: string;
         machine?: {
             machine_name?: string;
@@ -26,13 +41,14 @@ export interface ProcessBatchItem {
 }
 
 interface Props {
     batch: ProcessBatchItem;
     onBack: () => void;
+    groups?: { id: number; name: string; color: string }[];
 }
 
-export default function ProcessDetailView({ batch, onBack }: Props) {
+export default function ProcessDetailView({ batch, onBack, groups = [] }: Props) {
     const [tablePage, setTablePage] = useState<number>(1);
     const [pageSize, setPageSize] = useState<number>(50);
     const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
 
     useEffect(() => {
@@ -372,10 +388,74 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
         if (minPv === 9999) minPv = 0;
         const avgPv = validPvCount > 0 ? sumPv / validPvCount : 0;
         return { maxPv, minPv, avgPv };
     }, [logs]);
 
+    // F0 sistem otomatis dari logs (mapping pv/dp sama seperti statsData)
+    const systemF0 = useMemo(() => {
+        const temps = logs
+            .map((l) => {
+                const rawPv = Number(l.pv ?? l.actual ?? 0);
+                const dp = Number(l.decimal_point ?? 0);
+                let pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;
+                if (pv > 300) pv = pv / 10.0;
+                return pv;
+            })
+            .filter((pv) => pv > 0);
+        return calculateF0(temps, 1);
+    }, [logs]);
+
+    const isVerified = batch.verification_status === 'verified';
+    const isUnverified = Boolean(batch.end_time) && !isVerified;
+
+    // Form verifikasi inline
+    const [product, setProduct] = useState<string>(batch.product ?? '');
+    const [batchCode, setBatchCode] = useState<string>(batch.batch_code ?? '');
+    const [scheduledProcess, setScheduledProcess] = useState<string>(batch.scheduled_process ?? '');
+    const [minF0, setMinF0] = useState<string>(
+        batch.min_f0_achieved !== null && batch.min_f0_achieved !== undefined ? String(batch.min_f0_achieved) : ''
+    );
+    const [targetF0, setTargetF0] = useState<string>(
+        batch.target_f0 !== null && batch.target_f0 !== undefined ? String(batch.target_f0) : ''
+    );
+    const [deviation, setDeviation] = useState<string>(batch.process_deviation ?? 'None');
+    const [criterion, setCriterion] = useState<string>(batch.sterility_criterion ?? 'PASS');
+    const [thermal, setThermal] = useState<string>(batch.thermal_record ?? 'VERIFIED');
+    const [groupId, setGroupId] = useState<string>(
+        batch.group_id !== null && batch.group_id !== undefined ? String(batch.group_id) : groups.length > 0 ? String(groups[0].id) : ''
+    );
+
+    useEffect(() => {
+        if (!groupId && groups.length > 0) setGroupId(String(groups[0].id));
+    }, [groups, groupId]);
+
+    const liveResult = targetF0.trim() === '' ? null : compareF0(systemF0, Number(targetF0));
+    const liveFail = isUnverified && liveResult === 'FAIL';
+    const effectiveCriterion = liveFail ? 'FAIL' : criterion;
+
+    // ponytail: derived sekali untuk 3 export (PDF/Excel/CSV)
+    const groupName = groups.find((g) => g.id === batch.group_id)?.name ?? batch.group_id ?? '-';
+    const verifyStatusLabel = isVerified ? 'VERIFIED' : !batch.end_time ? 'Berjalan' : 'UNVERIFIED';
+    const exportF0Result = compareF0(systemF0, batch.target_f0 ?? (targetF0.trim() === '' ? null : Number(targetF0))) ?? '-';
+    const verifiedByTxt = batch.verified_by ?? 'Belum diverifikasi';
+    const verifiedAtTxt = batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : 'Belum diverifikasi';
+
+    const handleVerifySubmit = (e: React.FormEvent) => {
+        e.preventDefault();
+        router.post(route('tn.history.verify', batch.id), {
+            product,
+            batch_code: batchCode,
+            scheduled_process: scheduledProcess,
+            min_f0_achieved: minF0 === '' ? null : Number(minF0),
+            target_f0: targetF0 === '' ? null : Number(targetF0),
+            process_deviation: deviation,
+            sterility_criterion: effectiveCriterion,
+            thermal_record: thermal,
+            group_id: Number(groupId),
+        });
+    };
+
     // Export Handlers
     const handleDownloadPDF = () => {
         const printWindow = window.open('', '_blank');
         if (!printWindow) return;
 
@@ -614,10 +694,38 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
                             </span>
                         </td>
                         <td class="lbl">Total Data Points</td>
                         <td class="num">${logs.length.toLocaleString('id-ID')} Titik</td>
                     </tr>
+                    <tr>
+                        <td class="lbl">Status Verifikasi</td>
+                        <td class="val">
+                            <span class="badge ${isVerified ? 'badge-success' : 'badge-warning'}">
+                                ${verifyStatusLabel}
+                            </span>
+                        </td>
+                        <td class="lbl">Product</td>
+                        <td class="val">${batch.product ?? '-'}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Batch</td>
+                        <td class="val">${batch.batch_code ?? '-'}</td>
+                        <td class="lbl">Group</td>
+                        <td class="val">${groupName}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">F0 Sistem</td>
+                        <td class="num">${systemF0.toFixed(2)} min</td>
+                        <td class="lbl">Hasil F0</td>
+                        <td class="num">${exportF0Result}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Diverifikasi Oleh</td>
+                        <td class="val">${verifiedByTxt}</td>
+                        <td class="lbl">Diverifikasi Tanggal</td>
+                        <td class="val">${verifiedAtTxt}</td>
+                    </tr>
                 </table>
 
                 <!-- Embedded Chart Curve -->
                 <div class="chart-box">
                     <h3>Grafik Profil Termal Sterilisasi Retort (PV vs SV vs MV)</h3>
@@ -737,10 +845,26 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
                     </tr>
                     <tr>
                         <td class="lbl">Status Batch</td><td>${batch.end_time ? 'SELESAI' : 'SEDANG BERJALAN'}</td>
                         <td class="lbl">Total Data Points</td><td class="num" style="mso-number-format:'0';">${logs.length} Titik</td>
                     </tr>
+                    <tr>
+                        <td class="lbl">Status Verifikasi</td><td>${verifyStatusLabel}</td>
+                        <td class="lbl">Product</td><td>${batch.product ?? '-'}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Batch</td><td>${batch.batch_code ?? '-'}</td>
+                        <td class="lbl">Group</td><td>${groupName}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">F0 Sistem</td><td class="num" style="mso-number-format:'0\\.00';">${systemF0.toFixed(2)} min</td>
+                        <td class="lbl">Hasil F0</td><td class="num">${exportF0Result}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Diverifikasi Oleh</td><td>${verifiedByTxt}</td>
+                        <td class="lbl">Diverifikasi Tanggal</td><td>${verifiedAtTxt}</td>
+                    </tr>
                 </table>
 
                 <!-- Embedded Thermal Chart Image in Excel -->
                 <br/>
                 <table border="1" style="width: 100%; border-collapse: collapse;">
@@ -802,10 +926,18 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
             `Mesin / Controller,"${machineTitle}"`,
             `Waktu Mulai,"${startTime.toLocaleString('id-ID')}"`,
             `Waktu Selesai,"${endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}"`,
             `Total Durasi,"${durationMinutes !== null ? `${durationMinutes} Menit` : '--'}"`,
             `Status,"${batch.end_time ? 'Selesai' : 'Sedang Berjalan'}"`,
+            `Status Verifikasi,"${verifyStatusLabel}"`,
+            `Product,"${batch.product ?? '-'}"`,
+            `Batch,"${batch.batch_code ?? '-'}"`,
+            `Group,"${groupName}"`,
+            `F0 Sistem,"${systemF0.toFixed(2)} min"`,
+            `Hasil F0,"${exportF0Result}"`,
+            `Diverifikasi Oleh,"${verifiedByTxt}"`,
+            `Diverifikasi Tanggal,"${verifiedAtTxt}"`,
             ``,
             `RINGKASAN PARAMETER STERILISASI`,
             `Target Suhu (SV),${targetSv.toFixed(1)} ┬░C`,
             `Suhu Maksimum (Max PV),${statsData.maxPv.toFixed(1)} ┬░C`,
             `Suhu Minimum (Min PV),${statsData.minPv.toFixed(1)} ┬░C`,
@@ -952,14 +1084,133 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
                             )}
                         </div>
                         <p className="text-xs font-semibold text-slate-500 mt-1">
                             {timeRangeStr} ΓÇó {durationMinutes !== null ? `${durationMinutes} Menit` : '--'} ΓÇó {logs.length} Data Points
                         </p>
+                        <p className="text-xs font-bold text-slate-700 mt-1.5">
+                            F0 sistem (otomatis): {systemF0.toFixed(2)} min
+                            {isUnverified && liveResult && (
+                                <span
+                                    className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-black ${
+                                        liveResult === 'VALID'
+                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
+                                            : 'bg-rose-50 border-rose-200 text-rose-700'
+                                    }`}
+                                >
+                                    {liveResult}
+                                </span>
+                            )}
+                            {isVerified && (
+                                <span
+                                    className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-black ${
+                                        batch.sterility_criterion === 'PASS'
+                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
+                                            : 'bg-rose-50 border-rose-200 text-rose-700'
+                                    }`}
+                                >
+                                    {batch.sterility_criterion} ΓÇó F0 {Number(batch.target_f0 ?? batch.min_f0_achieved ?? systemF0).toFixed(2)} min
+                                </span>
+                            )}
+                        </p>
                     </div>
                 </div>
             </div>
 
+            {/* Verifikasi Inline */}
+            {isVerified ? (
+                <section className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-6 sm:p-7 shadow-lg backdrop-blur-xl">
+                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3">
+                        <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">Verifikasi Batch</h2>
+                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
+                            <CheckCircle2 size={12} /> VERIFIED
+                        </span>
+                    </div>
+                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Product</dt><dd className="font-extrabold text-slate-900 text-right">{batch.product ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Batch</dt><dd className="font-extrabold text-slate-900 text-right">{batch.batch_code ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Scheduled Process</dt><dd className="font-extrabold text-slate-900 text-right">{batch.scheduled_process ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Minimum F0</dt><dd className="font-extrabold text-slate-900 text-right">{batch.min_f0_achieved ?? '-'} min</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Target F0</dt><dd className="font-extrabold text-slate-900 text-right">{batch.target_f0 ?? '-'} min</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Process deviation</dt><dd className="font-extrabold text-slate-900 text-right">{batch.process_deviation ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Sterility criterion</dt><dd className="font-extrabold text-slate-900 text-right">{batch.sterility_criterion ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Thermal record</dt><dd className="font-extrabold text-slate-900 text-right">{batch.thermal_record ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Group</dt><dd className="font-extrabold text-slate-900 text-right">{groups.find((g) => g.id === batch.group_id)?.name ?? batch.group_id ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Verified by</dt><dd className="font-extrabold text-slate-900 text-right">{batch.verified_by ?? '-'}</dd></div>
+                        <div className="flex justify-between gap-4 pb-1.5"><dt className="font-bold text-slate-500">Verified at</dt><dd className="font-extrabold text-slate-900 text-right">{batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : '-'}</dd></div>
+                    </dl>
+                </section>
+            ) : isUnverified ? (
+                <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-lg backdrop-blur-xl">
+                    <div className="mb-4 border-b border-slate-100 pb-3">
+                        <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">Verifikasi Batch</h2>
+                        <p className="text-xs text-slate-500 mt-0.5 font-medium">F0 sistem (otomatis): {systemF0.toFixed(2)} min ΓÇö lengkapi data lalu submit.</p>
+                    </div>
+                    <form onSubmit={handleVerifySubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
+                        <label className="block text-xs font-bold text-slate-700">
+                            Product
+                            <input type="text" required value={product} onChange={(e) => setProduct(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Batch
+                            <input type="text" required value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Scheduled Process
+                            <input type="text" required value={scheduledProcess} onChange={(e) => setScheduledProcess(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Group
+                            <select required value={groupId} onChange={(e) => setGroupId(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
+                                {groups.map((g) => (
+                                    <option key={g.id} value={g.id}>{g.name}</option>
+                                ))}
+                            </select>
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Minimum F0
+                            <input type="number" required step="0.01" min="0" value={minF0} onChange={(e) => setMinF0(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Target F0
+                            <input type="number" required step="0.01" min="0" value={targetF0} onChange={(e) => setTargetF0(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Process deviation
+                            <select required value={deviation} onChange={(e) => setDeviation(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
+                                <option value="None">None</option>
+                                <option value="Minor">Minor</option>
+                                <option value="Major">Major</option>
+                            </select>
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Sterility criterion
+                            <select required value={effectiveCriterion} disabled={liveFail} onChange={(e) => setCriterion(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3 disabled:opacity-60">
+                                <option value="PASS">PASS</option>
+                                <option value="FAIL">FAIL</option>
+                            </select>
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Thermal record
+                            <select required value={thermal} onChange={(e) => setThermal(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
+                                <option value="VERIFIED">VERIFIED</option>
+                                <option value="REJECTED">REJECTED</option>
+                            </select>
+                        </label>
+                        {liveFail && (
+                            <p className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
+                                F0 sistem di bawah Target F0 ΓÇö Sterility criterion terkunci FAIL.
+                            </p>
+                        )}
+                        <div className="sm:col-span-2 flex justify-end">
+                            <button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-6 py-2.5 shadow-md transition-all">
+                                Verifikasi Batch
+                            </button>
+                        </div>
+                    </form>
+                </section>
+            ) : null}
+
             {/* Thermal Sterilization Profile Chart (Clean Retort Thermal Chart) */}
             <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-lg backdrop-blur-xl">
                 <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                     <div>
                         <div className="flex items-center gap-2.5">
diff --git a/resources/js/Components/History/__tests__/historyHelpers.test.ts b/resources/js/Components/History/__tests__/historyHelpers.test.ts
new file mode 100644
index 0000000..f767b83
--- /dev/null
+++ b/resources/js/Components/History/__tests__/historyHelpers.test.ts
@@ -0,0 +1,28 @@
+import { describe, expect, it } from 'vitest';
+import { compareF0, filterHistories, getHistoryStatus } from '../historyHelpers';
+
+describe('historyHelpers', () => {
+    it('marks null end_time as running', () => {
+        expect(getHistoryStatus({ end_time: null })).toBe('running');
+        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z', verification_status: 'verified' })).toBe('verified');
+        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z' })).toBe('unverified');
+    });
+
+    it('compares F0 strictly without tolerance', () => {
+        expect(compareF0(5.21, 4.5)).toBe('VALID');
+        expect(compareF0(4.5, 4.5)).toBe('VALID');
+        expect(compareF0(4.49, 4.5)).toBe('FAIL');
+        expect(compareF0(1.0, null)).toBeNull();
+    });
+
+    it('filters by status, group and query', () => {
+        const list = [
+            { id: 1, end_time: null, product: 'Rendang', batch_code: 'B-1', group_id: null },
+            { id: 2, end_time: '2026-09-26T10:00:00Z', verification_status: 'verified', product: 'Rendang', batch_code: 'B-2', group_id: 1 },
+            { id: 3, end_time: '2026-09-26T10:00:00Z', product: 'Kari', batch_code: 'B-3', group_id: 2 },
+        ];
+        expect(filterHistories(list, { status: 'running', groupId: 'all', query: '' }).map((h) => h.id)).toEqual([1]);
+        expect(filterHistories(list, { status: 'all', groupId: 2, query: '' }).map((h) => h.id)).toEqual([3]);
+        expect(filterHistories(list, { status: 'all', groupId: 'all', query: 'rendang' }).map((h) => h.id)).toEqual([1, 2]);
+    });
+});
diff --git a/resources/js/Components/History/historyHelpers.ts b/resources/js/Components/History/historyHelpers.ts
new file mode 100644
index 0000000..7552b0c
--- /dev/null
+++ b/resources/js/Components/History/historyHelpers.ts
@@ -0,0 +1,27 @@
+export type HistoryStatus = 'running' | 'unverified' | 'verified';
+
+export function getHistoryStatus(h: { end_time?: string | null; verification_status?: string }): HistoryStatus {
+    if (!h.end_time) return 'running';
+    return h.verification_status === 'verified' ? 'verified' : 'unverified';
+}
+
+export function compareF0(systemF0: number, targetF0: number | null | undefined): 'VALID' | 'FAIL' | null {
+    if (targetF0 === null || targetF0 === undefined || Number.isNaN(systemF0)) return null;
+    return systemF0 < targetF0 ? 'FAIL' : 'VALID';
+}
+
+export interface HistoryFilter {
+    status: 'all' | HistoryStatus;
+    groupId: 'all' | number;
+    query: string;
+}
+
+export function filterHistories<T extends { end_time?: string | null; verification_status?: string; group_id?: number | null; product?: string | null; batch_code?: string | null }>(list: T[], f: HistoryFilter): T[] {
+    const q = f.query.trim().toLowerCase();
+    return list.filter((h) => {
+        if (f.status !== 'all' && getHistoryStatus(h) !== f.status) return false;
+        if (f.groupId !== 'all' && h.group_id !== f.groupId) return false;
+        if (q && !`${h.product ?? ''} ${h.batch_code ?? ''}`.toLowerCase().includes(q)) return false;
+        return true;
+    });
+}
diff --git a/resources/js/Pages/Esp/Monitor.tsx b/resources/js/Pages/Esp/Monitor.tsx
index 01c3d76..afc3f5d 100644
--- a/resources/js/Pages/Esp/Monitor.tsx
+++ b/resources/js/Pages/Esp/Monitor.tsx
@@ -1,15 +1,15 @@
 import React, { useState, useEffect, useMemo, useRef } from 'react';
 import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
-import { Head, Link, router } from '@inertiajs/react';
+import { Head, Link } from '@inertiajs/react';
 import { RetortTelemetry } from '@/Pages/Tn/retortTelemetry';
 import TnFaceplateDisplay from '@/Components/Tn/TnFaceplateDisplay';
 import RetortThermalChart from '@/Components/Tn/RetortThermalChart';
-import ProcessDetailView from '@/Components/History/ProcessDetailView';
+import HistorianList from '@/Components/History/HistorianList';
 import EspPatternEditor from '@/Components/Esp/EspPatternEditor';
 import { calculateLethality, EspTelemetryData } from '@/Components/Esp/EspMonitoringPanel';
-import { ShieldCheck, Flame, Wifi, WifiOff, AlertTriangle, X, Download, Eye, Trash2, MoreVertical, Calendar, Clock, FileText, CheckCircle2 } from 'lucide-react';
+import { AlertTriangle, X } from 'lucide-react';
 
 interface DeviceItem {
     id: number;
     machine_code: string;
     name: string;
@@ -31,10 +31,11 @@ interface Props {
         iso?: string;
         ts?: string;
     } | null;
     histories?: any[];
     initialPattern?: any;
+    groups?: { id: number; name: string; color: string }[];
 }
 
 export default function EspMonitor({
     device,
     devices = [],
@@ -42,25 +43,20 @@ export default function EspMonitor({
     history: initialHistory = [],
     isOnline: initialIsOnline,
     systemEvent,
     histories = [],
     initialPattern,
+    groups = [],
 }: Props) {
     const [activeTab, setActiveTab] = useState<'monitor' | 'pattern' | 'history'>('monitor');
     const [telemetry, setTelemetry] = useState<EspTelemetryData>(initialTelemetry);
     const [history, setHistory] = useState<any[]>(initialHistory);
     const [isOnline, setIsOnline] = useState<boolean>(initialIsOnline);
     const [wdtAlert, setWdtAlert] = useState(systemEvent);
     const [f0, setF0] = useState<number>(0);
     const lastUpdateRef = useRef<number>(Date.now());
 
-    // Historian states
-    const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
-    const [customDate, setCustomDate] = useState<string>('');
-    const [selectedBatch, setSelectedBatch] = useState<any>(null);
-    const [activeMenu, setActiveMenu] = useState<number | null>(null);
-
     const lastSeqRef = useRef<number>(0);
 
     const applyTelemetryPayload = (data: any) => {
         if (!data) return;
         lastUpdateRef.current = Date.now();
@@ -198,130 +194,39 @@ export default function EspMonitor({
 
     const formattedUpdateTime = useMemo(() => {
         return new Date().toLocaleTimeString('id-ID');
     }, [telemetry]);
 
-    // Historian Filtering
-    const filteredHistories = useMemo(() => {
-        return histories.filter((h) => {
-            const startTime = new Date(h.start_time).getTime();
-            if (isNaN(startTime)) return true;
-
-            if (customDate) {
-                const targetDateStr = new Date(customDate).toDateString();
-                const itemDateStr = new Date(h.start_time).toDateString();
-                return targetDateStr === itemDateStr;
-            }
-
-            const now = Date.now();
-            if (period === 'Hari') {
-                return startTime >= now - 24 * 60 * 60 * 1000;
-            } else if (period === 'Minggu') {
-                return startTime >= now - 7 * 24 * 60 * 60 * 1000;
-            } else if (period === 'Bulan') {
-                return startTime >= now - 30 * 24 * 60 * 60 * 1000;
-            }
-            return true;
-        });
-    }, [histories, period, customDate]);
-
-    const handleDownload = (batch: any, format: 'csv' | 'excel' | 'pdf') => {
-        const logs = [...(batch.log_data || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
-        if (!logs.length) {
-            alert('Tidak ada data point pada batch ini.');
-            return;
-        }
-
-        const headers = ['Time', 'PV (┬░C)', 'SV (┬░C)'];
-        const rows = logs.map((log: any) => [
-            new Date(log.created_at).toLocaleTimeString(),
-            Number(log.pv ?? 0).toFixed(1),
-            Number(log.sv ?? 0).toFixed(1)
-        ]);
-
-        if (format === 'csv' || format === 'excel') {
-            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
-            const encodedUri = encodeURI(csvContent);
-            const link = document.createElement("a");
-            link.setAttribute("href", encodedUri);
-            link.setAttribute("download", `batch_${batch.id}_log.csv`);
-            document.body.appendChild(link);
-            link.click();
-            document.body.removeChild(link);
-        } else if (format === 'pdf') {
-            const printWindow = window.open('', '_blank');
-            if (printWindow) {
-                const title = `Batch Log Report: ${batch.controller?.machine?.machine_name || 'ESP32 Retort Logger'}`;
-                printWindow.document.write(`
-                    <html>
-                    <head>
-                        <title>${title}</title>
-                        <style>
-                            body { font-family: sans-serif; padding: 20px; }
-                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
-                            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
-                            th { background-color: #f0f0f0; }
-                        </style>
-                    </head>
-                    <body>
-                        <h2>${title}</h2>
-                        <p>Start Time: ${new Date(batch.start_time).toLocaleString()}</p>
-                        <p>End Time: ${batch.end_time ? new Date(batch.end_time).toLocaleString() : 'In Progress'}</p>
-                        <table>
-                            <thead>
-                                <tr><th>Time</th><th>PV (&deg;C)</th><th>SV (&deg;C)</th></tr>
-                            </thead>
-                            <tbody>
-                                ${rows.map((r: any) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
-                            </tbody>
-                        </table>
-                        <script>
-                            window.onload = function() { window.print(); window.close(); }
-                        </script>
-                    </body>
-                    </html>
-                `);
-                printWindow.document.close();
-            }
-        }
-    };
-
-    const handleDeleteHistory = (id: number) => {
-        if (confirm('Apakah Anda yakin ingin menghapus riwayat proses ini?')) {
-            router.delete(route('tn.history.destroy', id));
-        }
-    };
-
     return (
         <AuthenticatedLayout
             navContent={
                 <div className="flex items-center gap-2">
                     <button
                         type="button"
-                        onClick={() => { setActiveTab('monitor'); setSelectedBatch(null); }}
+                        onClick={() => setActiveTab('monitor')}
                         className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                             activeTab === 'monitor'
                                 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                 : 'text-slate-200 hover:bg-blue-900/50 hover:text-white'
                         }`}
                     >
                         Monitoring
                     </button>
                     <button
                         type="button"
-                        onClick={() => { setActiveTab('pattern'); setSelectedBatch(null); }}
+                        onClick={() => setActiveTab('pattern')}
                         className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                             activeTab === 'pattern'
                                 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                 : 'text-slate-200 hover:bg-blue-900/50 hover:text-white'
                         }`}
                     >
                         Pattern
                     </button>
                     <button
                         type="button"
-                        onClick={() => { setActiveTab('history'); setSelectedBatch(null); }}
+                        onClick={() => setActiveTab('history')}
                         className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                             activeTab === 'history'
                                 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                 : 'text-slate-200 hover:bg-blue-900/50 hover:text-white'
                         }`}
@@ -337,15 +242,15 @@ export default function EspMonitor({
                             <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                 {device.name || 'ESP32 Retort Logger'} ({device.machine_code})
                             </h1>
                             <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wider border ${
                                 isOnline
-                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
+                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                     : 'bg-rose-100 text-rose-800 border-rose-200'
                             }`}>
-                                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></span>
-                                {isOnline ? 'Realtime Online' : 'Offline'}
+                                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
+                                {isOnline ? 'Online' : 'Offline'}
                             </span>
                         </div>
                         <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                             <span>Tipe: <strong className="font-mono text-blue-700">ESP32-S3 (RetortLogger)</strong></span>
                             <span className="text-slate-300">ΓÇó</span>
@@ -496,209 +401,12 @@ export default function EspMonitor({
                             machineCode={device.machine_code}
                             initialPattern={initialPattern}
                             isOnline={isOnline}
                             telemetry={telemetry}
                         />
-                    ) : selectedBatch ? (
-                        <ProcessDetailView
-                            batch={selectedBatch}
-                            onBack={() => setSelectedBatch(null)}
-                        />
                     ) : (
-                        /* Historian / Process History View */
-                        <div className="space-y-6">
-                            {/* Filter Section */}
-                            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-lg backdrop-blur-xl">
-                                <div className="flex flex-wrap items-end justify-between gap-4">
-                                    <div>
-                                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Filter Periode</label>
-                                        <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
-                                            {['Semua', 'Hari', 'Minggu', 'Bulan'].map((x) => (
-                                                <button
-                                                    key={x}
-                                                    onClick={() => { setPeriod(x as any); setCustomDate(''); }}
-                                                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
-                                                        period === x && !customDate
-                                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
-                                                            : 'text-slate-600 hover:text-slate-900'
-                                                    }`}
-                                                >
-                                                    {x}
-                                                </button>
-                                            ))}
-                                        </div>
-                                    </div>
-                                    <div className="flex items-center gap-2">
-                                        <div>
-                                            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Tanggal Kustom</label>
-                                            <input
-                                                type="date"
-                                                value={customDate}
-                                                onChange={(e) => setCustomDate(e.target.value)}
-                                                className="rounded-xl border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600 py-2 px-3"
-                                            />
-                                        </div>
-                                        {customDate && (
-                                            <button
-                                                type="button"
-                                                onClick={() => setCustomDate('')}
-                                                className="mt-6 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
-                                            >
-                                                Reset
-                                            </button>
-                                        )}
-                                    </div>
-                                </div>
-                            </div>
-
-                            {/* Batch Cards Grid */}
-                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
-                                {filteredHistories.length === 0 ? (
-                                    <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-white/95 rounded-3xl border border-slate-200 shadow-sm">
-                                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
-                                        Tidak ada riwayat proses pada filter ini.
-                                    </div>
-                                ) : (
-                                    filteredHistories.map((h: any) => {
-                                        const startTime = new Date(h.start_time);
-                                        const endTime = h.end_time ? new Date(h.end_time) : null;
-                                        const durationMinutes = endTime
-                                            ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
-                                            : null;
-                                        const logCount = h.log_data?.length || 0;
-                                        const logs = h.log_data || [];
-                                        const maxPv = logs.length > 0 ? Math.max(...logs.map((l: any) => Number(l.pv ?? 0))) : 0;
-
-                                        return (
-                                            <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
-                                                <div>
-                                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
-                                                        <div className="flex items-center gap-2">
-                                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
-                                                                Batch #{h.id}
-                                                            </span>
-                                                            {h.end_time ? (
-                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
-                                                                    <CheckCircle2 size={12} /> Selesai
-                                                                </span>
-                                                            ) : (
-                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
-                                                                    Proses Berjalan
-                                                                </span>
-                                                            )}
-                                                        </div>
-
-                                                        {/* Action Dropdown */}
-                                                        <div className="relative">
-                                                            <button
-                                                                type="button"
-                                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === h.id ? null : h.id); }}
-                                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
-                                                            >
-                                                                <MoreVertical size={16} />
-                                                            </button>
-                                                            {activeMenu === h.id && (
-                                                                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 animate-in fade-in">
-                                                                    <button
-                                                                        type="button"
-                                                                        disabled={!h.end_time}
-                                                                        onClick={() => {
-                                                                            if (!h.end_time) return;
-                                                                            setSelectedBatch(h);
-                                                                            setActiveMenu(null);
-                                                                        }}
-                                                                        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors text-left ${
-                                                                            !h.end_time
-                                                                                ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
-                                                                                : 'text-slate-700 hover:bg-slate-100'
-                                                                        }`}
-                                                                    >
-                                                                        <Eye size={14} className={!h.end_time ? 'text-slate-400' : 'text-blue-600'} />
-                                                                        {!h.end_time ? 'Terkunci (Proses Berjalan)' : 'Lihat Detail Log'}
-                                                                    </button>
-                                                                    <button
-                                                                        type="button"
-                                                                        disabled={!h.end_time}
-                                                                        onClick={() => {
-                                                                            if (!h.end_time) return;
-                                                                            handleDownload(h, 'csv');
-                                                                            setActiveMenu(null);
-                                                                        }}
-                                                                        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors text-left ${
-                                                                            !h.end_time
-                                                                                ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
-                                                                                : 'text-slate-700 hover:bg-slate-100'
-                                                                        }`}
-                                                                    >
-                                                                        <Download size={14} className={!h.end_time ? 'text-slate-400' : 'text-emerald-600'} /> Export CSV
-                                                                    </button>
-                                                                    <button
-                                                                        type="button"
-                                                                        onClick={() => { handleDownload(h, 'pdf'); setActiveMenu(null); }}
-                                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
-                                                                    >
-                                                                        <FileText size={14} className="text-amber-600" /> Cetak PDF
-                                                                    </button>
-                                                                    <button
-                                                                        type="button"
-                                                                        onClick={() => { handleDeleteHistory(h.id); setActiveMenu(null); }}
-                                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left border-t border-slate-100 mt-1"
-                                                                    >
-                                                                        <Trash2 size={14} /> Hapus Log
-                                                                    </button>
-                                                                </div>
-                                                            )}
-                                                        </div>
-                                                    </div>
-
-                                                    <div className="space-y-2 text-xs">
-                                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                                            <span>Waktu Mulai:</span>
-                                                            <span className="font-mono text-slate-900 font-bold">{startTime.toLocaleString('id-ID')}</span>
-                                                        </div>
-                                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                                            <span>Waktu Selesai:</span>
-                                                            <span className="font-mono text-slate-900 font-bold">{endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}</span>
-                                                        </div>
-                                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                                            <span>Durasi:</span>
-                                                            <span className="font-mono text-blue-700 font-bold">{durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</span>
-                                                        </div>
-                                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                                            <span>Suhu Puncak (Max PV):</span>
-                                                            <span className="font-mono text-rose-600 font-bold">{maxPv > 0 ? `${maxPv.toFixed(1)} ┬░C` : '--'}</span>
-                                                        </div>
-                                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                                            <span>Data Points:</span>
-                                                            <span className="font-mono text-slate-700 font-bold">{logCount} points</span>
-                                                        </div>
-                                                    </div>
-                                                </div>
-
-                                                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
-                                                    <button
-                                                        type="button"
-                                                        onClick={() => setSelectedBatch(h)}
-                                                        className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black py-2.5 px-3 transition-colors text-center"
-                                                    >
-                                                        Lihat Detail
-                                                    </button>
-                                                    <button
-                                                        type="button"
-                                                        onClick={() => handleDownload(h, 'csv')}
-                                                        className="rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 p-2.5 transition-colors"
-                                                        title="Export CSV"
-                                                    >
-                                                        <Download size={14} />
-                                                    </button>
-                                                </div>
-                                            </div>
-                                        );
-                                    })
-                                )}
-                            </div>
-                        </div>
+                        <HistorianList histories={histories} groups={groups} />
                     )}
                 </div>
             </div>
         </AuthenticatedLayout>
     );
diff --git a/resources/js/Pages/Operations.tsx b/resources/js/Pages/Operations.tsx
index b39dd16..dff4d2c 100644
--- a/resources/js/Pages/Operations.tsx
+++ b/resources/js/Pages/Operations.tsx
@@ -1,9 +1,8 @@
 import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
-import { Head, Link, router } from '@inertiajs/react';
-import { ReactNode, useState, useEffect, useMemo } from 'react';
-import { createPortal } from 'react-dom';
+import { Head, Link } from '@inertiajs/react';
+import { ReactNode } from 'react';
 import {
     Gauge,
     Settings,
     ThermometerSun,
     Wind,
@@ -13,22 +12,15 @@ import {
     ArrowDown,
     Database as DatabaseIcon,
     CheckCircle,
     AlertTriangle,
     XCircle,
-    Download,
-    Eye,
-    Trash2,
-    MoreVertical,
-    Clock,
-    FileText,
-    CheckCircle2,
 } from 'lucide-react';
-import ProcessDetailView from '@/Components/History/ProcessDetailView';
+import HistorianList from '@/Components/History/HistorianList';
 
 type Module = 'scada' | 'historian' | 'alarm' | 'notifications' | 'database';
-type Props = { module: Module; histories?: any[] };
+type Props = { module: Module; histories?: any[]; groups?: { id: number; name: string; color: string }[] };
 
 type FlowItem = {
     icon: ReactNode;
     label: string;
     value: string;
@@ -69,11 +61,11 @@ const Scada = () => {
     return (
         <>
             <Panel>
                 <div className="mb-5 flex items-center justify-between">
                     <div>
-                        <h3 className="font-semibold text-slate-800">Realtime Mimic Diagram</h3>
+                        <h3 className="font-semibold text-slate-800">Mimic Diagram</h3>
                         <p className="text-sm text-slate-500">Live process overview ┬╖ updated just now</p>
                     </div>
                     <Badge tone="green">System Online</Badge>
                 </div>
                 <div className="flex flex-col items-center">
@@ -83,11 +75,11 @@ const Scada = () => {
                                 <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100">
                                     {item.icon}
                                 </span>
                                 <div className="flex-1">
                                     <p className="font-semibold text-slate-800">{item.label}</p>
-                                    <p className="text-xs text-slate-500">Realtime object</p>
+                                    <p className="text-xs text-slate-500">Live object</p>
                                 </div>
                                 <span className="font-mono text-sm font-semibold text-cyan-700">{item.value}</span>
                                 <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                             </div>
                             {index < flow.length - 1 && <div className="relative h-7"><ArrowDown size={16} className="absolute left-[-8px] top-3 text-cyan-500 rotate-90" /></div>}
@@ -97,362 +89,10 @@ const Scada = () => {
             </Panel>
         </>
     );
 };
 
-function Historian({ histories = [] }: { histories?: any[] }) {
-    const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
-    const [customDate, setCustomDate] = useState<string>('');
-    const [selectedBatch, setSelectedBatch] = useState<any>(null);
-    const [activeMenu, setActiveMenu] = useState<number | null>(null);
-
-    const filteredHistories = useMemo(() => {
-        return histories.filter((h) => {
-            const startTime = new Date(h.start_time).getTime();
-            if (isNaN(startTime)) return true;
-
-            if (customDate) {
-                const targetDateStr = new Date(customDate).toDateString();
-                const itemDateStr = new Date(h.start_time).toDateString();
-                return targetDateStr === itemDateStr;
-            }
-
-            const now = Date.now();
-            if (period === 'Hari') {
-                const oneDayAgo = now - 24 * 60 * 60 * 1000;
-                return startTime >= oneDayAgo;
-            } else if (period === 'Minggu') {
-                const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
-                return startTime >= oneWeekAgo;
-            } else if (period === 'Bulan') {
-                const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
-                return startTime >= oneMonthAgo;
-            }
-
-            return true;
-        });
-    }, [histories, period, customDate]);
-
-    const formatValue = (val: number | undefined, dp: number = 0) => {
-        if (val === undefined || val === 31000 || val === 30000 || val === -30000) return '-';
-        return (val / Math.pow(10, dp)).toFixed(dp).replace('.', ',');
-    };
-
-    const getChronologicalLogs = (batch: any) => {
-        return [...(batch.log_data || [])].sort((a: any, b: any) => {
-            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
-        });
-    };
-
-    const handleDownload = (batch: any, format: 'csv' | 'excel' | 'pdf') => {
-        const logs = getChronologicalLogs(batch);
-        if (!logs.length) {
-            alert('Tidak ada data point pada batch ini.');
-            return;
-        }
-
-        const headers = ['Time', 'PV (C)', 'SV (C)'];
-        const rows = logs.map((log: any) => [
-            new Date(log.created_at).toLocaleTimeString(),
-            formatValue(log.pv, log.decimal_point),
-            formatValue(log.sv, log.decimal_point)
-        ]);
-
-        if (format === 'csv' || format === 'excel') {
-            const csvContent = "data:text/csv;charset=utf-8,"
-                + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
-            const encodedUri = encodeURI(csvContent);
-            const link = document.createElement("a");
-            link.setAttribute("href", encodedUri);
-            const ext = format === 'excel' ? 'csv' : 'csv';
-            link.setAttribute("download", `batch_${batch.id}_log.${ext}`);
-            document.body.appendChild(link);
-            link.click();
-            document.body.removeChild(link);
-        } else if (format === 'pdf') {
-            const printWindow = window.open('', '_blank');
-            if (printWindow) {
-                const title = `Batch Log Report: ${batch.controller?.machine?.machine_name || batch.controller?.model_type || 'Controller'}`;
-                printWindow.document.write(`
-                    <html>
-                    <head>
-                        <title>${title}</title>
-                        <style>
-                            body { font-family: sans-serif; padding: 20px; }
-                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
-                            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
-                            th { background-color: #f0f0f0; }
-                        </style>
-                    </head>
-                    <body>
-                        <h2>${title}</h2>
-                        <p>Start Time: ${new Date(batch.start_time).toLocaleString()}</p>
-                        <p>End Time: ${new Date(batch.end_time).toLocaleString()}</p>
-                        <table>
-                            <thead>
-                                <tr><th>Time</th><th>PV (&deg;C)</th><th>SV (&deg;C)</th></tr>
-                            </thead>
-                            <tbody>
-                                ${rows.map((r: any) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
-                            </tbody>
-                        </table>
-                        <script>
-                            window.onload = function() { window.print(); window.close(); }
-                        </script>
-                    </body>
-                    </html>
-                `);
-                printWindow.document.close();
-            }
-        }
-    };
-
-    const handleDelete = (id: number) => {
-        if (confirm('Apakah Anda yakin ingin menghapus riwayat proses ini?')) {
-            router.delete(route('tn.history.destroy', id));
-        }
-    };
-
-    useEffect(() => {
-        const closeMenu = () => setActiveMenu(null);
-        window.addEventListener('click', closeMenu);
-        return () => window.removeEventListener('click', closeMenu);
-    }, []);
-
-    if (selectedBatch) {
-        return (
-            <ProcessDetailView
-                batch={selectedBatch}
-                onBack={() => setSelectedBatch(null)}
-            />
-        );
-    }
-
-    return (
-        <div className="space-y-6">
-            <Panel>
-                <div className="flex flex-wrap items-end justify-between gap-4">
-                    <div>
-                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Filter Periode</label>
-                        <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
-                            {['Semua', 'Hari', 'Minggu', 'Bulan'].map((x) => (
-                                <button
-                                    key={x}
-                                    onClick={() => { setPeriod(x as any); setCustomDate(''); }}
-                                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
-                                        period === x && !customDate
-                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
-                                            : 'text-slate-600 hover:text-slate-900'
-                                    }`}
-                                >
-                                    {x}
-                                </button>
-                            ))}
-                        </div>
-                    </div>
-                    <div className="flex items-center gap-2">
-                        <div>
-                            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Tanggal Kustom</label>
-                            <input
-                                type="date"
-                                value={customDate}
-                                onChange={(e) => setCustomDate(e.target.value)}
-                                className="rounded-xl border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600 py-2 px-3"
-                            />
-                        </div>
-                        {customDate && (
-                            <button
-                                type="button"
-                                onClick={() => setCustomDate('')}
-                                className="mt-6 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
-                            >
-                                Reset
-                            </button>
-                        )}
-                    </div>
-                </div>
-            </Panel>
-
-            {/* Batch Cards Grid */}
-            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
-                {filteredHistories.length === 0 ? (
-                    <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-white/95 rounded-3xl border border-slate-200 shadow-sm">
-                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
-                        Tidak ada riwayat proses yang cocok dengan filter.
-                    </div>
-                ) : (
-                    filteredHistories.map((h: any) => {
-                        const startTime = new Date(h.start_time);
-                        const endTime = h.end_time ? new Date(h.end_time) : null;
-                        const durationMinutes = endTime
-                            ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
-                            : null;
-                        const logCount = h.log_data?.length || 0;
-                        const logs = h.log_data || [];
-                        const maxPv = logs.length > 0 ? Math.max(...logs.map((l: any) => Number(l.pv ?? 0))) : 0;
-                        const machineName = h.controller?.machine?.machine_name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
-
-                        return (
-                            <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
-                                <div>
-                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
-                                        <div className="flex items-center gap-2">
-                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
-                                                Batch #{h.id}
-                                            </span>
-                                            {h.end_time ? (
-                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
-                                                    <CheckCircle2 size={12} /> Selesai
-                                                </span>
-                                            ) : (
-                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
-                                                    Proses Berjalan
-                                                </span>
-                                            )}
-                                        </div>
-
-                                        {/* Action Dropdown */}
-                                        <div className="relative">
-                                            <button
-                                                type="button"
-                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === h.id ? null : h.id); }}
-                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
-                                            >
-                                                <MoreVertical size={16} />
-                                            </button>
-                                            {activeMenu === h.id && (
-                                                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 animate-in fade-in">
-                                                    <button
-                                                        type="button"
-                                                        onClick={() => { setSelectedBatch(h); setActiveMenu(null); }}
-                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
-                                                    >
-                                                        <Eye size={14} className="text-blue-600" /> Lihat Detail Log
-                                                    </button>
-                                                    <button
-                                                        type="button"
-                                                        onClick={() => { handleDownload(h, 'csv'); setActiveMenu(null); }}
-                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
-                                                    >
-                                                        <Download size={14} className="text-emerald-600" /> Export CSV
-                                                    </button>
-                                                    <button
-                                                        type="button"
-                                                        onClick={() => { handleDownload(h, 'pdf'); setActiveMenu(null); }}
-                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
-                                                    >
-                                                        <FileText size={14} className="text-amber-600" /> Cetak PDF
-                                                    </button>
-                                                    <button
-                                                        type="button"
-                                                        onClick={() => { handleDelete(h.id); setActiveMenu(null); }}
-                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left border-t border-slate-100 mt-1"
-                                                    >
-                                                        <Trash2 size={14} /> Hapus Log
-                                                    </button>
-                                                </div>
-                                            )}
-                                        </div>
-                                    </div>
-
-                                    <div className="space-y-2 text-xs">
-                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                            <span>Mesin / Controller:</span>
-                                            <span className="font-bold text-slate-900">{machineName}</span>
-                                        </div>
-                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                            <span>Waktu Mulai:</span>
-                                            <span className="font-mono text-slate-900 font-bold">{startTime.toLocaleString('id-ID')}</span>
-                                        </div>
-                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                            <span>Waktu Selesai:</span>
-                                            <span className="font-mono text-slate-900 font-bold">{endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}</span>
-                                        </div>
-                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                            <span>Durasi:</span>
-                                            <span className="font-mono text-blue-700 font-bold">{durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</span>
-                                        </div>
-                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                            <span>Suhu Puncak (Max PV):</span>
-                                            <span className="font-mono text-rose-600 font-bold">{maxPv > 0 ? `${maxPv.toFixed(1)} ┬░C` : '--'}</span>
-                                        </div>
-                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
-                                            <span>Data Points:</span>
-                                            <span className="font-mono text-slate-700 font-bold">{logCount} points</span>
-                                        </div>
-                                    </div>
-                                </div>
-
-                                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
-                                    <button
-                                        type="button"
-                                        onClick={() => setSelectedBatch(h)}
-                                        className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black py-2.5 px-3 transition-colors text-center"
-                                    >
-                                        Lihat Detail
-                                    </button>
-                                    <button
-                                        type="button"
-                                        onClick={() => handleDownload(h, 'csv')}
-                                        className="rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 p-2.5 transition-colors"
-                                        title="Export CSV"
-                                    >
-                                        <Download size={14} />
-                                    </button>
-                                </div>
-                            </div>
-                        );
-                    })
-                )}
-            </div>
-
-            {/* Modal Detail Popup via createPortal */}
-            {selectedBatch && typeof document !== 'undefined' && createPortal(
-                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4" onClick={() => setSelectedBatch(null)}>
-                    <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
-                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#0f172a] text-white">
-                            <div>
-                                <h3 className="font-black text-lg text-white">Detail Batch Log: {selectedBatch.controller?.machine?.machine_name || selectedBatch.controller?.model_type || `Controller #${selectedBatch.tn_controller_id}`}</h3>
-                                <p className="text-xs font-semibold text-blue-300 mt-0.5">
-                                    {new Date(selectedBatch.start_time).toLocaleString()} - {new Date(selectedBatch.end_time).toLocaleString()}
-                                </p>
-                            </div>
-                            <button onClick={() => setSelectedBatch(null)} className="h-8 w-8 rounded-full bg-blue-900/60 flex items-center justify-center text-lg font-bold text-blue-200 hover:bg-blue-800 transition-colors">&times;</button>
-                        </div>
-
-                        <div className="p-6 overflow-y-auto flex-1">
-                            <table className="w-full text-left text-sm">
-                                <thead className="border-b border-slate-200 text-xs uppercase font-black text-slate-700 bg-slate-50 sticky top-0">
-                                    <tr>
-                                        <th className="py-3 px-3">Waktu</th>
-                                        <th className="py-3 px-3">PV (&deg;C)</th>
-                                        <th className="py-3 px-3">SV (&deg;C)</th>
-                                    </tr>
-                                </thead>
-                                <tbody className="divide-y divide-slate-100 font-mono">
-                                    {getChronologicalLogs(selectedBatch).map((log: any, idx: number) => (
-                                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
-                                            <td className="py-2.5 px-3 font-semibold text-slate-600">{new Date(log.created_at).toLocaleTimeString()}</td>
-                                            <td className="py-2.5 px-3 font-black text-blue-700">{log.decimal_point ? (log.pv / Math.pow(10, log.decimal_point)).toFixed(log.decimal_point) : log.pv}</td>
-                                            <td className="py-2.5 px-3 font-black text-amber-700">{log.decimal_point ? (log.sv / Math.pow(10, log.decimal_point)).toFixed(log.decimal_point) : log.sv}</td>
-                                        </tr>
-                                    ))}
-                                </tbody>
-                            </table>
-                        </div>
-
-                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
-                            <button onClick={() => setSelectedBatch(null)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-black text-slate-800 bg-white hover:bg-slate-50 shadow-sm transition-all">Tutup</button>
-                        </div>
-                    </div>
-                </div>,
-                document.body
-            )}
-        </div>
-    );
-}
-
 function Alarm() {
     const rows = [
         { time: '10:31:04', msg: 'High temperature detected', machine: 'Retort-01', status: 'Critical', icon: <XCircle className="text-red-500" />, tone: 'red' as const },
         { time: '09:48:22', msg: 'Pressure approaching limit', machine: 'Boiler-01', status: 'Warning', icon: <AlertTriangle className="text-amber-500" />, tone: 'amber' as const },
         { time: '08:12:10', msg: 'Cycle completed', machine: 'Retort-02', status: 'Normal', icon: <CheckCircle className="text-emerald-500" />, tone: 'green' as const },
@@ -531,20 +171,20 @@ function DatabasePanel() {
         </Panel>
     );
 }
 
 const titles: Record<Module, [string, string]> = {
-    scada: ['SCADA Realtime POV', 'Pantau dan konfigurasi proses SCADA secara visual'],
+    scada: ['SCADA Process POV', 'Pantau dan konfigurasi proses SCADA secara visual'],
     historian: ['Riwayat Proses & Data Log', 'Kelola, analisis, dan ekspor log data proses sterilisasi controller retort'],
     alarm: ['Manajemen Alarm & Event', 'Pantau riwayat alarm aktif dan kejadian sistem'],
     notifications: ['Kanal Notifikasi Alarm', 'Konfigurasi integrasi saluran pemberitahuan alarm'],
     database: ['Struktur Database SCADA', 'Daftar tabel operasional dan skema data sistem'],
 };
 
-export default function Operations({ module, histories }: Props) {
+export default function Operations({ module, histories, groups }: Props) {
     const [title, subtitle] = titles[module];
-    const content = { scada: <Scada />, historian: <Historian histories={histories} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];
+    const content = { scada: <Scada />, historian: <HistorianList histories={histories} groups={groups} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];
 
     return (
         <AuthenticatedLayout header={
             <div className="max-w-7xl mx-auto py-1">
                 <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
diff --git a/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts b/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
index 07ade4d..d0e3909 100644
--- a/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
+++ b/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
@@ -101,10 +101,14 @@ describe('retort telemetry normalization', () => {
         expect(calculateF0(Array(600).fill(100), 1)).toBe(0.08);
         // Under 100┬░C contributes 0 to F0
         expect(calculateF0(Array(600).fill(90), 1)).toBe(0);
     });
 
+    it('uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)', () => {
+        expect(calculateF0(Array(600).fill(121.0), 1)).toBe(9.77);
+    });
+
     it('segments multi-step retort process into named categories with duration', () => {
         const dummyReadings = [
             // Step 0: CUT (60 seconds -> 1 min)
             ...Array(60).fill(null).map((_, i) => ({ step_current: 0, pv: 250 + i * 15, decimal_point: 1 })),
             // Step 1: Holding (120 seconds -> 2 min)
diff --git a/resources/js/Pages/Tn/retortTelemetry.ts b/resources/js/Pages/Tn/retortTelemetry.ts
index 15e4e97..7fe9e97 100644
--- a/resources/js/Pages/Tn/retortTelemetry.ts
+++ b/resources/js/Pages/Tn/retortTelemetry.ts
@@ -224,18 +224,18 @@ export interface RetortStepSegment {
     isHolding: boolean;
 }
 
 /**
  * Calculates F0 sterilization lethality value given temperature history
- * F0 = sum(dt_minutes * 10^((T - 121.11) / 10)) for T >= 100┬░C
+ * F0 = sum(dt_minutes * 10^((T - 121.1) / 10)) for T >= 100┬░C
  */
 export function calculateF0(temperatures: number[], intervalSeconds: number = 1): number {
     let f0 = 0;
     const dtMinutes = intervalSeconds / 60;
     for (const temp of temperatures) {
         if (temp >= 100) {
-            f0 += dtMinutes * Math.pow(10, (temp - 121.11) / 10);
+            f0 += dtMinutes * Math.pow(10, (temp - 121.1) / 10);
         }
     }
     return Math.round(f0 * 100) / 100;
 }
 
diff --git a/routes/web.php b/routes/web.php
index 72ba153..0b52d05 100644
--- a/routes/web.php
+++ b/routes/web.php
@@ -31,11 +31,12 @@
 
 Route::group([], function () {
     Route::get('/scada', fn () => redirect()->route('tn.index'))->name('scada.index');
     Route::get('/historian', function () {
         $histories = \App\Models\TnProcessHistory::with('controller.machine')->orderBy('start_time')->get();
-        return Inertia::render('Operations', ['module' => 'historian', 'histories' => $histories]);
+        $groups = \App\Models\HistoryGroup::orderBy('id')->get();
+        return Inertia::render('Operations', ['module' => 'historian', 'histories' => $histories, 'groups' => $groups]);
     })->name('historian.index');
     Route::get('/database', fn () => Inertia::render('Operations', ['module' => 'database']))->name('database.index');
     Route::redirect('/trend', '/tn')->name('trend.index');
     Route::redirect('/communication', '/tn')->name('communication.index');
 
@@ -77,10 +78,12 @@
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
diff --git a/tests/Feature/HistoryVerificationSchemaTest.php b/tests/Feature/HistoryVerificationSchemaTest.php
new file mode 100644
index 0000000..276fff3
--- /dev/null
+++ b/tests/Feature/HistoryVerificationSchemaTest.php
@@ -0,0 +1,26 @@
+<?php
+
+namespace Tests\Feature;
+
+use App\Models\HistoryGroup;
+use Illuminate\Foundation\Testing\RefreshDatabase;
+use Illuminate\Support\Facades\Schema;
+use Tests\TestCase;
+
+class HistoryVerificationSchemaTest extends TestCase
+{
+    use RefreshDatabase;
+
+    public function test_verification_columns_exist(): void
+    {
+        foreach (['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id'] as $col) {
+            $this->assertTrue(Schema::hasColumn('tn_process_histories', $col), "missing column {$col}");
+        }
+    }
+
+    public function test_two_groups_seeded(): void
+    {
+        $this->assertSame(2, HistoryGroup::count());
+        $this->assertSame(['Group 1', 'Group 2'], HistoryGroup::orderBy('id')->pluck('name')->all());
+    }
+}
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
diff --git a/tests/Unit/F0CalculatorTest.php b/tests/Unit/F0CalculatorTest.php
new file mode 100644
index 0000000..497edfe
--- /dev/null
+++ b/tests/Unit/F0CalculatorTest.php
@@ -0,0 +1,35 @@
+<?php
+
+namespace Tests\Unit;
+
+use App\Services\F0Calculator;
+use PHPUnit\Framework\TestCase;
+
+class F0CalculatorTest extends TestCase
+{
+    private function logs(array $pvs, int $dp = 0): array
+    {
+        return array_map(fn ($pv) => ['pv' => $pv, 'decimal_point' => $dp], $pvs);
+    }
+
+    public function test_constant_121_1_for_60_seconds_is_1(): void
+    {
+        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 121.1))));
+    }
+
+    public function test_single_point_method_not_trapezoid(): void
+    {
+        $this->assertSame(0.05, F0Calculator::fromLogs($this->logs([120, 121, 122])));
+    }
+
+    public function test_below_100_contributes_zero(): void
+    {
+        $this->assertSame(0.0, F0Calculator::fromLogs($this->logs(array_fill(0, 600, 90))));
+    }
+
+    public function test_decimal_point_and_overscale_normalized(): void
+    {
+        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 1)));
+        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 0)));
+    }
+}
