017edf7 fix: temuan final review verifikasi history
diff --git a/app/Http/Controllers/TnMonitorController.php b/app/Http/Controllers/TnMonitorController.php
index 54b49ea..c89970e 100644
--- a/app/Http/Controllers/TnMonitorController.php
+++ b/app/Http/Controllers/TnMonitorController.php
@@ -199,46 +199,48 @@ public function verifyHistory(\App\Models\TnProcessHistory $history, Request $re
     {
         if (! $history->end_time || $history->verification_status === 'verified') {
             return response()->json(['success' => false, 'message' => 'Hanya history selesai yang belum terverifikasi.'], 422);
         }
 
         // ponytail: manual Validator karena shouldRenderJsonWhen global membuat $request->validate() redirect (302) untuk JSON di route web.
         $data = $this->validatedOrJson422($request, [
             'product' => 'required|string|max:100',
             'batch_code' => 'required|string|max:50|unique:tn_process_histories,batch_code',
             'scheduled_process' => 'required|string|max:100',
-            'min_f0_achieved' => 'nullable|numeric|min:0',
-            'target_f0' => 'nullable|numeric|min:0',
+            'min_f0_achieved' => 'required|numeric|min:0',
+            'target_f0' => 'required|numeric|min:0',
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
 
+        $verifiedBy = $request->user()->name ?? 'Operator';
+
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
-            'verified_by' => $request->user()->name,
+            'verified_by' => $verifiedBy,
             'verified_at' => now(),
         ]);
 
         if ($request->wantsJson()) {
             return response()->json(['success' => true, 'system_f0' => $systemF0, 'sterility_criterion' => $criterion]);
         }
 
         return back()->with('success', 'Batch berhasil diverifikasi.');
     }
 
diff --git a/resources/js/Components/History/HistorianList.tsx b/resources/js/Components/History/HistorianList.tsx
index 707e6d8..5df0d16 100644
--- a/resources/js/Components/History/HistorianList.tsx
+++ b/resources/js/Components/History/HistorianList.tsx
@@ -1,39 +1,67 @@
 import { ReactNode, useState, useEffect, useMemo } from 'react';
 import { router } from '@inertiajs/react';
-import { createPortal } from 'react-dom';
 import {
     CheckCircle2,
     Download,
     Eye,
     Trash2,
     MoreVertical,
     Clock,
     FileText,
     Pencil,
 } from 'lucide-react';
 import ProcessDetailView from './ProcessDetailView';
-import { filterHistories, getHistoryStatus, type HistoryStatus } from './historyHelpers';
+import { compareF0, filterHistories, getHistoryStatus, type HistoryStatus } from './historyHelpers';
+import { calculateF0 } from '@/Pages/Tn/retortTelemetry';
 
 const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
     <section className={`rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl ${className}`}>
         {title && <h3 className="mb-4 text-xl font-extrabold text-slate-900">{title}</h3>}
         {children}
     </section>
 );
 
 export interface HistorianListGroup {
     id: number;
     name: string;
     color: string;
 }
 
