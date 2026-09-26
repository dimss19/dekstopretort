import { ReactNode, useState, useEffect, useMemo } from 'react';
import { router } from '@inertiajs/react';
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
import { compareF0, filterHistories, getHistoryStatus, type HistoryStatus } from './historyHelpers';
import { calculateF0 } from '@/Pages/Tn/retortTelemetry';

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

// ponytail: normalisasi PV sama seperti F0Calculator/ProcessDetailView.
const normalizePv = (l: any): number => {
    const raw = Number(l?.pv ?? 0);
    const dp = Number(l?.decimal_point ?? 0);
    let pv = dp > 0 ? raw / Math.pow(10, dp) : raw;
    if (pv > 300) pv = pv / 10;
    return pv;
};

// ponytail: ringkasan verifikasi card-level, sumber nilai sama seperti ProcessDetailView.
const getCardVerification = (batch: any, groups: HistorianListGroup[]) => {
    const status = getHistoryStatus(batch);
    const temps = (batch.log_data || []).map(normalizePv).filter((pv: number) => pv > 0);
    const systemF0 = calculateF0(temps, 1);
    const f0Result = compareF0(systemF0, batch.target_f0 ?? null) ?? '-';
    return {
        status,
        statusLabel: status === 'verified' ? 'VERIFIED' : status === 'running' ? 'Berjalan' : 'UNVERIFIED',
        product: batch.product ?? '-',
        batchCode: batch.batch_code ?? '-',
        groupName: groups.find((g) => g.id === batch.group_id)?.name ?? batch.group_id ?? '-',
        systemF0,
        f0Result,
        verifiedBy: batch.verified_by ?? 'Belum diverifikasi',
        verifiedAt: batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : 'Belum diverifikasi',
    };
};

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
    const [editColor, setEditColor] = useState<string>('#a3a3a3');

    const filteredHistories = useMemo(() => {
        const byPeriod = histories.filter((h) => {
            const startTime = new Date(h.start_time).getTime();
            if (isNaN(startTime)) return true;

            if (customDate) {
                const targetDateStr = new Date(customDate).toDateString();
                const itemDateStr = new Date(h.start_time).toDateString();
                return targetDateStr === itemDateStr;
            }

            const now = Date.now();
            if (period === 'Hari') {
                const oneDayAgo = now - 24 * 60 * 60 * 1000;
                return startTime >= oneDayAgo;
            } else if (period === 'Minggu') {
                const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
                return startTime >= oneWeekAgo;
            } else if (period === 'Bulan') {
                const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
                return startTime >= oneMonthAgo;
            }

            return true;
        });
        return filterHistories(byPeriod, { status: statusFilter, groupId: groupFilter, query });
    }, [histories, period, customDate, statusFilter, groupFilter, query]);

    const formatValue = (val: number | undefined, dp: number = 0) => {
        if (val === undefined || val === 31000 || val === 30000 || val === -30000) return '-';
        return (val / Math.pow(10, dp)).toFixed(dp).replace('.', ',');
    };

    const getChronologicalLogs = (batch: any) => {
        return [...(batch.log_data || [])].sort((a: any, b: any) => {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
    };

    const handleDownload = (batch: any, format: 'csv' | 'excel' | 'pdf') => {
        const logs = getChronologicalLogs(batch);
        if (!logs.length) {
            alert('Tidak ada data point pada batch ini.');
            return;
        }

        const headers = ['Time', 'PV (C)', 'SV (C)'];
        const rows = logs.map((log: any) => [
            new Date(log.created_at).toLocaleTimeString(),
            formatValue(log.pv, log.decimal_point),
            formatValue(log.sv, log.decimal_point)
        ]);

        const v = getCardVerification(batch, groups);

        if (format === 'csv' || format === 'excel') {
            const summaryLines = [
                'RINGKASAN VERIFIKASI',
                `Status,${v.statusLabel}`,
                `Product,"${v.product}"`,
                `Batch,"${v.batchCode}"`,
                `Group,"${v.groupName}"`,
                `F0 Sistem,${v.systemF0.toFixed(2)} min`,
                `Hasil F0,${v.f0Result}`,
                `Diverifikasi Oleh,"${v.verifiedBy}"`,
                `Diverifikasi Tanggal,"${v.verifiedAt}"`,
                '',
            ];
            const csvContent = "data:text/csv;charset=utf-8,"
                + [...summaryLines, headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
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
            if (printWindow) {
                const title = `Batch Log Report: ${batch.controller?.machine?.machine_name || batch.controller?.model_type || 'Controller'}`;
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>${title}</title>
                        <style>
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
                        <p>Status Verifikasi: ${v.statusLabel}</p>
                        <p>Product: ${v.product}</p>
                        <p>Batch: ${v.batchCode}</p>
                        <p>Group: ${v.groupName}</p>
                        <p>F0 Sistem: ${v.systemF0.toFixed(2)} min</p>
                        <p>Hasil F0: ${v.f0Result}</p>
                        <p>Diverifikasi Oleh: ${v.verifiedBy}</p>
                        <p>Diverifikasi Tanggal: ${v.verifiedAt}</p>
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
                        </script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus riwayat proses ini?')) {
            router.delete(route('tn.history.destroy', id));
        }
    };

    const openGroupEditor = (g: HistorianListGroup) => {
        setEditingGroup(g);
        setEditName(g.name);
        setEditColor(g.color);
    };

    const saveGroupRename = () => {
        if (!editingGroup) return;
        router.put(route('tn.history-groups.update', editingGroup.id), { name: editName, color: editColor }, {
            onSuccess: () => setEditingGroup(null),
        });
    };

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
                groups={groups}
            />
        );
    }

    return (
        <div className="space-y-6">
            <Panel>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Filter Periode</label>
                        <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
                            {['Semua', 'Hari', 'Minggu', 'Bulan'].map((x) => (
                                <button
                                    key={x}
                                    onClick={() => { setPeriod(x as any); setCustomDate(''); }}
                                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                        period === x && !customDate
                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {x}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div>
                            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">Tanggal Kustom</label>
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="rounded-xl border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600 py-2 px-3"
                            />
                        </div>
                        {customDate && (
                            <button
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
            <Panel>
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari product / batch..."
                        className="min-w-52 flex-1 rounded-xl border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                    />
                    <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
                        {(['all', 'verified', 'unverified', 'running'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                    statusFilter === s
                                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {s === 'all' ? 'Semua' : s === 'verified' ? 'Verified' : s === 'unverified' ? 'Unverified' : 'Berjalan'}
                            </button>
                        ))}
                    </div>
                </div>
                {groups.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setGroupFilter('all')}
                            className={`rounded-full border px-3 py-1 text-xs font-black transition-all ${
                                groupFilter === 'all'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            Semua
                        </button>
                        {groups.map((g) => (
                            <span
                                key={g.id}
                                className={`inline-flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-xs font-black transition-all ${
                                    groupFilter === g.id
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <button onClick={() => setGroupFilter(groupFilter === g.id ? 'all' : g.id)} className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                                    {g.name}
                                </button>
                                <button
                                    title={`Rename ${g.name}`}
                                    onClick={() => openGroupEditor(g)}
                                    className="rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                                >
                                    <Pencil size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                {editingGroup && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <input
                            type="text"
                            value={editName}
                            maxLength={50}
                            onChange={(e) => setEditName(e.target.value)}
                            className="min-w-40 flex-1 rounded-xl border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                        />
                        <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                        />
                        <button
                            onClick={saveGroupRename}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700 transition-colors"
                        >
                            Simpan
                        </button>
                        <button
                            onClick={() => setEditingGroup(null)}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            Batal
                        </button>
                    </div>
                )}
            </Panel>

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
                        const maxPv = logs.length > 0 ? Math.max(...logs.map(normalizePv)) : 0;
                        const machineName = h.controller?.machine?.machine_name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
                        const status = getHistoryStatus(h);

                        return (
                            <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                                                Batch #{h.id}
                                            </span>
                                            {status === 'running' ? (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
                                                    Proses Berjalan
                                                </span>
                                            ) : status === 'verified' ? (
                                                <span
                                                    title={`by ${h.verified_by ?? '-'} · ${h.verified_at ? new Date(h.verified_at).toLocaleString('id-ID') : '-'}`}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                                                >
                                                    <CheckCircle2 size={12} /> VERIFIED
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                                                    UNVERIFIED
                                                </span>
                                            )}
                                        </div>

                                        {/* Action Dropdown */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === h.id ? null : h.id); }}
                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {activeMenu === h.id && (
                                                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 animate-in fade-in">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedBatch(h); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                                                    >
                                                        <Eye size={14} className="text-blue-600" /> Lihat Detail Log
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleDownload(h, 'csv'); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                                                    >
                                                        <Download size={14} className="text-emerald-600" /> Export CSV
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleDownload(h, 'pdf'); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                                                    >
                                                        <FileText size={14} className="text-amber-600" /> Cetak PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleDelete(h.id); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left border-t border-slate-100 mt-1"
                                                    >
                                                        <Trash2 size={14} /> Hapus Log
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <span>Mesin / Controller:</span>
                                            <span className="font-bold text-slate-900">{machineName}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <span>Waktu Mulai:</span>
                                            <span className="font-mono text-slate-900 font-bold">{startTime.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <span>Waktu Selesai:</span>
                                            <span className="font-mono text-slate-900 font-bold">{endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <span>Durasi:</span>
                                            <span className="font-mono text-blue-700 font-bold">{durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <span>Suhu Puncak (Max PV):</span>
                                            <span className="font-mono text-rose-600 font-bold">{maxPv > 0 ? `${maxPv.toFixed(1)} °C` : '--'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <span>Data Points:</span>
                                            <span className="font-mono text-slate-700 font-bold">{logCount} points</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBatch(h)}
                                        className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black py-2.5 px-3 transition-colors text-center"
                                    >
                                        Lihat Detail
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(h, 'csv')}
                                        className="rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 p-2.5 transition-colors"
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
        </div>
    );
}
