import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';

type NavItem = {
    label: string;
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

    useEffect(() => {
        setUnverifiedCount(Number(pageProps.ui?.unverified_count ?? 0));
    }, [pageProps.ui?.unverified_count]);

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
            label: 'Dashboard',
            routeName: activeTnId ? 'tn.monitor' : 'tn.index',
            routeParam: activeTnId ? String(activeTnId) : undefined,
            activePattern: 'tn.*',
            excludePattern: 'tn.recipes.*',
        },
        {
            label: 'Pattern',
            routeName: 'tn.recipes.index',
            activePattern: 'tn.recipes.*',
        },
        {
            label: 'History',
            routeName: 'historian.index',
            activePattern: 'historian.*',
        },
    ];

    return (
        <div className="relative min-h-screen bg-[#f0f4f9] font-sans text-slate-800 selection:bg-yellow-400 selection:text-slate-950">
            {/* Soft Ambient Background Orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-blue-400/10 rounded-full blur-[140px]"></div>
                <div className="absolute top-1/3 -right-40 w-[35rem] h-[35rem] bg-amber-400/15 rounded-full blur-[160px]"></div>
                <div className="absolute -bottom-40 left-1/3 w-[30rem] h-[30rem] bg-blue-600/10 rounded-full blur-[140px]"></div>
            </div>

            {/* Fresh Royal Blue & Gold Header */}
            <header className="sticky top-0 z-40 border-b border-blue-900/40 bg-[#0f172a] shadow-[0_4px_25px_0_rgba(15,23,42,0.15)] text-white">
                <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
                    <Link href={route('tn.index')} className="flex shrink-0 items-center gap-3 group">
                        <ApplicationLogo className="h-9 w-9 filter drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] transition-transform duration-300 group-hover:scale-105" />
                        <div className="hidden xl:block">
                            <p className="text-base font-black tracking-wider text-white">
                                SCADA <span className="text-yellow-400">RETORT</span>
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.25em] text-blue-300 font-bold">Control System</p>
                        </div>
                    </Link>

                    <nav className="ml-6 flex min-w-0 flex-1 items-center gap-2 h-full overflow-visible xl:ml-10">
                        {navContent ? (
                            navContent
                        ) : (
                            visibleNavigation.map((item) => {
                                const active = (route().current(item.activePattern) ?? false) && !(item.excludePattern && route().current(item.excludePattern));
                                const hasUnverifiedWarning = item.label === 'History' && unverifiedCount > 0;

                                return (
                                    <Link
                                        key={item.label}
                                        href={item.routeParam ? route(item.routeName, item.routeParam) : route(item.routeName)}
                                        className={`relative shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                                            active
                                                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                                : 'text-slate-200 hover:bg-blue-900/50 hover:text-white'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        {hasUnverifiedWarning && (
                                            <span
                                                title={`${unverifiedCount} batch proses belum diverifikasi! Segera lengkapi di menu History.`}
                                                className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
                                            >
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 duration-1000"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 ring-2 ring-white shadow-sm"></span>
                                            </span>
                                        )}
                                    </Link>
                                );
                            })
                        )}
                    </nav>
                </div>
            </header>

            {header && (
                <div className="relative z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 py-5 shadow-sm sm:px-6 lg:px-8">
                    {header}
                </div>
            )}

            <main className="relative z-10">{children}</main>
        </div>
    );
}