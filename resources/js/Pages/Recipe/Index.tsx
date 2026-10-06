import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';

interface RecipeStep {
    id: number;
    step_number: number;
    step_name: string;
    target_sv: number;
    duration: number;
    end_action?: string;
}

interface Recipe {
    id: number;
    recipe_code: string;
    name: string;
    status: string;
    time_unit?: string;
    step_count?: number;
    created_at: string;
    steps?: RecipeStep[];
}

interface Controller {
    id: number;
    name: string;
    is_online: boolean;
    serial_port?: string;
    slave_id?: number;
}

export default function Index({ recipes = [], controllers = [] }: { recipes?: Recipe[], controllers?: Controller[] }) {
    const pageProps = usePage().props as any;
    const activeTnId = pageProps.ui?.active_tn_id;
    const flash = pageProps.flash;

    // Prioritize online controller, then activeTnId, then first available
    const onlineCtrl = controllers.find(c => c.is_online);
    const defaultControllerId = (onlineCtrl ? onlineCtrl.id : activeTnId) || (controllers.length > 0 ? controllers[0].id : '');

    const [selectedController, setSelectedController] = useState<number | string>(defaultControllerId);
    const [isScanning, setIsScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
    const [applyingId, setApplyingId] = useState<number | null>(null);

    // Popup modal state when all patterns already exist with matching variables
    const [showIdenticalModal, setShowIdenticalModal] = useState(false);
    const [identicalDetails, setIdenticalDetails] = useState<any>(null);

    // Sync flash message from backend redirects
    useEffect(() => {
        if (flash?.all_identical) {
            setShowIdenticalModal(true);
            setIdenticalDetails(flash.scan_result || null);
            setScanMessage({ text: 'Semua pattern sudah berhasil di load.', type: 'success' });
        } else if (flash?.error) {
            setScanMessage({ text: flash.error, type: 'error' });
        } else if (flash?.success) {
            setScanMessage({ text: flash.success, type: 'success' });
        }
    }, [flash]);

    const activeControllerObj = controllers.find(c => String(c.id) === String(selectedController)) || onlineCtrl || controllers[0];

    const handleApplyPattern = (recipeId: number, recipeName: string) => {
        const targetController = selectedController || defaultControllerId;
        const targetCtrlName = activeControllerObj?.name || 'Controller';

        if (!confirm(`Kirim dan terapkan '${recipeName}' langsung ke memori ${targetCtrlName} via Modbus RS-485?`)) {
            return;
        }

        setApplyingId(recipeId);
        setScanMessage({ text: `Menulis parameter '${recipeName}' ke ${targetCtrlName} via Modbus...`, type: 'info' });

        router.post(
            route('tn.recipes.apply', { recipe: recipeId, tn: targetController || undefined }),
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const pageFlash = (page.props as any).flash;
                    if (pageFlash?.error) {
                        setScanMessage({ text: pageFlash.error, type: 'error' });
                    } else {
                        setScanMessage({
                            text: pageFlash?.success || `Pattern '${recipeName}' berhasil ditulis ke ${targetCtrlName}!`,
                            type: 'success',
                        });
                    }
                },
                onError: (errors) => {
                    const errMsg = (Object.values(errors)[0] as string) || 'Gagal menulis pattern ke TN Controller.';
                    setScanMessage({ text: errMsg, type: 'error' });
                },
                onFinish: () => {
                    setApplyingId(null);
                },
            }
        );
    };

    const handleAutoScan = () => {
        const targetController = selectedController || defaultControllerId;
        const targetCtrlName = activeControllerObj?.name || 'Controller TN';

        if (!targetController) {
            setScanMessage({ text: 'Tidak ada controller yang dipilih atau terdaftar.', type: 'error' });
            return;
        }

        if (!confirm(`PERINGATAN: Memindai semua pattern dari ${targetCtrlName} mengharuskan controller dalam mode STOP.\n\nApakah Anda ingin melanjutkan?`)) {
            return;
        }

        setIsScanning(true);
        setScanMessage({
            text: `Memindai seluruh pola sterilisasi dari ${targetCtrlName} via Modbus RS-485... Harap tunggu beberapa detik.`,
            type: 'info',
        });

        router.post(
            route('tn.recipes.scan-all'),
            { tn_id: targetController },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const pageFlash = (page.props as any).flash;
                    if (pageFlash?.all_identical) {
                        setShowIdenticalModal(true);
                        setIdenticalDetails(pageFlash.scan_result || null);
                        setScanMessage({
                            text: 'Semua pattern sudah berhasil di load.',
                            type: 'success',
                        });
                    } else if (pageFlash?.error) {
                        setScanMessage({ text: pageFlash.error, type: 'error' });
                    } else {
                        setScanMessage({
                            text: pageFlash?.success || `Berhasil memindai dan menyinkronkan seluruh pola pattern dari ${targetCtrlName}!`,
                            type: 'success',
                        });
                    }
                },
                onError: (errors) => {
                    const errMsg = (Object.values(errors)[0] as string) || 'Gagal memindai pattern dari controller. Pastikan kabel RS-485 terhubung.';
                    setScanMessage({ text: errMsg, type: 'error' });
                },
                onFinish: () => {
                    setIsScanning(false);
                },
            }
        );
    };

    const formatSv = (rawSv: number) => {
        const sv = Number(rawSv) || 0;
        return (sv > 300 ? sv / 10.0 : sv).toFixed(1);
    };

    const formatStepDuration = (val: number | string | undefined, timeUnit?: string) => {
        const num = Math.max(0, Math.floor(Number(val) || 0));
        const hi = Math.floor(num / 100);
        const lo = num % 100;
        if (hi > 0 && lo > 0) {
            return timeUnit === 'HH.MM' ? `${hi}j ${lo}m` : `${hi}m ${lo}s`;
        } else if (hi > 0) {
            return timeUnit === 'HH.MM' ? `${hi} jam` : `${hi} menit`;
        } else {
            return timeUnit === 'HH.MM' ? `${lo} menit` : `${lo} detik`;
        }
    };

    const formatTotalPatternDuration = (steps?: RecipeStep[], timeUnit?: string): string => {
        if (!steps || steps.length === 0) return '0 menit';
        let totalBase = 0;
        for (const s of steps) {
            const num = Math.max(0, Math.floor(Number(s.duration) || 0));
            const hi = Math.floor(num / 100);
            const lo = num % 100;
            // In MM.SS: hi is minutes, lo is seconds -> total seconds = hi*60 + lo
            // In HH.MM: hi is hours, lo is minutes -> total minutes = hi*60 + lo
            totalBase += (hi * 60) + lo;
        }
        if (totalBase === 0) return '0 menit';

        if (timeUnit === 'HH.MM') {
            const hours = Math.floor(totalBase / 60);
            const mins = totalBase % 60;
            if (hours > 0 && mins > 0) return `${hours} jam ${mins} menit`;
            if (hours > 0) return `${hours} jam`;
            return `${mins} menit`;
        } else {
            const mins = Math.floor(totalBase / 60);
            const secs = totalBase % 60;
            if (mins > 0 && secs > 0) return `${mins} menit ${secs} detik`;
            if (mins > 0) return `${mins} menit`;
            return `${secs} detik`;
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Pattern Management</h1>
                        <p className="text-sm font-semibold text-slate-600">
                            Kelola, simpan, dan tulis profil sterilisasi langsung ke controller retort
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Controller Selector */}
                        {controllers.length > 0 && (
                            <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm text-xs backdrop-blur-md">
                                <span className="text-slate-500 font-bold">Target Controller:</span>
                                <div className="relative flex items-center">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                            activeControllerObj?.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
                                        }`}
                                    />
                                    <select
                                        value={selectedController}
                                        onChange={(e) => setSelectedController(e.target.value)}
                                        className="bg-transparent border-none text-xs font-black text-slate-900 focus:ring-0 py-0.5 pl-0 pr-6 cursor-pointer"
                                    >
                                        {controllers.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.is_online ? '(Online)' : '(Offline)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <Link
                            href={route('tn.recipes.create')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black px-4 py-2.5 shadow-md transition-all border border-blue-800"
                        >
                            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                            </svg>
                            Create
                        </Link>

                        <button
                            onClick={handleAutoScan}
                            disabled={isScanning || !activeControllerObj}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 text-xs font-black px-5 py-2.5 shadow-md transition-all border-none disabled:opacity-50"
                        >
                            {isScanning ? (
                                <>
                                    <svg className="h-4 w-4 animate-spin text-slate-950" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Scanning Controller...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Auto Scan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Pattern Management" />

            <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Alert Notification */}
                {scanMessage.text && (
                    <div
                        className={`mb-6 rounded-2xl p-4 text-xs font-bold border shadow-sm flex items-start justify-between gap-3 ${
                            scanMessage.type === 'error'
                                ? 'bg-rose-50 text-rose-900 border-rose-300'
                                : scanMessage.type === 'success'
                                ? 'bg-amber-50 text-amber-950 border-amber-400'
                                : 'bg-blue-50 text-blue-900 border-blue-300'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            {scanMessage.type === 'error' && (
                                <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            {scanMessage.type === 'success' && (
                                <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            {scanMessage.type === 'info' && (
                                <svg className="w-5 h-5 text-blue-600 shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                            <p className="leading-relaxed">{scanMessage.text}</p>
                        </div>
                        <button
                            onClick={() => setScanMessage({ text: '', type: '' })}
                            className="text-slate-400 hover:text-slate-700 text-sm font-black px-1.5 py-0.5 rounded-lg hover:bg-black/5"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {recipes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 p-16 text-center text-slate-500 bg-white/90 shadow-sm backdrop-blur-xl">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <p className="text-xl font-black text-slate-900">Belum ada pattern ditemukan.</p>
                        <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md mx-auto">
                            Mulai dengan memindai dari memori hardware Controller Autonics TN atau buat pola profil baru secara manual.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={handleAutoScan}
                                disabled={isScanning || !activeControllerObj}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 text-xs font-black px-5 py-2.5 shadow-md transition-all border-none disabled:opacity-50"
                            >
                                <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {isScanning ? 'Memindai...' : `Auto Scan dari ${activeControllerObj?.name || 'Controller'}`}
                            </button>
                            <Link
                                href={route('tn.recipes.create')}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black px-5 py-2.5 shadow-md transition-all border border-blue-800"
                            >
                                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                                Buat Pattern Baru
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {recipes.map((recipe) => {
                            const stepsCount = recipe.step_count || (recipe.steps ? recipe.steps.length : 0);
                            const totalDurationStr = formatTotalPatternDuration(recipe.steps, recipe.time_unit);
                            const maxSv = recipe.steps && recipe.steps.length > 0
                                ? Math.max(...recipe.steps.map((s: any) => Number(s.target_sv) || 0))
                                : 0;

                            return (
                                <div
                                    key={recipe.id}
                                    className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-lg border border-slate-200/90 transition-all hover:shadow-xl backdrop-blur-xl group hover:border-amber-300"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                                            <h3 className="text-base font-black text-slate-900 truncate" title={recipe.name}>
                                                {recipe.name}
                                            </h3>
                                            <span className="shrink-0 rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-[11px] font-black text-amber-900">
                                                {recipe.status}
                                            </span>
                                        </div>

                                        <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Kode Pattern:</span>
                                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                    {recipe.recipe_code || 'N/A'}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Jumlah Step:</span>
                                                <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                                    {stepsCount} steps
                                                </span>
                                            </div>

                                            {recipe.steps && recipe.steps.length > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500">Total Durasi:</span>
                                                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                        {totalDurationStr}
                                                    </span>
                                                </div>
                                            )}

                                            {maxSv > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500">Target SV Maks:</span>
                                                    <span className="font-mono font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                                        {formatSv(maxSv)}°C
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Satuan Waktu:</span>
                                                <span className="font-mono font-bold text-slate-800">{recipe.time_unit || 'MM.SS'}</span>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Dibuat:</span>
                                                <span className="text-slate-700">
                                                    {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString('id-ID') : '-'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Steps Preview Pill Bar */}
                                        {recipe.steps && recipe.steps.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                    Preview Step (Target SV / Durasi):
                                                </p>
                                                <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
                                                    {recipe.steps.map((st) => (
                                                        <span
                                                            key={st.id || st.step_number}
                                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700"
                                                        >
                                                            S{st.step_number}: {formatSv(st.target_sv)}°C ({formatStepDuration(st.duration, recipe.time_unit)})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                        <button
                                            onClick={() => {
                                                if (confirm(`Hapus pattern '${recipe.name}' dari database?`)) {
                                                    router.delete(route('tn.recipes.destroy', recipe.id));
                                                }
                                            }}
                                            className="text-xs font-extrabold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl transition-colors"
                                        >
                                            Delete
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleApplyPattern(recipe.id, recipe.name)}
                                                disabled={applyingId === recipe.id}
                                                className="inline-flex items-center gap-1.5 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-yellow-300 hover:to-amber-400 shadow-sm px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                                                title={`Tulis parameter pattern ini ke memori hardware ${activeControllerObj?.name || 'Controller TN'}`}
                                            >
                                                {applyingId === recipe.id ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Writing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                        </svg>
                                                        Write
                                                    </>
                                                )}
                                            </button>

                                            <Link
                                                href={route('tn.recipes.edit', recipe.id)}
                                                className="text-xs font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition-colors"
                                            >
                                                Edit
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Popup: Semua Pattern Berhasil di-Load (Variabel Identik) */}
            <Modal show={showIdenticalModal} onClose={() => setShowIdenticalModal(false)} maxWidth="md">
                <div className="p-6 sm:p-8 text-center bg-white">
                    {/* Glow & Badge */}
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-5">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    {/* Modal Heading */}
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
                        Semua pattern sudah berhasil di load
                    </h3>

                    {/* Description */}
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed max-w-sm mx-auto mb-6">
                        Seluruh pola profil sterilisasi pada <span className="font-bold text-slate-900">{identicalDetails?.controller_name || activeControllerObj?.name || 'Controller'}</span> sudah ada di database dan semua variabelnya (Target SV, durasi, step) sudah 100% identik.
                    </p>

                    {/* Variable Details Box */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 mb-6 text-left space-y-2.5 text-xs font-semibold">
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Controller Sumber:</span>
                            <span className="font-mono font-bold text-slate-900">
                                {identicalDetails?.controller_name || activeControllerObj?.name || 'TNS Controller'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Status Variabel:</span>
                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2.5 py-0.5 rounded-lg text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                100% Identik & Sama
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Pola Terverifikasi:</span>
                            <span className="font-mono font-bold text-blue-700">
                                {identicalDetails?.total_count ?? (recipes.length || 2)} Pola Pattern
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500">Variabel Dicek:</span>
                            <span className="text-slate-700 font-medium text-[11px]">
                                Target SV, Durasi Step, Time Unit, Start Cond
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={() => setShowIdenticalModal(false)}
                        className="w-full inline-flex justify-center items-center rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white text-xs font-black py-3 px-6 shadow-md shadow-blue-900/20 transition-all border border-blue-800 cursor-pointer"
                    >
                        Tutup & Selesai
                    </button>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
