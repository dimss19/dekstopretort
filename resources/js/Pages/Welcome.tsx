import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import { Gauge, Settings, ClipboardList } from 'lucide-react';

export default function Welcome({
    auth,
    laravelVersion,
    phpVersion,
}: PageProps<{ laravelVersion: string; phpVersion: string }>) {
    return (
        <>
            <Head title="SCADA Retort - Control System" />
            <div className="bg-[#f0f4f9] text-slate-800 min-h-screen flex flex-col font-sans selection:bg-yellow-400 selection:text-slate-950">

                {/* Navbar (Royal Navy Blue & Gold Accent) */}
                <nav className="w-full border-b border-blue-900/40 bg-[#0f172a] shadow-md sticky top-0 z-50 text-white">
                    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ApplicationLogo className="h-9 w-9 filter drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                            <span className="text-xl font-black tracking-wide text-white">
                                SCADA <span className="text-yellow-400">RETORT</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-sm shadow-[0_0_15px_rgba(250,204,21,0.4)] hover:from-yellow-300 hover:to-amber-400 transition-all"
                                >
                                    Launch Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={route('login')}
                                        className="text-sm font-bold text-slate-200 hover:text-white px-4 py-2 rounded-xl hover:bg-blue-900/40 transition-all"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={route('register')}
                                        className="text-sm font-black px-5 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 rounded-xl shadow-[0_0_15px_rgba(250,204,21,0.35)] hover:from-yellow-300 hover:to-amber-400 transition-all"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Hero Section (Fresh Light & Royal Blue Glow) */}
                <main className="flex-grow flex flex-col relative overflow-hidden">
                    {/* Soft Ambient Background Orbs */}
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[45rem] h-[45rem] bg-blue-400/10 rounded-full blur-[140px] pointer-events-none"></div>
                    <div className="absolute bottom-10 right-10 w-[35rem] h-[35rem] bg-amber-400/15 rounded-full blur-[150px] pointer-events-none"></div>

                    <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 text-center z-10 flex-grow flex flex-col justify-center">
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
                            Industrial Temperature <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-600 to-amber-600">
                                Control System
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
                            Platform SCADA berbasis web terpusat untuk memonitor, mengonfigurasi, dan mengendalikan proses retort. Monitoring Autonics TN Series via Modbus RTU secara realtime dengan kurva suhu dan manajemen resep otomatis dari browser Anda.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link
                                href={auth.user ? route('dashboard') : route('login')}
                                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-base shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:from-yellow-300 hover:to-amber-400 transition-all hover:-translate-y-0.5"
                            >
                                Launch Dashboard
                            </Link>
                            <a
                                href="#features"
                                className="px-8 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-800 font-extrabold hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
                            >
                                Explore Features
                            </a>
                        </div>
                    </div>

                    {/* Features Section (Fresh White Cards with Blue & Yellow Accents) */}
                    <div id="features" className="relative z-10 bg-white/70 border-t border-slate-200/80 pt-16 pb-24 backdrop-blur-xl">
                        <div className="max-w-7xl mx-auto px-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Feature 1 */}
                                <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-lg hover:border-amber-400 hover:shadow-2xl transition-all duration-300 group">
                                    <div className="w-14 h-14 bg-amber-100 border border-amber-300 rounded-2xl flex items-center justify-center mb-6 text-amber-700 group-hover:scale-110 transition-transform shadow-sm">
                                        <Gauge size={28} />
                                    </div>
                                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">Real-Time Telemetry</h3>
                                    <p className="text-slate-600 leading-relaxed text-sm">
                                        Monitor temperatur aktual (PV), setpoint (SV), dan daya pemanas (MV) pada berbagai controller secara live dengan grafik tren presisi tinggi.
                                    </p>
                                </div>

                                {/* Feature 2 */}
                                <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-lg hover:border-blue-400 hover:shadow-2xl transition-all duration-300 group">
                                    <div className="w-14 h-14 bg-blue-100 border border-blue-200 rounded-2xl flex items-center justify-center mb-6 text-blue-700 group-hover:scale-110 transition-transform shadow-sm">
                                        <Settings size={28} />
                                    </div>
                                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">Remote Configuration</h3>
                                    <p className="text-slate-600 leading-relaxed text-sm">
                                        Kelola parameter perangkat mendalam, pemicu Auto-Tuning, reset alarm, dan ubah status RUN/STOP tanpa perlu menyentuh hardware fisik.
                                    </p>
                                </div>

                                {/* Feature 3 */}
                                <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-lg hover:border-amber-400 hover:shadow-2xl transition-all duration-300 group">
                                    <div className="w-14 h-14 bg-amber-100 border border-amber-300 rounded-2xl flex items-center justify-center mb-6 text-amber-700 group-hover:scale-110 transition-transform shadow-sm">
                                        <ClipboardList size={28} />
                                    </div>
                                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">Recipe Management</h3>
                                    <p className="text-slate-600 leading-relaxed text-sm">
                                        Buat profil temperatur multi-step (Pattern), simpan sebagai template resep, dan terapkan secara otomatis ke mesin retort Anda.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="relative z-10 border-t border-blue-900/40 bg-[#0f172a] py-10 text-white">
                        <div className="max-w-7xl mx-auto px-6 text-center">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <div className="text-3xl font-black text-white">Modbus RTU</div>
                                    <div className="text-xs text-yellow-400 font-extrabold uppercase tracking-wider mt-1">Protocol</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-white">RS485 to USB</div>
                                    <div className="text-xs text-blue-300 font-extrabold uppercase tracking-wider mt-1">Interface</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-yellow-400">&lt; 1s</div>
                                    <div className="text-xs text-blue-300 font-extrabold uppercase tracking-wider mt-1">Latency</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-[#091124] py-8 border-t border-blue-900/50 text-center text-sm text-slate-400">
                    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center font-medium">
                        <div>
                            SCADA Retort Dashboard &copy; 2026. All rights reserved.
                        </div>
                        <div className="mt-4 md:mt-0 text-xs text-slate-500">
                            Powered by Laravel v{laravelVersion} & PHP v{phpVersion}
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}