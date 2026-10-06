import React, { useMemo } from 'react';
import {
    Thermometer,
    Gauge,
    Zap,
    ZapOff,
    Wifi,
    WifiOff,
    Timer,
    Clock,
    Flame,
    Snowflake,
    Activity,
    ShieldCheck,
    Layers,
} from 'lucide-react';

export interface EspTelemetryData {
    machine_code?: string;
    id?: string;
    pv?: number | null;
    sv?: number | null;
    actual?: number | null;
    setting?: number | null;
    mv?: number | null;
    phase?: string;
    ps?: string;
    tot?: string;
    stp?: string;
    pattern?: number;
    step?: number;
    run?: boolean;
    logging?: boolean;
    ts?: string;
    iso?: string;
    f0?: number;
}

interface Props {
    telemetry: EspTelemetryData;
    isOnline: boolean;
    f0Value?: number;
}

export function calculateLethality(temperature: number): number {
    if (temperature < 100.0) return 0;
    // F0 Reference: Tref = 121.1 C, z = 10 C -> L = 10^((T - 121.1) / 10)
    return Math.pow(10, (temperature - 121.1) / 10);
}

export default function EspMonitoringPanel({ telemetry, isOnline, f0Value = 0 }: Props) {
    const rawPv = telemetry.pv ?? telemetry.actual;
    const rawSv = telemetry.sv ?? telemetry.setting;
    const rawMv = telemetry.mv ?? 0;
    const phase = (telemetry.phase || 'IDLE').toUpperCase();
    const isValveOpen = rawMv > 0;
    const isProcessRunning = isOnline && Boolean(
        telemetry.run ||
        rawMv > 0 ||
        (telemetry.tot && telemetry.tot !== '00:00' && telemetry.tot !== '--:--') ||
        !['IDLE', 'OFFLINE', 'WAITING'].includes(phase)
    );

    const formattedPv = useMemo(() => {
        if (rawPv === null || rawPv === undefined || isNaN(rawPv)) return '--.-';
        return rawPv.toFixed(1);
    }, [rawPv]);

    const formattedSv = useMemo(() => {
        if (rawSv === null || rawSv === undefined || isNaN(rawSv)) return '121.1';
        return rawSv.toFixed(1);
    }, [rawSv]);

    // Determine phase visual theme
    const phaseBadge = useMemo(() => {
        if (phase === 'STERILIZING' || phase === 'HOLDING') {
            return {
                label: 'STERILISASI (HOLDING)',
                color: 'bg-rose-500/15 text-rose-600 border-rose-300 dark:border-rose-700/50',
                icon: Flame,
            };
        }
        if (phase === 'HEATING' || phase === 'WARMUP' || phase === 'VENTING') {
            return {
                label: 'PEMANASAN (HEATING)',
                color: 'bg-amber-500/15 text-amber-600 border-amber-300 dark:border-amber-700/50',
                icon: Flame,
            };
        }
        if (phase === 'COOLING') {
            return {
                label: 'PENDINGINAN (COOLING)',
                color: 'bg-sky-500/15 text-sky-600 border-sky-300 dark:border-sky-700/50',
                icon: Snowflake,
            };
        }
        return {
            label: 'STANDBY (IDLE)',
            color: 'bg-slate-500/15 text-slate-600 border-slate-300 dark:border-slate-700/50',
            icon: Activity,
        };
    }, [phase]);

    const PhaseIcon = phaseBadge.icon;

    return (
        <div className="space-y-4">
            {/* Top Grid: Large PV Display & Primary Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 1. Large PV (Process Value) Hero Card */}
                <div className="lg:col-span-6 relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 dark:from-slate-900 dark:to-slate-950 border border-amber-200/70 dark:border-slate-800 shadow-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center backdrop-blur-xl">
                    <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md mb-3">
                        <Thermometer className="w-8 h-8 text-slate-950" strokeWidth={2.4} />
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            Process Value (PV)
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/60">
                            ESP32 SENSOR
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                            {formattedPv}
                        </span>
                        <span className="text-3xl font-extrabold text-amber-500 leading-none">
                            °C
                        </span>
                    </div>

                    {/* Phase Badge */}
                    <div className={`mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black border ${phaseBadge.color}`}>
                        <PhaseIcon size={14} className="animate-pulse" />
                        <span>{phaseBadge.label}</span>
                    </div>
                </div>

                {/* 2. Right Column Grid (SV, Status Mesin, Katup MV, F0) */}
                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Machine Status */}
                    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-5 shadow-lg backdrop-blur-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Status Mesin</span>
                            <div className={`flex items-center justify-center rounded-xl w-10 h-10 ${isOnline ? 'bg-sky-500/15 text-sky-600' : 'bg-rose-500/15 text-rose-600'}`}>
                                {isOnline ? <Wifi size={20} strokeWidth={2.2} /> : <WifiOff size={20} strokeWidth={2.2} />}
                            </div>
                        </div>
                        <div className="mt-3">
                            <p className={`text-2xl font-black ${isOnline ? 'text-sky-600' : 'text-rose-500'}`}>
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                {isOnline ? 'ESP32 MQTT Heartbeat Aktif' : 'Tidak ada paket data >30 detik'}
                            </p>
                        </div>
                    </div>

                    {/* Katup MV */}
                    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-5 shadow-lg backdrop-blur-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Katup / Heating MV</span>
                            <div className={`flex items-center justify-center rounded-xl w-10 h-10 ${isValveOpen ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                                {isValveOpen ? <Zap size={20} strokeWidth={2.2} /> : <ZapOff size={20} strokeWidth={2.2} />}
                            </div>
                        </div>
                        <div className="mt-3">
                            <p className={`text-2xl font-black ${isValveOpen ? 'text-emerald-600' : 'text-slate-600'}`}>
                                {isValveOpen ? `Terbuka (${rawMv.toFixed(0)}%)` : 'Tertutup (0%)'}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                Output pemanas / steam valve
                            </p>
                        </div>
                    </div>

                    {/* Set Value (SV) */}
                    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-5 shadow-lg backdrop-blur-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Set Value (SV) Target</span>
                            <div className="flex items-center justify-center rounded-xl w-10 h-10 bg-indigo-500/15 text-indigo-600">
                                <Gauge size={20} strokeWidth={2.2} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-black text-indigo-600 tabular-nums">
                                    {formattedSv}
                                </span>
                                <span className="text-base font-bold text-indigo-400">°C</span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                Target suhu sterilisasi
                            </p>
                        </div>
                    </div>

                    {/* Lethality Rate F0 */}
                    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-5 shadow-lg backdrop-blur-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Akumulasi F₀ (Sterilitas)</span>
                            <div className="flex items-center justify-center rounded-xl w-10 h-10 bg-amber-500/15 text-amber-600">
                                <ShieldCheck size={20} strokeWidth={2.2} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-black text-amber-600 tabular-nums">
                                    {f0Value.toFixed(2)}
                                </span>
                                <span className="text-xs font-extrabold text-amber-500">menit eq</span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                Standar letalitas panas (Tref 121.1°C)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Metrics Bar: Timers (TOT & STP) & Pattern/Step */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Process Time (TOT) */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur-xl flex items-center gap-3.5">
                    <div className="flex items-center justify-center rounded-xl w-11 h-11 bg-blue-500/15 text-blue-600 shrink-0">
                        <Timer size={22} strokeWidth={2.2} />
                    </div>
                    <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Waktu Total (TOT)</span>
                        <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                            {isProcessRunning ? (telemetry.tot || '00:00') : '00:00'}
                        </p>
                    </div>
                </div>

                {/* Step Remaining Time (STP) */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur-xl flex items-center gap-3.5">
                    <div className="flex items-center justify-center rounded-xl w-11 h-11 bg-purple-500/15 text-purple-600 shrink-0">
                        <Clock size={22} strokeWidth={2.2} />
                    </div>
                    <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Sisa Langkah (STP)</span>
                        <p className="text-xl font-black text-purple-600 font-mono">
                            {isProcessRunning ? (telemetry.stp || '00:00') : '00:00'}
                        </p>
                    </div>
                </div>

                {/* Pattern & Step (P/S) */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur-xl flex items-center gap-3.5">
                    <div className="flex items-center justify-center rounded-xl w-11 h-11 bg-teal-500/15 text-teal-600 shrink-0">
                        <Layers size={22} strokeWidth={2.2} />
                    </div>
                    <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Pattern & Step</span>
                        <p className="text-xl font-black text-teal-600 font-mono">
                            {isProcessRunning ? (telemetry.ps || `P${telemetry.pattern ?? 0}.S${telemetry.step ?? 0}`) : 'P0.S0'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
