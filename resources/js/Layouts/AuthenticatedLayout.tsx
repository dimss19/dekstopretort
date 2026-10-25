import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Activity, ShieldCheck, Clock } from 'lucide-react';

type NavItem = {
    label: string;
    shortcut: string;
    routeName: string;
    routeParam?: string;
    activePattern: string;
    excludePattern?: string;
};

export default function Authenticated({
    header,
    navContent,
    children,
}: PropsWithChildren<{ header?: ReactNode; navContent?: ReactNode; user?: unknown }>) {
    const pageProps = usePage().props as any;
    const activeTnId = pageProps.ui?.active_tn_id;
    const initialUnverified = Number(pageProps.ui?.unverified_count ?? 0);
    const [unverifiedCount, setUnverifiedCount] = useState<number>(initialUnverified);
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        setUnverifiedCount(Number(pageProps.ui?.unverified_count ?? 0));
    }, [pageProps.ui?.unverified_count]);

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleUpdate = (e: any) => {
            if (typeof e.detail === 'number') {
                setUnverifiedCount(e.detail);
            }
        };
        window.addEventListener('unverified-count-update', handleUpdate);
        return () => window.removeEventListener('unverified-count-update', handleUpdate);
    }, []);

    const visibleNavigation: NavItem[] = [
        {
            label: 'DASHBOARD',
            shortcut: 'F1',
            routeName: activeTnId ? 'tn.monitor' : 'tn.index',
            routeParam: activeTnId ? String(activeTnId) : undefined,
            activePattern: 'tn.*',
            excludePattern: 'tn.recipes.*',
        },
        {
            label: 'PATTERN',
            shortcut: 'F2',
            routeName: 'tn.recipes.index',
            activePattern: 'tn.recipes.*',
        },
        {
            label: 'HISTORY',
            shortcut: 'F3',
            routeName: 'historian.index',
            activePattern: 'historian.*',
        },
    ];

    return (
        <div className="relative min-h-screen bg-[#0a0d14] font-sans text-slate-100 selection:bg-yellow-400 selection:text-black">
            {/* Engineering Grid Background Texture */}
            <div
                className="fixed inset-0 pointer-events-none opacity-40 z-0"
                style={{
                    backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                }}
            />

            {/* Industrial Top Header */}
            <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#0e131f]/95 backdrop-blur-md text-white shadow-xl">
                {/* Yellow Safety Accent Line */}
                <div className="h-0.5 w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />

                <div className="flex h-15 items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Brand Section */}
                    <div className="flex items-center gap-4">
                        <Link href={route('tn.index')} className="flex items-center gap-3 group">
                            <div className="relative p-1 rounded-lg bg-slate-900 border border-slate-700/80 shadow-inner group-hover:border-yellow-400/70 transition-colors">
                                <ApplicationLogo className="h-8 w-8 filter drop-shadow-[0_0_6px_rgba(250,204,21,0.7)]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-black tracking-wider text-white">
                                        SCADA <span className="text-yellow-400">RETORT</span>
                                    </p>
                                    <span className="hidden md:inline-block px-1.5 py-0.2 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[9px] font-mono font-bold rounded">
                                        v1.5
                                    </span>
                                </div>
                                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400 font-bold">
                                    CV Indah Mesin
                                </p>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex items-center gap-1.5 h-full">
                        {navContent ? (
                            navContent
                        ) : (
                            visibleNavigation.map((item) => {
                                const active =
                                    (route().current(item.activePattern) ?? false) &&
                                    !(item.excludePattern && route().current(item.excludePattern));
                                const hasUnverifiedWarning = item.label === 'HISTORY' && unverifiedCount > 0;

                                return (
                                    <Link
                                        key={item.label}
                                        href={item.routeParam ? route(item.routeName, item.routeParam) : route(item.routeName)}
                                        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-extrabold uppercase tracking-wider transition-all border ${
                                            active
                                                ? 'bg-yellow-400 text-black border-yellow-300 shadow-[0_0_14px_rgba(250,204,21,0.35)]'
                                                : 'text-slate-300 border-transparent hover:text-white hover:bg-slate-800/80 hover:border-slate-700'
                                        }`}
                                    >
                                        <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${active ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'}`}>
                                            {item.shortcut}
                                        </span>
                                        <span>{item.label}</span>
                                        {hasUnverifiedWarning && (
                                            <span
                                                title={`${unverifiedCount} batch proses belum diverifikasi!`}
                                                className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
                                            >
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 ring-2 ring-slate-900 shadow-sm"></span>
                                            </span>
                                        )}
                                    </Link>
                                );
                            })
                        )}
                    </nav>

                    {/* Right System Telemetry Status HUD */}
                    <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="font-bold tracking-wider">{currentTime || '--:--:--'} WIB</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-400 text-[11px] font-bold">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            <span>SYS: ACTIVE</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Industrial Instrument Subheader */}
            {header && (
                <div className="relative z-10 border-b border-slate-800/90 bg-[#111624]/90 backdrop-blur-md px-4 py-4 shadow-lg sm:px-6 lg:px-8">
                    {header}
                </div>
            )}

            <main className="relative z-10">{children}</main>
        </div>
    );
}