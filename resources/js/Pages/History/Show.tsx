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
    const machineName = rawMachine.replace(/Retort TNS/gi, 'Retort TN').replace(/TNS Controller/gi, 'Retort TN').replace(/^TNS$/i, 'Retort TN');

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto py-1">
                    <div>
                        <div className="flex items-center gap-3">
                            <Link
                                href={route('historian.index')}
                                className="inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm transition-all"
                                title="Kembali ke History"
                            >
                                <ChevronLeft size={18} />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                    Detail Proses #{batch.id} ({machineName})
                                </h1>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                    Detail log sterilisasi, grafik profil termal, dan verifikasi batch
                                </p>
                            </div>
                        </div>
                    </div>
                    <Link
                        href={route('historian.index')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 shadow-sm transition-all shrink-0"
                    >
                        <ChevronLeft size={16} />
                        <span>Kembali ke History</span>
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
