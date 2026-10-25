import React, { ReactNode, useState, useEffect, useMemo } from 'react';
import { router, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    Download,
    Eye,
    Trash2,
    MoreVertical,
    Clock,
    FileText,
    Pencil,
    Plus,
    X,
} from 'lucide-react';
import ProcessDetailView from './ProcessDetailView';
import { compareF0, filterHistories, getHistoryStatus, type HistoryStatus } from './historyHelpers';
import { calculateF0, calculateF0FromLogs } from '@/Pages/Tn/retortTelemetry';

const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
    <section className={`rounded-2xl border border-slate-700/80 bg-[#0d131f]/95 p-5 sm:p-6 shadow-xl text-white ${className}`}>
        {title && <h3 className="mb-4 text-base font-mono font-black text-white uppercase tracking-wider">{title}</h3>}
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
    const systemF0 = calculateF0FromLogs(batch.log_data || []);
    const f0Result = compareF0(systemF0, batch.target_f0 ?? null) ?? '-';
    return {
        status,
        statusLabel: status === 'verified' ? 'VERIFIED' : 'UNVERIFIED',
        product: batch.product ?? '-',
        batchCode: batch.batch_code ?? '-',
        groupName: groups.find((g) => g.id === batch.group_id)?.name ?? (batch.group_id ? `#${batch.group_id}` : '-'),
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
    const [creatingGroup, setCreatingGroup] = useState<boolean>(false);
    const [newGroupName, setNewGroupName] = useState<string>('');
    const [newGroupColor, setNewGroupColor] = useState<string>('#3b82f6');

    const totalUnverifiedCount = useMemo(() => histories.filter((h) => getHistoryStatus(h) === 'unverified').length, [histories]);

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
                `F0 Chamber (Retort),${v.systemF0.toFixed(2)} min`,
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
                const rawReportMachine = batch.controller?.machine?.machine_name || (batch.controller as any)?.name || batch.controller?.model_type || 'Retort TN';
                const reportMachine = rawReportMachine.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'Retort TN').replace(/^TNS$/i, 'Retort TN');
                const title = `Batch Log Report: ${reportMachine}`;
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
                        <p>F0 Chamber (Retort): ${v.systemF0.toFixed(2)} min</p>
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

    const handleCreateGroup = () => {
        if (!newGroupName.trim()) return;
        router.post(route('tn.history-groups.store'), { name: newGroupName.trim(), color: newGroupColor }, {
            onSuccess: () => {
                setCreatingGroup(false);
                setNewGroupName('');
                setNewGroupColor('#3b82f6');
            },
        });
    };

    const handleDeleteGroup = (groupId: number, groupName: string) => {
        if (confirm(`Hapus group "${groupName}"? History yang menggunakan group ini akan dilepas dari group.`)) {
            router.delete(route('tn.history-groups.destroy', groupId));
            if (groupFilter === groupId) setGroupFilter('all');
        }
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
                        <label className="mb-1.5 block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Filter Periode</label>
                        <div className="flex gap-1.5 rounded-xl bg-[#070b13] p-1.5 border border-slate-800">
                            {['Semua', 'Hari', 'Minggu', 'Bulan'].map((x) => (
                                <button
                                    key={x}
                                    onClick={() => { setPeriod(x as any); setCustomDate(''); }}
                                    className={`rounded-lg px-3.5 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${period === x && !customDate
                                            ? 'bg-yellow-400 text-black shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                        }`}
                                >
                                    {x}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div>
                            <label className="mb-1.5 block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Tanggal Spesifik</label>
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="rounded-xl border border-slate-700 bg-[#070b13] text-xs font-mono font-bold text-white shadow-sm focus:border-yellow-400 focus:ring-yellow-400 py-1.5 px-3"
                            />
                        </div>
                        {customDate && (
                            <button
                                type="button"
                                onClick={() => setCustomDate('')}
                                className="mt-6 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shadow-sm cursor-pointer"
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
                        placeholder="Cari nama produk / kode batch..."
                        className="min-w-52 flex-1 rounded-xl border border-slate-700 bg-[#070b13] px-3.5 py-2 text-xs font-mono font-bold text-white placeholder-slate-500 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
                    />
                    <div className="flex gap-1.5 rounded-xl bg-[#070b13] p-1.5 border border-slate-800">
                        {(['all', 'verified', 'unverified'] as const).map((s) => {
                            const count = s === 'unverified'
                                ? histories.filter((h) => getHistoryStatus(h) === 'unverified').length
                                : s === 'verified'
                                    ? histories.filter((h) => getHistoryStatus(h) === 'verified').length
                                    : histories.length;

                            return (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${statusFilter === s
                                            ? 'bg-yellow-400 text-black shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                        }`}
                                >
                                    {s === 'unverified' && count > 0 && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                        </span>
                                    )}
                                    <span>
                                        {s === 'all' ? 'SEMUA' : s === 'verified' ? 'VERIFIED' : `UNVERIFIED (${count})`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {groups.length > 0 && (
                        <>
                            <button
                                onClick={() => setGroupFilter('all')}
                                className={`rounded-lg border px-3 py-1 text-xs font-mono font-bold transition-all cursor-pointer ${groupFilter === 'all'
                                        ? 'bg-yellow-400 text-black border-yellow-300 font-extrabold'
                                        : 'bg-[#070b13] text-slate-300 border-slate-700 hover:bg-slate-800'
                                    }`}
                            >
                                SEMUA GROUP
                            </button>
                            {groups.map((g) => (
                                <span
                                    key={g.id}
                                    className={`inline-flex items-center gap-1 rounded-lg border pl-3 pr-1 py-1 text-xs font-mono font-bold transition-all ${groupFilter === g.id
                                            ? 'bg-yellow-400 text-black border-yellow-300 font-extrabold'
                                            : 'bg-[#070b13] text-slate-300 border-slate-700 hover:bg-slate-800'
                                        }`}
                                >
                                    <button onClick={() => setGroupFilter(groupFilter === g.id ? 'all' : g.id)} className="flex items-center gap-1.5 cursor-pointer">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                                        {g.name}
                                    </button>
                                    <button
                                        title={`Rename ${g.name}`}
                                        onClick={() => openGroupEditor(g)}
                                        className="rounded p-0.5 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                                    >
                                        <Pencil size={11} />
                                    </button>
                                    <button
                                        title={`Delete ${g.name}`}
                                        onClick={() => handleDeleteGroup(g.id, g.name)}
                                        className="rounded p-0.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </>
                    )}
                    {groups.length < 2 && !creatingGroup && (
                        <button
                            onClick={() => setCreatingGroup(true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-mono font-bold text-slate-300 hover:border-yellow-400 hover:text-yellow-400 transition-all cursor-pointer"
                        >
                            <Plus size={12} />
                            <span>+ GROUP BARU</span>
                        </button>
                    )}
                </div>
                {creatingGroup && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-[#070b13] p-3 font-mono">
                        <input
                            type="text"
                            value={newGroupName}
                            maxLength={50}
                            placeholder="Nama group baru..."
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-[#0e1422] px-3 py-1.5 text-xs font-bold text-white focus:border-yellow-400 focus:ring-yellow-400"
                            autoFocus
                        />
                        <input
                            type="color"
                            value={newGroupColor}
                            onChange={(e) => setNewGroupColor(e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-[#0e1422] p-1"
                        />
                        <button
                            onClick={handleCreateGroup}
                            disabled={!newGroupName.trim()}
                            className="rounded-lg bg-yellow-400 px-3.5 py-1.5 text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            SIMPAN
                        </button>
                        <button
                            onClick={() => { setCreatingGroup(false); setNewGroupName(''); setNewGroupColor('#3b82f6'); }}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            BATAL
                        </button>
                    </div>
                )}
                {editingGroup && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-[#070b13] p-3 font-mono">
                        <input
                            type="text"
                            value={editName}
                            maxLength={50}
                            onChange={(e) => setEditName(e.target.value)}
                            className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-[#0e1422] px-3 py-1.5 text-xs font-bold text-white focus:border-yellow-400 focus:ring-yellow-400"
                        />
                        <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-[#0e1422] p-1"
                        />
                        <button
                            onClick={saveGroupRename}
                            className="rounded-lg bg-yellow-400 px-3.5 py-1.5 text-xs font-black text-black hover:bg-yellow-300 transition-colors cursor-pointer"
                        >
                            SIMPAN
                        </button>
                        <button
                            onClick={() => setEditingGroup(null)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            BATAL
                        </button>
                    </div>
                )}
            </Panel>

            {/* Unverified Alert Banner */}
            {totalUnverifiedCount > 0 && (
                <div className="rounded-2xl border border-rose-600/80 bg-rose-950/70 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 font-mono">
                    <div className="flex items-center gap-3.5">
                        <span className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                        <div>
                            <p className="text-xs sm:text-sm font-black text-rose-200 uppercase tracking-wider">
                                PERHATIAN: TERDAPAT {totalUnverifiedCount} BATCH PROSES BERSTATUS UNVERIFIED
                            </p>
                            <p className="text-xs text-rose-300/80 mt-0.5">
                                Batch selesai memerlukan data verifikasi tertulis. Klik tombol "Verifikasi" pada kartu di bawah ini untuk melengkapi.
                            </p>
                        </div>
                    </div>
                    {statusFilter !== 'unverified' && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('unverified')}
                            className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 shadow-md transition-all shrink-0 flex items-center gap-2 cursor-pointer"
                        >
                            <span>FILTER UNVERIFIED ({totalUnverifiedCount})</span>
                        </button>
                    )}
                </div>
            )}

            {/* Batch Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHistories.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-slate-400 font-mono font-bold bg-[#0d131f]/95 rounded-2xl border border-slate-700/80 shadow-xl">
                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-yellow-400" />
                        <p className="text-sm uppercase tracking-wider">Tidak ada riwayat proses yang cocok dengan filter.</p>
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
                        const rawMachineName = h.controller?.machine?.machine_name || (h.controller as any)?.name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
                        const machineName = rawMachineName.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'Retort TN').replace(/^TNS$/i, 'Retort TN');
                        const status = getHistoryStatus(h);

                        return (
                            <div
                                key={h.id}
                                className={`relative rounded-2xl border ${status === 'unverified'
                                        ? 'border-rose-600/80 bg-[#140a0f]/95 shadow-xl hover:border-rose-500'
                                        : 'border-slate-700/80 bg-[#0d131f]/95 shadow-xl hover:border-yellow-400/80'
                                    } p-5 transition-all duration-300 flex flex-col justify-between font-mono`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-black bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 px-2 py-0.5 rounded">
                                                BATCH #{h.id}
                                            </span>
                                            {status === 'verified' ? (
                                                <span
                                                    title={`by ${h.verified_by ?? '-'} · ${h.verified_at ? new Date(h.verified_at).toLocaleString('id-ID') : '-'}`}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-600/60 px-2 py-0.5 rounded"
                                                >
                                                    <CheckCircle2 size={12} /> VERIFIED
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-300 bg-rose-950/80 border border-rose-600/60 px-2 py-0.5 rounded shadow-sm">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                    </span>
                                                    UNVERIFIED
                                                </span>
                                            )}
                                        </div>

                                        {/* Action Dropdown */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === h.id ? null : h.id); }}
                                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {activeMenu === h.id && (
                                                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-[#0b101b] p-1.5 shadow-2xl border border-slate-700 z-50 animate-in fade-in">
                                                    <Link
                                                        href={route('historian.show', h.id)}
                                                        onClick={() => setActiveMenu(null)}
                                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors text-left"
                                                    >
                                                        <Eye size={14} className="text-yellow-400" /> Detail Log
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleDownload(h, 'csv'); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                    >
                                                        <Download size={14} className="text-emerald-400" /> Export CSV
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleDownload(h, 'pdf'); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                    >
                                                        <FileText size={14} className="text-amber-400" /> Cetak PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleDelete(h.id); setActiveMenu(null); }}
                                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/60 transition-colors text-left border-t border-slate-800 mt-1 cursor-pointer"
                                                    >
                                                        <Trash2 size={14} /> Hapus Log
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>MESIN:</span>
                                            <span className="font-bold text-white">{machineName}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>MULAI:</span>
                                            <span className="font-mono text-slate-200 font-bold">{startTime.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>SELESAI:</span>
                                            <span className="font-mono text-slate-200 font-bold">{endTime ? endTime.toLocaleString('id-ID') : '--'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>DURASI:</span>
                                            <span className="font-mono text-cyan-400 font-bold">{durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>MAX PV:</span>
                                            <span className="font-mono text-rose-400 font-bold">{maxPv > 0 ? `${maxPv.toFixed(1)} °C` : '--'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>SAMPLE POINTS:</span>
                                            <span className="font-mono text-yellow-400 font-bold">{logCount} pts</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                                    {status === 'unverified' ? (
                                        <Link
                                            href={route('historian.show', h.id)}
                                            className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider py-2.5 px-3 transition-all shadow-md text-center"
                                        >
                                            VERIFIKASI
                                        </Link>
                                    ) : (
                                        <Link
                                            href={route('historian.show', h.id)}
                                            className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider py-2.5 px-3 transition-colors text-center border border-slate-700"
                                        >
                                            LIHAT DETAIL
                                        </Link>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(h, 'csv')}
                                        className="rounded-xl border border-slate-700 hover:bg-slate-800 text-yellow-400 p-2.5 transition-colors cursor-pointer"
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
