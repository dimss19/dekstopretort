import React, { useState, useEffect, useMemo, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { RetortTelemetry } from '@/Pages/Tn/retortTelemetry';
import TnFaceplateDisplay from '@/Components/Tn/TnFaceplateDisplay';
import RetortThermalChart from '@/Components/Tn/RetortThermalChart';
import HistorianList from '@/Components/History/HistorianList';
import EspPatternEditor from '@/Components/Esp/EspPatternEditor';
import { calculateLethality, EspTelemetryData } from '@/Components/Esp/EspMonitoringPanel';
import { AlertTriangle, X } from 'lucide-react';

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
    groups?: { id: number; name: string; color: string }[];
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
    groups = [],
}: Props) {
    const [activeTab, setActiveTab] = useState<'monitor' | 'pattern' | 'history'>('monitor');
    const [telemetry, setTelemetry] = useState<EspTelemetryData>(initialTelemetry);
    const [history, setHistory] = useState<any[]>(initialHistory);
    const [isOnline, setIsOnline] = useState<boolean>(initialIsOnline);
    const [wdtAlert, setWdtAlert] = useState(systemEvent);
    const [f0, setF0] = useState<number>(0);
    const lastUpdateRef = useRef<number>(Date.now());

    const lastSeqRef = useRef<number>(0);

    const applyTelemetryPayload = (data: any, online: boolean = true) => {
        if (!data) return;
        setIsOnline(online);
        setTelemetry(data);
        if (!online) return;

        lastUpdateRef.current = Date.now();

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
                    const onlineStatus = Boolean(json.is_online);
                    setIsOnline(onlineStatus);
                    if (onlineStatus) lastUpdateRef.current = Date.now();
                    if (json.telemetry) applyTelemetryPayload(json.telemetry, onlineStatus);
                    if (Array.isArray(json.history)) {
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
        const pvVal = isOnline && telemetry.pv !== null && telemetry.pv !== undefined
            ? Number(telemetry.pv ?? telemetry.actual)
            : null;
        const svVal = isOnline && telemetry.sv !== null && telemetry.sv !== undefined
            ? Number(telemetry.sv ?? telemetry.setting)
            : null;
        const mvVal = isOnline ? Number(telemetry.mv ?? 0) : 0;
        const isRunning = isOnline && Boolean(
            telemetry.run ||
            (mvVal > 0) ||
            (telemetry.tot && telemetry.tot !== '00:00') ||
            (telemetry.phase && !['IDLE', 'OFFLINE'].includes(telemetry.phase.toUpperCase()))
        );

        const parseTimeDigits = (tStr?: string) => {
            if (!tStr) return 0;
            const clean = tStr.replace(/[^0-9]/g, '');
            return parseInt(clean, 10) || 0;
        };

        const pNum = isOnline ? (telemetry.pattern ?? (telemetry.ps ? parseInt(telemetry.ps.split('.')[0], 10) : 0)) : 0;
        const sNum = isOnline ? (telemetry.step ?? (telemetry.ps ? parseInt(telemetry.ps.split('.')[1], 10) : 0)) : 0;

        return {
            actualTemperature: pvVal,
            targetTemperature: svVal,
            heatingPercent: mvVal,
            coolingPercent: 0,
            running: isRunning,
            automatic: true,
            heatingActive: isOnline && mvVal > 0,
            coolingActive: false,
            sensorFault: null,
            activeAlarms: [],
            alarmActive: false,
            phase: (isRunning ? 'Running' : (isOnline ? 'Waiting' : 'Offline')) as any,
            pattern: pNum,
            step: sNum,
            processTime: isOnline ? parseTimeDigits(telemetry.tot) : 0,
            remainingTime: isOnline ? parseTimeDigits(telemetry.stp) : 0,
            timestamp: isOnline ? (telemetry.ts || telemetry.iso || new Date().toISOString()) : '',
        };
    }, [telemetry, isOnline]);

    const heatingLogs = useMemo(() => {
        return history
            .filter((item) => Number(item.heating_mv ?? item.mv ?? 0) > 0 || Number(item.pv ?? 0) > 40)
            .slice(-100)
            .reverse();
    }, [history]);

    const formattedUpdateTime = useMemo(() => {
        if (!isOnline) return 'Belum Ada Sinyal';
        if (telemetry.ts) {
            const parts = telemetry.ts.split(' ');
            return parts[1] || telemetry.ts;
        }
        return new Date().toLocaleTimeString('id-ID');
    }, [telemetry, isOnline]);

    return (
        <AuthenticatedLayout
            navContent={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('monitor')}
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
                        onClick={() => setActiveTab('pattern')}
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
                        onClick={() => setActiveTab('history')}
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
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}>
                                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                {isOnline ? 'Online' : 'Offline'}
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
                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3">
                        <button
                            type="button"
                            onClick={() => setActiveTab('monitor')}
                            className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all shadow-sm ${
                                activeTab === 'monitor'
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md border-none'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-800'
                            }`}
                        >
                            Monitoring
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('pattern')}
                            className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all shadow-sm ${
                                activeTab === 'pattern'
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md border-none'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-800'
                            }`}
                        >
                            Pattern Steps
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('history')}
                            className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all shadow-sm ${
                                activeTab === 'history'
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md border-none'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-800'
                            }`}
                        >
                            History Logs
                        </button>
                    </div>

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
                    ) : (
                        <HistorianList histories={histories} groups={groups} />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
