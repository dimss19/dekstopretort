import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import ProcessDetailView, { ProcessBatchItem } from '@/Components/History/ProcessDetailView';
import { ChevronLeft } from 'lucide-react';

interface Props {
    batch: ProcessBatchItem;
    groups?: { id: number; name: string; color: string }[];
}

export default function Show({ batch, groups = [] }: Props) {
    const rawMachine = batch.controller?.machine?.machine_name || (batch.controller as any)?.name || batch.controller?.model_type || 'Retort TN';
    const machineName = rawMachine.replace(/Retort TNS/gi, 'TN').replace(/TNS Controller/gi, 'TN').replace(/^TNS$/i, 'TN');

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto py-1">
                    <div>
                        <div className="flex items-center gap-3">
                            <Link
                                href={route('historian.index')}
                                className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-sm transition-all"
                                title="Kembali ke History"
                            >
                                <ChevronLeft size={18} />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-mono font-bold uppercase tracking-widest">
                                        BATCH DETAIL // ARCHIVE
                                    </span>
                                </div>
                                <h1 className="text-2xl font-black font-mono tracking-tight text-white">
                                    DETAIL PROSES #{batch.id} ({machineName})
                                </h1>
                                <p className="text-xs font-mono text-slate-400 mt-0.5">
                                    Detail log sterilisasi, grafik profil termal, dan verifikasi batch
                                </p>
                            </div>
                        </div>
                    </div>
                    <Link
                        href={route('historian.index')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-mono font-bold text-slate-200 shadow-sm transition-all shrink-0"
                    >
                        <ChevronLeft size={16} />
                        <span>KEMBALI KE RIWAYAT</span>
                    </Link>
                </div>
            }
        >
            <Head title={`Detail Proses #${batch.id} (${machineName}) - History`} />

            <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <ProcessDetailView
                    batch={batch}
                    onBack={() => router.visit(route('historian.index'))}
                    groups={groups}
                />
            </div>
        </AuthenticatedLayout>
    );
}
