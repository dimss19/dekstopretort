import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { durationToMmSs, mmSsToDuration } from '@/Components/Esp/EspPatternEditor';

export default function Form({ recipe, users = [], controllers = [] }: { recipe?: any; users?: any[]; controllers?: any[] }) {
    const isEditing = !!recipe;
    const [activeTab, setActiveTab] = useState<'PATN' | 'IN' | 'CNTL' | 'PIdC' | 'ALM' | 'COMM' | 'ETC'>('PATN');
    const [showAdvance, setShowAdvance] = useState(false);

    const activeTnId = (usePage().props as any).ui?.active_tn_id;
    const [selectedController, setSelectedController] = useState(
        recipe?.process_parameters?.scanned_from || activeTnId || (controllers.length > 0 ? controllers[0].id : '')
    );

    const defaultTnConfig = {
        IN: {
            'IN-T': 'KCaH',
            'UNIT': '℃',
            'IN-b': 0,
            'MAv.F': 0.1,
            'L-SV': -200,
            'H-SV': 1350,
        },
        CNTL: {
            'O-FT': 'HEAT',
            'C-MD': 'PID',
            'SPl.t': 50,
            'oUt1': 'SSR',
            'oUt2': 'SSR',
            'H-T': 20.0,
            'C-T': 20.0,
            'db': 0,
            'L-MV': 0.0,
            'H-MV': 100.0,
        },
        PIdC: {
            'AT': 'OFF',
            'At.t': 'TUN1',
            'H-P': 10.0,
            'H-I': 240,
            'H-d': 49,
            'C-P': 10.0,
            'C-I': 240,
            'C-d': 49,
            'ARw.b': 100,
            'ALFA': 60,
        },
        ALM: {
            'AL1': { 'AL.Md': 'PV-H', 'AL.L': 0, 'AL.H': 130, 'AL.HY': 1, 'AL.oC': 'NO', 'AL.t': 'AL-A' },
            'AL2': { 'AL.Md': 'PV-L', 'AL.L': 10, 'AL.H': 0, 'AL.HY': 1, 'AL.oC': 'NO', 'AL.t': 'AL-A' },
            'AL3': { 'AL.Md': 'OFF', 'AL.L': 0, 'AL.H': 0, 'AL.HY': 1, 'AL.oC': 'NO', 'AL.t': 'AL-A' },
            'AL4': { 'AL.Md': 'OFF', 'AL.L': 0, 'AL.H': 0, 'AL.HY': 1, 'AL.oC': 'NO', 'AL.t': 'AL-A' },
        },
        COMM: {
            'COmP': 'RTU',
            'AdRS': 1,
            'bPS': 9600,
            'PRTY': 'NONE',
            'StP': 2,
            'RSw.t': 20,
        },
        ETC: {
            'PW.MV': 'STOP',
            'ER.MV': 0.0,
            'St.MV': 0.0,
            'LoCK': 'OFF',
            'dI-1': 'R-S',
            'dI-2': 'AL.RE',
            'dI-3': 'OFF',
            'dI-4': 'OFF',
        },
    };

    const initialPNum = recipe?.pattern_number ?? 0;
    const { data, setData, post, put, processing, errors, transform } = useForm({
        recipe_code: recipe?.recipe_code || `P${initialPNum}-${Math.random().toString(36).substring(2, 8)}`,
        name: recipe?.name || `Pattern ${initialPNum}`,
        product_name: recipe?.product_name || 'N/A',
        product_category: recipe?.product_category || '',
        package_type: recipe?.package_type || '',
        package_size: recipe?.package_size || '',
        description: recipe?.description || '',
        revision: recipe?.revision || 1,
        version: recipe?.version || '1.0',
        status: recipe?.status || 'Draft',
        approved_by: recipe?.approved_by || '',
        process_parameters: recipe?.process_parameters || {},
        time_unit: recipe?.time_unit || 'MM.SS',
        start_condition: recipe?.start_condition || 'SSV',
        pattern_end_state: recipe?.pattern_end_state || 'STOP',
        pattern_number: initialPNum,
        repetitions: recipe?.repetitions ?? 0,
        pid_group: recipe?.pid_group ?? 0,
        wait_width: recipe?.wait_width ?? 2,
        wait_time: recipe?.wait_time ?? 0,
        sync_to_tn: true,
        tn_controller_id: activeTnId || (controllers.length > 0 ? controllers[0].id : ''),
        tn_config: recipe?.tn_config || defaultTnConfig,
        steps: recipe?.steps?.length > 0 ? recipe.steps : [
            { step_number: 1, step_name: 'Venting', target_sv: 100, duration: 300, end_action: 'CONT', event_link: null, pid_group: null, steam_enable: true, cooling_enable: false, drain_enable: false, alarm_enable: true },
            { step_number: 2, step_name: 'Sterilisasi', target_sv: 121, duration: 900, end_action: 'HOLD', event_link: 1, pid_group: 0, steam_enable: true, cooling_enable: false, drain_enable: false, alarm_enable: true },
            { step_number: 3, step_name: 'Cooling', target_sv: 40, duration: 600, end_action: 'STOP', event_link: null, pid_group: null, steam_enable: false, cooling_enable: true, drain_enable: true, alarm_enable: true },
        ],
    });

    const handlePatternSelect = (num: number) => {
        const code = isEditing && recipe?.pattern_number === num
            ? recipe.recipe_code
            : `P${num}-${Math.random().toString(36).substring(2, 8)}`;

        setData(prev => ({
            ...prev,
            pattern_number: num,
            name: `Pattern ${num}`,
            recipe_code: code,
        }));
    };

    const handleSubmitWithSync = (sync: boolean) => {
        setData('sync_to_tn', sync);
        transform((form) => ({
            ...form,
            sync_to_tn: sync,
            tn_controller_id: selectedController || form.tn_controller_id || undefined,
            tn_id: selectedController || form.tn_controller_id || undefined,
        }));

        if (isEditing) {
            put(route('tn.recipes.update', recipe.id));
        } else {
            post(route('tn.recipes.store'));
        }
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((form) => ({
            ...form,
            sync_to_tn: true,
            tn_controller_id: selectedController || form.tn_controller_id || undefined,
            tn_id: selectedController || form.tn_controller_id || undefined,
        }));

        if (isEditing) {
            put(route('tn.recipes.update', recipe.id));
        } else {
            post(route('tn.recipes.store'));
        }
    };

    const addStep = () => {
        if (data.steps.length >= 20) {
            alert('Maksimal 20 langkah (step 0 s/d 19) diperbolehkan per pattern pada Autonics TN Series.');
            return;
        }
        const nextIdx = data.steps.length;
        setData('steps', [
            ...data.steps, 
            { 
                step_number: nextIdx + 1, 
                step_name: `Step ${nextIdx}`, 
                target_sv: 0, 
                duration: 0, 
                end_action: 'CONT', 
                event_link: null, 
                pid_group: null, 
                steam_enable: false, 
                cooling_enable: false, 
                drain_enable: false, 
                alarm_enable: true 
            }
        ]);
    };

    const removeStep = (index: number) => {
        if (data.steps.length <= 1) {
            alert('Pattern harus memiliki minimal 1 langkah (step).');
            return;
        }
        const newSteps = [...data.steps];
        newSteps.splice(index, 1);
        setData('steps', newSteps);
    };

    const updateStep = (index: number, field: string, value: any) => {
        const newSteps = [...data.steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setData('steps', newSteps);
    };

    const updateTnConfig = (group: string, key: string, value: any, subkey?: string) => {
        const currentGroup = { ...(data.tn_config[group] || {}) };
        if (subkey) {
            const currentSub = { ...(currentGroup[key] || {}) };
            currentSub[subkey] = value;
            currentGroup[key] = currentSub;
        } else {
            currentGroup[key] = value;
        }
        setData('tn_config', {
            ...data.tn_config,
            [group]: currentGroup
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                            {isEditing ? `Edit Pattern: ${recipe.name}` : 'Buat Pattern Baru'}
                        </h1>
                        <p className="text-sm font-semibold text-slate-600">Konfigurasi parameter TN Series dan profil langkah sterilisasi.</p>
                    </div>
                    <Link
                        href={route('tn.recipes.index')}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        Kembali ke Daftar Pattern
                    </Link>
                </div>
            }
        >
            <Head title={isEditing ? 'Edit Pattern' : 'Buat Pattern'} />

            <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <form onSubmit={submit} className="space-y-6">
                    {/* General Information Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200/90 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-black text-slate-900">Informasi Resep Sterilisasi</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-extrabold text-slate-700 uppercase">Target Controller TN</label>
                                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">DEVICE</span>
                                </div>
                                <select
                                    value={selectedController}
                                    onChange={e => {
                                        setSelectedController(e.target.value);
                                        setData('tn_controller_id', e.target.value);
                                    }}
                                    className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3"
                                >
                                    {controllers.map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || `Controller #${c.id}`} ({c.model_type}) {c.is_online ? '• Online' : '• Offline'}
                                        </option>
                                    ))}
                                    {controllers.length === 0 && (
                                        <option value="">Controller Utama</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-extrabold text-slate-700 uppercase">Kode Pattern</label>
                                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Otomatis</span>
                                </div>
                                <input
                                    type="text"
                                    value={data.recipe_code}
                                    readOnly
                                    className="mt-1.5 block w-full rounded-xl border-slate-200 bg-slate-100/90 text-slate-700 font-mono font-bold text-sm py-2 px-3 cursor-not-allowed select-all"
                                    required
                                />
                                {errors.recipe_code && <p className="mt-1 text-xs font-bold text-rose-600">{errors.recipe_code}</p>}
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-extrabold text-slate-700 uppercase">Pilih Pattern (0 – 9)</label>
                                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">PTnN</span>
                                </div>
                                <select
                                    value={data.pattern_number}
                                    onChange={e => handlePatternSelect(parseInt(e.target.value) || 0)}
                                    className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3"
                                >
                                    {[...Array(10)].map((_, i) => (
                                        <option key={i} value={i}>
                                            Pattern {i} (PTN.{i})
                                        </option>
                                    ))}
                                </select>
                                {errors.name && <p className="mt-1 text-xs font-bold text-rose-600">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-slate-700 uppercase">Nama Produk</label>
                                <input type="text" value={data.product_name} onChange={e => setData('product_name', e.target.value)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3" required />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-slate-700 uppercase">Status</label>
                                <select value={data.status} onChange={e => setData('status', e.target.value)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-sm py-2 px-3">
                                    <option value="Draft">Draft</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Archived">Archived</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Parameter Groups Tabs Navigation */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                        <button
                            type="button"
                            onClick={() => setActiveTab('PATN')}
                            className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-sm ${
                                activeTab === 'PATN'
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md ring-2 ring-amber-400/50 scale-[1.02]'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <span>★ PATN (Pattern & Steps)</span>
                            <span className="bg-slate-950 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-mono">
                                {data.steps.length} Steps
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('IN')}
                            className={`px-4 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                activeTab === 'IN'
                                    ? 'bg-blue-800 text-white shadow-md'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            IN (Sensor & Input)
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('CNTL')}
                            className={`px-4 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                activeTab === 'CNTL'
                                    ? 'bg-blue-800 text-white shadow-md'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            CNTL (Control & Output)
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('PIdC')}
                            className={`px-4 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                activeTab === 'PIdC'
                                    ? 'bg-blue-800 text-white shadow-md'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            PIdC (PID Control)
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('ALM')}
                            className={`px-4 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                activeTab === 'ALM'
                                    ? 'bg-blue-800 text-white shadow-md'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            ALM (Alarm Output)
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('COMM')}
                            className={`px-4 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                activeTab === 'COMM'
                                    ? 'bg-blue-800 text-white shadow-md'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            COMM (RS485)
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('ETC')}
                            className={`px-4 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${
                                activeTab === 'ETC'
                                    ? 'bg-blue-800 text-white shadow-md'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            ETC (System & DI)
                        </button>
                    </div>

                    {/* TAB CONTENT: PATN (Pattern & Sterilization Steps) */}
                    {activeTab === 'PATN' && (
                        <div className="space-y-6">
                            {/* Pattern Base Parameters */}
                            <div className="bg-white p-6 rounded-3xl shadow-lg border border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white">
                                <div className="flex items-center justify-between mb-4 border-b border-amber-100 pb-3">
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 uppercase">Parameter Dasar PATN</h3>
                                        <p className="text-xs font-semibold text-slate-500">Konfigurasi parameter dasar untuk pola sterilisasi.</p>
                                    </div>
                                    <span className="text-xs font-black text-amber-900 bg-amber-200/80 px-3 py-1 rounded-xl">
                                        PATN CONFIG
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">tUNI (Time unit)</label>
                                        <select value={data.time_unit} onChange={e => setData('time_unit', e.target.value)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3">
                                            <option value="MM.SS">MM.SS (Menit.Detik)</option>
                                            <option value="HH.MM">HH.MM (Jam.Menit)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">PTnS (Start condition)</label>
                                        <select value={data.start_condition} onChange={e => setData('start_condition', e.target.value)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3">
                                            <option value="SSV">SSV (Starting SV Target)</option>
                                            <option value="SPV">SPV (Current Actual PV)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">P.ENd (Pattern end state)</label>
                                        <select value={data.pattern_end_state} onChange={e => setData('pattern_end_state', e.target.value)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3">
                                            <option value="STOP">STOP (Matikan Output)</option>
                                            <option value="HOLD">HOLD (Tahan SV Terakhir)</option>
                                            <option value="NEXT">NEXT (Lanjut Pola Berikutnya)</option>
                                            <option value="PRE">PRE (Kembali ke Pola Sebelumnya)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">PTnN (Pattern 0-9)</label>
                                        <select
                                            value={data.pattern_number}
                                            onChange={e => handlePatternSelect(parseInt(e.target.value) || 0)}
                                            className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-mono font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3"
                                        >
                                            {[...Array(10)].map((_, i) => (
                                                <option key={i} value={i}>
                                                    PTN.{i} (Pattern {i})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">REP (Repetitions)</label>
                                        <input type="number" min="0" max="10000" value={data.repetitions} onChange={e => setData('repetitions', parseInt(e.target.value) || 0)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-mono font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">P.PId (PID Group 0-7)</label>
                                        <input type="number" min="0" max="7" value={data.pid_group} onChange={e => setData('pid_group', parseInt(e.target.value) || 0)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-mono font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">Wt.b (Wait width)</label>
                                        <input type="number" min="0" value={data.wait_width} onChange={e => setData('wait_width', parseInt(e.target.value) || 0)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-mono font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono font-black text-slate-800 uppercase">Wt.t (Wait time)</label>
                                        <input type="number" min="0" value={data.wait_time} onChange={e => setData('wait_time', parseInt(e.target.value) || 0)} className="mt-1.5 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-mono font-bold focus:border-amber-500 focus:ring-amber-500 text-xs py-2 px-3" />
                                    </div>
                                </div>
                            </div>

                            {/* STERILIZATION CORE STEPS TABLE */}
                            <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-amber-300 ring-4 ring-amber-400/10">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-amber-200">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-pulse"></span>
                                            <h3 className="text-lg font-black text-slate-900 tracking-tight">
                                                Langkah Operasi Sterilisasi
                                            </h3>
                                        </div>
                                        <p className="text-xs font-bold text-amber-900 mt-1">
                                            Parameter kunci sterilisasi: Target Suhu (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-slate-900">Ts0..Ts19</code>), Durasi Waktu (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-slate-900">Tm0..Tm19</code>), dan Aksi Akhir Tiap Langkah.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvance(!showAdvance)}
                                            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-black rounded-xl shadow-sm transition-all border ${
                                                showAdvance
                                                    ? 'bg-blue-900 text-yellow-400 border-blue-800 ring-2 ring-blue-600/30'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                            }`}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {showAdvance ? 'Tutup Advance' : 'Advance'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addStep}
                                            disabled={data.steps.length >= 20}
                                            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black px-4 py-2.5 text-xs rounded-xl shadow-md transition-all border-none disabled:opacity-50"
                                        >
                                            + Tambah Step ({data.steps.length}/20)
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-amber-200">
                                    <table className="min-w-full divide-y divide-amber-200">
                                        <thead className="bg-[#0f172a] text-white">
                                            <tr>
                                                <th className="py-3 px-3 text-center text-xs font-mono font-black text-yellow-400 w-12">#</th>
                                                <th className="py-3 px-3 text-left text-xs font-black uppercase tracking-wider">Nama Step</th>
                                                <th className="py-3 px-3 text-left text-xs font-mono font-black text-amber-300 uppercase tracking-wider min-w-[140px]">
                                                    Ts (Target SV °C)
                                                </th>
                                                <th className="py-3 px-3 text-left text-xs font-mono font-black text-amber-300 uppercase tracking-wider min-w-[140px]">
                                                    Tm (Durasi {data.time_unit})
                                                </th>
                                                <th className="py-3 px-3 text-left text-xs font-black uppercase tracking-wider min-w-[130px]">
                                                    End Action (HOLD / CONT)
                                                </th>
                                                {showAdvance && (
                                                    <>
                                                        <th className="py-3 px-3 text-left text-xs font-black uppercase tracking-wider min-w-[110px]">
                                                            Event Link
                                                        </th>
                                                        <th className="py-3 px-3 text-left text-xs font-black uppercase tracking-wider min-w-[110px]">
                                                            PID Group
                                                        </th>
                                                    </>
                                                )}
                                                <th className="py-3 px-3 text-center text-xs font-black uppercase tracking-wider w-16">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {data.steps.map((step: any, index: number) => (
                                                <tr key={index} className="hover:bg-amber-50/60 transition-colors">
                                                    {/* Step index (0-based) */}
                                                    <td className="whitespace-nowrap py-3 px-3 text-center">
                                                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 text-yellow-400 font-mono text-xs font-bold">
                                                            {index}
                                                        </span>
                                                    </td>

                                                    {/* Step Name */}
                                                    <td className="whitespace-nowrap py-3 px-3">
                                                        <input
                                                            type="text"
                                                            value={step.step_name || `Step ${index}`}
                                                            onChange={e => updateStep(index, 'step_name', e.target.value)}
                                                            className="block w-full rounded-xl border-slate-300 bg-slate-50 font-bold text-slate-800 text-xs py-2 px-3 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                                                            placeholder={`Contoh: Step ${index}`}
                                                        />
                                                    </td>

                                                    {/* Ts□ Input (Target SV) */}
                                                    <td className="whitespace-nowrap py-3 px-3">
                                                        <div className="relative">
                                                            <span className="absolute left-2.5 top-2 text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                                                Ts{index}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={step.target_sv !== undefined && step.target_sv !== null ? (step.target_sv > 300 ? (step.target_sv / 10).toFixed(1) : step.target_sv) : ''}
                                                                onChange={e => updateStep(index, 'target_sv', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                                className="block w-full rounded-xl border-amber-300 bg-amber-50/50 pl-14 pr-7 font-mono font-bold text-slate-900 text-xs py-2 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-right"
                                                                placeholder="121.0"
                                                            />
                                                            <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-slate-500">°C</span>
                                                        </div>
                                                    </td>

                                                    {/* Tm□ Input (Stopwatch MM:SS) */}
                                                    <td className="whitespace-nowrap py-3 px-3">
                                                        <div className="flex items-center gap-1 rounded-xl border border-blue-300 bg-blue-50/50 p-1 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-400/20">
                                                            <span className="shrink-0 text-[10px] font-mono font-bold text-blue-800 bg-blue-100 px-1.5 py-1 rounded">
                                                                Tm{index}
                                                            </span>
                                                            <div className="flex items-center flex-1 justify-center gap-1 font-mono">
                                                                {/* Minutes (MM) */}
                                                                <div className="relative flex items-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="999"
                                                                        value={durationToMmSs(step.duration).mm}
                                                                        onChange={e => {
                                                                            const newMm = Math.max(0, parseInt(e.target.value) || 0);
                                                                            const currSs = durationToMmSs(step.duration).ss;
                                                                            updateStep(index, 'duration', mmSsToDuration(newMm, currSs));
                                                                        }}
                                                                        className="w-12 text-center py-1 px-0.5 rounded-lg bg-white border border-blue-200 font-mono font-black text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                                                                        placeholder="00"
                                                                    />
                                                                    <span className="text-[9px] font-bold text-slate-400 ml-0.5">m</span>
                                                                </div>

                                                                <span className="font-mono font-black text-blue-600 text-xs">:</span>

                                                                {/* Seconds (SS, max 59) */}
                                                                <div className="relative flex items-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="59"
                                                                        value={durationToMmSs(step.duration).ss.toString().padStart(2, '0')}
                                                                        onChange={e => {
                                                                            let newSs = parseInt(e.target.value) || 0;
                                                                            if (newSs > 59) newSs = 59;
                                                                            if (newSs < 0) newSs = 0;
                                                                            const currMm = durationToMmSs(step.duration).mm;
                                                                            updateStep(index, 'duration', mmSsToDuration(currMm, newSs));
                                                                        }}
                                                                        className="w-12 text-center py-1 px-0.5 rounded-lg bg-white border border-blue-200 font-mono font-black text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                                                                        placeholder="00"
                                                                    />
                                                                    <span className="text-[9px] font-bold text-slate-400 ml-0.5">s</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* End Action (HOLD / CONT / STOP) */}
                                                    <td className="whitespace-nowrap py-3 px-3">
                                                        <select
                                                            value={step.end_action || 'CONT'}
                                                            onChange={e => updateStep(index, 'end_action', e.target.value)}
                                                            className={`block w-full rounded-xl text-xs font-black py-2 px-2.5 shadow-sm border ${
                                                                step.end_action === 'HOLD'
                                                                    ? 'bg-amber-100 text-amber-950 border-amber-400 font-extrabold'
                                                                    : step.end_action === 'STOP'
                                                                    ? 'bg-rose-100 text-rose-950 border-rose-300 font-extrabold'
                                                                    : 'bg-slate-50 text-slate-800 border-slate-300'
                                                            }`}
                                                        >
                                                            <option value="CONT">CONT (Lanjut Otomatis)</option>
                                                            <option value="HOLD">HOLD (Tahan Sterilisasi)</option>
                                                            <option value="STOP">STOP (Hentikan Pola)</option>
                                                        </select>
                                                    </td>

                                                    {/* Event Link (EV.0 - EV.9) */}
                                                    {showAdvance && (
                                                        <>
                                                            <td className="whitespace-nowrap py-3 px-3">
                                                                <select
                                                                    value={step.event_link ?? ''}
                                                                    onChange={e => updateStep(index, 'event_link', e.target.value === '' ? null : parseInt(e.target.value))}
                                                                    className="block w-full rounded-xl border-slate-300 bg-slate-50 font-mono font-bold text-slate-800 text-xs py-2 px-2 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                                                                >
                                                                    <option value="">- Tanpa Event -</option>
                                                                    {[...Array(10)].map((_, evIdx) => (
                                                                        <option key={evIdx} value={evIdx}>EV.{evIdx}</option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* PID Group Override */}
                                                            <td className="whitespace-nowrap py-3 px-3">
                                                                <select
                                                                    value={step.pid_group ?? ''}
                                                                    onChange={e => updateStep(index, 'pid_group', e.target.value === '' ? null : parseInt(e.target.value))}
                                                                    className="block w-full rounded-xl border-slate-300 bg-slate-50 font-mono font-bold text-slate-800 text-xs py-2 px-2 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                                                                >
                                                                    <option value="">Default (PId.{data.pid_group})</option>
                                                                    {[...Array(8)].map((_, pidIdx) => (
                                                                        <option key={pidIdx} value={pidIdx}>PId.{pidIdx}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* Delete Step Button */}
                                                    <td className="whitespace-nowrap py-3 px-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeStep(index)}
                                                            disabled={data.steps.length <= 1}
                                                            className="text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-black rounded-xl p-2 disabled:opacity-25 transition-all"
                                                            title="Hapus Step"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: IN (Sensor & Input) */}
                    {activeTab === 'IN' && (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-200">
                                <h3 className="text-lg font-black text-slate-900">Grup Parameter Input & Sensor (`IN`)</h3>
                                <p className="text-xs font-semibold text-slate-500">Konfigurasi jenis sensor fisik, satuan suhu, kalibrasi offset, dan batas aman SV.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">IN-T (Input Type / Sensor)</label>
                                    <select
                                        value={data.tn_config?.IN?.['IN-T'] || 'KCaH'}
                                        onChange={e => updateTnConfig('IN', 'IN-T', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2.5 px-3"
                                    >
                                        <option value="KCaH">Thermocouple K (KCaH: -200 s/d 1350°C)</option>
                                        <option value="KCaL">Thermocouple K Presisi (KCaL: -199.9 s/d 999.9°C)</option>
                                        <option value="JIcH">Thermocouple J (JIcH: -200 s/d 800°C)</option>
                                        <option value="DPtH">RTD Pt100 (DPtH: -200 s/d 650°C)</option>
                                        <option value="DPtL">RTD Pt100 Presisi (DPtL: -199.9 s/d 600.0°C)</option>
                                        <option value="4-20mA">Analog Current 4-20mA (AMA1)</option>
                                        <option value="0-10V">Analog Voltage 0-10V (AV1)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">UNIT (Temperature Unit)</label>
                                    <select
                                        value={data.tn_config?.IN?.['UNIT'] || '℃'}
                                        onChange={e => updateTnConfig('IN', 'UNIT', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2.5 px-3"
                                    >
                                        <option value="℃">℃ (Celcius)</option>
                                        <option value="℉">℉ (Fahrenheit)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">IN-b (Input Correction / Offset)</label>
                                    <input
                                        type="number"
                                        value={data.tn_config?.IN?.['IN-b'] ?? 0}
                                        onChange={e => updateTnConfig('IN', 'IN-b', parseInt(e.target.value) || 0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Offset koreksi suhu (-999 s/d 999)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">MAv.F (Digital Filter)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="120"
                                        value={data.tn_config?.IN?.['MAv.F'] ?? 0.1}
                                        onChange={e => updateTnConfig('IN', 'MAv.F', parseFloat(e.target.value) || 0.1)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Peredam noise sensor (0.1 - 120.0s)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">L-SV (SV Low Limit)</label>
                                    <input
                                        type="number"
                                        value={data.tn_config?.IN?.['L-SV'] ?? -200}
                                        onChange={e => updateTnConfig('IN', 'L-SV', parseInt(e.target.value) || 0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">H-SV (SV High Limit)</label>
                                    <input
                                        type="number"
                                        value={data.tn_config?.IN?.['H-SV'] ?? 1350}
                                        onChange={e => updateTnConfig('IN', 'H-SV', parseInt(e.target.value) || 0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: CNTL (Control & Output) */}
                    {activeTab === 'CNTL' && (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-200">
                                <h3 className="text-lg font-black text-slate-900">Grup Parameter Kendali & Output (`CNTL`)</h3>
                                <p className="text-xs font-semibold text-slate-500">Konfigurasi mode kontrol pemanas/pendingin, siklus relay, dan pembatasan MV.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">O-FT (Control Operation)</label>
                                    <select
                                        value={data.tn_config?.CNTL?.['O-FT'] || 'HEAT'}
                                        onChange={e => updateTnConfig('CNTL', 'O-FT', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2.5 px-3"
                                    >
                                        <option value="HEAT">HEAT (Pemanas Saja)</option>
                                        <option value="COOL">COOL (Pendingin Saja)</option>
                                        <option value="H-C">H-C (Pemanas + Pendingin Simultan)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">C-MD (Control Method)</label>
                                    <select
                                        value={data.tn_config?.CNTL?.['C-MD'] || 'PID'}
                                        onChange={e => updateTnConfig('CNTL', 'C-MD', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2.5 px-3"
                                    >
                                        <option value="PID">PID Control</option>
                                        <option value="ONOF">ON / OFF Control</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">SPl.t (Sampling Cycle)</label>
                                    <select
                                        value={data.tn_config?.CNTL?.['SPl.t'] ?? 50}
                                        onChange={e => updateTnConfig('CNTL', 'SPl.t', parseInt(e.target.value))}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2.5 px-3"
                                    >
                                        <option value="50">50 ms (Kecepatan Tinggi)</option>
                                        <option value="100">100 ms</option>
                                        <option value="250">250 ms</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">oUt1 / oUt2 Type</label>
                                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                                        <select
                                            value={data.tn_config?.CNTL?.['oUt1'] || 'SSR'}
                                            onChange={e => updateTnConfig('CNTL', 'oUt1', e.target.value)}
                                            className="rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2 px-2"
                                        >
                                            <option value="SSR">OUT1: SSR</option>
                                            <option value="CURR">OUT1: 4-20mA</option>
                                        </select>
                                        <select
                                            value={data.tn_config?.CNTL?.['oUt2'] || 'SSR'}
                                            onChange={e => updateTnConfig('CNTL', 'oUt2', e.target.value)}
                                            className="rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2 px-2"
                                        >
                                            <option value="SSR">OUT2: SSR</option>
                                            <option value="CURR">OUT2: 4-20mA</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">H-T (Heating Cycle Time)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="120"
                                        value={data.tn_config?.CNTL?.['H-T'] ?? 20.0}
                                        onChange={e => updateTnConfig('CNTL', 'H-T', parseFloat(e.target.value) || 20.0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Relay ≥ 20.0s, SSR 1.0 - 2.0s</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">db (Dead Band)</label>
                                    <input
                                        type="number"
                                        value={data.tn_config?.CNTL?.['db'] ?? 0}
                                        onChange={e => updateTnConfig('CNTL', 'db', parseInt(e.target.value) || 0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: PIdC (PID Control) */}
                    {activeTab === 'PIdC' && (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-200">
                                <h3 className="text-lg font-black text-slate-900">Grup Parameter Kontrol PID (`PIdC`)</h3>
                                <p className="text-xs font-semibold text-slate-500">Parameter Proportional, Integral, Derivative, Anti-Reset-Windup, dan kurva Alpha.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">AT (Auto Tuning Mode)</label>
                                    <select
                                        value={data.tn_config?.PIdC?.['At.t'] || 'TUN1'}
                                        onChange={e => updateTnConfig('PIdC', 'At.t', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2.5 px-3"
                                    >
                                        <option value="TUN1">TUN1 (Tuning pada 100% Target SV)</option>
                                        <option value="TUN2">TUN2 (Tuning pada 70% Target SV)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">H-P (Heating Proportional Band)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="999.9"
                                        value={data.tn_config?.PIdC?.['H-P'] ?? 10.0}
                                        onChange={e => updateTnConfig('PIdC', 'H-P', parseFloat(e.target.value) || 10.0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">H-I (Heating Integral Time)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="9999"
                                        value={data.tn_config?.PIdC?.['H-I'] ?? 240}
                                        onChange={e => updateTnConfig('PIdC', 'H-I', parseInt(e.target.value) || 0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Satuan: detik (0 = OFF)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">H-d (Heating Derivative Time)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="9999"
                                        value={data.tn_config?.PIdC?.['H-d'] ?? 49}
                                        onChange={e => updateTnConfig('PIdC', 'H-d', parseInt(e.target.value) || 0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Satuan: detik (0 = OFF)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">ARw.b (Anti Reset Windup)</label>
                                    <input
                                        type="number"
                                        min="50"
                                        max="200"
                                        value={data.tn_config?.PIdC?.['ARw.b'] ?? 100}
                                        onChange={e => updateTnConfig('PIdC', 'ARw.b', parseInt(e.target.value) || 100)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Mencegah overshoot start (50 - 200%)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">ALFA (Alpha Curve Rate)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={data.tn_config?.PIdC?.['ALFA'] ?? 60}
                                        onChange={e => updateTnConfig('PIdC', 'ALFA', parseInt(e.target.value) || 60)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-blue-600 text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">0 = Agresif, 100 = Halus</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: ALM (Alarm Output) */}
                    {activeTab === 'ALM' && (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-200">
                                <h3 className="text-lg font-black text-slate-900">Grup Konfigurasi Alarm (`ALM` & `EVNT`)</h3>
                                <p className="text-xs font-semibold text-slate-500">Konfigurasi batas deviasi / absolut, kontak relay NO/NC, dan opsi latch untuk output alarm.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {['AL1', 'AL2', 'AL3', 'AL4'].map((alKey) => {
                                    const alConfig = data.tn_config?.ALM?.[alKey] || {};
                                    return (
                                        <div key={alKey} className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                                <span className="font-mono font-black text-slate-900 text-sm">{alKey} Configuration</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-mono">Relay Output</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-mono font-black text-slate-700 uppercase">AL.Md (Alarm Mode)</label>
                                                    <select
                                                        value={alConfig['AL.Md'] || 'OFF'}
                                                        onChange={e => updateTnConfig('ALM', alKey, e.target.value, 'AL.Md')}
                                                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-bold text-xs py-1.5 px-2"
                                                    >
                                                        <option value="OFF">OFF (Nonaktif)</option>
                                                        <option value="PV-H">PV-H (Absolute High)</option>
                                                        <option value="PV-L">PV-L (Absolute Low)</option>
                                                        <option value="DV-H">DV-H (Deviation High)</option>
                                                        <option value="DV-L">DV-L (Deviation Low)</option>
                                                        <option value="LbA">LbA (Loop Break Alarm)</option>
                                                        <option value="SbA">SbA (Sensor Break Alarm)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-mono font-black text-slate-700 uppercase">AL.oC (Contact)</label>
                                                    <select
                                                        value={alConfig['AL.oC'] || 'NO'}
                                                        onChange={e => updateTnConfig('ALM', alKey, e.target.value, 'AL.oC')}
                                                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-bold text-xs py-1.5 px-2"
                                                    >
                                                        <option value="NO">NO (Normally Open)</option>
                                                        <option value="NC">NC (Normally Closed)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-mono font-black text-slate-700 uppercase">AL.H (High Value)</label>
                                                    <input
                                                        type="number"
                                                        value={alConfig['AL.H'] ?? 0}
                                                        onChange={e => updateTnConfig('ALM', alKey, parseInt(e.target.value) || 0, 'AL.H')}
                                                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-mono font-bold text-xs py-1.5 px-2"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-mono font-black text-slate-700 uppercase">AL.t (Option)</label>
                                                    <select
                                                        value={alConfig['AL.t'] || 'AL-A'}
                                                        onChange={e => updateTnConfig('ALM', alKey, e.target.value, 'AL.t')}
                                                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white text-slate-900 font-bold text-xs py-1.5 px-2"
                                                    >
                                                        <option value="AL-A">AL-A (Standard)</option>
                                                        <option value="AL-B">AL-B (Latch Lock)</option>
                                                        <option value="AL-C">AL-C (Standby)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: COMM (RS485 Communication) */}
                    {activeTab === 'COMM' && (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-200">
                                <h3 className="text-lg font-black text-slate-900">Grup Komunikasi Serial RS485 (`COMM`)</h3>
                                <p className="text-xs font-semibold text-slate-500">Konfigurasi parameter Modbus RTU / ASCII untuk komunikasi controller.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">COmP (Protocol)</label>
                                    <select
                                        value={data.tn_config?.COMM?.['COmP'] || 'RTU'}
                                        onChange={e => updateTnConfig('COMM', 'COmP', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2.5 px-3"
                                    >
                                        <option value="RTU">Modbus RTU</option>
                                        <option value="ASCI">Modbus ASCII</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">AdRS (Slave Address 1-99)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={data.tn_config?.COMM?.['AdRS'] ?? 1}
                                        onChange={e => updateTnConfig('COMM', 'AdRS', parseInt(e.target.value) || 1)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold text-xs py-2 px-3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">bPS (Baudrate)</label>
                                    <select
                                        value={data.tn_config?.COMM?.['bPS'] ?? 9600}
                                        onChange={e => updateTnConfig('COMM', 'bPS', parseInt(e.target.value))}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2.5 px-3"
                                    >
                                        <option value="9600">9600 bps</option>
                                        <option value="19200">19200 bps</option>
                                        <option value="38400">38400 bps</option>
                                        <option value="115200">115200 bps</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">PRTY (Parity)</label>
                                    <select
                                        value={data.tn_config?.COMM?.['PRTY'] || 'NONE'}
                                        onChange={e => updateTnConfig('COMM', 'PRTY', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2.5 px-3"
                                    >
                                        <option value="NONE">NONE</option>
                                        <option value="EVEN">EVEN</option>
                                        <option value="ODD">ODD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">StP (Stop Bit)</label>
                                    <select
                                        value={data.tn_config?.COMM?.['StP'] ?? 2}
                                        onChange={e => updateTnConfig('COMM', 'StP', parseInt(e.target.value))}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2.5 px-3"
                                    >
                                        <option value="1">1 Bit</option>
                                        <option value="2">2 Bits (Default)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">RSw.t (Response Wait Time)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="500"
                                        value={data.tn_config?.COMM?.['RSw.t'] ?? 20}
                                        onChange={e => updateTnConfig('COMM', 'RSw.t', parseInt(e.target.value) || 20)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Waktu jeda respon balasan (ms)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: ETC (System & Digital Input) */}
                    {activeTab === 'ETC' && (
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                            <div className="mb-4 pb-3 border-b border-slate-200">
                                <h3 className="text-lg font-black text-slate-900">Grup Sistem & Digital Input (`ETC`)</h3>
                                <p className="text-xs font-semibold text-slate-500">Konfigurasi respon power awal, fail-safe sensor error, dan pemetaan Digital Input (DI).</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">PW.MV (Power On State)</label>
                                    <select
                                        value={data.tn_config?.ETC?.['PW.MV'] || 'STOP'}
                                        onChange={e => updateTnConfig('ETC', 'PW.MV', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2.5 px-3"
                                    >
                                        <option value="STOP">STOP (Mulai dalam kondisi Mati)</option>
                                        <option value="RUN">RUN (Langsung Mulai Kontrol)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">ER.MV (Sensor Error MV %)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={data.tn_config?.ETC?.['ER.MV'] ?? 0.0}
                                        onChange={e => updateTnConfig('ETC', 'ER.MV', parseFloat(e.target.value) || 0.0)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold text-xs py-2 px-3"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-500">Output jika sensor putus (0.0 - 100.0%)</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono font-black text-slate-800 uppercase">LoCK (Front Key Lock)</label>
                                    <select
                                        value={data.tn_config?.ETC?.['LoCK'] || 'OFF'}
                                        onChange={e => updateTnConfig('ETC', 'LoCK', e.target.value)}
                                        className="mt-1.5 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-2.5 px-3"
                                    >
                                        <option value="OFF">OFF (Tidak Terkunci)</option>
                                        <option value="LOC1">LOC1 (Lock Menu Parameter)</option>
                                        <option value="LOC2">LOC2 (Lock Menu + SV Change)</option>
                                    </select>
                                </div>

                                <div className="md:col-span-3 pt-3 border-t border-slate-100">
                                    <h4 className="text-xs font-mono font-black text-slate-800 uppercase mb-3">Digital Input (DI 1 s/d DI 4) Functions</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {['dI-1', 'dI-2', 'dI-3', 'dI-4'].map((diKey) => (
                                            <div key={diKey}>
                                                <label className="block text-[10px] font-mono font-black text-slate-600 uppercase">{diKey}</label>
                                                <select
                                                    value={data.tn_config?.ETC?.[diKey] || 'OFF'}
                                                    onChange={e => updateTnConfig('ETC', diKey, e.target.value)}
                                                    className="mt-1 block w-full rounded-xl border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs py-1.5 px-2"
                                                >
                                                    <option value="OFF">OFF</option>
                                                    <option value="R-S">R-S (RUN/STOP)</option>
                                                    <option value="AL.RE">AL.RE (Alarm Reset)</option>
                                                    <option value="A-M">A-M (Auto/Manual)</option>
                                                    <option value="PTN">PTN (Select Pattern)</option>
                                                    <option value="STEP">STEP (Advance Step)</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
                        <Link
                            href={route('tn.recipes.index')}
                            className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-black text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all"
                        >
                            Batal
                        </Link>
                        <button
                            type="button"
                            onClick={() => handleSubmitWithSync(false)}
                            disabled={processing}
                            className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 shadow-sm transition-all disabled:opacity-50"
                        >
                            Simpan ke Database Saja
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmitWithSync(true)}
                            disabled={processing}
                            className="px-7 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all border-none disabled:opacity-50"
                        >
                            {isEditing ? 'Simpan & Tulis ke TN Controller' : 'Simpan & Tulis ke TN Controller'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
