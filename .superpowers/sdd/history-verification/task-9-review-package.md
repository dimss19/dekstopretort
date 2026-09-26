1a74ab8 refactor: history ESP pakai HistorianList bersama
 app/Http/Controllers/EspMonitorController.php |   1 +
 resources/js/Pages/Esp/Monitor.tsx            | 310 +-------------------------
 2 files changed, 10 insertions(+), 301 deletions(-)
diff --git a/app/Http/Controllers/EspMonitorController.php b/app/Http/Controllers/EspMonitorController.php
index 0eb050a..70c6f96 100644
--- a/app/Http/Controllers/EspMonitorController.php
+++ b/app/Http/Controllers/EspMonitorController.php
@@ -63,20 +63,21 @@ public function index(Request $request)
         }
 
         return Inertia::render('Esp/Monitor', [
             'device' => $device,
             'devices' => $devices,
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
      * Save Pattern steps and sync to ESP32 via MQTT.
      */
     public function savePattern(Request $request, MqttService $mqttService)
     {
         $validated = $request->validate([
diff --git a/resources/js/Pages/Esp/Monitor.tsx b/resources/js/Pages/Esp/Monitor.tsx
index b82c992..afc3f5d 100644
--- a/resources/js/Pages/Esp/Monitor.tsx
+++ b/resources/js/Pages/Esp/Monitor.tsx
@@ -1,20 +1,20 @@
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
     firmware_version?: string;
     mqtt_broker?: string;
     mqtt_port?: number;
     is_online?: boolean;
 }
@@ -26,46 +26,42 @@ interface Props {
     history: any[];
     isOnline: boolean;
     systemEvent?: {
         event?: string;
         reason?: string;
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
     initialTelemetry,
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
         setIsOnline(true);
         setTelemetry(data);
 
         // Add to history for chart & logs
         const historyEntry = {
@@ -193,140 +189,49 @@ export default function EspMonitor({
         return history
             .filter((item) => Number(item.heating_mv ?? item.mv ?? 0) > 0 || Number(item.pv ?? 0) > 40)
             .slice(-100)
             .reverse();
     }, [history]);
 
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
                     >
                         History
                     </button>
                 </div>
             }
@@ -491,215 +396,18 @@ export default function EspMonitor({
                                 </div>
                             </section>
                         </div>
                     ) : activeTab === 'pattern' ? (
                         <EspPatternEditor
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
 }
