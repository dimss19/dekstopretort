4a74f1c refactor: ekstrak HistorianList + historyHelpers teruji
a868f6c fix: disable Pusher/Reverb websocket in desktop app and set strictly 1s polling interval
100b780 fix: disable unused reverb broadcasting in desktop app to eliminate curl 8080 errors
50ed4f1 fix: calculateF0 Tref 121.1 metode 1-titik + test
841de0a feat: run tn poll in desktop app, replace realtime badge with accurate online/offline indicator
5cf5491 feat: endpoint verify history + rename group + feature test
 app/Console/Commands/PollTnControllers.php         |  19 +-
 app/Http/Controllers/TnMonitorController.php       |  40 ---
 nativephp/electron/out/main/index.js               |   8 +-
 resources/js/Components/History/HistorianList.tsx  | 372 +++++++++++++++++++++
 .../History/__tests__/historyHelpers.test.ts       |  28 ++
 resources/js/Components/History/historyHelpers.ts  |  27 ++
 resources/js/Pages/Operations.tsx                  | 368 +-------------------
 resources/js/Pages/Tn/Monitor.tsx                  |   4 +-
 resources/js/bootstrap.ts                          |   6 +-
 9 files changed, 443 insertions(+), 429 deletions(-)
diff --git a/app/Console/Commands/PollTnControllers.php b/app/Console/Commands/PollTnControllers.php
index 39416aa..4c63013 100644
--- a/app/Console/Commands/PollTnControllers.php
+++ b/app/Console/Commands/PollTnControllers.php
@@ -112,39 +112,26 @@ public function handle(TnModbusService $modbus)
                             \Illuminate\Support\Facades\Cache::forget($cacheKey);
                         }
 
                         $wasOnline = $controller->is_online;
                         $controller->update([
                             'is_online' => true,
                             'last_seen_at' => Carbon::now(),
                             'last_error' => null,
                         ]);
 
-                        static $isReverbAlive = null;
-                        static $lastReverbCheck = 0;
-
-                        if (time() - $lastReverbCheck > 5) {
-                            $lastReverbCheck = time();
-                            $fp = @fsockopen('127.0.0.1', 8080, $errno, $errstr, 0.02);
-                            if ($fp) {
-                                $isReverbAlive = true;
-                                fclose($fp);
-                            } else {
-                                $isReverbAlive = false;
-                            }
-                        }
-
-                        if ($isReverbAlive) {
+                        // Broadcasting is disabled in desktop polling to prevent 2-second cURL timeouts
+                        if (env('ENABLE_REVERB_BROADCAST', false)) {
                             try {
                                 event(new TnDataReceived($controller, $reading));
                             } catch (\Throwable $e) {
-                                $isReverbAlive = false;
+                                // Silent fail
                             }
                         }
 
                         if (!$wasOnline) {
                             $this->info("Controller {$controller->name} (slave {$slaveId}) is now online.");
                         }
                     } else {
                         $wasOnline = $controller->is_online;
                         $controller->update([
                             'is_online' => false,
diff --git a/app/Http/Controllers/TnMonitorController.php b/app/Http/Controllers/TnMonitorController.php
index 61e5695..54b49ea 100644
--- a/app/Http/Controllers/TnMonitorController.php
+++ b/app/Http/Controllers/TnMonitorController.php
@@ -154,60 +154,20 @@ public function setMode(TnController $tn, TnModbusService $modbus)
             return response()->json(['success' => true, 'message' => $msg]);
         }
         return back()->with('success', $msg);
     }
 
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
         $request->validate([
             'log_data' => 'required|array',
         ]);
 
         $logs = $request->log_data;
diff --git a/nativephp/electron/out/main/index.js b/nativephp/electron/out/main/index.js
index 12d1a31..8a84363 100644
--- a/nativephp/electron/out/main/index.js
+++ b/nativephp/electron/out/main/index.js
@@ -2792,21 +2792,21 @@ var __awaiter = function(thisArg, _arguments, P, generator) {
         reject(e);
       }
     }
     function step(result) {
       result.done ? resolve2(result.value) : adopt(result.value).then(fulfilled, rejected);
     }
     step((generator = generator.apply(thisArg, [])).next());
   });
 };
 const { autoUpdater } = electronUpdater;
