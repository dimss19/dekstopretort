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
        }, 500); // Berganti setiap 0.5 detik (500ms)
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

    // Format PV: Saat offline / tidak terhubung, PV wajib '--.-'
    const pvDisplay = (isOnline && telemetry.actualTemperature !== null && telemetry.actualTemperature !== undefined)
        ? telemetry.actualTemperature.toFixed(1)
        : '--.-';

    // Format SV / Status
    // Blinking terjadi saat offline atau saat controller dalam kondisi STOP/IDLE.
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
    const targetSvFormatted = telemetry.targetTemperature !== null && telemetry.targetTemperature !== undefined
        ? telemetry.targetTemperature.toFixed(1)
        : '25.0';

    // SV berkedip bergantian antara 'Stop' dan target SV setiap 0.5 detik
    const svValueDisplay = isStopped
        ? (blinkToggle ? 'Stop' : targetSvFormatted)
        : targetSvFormatted;

    // Format MV
    const mvDisplay = (isOnline && telemetry.heatingPercent !== null && telemetry.heatingPercent !== undefined)
        ? telemetry.heatingPercent.toFixed(1)
        : '0.0';

    // Format P/S (Pattern.Step -> e.g. 02.00)
    const pVal = isOnline ? String(telemetry.pattern ?? 0).padStart(2, '0') : '00';
    const sVal = isOnline ? String(telemetry.step ?? 0).padStart(2, '0') : '00';
    const psDisplay = `${pVal}.${sVal}`;

    // Format TOT M:S (Total Process Time)
    const formatTimeDot = (val: number | null | undefined) => {
        if (val === null || val === undefined || !Number.isFinite(val)) return '00.00';
        const str = String(Math.max(0, Math.trunc(val))).padStart(4, '0');
        return `${str.slice(0, -2) || '00'}.${str.slice(-2)}`;
    };

    const totDisplay = isOnline ? formatTimeDot(telemetry.processTime) : '00.00';
    const stpDisplay = isOnline ? formatTimeDot(telemetry.remainingTime) : '00.00';
    const displayPort = serialPort || 'AUTO';

    return (
        <section className="rounded-3xl border border-slate-800 bg-[#060a12] p-6 shadow-2xl backdrop-blur-xl text-white">
            {/* Header / Title Bar */}
            <div className="mb-4 pb-3 border-b border-slate-800">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono font-bold text-slate-400 mb-1">
                    <span className="tracking-wider">PORT: {displayPort} | UPDATE : {updateTime}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-rose-950 text-rose-400 border border-rose-700'
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                        {isOnline ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                    <span className="text-xl font-black tracking-wider text-white">
                        TN
                    </span>
                    <span className="text-xl font-black tracking-[0.2em] text-white">
                        AUTONICS
                    </span>
                </div>
            </div>

            {/* Main Faceplate Digital Grid */}
            <div className="bg-[#03060c] rounded-2xl border-2 border-slate-800/80 p-5 md:p-7 shadow-inner space-y-4 font-mono">
                
                {/* ROW 1: PV (Present Value) */}
                <div className="flex items-baseline justify-between border-b border-slate-900 pb-3">
                    <div className="flex items-baseline gap-3">
                        <span className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                            {pvDisplay}
                        </span>
                        <span className="text-2xl sm:text-3xl font-bold text-slate-300">
                            ℃
                        </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-slate-400 tracking-wider">
                        PV
                    </span>
                </div>

                {/* ROW 2: SV (Status & Set Value) */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl sm:text-3xl text-[#00e676] font-black">➔</span>
                        {isStopped ? (
                            <span className="bg-[#ffeb3b] text-black font-black text-xs sm:text-sm px-2 py-0.5 rounded shadow-sm">
                                STOP
                            </span>
                        ) : (
                            <span className="bg-[#00e676] text-black font-black text-xs sm:text-sm px-2 py-0.5 rounded shadow-sm">
                                RUN
                            </span>
                        )}
                        <span className={`text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#00e676] drop-shadow-[0_0_12px_rgba(0,230,118,0.4)] transition-opacity duration-150 ${
                            isStopped ? (blinkToggle ? 'opacity-100' : 'opacity-40') : 'opacity-100'
                        }`}>
                            {svValueDisplay}
                        </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-[#00e676] tracking-wider">
                        SV
                    </span>
                </div>

                {/* ROW 3: MV (Manipulated Variable %) */}
                <div className="flex items-baseline justify-between border-b border-slate-900 pb-3">
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
                <div className="flex items-baseline justify-between border-b border-slate-900 pb-3">
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
                <div className="flex items-baseline justify-between border-b border-slate-900 pb-3">
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
