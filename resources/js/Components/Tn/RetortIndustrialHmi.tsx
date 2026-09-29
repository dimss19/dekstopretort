import React from 'react';
import { SensorData } from '@/types/scada';
import { RetortTelemetry } from '@/Pages/Tn/retortTelemetry';
import { RETORT_HMI_BASE64 } from './hmiAsset';

interface Props {
    controllerName?: string;
    controllerModel?: string;
    sensorData?: SensorData;
    telemetry?: RetortTelemetry;
    isOnline?: boolean;
}

export default function RetortIndustrialHmi({
    controllerName = 'Retort TNH',
    controllerModel = 'TNH',
    sensorData,
    telemetry,
    isOnline = false,
}: Props) {
    // Live Process Values
    const isRunning = Boolean(isOnline && (telemetry?.running || (sensorData && sensorData.run_status === false)));

    // Determine model capabilities (TNS = 2 Alarms, TNH = 4 Alarms, TNL = 6 Alarms)
    const model = (controllerModel || 'TNH').toUpperCase();
    const maxAlarms = model.includes('TNS') ? 2 : (model.includes('TNL') ? 6 : 4);
    const modelBadge = model.includes('TNS') ? 'TNS' : (model.includes('TNL') ? 'TNL' : 'TNH');

    // Proper Engineering Value calculations with decimal point normalization
    const formatValue = (tempVal: number | null | undefined, rawVal: number | null | undefined, decPoint: number = 1): string => {
        if (typeof tempVal === 'number' && Number.isFinite(tempVal)) {
            return tempVal.toFixed(1);
        }
        if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
            const dec = Math.max(0, Math.min(4, Math.trunc(decPoint)));
            const val = rawVal / Math.pow(10, dec);
            return val.toFixed(1);
        }
        return '--.-';
    };

    const pv = isOnline ? formatValue(telemetry?.actualTemperature, sensorData?.pv, sensorData?.decimal_point ?? 1) : '--.-';
    const sv = formatValue(telemetry?.targetTemperature, sensorData?.sv, sensorData?.decimal_point ?? 1);

    // Valve & MV Logic: Initially 0, becomes active when heating output active
    const isValveOpen = Boolean(
        isOnline && (
            Boolean(sensorData?.out1_active) ||
            Boolean(telemetry?.heatingActive) ||
            (typeof telemetry?.heatingPercent === 'number' && telemetry.heatingPercent > 0) ||
            (typeof sensorData?.heating_mv === 'number' && sensorData.heating_mv > 0)
        )
    );

    const displayMv = (isOnline && isRunning) ? (telemetry?.heatingPercent !== null && telemetry?.heatingPercent !== undefined
        ? Math.round(telemetry.heatingPercent)
        : (typeof sensorData?.heating_mv === 'number'
            ? Math.round(sensorData.heating_mv > 100 ? sensorData.heating_mv / 10 : sensorData.heating_mv)
            : (isValveOpen ? 100 : 0))) : 0;

    const currentStep = isRunning ? Number(sensorData?.step_current ?? telemetry?.step ?? 0) : 0;
    const currentPattern = isRunning ? Number(sensorData?.pattern_current ?? telemetry?.pattern ?? 0) : 0;
    const restTime = isRunning && typeof sensorData?.rest_time === 'number'
        ? sensorData.rest_time
        : (isRunning && typeof telemetry?.remainingTime === 'number' ? telemetry.remainingTime : 0);

    const timeFormatted = String(Math.max(0, Math.trunc(restTime))).padStart(2, '0');
    const timeSec = timeFormatted.slice(-2) || '00';

    // Alarm triggers (support both telemetry.activeAlarms and sensorData flags)
    const isAlActive = (index: number) => {
        const alId = `AL${index}`;
        const alLabel = `ALARM ${index}`;
        const alKey = `al${index}`;
        return Boolean(
            telemetry?.activeAlarms?.includes(alId) ||
            telemetry?.activeAlarms?.includes(alLabel) ||
            (sensorData?.alarms && (sensorData.alarms as Record<string, boolean>)[alKey]) ||
            (typeof sensorData?.alarm_bits === 'number' && (sensorData.alarm_bits & (1 << (index - 1))) !== 0)
        );
    };

    // All available alarm lamps definition
    const allAlarmLamps = [
        {
            id: 1,
            label: 'ALARM 1',
            isActive: isAlActive(1),
            colorName: 'Merah',
            activeColor: '#ef4444',
            glowColor: 'rgba(239, 68, 68, 0.95)',
            inactiveColor: '#450a0a',
        },
        {
            id: 2,
            label: 'ALARM 2',
            isActive: isAlActive(2),
            colorName: 'Kuning',
            activeColor: '#f59e0b',
            glowColor: 'rgba(245, 158, 11, 0.95)',
            inactiveColor: '#451a03',
        },
        {
            id: 3,
            label: 'ALARM 3',
            isActive: isAlActive(3),
            colorName: 'Biru',
            activeColor: '#06b6d4',
            glowColor: 'rgba(6, 182, 212, 0.95)',
            inactiveColor: '#082f49',
        },
        {
            id: 4,
            label: 'ALARM 4',
            isActive: isAlActive(4),
            colorName: 'Hijau',
            activeColor: '#10b981',
            glowColor: 'rgba(16, 185, 129, 0.95)',
            inactiveColor: '#064e3b',
        },
        {
            id: 5,
            label: 'ALARM 5',
            isActive: isAlActive(5),
            colorName: 'Ungu',
            activeColor: '#a855f7',
            glowColor: 'rgba(168, 85, 247, 0.95)',
            inactiveColor: '#3b0764',
        },
        {
            id: 6,
            label: 'ALARM 6',
            isActive: isAlActive(6),
            colorName: 'Oranye',
            activeColor: '#f97316',
            glowColor: 'rgba(249, 115, 22, 0.95)',
            inactiveColor: '#431407',
        },
    ];

    // Filter alarms according to controller model (TNS: 2, TNH: 4, TNL: 6)
    const activeModelAlarms = allAlarmLamps.slice(0, maxAlarms);

    return (
        <div className="relative mx-auto w-full max-w-[1300px] select-none rounded-3xl border-4 border-slate-800 bg-[#030712] p-3 sm:p-5 shadow-2xl overflow-hidden font-sans">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-radial from-blue-900/20 via-slate-950/60 to-black pointer-events-none" />

            {/* TOP HEADER: CONTROLLER INFO & RUN STATUS */}
            <div className="relative z-20 mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3 px-2">
                <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-blue-500 animate-ping" />
                    <span className="text-sm font-black tracking-wide text-slate-200 uppercase">
                        {controllerName} &bull; <span className="text-blue-400 font-mono">{controllerModel}</span>
                    </span>
                </div>

                {/* SYSTEM RUN STATUS */}
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black tracking-wider border ${
                        isRunning
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                        <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {isRunning ? 'RETORT RUNNING' : 'RETORT STOPPED'}
                    </span>
                </div>
            </div>

            {/* MAIN 3D HMI SCADA STAGE */}
            <div className="relative z-10 w-full rounded-2xl bg-gradient-to-b from-slate-950 via-[#060e22] to-black border border-slate-800 p-2 sm:p-4 overflow-hidden shadow-inner flex items-center justify-center min-h-[500px] md:min-h-[640px]">
                
                {/* 3D HMI Background Image Container (Aspect Ratio Preserved) */}
                <div className="relative w-full max-w-[1100px] aspect-[16/9] flex items-center justify-center">
                    
                    {/* Inlined Ultra-Fast WebP (0ms Load / Zero Latency) */}
                    <img
                        src={RETORT_HMI_BASE64}
                        alt="Desain HMI Retort & Boiler"
                        loading="eager"
                        decoding="sync"
                        className="w-full h-full object-contain filter drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)] pointer-events-none"
                    />

                    {/* Valve Open Glow Indicator on the center pipe valve */}
                    {isValveOpen && (
                        <div className="absolute left-[50.8%] top-[58.8%] -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none">
                            <div className="w-16 h-16 rounded-full bg-red-500/30 filter blur-md animate-ping" />
                        </div>
                    )}

                    {/* ================= LEFT TANK (BOILER): STACKED PROCESS DISPLAY ================= */}
                    <div className="absolute left-[10%] sm:left-[11.2%] top-[20%] sm:top-[22%] z-20 w-[26%] sm:w-[24%] font-mono">
                        <div
                            className="w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-400/80 shadow-2xl"
                            style={{
                                background: 'linear-gradient(180deg, #edf2f7 0%, #e2e8f0 40%, #cbd5e1 80%, #bac7d5 100%)',
                                boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.9), 0 8px 22px rgba(0,0,0,0.4)',
                            }}
                        >
                            {/* Blue Header Bar (TEMP) */}
                            <div className="bg-[#1d4ed8] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1e40af] shadow-sm">
                                <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white drop-shadow">
                                    TEMP
                                </span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-blue-100">
                                    (°C)
                                </span>
                            </div>

                            {/* Section 1: Pv, Sv, Mv */}
                            <div className="p-2 sm:p-2.5 flex flex-col gap-1.5">
                                {/* Pv Row */}
                                <div className="flex items-center justify-between bg-[#f8fafc]/95 border border-slate-300 rounded-lg px-2.5 py-1 shadow-inner">
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500">Pv</span>
                                    <span className="text-sm sm:text-xl font-black text-slate-950 tracking-tight">
                                        {pv}
                                    </span>
                                </div>

                                {/* Sv Row */}
                                <div className="flex items-center justify-between bg-[#f8fafc]/95 border border-slate-300 rounded-lg px-2.5 py-1 shadow-inner">
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500">Sv</span>
                                    <span className="text-sm sm:text-xl font-black text-slate-950 tracking-tight">
                                        {sv}
                                    </span>
                                </div>

                                {/* Mv Row (0 initially, becomes active when heating/valve opens) */}
                                <div className="flex items-center justify-between bg-[#f8fafc]/95 border border-slate-300 rounded-lg px-2.5 py-1 shadow-inner">
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500">Mv</span>
                                    <div className="flex items-center gap-1 font-black text-sm sm:text-xl">
                                        <span className={isValveOpen ? 'text-amber-800 font-black' : 'text-slate-950 font-black'}>
                                            {displayMv}
                                        </span>
                                        <span className="text-slate-500 text-xs sm:text-sm font-bold">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Blue Header Bar (STEP - Di Bawah MV) */}
                            <div className="bg-[#1d4ed8] text-white px-3 py-1 text-center border-y border-[#1e40af] shadow-sm">
                                <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white drop-shadow">
                                    STEP
                                </span>
                            </div>

                            {/* Section 2: Step Tiles (Di Bawah MV) */}
                            <div className="p-2 sm:p-2.5">
                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                    {/* Pattern Tile */}
                                    <div className="bg-[#f8fafc]/95 border border-slate-300 rounded-lg py-1 px-0.5 flex flex-col items-center justify-center shadow-inner">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">PTN</span>
                                        <span className="text-xs sm:text-base font-black text-slate-950">{currentPattern}</span>
                                    </div>

                                    {/* Step Tile */}
                                    <div className="bg-[#f8fafc]/95 border border-slate-300 rounded-lg py-1 px-0.5 flex flex-col items-center justify-center shadow-inner">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">STEP</span>
                                        <span className="text-xs sm:text-base font-black text-slate-950">{currentStep}</span>
                                    </div>

                                    {/* Time Tile */}
                                    <div className="bg-[#f8fafc]/95 border border-slate-300 rounded-lg py-1 px-0.5 flex flex-col items-center justify-center shadow-inner">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">REST</span>
                                        <span className="text-xs sm:text-base font-black text-blue-900">{timeSec}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ================= RIGHT TANK (RETORT): POWER ON & MODEL-BASED ALARM LAMPS ================= */}
                    <div className="absolute right-[9.5%] sm:right-[10.5%] top-[20%] sm:top-[22%] z-20 w-[27%] sm:w-[25%] font-mono">
                        <div
                            className="w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-400/80 shadow-2xl"
                            style={{
                                background: 'linear-gradient(180deg, #edf2f7 0%, #e2e8f0 40%, #cbd5e1 80%, #bac7d5 100%)',
                                boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.9), 0 8px 22px rgba(0,0,0,0.4)',
                            }}
                        >
                            {/* Blue Header Bar (STATUS & ALARM) */}
                            <div className="bg-[#1d4ed8] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1e40af] shadow-sm">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white drop-shadow">
                                        STATUS & ALARM
                                    </span>
                                </div>
                                <span className="text-[8px] sm:text-[9px] font-black uppercase bg-blue-900/70 text-blue-100 px-1.5 py-0.5 rounded border border-blue-400/40">
                                    {modelBadge}
                                </span>
                            </div>

                            {/* Panel Body */}
                            <div className="p-2 sm:p-2.5 flex flex-col gap-1.5">
                                {/* POWER ON PILOT LAMP (Menyala saat controller TN Terhubung / isOnline) */}
                                <div className="bg-[#f8fafc]/95 border border-slate-300 rounded-lg px-2.5 py-1.5 flex items-center justify-between shadow-inner">
                                    <div className="flex items-center gap-2">
                                        {/* 3D Round Pilot Lamp Bulb for Power */}
                                        <div className="relative flex items-center justify-center">
                                            <div
                                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center p-[2px] shadow-md"
                                                style={{
                                                    background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 40%, #475569 80%, #0f172a 100%)',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.9)',
                                                }}
                                            >
                                                <div
                                                    className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-300"
                                                    style={{
                                                        backgroundColor: isOnline ? '#10b981' : '#064e3b',
                                                        boxShadow: isOnline
                                                            ? '0 0 14px 3px rgba(16, 185, 129, 0.95), inset 0 2px 4px rgba(255,255,255,0.85), inset 0 -2px 4px rgba(0,0,0,0.4)'
                                                            : 'inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(255,255,255,0.15)',
                                                    }}
                                                >
                                                    <div
                                                        className="absolute top-[8%] left-[18%] w-[55%] h-[35%] rounded-full pointer-events-none"
                                                        style={{
                                                            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 75%)',
                                                        }}
                                                    />
                                                    {isOnline && (
                                                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/90 animate-pulse shadow-sm" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] sm:text-[10px] font-black text-slate-900 tracking-tight uppercase leading-tight">
                                                POWER ON
                                            </span>
                                            <span className="text-[7px] sm:text-[8px] font-bold text-slate-500">
                                                {isOnline ? 'ONLINE / CONNECTED' : 'DISCONNECTED'}
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                            isOnline
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-slate-300 text-slate-600 font-bold'
                                        }`}
                                    >
                                        {isOnline ? 'ON' : 'OFF'}
                                    </span>
                                </div>

                                {/* Dynamic Grid of Round Alarm Indicator Lamps */}
                                <div className={`grid ${maxAlarms > 4 ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
                                    {activeModelAlarms.map((lamp) => (
                                        <div
                                            key={lamp.id}
                                            className="bg-[#f8fafc]/95 border border-slate-300 rounded-lg p-1 sm:p-1.5 flex flex-col items-center justify-center gap-0.5 shadow-inner"
                                        >
                                            {/* 3D Round Pilot Lamp Bulb with Metallic Bezel */}
                                            <div className="relative flex items-center justify-center my-0.5">
                                                <div
                                                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center p-[2px] shadow-md"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 40%, #475569 80%, #0f172a 100%)',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.9)',
                                                    }}
                                                >
                                                    <div
                                                        className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-300"
                                                        style={{
                                                            backgroundColor: lamp.isActive ? lamp.activeColor : lamp.inactiveColor,
                                                            boxShadow: lamp.isActive
                                                                ? `0 0 12px 2px ${lamp.glowColor}, inset 0 2px 4px rgba(255,255,255,0.85), inset 0 -2px 4px rgba(0,0,0,0.4)`
                                                                : 'inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(255,255,255,0.15)',
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute top-[8%] left-[18%] w-[55%] h-[35%] rounded-full pointer-events-none"
                                                            style={{
                                                                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 75%)',
                                                            }}
                                                        />
                                                        {lamp.isActive && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse shadow-sm" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Label */}
                                            <span className="text-[7px] sm:text-[8px] font-black text-slate-800 tracking-tight uppercase text-center leading-tight">
                                                {lamp.label}
                                            </span>

                                            {/* Status Badge */}
                                            <span
                                                className={`text-[6px] sm:text-[7px] font-black px-1 rounded uppercase ${
                                                    lamp.isActive
                                                        ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                                                        : 'text-slate-400 font-bold'
                                                }`}
                                            >
                                                {lamp.isActive ? 'TRIGGERED' : 'NORMAL'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
