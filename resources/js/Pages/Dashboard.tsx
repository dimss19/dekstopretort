import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { PageProps } from '@/types';
import React, { useState } from 'react';
import { Wrench, ArrowRight, Activity, CheckCircle, XCircle, Play, Square, Loader2 } from 'lucide-react';
import ControllerPinTestModal from '@/Components/Tn/ControllerPinTestModal';

interface TnControllerItem {
    id: number;
    name: string;
    model_type: string;
    serial_port: string | null;
    is_online: boolean;
    slave_id: number;
}

interface DashboardProps extends PageProps {
    tnCount: number;
    tnOnline: number;
    recipeCount: number;
    controllers?: TnControllerItem[];
}

const controllerTypes = [
    { 
        model: 'TNS', 
        title: 'TNS Controller', 
        label: 'Compact Setup (48×48)', 
        desc: 'Controller ringkas dengan 2 Alarm Relay dan 2 Control Output (OUT1/OUT2).', 
        pinInfo: 'OUT1: 1-2 · OUT2: 3-4 · AL1-2: 13-16 · A/B: Skrup',
        badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-400/20'
    },
    { 
        model: 'TNH', 
        title: 'TNH Controller', 
        label: 'Standard Line (48×96)', 
        desc: 'Controller standar industri dengan 4 Alarm Output dan dual CT monitoring.', 
        pinInfo: 'OUT1: 3-4 · OUT2: 5-6 · AL1-4: 7-10, 15-18 · A/B: Pin 13/14',
        badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-400/20'
    },
    { 
        model: 'TNL', 
        title: 'TNL Controller', 
        label: 'Extended I/O (96×96)', 
        desc: 'Controller berukuran besar dengan fleksibilitas hingga 6 Alarm Output.', 
        pinInfo: 'OUT1: 3-4 · OUT2: 5-6 · AL1-6 · A/B: Pin 14/13',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-400/20'
    },
];

export default function Dashboard({ auth, tnCount, tnOnline, controllers = [] }: DashboardProps) {
    const [selectedTestController, setSelectedTestController] = useState<{
        id: number;
        model: string;
        serialPort: string | null;
        isOnline: boolean;
    } | null>(null);

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />
            <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Hero Banner (Royal Blue & Yellow Accent) */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 p-8 shadow-xl text-white border border-blue-800/60">
                    <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none"></div>
                    <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                        <h3 className="text-3xl font-extrabold text-white sm:text-4xl">Selamat datang kembali, {auth.user.name}</h3>
                        <p className="mt-2 max-w-2xl text-base text-blue-100/90 leading-relaxed">
                            Pilih tipe controller Autonics TN Series di bawah untuk membuka sistem monitoring realtime atau jalankan <b>Pin Testing</b> langsung dari dashboard.
                        </p>
                    </div>
                </div>

                {/* Controller Selection Grid */}
                <div className="grid gap-6 md:grid-cols-3">
                    {controllerTypes.map((item) => {
                        const ctrl = controllers.find(c => c.model_type?.toUpperCase() === item.model) || {
                            id: item.model === 'TNS' ? 1 : item.model === 'TNH' ? 2 : 3,
                            name: item.title,
                            model_type: item.model,
                            serial_port: 'COM6',
                            is_online: false,
                            slave_id: 1,
                        };

                        return (
                            <div
                                key={item.model}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-7 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-400 hover:shadow-2xl"
                            >
                                <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-blue-100/60 transition-transform duration-500 group-hover:scale-150 pointer-events-none" />
                                
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="inline-block rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                                            {item.label}
                                        </span>
                                        {ctrl.is_online && (
                                            <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                                <CheckCircle size={14} /> Online
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                                        {item.desc}
                                    </p>
                                </div>

                                {/* Action Buttons (Open Monitoring & Pin Test) */}
                                <div className="mt-7 space-y-2.5">
                                    <Link
                                        href={route('tn.quick-start', item.model)}
                                        className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-md hover:from-yellow-300 hover:to-amber-400 transition-all cursor-pointer"
                                    >
                                        <span>Buka Monitoring {item.model}</span>
                                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                    </Link>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setSelectedTestController({
                                                id: ctrl.id,
                                                model: item.model,
                                                serialPort: ctrl.serial_port,
                                                isOnline: ctrl.is_online,
                                            });
                                        }}
                                        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white hover:bg-blue-50/70 hover:border-blue-300 px-4 py-2.5 text-xs font-black text-slate-800 transition-all shadow-sm cursor-pointer"
                                    >
                                        <Wrench size={14} className="text-blue-600" />
                                        <span>Test Pin & Relay {item.model}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ESP32 Monitoring Logger Section (Below 3 Columns) */}
                <div className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-7 sm:p-8 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-2xl">
                    <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-blue-100/60 transition-transform duration-500 group-hover:scale-150 pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <span className="inline-block rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                                    IOT GATEWAY LOGGER (ESP32)
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> MQTT Telemetry
                                </span>
                            </div>

                            <h3 className="text-3xl font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                                ESP Monitoring Logger
                            </h3>

                            <p className="text-sm leading-relaxed text-slate-600 max-w-3xl">
                                Sistem pemantauan mandiri retort berbasis IoT ESP32 dengan integrasi telemetry MQTT, pembacaan suhu sterilisasi (PV/SV), serta pencatatan log proses otomatis.
                            </p>
                        </div>

                        <div className="shrink-0">
                            <Link
                                href={route('esp.monitor')}
                                className="flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-md hover:from-yellow-300 hover:to-amber-400 transition-all cursor-pointer whitespace-nowrap"
                            >
                                <span>Buka Monitoring ESP</span>
                                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Pin Test Interaktif */}
            {selectedTestController && (
                <ControllerPinTestModal
                    controllerId={selectedTestController.id}
                    model={selectedTestController.model}
                    serialPort={selectedTestController.serialPort}
                    isOnline={selectedTestController.isOnline}
                    onClose={() => setSelectedTestController(null)}
                />
            )}
        </AuthenticatedLayout>
    );
}

