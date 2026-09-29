import React, { ReactNode, useState, useEffect, useMemo } from 'react';
import { router, Link } from '@inertiajs/react';
import axios from 'axios';
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

    const handleDownload = (batch: any, format: 'excel' | 'pdf') => {
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
        const rawReportMachine = batch.controller?.machine?.machine_name || (batch.controller as any)?.name || batch.controller?.model_type || 'Retort TN';
        const reportMachine = rawReportMachine.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'Retort TN').replace(/^TNS$/i, 'Retort TN');
        const title = `Batch Log Report: ${reportMachine}`;

        if (format === 'excel') {
            const excelTemplate = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; }
                        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
                        .h { background: #1e3a5f; color: #ffffff; font-weight: bold; }
                        .lbl { background: #f1f5f9; color: #1e3a5f; font-weight: bold; width: 25%; }
                        .num { text-align: right; }
                    </style>
                </head>
                <body>
                    <h2 style="color: #1e3a5f; margin-bottom: 4px;">${title}</h2>
                    <p style="color: #475569; margin-top: 0;">Start: ${new Date(batch.start_time).toLocaleString()} | End: ${new Date(batch.end_time).toLocaleString()}</p>
                    <table border="1">
                        <tr><td class="lbl">Status Verifikasi</td><td>${v.statusLabel}</td><td class="lbl">Product</td><td>${v.product}</td></tr>
                        <tr><td class="lbl">Batch</td><td>${v.batchCode}</td><td class="lbl">Group</td><td>${v.groupName}</td></tr>
                        <tr><td class="lbl">F0 Sistem</td><td>${v.systemF0.toFixed(2)} min</td><td class="lbl">Hasil F0</td><td>${v.f0Result}</td></tr>
                        <tr><td class="lbl">Diverifikasi Oleh</td><td>${v.verifiedBy}</td><td class="lbl">Diverifikasi Tanggal</td><td>${v.verifiedAt}</td></tr>
                    </table>
                    <table border="1">
                        <thead>
                            <tr class="h"><th>Time</th><th>PV (&deg;C)</th><th>SV (&deg;C)</th></tr>
                        </thead>
                        <tbody>
                            ${rows.map((r: any) => `<tr><td style="text-align: center;">${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `;
            const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `batch_${batch.id}_log.xls`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else if (format === 'pdf') {
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>${title}</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; font-size: 11px; color: #1e293b; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                        th { background-color: #1e3a5f; color: #ffffff; }
                        .num { text-align: right; font-family: monospace; }
                        .no-print { margin-bottom: 16px; display: flex; gap: 8px; }
                        .btn-print { background: #1e3a5f; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                        .btn-close { background: #fff; color: #333; border: 1px solid #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
                        @media print { .no-print { display: none !important; } }
                    </style>
                </head>
                <body>
                    <h2 style="color: #1e3a5f; margin-bottom: 6px;">${title}</h2>
                    <table style="width: 100%; margin-bottom: 15px;">
                        <tr><td style="background: #f1f5f9; font-weight: bold; width: 25%;">Waktu Mulai</td><td>${new Date(batch.start_time).toLocaleString('id-ID')}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Waktu Selesai</td><td>${batch.end_time ? new Date(batch.end_time).toLocaleString('id-ID') : 'Sedang Berjalan'}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Status Verifikasi</td><td>${v.statusLabel}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Product</td><td>${v.product}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Batch</td><td>${v.batchCode}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Group</td><td>${v.groupName}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">F0 Sistem</td><td>${v.systemF0.toFixed(2)} min</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Hasil F0</td><td>${v.f0Result}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Diverifikasi Oleh</td><td>${v.verifiedBy}</td></tr>
                        <tr><td style="background: #f1f5f9; font-weight: bold;">Diverifikasi Tanggal</td><td>${v.verifiedAt}</td></tr>
                    </table>
                    <table>
                        <thead>
                            <tr><th>Time</th><th class="num">PV (&deg;C)</th><th class="num">SV (&deg;C)</th></tr>
                        </thead>
                        <tbody>
                            ${rows.map((r: any) => `<tr><td style="text-align: center;">${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            axios.post(`/historian/${batch.id}/export-pdf`, { html: htmlContent }, { responseType: 'blob' })
                .then(res => {
                    const blob = new Blob([res.data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `batch_${batch.id}_log.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                })
                .catch(err => {
                    console.error('PDF download error:', err);
                    alert('Gagal mendownload PDF: ' + (err.response?.data?.message || err.message || 'Layanan tidak merespons'));
                });
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
                                    className={`relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                        statusFilter === s
                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {s === 'unverified' && count > 0 && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                                        </span>
                                    )}
                                    <span>
                                        {s === 'all' ? 'Semua' : s === 'verified' ? 'Verified' : `Unverified (${count})`}
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
                                    className={`inline-flex items-center gap-1 rounded-full border pl-3 pr-1 py-1 text-xs font-black transition-all ${
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
                                        <Pencil size={11} />
                                    </button>
                                    <button
                                        title={`Delete ${g.name}`}
                                        onClick={() => handleDeleteGroup(g.id, g.name)}
                                        className="rounded-full p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors"
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
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-400 bg-white px-3 py-1 text-xs font-black text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <Plus size={12} />
                            Create Group
                        </button>
                    )}
                    {groups.length === 0 && !creatingGroup && (
                        <span className="text-xs text-slate-400 font-semibold">Belum ada group. Buat group untuk mengelompokkan batch.</span>
                    )}
                </div>
                {creatingGroup && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/30 p-3">
                        <input
                            type="text"
                            value={newGroupName}
                            maxLength={50}
                            placeholder="Nama group baru..."
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="min-w-40 flex-1 rounded-xl border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                            autoFocus
                        />
                        <input
                            type="color"
                            value={newGroupColor}
                            onChange={(e) => setNewGroupColor(e.target.value)}
                            className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                        />
                        <button
                            onClick={handleCreateGroup}
                            disabled={!newGroupName.trim()}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Simpan Group
                        </button>
                        <button
                            onClick={() => { setCreatingGroup(false); setNewGroupName(''); setNewGroupColor('#3b82f6'); }}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            Batal
                        </button>
                        <span className="text-[10px] text-slate-400 font-semibold">Maks. 2 group</span>
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

            {/* Unverified Alert Banner */}
            {totalUnverifiedCount > 0 && (
                <div className="rounded-3xl border-2 border-rose-300 bg-rose-50/80 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <span className="relative flex h-3.5 w-3.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600"></span>
                        </span>
                        <div>
                            <p className="text-sm font-black text-rose-900">
                                Perhatian: Terdapat {totalUnverifiedCount} Batch Proses Berstatus UNVERIFIED
                            </p>
                            <p className="text-xs font-semibold text-rose-700 mt-0.5">
                                Batch selesai memerlukan data verifikasi tertulis. Klik tombol "Verifikasi" pada kartu di bawah ini untuk melengkapi.
                            </p>
                        </div>
                    </div>
                    {statusFilter !== 'unverified' && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('unverified')}
                            className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black px-4 py-2.5 shadow-sm transition-all shrink-0 flex items-center gap-2"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            Filter Unverified ({totalUnverifiedCount})
                        </button>
                    )}
                </div>
            )}

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
                        const rawMachineName = h.controller?.machine?.machine_name || (h.controller as any)?.name || h.controller?.model_type || `Controller #${h.tn_controller_id}`;
                        const machineName = rawMachineName.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'Retort TN').replace(/^TNS$/i, 'Retort TN');
                        const status = getHistoryStatus(h);

                        return (
                            <div
                                key={h.id}
                                className={`relative rounded-3xl border ${
                                    status === 'unverified'
                                        ? 'border-rose-300 bg-white shadow-md hover:shadow-xl ring-1 ring-rose-200/80'
                                        : 'border-slate-200 bg-white shadow-md hover:shadow-xl'
                                } p-6 transition-all duration-300 flex flex-col justify-between`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                                                Batch #{h.id}
                                            </span>
                                            {status === 'verified' ? (
                                                <span
                                                    title={`by ${h.verified_by ?? '-'} · ${h.verified_at ? new Date(h.verified_at).toLocaleString('id-ID') : '-'}`}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                                                >
                                                    <CheckCircle2 size={12} /> VERIFIED
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-300 px-2.5 py-0.5 rounded-md shadow-sm">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
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
                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {activeMenu === h.id && (
                                                <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 animate-in fade-in">
                                                    <Link
                                                        href={route('historian.show', h.id)}
                                                        onClick={() => setActiveMenu(null)}
                                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                                                    >
                                                        <Eye size={14} className="text-blue-600" /> Lihat Detail Log
                                                    </Link>

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
                                            <span className="font-mono text-slate-900 font-bold">{endTime ? endTime.toLocaleString('id-ID') : '--'}</span>
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
                                    {status === 'unverified' ? (
                                        <Link
                                            href={route('historian.show', h.id)}
                                            className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black py-2.5 px-3 transition-all shadow-sm shadow-rose-200 text-center"
                                        >
                                            Verifikasi
                                        </Link>
                                    ) : (
                                        <Link
                                            href={route('historian.show', h.id)}
                                            className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black py-2.5 px-3 transition-colors text-center"
                                        >
                                            Lihat Detail
                                        </Link>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(h, 'excel')}
                                        className="rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 p-2.5 transition-colors"
                                        title="Export Excel"
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
