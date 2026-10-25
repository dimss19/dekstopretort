import React, { useMemo } from 'react';
import { RetortTelemetry, calculateF0FromLogs } from '@/Pages/Tn/retortTelemetry';
import RetortThermalChart from './RetortThermalChart';
import TnFaceplateDisplay from './TnFaceplateDisplay';
import { Activity, Flame, Clock, ShieldCheck, Database } from 'lucide-react';

interface Props {
    controllerId?: number;
    controllerModel?: string;
    telemetry: RetortTelemetry;
    history: any[];
    isOnline: boolean;
    serialPort?: string;
}

export default function TnNormalMonitor({ controllerModel = 'TNH', telemetry, history, isOnline, serialPort }: Props) {
    const isProcessRunning = Boolean(
        isOnline &&
        telemetry.running &&
        telemetry.phase !== 'Waiting' &&
        telemetry.phase !== 'Offline'
    );

    // Hanya ambil data point dari sesi proses yang sedang berjalan saat ini
    const currentRunHistory = useMemo(() => {
        if (!isProcessRunning || !history.length) return [];

        let startIndex = history.length - 1;
        let zeroCount = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const mv = Number(history[i].heating_mv ?? 0);
            const ptime = Number(history[i].process_time ?? 0);
            if (mv > 0 || ptime > 0) {
                zeroCount = 0;
                startIndex = i;
            } else {
                zeroCount++;
                if (zeroCount > 10) {
                    break;
                }
            }
        }
        return history.slice(startIndex);
    }, [history, isProcessRunning]);

    const heatingLogs = useMemo(() => {
        if (!isProcessRunning) return [];
        return currentRunHistory
            .filter((item) => Number(item.heating_mv ?? 0) > 0)
            .slice(-100)
            .reverse();
    }, [currentRunHistory, isProcessRunning]);

    // Live Metrics for HUD Bar
    const accumulatedF0 = useMemo(() => {
        return calculateF0FromLogs(currentRunHistory);
    }, [currentRunHistory]);

    const pvCurrent = (isOnline && telemetry.actualTemperature !== null && telemetry.actualTemperature !== undefined)
        ? telemetry.actualTemperature.toFixed(1)
        : '0.0';

    const targetSv = (telemetry.targetTemperature && telemetry.targetTemperature > 60)
        ? telemetry.targetTemperature
        : 121.0;

    return (
        <div className="space-y-6">
            {/* Autonics Industrial Digital Faceplate Display */}
            <TnFaceplateDisplay
                telemetry={telemetry}
                modelType={controllerModel}
                isOnline={isOnline}
                serialPort={serialPort}
            />

            {/* Industrial Thermal Sterilization Profile Chart */}
            <section className="rounded-2xl border-2 border-slate-700/80 bg-[#0d121d] p-5 sm:p-6 shadow-2xl text-white font-mono">
                {/* Header with Safety Yellow Accent */}
                <div className="mb-4 pb-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="h-3 w-1.5 bg-yellow-400 rounded-xs" />
                            <h2 className="font-mono font-black text-white text-base sm:text-lg tracking-wider uppercase">
                                // Profil Termal Sterilisasi Retort
                            </h2>
                            <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-bold rounded">
                                OSCILLOSCOPE RECORDER
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                            Kurva pemanasan riil dengan pembagian zona langkah (CUT, Holding Time & F₀, Cooling Time).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-black uppercase tracking-wider border ${
                            isOnline
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                : 'bg-rose-950/80 text-rose-400 border-rose-700'
                        }`}>
                            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                            {isOnline ? 'CHART LIVE' : 'CHART IDLE'}
                        </span>
                    </div>
                </div>

                {/* HUD Engineering Quick Stat Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Activity className="w-3 h-3 text-emerald-400" /> PV AKTUAL
                        </span>
                        <div className="text-xl font-black text-emerald-400 mt-0.5">
                            {pvCurrent} <span className="text-xs text-slate-400">°C</span>
                        </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Flame className="w-3 h-3 text-yellow-400" /> TARGET SV
                        </span>
                        <div className="text-xl font-black text-yellow-400 mt-0.5">
                            {targetSv.toFixed(1)} <span className="text-xs text-slate-400">°C</span>
                        </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-cyan-400" /> LETALITAS F₀
                        </span>
                        <div className="text-xl font-black text-cyan-400 mt-0.5">
                            {accumulatedF0} <span className="text-xs text-slate-400">menit</span>
                        </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-300" /> TOTAL SAMPLE
                        </span>
                        <div className="text-xl font-black text-slate-200 mt-0.5">
                            {currentRunHistory.length} <span className="text-xs text-slate-400">pts</span>
                        </div>
                    </div>
                </div>
                
                <RetortThermalChart
                    data={currentRunHistory}
                    targetSv={targetSv}
                    height={380}
                    isRunning={isProcessRunning}
                />
            </section>

            {/* Industrial Process Event Recorder Table */}
            <section className="rounded-2xl border-2 border-slate-700/80 bg-[#0d121d] p-5 sm:p-6 shadow-2xl text-white font-mono">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-yellow-400" />
                            <h2 className="font-mono font-black text-white text-base tracking-wider uppercase">
                                // Process Event Recorder (Active Heating MV)
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Pencatatan telemetri realtime ketika output pemanas (MV) {'>'} 0%.
                        </p>
                    </div>
                    <span className="rounded bg-slate-900 border border-slate-700 px-3 py-1 text-xs font-bold text-yellow-400">
                        {heatingLogs.length} LOG RECORDS
                    </span>
                </div>

                <div className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-[#070a10]">
                    <table className="min-w-full divide-y divide-slate-800 text-xs">
                        <thead className="sticky top-0 bg-[#0e1422] text-left font-black uppercase tracking-wider text-slate-300">
                            <tr>
                                <th className="px-5 py-3 border-r border-slate-800/80">TIMESTAMP</th>
                                <th className="px-5 py-3 border-r border-slate-800/80 text-emerald-400">PV (°C)</th>
                                <th className="px-5 py-3 border-r border-slate-800/80 text-yellow-400">SV (°C)</th>
                                <th className="px-5 py-3 text-amber-400">HEAT OUTPUT (MV)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 bg-[#080c14] font-mono">
                            {heatingLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 font-bold">
                                        STANDBY: Belum ada data logging dengan pemanasan aktif.
                                    </td>
                                </tr>
                            ) : heatingLogs.map((log, index) => (
                                <tr key={`${log.created_at ?? index}-${index}`} className="hover:bg-slate-800/60 transition-colors">
                                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-400 border-r border-slate-850">
                                        {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID') : '--'}
                                    </td>
                                    <td className="px-5 py-2.5 font-bold text-emerald-400 border-r border-slate-850">
                                        {Number(log.pv).toLocaleString('id-ID')} °C
                                    </td>
                                    <td className="px-5 py-2.5 font-bold text-yellow-400 border-r border-slate-850">
                                        {Number(log.sv).toLocaleString('id-ID')} °C
                                    </td>
                                    <td className="px-5 py-2.5 font-bold text-amber-400">
                                        {(Number(log.heating_mv) / 10).toLocaleString('id-ID')}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
