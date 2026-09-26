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
        green: 'bg-amber-100 text-amber-900 border border-amber-300',
        amber: 'bg-amber-100 text-amber-900 border border-amber-300',
        red: 'bg-rose-100 text-rose-800 border border-rose-200',
        blue: 'bg-blue-100 text-blue-800 border border-blue-200',
    };

    return <span className={`inline-flex rounded-full px-3.5 py-1 text-xs font-extrabold ${colors[tone]}`}>{children}</span>;
};

const Panel = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
    <section className={`rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl ${className}`}>
        {title && <h3 className="mb-4 text-xl font-extrabold text-slate-900">{title}</h3>}
        {children}
    </section>
);

const Scada = () => {
    const flow: FlowItem[] = [
        { icon: <Gauge size={20} className="text-cyan-600" />, label: 'Water Tank', value: '82%' },
        { icon: <Settings size={20} className="text-blue-600" />, label: 'Pump', value: 'Running' },
        { icon: <ThermometerSun size={20} className="text-red-500" />, label: 'Boiler', value: '121.4 °C' },
        { icon: <Wind size={20} className="text-slate-500" />, label: 'Steam Pipe', value: '1.8 bar' },
        { icon: <Wrench size={20} className="text-amber-600" />, label: 'Steam Valve', value: 'Open' },
        { icon: <Factory size={20} className="text-emerald-600" />, label: 'Retort', value: '120.8 °C' },
        { icon: <Snowflake size={20} className="text-blue-400" />, label: 'Cooling', value: 'Standby' },
        { icon: <ArrowDown size={20} className="text-slate-600" />, label: 'Drain', value: 'Closed' },
    ];

    return (
        <>
            <Panel>
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-800">Mimic Diagram</h3>
                        <p className="text-sm text-slate-500">Live process overview · updated just now</p>
                    </div>
                    <Badge tone="green">System Online</Badge>
                </div>
                <div className="flex flex-col items-center">
                    {flow.map((item, index) => (
                        <div key={item.label} className="contents">
                            <div className="flex w-full max-w-xl items-center gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm">
                                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100">
                                    {item.icon}
                                </span>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-800">{item.label}</p>
                                    <p className="text-xs text-slate-500">Live object</p>
                                </div>
                                <span className="font-mono text-sm font-semibold text-cyan-700">{item.value}</span>
                                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                            </div>
                            {index < flow.length - 1 && <div className="relative h-7"><ArrowDown size={16} className="absolute left-[-8px] top-3 text-cyan-500 rotate-90" /></div>}
                        </div>
                    ))}
                </div>
            </Panel>
        </>
    );
};

function Alarm() {
    const rows = [
        { time: '10:31:04', msg: 'High temperature detected', machine: 'Retort-01', status: 'Critical', icon: <XCircle className="text-red-500" />, tone: 'red' as const },
        { time: '09:48:22', msg: 'Pressure approaching limit', machine: 'Boiler-01', status: 'Warning', icon: <AlertTriangle className="text-amber-500" />, tone: 'amber' as const },
        { time: '08:12:10', msg: 'Cycle completed', machine: 'Retort-02', status: 'Normal', icon: <CheckCircle className="text-emerald-500" />, tone: 'green' as const },
    ];

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <Panel><p className="text-sm text-slate-500">Normal</p><p className="mt-2 text-3xl font-bold text-emerald-600">18</p></Panel>
                <Panel><p className="text-sm text-slate-500">Warning</p><p className="mt-2 text-3xl font-bold text-amber-500">2</p></Panel>
                <Panel><p className="text-sm text-slate-500">Critical</p><p className="mt-2 text-3xl font-bold text-red-600">1</p></Panel>
            </div>
            <Panel title="Alarm History">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b text-xs uppercase text-slate-400">
                            <tr>{['Time', 'Message', 'Machine', 'Status'].map((x) => <th key={x} className="px-3 py-3">{x}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.time} className="border-b border-slate-100">
                                    <td className="px-3 py-4 font-mono text-slate-500">{r.time}</td>
                                    <td className="px-3 py-4 font-medium text-slate-700 flex items-center gap-2">{r.icon}{r.msg}</td>
                                    <td className="px-3 py-4 text-slate-500">{r.machine}</td>
                                    <td className="px-3 py-4"><Badge tone={r.tone}>{r.status}</Badge></td>
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
        <Panel title="Notification Channels">
            <div className="divide-y">
                {[
                    { name: 'Browser Notification', status: 'Active', future: false },
                    { name: 'Email', status: '', future: true },
                    { name: 'WhatsApp', status: '', future: true },
                    { name: 'Telegram', status: '', future: true },
                ].map((ch) => (
                    <div key={ch.name} className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-medium text-slate-700">{ch.name}</p>
                            <p className="text-sm text-slate-400">Receive SCADA alarms via this channel</p>
                        </div>
                        {ch.future ? <Badge tone="blue">Future</Badge> : <label className="flex items-center gap-2 text-sm text-emerald-600"><input type="checkbox" defaultChecked className="rounded border-slate-300 text-emerald-600" />{ch.status}</label>}
                    </div>
                ))}
            </div>
        </Panel>
    );
}

function DatabasePanel() {
    const tables = ['users', 'roles', 'permissions', 'machines', 'devices', 'tnh_registers', 'temperature_logs', 'pressure_logs', 'alarm_logs', 'communication_logs', 'events'];

    return (
        <Panel title="Database Structure">
            <p className="mb-5 text-sm text-slate-500">Operational tables required by the SCADA system.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((x, i) => (
                    <div key={x} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                        <DatabaseIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div>
                            <p className="font-mono text-sm font-semibold text-slate-700">{x}</p>
                            <p className="text-xs text-slate-400">{i < 2 || x === 'devices' ? 'Available / planned schema' : 'Planned schema'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

const titles: Record<Module, [string, string]> = {
    scada: ['SCADA Process POV', 'Pantau dan konfigurasi proses SCADA secara visual'],
    historian: ['Riwayat Proses & Data Log', 'Kelola, analisis, dan ekspor log data proses sterilisasi controller retort'],
    alarm: ['Manajemen Alarm & Event', 'Pantau riwayat alarm aktif dan kejadian sistem'],
    notifications: ['Kanal Notifikasi Alarm', 'Konfigurasi integrasi saluran pemberitahuan alarm'],
    database: ['Struktur Database SCADA', 'Daftar tabel operasional dan skema data sistem'],
};

export default function Operations({ module, histories, groups }: Props) {
    const [title, subtitle] = titles[module];
    const content = { scada: <Scada />, historian: <HistorianList histories={histories} groups={groups} />, alarm: <Alarm />, notifications: <Notifications />, database: <DatabasePanel /> }[module];

    return (
        <AuthenticatedLayout header={
            <div className="max-w-7xl mx-auto py-1">
                <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{subtitle}</p>
            </div>
        }>
            <Head title={title} />
            <div className="space-y-5 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{content}</div>
        </AuthenticatedLayout>
    );
}