9100cb1 feat: badge verifikasi + filter status + chip group rename
 resources/js/Components/History/HistorianList.tsx | 144 ++++++++++++++++++++--
 resources/js/Pages/Operations.tsx                 |   6 +-
 routes/web.php                                    |   3 +-
 3 files changed, 141 insertions(+), 12 deletions(-)
diff --git a/resources/js/Components/History/HistorianList.tsx b/resources/js/Components/History/HistorianList.tsx
index 4555911..707e6d8 100644
--- a/resources/js/Components/History/HistorianList.tsx
+++ b/resources/js/Components/History/HistorianList.tsx
@@ -2,38 +2,52 @@ import { ReactNode, useState, useEffect, useMemo } from 'react';
 import { router } from '@inertiajs/react';
 import { createPortal } from 'react-dom';
 import {
     CheckCircle2,
     Download,
     Eye,
     Trash2,
     MoreVertical,
     Clock,
     FileText,
+    Pencil,
 } from 'lucide-react';
 import ProcessDetailView from './ProcessDetailView';
+import { filterHistories, getHistoryStatus, type HistoryStatus } from './historyHelpers';
 
 const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
     <section className={`rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl ${className}`}>
         {title && <h3 className="mb-4 text-xl font-extrabold text-slate-900">{title}</h3>}
         {children}
     </section>
 );
 
-export default function HistorianList({ histories = [] }: { histories?: any[] }) {
+export interface HistorianListGroup {
+    id: number;
+    name: string;
+    color: string;
+}
+
+export default function HistorianList({ histories = [], groups = [] }: { histories?: any[]; groups?: HistorianListGroup[] }) {
     const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
     const [customDate, setCustomDate] = useState<string>('');
     const [selectedBatch, setSelectedBatch] = useState<any>(null);
     const [activeMenu, setActiveMenu] = useState<number | null>(null);
+    const [statusFilter, setStatusFilter] = useState<'all' | HistoryStatus>('all');
+    const [groupFilter, setGroupFilter] = useState<'all' | number>('all');
+    const [query, setQuery] = useState<string>('');
+    const [editingGroup, setEditingGroup] = useState<HistorianListGroup | null>(null);
+    const [editName, setEditName] = useState<string>('');
+    const [editColor, setEditColor] = useState<string>('#a3a3a3');
 
     const filteredHistories = useMemo(() => {
-        return histories.filter((h) => {
+        const byPeriod = histories.filter((h) => {
             const startTime = new Date(h.start_time).getTime();
             if (isNaN(startTime)) return true;
 
             if (customDate) {
                 const targetDateStr = new Date(customDate).toDateString();
                 const itemDateStr = new Date(h.start_time).toDateString();
                 return targetDateStr === itemDateStr;
             }
 
             const now = Date.now();
@@ -43,21 +57,22 @@ export default function HistorianList({ histories = [] }: { histories?: any[] })
             } else if (period === 'Minggu') {
                 const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
                 return startTime >= oneWeekAgo;
             } else if (period === 'Bulan') {
                 const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
                 return startTime >= oneMonthAgo;
             }
 
             return true;
         });
-    }, [histories, period, customDate]);
+        return filterHistories(byPeriod, { status: statusFilter, groupId: groupFilter, query });
+    }, [histories, period, customDate, statusFilter, groupFilter, query]);
 
     const formatValue = (val: number | undefined, dp: number = 0) => {
         if (val === undefined || val === 31000 || val === 30000 || val === -30000) return '-';
         return (val / Math.pow(10, dp)).toFixed(dp).replace('.', ',');
     };
 
     const getChronologicalLogs = (batch: any) => {
         return [...(batch.log_data || [])].sort((a: any, b: any) => {
             return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
         });
@@ -125,31 +140,45 @@ export default function HistorianList({ histories = [] }: { histories?: any[] })
             }
         }
     };
 
     const handleDelete = (id: number) => {
         if (confirm('Apakah Anda yakin ingin menghapus riwayat proses ini?')) {
             router.delete(route('tn.history.destroy', id));
         }
     };
 
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
     useEffect(() => {
         const closeMenu = () => setActiveMenu(null);
         window.addEventListener('click', closeMenu);
         return () => window.removeEventListener('click', closeMenu);
     }, []);
 
     if (selectedBatch) {
         return (
             <ProcessDetailView
                 batch={selectedBatch}
                 onBack={() => setSelectedBatch(null)}
+                groups={groups}
             />
         );
     }
 
     return (
         <div className="space-y-6">
             <Panel>
                 <div className="flex flex-wrap items-end justify-between gap-4">
                     <div>
                         <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Filter Periode</label>
@@ -184,56 +213,155 @@ export default function HistorianList({ histories = [] }: { histories?: any[] })
                                 type="button"
                                 onClick={() => setCustomDate('')}
                                 className="mt-6 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                             >
                                 Reset
                             </button>
                         )}
                     </div>
                 </div>
             </Panel>
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
 
             {/* Batch Cards Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredHistories.length === 0 ? (
                     <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-white/95 rounded-3xl border border-slate-200 shadow-sm">
                         <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                         Tidak ada riwayat proses yang cocok dengan filter.
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
                         const maxPv = logs.length > 0 ? Math.max(...logs.map((l: any) => Number(l.pv ?? 0))) : 0;
                         const machineName = h.controller?.machine?.machine_name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
+                        const status = getHistoryStatus(h);
 
                         return (
                             <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                 <div>
                                     <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                         <div className="flex items-center gap-2">
                                             <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                                                 Batch #{h.id}
                                             </span>
-                                            {h.end_time ? (
-                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
-                                                    <CheckCircle2 size={12} /> Selesai
-                                                </span>
-                                            ) : (
+                                            {status === 'running' ? (
                                                 <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
                                                     Proses Berjalan
                                                 </span>
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
                                             )}
                                         </div>
 
                                         {/* Action Dropdown */}
                                         <div className="relative">
                                             <button
                                                 type="button"
                                                 onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === h.id ? null : h.id); }}
                                                 className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                             >
