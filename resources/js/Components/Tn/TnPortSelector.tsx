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
            <div className={`inline-flex items-center gap-1.5 p-1 bg-white/90 backdrop-blur border rounded-xl shadow-sm transition-colors ${
                hasPorts ? 'border-slate-200/90' : 'border-amber-300 bg-amber-50/50'
            }`}>
                <div className="flex items-center gap-1.5 pl-2 pr-1 text-slate-500 text-xs font-bold">
                    <Usb className={`w-3.5 h-3.5 ${hasPorts ? 'text-blue-600' : 'text-amber-500'}`} />
                    <span className="hidden sm:inline">Port:</span>
                </div>

                <div className="relative">
                    <select
                        value={selectedPort}
                        onChange={(e) => handleSelectPort(e.target.value)}
                        disabled={!hasPorts || loading}
                        className={`text-xs font-mono font-bold rounded-lg py-1.5 pl-2.5 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-xs cursor-pointer ${
                            hasPorts
                                ? 'text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-300'
                                : 'text-amber-800 bg-amber-50/90 border border-amber-300'
                        }`}
                    >
                        {hasPorts ? (
                            availablePorts.map((p) => (
                                <option key={p.device} value={p.device}>
                                    {p.device} {p.description ? `— ${p.description.replace(/\(COM\d+\)/, '').trim()}` : ''}
                                </option>
                            ))
                        ) : (
                            <option value="">Tidak ada port terdeteksi</option>
                        )}
                    </select>
                </div>

                {/* Refresh Ports Button */}
                <button
                    type="button"
                    onClick={() => loadPorts(true)}
                    disabled={loading}
                    title="Pindai ulang port serial di komputer"
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                </button>

                {/* Test Connection Button */}
                <button
                    type="button"
                    onClick={handleTestPort}
                    disabled={testing || !hasPorts || !selectedPort}
                    title={hasPorts ? `Uji komunikasi ke controller pada ${selectedPort}` : 'Colokkan USB RS-485 terlebih dahulu'}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-[11px] font-bold shadow-xs transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                    <Zap className={`w-3 h-3 ${testing ? 'animate-bounce text-amber-300' : ''}`} />
                    <span>{testing ? 'Menguji...' : 'Tes'}</span>
                </button>
            </div>

            {/* USB Disconnected Badge */}
            {!hasPorts && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100/80 text-amber-900 border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>USB Belum Terpasang</span>
                </div>
            )}

            {/* Status Feedback Toast/Message */}
            {message && (
                <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all animate-in fade-in slide-in-from-top-1 ${
                        message.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                >
                    {message.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{message.text}</span>
                </div>
            )}
        </div>
    );
}
