b9f7030 feat: F0 otomatis + VALID/FAIL + form verifikasi inline
 .../js/Components/History/ProcessDetailView.tsx    | 195 ++++++++++++++++++++-
 1 file changed, 193 insertions(+), 2 deletions(-)
diff --git a/resources/js/Components/History/ProcessDetailView.tsx b/resources/js/Components/History/ProcessDetailView.tsx
index 6d839d5..fdd9819 100644
--- a/resources/js/Components/History/ProcessDetailView.tsx
+++ b/resources/js/Components/History/ProcessDetailView.tsx
@@ -1,44 +1,59 @@
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
         };
     };
 }
 
 interface Props {
     batch: ProcessBatchItem;
     onBack: () => void;
-    groups?: { id: number; name: string; color: string }[]; // ponytail: diterima & diabaikan dulu, dipakai penuh Task 7
+    groups?: { id: number; name: string; color: string }[];
 }
 
-export default function ProcessDetailView({ batch, onBack }: Props) {
+export default function ProcessDetailView({ batch, onBack, groups = [] }: Props) {
     const [tablePage, setTablePage] = useState<number>(1);
     const [pageSize, setPageSize] = useState<number>(50);
     const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
 
     useEffect(() => {
         const closeMenu = () => setShowDownloadMenu(false);
         window.addEventListener('click', closeMenu);
         return () => window.removeEventListener('click', closeMenu);
     }, []);
 
@@ -368,20 +383,77 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
                 sumPv += pv;
                 validPvCount++;
             }
         });
 
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
 
         const chartDataUrl = generateThermalChartDataUrl();
 
         const rows = logs.map((l, idx) => {
             const rawPv = Number(l.pv ?? l.actual ?? 0);
             const dp = Number(l.decimal_point ?? 0);
@@ -948,24 +1020,143 @@ export default function ProcessDetailView({ batch, onBack }: Props) {
                                 </span>
                             ) : (
                                 <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700 animate-pulse">
                                     Sedang Berjalan
                                 </span>
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
+                            <select value={deviation} onChange={(e) => setDeviation(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
+                                <option value="None">None</option>
+                                <option value="Minor">Minor</option>
+                                <option value="Major">Major</option>
+                            </select>
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Sterility criterion
+                            <select value={effectiveCriterion} disabled={liveFail} onChange={(e) => setCriterion(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3 disabled:opacity-60">
+                                <option value="PASS">PASS</option>
+                                <option value="FAIL">FAIL</option>
+                            </select>
+                        </label>
+                        <label className="block text-xs font-bold text-slate-700">
+                            Thermal record
+                            <select value={thermal} onChange={(e) => setThermal(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
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
                             <h2 className="font-extrabold text-slate-900 text-xl tracking-tight">
                                 Profil Termal Sterilisasi Retort
                             </h2>
                             <span className="bg-blue-100 text-blue-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-200">
                                 Thermal Profile
