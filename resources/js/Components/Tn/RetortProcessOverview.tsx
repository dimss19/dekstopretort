import React from 'react';
import { RetortTelemetry, formatControllerTime } from '@/Pages/Tn/retortTelemetry';

interface Props {
    telemetry: RetortTelemetry;
    controllerName: string;
    isOnline: boolean;
    commandPending: 'run' | 'stop' | 'reset' | null;
    onRun: () => void;
    onStop: () => void;
    onResetAlarm: () => void;
}

type LampState = boolean | null;

const formatNumber = (value: number | null, digits = 1) => (
    value === null ? '--' : value.toLocaleString('id-ID', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })
);

function StatusLamp({ label, state, activeColor }: { label: string; state: LampState; activeColor: string }) {
    const color = state === null ? '#475569' : state ? activeColor : '#334155';
    const status = state === null ? 'N/A' : state ? 'ON' : 'OFF';

    return (
        <div className="flex min-w-[86px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
            <span
                className={`h-3 w-3 shrink-0 rounded-full border border-white/20 ${state ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: color, boxShadow: state ? `0 0 12px ${color}` : undefined }}
            />
            <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-300">{label}</span>
                <span className="block text-[9px] font-semibold text-slate-500">{status}</span>
            </span>
        </div>
    );
}

function Metric({ label, value, unit, available = true, accent = 'text-cyan-300' }: {
    label: string;
    value: React.ReactNode;
    unit?: string;
    available?: boolean;
    accent?: string;
}) {
    return (
        <div className="rounded-md border border-slate-600/80 bg-slate-950/70 px-2.5 py-2">
            <div className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
            <div className={`mt-0.5 truncate font-mono text-sm font-black ${available ? accent : 'text-slate-500'}`}>
                {available ? value : 'BELUM DIPETAKAN'}
                {available && unit ? <span className="ml-1 text-[10px] font-semibold text-slate-500">{unit}</span> : null}
            </div>
        </div>
    );
}

function ControlButton({ label, tone, disabled, pending, onClick, reason }: {
    label: string;
    tone: 'green' | 'red' | 'amber' | 'blue' | 'slate';
    disabled: boolean;
    pending?: boolean;
    onClick?: () => void;
    reason?: string;
}) {
    const tones = {
        green: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30',
        red: 'border-red-400/60 bg-red-500/20 text-red-200 hover:bg-red-500/30',
        amber: 'border-amber-400/60 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30',
        blue: 'border-sky-400/60 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30',
        slate: 'border-slate-500 bg-slate-700/40 text-slate-300 hover:bg-slate-700/70',
    };

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={disabled && reason ? reason : label}
            className={`min-h-11 rounded-lg border px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${tones[tone]} disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-600`}
        >
            {pending ? 'Mengirim...' : label}
        </button>
    );
}

function VesselShell({ title, subtitle, children, status, statusTone }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    status: string;
    statusTone: string;
}) {
    return (
        <section className="relative flex h-[370px] flex-col overflow-hidden rounded-[46px_46px_28px_28px] border-[3px] border-slate-500 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 shadow-[inset_0_0_28px_rgba(2,6,23,0.85),0_18px_30px_rgba(2,6,23,0.45)]">
            <div className="border-b border-slate-500/80 bg-slate-950/75 px-5 py-3 text-center">
                <h3 className="text-base font-black uppercase tracking-[0.18em] text-white">{title}</h3>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</p>
            </div>
            <div className="grid flex-1 grid-cols-2 content-start gap-2 p-4">{children}</div>
            <div className="mx-4 mb-4 rounded-lg border border-slate-500/70 bg-slate-950/80 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.16em]" style={{ color: statusTone }}>
                {status}
            </div>
            <span className="absolute bottom-5 left-1/2 h-2 w-28 -translate-x-1/2 rounded-full bg-black/25 blur-sm" />
        </section>
    );
}

function UnknownValve() {
    return (
        <div className="flex flex-col items-center">
            <div className="relative h-20 w-24">
                <div className="absolute left-1/2 top-0 h-5 w-2 -translate-x-1/2 rounded bg-slate-500" />
                <div className="absolute left-1/2 top-4 h-7 w-7 -translate-x-1/2 rounded-full border-4 border-slate-500" />
                <div className="absolute bottom-0 left-2 h-0 w-0 border-y-[21px] border-r-[38px] border-y-transparent border-r-slate-500" />
                <div className="absolute bottom-0 right-2 h-0 w-0 border-y-[21px] border-l-[38px] border-y-transparent border-l-slate-500" />
            </div>
            <span className="mt-1 rounded bg-slate-900 px-2 py-1 text-[9px] font-black uppercase text-slate-500">Valve N/A</span>
        </div>
    );
}

export default function RetortProcessOverview({
    telemetry,
    controllerName,
    isOnline,
    commandPending,
    onRun,
    onStop,
    onResetAlarm,
}: Props) {
    const phaseColors: Record<RetortTelemetry['phase'], string> = {
        Offline: '#94a3b8',
        Alarm: '#f87171',
        Waiting: '#94a3b8',
        Heating: '#fb923c',
        Holding: '#34d399',
        Cooling: '#38bdf8',
        Running: '#22d3ee',
    };
    const unsupportedReason = 'I/O fisik belum dipetakan pada controller TN';
    const isProcessRunning = Boolean(
        isOnline &&
        telemetry.running &&
        telemetry.phase !== 'Waiting' &&
        telemetry.phase !== 'Offline'
    );

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-[#07101d] shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-blue-400/30 bg-gradient-to-r from-blue-950 via-blue-700 to-blue-950 px-5 py-3 text-white md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-200">Process overview</p>
                    <h2 className="mt-0.5 text-lg font-black uppercase tracking-[0.12em]">Mesin Retort (Sterilisasi)</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-md border border-blue-300/30 bg-slate-950/40 px-3 py-1.5">{controllerName}</span>
                    <span className={`rounded-md border px-3 py-1.5 ${!isOnline ? 'border-slate-500/40 bg-slate-500/10 text-slate-300' : telemetry.automatic ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-amber-300/40 bg-amber-400/15 text-amber-100'}`}>
                        MODE {!isOnline ? 'N/A' : telemetry.automatic ? 'AUTO' : 'MANUAL'}
                    </span>
                    <span className={`rounded-md border px-3 py-1.5 ${isOnline ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100' : 'border-red-300/40 bg-red-400/15 text-red-100'}`}>
                        {isOnline ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            {telemetry.alarmActive ? (
                <div role="alert" className="flex items-center justify-between gap-3 border-b border-red-400/40 bg-red-950/80 px-5 py-3 text-red-100">
                    <div>
                        <span className="text-xs font-black uppercase tracking-widest">Alarm aktif</span>
                        <span className="ml-3 text-xs text-red-200/80">
                            {[telemetry.sensorFault, ...telemetry.activeAlarms].filter(Boolean).join(' • ')}
                        </span>
                    </div>
                    <span className="h-3 w-3 shrink-0 animate-ping rounded-full bg-red-400" />
                </div>
            ) : null}

            <div className="overflow-x-auto">
                <div className="min-w-[1080px] p-5">
                    <div className="grid grid-cols-6 gap-2">
                        <StatusLamp label="Power" state={isOnline} activeColor="#22c55e" />
                        <StatusLamp label="Steam" state={null} activeColor="#38bdf8" />
                        <StatusLamp label="Burner" state={null} activeColor="#fb923c" />
                        <StatusLamp label="Air" state={null} activeColor="#38bdf8" />
                        <StatusLamp label="Angin" state={null} activeColor="#a78bfa" />
                        <StatusLamp label="Alarm" state={isOnline ? telemetry.alarmActive : null} activeColor="#ef4444" />
                    </div>

                    <div className="mt-5 grid grid-cols-[310px_1fr_350px] items-center gap-5">
                        <VesselShell title="Boiler" subtitle="Steam generator" status="I/O Boiler Belum Dipetakan" statusTone="#94a3b8">
                            <Metric label="Water Level" value="--" available={false} />
                            <Metric label="Pressure" value="--" unit="bar" available={false} />
                            <Metric label="Gas" value="--" available={false} />
                            <Metric label="Pilot Flame" value="--" available={false} />
                            <Metric label="Burner" value="--" available={false} />
                            <Metric label="Steam Ready" value="--" available={false} />
                            <div className="col-span-2">
                                <Metric label="TN Heating Output" value={formatNumber(isProcessRunning ? telemetry.heatingPercent : 0)} unit="%" available={true} accent="text-orange-300" />
                            </div>
                        </VesselShell>

                        <div className="relative flex h-[370px] flex-col items-center justify-center">
                            <p className="mb-4 rounded-md border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Jalur steam belum dipetakan
                            </p>
                            <div className="relative h-8 w-full overflow-hidden rounded-full border-4 border-slate-600 bg-slate-800 shadow-inner">
                                <div className="absolute inset-y-1 left-2 right-2 rounded-full border-t border-dashed border-slate-500" />
                            </div>
                            <div className="absolute left-1/2 top-[116px] -translate-x-1/2 rounded-full border-4 border-slate-600 bg-slate-800 p-4 shadow-xl">
                                <UnknownValve />
                            </div>
                            <div className="mt-28 grid w-full grid-cols-2 gap-2">
                                <Metric label="Steam Valve" value="--" available={false} />
                                <Metric label="Steam Flow" value="--" available={false} />
                            </div>
                        </div>

                        <VesselShell
                            title="Retort"
                            subtitle="Sterilization chamber"
                            status={telemetry.phase}
                            statusTone={phaseColors[telemetry.phase]}
                        >
                            <Metric label="Temp Aktual" value={formatNumber(telemetry.actualTemperature)} unit="°C" available={telemetry.actualTemperature !== null} />
                            <Metric label="Target Temp" value={formatNumber(telemetry.targetTemperature)} unit="°C" available={telemetry.targetTemperature !== null} accent="text-emerald-300" />
                            <Metric label="Current Step" value={isProcessRunning ? (telemetry.step ?? 0) : 0} available={true} />
                            <Metric label="Remaining" value={isProcessRunning ? formatControllerTime(telemetry.remainingTime) : '00:00'} available={true} accent="text-indigo-300" />
                            <Metric label="Door Lock" value="--" available={false} />
                            <Metric label="Compressor" value="--" available={false} />
                            <Metric label="Cooling Air" value="--" available={false} />
                            <Metric label="Safety Valve" value="--" available={false} />
                        </VesselShell>
                    </div>

                    <div className="mt-5 grid grid-cols-[310px_1fr_350px] gap-5">
                        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status controller TN</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Metric label="Pattern" value={isProcessRunning ? (telemetry.pattern ?? 0) : 0} available={true} />
                                <Metric label="Process Time" value={isProcessRunning ? formatControllerTime(telemetry.processTime) : '00:00'} available={true} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Cooling output TN</p>
                                    <p className="mt-1 text-[10px] text-slate-500">Belum diklaim sebagai water/air sampai wiring dipetakan.</p>
                                </div>
                                <span className="font-mono text-xl font-black text-sky-300">{formatNumber(isProcessRunning ? telemetry.coolingPercent : 0)}%</span>
                            </div>
                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-950">
                                <div
                                    className={`h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-300 transition-all ${telemetry.coolingActive ? 'animate-pulse' : ''}`}
                                    style={{ width: `${isProcessRunning ? (telemetry.coolingPercent ?? 0) : 0}%` }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                            <Metric label="Cooling Water" value="--" available={false} />
                            <Metric label="Cooling Air" value="--" available={false} />
                            <Metric label="Drain Valve" value="--" available={false} />
                            <Metric label="Drain Flow" value="--" available={false} />
                        </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/75 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Panel kontrol</p>
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">Kontrol tanpa mapping I/O dibuat nonaktif</p>
                        </div>
                        <div className="grid grid-cols-8 gap-2">
                            <ControlButton label="Power" tone="slate" disabled reason={unsupportedReason} />
                            <ControlButton label="Pompa Boiler" tone="blue" disabled reason={unsupportedReason} />
                            <ControlButton label="Pematik" tone="amber" disabled reason={unsupportedReason} />
                            <ControlButton label="Burner" tone="amber" disabled reason={unsupportedReason} />
                            <ControlButton label="Run" tone="green" disabled={!isOnline || telemetry.running || commandPending !== null} pending={commandPending === 'run'} onClick={onRun} reason={!isOnline ? 'Controller offline' : 'Controller sudah RUN'} />
                            <ControlButton label="Stop" tone="red" disabled={!isOnline || !telemetry.running || commandPending !== null} pending={commandPending === 'stop'} onClick={onStop} reason={!isOnline ? 'Controller offline' : 'Controller sudah STOP'} />
                            <ControlButton label="Cooling" tone="blue" disabled reason={unsupportedReason} />
                            <ControlButton
                                label="Reset Alarm"
                                tone="red"
                                disabled={!isOnline || telemetry.activeAlarms.length === 0 || commandPending !== null}
                                pending={commandPending === 'reset'}
                                onClick={onResetAlarm}
                                reason={!isOnline ? 'Controller offline' : telemetry.sensorFault ? 'Perbaiki sensor sebelum reset alarm' : 'Tidak ada alarm TN aktif'}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
