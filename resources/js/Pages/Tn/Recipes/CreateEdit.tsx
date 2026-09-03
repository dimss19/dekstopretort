import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { PageProps } from '@/types';

interface RecipeStep {
    target_sv: number;
    time_minutes: number;
    time_seconds: number;
}

export default function CreateEdit({ auth, recipe }: PageProps<{ recipe?: any }>) {
    const isEdit = !!recipe;

    const { data, setData, post, put, processing, errors } = useForm({
        name: recipe?.name || '',
        description: recipe?.description || '',
        time_unit: recipe?.time_unit || 'MM.SS',
        start_condition: recipe?.start_condition || 'SSV',
        pattern_end_state: recipe?.pattern_end_state || 'STOP',
        repetitions: recipe?.repetitions || 0,
        target_f0: recipe?.target_f0 || 6.0,
        z_value: recipe?.z_value || 10.0,
        t_ref: recipe?.t_ref || 121.1,
        steps: recipe?.steps?.map((s: any) => ({
            target_sv: s.target_sv,
            time_minutes: s.time_minutes,
            time_seconds: s.time_seconds
        })) || [
            { target_sv: 121, time_minutes: 30, time_seconds: 0 }
        ] as RecipeStep[]
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 200 });

    useEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setCanvasSize(prev => {
                        const w = Math.floor(entry.contentRect.width);
                        const h = Math.floor(entry.contentRect.width * 0.25);
                        return prev.width !== w || prev.height !== h ? { width: w, height: h } : prev;
                    });
                }
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (data.steps.length === 0) return;

        const width = canvas.width;
        const height = canvas.height;
        const padding = 30;

        // Calculate total time (seconds) and max temp
        let totalTimeSec = 0;
        let maxTemp = 100;
        const points: {x: number, y: number, temp: number, accTime: number}[] = [];

        // Start from 0,0 assuming ambient 30C
        points.push({ x: 0, y: 30, temp: 30, accTime: 0 });

        data.steps.forEach((step: RecipeStep) => {
            const stepSec = (step.time_minutes * 60) + step.time_seconds;
            totalTimeSec += stepSec;
            if (step.target_sv > maxTemp) maxTemp = step.target_sv;
            points.push({ x: 0, y: step.target_sv, temp: step.target_sv, accTime: totalTimeSec });
        });

        // Add 10% padding to maxTemp and minTemp
        maxTemp = maxTemp * 1.2;
        const minTemp = 0;

        // Calculate actual x,y coordinates
        points.forEach(p => {
            p.x = padding + (totalTimeSec > 0 ? (p.accTime / totalTimeSec) * (width - 2 * padding) : 0);
            p.y = height - padding - ((p.temp - minTemp) / (maxTemp - minTemp)) * (height - 2 * padding);
        });

        // Draw Grid
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height - 2 * padding) * (i / 4);
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            const val = maxTemp - ((maxTemp - minTemp) * (i / 4));
            ctx.fillText(Math.round(val).toString(), padding - 5, y + 3);
        }
        ctx.stroke();

        // Draw Line
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // Red for temperature profile
        ctx.lineWidth = 3;
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Draw Nodes
        ctx.fillStyle = '#b91c1c';
        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

    }, [data.steps, canvasSize]);

    const addStep = () => {
        if (data.steps.length >= 20) {
            alert('Maximum 20 steps allowed.');
            return;
        }
        const lastStep = data.steps[data.steps.length - 1];
        setData('steps', [...data.steps, { 
            target_sv: lastStep ? lastStep.target_sv : 121, 
            time_minutes: 10, 
            time_seconds: 0 
        }]);
    };

    const removeStep = (index: number) => {
        if (data.steps.length <= 1) return;
        const newSteps = [...data.steps];
        newSteps.splice(index, 1);
        setData('steps', newSteps);
    };

    const updateStep = (index: number, field: keyof RecipeStep, value: number) => {
        const newSteps = [...data.steps];
        newSteps[index][field] = value;
        setData('steps', newSteps);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            put(route('tn.recipes.update', recipe.id));
        } else {
            post(route('tn.recipes.store'));
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">{isEdit ? 'Edit Template Resep' : 'Buat Template Resep Baru'}</h1>
                        <p className="text-sm font-semibold text-slate-600">Tentukan profil temperatur multi-step untuk mesin retort</p>
                    </div>
                    <button type="button" onClick={() => window.history.back()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                        Kembali
                    </button>
                </div>
            }
        >
            <Head title={isEdit ? 'Edit Resep' : 'Buat Resep'} />

            <div className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    <form onSubmit={handleSubmit} className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 shadow-lg rounded-3xl border border-slate-200/90 backdrop-blur-xl">
                                <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-3 mb-4">Informasi Umum Resep</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 uppercase">Nama Resep</label>
                                        <input type="text" value={data.name} onChange={e => setData('name', e.target.value)} required className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2.5 px-3.5" placeholder="Contoh: Process Retort Sterilisasi Daging" />
                                        {errors.name && <p className="text-rose-600 text-xs font-bold mt-1">{errors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 uppercase">Deskripsi</label>
                                        <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows={2} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-medium focus:border-blue-600 focus:ring-blue-600 text-sm py-2.5 px-3.5" placeholder="Deskripsi singkat profil suhu resep..." />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 shadow-lg rounded-3xl border border-slate-200/90 backdrop-blur-xl">
                                <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-3 mb-2">Target Sterilisasi (Lethality F₀)</h3>
                                <p className="text-xs font-medium text-slate-500 mb-4">Parameter keamanan mikrobiologi. SCADA akan menghitung F₀ realtime berdasarkan nilai ini.</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 uppercase">Target F₀</label>
                                        <input type="number" step="0.1" value={data.target_f0} onChange={e => setData('target_f0', parseFloat(e.target.value))} required className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 uppercase">Z-Value (°C)</label>
                                        <input type="number" step="0.1" value={data.z_value} onChange={e => setData('z_value', parseFloat(e.target.value))} required className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 uppercase">T-Ref (°C)</label>
                                        <input type="number" step="0.1" value={data.t_ref} onChange={e => setData('t_ref', parseFloat(e.target.value))} required className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 shadow-lg rounded-3xl border border-slate-200/90 backdrop-blur-xl">
                            <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-3 mb-4">Preview Kurva Temperatur</h3>
                            <div ref={canvasContainerRef} className="w-full h-48 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                                <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="w-full h-full" />
                            </div>
                        </div>

                        <div className="bg-white p-6 shadow-lg rounded-3xl border border-slate-200/90 backdrop-blur-xl">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                                <h3 className="text-lg font-black text-slate-900">Langkah Operasi (Pattern Steps)</h3>
                                <button type="button" onClick={addStep} className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold px-4 py-2 text-xs rounded-xl shadow-sm transition-all">
                                    Tambah Step
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {data.steps.map((step: RecipeStep, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-200 hover:bg-blue-50/40 transition-colors">
                                        <div className="font-mono font-black text-blue-700 bg-blue-50 border border-blue-200 w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0">#{idx + 1}</div>

                                        <div className="flex-1 grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-600">SV (°C)</label>
                                                <input type="number" step="0.1" value={step.target_sv} onChange={e => updateStep(idx, 'target_sv', parseFloat(e.target.value))} className="mt-1 block w-full text-xs font-mono font-bold rounded-xl border-slate-300 bg-white shadow-sm focus:border-blue-600 focus:ring-blue-600 py-1.5 px-2.5" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-600">Menit</label>
                                                <input type="number" min="0" value={step.time_minutes} onChange={e => updateStep(idx, 'time_minutes', parseInt(e.target.value))} className="mt-1 block w-full text-xs font-mono font-bold rounded-xl border-slate-300 bg-white shadow-sm focus:border-blue-600 focus:ring-blue-600 py-1.5 px-2.5" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-slate-600">Detik</label>
                                                <input type="number" min="0" max="59" value={step.time_seconds} onChange={e => updateStep(idx, 'time_seconds', parseInt(e.target.value))} className="mt-1 block w-full text-xs font-mono font-bold rounded-xl border-slate-300 bg-white shadow-sm focus:border-blue-600 focus:ring-blue-600 py-1.5 px-2.5" />
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => removeStep(idx)} disabled={data.steps.length === 1} className="text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-black rounded-xl px-3 py-2 disabled:opacity-30 transition-all shrink-0">
                                            Hapus
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {errors.steps && <p className="text-rose-600 text-xs font-bold mt-2">Terjadi kesalahan pada data step.</p>}
                        </div>

                        <div className="flex justify-end gap-4 pt-2">
                            <button type="button" onClick={() => window.history.back()} className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-black text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all">
                                Batal
                            </button>
                            <button type="submit" disabled={processing} className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all border-none disabled:opacity-50">
                                {isEdit ? 'Update Resep' : 'Simpan Resep'}
                            </button>
                        </div>
                    </form>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
