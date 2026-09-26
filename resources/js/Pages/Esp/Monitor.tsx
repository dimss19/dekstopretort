import React, { useState, useEffect, useMemo, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { RetortTelemetry } from '@/Pages/Tn/retortTelemetry';
import TnFaceplateDisplay from '@/Components/Tn/TnFaceplateDisplay';
import RetortThermalChart from '@/Components/Tn/RetortThermalChart';
import ProcessDetailView from '@/Components/History/ProcessDetailView';
import EspPatternEditor from '@/Components/Esp/EspPatternEditor';
import { calculateLethality, EspTelemetryData } from '@/Components/Esp/EspMonitoringPanel';
import { ShieldCheck, Flame, Wifi, WifiOff, AlertTriangle, X, Download, Eye, Trash2, MoreVertical, Calendar, Clock, FileText, CheckCircle2 } from 'lucide-react';

interface DeviceItem {
    id: number;
    machine_code: string;
    name: string;
    firmware_version?: string;
    mqtt_broker?: string;
    mqtt_port?: number;
    is_online?: boolean;
}

interface Props {
    device: DeviceItem;
    devices: DeviceItem[];
    initialTelemetry: EspTelemetryData;
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
}: Props) {
    const [activeTab, setActiveTab] = useState<'monitor' | 'pattern' | 'history'>('monitor');
    const [telemetry, setTelemetry] = useState<EspTelemetryData>(initialTelemetry);
    const [history, setHistory] = useState<any[]>(initialHistory);
    const [isOnline, setIsOnline] = useState<boolean>(initialIsOnline);
    const [wdtAlert, setWdtAlert] = useState(systemEvent);
    const [f0, setF0] = useState<number>(0);
    const lastUpdateRef = useRef<number>(Date.now());

    // Historian states
    const [period, setPeriod] = useState<'Semua' | 'Hari' | 'Minggu' | 'Bulan'>('Semua');
    const [customDate, setCustomDate] = useState<string>('');
    const [selectedBatch, setSelectedBatch] = useState<any>(null);
    const [activeMenu, setActiveMenu] = useState<number | null>(null);

    const lastSeqRef = useRef<number>(0);

    const applyTelemetryPayload = (data: any) => {
        if (!data) return;
        lastUpdateRef.current = Date.now();
        setIsOnline(true);
        setTelemetry(data);

        // Add to history for chart & logs
        const historyEntry = {
            pv: data.pv ?? data.actual ?? 0,
            sv: data.sv ?? data.setting ?? 121.1,
            heating_mv: data.mv ?? 0,
            phase: data.phase ?? 'IDLE',
            created_at: data.ts ?? data.recorded_at ?? new Date().toISOString(),
        };
        setHistory(prev => {
            const last = prev[prev.length - 1];
            if (last && last.created_at === historyEntry.created_at) {
                return prev;
            }
            return [...prev.slice(-120), historyEntry];
        });

        // Accumulate F0 lethality if temperature >= 100 C
        const temp = Number(data.pv ?? data.actual ?? 0);
        if (temp >= 100.0) {
            const lethality = calculateLethality(temp);
            setF0(prev => prev + (lethality / 60));
        }
    };

    // Real-time telemetry poller with 1-second interval
    useEffect(() => {
        let active = true;

        const pollTelemetry = async () => {
            if (!active) return;
            try {
                const res = await fetch(route('esp.live', { machine_code: device.machine_code }), {
                    headers: { Accept: 'application/json' },
                });
                if (res.ok && active) {
                    const json = await res.json();
                    if (json.seq != null) lastSeqRef.current = json.seq;
                    if (json.telemetry) applyTelemetryPayload(json.telemetry);
                    if (typeof json.is_online === 'boolean') {
                        setIsOnline(json.is_online);
                        if (json.is_online) lastUpdateRef.current = Date.now();
                    }
                    if (Array.isArray(json.history) && json.history.length > 0) {
                        const formatted = json.history.map((h: any) => ({
                            pv: h.pv ?? h.actual ?? 0,
                            sv: h.sv ?? h.setting ?? 121.1,
                            heating_mv: h.mv ?? h.heating_mv ?? 0,
                            phase: h.phase ?? 'IDLE',
                            created_at: h.ts ?? h.recorded_at ?? h.created_at ?? new Date().toISOString(),
                        }));
                        setHistory(formatted);
                    }
                }
            } catch {
                // Silently recover on next cycle
            }
        };

        // Run immediately then every 1 second
        pollTelemetry();
        const pollInterval = setInterval(pollTelemetry, 1000);

        // Also listen to Laravel Echo if configured
        let channel: any = null;
        if (window.Echo) {
            channel = window.Echo.private(`retort.${device.machine_code}`);
            channel.listen('SensorDataReceived', (e: any) => {
                const data = e?.data || e;
                if (data && active) applyTelemetryPayload(data);
            });
        }

        return () => {
            active = false;
            if (channel) window.Echo?.leave(`retort.${device.machine_code}`);
            clearInterval(pollInterval);
        };
    }, [device.machine_code]);


    // Map ESP telemetry to standard RetortTelemetry object for TnFaceplateDisplay
    const mappedTelemetry: RetortTelemetry = useMemo(() => {
        const pvVal = telemetry.pv ?? telemetry.actual ?? null;
        const svVal = telemetry.sv ?? telemetry.setting ?? 121.1;
        const mvVal = telemetry.mv ?? 0;
        const isRunning = Boolean(
            telemetry.run ||
            (mvVal > 0) ||
            (telemetry.tot && telemetry.tot !== '00:00') ||
            (telemetry.phase && telemetry.phase.toUpperCase() !== 'IDLE')
        );

        const parseTimeDigits = (tStr?: string) => {
            if (!tStr) return 0;
            const clean = tStr.replace(/[^0-9]/g, '');
            return parseInt(clean, 10) || 0;
        };

        const pNum = telemetry.pattern ?? (telemetry.ps ? parseInt(telemetry.ps.split('.')[0], 10) : 0);
        const sNum = telemetry.step ?? (telemetry.ps ? parseInt(telemetry.ps.split('.')[1], 10) : 0);

        return {
            actualTemperature: pvVal !== null ? Number(pvVal) : null,
            targetTemperature: svVal !== null ? Number(svVal) : 121.1,
            heatingPercent: Number(mvVal),
            coolingPercent: 0,
            running: isRunning,
            automatic: true,
            heatingActive: mvVal > 0,
            coolingActive: false,
            sensorFault: null,
            activeAlarms: [],
            alarmActive: false,
            phase: (isRunning ? 'Running' : 'Waiting') as any,
            pattern: pNum,
            step: sNum,
            processTime: parseTimeDigits(telemetry.tot),
            remainingTime: parseTimeDigits(telemetry.stp),
            timestamp: telemetry.ts || telemetry.iso || new Date().toISOString(),
        };
    }, [telemetry]);

    const heatingLogs = useMemo(() => {
        return history
            .filter((item) => Number(item.heating_mv ?? item.mv ?? 0) > 0 || Number(item.pv ?? 0) > 40)
            .slice(-100)
            .reverse();
    }, [history]);

    const formattedUpdateTime = useMemo(() => {
        return new Date().toLocaleTimeString('id-ID');
    }, [telemetry]);

    // Historian Filtering
    const filteredHistories = useMemo(() => {
        return histories.filter((h) => {
            const startTime = new Date(h.start_time).getTime();
            if (isNaN(startTime)) return true;

            if (customDate) {
                const targetDateStr = new Date(customDate).toDateString();
                const itemDateStr = new Date(h.start_time).toDateString();
                return targetDateStr === itemDateStr;
            }

            const now = Date.now();
            if (period === 'Hari') {
                return startTime >= now - 24 * 60 * 60 * 1000;
            } else if (period === 'Minggu') {
                return startTime >= now - 7 * 24 * 60 * 60 * 1000;
            } else if (period === 'Bulan') {
                return startTime >= now - 30 * 24 * 60 * 60 * 1000;
            }
            return true;
        });
    }, [histories, period, customDate]);

    const handleDownload = (batch: any, format: 'csv' | 'excel' | 'pdf') => {
        const logs = [...(batch.log_data || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        if (!logs.length) {
            alert('Tidak ada data point pada batch ini.');
            return;
        }

        const headers = ['Time', 'PV (°C)', 'SV (°C)'];
        const rows = logs.map((log: any) => [
            new Date(log.created_at).toLocaleTimeString(),
            Number(log.pv ?? 0).toFixed(1),
            Number(log.sv ?? 0).toFixed(1)
        ]);

        if (format === 'csv' || format === 'excel') {
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `batch_${batch.id}_log.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (format === 'pdf') {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const title = `Batch Log Report: ${batch.controller?.machine?.machine_name || 'ESP32 Retort Logger'}`;
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
                        <p>End Time: ${batch.end_time ? new Date(batch.end_time).toLocaleString() : 'In Progress'}</p>
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

    const handleDeleteHistory = (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus riwayat proses ini?')) {
            router.delete(route('tn.history.destroy', id));
        }
    };

    return (
        <AuthenticatedLayout
            navContent={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => { setActiveTab('monitor'); setSelectedBatch(null); }}
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
                        onClick={() => { setActiveTab('pattern'); setSelectedBatch(null); }}
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
                        onClick={() => { setActiveTab('history'); setSelectedBatch(null); }}
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
            header={
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto py-1">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                {device.name || 'ESP32 Retort Logger'} ({device.machine_code})
                            </h1>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wider border ${
                                isOnline
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}>
                                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                {isOnline ? 'Realtime Online' : 'Offline'}
                            </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                            <span>Tipe: <strong className="font-mono text-blue-700">ESP32-S3 (RetortLogger)</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Protokol: <strong className="font-mono text-amber-700">MQTT</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Update: <strong className="text-slate-700">{formattedUpdateTime}</strong></span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                            href={route('dashboard')}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title={`Monitor Retort - ${device.name || device.machine_code}`} />

            <div className="py-8">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8">

                    {/* Watchdog Alert Banner */}
                    {wdtAlert && (
                        <div className="flex items-center justify-between rounded-2xl bg-amber-500/15 border border-amber-400/40 p-4 text-amber-900 shadow-sm">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider">ESP32 Watchdog / System Boot Event</p>
                                    <p className="text-xs mt-0.5">
                                        Perangkat reboot dengan alasan: <strong>{wdtAlert.reason || 'Watchdog Timeout'}</strong> pada {wdtAlert.ts || wdtAlert.iso || '--'}.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWdtAlert(null)}
                                className="rounded-lg p-1 text-amber-700 hover:bg-amber-400/20"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {activeTab === 'monitor' ? (
                        <div className="space-y-6">
                            {/* Autonics-Style Industrial Digital Faceplate Display */}
                            <TnFaceplateDisplay
                                telemetry={mappedTelemetry}
                                modelType="ESP32-LOGGER"
                                isOnline={isOnline}
                            />

                            {/* Industrial Thermal Sterilization Profile Chart */}
                            <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-lg backdrop-blur-xl">
                                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <h2 className="font-extrabold text-slate-900 text-xl tracking-tight">
                                                Profil Termal Sterilisasi Retort
                                            </h2>
                                            <span className="bg-blue-100 text-blue-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-200">
                                                Thermal Profile
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                            Kurva pemanasan riil dengan pembagian zona langkah (CUT, Holding Time & F₀, Cooling Time) berbasis waktu proses dari ESP32 RetortLogger.
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black border ${
                                        isOnline
                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                            : 'bg-rose-100 text-rose-800 border-rose-200'
                                    }`}>
                                        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                        {isOnline ? 'LIVE MONITOR' : 'OFFLINE'}
                                    </span>
                                </div>

                                <RetortThermalChart
                                    data={history}
                                    targetSv={mappedTelemetry.targetTemperature ?? 121.0}
                                    height={380}
                                    isRunning={Boolean(mappedTelemetry.running && mappedTelemetry.phase !== 'Waiting' && mappedTelemetry.phase !== 'Offline')}
                                />
                            </section>

                            {/* Process Logs Table */}
                            <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="font-extrabold text-slate-900 text-xl">Process Logs (Active Heating & Telemetry)</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Reading telemetri masuk dari broker MQTT.</p>
                                    </div>
                                    <span className="rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-extrabold text-blue-700">
                                        {heatingLogs.length} records
                                    </span>
                                </div>
                                <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                        <thead className="sticky top-0 bg-[#0f172a] text-left text-xs font-black uppercase tracking-wider text-white">
                                            <tr>
                                                <th className="px-5 py-3.5">Time</th>
                                                <th className="px-5 py-3.5">PV (°C)</th>
                                                <th className="px-5 py-3.5">SV (°C)</th>
                                                <th className="px-5 py-3.5">Heat MV</th>
                                                <th className="px-5 py-3.5">Fase</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white font-mono">
                                            {heatingLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-10 text-center font-sans font-bold text-slate-400">
                                                        Belum ada reading yang tercatat.
                                                    </td>
                                                </tr>
                                            ) : (
                                                heatingLogs.map((log, index) => (
                                                    <tr key={`${log.created_at ?? index}-${index}`} className="hover:bg-blue-50/70 transition-colors">
                                                        <td className="whitespace-nowrap px-5 py-3 text-slate-600 font-bold">
                                                            {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID') : '--'}
                                                        </td>
                                                        <td className="px-5 py-3 font-extrabold text-blue-700">
                                                            {Number(log.pv).toFixed(1)}
                                                        </td>
                                                        <td className="px-5 py-3 font-extrabold text-amber-700">
                                                            {Number(log.sv).toFixed(1)}
                                                        </td>
                                                        <td className="px-5 py-3 font-extrabold text-amber-600">
                                                            {Number(log.heating_mv).toFixed(0)}%
                                                        </td>
                                                        <td className="px-5 py-3 font-sans text-xs font-bold text-slate-700 uppercase">
                                                            {log.phase || 'IDLE'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
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
                    ) : selectedBatch ? (
                        <ProcessDetailView
                            batch={selectedBatch}
                            onBack={() => setSelectedBatch(null)}
                        />
                    ) : (
                        /* Historian / Process History View */
                        <div className="space-y-6">
                            {/* Filter Section */}
                            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-lg backdrop-blur-xl">
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
                            </div>

                            {/* Batch Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredHistories.length === 0 ? (
                                    <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-white/95 rounded-3xl border border-slate-200 shadow-sm">
                                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        Tidak ada riwayat proses pada filter ini.
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

                                        return (
                                            <div key={h.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                                                                Batch #{h.id}
                                                            </span>
                                                            {h.end_time ? (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                                    <CheckCircle2 size={12} /> Selesai
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
                                                                    Proses Berjalan
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
                                                                        disabled={!h.end_time}
                                                                        onClick={() => {
                                                                            if (!h.end_time) return;
                                                                            setSelectedBatch(h);
                                                                            setActiveMenu(null);
                                                                        }}
                                                                        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors text-left ${
                                                                            !h.end_time
                                                                                ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                                                                                : 'text-slate-700 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        <Eye size={14} className={!h.end_time ? 'text-slate-400' : 'text-blue-600'} />
                                                                        {!h.end_time ? 'Terkunci (Proses Berjalan)' : 'Lihat Detail Log'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={!h.end_time}
                                                                        onClick={() => {
                                                                            if (!h.end_time) return;
                                                                            handleDownload(h, 'csv');
                                                                            setActiveMenu(null);
                                                                        }}
                                                                        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors text-left ${
                                                                            !h.end_time
                                                                                ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                                                                                : 'text-slate-700 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        <Download size={14} className={!h.end_time ? 'text-slate-400' : 'text-emerald-600'} /> Export CSV
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
                                                                        onClick={() => { handleDeleteHistory(h.id); setActiveMenu(null); }}
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
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
