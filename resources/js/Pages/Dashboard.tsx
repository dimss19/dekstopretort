import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { PageProps } from '@/types';
import React, { useState } from 'react';
import { Wrench, ArrowRight, Cable, Wifi } from 'lucide-react';
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
    espOnline?: boolean;
    espIp?: string | null;
}

export default function Dashboard({ auth, tnCount, tnOnline, controllers = [], espOnline = false, espIp = null }: DashboardProps) {
    const [isEspOnline, setIsEspOnline] = useState<boolean>(espOnline);
    const [currentEspIp, setCurrentEspIp] = useState<string | null>(espIp);

    // Fast polling to reflect ESP connectivity and IP immediately when powered on or off
    React.useEffect(() => {
        let active = true;
        const checkStatus = async () => {
            try {
                const res = await fetch('/esp/status');
                if (res.ok && active) {
                    const data = await res.json();
                    setIsEspOnline(Boolean(data.is_online));
                    setCurrentEspIp(data.ip || null);
                }
            } catch {
                // Ignore network errors
            }
        };

        const interval = setInterval(checkStatus, 3000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const pageUi = (auth as any)?.ui || {};
    const rs485Controller = controllers.find(c => c.id === pageUi.active_tn_id) || controllers[0] || {
        id: 1,
        name: 'USB RS-485 Controller',
        model_type: 'RS-485',
        serial_port: 'COM3',
        is_online: false,
        slave_id: 1,
    };

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
                        <h3 className="text-3xl font-extrabold text-white sm:text-4xl">Selamat datang kembali, {auth?.user?.name || 'Operator'}</h3>
                        <p className="mt-2 max-w-2xl text-base text-blue-100/90 leading-relaxed">
                            Pilih sistem pemantauan retort yang Anda gunakan: <b>USB RS-485</b> atau <b>ESP Logger</b>.
                        </p>
                    </div>
                </div>

                {/* 2 Pilihan Utama: USB RS-485 & ESP Logger */}
                <div className="grid gap-8 lg:grid-cols-2 items-stretch">
                    {/* Pilihan 1: USB RS-485 */}
                    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-7 sm:p-8 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-amber-400 hover:shadow-2xl">
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-100/60 transition-transform duration-500 group-hover:scale-150 pointer-events-none" />

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-blue-700">
                                        <Cable size={14} className="text-blue-600" />
                                        KOMUNIKASI SERIAL
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border ${
                                        rs485Controller.is_online
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>
                                        <span className={`h-2 w-2 rounded-full ${rs485Controller.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                        {rs485Controller.is_online ? 'Online' : 'Offline'}
                                    </span>
                                </div>

                                <h3 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                                    USB RS-485
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    Komunikasi serial kabel langsung via Modbus RTU ke digital temperature controller untuk monitoring dan kontrol sterilisasi retort presisi tinggi.
                                </p>

                                {/* Info Box Spesifikasi RS-485 */}
                                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                        <span className="text-xs font-semibold text-slate-500">Protokol Serial</span>
                                        <span className="text-xs font-mono font-bold text-blue-700">Modbus RTU (Baudrate 9600)</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                        <span className="text-xs font-semibold text-slate-500">Serial Port</span>
                                        <span className="text-xs font-mono font-black text-slate-800">{rs485Controller.serial_port || 'COM Serial Port'}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                        <span className="text-xs font-semibold text-slate-500">Fitur Kontrol</span>
                                        <span className="text-xs font-bold text-slate-700">Sterilisasi, Alarm Relay & Pattern Recipe</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500">Tipe Hardware</span>
                                        <span className="text-xs font-bold text-emerald-700">Industrial Temperature Controller</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-7 space-y-2.5">
                                <Link
                                    href={route('tn.index')}
                                    className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-md hover:from-yellow-300 hover:to-amber-400 transition-all cursor-pointer"
                                >
                                    <span>Buka Monitoring USB RS-485</span>
                                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                </Link>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setSelectedTestController({
                                            id: rs485Controller.id,
                                            model: rs485Controller.model_type || 'RS485',
                                            serialPort: rs485Controller.serial_port,
                                            isOnline: rs485Controller.is_online,
                                        });
                                    }}
                                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white hover:bg-blue-50/70 hover:border-blue-300 px-4 py-2.5 text-xs font-black text-slate-800 transition-all shadow-sm cursor-pointer"
                                >
                                    <Wrench size={14} className="text-blue-600" />
                                    <span>Test Pin & Relay RS-485</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pilihan 2: ESP Logger (IoT Gateway) */}
                    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-7 sm:p-8 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-amber-400 hover:shadow-2xl">
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-100/60 transition-transform duration-500 group-hover:scale-150 pointer-events-none" />

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-blue-700">
                                        <Wifi size={14} className="text-blue-600" />
                                        IOT GATEWAY (MQTT)
                                    </span>
                                    {isEspOnline ? (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-sm">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                                            <span className="h-2 w-2 rounded-full bg-slate-400" /> Offline (Menunggu ESP)
                                        </span>
                                    )}
                                </div>

                                <h3 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                                    ESP Logger
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    Sistem pemantauan mandiri retort berbasis mikrokontroler ESP32-S3 dengan transmisi telemetry MQTT nirkabel, pembacaan dual sensor, dan pencatatan log otomatis.
                                </p>

                                {/* ESP Features / Info Box */}
                                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                        <span className="text-xs font-semibold text-slate-500">Perangkat IoT</span>
                                        <span className="text-xs font-mono font-black text-slate-800">ESP32-S3 RetortLogger (RT-001)</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                        <span className="text-xs font-semibold text-slate-500">Protokol Jaringan</span>
                                        <span className="text-xs font-mono font-bold text-blue-700">MQTT Broker (Port 1883)</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                                        <span className="text-xs font-semibold text-slate-500">Sensor Suhu</span>
                                        <span className="text-xs font-bold text-slate-700">Dual Channel (PV1 / PV2 & F₀ Sterilisasi)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500">IP Jaringan ESP</span>
                                        {isEspOnline && currentEspIp ? (
                                            <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">{currentEspIp}</span>
                                        ) : (
                                            <span className="text-xs font-semibold text-slate-400 italic">Belum Terhubung</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-7">
                                <Link
                                    href={route('esp.monitor')}
                                    className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-md hover:from-yellow-300 hover:to-amber-400 transition-all cursor-pointer"
                                >
                                    <span>Buka Monitoring ESP Logger</span>
                                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>
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

