import React, { useState, useEffect, useRef } from 'react';
import { Usb, RefreshCw, Zap, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface PortItem {
    device: string;
    description: string;
    manufacturer?: string;
    serial_number?: string;
}

interface Props {
    controllerId: number;
    controllerModel?: string;
    currentPort?: string;
    isOnline: boolean;
    onPortChanged?: (port: string) => void;
}

export default function TnPortSelector({
    controllerId,
    controllerModel = 'TN',
    currentPort = '',
    isOnline,
    onPortChanged
}: Props) {
    const [selectedPort, setSelectedPort] = useState<string>('');
    const [availablePorts, setAvailablePorts] = useState<PortItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    const lastSavedPortRef = useRef<string>('');

    const loadPorts = async (forceFresh = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const url = route('tn.port.list', controllerId) + (forceFresh ? '?fresh=1' : '');
            const res = await fetch(url, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.ports)) {
                setAvailablePorts(data.ports);

                if (data.ports.length === 0) {
                    setSelectedPort('');
                } else {
                    const portDevices = data.ports.map((p: PortItem) => p.device);
                    let targetPort = selectedPort;

                    // Jika port yang dipilih sebelumnya tidak ada dalam daftar yang tersedia di sistem
                    if (!targetPort || !portDevices.includes(targetPort)) {
                        targetPort = (data.current_port && portDevices.includes(data.current_port))
                            ? data.current_port
                            : data.ports[0].device;
                        setSelectedPort(targetPort);

                        // Simpan ke controller jika berubah
                        if (targetPort && targetPort !== lastSavedPortRef.current) {
                            lastSavedPortRef.current = targetPort;
                            savePortToBackend(targetPort, false);
                        }
                    }
                }
            }
        } catch {
            // Ignore network errors
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPorts(true);
        // Polling setiap 4 detik untuk mendeteksi tancap/cabut kabel USB otomatis
        const timer = setInterval(() => {
            loadPorts(false);
        }, 4000);
        return () => clearInterval(timer);
    }, [controllerId]);

    const savePortToBackend = async (portToSave: string, notifyUser = true) => {
        try {
            const res = await fetch(route('tn.port.select', controllerId), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
                body: JSON.stringify({ port: portToSave, mode: 'manual' }),
            });
            const data = await res.json();
            if (data.success) {
                lastSavedPortRef.current = portToSave;
                if (notifyUser) {
                    setMessage({ text: data.message || `Port ${portToSave} disimpan.`, type: 'success' });
                    setTimeout(() => setMessage(null), 3000);
                }
                if (onPortChanged) {
                    onPortChanged(portToSave);
                }
            }
        } catch (err: any) {
            if (notifyUser) {
                setMessage({ text: `Gagal menyimpan port: ${err.message}`, type: 'error' });
            }
        }
    };

    const handleSelectPort = (newPort: string) => {
        if (!newPort) return;
        setSelectedPort(newPort);
        setMessage(null);
        savePortToBackend(newPort, true);
    };

    const handleTestPort = async () => {
        if (!selectedPort) {
            setMessage({ text: 'Pilih port yang tersedia terlebih dahulu.', type: 'error' });
            return;
        }

        setTesting(true);
        setMessage(null);
        try {
            const res = await fetch(route('tn.port.test', controllerId), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
                body: JSON.stringify({ port: selectedPort }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ text: data.message || `Koneksi ${selectedPort} berhasil!`, type: 'success' });
                if (onPortChanged && data.serial_port) {
                    onPortChanged(data.serial_port);
                }
            } else {
                setMessage({ text: data.message || `Gagal terhubung ke ${selectedPort}.`, type: 'error' });
            }
        } catch (err: any) {
            setMessage({ text: `Tes koneksi gagal: ${err.message}`, type: 'error' });
        } finally {
            setTesting(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const hasPorts = availablePorts.length > 0;

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* Port Selector Dropdown & Actions */}
            <div className={`inline-flex items-center gap-1.5 p-1 bg-[#0b101b]/95 backdrop-blur-md border rounded-xl shadow-lg transition-colors ${
                hasPorts ? 'border-slate-700/80' : 'border-amber-500/70 bg-amber-950/40'
            }`}>
                <div className="flex items-center gap-1.5 pl-2.5 pr-1 text-slate-400 text-xs font-mono font-bold">
                    <Usb className={`w-3.5 h-3.5 ${hasPorts ? 'text-yellow-400' : 'text-amber-500'}`} />
                    <span className="hidden sm:inline uppercase tracking-wider text-[11px]">PORT:</span>
                </div>

                <div className="relative">
                    <select
                        value={selectedPort}
                        onChange={(e) => handleSelectPort(e.target.value)}
                        disabled={!hasPorts || loading}
                        className={`text-xs font-mono font-bold rounded-lg py-1.5 pl-2.5 pr-8 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition cursor-pointer appearance-none ${
                            hasPorts
                                ? 'text-slate-100 bg-[#141b2d] hover:bg-[#1a233a] border border-slate-700/80 shadow-inner'
                                : 'text-amber-200 bg-amber-950/70 border border-amber-600/60'
                        }`}
                    >
                        {hasPorts ? (
                            availablePorts.map((p) => (
                                <option key={p.device} value={p.device} className="bg-slate-900 text-white">
                                    {p.device} {p.description ? `— ${p.description.replace(/\(COM\d+\)/, '').trim()}` : ''}
                                </option>
                            ))
                        ) : (
                            <option value="" className="bg-slate-900 text-amber-300">Tidak ada port terdeteksi</option>
                        )}
                    </select>
                </div>

                {/* Refresh Ports Button */}
                <button
                    type="button"
                    onClick={() => loadPorts(true)}
                    disabled={loading}
                    title="Pindai ulang port serial di komputer"
                    className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-slate-800/80 rounded-lg transition disabled:opacity-50 cursor-pointer border border-transparent hover:border-slate-700"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-yellow-400' : ''}`} />
                </button>

                {/* Test Connection Button */}
                <button
                    type="button"
                    onClick={handleTestPort}
                    disabled={testing || !hasPorts || !selectedPort}
                    title={hasPorts ? `Uji komunikasi ke controller pada ${selectedPort}` : 'Colokkan USB RS-485 terlebih dahulu'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black rounded-lg text-[11px] font-mono font-extrabold uppercase tracking-wider shadow-sm transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed border border-yellow-300"
                >
                    <Zap className={`w-3 h-3 ${testing ? 'animate-bounce text-black' : 'text-black'}`} />
                    <span>{testing ? 'UJI...' : 'TEST'}</span>
                </button>
            </div>

            {/* USB Disconnected Badge */}
            {!hasPorts && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60 shadow-sm animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>USB BELUM TERDETEKSI</span>
                </div>
            )}

            {/* Status Feedback Toast/Message */}
            {message && (
                <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all animate-in fade-in slide-in-from-top-1 shadow-md ${
                        message.type === 'success'
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/60'
                            : 'bg-rose-950/90 text-rose-300 border-rose-600/60'
                    }`}
                >
                    {message.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span>{message.text}</span>
                </div>
            )}
        </div>
    );
}
