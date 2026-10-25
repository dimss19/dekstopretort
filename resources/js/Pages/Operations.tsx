import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ReactNode } from 'react';
import {
    Gauge,
    Settings,
    ThermometerSun,
    Wind,
    Wrench,
    Factory,
    Snowflake,
    ArrowDown,
    Database as DatabaseIcon,
    CheckCircle,
    AlertTriangle,
    XCircle,
} from 'lucide-react';
import HistorianList from '@/Components/History/HistorianList';

type Module = 'scada' | 'historian' | 'alarm' | 'notifications' | 'database';
type Props = { module: Module; histories?: any[]; groups?: { id: number; name: string; color: string }[] };

type FlowItem = {
    icon: ReactNode;
    label: string;
    value: string;
};

type BadgeTone = 'green' | 'amber' | 'red' | 'blue';

const Badge = ({ children, tone = 'green' }: { children: ReactNode; tone?: BadgeTone }) => {
    const colors: Record<BadgeTone, string> = {
        green: 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/60',
        amber: 'bg-amber-950/80 text-yellow-300 border border-yellow-500/60',
        red: 'bg-rose-950/80 text-rose-300 border border-rose-600/60',
        blue: 'bg-cyan-950/80 text-cyan-300 border border-cyan-600/60',
    };

    return <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider ${colors[tone]}`}>{children}</span>;
};

const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
    <section className={`rounded-2xl border border-slate-700/80 bg-[#0d131f]/95 p-6 shadow-xl text-white ${className}`}>
        {title && <h3 className="mb-4 text-lg font-mono font-black text-white uppercase tracking-wider">{title}</h3>}
        {children}
    </section>
);

const Scada = () => {
    const flow: FlowItem[] = [
        { icon: <Gauge size={20} className="text-cyan-400" />, label: 'Water Tank', value: '82%' },
        { icon: <Settings size={20} className="text-yellow-400" />, label: 'Pump', value: 'Running' },
        { icon: <ThermometerSun size={20} className="text-rose-400" />, label: 'Boiler', value: '121.4 °C' },
        { icon: <Wind size={20} className="text-slate-400" />, label: 'Steam Pipe', value: '1.8 bar' },
        { icon: <Wrench size={20} className="text-amber-400" />, label: 'Steam Valve', value: 'Open' },
        { icon: <Factory size={20} className="text-emerald-400" />, label: 'Retort', value: '120.8 °C' },
        { icon: <Snowflake size={20} className="text-cyan-300" />, label: 'Cooling', value: 'Standby' },
        { icon: <ArrowDown size={20} className="text-slate-400" />, label: 'Drain', value: 'Closed' },
    ];

    return (
        <>
            <Panel>
                <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="font-mono font-bold text-white text-base">MIMIC PROCESS OVERVIEW</h3>
                        <p className="text-xs font-mono text-slate-400">Live process telemetry · updated real-time</p>
                    </div>
                    <Badge tone="green">SYSTEM ONLINE</Badge>
                </div>
                <div className="flex flex-col items-center">
                    {flow.map((item, index) => (
                        <div key={item.label} className="contents">
                            <div className="flex w-full max-w-xl items-center gap-4 rounded-xl border border-slate-700/80 bg-[#070b13] p-3.5 shadow-inner">
                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                                    {item.icon}
                                </span>
                                <div className="flex-1 font-mono">
                                    <p className="font-bold text-slate-200 text-xs">{item.label}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Live Object</p>
                                </div>
                                <span className="font-mono text-sm font-bold text-yellow-400">{item.value}</span>
                                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                            </div>
                            {index < flow.length - 1 && <div className="relative h-6"><ArrowDown size={14} className="absolute left-[-7px] top-1.5 text-yellow-400" /></div>}
                        </div>
                    ))}
                </div>
            </Panel>
        </>
    );
};

function Alarm() {
    const rows = [
        { time: '10:31:04', msg: 'High temperature detected', machine: 'Retort-01', status: 'Critical', icon: <XCircle className="text-rose-400" />, tone: 'red' as const },
        { time: '09:48:22', msg: 'Pressure approaching limit', machine: 'Boiler-01', status: 'Warning', icon: <AlertTriangle className="text-yellow-400" />, tone: 'amber' as const },
        { time: '08:12:10', msg: 'Cycle completed', machine: 'Retort-02', status: 'Normal', icon: <CheckCircle className="text-emerald-400" />, tone: 'green' as const },
    ];

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <Panel><p className="text-xs font-mono uppercase text-slate-400">Normal Events</p><p className="mt-2 text-3xl font-mono font-black text-emerald-400">18</p></Panel>
                <Panel><p className="text-xs font-mono uppercase text-slate-400">Warning Alerts</p><p className="mt-2 text-3xl font-mono font-black text-yellow-400">2</p></Panel>
                <Panel><p className="text-xs font-mono uppercase text-slate-400">Critical Alarms</p><p className="mt-2 text-3xl font-mono font-black text-rose-400">1</p></Panel>
            </div>
            <Panel title="Alarm Event Log">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                        <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                            <tr>{['Time', 'Message', 'Machine', 'Status'].map((x) => <th key={x} className="px-3 py-3 font-bold">{x}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                            {rows.map((r) => (
                                <tr key={r.time} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-3 py-3.5 text-slate-400 font-bold">{r.time}</td>
                                    <td className="px-3 py-3.5 font-bold text-slate-200 flex items-center gap-2">{r.icon}{r.msg}</td>
                                    <td className="px-3 py-3.5 text-slate-400">{r.machine}</td>
                                    <td className="px-3 py-3.5"><Badge tone={r.tone}>{r.status}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </>
    );
}

function Notifications() {
    return (
        <Panel title="Alarm Notification Channels">
            <div className="divide-y divide-slate-800">
                {[
                    { name: 'Desktop System Notification', status: 'Active', future: false },
                    { name: 'Email Dispatch', status: '', future: true },
                    { name: 'WhatsApp Gateway', status: '', future: true },
                    { name: 'Telegram Bot', status: '', future: true },
                ].map((ch) => (
                    <div key={ch.name} className="flex items-center justify-between py-4 font-mono">
                        <div>
                            <p className="font-bold text-slate-200 text-sm">{ch.name}</p>
                            <p className="text-xs text-slate-400">Receive SCADA telemetry alarms via this channel</p>
                        </div>
                        {ch.future ? <Badge tone="blue">PLANNED</Badge> : <label className="flex items-center gap-2 text-xs font-bold text-emerald-400"><input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-900 text-yellow-400" />{ch.status}</label>}
                    </div>
                ))}
            </div>
        </Panel>
    );
}

function DatabasePanel() {
    const tables = ['users', 'roles', 'permissions', 'machines', 'devices', 'tnh_registers', 'temperature_logs', 'pressure_logs', 'alarm_logs', 'communication_logs', 'events'];

    return (
        <Panel title="SCADA Database Tables">
            <p className="mb-5 text-xs font-mono text-slate-400">Operational SQLite tables used by the desktop retort SCADA system.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((x, i) => (
                    <div key={x} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#070b13] p-3">
                        <DatabaseIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                        <div className="font-mono">
                            <p className="text-xs font-bold text-slate-200">{x}</p>
                            <p className="text-[10px] text-slate-500">{i < 2 || x === 'devices' ? 'Active Table' : 'Schema Registered'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

const titles: Record<Module, [string, string]> = {
    scada: ['SCADA PROCESS MIMIC', 'Visual overview diagram alur proses fisik sterilisasi'],
    historian: ['RIWAYAT PROSES & DATA LOG', 'Kelola, analisis, dan ekspor log data proses sterilisasi controller retort'],
    alarm: ['MANAJEMEN ALARM & EVENT', 'Pantau riwayat alarm aktif dan kejadian sistem'],
    notifications: ['KANAL NOTIFIKASI ALARM', 'Konfigurasi integrasi saluran pemberitahuan alarm'],
    database: ['STRUKTUR DATABASE SCADA', 'Daftar tabel operasional dan skema data sistem'],
};

export default function Operations({ module, histories, groups }: Props) {
    const [title, subtitle] = titles[module];
    const content = { scada: <Scada />, historian: <HistorianList histories={histories} groups={groups} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];

    return (
        <AuthenticatedLayout header={
            <div className="max-w-7xl mx-auto py-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 text-[10px] font-mono font-bold uppercase tracking-widest">
                        OPERATIONS // {module.toUpperCase()}
                    </span>
                </div>
                <h1 className="text-2xl font-black font-mono tracking-tight text-white">{title}</h1>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{subtitle}</p>
            </div>
        }>
            <Head title={title} />
            <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{content}</div>
        </AuthenticatedLayout>
    );
}