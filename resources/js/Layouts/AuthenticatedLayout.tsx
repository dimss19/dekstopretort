import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode } from 'react';

type NavItem = {
    label: string;
    routeName: string;
    routeParam?: string;
    activePattern: string;
    excludePattern?: string;
};

const navigation: NavItem[] = [
    { label: 'Dashboard', routeName: 'dashboard', activePattern: 'dashboard' },
    { label: 'Monitoring TNS', routeName: 'tn.quick-start', routeParam: 'TNS', activePattern: 'tn.*', excludePattern: 'tn.recipes.*' },
    { label: 'ESP Logger', routeName: 'esp.monitor', activePattern: 'esp.*' },
    { label: 'Pattern Recipe', routeName: 'tn.recipes.index', activePattern: 'tn.recipes.*' },
    { label: 'Historian Log', routeName: 'historian.index', activePattern: 'historian.*' },
];

export default function Authenticated({
    header,
    navContent,
    children,
}: PropsWithChildren<{ header?: ReactNode; navContent?: ReactNode; user?: unknown }>) {
    const user = usePage().props.auth.user;
    const visibleNavigation = navigation;

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
                    <Link href={route('dashboard')} className="flex shrink-0 items-center gap-3 group">
                        <ApplicationLogo className="h-9 w-9 filter drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] transition-transform duration-300 group-hover:scale-105" />
                        <div className="hidden xl:block">
                            <p className="text-base font-black tracking-wider text-white">
                                SCADA <span className="text-yellow-400">RETORT</span>
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.25em] text-blue-300 font-bold">Control System</p>
                        </div>
                    </Link>

                    <nav className="ml-6 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:ml-10">
                        {navContent ? (
                            navContent
                        ) : (
                            visibleNavigation.map((item) => {
                                const active = (route().current(item.activePattern) ?? false) && !(item.excludePattern && route().current(item.excludePattern));
                                return (
                                    <Link
                                        key={item.label}
                                        href={item.routeParam ? route(item.routeName, item.routeParam) : route(item.routeName)}
                                        className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                                            active
                                                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                                : 'text-slate-200 hover:bg-blue-900/50 hover:text-white'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })
                        )}
                    </nav>

                    <div className="ml-3 flex shrink-0 items-center gap-2.5 border-l border-blue-800/60 pl-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-sm font-black text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                            {((user as any)?.name || 'O').charAt(0).toUpperCase()}
                        </div>
                        <div className="hidden sm:block text-left">
                            <p className="text-xs font-bold text-white leading-tight">{(user as any)?.name || 'Operator SCADA'}</p>
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Workstation
                            </span>
                        </div>
                    </div>
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