+// ponytail: normalisasi PV sama seperti F0Calculator/ProcessDetailView.
+const normalizePv = (l: any): number => {
+    const raw = Number(l?.pv ?? 0);
+    const dp = Number(l?.decimal_point ?? 0);
+    let pv = dp > 0 ? raw / Math.pow(10, dp) : raw;
+    if (pv > 300) pv = pv / 10;
+    return pv;
+};
+
+// ponytail: ringkasan verifikasi card-level, sumber nilai sama seperti ProcessDetailView.
+const getCardVerification = (batch: any, groups: HistorianListGroup[]) => {
+    const status = getHistoryStatus(batch);
+    const temps = (batch.log_data || []).map(normalizePv).filter((pv: number) => pv > 0);
+    const systemF0 = calculateF0(temps, 1);
+    const f0Result = compareF0(systemF0, batch.target_f0 ?? null) ?? '-';
+    return {
+        status,
+        statusLabel: status === 'verified' ? 'VERIFIED' : status === 'running' ? 'Berjalan' : 'UNVERIFIED',
+        product: batch.product ?? '-',
+        batchCode: batch.batch_code ?? '-',
+        groupName: groups.find((g) => g.id === batch.group_id)?.name ?? batch.group_id ?? '-',
+        systemF0,
+        f0Result,
+        verifiedBy: batch.verified_by ?? 'Belum diverifikasi',
+        verifiedAt: batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : 'Belum diverifikasi',
+    };
+};
+
 export default function HistorianList({ histories = [], groups = [] }: { histories?: any[]; groups?: HistorianListGroup[] }) {
     const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
     const [customDate, setCustomDate] = useState<string>('');
     const [selectedBatch, setSelectedBatch] = useState<any>(null);
     const [activeMenu, setActiveMenu] = useState<number | null>(null);
     const [statusFilter, setStatusFilter] = useState<'all' | HistoryStatus>('all');
     const [groupFilter, setGroupFilter] = useState<'all' | number>('all');
     const [query, setQuery] = useState<string>('');
     const [editingGroup, setEditingGroup] = useState<HistorianListGroup | null>(null);
     const [editName, setEditName] = useState<string>('');
@@ -85,23 +113,37 @@ export default function HistorianList({ histories = [], groups = [] }: { histori
             return;
         }
 
         const headers = ['Time', 'PV (C)', 'SV (C)'];
         const rows = logs.map((log: any) => [
             new Date(log.created_at).toLocaleTimeString(),
             formatValue(log.pv, log.decimal_point),
             formatValue(log.sv, log.decimal_point)
         ]);
 
+        const v = getCardVerification(batch, groups);
+
         if (format === 'csv' || format === 'excel') {
+            const summaryLines = [
+                'RINGKASAN VERIFIKASI',
+                `Status,${v.statusLabel}`,
+                `Product,"${v.product}"`,
+                `Batch,"${v.batchCode}"`,
+                `Group,"${v.groupName}"`,
+                `F0 Sistem,${v.systemF0.toFixed(2)} min`,
+                `Hasil F0,${v.f0Result}`,
+                `Diverifikasi Oleh,"${v.verifiedBy}"`,
+                `Diverifikasi Tanggal,"${v.verifiedAt}"`,
+                '',
+            ];
             const csvContent = "data:text/csv;charset=utf-8,"
-                + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
+                + [...summaryLines, headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
             const encodedUri = encodeURI(csvContent);
             const link = document.createElement("a");
             link.setAttribute("href", encodedUri);
             const ext = format === 'excel' ? 'csv' : 'csv';
             link.setAttribute("download", `batch_${batch.id}_log.${ext}`);
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
         } else if (format === 'pdf') {
             const printWindow = window.open('', '_blank');
@@ -115,20 +157,28 @@ export default function HistorianList({ histories = [], groups = [] }: { histori
                             body { font-family: sans-serif; padding: 20px; }
                             table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                             th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                             th { background-color: #f0f0f0; }
                         </style>
                     </head>
                     <body>
                         <h2>${title}</h2>
                         <p>Start Time: ${new Date(batch.start_time).toLocaleString()}</p>
                         <p>End Time: ${new Date(batch.end_time).toLocaleString()}</p>
+                        <p>Status Verifikasi: ${v.statusLabel}</p>
+                        <p>Product: ${v.product}</p>
+                        <p>Batch: ${v.batchCode}</p>
+                        <p>Group: ${v.groupName}</p>
+                        <p>F0 Sistem: ${v.systemF0.toFixed(2)} min</p>
+                        <p>Hasil F0: ${v.f0Result}</p>
+                        <p>Diverifikasi Oleh: ${v.verifiedBy}</p>
+                        <p>Diverifikasi Tanggal: ${v.verifiedAt}</p>
                         <table>
                             <thead>
                                 <tr><th>Time</th><th>PV (&deg;C)</th><th>SV (&deg;C)</th></tr>
                             </thead>
                             <tbody>
                                 ${rows.map((r: any) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
                             </tbody>
                         </table>
                         <script>
                             window.onload = function() { window.print(); window.close(); }
@@ -321,21 +371,21 @@ export default function HistorianList({ histories = [], groups = [] }: { histori
                     </div>
                 ) : (
                     filteredHistories.map((h: any) => {
                         const startTime = new Date(h.start_time);
                         const endTime = h.end_time ? new Date(h.end_time) : null;
                         const durationMinutes = endTime
                             ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
                             : null;
                         const logCount = h.log_data?.length || 0;
                         const logs = h.log_data || [];
-                        const maxPv = logs.length > 0 ? Math.max(...logs.map((l: any) => Number(l.pv ?? 0))) : 0;
+                        const maxPv = logs.length > 0 ? Math.max(...logs.map(normalizePv)) : 0;
                         const machineName = h.controller?.machine?.machine_name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
                         const status = getHistoryStatus(h);
 
                         return (
                             <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                 <div>
                                     <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                         <div className="flex items-center gap-2">
                                             <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                                                 Batch #{h.id}
@@ -445,56 +495,13 @@ export default function HistorianList({ histories = [], groups = [] }: { histori
                                         title="Export CSV"
                                     >
                                         <Download size={14} />
                                     </button>
                                 </div>
                             </div>
                         );
                     })
                 )}
             </div>
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
         </div>
     );
 }
diff --git a/resources/js/Components/History/__tests__/historyHelpers.test.ts b/resources/js/Components/History/__tests__/historyHelpers.test.ts
index f767b83..1afbc37 100644
--- a/resources/js/Components/History/__tests__/historyHelpers.test.ts
+++ b/resources/js/Components/History/__tests__/historyHelpers.test.ts
@@ -6,20 +6,22 @@ describe('historyHelpers', () => {
         expect(getHistoryStatus({ end_time: null })).toBe('running');
         expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z', verification_status: 'verified' })).toBe('verified');
         expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z' })).toBe('unverified');
     });
 
     it('compares F0 strictly without tolerance', () => {
         expect(compareF0(5.21, 4.5)).toBe('VALID');
         expect(compareF0(4.5, 4.5)).toBe('VALID');
         expect(compareF0(4.49, 4.5)).toBe('FAIL');
         expect(compareF0(1.0, null)).toBeNull();
+        expect(compareF0(1.0, NaN)).toBeNull();
+        expect(compareF0(NaN, 1.0)).toBeNull();
     });
 
     it('filters by status, group and query', () => {
         const list = [
             { id: 1, end_time: null, product: 'Rendang', batch_code: 'B-1', group_id: null },
             { id: 2, end_time: '2026-09-26T10:00:00Z', verification_status: 'verified', product: 'Rendang', batch_code: 'B-2', group_id: 1 },
             { id: 3, end_time: '2026-09-26T10:00:00Z', product: 'Kari', batch_code: 'B-3', group_id: 2 },
         ];
         expect(filterHistories(list, { status: 'running', groupId: 'all', query: '' }).map((h) => h.id)).toEqual([1]);
         expect(filterHistories(list, { status: 'all', groupId: 2, query: '' }).map((h) => h.id)).toEqual([3]);
diff --git a/resources/js/Components/History/historyHelpers.ts b/resources/js/Components/History/historyHelpers.ts
index 7552b0c..8babf61 100644
--- a/resources/js/Components/History/historyHelpers.ts
+++ b/resources/js/Components/History/historyHelpers.ts
@@ -1,19 +1,19 @@
 export type HistoryStatus = 'running' | 'unverified' | 'verified';
 
 export function getHistoryStatus(h: { end_time?: string | null; verification_status?: string }): HistoryStatus {
     if (!h.end_time) return 'running';
     return h.verification_status === 'verified' ? 'verified' : 'unverified';
 }
 
 export function compareF0(systemF0: number, targetF0: number | null | undefined): 'VALID' | 'FAIL' | null {
-    if (targetF0 === null || targetF0 === undefined || Number.isNaN(systemF0)) return null;
+    if (targetF0 === null || targetF0 === undefined || Number.isNaN(targetF0) || Number.isNaN(systemF0)) return null;
     return systemF0 < targetF0 ? 'FAIL' : 'VALID';
 }
 
 export interface HistoryFilter {
     status: 'all' | HistoryStatus;
     groupId: 'all' | number;
     query: string;
 }
 
 export function filterHistories<T extends { end_time?: string | null; verification_status?: string; group_id?: number | null; product?: string | null; batch_code?: string | null }>(list: T[], f: HistoryFilter): T[] {
diff --git a/tests/Feature/HistoryVerificationTest.php b/tests/Feature/HistoryVerificationTest.php
index bb585c5..fed0c3c 100644
--- a/tests/Feature/HistoryVerificationTest.php
+++ b/tests/Feature/HistoryVerificationTest.php
@@ -64,20 +64,33 @@ public function test_verify_finished_history(): void
         $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload());
 
         $res->assertOk()->assertJson(['success' => true, 'system_f0' => 1.0]);
         $this->assertDatabaseHas('tn_process_histories', [
             'id' => $history->id,
             'verification_status' => 'verified',
             'verified_by' => 'Operator 1',
         ]);
     }
 
+    public function test_verify_as_guest_defaults_verified_by_operator(): void
+    {
+        $history = $this->makeHistory();
+
+        $res = $this->postJson(route('tn.history.verify', $history), $this->payload(['batch_code' => '20260926-99']));
+
+        $res->assertOk()->assertJson(['success' => true]);
+        $this->assertDatabaseHas('tn_process_histories', [
+            'id' => $history->id,
+            'verified_by' => 'Operator',
+        ]);
+    }
+
     public function test_system_f0_below_target_forces_fail(): void
     {
         $user = User::factory()->create();
         $history = $this->makeHistory();
 
         $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload([
             'batch_code' => '20260926-02',
             'target_f0' => 99.0,
         ]));
 
