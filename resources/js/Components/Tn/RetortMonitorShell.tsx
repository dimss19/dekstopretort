import React from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ScadaCanvas, ScadaMapping, SensorData } from '@/types';
import { RetortEvent, RetortTelemetry } from '@/Pages/Tn/retortTelemetry';
import TnNormalMonitor from './TnNormalMonitor';
import RetortIndustrialHmi from './RetortIndustrialHmi';
import TnPortSelector from './TnPortSelector';
import { Play, Square, BellOff, Loader2, Gauge, Cpu, Radio } from 'lucide-react';

interface Props {
    controller: any;
    telemetry: RetortTelemetry;
    events: RetortEvent[];
    history: any[];
    mappings: ScadaMapping[];
    canvas?: ScadaCanvas | null;
    sensorData?: SensorData;
    isOnline: boolean;
    serialPort?: string;
    commandPending: 'run' | 'stop' | 'reset' | null;
    lastUpdate: string;
    activeTab: 'monitor' | 'scada';
    onTabChange: (tab: 'monitor' | 'scada') => void;
    onRun: () => void;
    onStop: () => void;
    onResetAlarm: () => void;
    onPortChanged?: (port: string) => void;
}

export default function RetortMonitorShell(props: Props) {
    const { controller, telemetry, isOnline, serialPort, commandPending, onRun, onStop, onResetAlarm } = props;
    const rawControllerName = controller.name || `Controller #${controller.id}`;
    const controllerName = rawControllerName.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'TN Controller');
    const rawMachineName = controller.machine?.machine_name;
    const machineName = rawMachineName ? rawMachineName.replace(/Retort TNS/gi, 'Retort TN') : null;
    const displayName = (machineName?.toLowerCase().includes('retort') || controllerName?.toLowerCase().includes('tn'))
        ? 'Retort TN Controller'
        : (machineName ? `${machineName} (${controllerName})` : controllerName);
    const activePortDisplay = serialPort || controller.serial_port || 'AUTO';

    const isRunning = Boolean(isOnline && telemetry.running);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'F1') {
                event.preventDefault();
                props.onTabChange('monitor');
            } else if (event.key === 'F2') {
                event.preventDefault();
                props.onTabChange('scada');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [props.onTabChange]);

    return (
        <AuthenticatedLayout header={
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between max-w-7xl mx-auto py-1">
                {/* Controller Title & Status */}
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="h-3 w-1.5 bg-yellow-400 rounded-xs" />
                            <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white uppercase">
                                {displayName}
                            </h1>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-mono font-black uppercase tracking-wider border ${
                            isOnline
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'bg-rose-950/80 text-rose-300 border-rose-600/80'
                        }`}>
                            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                            {isOnline ? 'ONLINE // READY' : 'OFFLINE // DISCONNECTED'}
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-slate-400">
                        <span>MODEL: <strong className="text-yellow-400">{(controller.model_type || 'TN').replace(/TNS/gi, 'TN')}</strong></span>
                        <span className="text-slate-600">|</span>
                        <span>SLAVE: <strong className="text-slate-200">#{controller.slave_id ?? 1}</strong></span>
                        <span className="text-slate-600">|</span>
                        <span>UPDATE: <strong className="text-slate-300">{props.lastUpdate}</strong></span>
                    </div>
                </div>

                {/* Right Header Toolbar: Port Selector + Industrial Command Station */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Port Selector */}
                    <TnPortSelector
                        controllerId={controller.id}
                        controllerModel={controller.model_type}
                        currentPort={activePortDisplay}
                        isOnline={isOnline}
                        onPortChanged={props.onPortChanged}
                    />

                    {/* Industrial Command Buttons (RUN / STOP / RESET) */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-inner">
                        {/* RUN BUTTON */}
                        <button
                            type="button"
                            onClick={onRun}
                            disabled={!isOnline || isRunning || commandPending !== null}
                            title={!isOnline ? 'Controller offline' : (isRunning ? 'Controller sedang berjalan' : 'Jalankan Proses Retort (RUN)')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                                isRunning
                                    ? 'bg-emerald-950/60 text-emerald-500 border border-emerald-800/60 cursor-not-allowed opacity-70'
                                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                        >
                            {commandPending === 'run' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>RUN</span>
                        </button>

                        {/* STOP BUTTON */}
                        <button
                            type="button"
                            onClick={onStop}
                            disabled={!isOnline || !isRunning || commandPending !== null}
                            title={!isOnline ? 'Controller offline' : (!isRunning ? 'Controller sudah dalam kondisi STOP' : 'Hentikan / Jeda Proses Retort (STOP)')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                                !isRunning
                                    ? 'bg-rose-950/60 text-rose-500 border border-rose-800/60 cursor-not-allowed opacity-70'
                                    : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white border border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.35)] disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                        >
                            {commandPending === 'stop' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Square className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>STOP</span>
                        </button>

                        {/* RESET ALARM BUTTON */}
                        <button
                            type="button"
                            onClick={onResetAlarm}
                            disabled={!isOnline || commandPending !== null}
                            title="Reset Alarm Buzzer & Output Controller"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black rounded-lg text-xs font-mono font-black uppercase tracking-wider border border-yellow-300 shadow-[0_0_12px_rgba(245,158,11,0.35)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {commandPending === 'reset' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <BellOff className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">RESET</span>
                        </button>
                    </div>
                </div>
            </div>
        }>
            <Head title={`Monitor - ${displayName}`} />
            <div className="py-6">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8">
                    {/* Technical Navigation Tabs */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => props.onTabChange('monitor')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all border cursor-pointer ${
                                    props.activeTab === 'monitor'
                                        ? 'bg-yellow-400 text-black border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                        : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <Gauge className="w-3.5 h-3.5" />
                                <span>MONITORING FACEPLATE [F1]</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => props.onTabChange('scada')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all border cursor-pointer ${
                                    props.activeTab === 'scada'
                                        ? 'bg-yellow-400 text-black border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                        : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <Cpu className="w-3.5 h-3.5" />
                                <span>SCADA MIMIC VIEW [F2]</span>
                            </button>
                        </div>

                        {/* Telemetry Status Beacon */}
                        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
                            <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                            <span>PHASE: <strong className="text-yellow-400 font-bold uppercase">{telemetry.phase || 'STANDBY'}</strong></span>
                        </div>
                    </div>

                    {props.activeTab === 'monitor' ? (
                        <TnNormalMonitor
                            controllerId={controller.id}
                            controllerModel={controller.model_type}
                            telemetry={telemetry}
                            history={props.history}
                            isOnline={isOnline}
                            serialPort={activePortDisplay}
                        />
                    ) : (
                        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#080d18] shadow-2xl">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0e1628] px-6 py-4 text-white">
                                <div>
                                    <h2 className="font-mono font-black text-white text-base tracking-wider uppercase">
                                        // Panel Mimic SCADA Mesin Retort & Boiler
                                    </h2>
                                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                                        Monitoring kontroler real-time {controllerName} ({controller.model_type}).
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-mono font-black tracking-wider border ${
                                        isOnline
                                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                            : 'bg-rose-950/80 text-rose-300 border-rose-600'
                                    }`}>
                                        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 bg-[#060a14]">
                                <RetortIndustrialHmi
                                    controllerName={controllerName}
                                    controllerModel={controller.model_type}
                                    sensorData={props.sensorData}
                                    telemetry={telemetry}
                                    isOnline={isOnline}
                                />
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