diff --git a/resources/js/Pages/Operations.tsx b/resources/js/Pages/Operations.tsx
index 5be1815..dff4d2c 100644
--- a/resources/js/Pages/Operations.tsx
+++ b/resources/js/Pages/Operations.tsx
@@ -11,21 +11,21 @@ import {
     Snowflake,
     ArrowDown,
     Database as DatabaseIcon,
     CheckCircle,
     AlertTriangle,
     XCircle,
 } from 'lucide-react';
 import HistorianList from '@/Components/History/HistorianList';
 
 type Module = 'scada' | 'historian' | 'alarm' | 'notifications' | 'database';
-type Props = { module: Module; histories?: any[] };
+type Props = { module: Module; histories?: any[]; groups?: { id: number; name: string; color: string }[] };
 
 type FlowItem = {
     icon: ReactNode;
     label: string;
     value: string;
 };
 
 type BadgeTone = 'green' | 'amber' | 'red' | 'blue';
 
 const Badge = ({ children, tone = 'green' }: { children: ReactNode; tone?: BadgeTone }) => {
@@ -173,23 +173,23 @@ function DatabasePanel() {
 }
 
 const titles: Record<Module, [string, string]> = {
     scada: ['SCADA Process POV', 'Pantau dan konfigurasi proses SCADA secara visual'],
     historian: ['Riwayat Proses & Data Log', 'Kelola, analisis, dan ekspor log data proses sterilisasi controller retort'],
     alarm: ['Manajemen Alarm & Event', 'Pantau riwayat alarm aktif dan kejadian sistem'],
     notifications: ['Kanal Notifikasi Alarm', 'Konfigurasi integrasi saluran pemberitahuan alarm'],
     database: ['Struktur Database SCADA', 'Daftar tabel operasional dan skema data sistem'],
 };
 
-export default function Operations({ module, histories }: Props) {
+export default function Operations({ module, histories, groups }: Props) {
     const [title, subtitle] = titles[module];
-    const content = { scada: <Scada />, historian: <HistorianList histories={histories} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];
+    const content = { scada: <Scada />, historian: <HistorianList histories={histories} groups={groups} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];
 
     return (
         <AuthenticatedLayout header={
             <div className="max-w-7xl mx-auto py-1">
                 <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
                 <p className="text-xs font-semibold text-slate-500 mt-0.5">{subtitle}</p>
             </div>
         }>
             <Head title={title} />
             <div className="space-y-5 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{content}</div>
diff --git a/routes/web.php b/routes/web.php
index d7fac37..0b52d05 100644
--- a/routes/web.php
+++ b/routes/web.php
@@ -26,21 +26,22 @@
     $lock = \Illuminate\Support\Facades\Cache::lock('modbus_port_' . md5('COM6'), 5);
     $acquired = $lock->block(3);
     if ($acquired) $lock->release();
     return response()->json(['acquired' => $acquired, 'driver' => config('cache.default')]);
 });
 
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
 
     Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
     Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
     Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
 
     Route::resource('devices', \App\Http\Controllers\ControllerDeviceController::class)->except('show');
