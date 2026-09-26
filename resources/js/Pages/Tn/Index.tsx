import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

const controllerTypes = [
    {
        model: 'TNS',
        label: 'Compact Setup',
        description: 'Controller ringkas untuk sistem retort berkapasitas kecil & medium.',
        accent: 'from-blue-600 to-blue-800',
    },
    {
        model: 'TNH',
        label: 'Standard Line',
        description: 'Controller utama untuk proses produksi retort standar pabrik.',
        accent: 'from-blue-800 to-slate-900',
    },
    {
        model: 'TNL',
        label: 'Extended I/O',
        description: 'Controller dengan dukungan I/O lengkap untuk sistem retort besar.',
        accent: 'from-amber-500 to-yellow-600',
    },
] as const;

export default function Index() {
    return (
        <AuthenticatedLayout>
            <Head title="Pilih Controller" />

            <main className="p-4 sm:p-8 lg:p-12 max-w-7xl mx-auto">
                <div className="mb-10 max-w-3xl rounded-3xl border border-slate-200/90 bg-white/95 p-8 shadow-lg backdrop-blur-xl">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Pilih Tipe Controller Autonics TN</h1>
                    <p className="mt-3 text-base text-slate-600 leading-relaxed">Pilih TNS, TNH, atau TNL untuk langsung membuka halaman monitoring. Sistem akan mendeteksi koneksi Modbus serial port secara otomatis.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {controllerTypes.map((controller) => (
                        <Link
                            key={controller.model}
                            href={route('tn.quick-start', controller.model)}
                            method="post"
                            as="button"
                            className="group relative flex min-h-80 flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-8 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-amber-400 hover:shadow-2xl"
                        >
                            <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-blue-100/60 transition-transform duration-500 group-hover:scale-150 pointer-events-none" />
                            <div>
                                <span className="inline-block rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                                    {controller.label}
                                </span>
                                <h2 className="mt-5 text-5xl font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">{controller.model}</h2>
                                <p className="mt-4 text-sm leading-relaxed text-slate-600">{controller.description}</p>
                            </div>
                            <div className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-md group-hover:from-yellow-300 group-hover:to-amber-400 transition-all">
                                <span>Buka Monitoring {controller.model}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </main>
        </AuthenticatedLayout>
    );
}
