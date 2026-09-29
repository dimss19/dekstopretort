import React from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ScadaCanvas, ScadaMapping, SensorData } from '@/types';
import { RetortEvent, RetortTelemetry } from '@/Pages/Tn/retortTelemetry';
import TnNormalMonitor from './TnNormalMonitor';
import RetortIndustrialHmi from './RetortIndustrialHmi';

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
}

export default function RetortMonitorShell(props: Props) {
    const { controller, telemetry, isOnline, serialPort } = props;
    const rawControllerName = controller.name || `Controller #${controller.id}`;
    const controllerName = rawControllerName.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'TN Controller');
    const rawMachineName = controller.machine?.machine_name;
    const machineName = rawMachineName ? rawMachineName.replace(/Retort TNS/gi, 'Retort TN') : null;
    const displayName = (machineName?.toLowerCase().includes('retort') || controllerName?.toLowerCase().includes('tn'))
        ? 'Retort TN Controller'
        : (machineName ? `${machineName} (${controllerName})` : controllerName);
    const activePortDisplay = serialPort || controller.serial_port || 'AUTO';

    return (
        <AuthenticatedLayout header={
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto py-1">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">{displayName}</h1>
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
                        <span>Tipe: <strong className="font-mono text-blue-700">{controller.model_type}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Port: <strong className="font-mono text-slate-800">{activePortDisplay}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Baudrate: <strong className="font-mono text-slate-800">{controller.baudrate || 9600} bps</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Update: <strong className="text-slate-700">{props.lastUpdate}</strong></span>
                    </div>
                </div>
            </div>
        }>
            <Head title={`Monitor - ${displayName}`} />
            <div className="py-8">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8">
                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3">
                        <button
                            type="button"
                            onClick={() => props.onTabChange('monitor')}
                            className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all shadow-sm ${
                                props.activeTab === 'monitor'
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md border-none'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-800'
                            }`}
                        >
                            Monitoring Dashboard
                        </button>
                        <button
                            type="button"
                            onClick={() => props.onTabChange('scada')}
                            className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all shadow-sm flex items-center gap-2 ${
                                props.activeTab === 'scada'
                                    ? 'bg-blue-700 text-white shadow-md border-none'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-800'
                            }`}
                        >
                            <span>SCADA View</span>
                        </button>
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
                        <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-[#060b18] shadow-2xl backdrop-blur-xl">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0b1329] px-6 py-4 text-white">
                                <div>
                                    <h2 className="font-black text-white text-lg tracking-wide">Panel SCADA Mesin Retort & Boiler</h2>
                                    <p className="text-xs font-semibold text-blue-300 mt-0.5">Monitoring kontroler real-time {controllerName} ({controller.model_type}).</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black tracking-wider ${isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                                        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 bg-[#040816]">
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
