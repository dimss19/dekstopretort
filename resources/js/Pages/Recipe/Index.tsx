import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';

export default function Index({ recipes = [], controllers = [] }: { recipes?: any[], controllers?: any[] }) {
    const activeTnId = (usePage().props as any).ui?.active_tn_id;
    const [selectedController, setSelectedController] = useState(activeTnId || (controllers.length > 0 ? controllers[0].id : ''));
    const [isScanning, setIsScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState({ text: '', type: '' });

    const [applyingId, setApplyingId] = useState<number | null>(null);

    const handleApplyPattern = async (recipeId: number, recipeName: string) => {
        const targetController = selectedController || activeTnId || (controllers.length > 0 ? controllers[0].id : '');
        if (!confirm(`Kirim dan terapkan '${recipeName}' langsung ke memori TN Controller?`)) {
            return;
        }

        setApplyingId(recipeId);
        setScanMessage({ text: `Menulis parameter '${recipeName}' ke TN Controller via Modbus...`, type: 'info' });

        try {
            const response = await axios.post(route('tn.recipes.apply', { recipe: recipeId, tn: targetController || undefined }));
            setScanMessage({ text: response.data.message || 'Pattern berhasil ditulis ke Controller TN!', type: 'success' });
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Gagal menulis pattern ke TN Controller.';
            setScanMessage({ text: msg, type: 'error' });
        } finally {
            setApplyingId(null);
        }
    };

    const handleAutoScan = async () => {
        const targetController = selectedController || activeTnId || (controllers.length > 0 ? controllers[0].id : '');
        if (!targetController) {
            setScanMessage({ text: 'Tidak ada controller yang tersedia.', type: 'error' });
            return;
        }

        if (!confirm('PERINGATAN: Memindai semua pattern mengharuskan controller dalam mode STOP. Apakah Anda ingin melanjutkan?')) {
            return;
        }

        setIsScanning(true);
        setScanMessage({ text: 'Proses pemindaian sedang berjalan... Harap tunggu hingga 15 detik.', type: 'info' });

        try {
            const response = await axios.post(route('tn.recipes.scan-all'), { tn_id: targetController });
            setScanMessage({ text: response.data.message, type: 'success' });
            router.reload();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Gagal memindai pattern.';
            setScanMessage({ text: msg, type: 'error' });
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Pattern Management</h1>
                        <p className="text-sm font-semibold text-slate-600">Kelola, simpan, dan tulis profil sterilisasi langsung ke controller retort</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
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
                            disabled={isScanning || (!selectedController && !activeTnId && controllers.length === 0)}
                            className="inline-flex items-center rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 text-xs font-black px-5 py-2.5 shadow-md transition-all border-none disabled:opacity-50"
                        >
                            {isScanning ? (
                                <>
                                    <svg className="mr-2 h-4 w-4 animate-spin text-slate-950" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Scanning...
                                </>
                            ) : (
                                'Auto Scan'
                            )}
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Pattern Management" />

            <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {scanMessage.text && (
                    <div className={`mb-6 rounded-2xl p-4 text-xs font-extrabold border ${
                        scanMessage.type === 'error' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                        scanMessage.type === 'success' ? 'bg-amber-100 text-amber-950 border-amber-400' :
                        'bg-blue-100 text-blue-900 border-blue-300'
                    }`}>
                        <p>{scanMessage.text}</p>
                    </div>
                )}

                {recipes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 p-16 text-center text-slate-500 bg-white/90 shadow-sm backdrop-blur-xl">
                        <p className="text-xl font-black text-slate-900">Belum ada pattern ditemukan.</p>
                        <p className="text-xs font-semibold text-slate-500 mt-1">Mulai dengan memindai dari perangkat controller atau buat pattern baru secara manual.</p>
                        <div className="mt-6 flex justify-center">
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
                        {recipes.map(recipe => (
                            <div key={recipe.id} className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-lg border border-slate-200/90 transition-all hover:shadow-xl backdrop-blur-xl">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                                        <h3 className="text-lg font-black text-slate-900 truncate" title={recipe.name}>
                                            {recipe.name}
                                        </h3>
                                        <span className="shrink-0 rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-xs font-black text-amber-900">
                                            {recipe.status}
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-xs font-semibold text-slate-600">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Kode Pattern:</span>
                                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{recipe.recipe_code || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Jumlah Step:</span>
                                            <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{recipe.step_count || (recipe.steps ? recipe.steps.length : 0)} steps</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Satuan Waktu:</span>
                                            <span className="font-mono font-bold text-slate-800">{recipe.time_unit || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Dibuat:</span>
                                            <span className="text-slate-700">{new Date(recipe.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                    <button
                                        onClick={() => {
                                            if (confirm('Hapus pattern ini?')) {
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
                                            className="text-xs font-black text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-yellow-300 hover:to-amber-400 shadow-sm px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                                            title="Tulis parameter pattern ini ke memori hardware Controller TN"
                                        >
                                            {applyingId === recipe.id ? 'Writing...' : 'Write'}
                                        </button>
                                        <Link href={route('tn.recipes.edit', recipe.id)} className="text-xs font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition-colors">
                                            Edit
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
