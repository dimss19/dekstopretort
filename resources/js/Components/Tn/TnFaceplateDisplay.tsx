import React, { useState, useEffect } from 'react';
import { RetortTelemetry } from '@/Pages/Tn/retortTelemetry';

interface Props {
    telemetry: RetortTelemetry;
    modelType?: string;
    isOnline: boolean;
    serialPort?: string | null;
}

export default function TnFaceplateDisplay({ telemetry, modelType = 'TNH-P', isOnline, serialPort }: Props) {
    const [blinkToggle, setBlinkToggle] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setBlinkToggle(prev => !prev);
        }, 500);
        return () => clearInterval(timer);
    }, []);

    // Format timestamp
    const updateTime = telemetry.timestamp
        ? new Date(telemetry.timestamp).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ' ' + new Date(telemetry.timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
        : new Date().toLocaleDateString('id-ID') + ' --:--:--';

    // Format PV: Saat offline / tidak terhubung, default ke '0.0'
    const pvDisplay = (isOnline && telemetry.actualTemperature !== null && telemetry.actualTemperature !== undefined)
        ? telemetry.actualTemperature.toFixed(1)
        : '0.0';

    // Format SV / Status
    const isMv100 = isOnline && telemetry.heatingPercent !== null && telemetry.heatingPercent >= 100;
    const isProcessRunning = Boolean(
        isOnline && (
            telemetry.running ||
            isMv100 ||
            (telemetry.processTime !== null && telemetry.processTime > 0) ||
            telemetry.heatingActive ||
            telemetry.coolingActive ||
            (telemetry.phase !== 'Waiting' && telemetry.phase !== 'Offline')
        )
    );
    const isStopped = !isOnline || !isProcessRunning;

    const targetSv = isStopped
        ? 25.0
        : ((telemetry.targetTemperature !== null && telemetry.targetTemperature !== undefined)
            ? telemetry.targetTemperature
            : 25.0);

    const targetSvFormatted = typeof targetSv === 'number'
        ? targetSv.toFixed(1)
        : '25.0';

    const svValueDisplay = isStopped
        ? (blinkToggle ? 'STOP' : targetSvFormatted)
        : targetSvFormatted;

    // Format MV: jika tidak running, pastikan 0.0
    const mvDisplay = (isOnline && isProcessRunning && telemetry.heatingPercent !== null && telemetry.heatingPercent !== undefined)
        ? telemetry.heatingPercent.toFixed(1)
        : '0.0';

    // Format P/S (Pattern.Step -> e.g. 02.03)
    const pVal = isOnline ? String(telemetry.pattern ?? 0).padStart(2, '0') : '00';
    const sVal = isOnline ? String(telemetry.step ?? 0).padStart(2, '0') : '00';
    const psDisplay = `${pVal}.${sVal}`;

    // Format TOT M:S (Total Process Time)
    const formatTimeDot = (val: number | null | undefined) => {
        if (val === null || val === undefined || !Number.isFinite(val)) return '00.00';
        const num = Math.max(0, Math.trunc(val));
        const hi = Math.floor(num / 100);
        const lo = num % 100;
        if (lo >= 60) {
            const totalSec = (hi * 60) + lo;
            const mm = Math.floor(totalSec / 60);
            const ss = totalSec % 60;
            return `${String(mm).padStart(2, '0')}.${String(ss).padStart(2, '0')}`;
        }
        return `${String(hi).padStart(2, '0')}.${String(lo).padStart(2, '0')}`;
    };

    const totDisplay = isOnline ? formatTimeDot(telemetry.processTime) : '00.00';
    const stpDisplay = isOnline ? formatTimeDot(telemetry.remainingTime) : '00.00';

    // Status LED flags
    const out1Active = Boolean(isOnline && (telemetry.heatingActive || (telemetry.heatingPercent && telemetry.heatingPercent > 0)));
    const out2Active = Boolean(isOnline && telemetry.coolingActive);
    const alarmActive = Boolean(isOnline && telemetry.alarmActive);

    return (
        <section className="relative rounded-2xl border-2 border-slate-700/80 bg-[#0c1017] p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white font-mono">
            {/* Top Industrial Header & Bezel */}
            <div className="mb-4 pb-3 border-b border-slate-800">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono font-bold text-slate-400 mb-2">
                    <span className="tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 bg-yellow-400 rounded-full" />
                        UPDATE: {updateTime}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                        isOnline
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : 'bg-rose-950/80 text-rose-400 border-rose-700'
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        {isOnline ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                </div>

                {/* Industrial Hardware Model Banner */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-black tracking-wider text-white">
                            TN Controller
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-800 text-yellow-400 text-[10px] font-bold rounded border border-slate-700">
                            {modelType}
                        </span>
                    </div>
                    <span className="text-lg font-black tracking-[0.25em] text-white">
                        AUTONICS
                    </span>
                </div>

                {/* Industrial Hardware Status Annunciator LED Bar */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="text-slate-500 uppercase text-[9px] mr-1">ANNUNCIATOR:</span>
                    
                    {/* OUT1 (Heating) */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        out1Active
                            ? 'bg-amber-950/90 text-amber-300 border-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'bg-slate-900 text-slate-600 border-slate-800'
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${out1Active ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                        OUT1 (HEAT)
                    </span>

                    {/* OUT2 (Cooling) */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        out2Active
                            ? 'bg-cyan-950/90 text-cyan-300 border-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                            : 'bg-slate-900 text-slate-600 border-slate-800'
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${out2Active ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
                        OUT2 (COOL)
                    </span>

                    {/* ALARM */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        alarmActive
                            ? 'bg-rose-950/90 text-rose-300 border-rose-600 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                            : 'bg-slate-900 text-slate-600 border-slate-800'
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${alarmActive ? 'bg-rose-400' : 'bg-slate-700'}`} />
                        ALM
                    </span>

                    {/* RUN / STOP State */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        isProcessRunning
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                            : 'bg-slate-900 text-yellow-500 border-slate-800'
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isProcessRunning ? 'bg-emerald-400' : 'bg-yellow-500'}`} />
                        {isProcessRunning ? 'PROG' : 'STANDBY'}
                    </span>
                </div>
            </div>

            {/* Recessed High-Contrast Digital Glass Screen */}
            <div className="bg-[#03060c] rounded-xl border-2 border-slate-850 p-4 sm:p-6 shadow-inner space-y-3.5">
                
                {/* ROW 1: PV (Present Value) */}
                <div className="flex items-baseline justify-between border-b border-slate-900/90 pb-3">
                    <div className="flex items-baseline gap-3">
                        <span className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.45)]">
                            {pvDisplay}
                        </span>
                        <span className="text-2xl sm:text-3xl font-bold text-slate-400">
                            ℃
                        </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-slate-400 tracking-wider">
                        PV
                    </span>
                </div>

                {/* ROW 2: SV (Status & Set Value) */}
                <div className="flex items-center justify-between border-b border-slate-900/90 pb-3">
                    <div className="flex items-baseline gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl text-[#00e676] font-black self-center">➔</span>
                        {isStopped ? (
                            <span className="bg-yellow-400 text-black font-black text-xs sm:text-sm px-2 py-0.5 rounded shadow-sm self-center">
                                STOP
                            </span>
                        ) : (
                            <span className="bg-[#00e676] text-black font-black text-xs sm:text-sm px-2 py-0.5 rounded shadow-sm self-center">
                                RUN
                            </span>
                        )}
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#00e676] drop-shadow-[0_0_14px_rgba(0,230,118,0.45)]">
                            {svValueDisplay}
                        </span>
                        {svValueDisplay !== 'STOP' && (
                            <span className="text-2xl sm:text-3xl font-bold text-[#00e676]">
                                ℃
                            </span>
                        )}
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-[#00e676] tracking-wider">
                        SV
                    </span>
                </div>

                {/* ROW 3: MV (Manipulated Variable %) */}
                <div className="flex items-baseline justify-between border-b border-slate-900/90 pb-3">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#ff9800] drop-shadow-[0_0_12px_rgba(255,152,0,0.4)]">
                            {mvDisplay}
                        </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-[#ff9800] tracking-wider">
                        MV
                    </span>
                </div>

                {/* ROW 4: P/S (Pattern / Step) */}
                <div className="flex items-baseline justify-between border-b border-slate-900/90 pb-3">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#c6ff00] drop-shadow-[0_0_12px_rgba(198,255,0,0.4)]">
                            {psDisplay}
                        </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-[#c6ff00] tracking-wider">
                        P/S
                    </span>
                </div>

                {/* ROW 5: TOT M:S (Total Process Time) */}
                <div className="flex items-baseline justify-between border-b border-slate-900/90 pb-3">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#c6ff00] drop-shadow-[0_0_12px_rgba(198,255,0,0.4)]">
                            {totDisplay}
                        </span>
                    </div>
                    <div className="text-right">
                        <p className="text-lg sm:text-xl font-black text-[#c6ff00] leading-none">TOT</p>
                        <p className="text-xs sm:text-sm font-black text-[#c6ff00]">M:S</p>
                    </div>
                </div>

                {/* ROW 6: STP M:S (Step Rest Time) */}
                <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#c6ff00] drop-shadow-[0_0_12px_rgba(198,255,0,0.4)]">
                            {stpDisplay}
                        </span>
                    </div>
                    <div className="text-right">
                        <p className="text-lg sm:text-xl font-black text-[#c6ff00] leading-none">STP</p>
                        <p className="text-xs sm:text-sm font-black text-[#c6ff00]">M:S</p>
                    </div>
                </div>

            </div>
        </section>
    );
}
