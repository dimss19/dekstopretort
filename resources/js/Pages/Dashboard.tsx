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

export default function Dashboard({ auth, tnCount, tnOnline, recipeCount = 0, controllers = [], espOnline = false, espIp = null }: DashboardProps) {
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
            <Head title="Dashboard - Industrial SCADA" />
            <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Hero Industrial Console Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-[#0d131f]/95 p-6 sm:p-8 text-white border border-slate-700/80 shadow-2xl">
                    {/* Industrial Top Accent Strip */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-yellow-400/10 blur-3xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-mono font-bold uppercase tracking-widest">
                                    CONTROL HUB // TERMINAL 01
                                </span>
                            </div>
                            <h3 className="text-2xl font-black text-white sm:text-3xl font-mono tracking-tight">
                                SELAMAT DATANG, <span className="text-yellow-400">{auth?.user?.name || 'OPERATOR'}</span>
                            </h3>
                            <p className="mt-1 text-xs sm:text-sm text-slate-400 font-mono">
                                Pilih subsistem monitoring retort: [F1] USB RS-485 Modbus RTU atau [F2] IoT ESP Gateway.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="px-3.5 py-2 rounded-xl bg-[#070b13] border border-slate-800 text-right font-mono">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">TOTAL CONTROLLER</div>
                                <div className="text-lg font-black text-yellow-400">{tnCount} <span className="text-xs text-slate-400 font-normal">UNIT</span></div>
                            </div>
                            <div className="px-3.5 py-2 rounded-xl bg-[#070b13] border border-slate-800 text-right font-mono">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">RECIPE PATTERN</div>
                                <div className="text-lg font-black text-cyan-400">{recipeCount} <span className="text-xs text-slate-400 font-normal">POLA</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2 Pilihan Utama: USB RS-485 & ESP Logger */}
                <div className="grid gap-6 lg:grid-cols-2 items-stretch">
                    {/* Pilihan 1: USB RS-485 */}
                    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0d131f]/95 p-6 sm:p-7 text-left shadow-xl transition-all duration-300 hover:border-yellow-400/80 hover:shadow-2xl">
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-yellow-300">
                                        <Cable size={14} className="text-yellow-400" />
                                        KOMUNIKASI SERIAL RS-485
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider border ${
                                        rs485Controller.is_online
                                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                                            : 'bg-rose-950/80 text-rose-300 border-rose-600/60'
                                    }`}>
                                        <span className={`h-2 w-2 rounded-full ${rs485Controller.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                                        {rs485Controller.is_online ? 'ONLINE // READY' : 'OFFLINE'}
                                    </span>
                                </div>

                                <h3 className="mt-4 text-2xl font-black tracking-tight text-white group-hover:text-yellow-400 transition-colors font-mono">
                                    USB RS-485 MODBUS RTU
                                </h3>
                                <p className="mt-2 text-xs leading-relaxed text-slate-400 font-mono">
                                    Komunikasi serial kabel langsung via Modbus RTU ke digital temperature controller untuk monitoring dan kontrol sterilisasi retort presisi tinggi.
                                </p>

                                {/* Info Box Spesifikasi RS-485 */}
                                <div className="mt-5 rounded-xl border border-slate-800 bg-[#070b13] p-4 space-y-2.5 font-mono text-xs">
                                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <span className="text-slate-400">PROTOKOL SERIAL</span>
                                        <span className="font-bold text-cyan-400">Modbus RTU (Baudrate 9600)</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <span className="text-slate-400">SERIAL PORT AKTIF</span>
                                        <span className="font-bold text-yellow-400">{rs485Controller.serial_port || 'COM Serial Port'}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <span className="text-slate-400">FITUR KONTROL</span>
                                        <span className="font-bold text-slate-200">Sterilisasi, Alarm & Pattern Recipe</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">HARDWARE MODEL</span>
                                        <span className="font-bold text-emerald-400">Autonics / Industrial Controller</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-6 space-y-2.5">
                                <Link
                                    href={route('tn.index')}
                                    className="w-full flex items-center justify-between rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black px-5 py-3 text-xs font-mono font-black uppercase tracking-wider shadow-md transition-all cursor-pointer border border-yellow-300"
                                >
                                    <span>BUKA MONITORING RS-485 [F1]</span>
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
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
                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#141b2d] hover:bg-[#1b253d] hover:border-slate-600 px-4 py-2.5 text-xs font-mono font-bold text-slate-300 transition-all shadow-sm cursor-pointer"
                                >
                                    <Wrench size={14} className="text-yellow-400" />
                                    <span>TEST PIN & RELAY RS-485</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pilihan 2: ESP Logger (IoT Gateway) */}
                    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0d131f]/95 p-6 sm:p-7 text-left shadow-xl transition-all duration-300 hover:border-yellow-400/80 hover:shadow-2xl">
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/30 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                                        <Wifi size={14} className="text-cyan-400" />
                                        IOT GATEWAY (MQTT)
                                    </span>
                                    {isEspOnline ? (
                                        <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-600/60 px-2.5 py-1 rounded-lg shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> ONLINE // READY
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">
                                            <span className="h-2 w-2 rounded-full bg-slate-500" /> OFFLINE (MENUNGGU ESP)
                                        </span>
                                    )}
                                </div>

                                <h3 className="mt-4 text-2xl font-black tracking-tight text-white group-hover:text-yellow-400 transition-colors font-mono">
                                    ESP LOGGER GATEWAY
                                </h3>
                                <p className="mt-2 text-xs leading-relaxed text-slate-400 font-mono">
                                    Sistem pemantauan mandiri retort berbasis mikrokontroler ESP32-S3 dengan transmisi telemetry MQTT nirkabel, dual sensor, dan pencatatan log otomatis.
                                </p>

                                {/* ESP Features / Info Box */}
                                <div className="mt-5 rounded-xl border border-slate-800 bg-[#070b13] p-4 space-y-2.5 font-mono text-xs">
                                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <span className="text-slate-400">PERANGKAT IOT</span>
                                        <span className="font-bold text-cyan-400">ESP32-S3 RetortLogger (RT-001)</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <span className="text-slate-400">PROTOKOL JARINGAN</span>
                                        <span className="font-bold text-slate-200">MQTT Broker (Port 1883)</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <span className="text-slate-400">SENSOR SUHU</span>
                                        <span className="font-bold text-slate-200">Dual Channel (PV1 / PV2 & F₀)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">IP ADDRESS ESP</span>
                                        {isEspOnline && currentEspIp ? (
                                            <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">{currentEspIp}</span>
                                        ) : (
                                            <span className="text-slate-500 italic">Belum Terhubung</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Link
                                    href={route('esp.monitor')}
                                    className="w-full flex items-center justify-between rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black px-5 py-3 text-xs font-mono font-black uppercase tracking-wider shadow-md transition-all cursor-pointer border border-yellow-300"
                                >
                                    <span>BUKA MONITORING ESP LOGGER</span>
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
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