-let NativePHP$1 = class NativePHP {
+class NativePHP {
   constructor() {
     this.processes = [];
     this.mainWindow = null;
     this.schedulerInterval = void 0;
     this.quitting = false;
   }
   bootstrap(app2, icon, phpBinary2, cert, appPath2) {
     initialize();
     state.icon = icon;
     state.php = phpBinary2;
@@ -3007,22 +3007,22 @@ let NativePHP$1 = class NativePHP {
       if (process2.killed && process2.exitCode !== null)
         return;
       try {
         killSync(process2.pid, "SIGTERM", true);
         ps.kill(process2.pid);
       } catch (err) {
         console.error(err);
       }
     });
   }
-};
-const NativePHP2 = new NativePHP$1();
+}
+const NativePHP$1 = new NativePHP();
 function getLaravelBaseDir(appPath2, importMetaDirname) {
   if (app.isPackaged) {
     return appPath2;
   }
   let currentPath = importMetaDirname;
   for (let i = 0; i < 10; i++) {
     if (fs.existsSync(path.join(currentPath, ".env"))) {
       return currentPath;
     }
     const parentPath = path.join(currentPath, "..");
@@ -3095,21 +3095,21 @@ const certificate = path.join(buildPath, "cacert.pem");
 const executable = process.platform === "win32" ? "php.exe" : "php";
 const phpBinary = path.join(buildPath, "php", executable);
 const appPath = app.isPackaged ? path.join(buildPath, "app") : appRoot;
 let splashWindow;
 app.whenReady().then(() => {
   try {
     splashWindow = createSplash(appPath, import.meta.dirname);
   } catch (error) {
     console.error("Error creating splash screen:", error);
   }
-  NativePHP2.bootstrap(app, defaultIcon, phpBinary, certificate, appPath);
+  NativePHP$1.bootstrap(app, defaultIcon, phpBinary, certificate, appPath);
 });
 app.on("browser-window-created", (event, window) => {
   if (splashWindow && window !== splashWindow) {
     window.webContents.on("did-navigate", (evt, url2) => {
       if (url2.startsWith("http://127.0.0.1") || url2.startsWith("http://localhost")) {
         if (splashWindow) {
           splashWindow.close();
           splashWindow = null;
         }
       }
diff --git a/resources/js/Components/History/HistorianList.tsx b/resources/js/Components/History/HistorianList.tsx
new file mode 100644
index 0000000..4555911
--- /dev/null
+++ b/resources/js/Components/History/HistorianList.tsx
@@ -0,0 +1,372 @@
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
+} from 'lucide-react';
+import ProcessDetailView from './ProcessDetailView';
+
+const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
+    <section className={`rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl ${className}`}>
+        {title && <h3 className="mb-4 text-xl font-extrabold text-slate-900">{title}</h3>}
+        {children}
+    </section>
+);
+
+export default function HistorianList({ histories = [] }: { histories?: any[] }) {
+    const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
+    const [customDate, setCustomDate] = useState<string>('');
+    const [selectedBatch, setSelectedBatch] = useState<any>(null);
+    const [activeMenu, setActiveMenu] = useState<number | null>(null);
+
+    const filteredHistories = useMemo(() => {
+        return histories.filter((h) => {
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
+    }, [histories, period, customDate]);
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
+
+                        return (
+                            <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
+                                <div>
+                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
+                                        <div className="flex items-center gap-2">
+                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
+                                                Batch #{h.id}
+                                            </span>
+                                            {h.end_time ? (
+                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
+                                                    <CheckCircle2 size={12} /> Selesai
+                                                </span>
+                                            ) : (
+                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
+                                                    Proses Berjalan
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
diff --git a/resources/js/Pages/Operations.tsx b/resources/js/Pages/Operations.tsx
index 818218d..5be1815 100644
--- a/resources/js/Pages/Operations.tsx
+++ b/resources/js/Pages/Operations.tsx
@@ -1,36 +1,28 @@
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
     Wrench,
     Factory,
     Snowflake,
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
 type Props = { module: Module; histories?: any[] };
 
 type FlowItem = {
     icon: ReactNode;
     label: string;
     value: string;
 };
 
@@ -92,372 +84,20 @@ const Scada = () => {
                             </div>
                             {index < flow.length - 1 && <div className="relative h-7"><ArrowDown size={16} className="absolute left-[-8px] top-3 text-cyan-500 rotate-90" /></div>}
                         </div>
                     ))}
                 </div>
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
     ];
 
     return (
         <>
             <div className="grid gap-4 md:grid-cols-3">
@@ -535,21 +175,21 @@ function DatabasePanel() {
 const titles: Record<Module, [string, string]> = {
     scada: ['SCADA Process POV', 'Pantau dan konfigurasi proses SCADA secara visual'],
     historian: ['Riwayat Proses & Data Log', 'Kelola, analisis, dan ekspor log data proses sterilisasi controller retort'],
     alarm: ['Manajemen Alarm & Event', 'Pantau riwayat alarm aktif dan kejadian sistem'],
     notifications: ['Kanal Notifikasi Alarm', 'Konfigurasi integrasi saluran pemberitahuan alarm'],
     database: ['Struktur Database SCADA', 'Daftar tabel operasional dan skema data sistem'],
 };
 
 export default function Operations({ module, histories }: Props) {
     const [title, subtitle] = titles[module];
-    const content = { scada: <Scada />, historian: <Historian histories={histories} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];
+    const content = { scada: <Scada />, historian: <HistorianList histories={histories} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];
 
     return (
         <AuthenticatedLayout header={
             <div className="max-w-7xl mx-auto py-1">
                 <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
                 <p className="text-xs font-semibold text-slate-500 mt-0.5">{subtitle}</p>
             </div>
         }>
             <Head title={title} />
             <div className="space-y-5 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{content}</div>
diff --git a/resources/js/Pages/Tn/Monitor.tsx b/resources/js/Pages/Tn/Monitor.tsx
index 84ef1d8..beae623 100644
--- a/resources/js/Pages/Tn/Monitor.tsx
+++ b/resources/js/Pages/Tn/Monitor.tsx
@@ -16,22 +16,22 @@ interface Props extends PageProps {
         machine?: { machine_name: string };
         scada_canvas?: ScadaCanvasType | null;
         scada_mappings?: ScadaMapping[];
     };
     latestReading: any;
 }
 
 type MonitorTab = 'monitor' | 'scada';
 
 export default function Monitor({ controller, latestReading: initialReading }: Props) {
-    const pollIntervalMs = Math.max(1000, controller.polling_interval ?? 1000);
-    const staleAfterMs = Math.max(5000, pollIntervalMs * 3);
+    const pollIntervalMs = 1000; // Pembacaan Modbus per 1 detik
+    const staleAfterMs = 4000;   // Toleransi 4 detik sebelum dianggap offline
     const getReadingTimestamp = (value: any) => value?.created_at ?? value?.timestamp ?? null;
     const timestampToMs = (timestamp: any): number | false => {
         if (!timestamp) return false;
         const time = new Date(timestamp).getTime();
         return Number.isFinite(time) ? time : false;
     };
     const isFreshTimestamp = (timestamp: any) => {
         const time = timestampToMs(timestamp);
         return time !== false && Date.now() - time <= staleAfterMs;
     };
diff --git a/resources/js/bootstrap.ts b/resources/js/bootstrap.ts
index 1da5a96..c818f22 100644
--- a/resources/js/bootstrap.ts
+++ b/resources/js/bootstrap.ts
@@ -2,23 +2,23 @@ import axios from 'axios';
 
 window.axios = axios;
 
 window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
 
 import Echo from 'laravel-echo';
 import Pusher from 'pusher-js';
 
 const reverbAppKey = import.meta.env.VITE_REVERB_APP_KEY?.trim();
 
-// Realtime is optional. Instantiating Echo without a key makes Pusher throw
-// during application startup and prevents the rest of the UI from loading.
-if (reverbAppKey) {
+// Realtime WebSockets are disabled in desktop app to prevent connection retries to localhost:8080.
+// Desktop app uses direct, high-performance HTTP polling at 1-second intervals.
+if (reverbAppKey && import.meta.env.VITE_REVERB_ENABLED === 'true') {
     (window as any).Pusher = Pusher;
 
     (window as any).Echo = new Echo({
         broadcaster: 'reverb',
         key: reverbAppKey,
         wsHost: import.meta.env.VITE_REVERB_HOST,
         wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
         wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
         forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
         enabledTransports: ['ws', 'wss'],
