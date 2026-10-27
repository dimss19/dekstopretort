import React, { useState } from 'react';
import { ScadaMapping, SensorData } from '@/types';

interface ScadaElementProps {
    mapping: ScadaMapping;
    sensorData?: SensorData;
    controllerModel?: string;
    className?: string;
    selected?: boolean;
    onSelect?: (id: number) => void;
}

type ScadaValue = number | string | boolean | null;
type ScadaRendererProps = {
    mapping: ScadaMapping;
    sensorData?: SensorData;
    controllerModel?: string;
};

const ERROR_VALUES: Record<number, string> = {
    31000: 'OPEN',
    30000: 'HHHH',
    [-30000]: 'LLLL',
};

const PERCENT_SOURCES = new Set(['heating_mv', 'cooling_mv']);
const TIME_SOURCES = new Set(['process_time', 'rest_time']);
const INTEGER_SOURCES = new Set(['pattern_current', 'step_current']);

function isErrorValue(value: number): boolean {
    return Object.prototype.hasOwnProperty.call(ERROR_VALUES, value);
}

function getSensorValue(mapping: ScadaMapping, sensorData?: SensorData): ScadaValue {
    if (!sensorData) return null;
    let rawValue = sensorData[mapping.data_source];

    // Intelligent fallback for SCADA Retort elements
    if (rawValue === undefined || rawValue === null) {
        const id = (mapping.element_id || '').toLowerCase();
        const src = (mapping.data_source || '').toLowerCase();

        if (src === 'steam_valve' || id.includes('steam') || src.includes('steam')) {
            if (sensorData.heating_mv !== undefined || sensorData.out1_active !== undefined) {
                rawValue = sensorData.heating_mv ?? (sensorData.out1_active ? 1000 : 0);
            }
        } else if (src === 'cooling_mv' || id.includes('cooling') || src.includes('cooling') || id.includes('pump')) {
            if (sensorData.cooling_mv !== undefined || sensorData.out2_active !== undefined) {
                rawValue = sensorData.cooling_mv ?? (sensorData.out2_active ? 1000 : 0);
            }
        } else if (src === 'drain_open' || id.includes('drain')) {
            if (sensorData.cooling_mv !== undefined) {
                rawValue = sensorData.cooling_mv > 0 ? sensorData.cooling_mv : 0;
            }
        } else if (src === 'gas_ready' || src === 'pilot_flame') {
            if (sensorData.controller_running !== undefined || sensorData.run_status !== undefined) {
                rawValue = sensorData.controller_running ?? (sensorData.run_status ? 1 : 0);
            }
        } else if (src === 'door_lock') {
            if (sensorData.controller_running !== undefined) {
                rawValue = sensorData.controller_running ? true : false;
            }
        }
    }

    if (rawValue === undefined || rawValue === null) return null;
    if (!['number', 'string', 'boolean'].includes(typeof rawValue)) return null;

    if (typeof rawValue !== 'number' || isErrorValue(rawValue)) return rawValue;

    if (mapping.data_source === 'pv' || mapping.data_source === 'sv') {
        const decimalPoint = Number(sensorData.decimal_point);
        if (Number.isInteger(decimalPoint) && decimalPoint >= 0 && decimalPoint <= 6) {
            return rawValue / Math.pow(10, decimalPoint);
        }
    }

    if (PERCENT_SOURCES.has(mapping.data_source) || mapping.data_source === 'steam_valve') return rawValue / 10;
    return rawValue;
}

function getStatusColor(mapping: ScadaMapping, value: ScadaValue): string {
    if (value === null || typeof value !== 'number') return mapping.normal_color;
    if (mapping.critical_threshold !== null && value >= mapping.critical_threshold) return mapping.critical_color;
    if (mapping.warning_threshold !== null && value >= mapping.warning_threshold) return mapping.warning_color;
    return mapping.normal_color;
}

function formatBoolean(source: string, value: boolean): string {
    if (source === 'run_status') return value ? 'STOP' : 'RUN';
    if (source === 'auto_manual') return value ? 'MANUAL' : 'AUTO';
    if (source === 'at_running') return value ? 'RUNNING' : 'OFF';
    return value ? 'ON' : 'OFF';
}

function formatTnTime(value: number): string {
    const digits = String(Math.max(0, Math.trunc(value))).padStart(4, '0');
    return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

function formatValue(mapping: ScadaMapping, value: ScadaValue, dp: number = 1): string {
    if (value === null) return '--';
    if (typeof value === 'boolean') return formatBoolean(mapping.data_source, value);
    if (typeof value === 'string') return value;
    if (isErrorValue(value)) return ERROR_VALUES[value];
    if (TIME_SOURCES.has(mapping.data_source)) return formatTnTime(value);
    if (INTEGER_SOURCES.has(mapping.data_source)) return Math.trunc(value).toString();
    return value.toFixed(dp);
}

function isSourceActive(mapping: ScadaMapping, value: ScadaValue): boolean {
    if (value === null) return false;
    if (typeof value === 'boolean') return mapping.data_source === 'run_status' ? !value : value;
    if (typeof value === 'number') {
        if (isErrorValue(value)) return false;
        return mapping.data_source === 'run_status' ? value === 0 : value > 0;
    }

    const normalized = value.trim().toLowerCase();
    return ['on', 'open', 'run', 'running', 'active', 'true', '1'].includes(normalized);
}

function getGaugeDefinition(source: string): { min: number; max: number; unit: string } {
    if (source === 'pv' || source === 'sv') return { min: 0, max: 200, unit: '°C' };
    if (PERCENT_SOURCES.has(source)) return { min: 0, max: 100, unit: '%' };
    return { min: 0, max: 100, unit: '' };
}

function getHeatScaleColor(pct: number): string {
    const hue = Math.max(0, 120 - (pct / 100) * 120);
    return `hsl(${hue} 95% 55%)`;
}

function GaugeElement({ mapping, sensorData }: { mapping: ScadaMapping; sensorData?: SensorData }) {
    const value = getSensorValue(mapping, sensorData);
    const { min, max, unit } = getGaugeDefinition(mapping.data_source);
    const numVal = typeof value === 'number' ? value : 0;
    const pct = Math.min(100, Math.max(0, ((numVal - min) / (max - min)) * 100));
    const color = typeof value === 'number' && !isErrorValue(value) ? getHeatScaleColor(pct) : getStatusColor(mapping, value);

    return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-slate-900/90">
            <svg viewBox="0 0 120 120" className="h-full max-h-full w-full" role="img" aria-label={mapping.label || mapping.element_id}>
                <circle cx="60" cy="60" r="55" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={`${(pct / 100) * 314} 314`}
                    transform="rotate(-90 60 60)" strokeLinecap="round" />
                <text x="60" y="55" textAnchor="middle" className="text-lg font-bold" fill={color} fontSize="16">
                    {formatValue(mapping, value)}
                </text>
                <text x="60" y="75" textAnchor="middle" fill="#94a3b8" fontSize="10">{unit || mapping.data_source}</text>
            </svg>
            {mapping.label && <span className="mt-0.5 max-w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{mapping.label}</span>}
        </div>
    );
}

function DisplayElement({ mapping, sensorData, controllerModel }: { mapping: ScadaMapping; sensorData?: SensorData; controllerModel?: string }) {
    const value = getSensorValue(mapping, sensorData);
    const color = getStatusColor(mapping, value);

    if (mapping.data_source === 'pv') {
        return <ControllerDisplayElement mapping={mapping} sensorData={sensorData} controllerModel={controllerModel} />;
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md border bg-slate-900/95 shadow-inner" style={{
            borderColor: color,
            boxShadow: `inset 0 0 18px ${color}18`,
        }}>
            <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                {mapping.label || mapping.element_id}
            </span>
            <div className="max-w-full truncate px-1 font-mono text-lg font-bold tabular-nums" style={{ color }}>
                {formatValue(mapping, value)}
            </div>
            <span className="text-[9px] uppercase tracking-wide text-slate-500">{mapping.data_source}</span>
        </div>
    );
}

function ControllerDisplayElement({ mapping, sensorData, controllerModel = 'TNS' }: { mapping: ScadaMapping; sensorData?: SensorData; controllerModel?: string }) {
    const pv = getSensorValue(mapping, sensorData);
    const sv = getSensorValue({ ...mapping, data_source: 'sv' }, sensorData);
    const heating = getSensorValue({ ...mapping, data_source: 'heating_mv' }, sensorData);
    const cooling = getSensorValue({ ...mapping, data_source: 'cooling_mv' }, sensorData);
    const isHeating = isSourceActive({ ...mapping, data_source: 'heating_mv' }, heating);
    const isCooling = isSourceActive({ ...mapping, data_source: 'cooling_mv' }, cooling);
    const pvText = formatValue(mapping, pv);
    const svText = sv === null ? '----' : formatValue({ ...mapping, data_source: 'sv' }, sv);
    const mvText = heating === null ? '----' : formatValue({ ...mapping, data_source: 'heating_mv' }, heating);

    return (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-transparent p-1">
            <span className="sr-only">{mapping.label || mapping.element_id}</span>
            <svg viewBox="0 0 260 230" className="h-full w-full" role="img" aria-label={`${mapping.label || mapping.element_id} PV ${pvText} SV ${svText} MV ${mvText}`}>
                <defs>
                    <linearGradient id={`tn-face-body-${mapping.id}`} x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#3f4242" />
                        <stop offset="100%" stopColor="#151717" />
                    </linearGradient>
                    <linearGradient id={`tn-face-panel-${mapping.id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f2f4f4" />
                        <stop offset="100%" stopColor="#bfc5c7" />
                    </linearGradient>
                </defs>
                <path d="M34 28 H198 L232 48 V190 L204 208 H34 Q18 208 18 192 V44 Q18 28 34 28 Z" fill={`url(#tn-face-body-${mapping.id})`} stroke="#020617" strokeWidth="4" />
                <path d="M198 28 L232 48 L232 190 L204 208 V48 Z" fill="#202323" stroke="#111827" strokeWidth="3" />
                <path d="M210 58 H236 M210 82 H236 M210 106 H236 M210 130 H236 M210 154 H236" stroke="#343838" strokeWidth="5" strokeLinecap="round" />
                <rect x="30" y="42" width="174" height="140" rx="6" fill="#101111" stroke="#2b2f30" strokeWidth="3" />
                <rect x="42" y="58" width="148" height="112" rx="3" fill="#161717" />
                <text x="48" y="58" dy="14" fill="#a9adaf" fontSize="14" fontWeight="800">{controllerModel}</text>
                <text x="172" y="58" dy="14" fill="#a9adaf" fontSize="12" fontWeight="800" textAnchor="end">Autonics</text>
                <text x="158" y="110" fill="#f8fafc" fontFamily="monospace" fontSize="38" fontWeight="900" textAnchor="end" textLength="104" lengthAdjust="spacingAndGlyphs">{pvText}</text>
                <text x="166" y="107" fill="#8b9094" fontSize="13" fontWeight="900">PV</text>
                <text x="158" y="139" fill="#7be44d" fontFamily="monospace" fontSize="30" fontWeight="900" textAnchor="end" textLength="86" lengthAdjust="spacingAndGlyphs">{svText}</text>
                <text x="166" y="136" fill="#8b9094" fontSize="13" fontWeight="900">SV</text>
                <text x="158" y="166" fill="#fb923c" fontFamily="monospace" fontSize="30" fontWeight="900" textAnchor="end" textLength="86" lengthAdjust="spacingAndGlyphs">{mvText}</text>
                <text x="166" y="163" fill="#8b9094" fontSize="13" fontWeight="900">MV</text>
                <rect x="41" y="123" width="22" height="10" rx="1" fill={isHeating ? '#facc15' : '#4b5563'} />
                <rect x="41" y="135" width="22" height="10" rx="1" fill={isCooling ? '#facc15' : '#4b5563'} />
                <text x="52" y="131" fill="#111827" fontSize="7" fontWeight="900" textAnchor="middle">OUT1</text>
                <text x="52" y="143" fill="#111827" fontSize="7" fontWeight="900" textAnchor="middle">OUT2</text>
                <path d="M30 182 H204 V202 Q204 212 194 212 H40 Q30 212 30 202 Z" fill={`url(#tn-face-panel-${mapping.id})`} stroke="#8d969b" strokeWidth="2" />
                {[
                    ['U', 58],
                    ['M', 88],
                    ['<', 118],
                    ['v', 148],
                    ['^', 178],
                ].map(([key, x]) => (
                    <g key={key}>
                        <text x={x} y="195" fill="#596268" fontSize="10" fontWeight="800" textAnchor="middle">{key}</text>
                        <rect x={Number(x) - 12} y="200" width="24" height="10" rx="5" fill="#dfe4e5" stroke="#5f676b" strokeWidth="1.5" />
                    </g>
                ))}
            </svg>
        </div>
    );
}

function ValveElement({ mapping, sensorData }: { mapping: ScadaMapping; sensorData?: SensorData }) {
    const [manualToggle, setManualToggle] = useState(false);
    const value = getSensorValue(mapping, sensorData);
    const isAvailable = value !== null;
    const isLiveOpen = isSourceActive(mapping, value);
    const isOpen = isLiveOpen || manualToggle;
    const color = !isAvailable ? '#64748b' : isOpen ? (mapping.normal_color || '#22c55e') : (mapping.critical_color || '#ef4444');
    const bodyColor = isAvailable ? '#1456b8' : '#475569';
    const darkBodyColor = isAvailable ? '#0b3b8f' : '#334155';
    const highlightColor = isAvailable ? '#4fa3ff' : '#94a3b8';

    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center rounded-md bg-slate-900/80 cursor-pointer select-none"
            data-testid="scada-valve"
            data-state={!isAvailable ? 'unavailable' : isOpen ? 'open' : 'closed'}
            onClick={() => setManualToggle((current) => !current)}
        >
            <svg viewBox="0 0 120 140" className="h-[78%] w-[86%]" role="img" aria-label={`${mapping.label || mapping.element_id} valve`}>
                <g>
                    <ellipse cx="60" cy="116" rx="42" ry="8" fill="#020617" opacity="0.35" />

                    <rect x="14" y="69" width="92" height="34" rx="14" fill={bodyColor} stroke={darkBodyColor} strokeWidth="3" />
                    <path d="M18 75 H102 V84 H18 Z" fill={highlightColor} opacity="0.28" />
                    <path d="M18 88 H102 V98 H18 Z" fill={darkBodyColor} opacity="0.35" />
                    <ellipse cx="18" cy="86" rx="7" ry="15" fill={bodyColor} stroke={darkBodyColor} strokeWidth="3" />
                    <ellipse cx="102" cy="86" rx="7" ry="15" fill={bodyColor} stroke={darkBodyColor} strokeWidth="3" />
                    <ellipse cx="106" cy="86" rx="5" ry="11" fill="#061126" opacity="0.75" />

                    <path d="M38 52 H82 Q92 54 95 69 H25 Q28 54 38 52 Z" fill={bodyColor} stroke={darkBodyColor} strokeWidth="3" />
                    <path d="M45 58 H75 Q81 60 83 69 H37 Q39 60 45 58 Z" fill={highlightColor} opacity="0.24" />
                    <path d="M49 61 H71 Q76 63 77 70 H43 Q44 63 49 61 Z" fill={color} opacity={isOpen ? 0.45 : 0.14} />

                    <rect x="35" y="44" width="50" height="13" rx="4" fill={bodyColor} stroke={darkBodyColor} strokeWidth="3" />
                    {[32, 46, 74, 88].map((boltX) => (
                        <circle key={boltX} cx={boltX} cy="50" r="3.5" fill="#cbd5e1" stroke={darkBodyColor} strokeWidth="2" />
                    ))}

                    <rect x="55" y="39" width="10" height="12" rx="3" fill="#a16207" stroke="#451a03" strokeWidth="2" />
                    <rect x="51" y="48" width="18" height="9" rx="3" fill={darkBodyColor} stroke="#082f6b" strokeWidth="2" />

                    <g
                        style={{
                            transform: `rotate(${isOpen ? 90 : 0}deg)`,
                            transformOrigin: '60px 35px',
                            transition: 'transform 450ms ease-in-out',
                        }}
                    >
                        <circle cx="60" cy="35" r="28" fill="#0b1a34" opacity="0.36" />
                        <circle cx="60" cy="35" r="28" fill="none" stroke={bodyColor} strokeWidth="8" />
                        <line x1="36" y1="35" x2="84" y2="35" stroke={bodyColor} strokeWidth="7" strokeLinecap="round" />
                        <line x1="60" y1="11" x2="60" y2="59" stroke={bodyColor} strokeWidth="7" strokeLinecap="round" />
                        <line x1="43" y1="18" x2="77" y2="52" stroke={bodyColor} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
                        <line x1="43" y1="52" x2="77" y2="18" stroke={bodyColor} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
                        <circle cx="60" cy="35" r="28" fill="none" stroke={highlightColor} strokeWidth="2" opacity="0.55" />
                        <rect x="53" y="29" width="14" height="12" rx="2" fill="#d6b05d" stroke="#713f12" strokeWidth="2" />
                    </g>
                </g>
            </svg>
            <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
                {mapping.label || mapping.element_id}: {!isAvailable ? 'N/A' : isOpen ? (typeof value === 'number' && value > 0 ? `OPEN (${value.toFixed(0)}%)` : 'OPEN') : 'CLOSED'}
            </span>
        </div>
    );
}

function PumpElement({ mapping, sensorData }: { mapping: ScadaMapping; sensorData?: SensorData }) {
    const value = getSensorValue(mapping, sensorData);
    const isAvailable = value !== null;
    const isOn = isSourceActive(mapping, value);
    const color = isOn ? mapping.normal_color : '#64748b';
    const bodyColor = isOn ? '#1456b8' : '#334155';
    const highlightColor = isOn ? '#38bdf8' : '#94a3b8';
    const impellerColor = isOn ? '#d6b05d' : '#64748b';

    return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-slate-900/80">
            <svg viewBox="0 0 120 120" className="h-[78%] w-[84%]" role="img" aria-label={`${mapping.label || mapping.element_id} pump`}>
                <ellipse cx="61" cy="102" rx="38" ry="7" fill="#020617" opacity="0.35" />
                <path d="M28 70 H92 Q101 70 105 79 V92 Q105 101 94 101 H26 Q16 101 16 91 V81 Q18 70 28 70 Z" fill={bodyColor} stroke="#0f172a" strokeWidth="3" />
                <path d="M24 75 H97 V83 H22 Q23 78 24 75 Z" fill={highlightColor} opacity="0.28" />
                <ellipse cx="23" cy="85" rx="8" ry="14" fill={bodyColor} stroke="#0f172a" strokeWidth="3" />
                <ellipse cx="97" cy="85" rx="8" ry="14" fill={bodyColor} stroke="#0f172a" strokeWidth="3" />
                <circle cx="60" cy="52" r="32" fill="#111827" stroke={bodyColor} strokeWidth="6" />
                <circle cx="60" cy="52" r="25" fill="#0f172a" stroke={highlightColor} strokeWidth="2" opacity="0.85" />
                <g className={isOn ? 'animate-spin' : ''} style={{ transformOrigin: '60px 52px', animationDuration: '1.2s' }}>
                    <circle cx="60" cy="52" r="7" fill={impellerColor} stroke="#713f12" strokeWidth="1.5" />
                    {[0, 60, 120, 180, 240, 300].map((angle) => (
                        <path
                            key={angle}
                            d="M60 52 C67 43 73 42 79 45 C74 49 70 54 69 62 C66 57 63 54 60 52 Z"
                            fill={impellerColor}
                            opacity={isOn ? 0.95 : 0.45}
                            transform={`rotate(${angle} 60 52)`}
                        />
                    ))}
                </g>
                <path d="M38 101 H49 V109 H38 Z M72 101 H83 V109 H72 Z" fill="#0f172a" />
            </svg>
            <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
                {mapping.label || mapping.element_id}: {!isAvailable ? 'N/A' : isOn ? 'RUN' : 'STOP'}
            </span>
        </div>
    );
}

function TankElement({ mapping, sensorData }: { mapping: ScadaMapping; sensorData?: SensorData }) {
    const value = getSensorValue(mapping, sensorData);
    const color = getStatusColor(mapping, value);
    const { min, max, unit } = getGaugeDefinition(mapping.data_source);
    const numVal = typeof value === 'number' ? value : min;
    const pct = Math.min(100, Math.max(0, ((numVal - min) / (max - min)) * 100));
    const displayValue = value === null ? '--' : `${formatValue(mapping, value)}${unit}`;
    const fillHue = Math.max(0, 48 - (pct / 100) * 48);
    const fillColor = value === null ? '#475569' : `hsl(${fillHue} 95% 55%)`;
    const fillTop = 126 - (pct / 100) * 86;

    return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-slate-900/80">
            <svg viewBox="0 0 120 150" className="h-[82%] w-[82%]" role="img" aria-label={`${mapping.label || mapping.element_id} tank`}>
                <ellipse cx="60" cy="132" rx="42" ry="8" fill="#020617" opacity="0.35" />
                <path d="M23 38 C23 22 39 14 60 14 C81 14 97 22 97 38 V112 C97 129 81 138 60 138 C39 138 23 129 23 112 Z" fill="#101827" stroke="#9fb0c6" strokeWidth="6" />
                <path d="M30 39 C30 29 43 23 60 23 C77 23 90 29 90 39 V111 C90 123 77 129 60 129 C43 129 30 123 30 111 Z" fill="#0f172a" />
                <ellipse cx="60" cy="39" rx="30" ry="14" fill="#182235" stroke="#9fb0c6" strokeWidth="4" />
                <ellipse cx="60" cy="39" rx="22" ry="8" fill="#050b16" opacity="0.9" />
                <clipPath id={`tank-fill-${mapping.id}`}>
                    <path d="M30 39 C30 29 43 23 60 23 C77 23 90 29 90 39 V111 C90 123 77 129 60 129 C43 129 30 123 30 111 Z" />
                </clipPath>
                <g clipPath={`url(#tank-fill-${mapping.id})`}>
                    <rect x="30" y="39" width="60" height="88" fill="#0f172a" />
                    <rect
                        x="30"
                        y={fillTop}
                        width="60"
                        height={126 - fillTop}
                        fill={fillColor}
                        opacity="0.72"
                        style={{ transition: 'y 600ms ease, height 600ms ease' }}
                    />
                    <ellipse
                        cx="60"
                        cy={fillTop}
                        rx="30"
                        ry="9"
                        fill={fillColor}
                        opacity="0.9"
                        style={{ transition: 'cy 600ms ease' }}
                    />
                    <ellipse cx="60" cy="126" rx="30" ry="10" fill={fillColor} opacity="0.55" />
                </g>
                <path d="M29 39 C35 52 85 52 91 39" fill="none" stroke="#64748b" strokeWidth="2" opacity="0.45" />
                <ellipse cx="60" cy="112" rx="30" ry="13" fill="none" stroke="#9fb0c6" strokeWidth="4" opacity="0.85" />
                <path d="M30 48 V111 C30 123 43 129 60 129 C77 129 90 123 90 111 V48" fill="none" stroke="#cbd5e1" strokeWidth="2" opacity="0.28" />
                <text x="60" y="87" textAnchor="middle" fill="#020617" stroke="#020617" strokeWidth="4" fontSize="18" fontWeight="900">{displayValue}</text>
                <text x="60" y="87" textAnchor="middle" fill="#f8fafc" fontSize="18" fontWeight="900">{displayValue}</text>
            </svg>
            {mapping.label && <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{mapping.label}</span>}
        </div>
    );
}

function LabelElement({ mapping }: { mapping: ScadaMapping }) {
    return (
        <div className="flex h-full w-full items-center justify-center rounded border border-slate-700 bg-slate-900/75">
            <span className="max-w-full truncate px-2 text-sm font-semibold uppercase tracking-wide text-slate-200">
                {mapping.label || mapping.element_id}
            </span>
        </div>
    );
}

function IndicatorElement({ mapping, sensorData }: { mapping: ScadaMapping; sensorData?: SensorData }) {
    const value = getSensorValue(mapping, sensorData);
    const isActive = isSourceActive(mapping, value);
    const color = isActive ? '#22c55e' : '#ef4444';
    const status = value === null ? 'N/A' : typeof value === 'boolean' ? formatBoolean(mapping.data_source, value) : (isActive ? 'ON' : 'OFF');

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border border-slate-700 bg-slate-900/85">
            <svg viewBox="0 0 90 70" className="h-[56%] w-[70%]" role="img" aria-label={`${mapping.label || mapping.element_id} indicator`}>
                <rect x="16" y="8" width="58" height="48" rx="10" fill="#111827" stroke="#334155" strokeWidth="2" />
                <circle
                    cx="45"
                    cy="32"
                    r="15"
                    fill={color}
                    className={isActive ? 'animate-pulse' : ''}
                    style={{
                        filter: isActive ? `drop-shadow(0 0 10px ${color})` : undefined,
                    }}
                    data-testid="scada-indicator-light"
                    data-state={isActive ? 'active' : 'idle'}
                />
                <circle cx="40" cy="26" r="5" fill="#ffffff" opacity={isActive ? 0.28 : 0.12} />
            </svg>
            <span className="max-w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
                {mapping.label || mapping.element_id}: {status}
            </span>
        </div>
    );
}

function PipeElement({ mapping, sensorData }: { mapping: ScadaMapping; sensorData?: SensorData }) {
    const value = getSensorValue(mapping, sensorData);
    const isAvailable = value !== null;
    const isActive = isSourceActive(mapping, value);
    const activeColor = mapping.normal_color || '#22d3ee';
    const flowColor = '#f97316';
    const flowCoreColor = '#facc15';
    const flowHotColor = '#ef4444';

    return (
        <div
            className="flex h-full w-full items-center justify-center"
            data-testid="scada-pipe"
            data-state={!isAvailable ? 'unavailable' : isActive ? 'active' : 'idle'}
            aria-label={`${mapping.label || mapping.element_id}: ${!isAvailable ? 'UNAVAILABLE' : isActive ? 'FLOW' : 'NO FLOW'}`}
        >
            <div className="relative h-7 w-full overflow-hidden rounded-full border border-slate-400 bg-slate-800 shadow-[inset_0_2px_4px_rgba(255,255,255,0.28),inset_0_-3px_5px_rgba(0,0,0,0.45)]">
                <style>
                    {`
                        @keyframes scada-pipe-flow-slide {
                            from { transform: translateX(-110%); }
                            to { transform: translateX(210%); }
                        }
                        @keyframes scada-pipe-wind {
                            from { transform: translateX(-48px) rotate(0deg); }
                            to { transform: translateX(calc(100% + 48px)) rotate(360deg); }
                        }
                    `}
                </style>
                <div
                    className="absolute inset-y-[4px] left-3 right-3 rounded-full"
                    style={{
                        background: `linear-gradient(180deg, ${activeColor}aa, ${activeColor}55 48%, #0f172a 52%, ${activeColor}33)`,
                    }}
                />
                <div
                    className="absolute left-0 top-1/2 h-7 w-5 -translate-y-1/2 rounded-[50%] border-2 shadow-[inset_2px_0_3px_rgba(255,255,255,0.25)]"
                    style={{ backgroundColor: activeColor, borderColor: '#0b3b8f' }}
                />
                <div className="absolute left-2 top-1/2 h-5 w-3 -translate-y-1/2 rounded-[50%] bg-slate-950 shadow-[inset_2px_0_3px_rgba(0,0,0,0.75)]" />
                <div
                    className="absolute right-0 top-1/2 h-7 w-5 -translate-y-1/2 rounded-[50%] border-2 shadow-[inset_-2px_0_3px_rgba(255,255,255,0.22)]"
                    style={{ backgroundColor: activeColor, borderColor: '#0b3b8f' }}
                />
                <div className="absolute right-2 top-1/2 h-5 w-3 -translate-y-1/2 rounded-[50%] bg-slate-950 shadow-[inset_-2px_0_3px_rgba(0,0,0,0.75)]" />
                <div className="absolute left-7 right-7 top-1.5 h-1.5 rounded-full bg-white/20" />
                {isActive && (
                    <div
                        className="absolute inset-y-[5px] left-7 right-7 animate-pulse rounded-full"
                        style={{
                            background: `linear-gradient(90deg, ${flowCoreColor}66, ${flowColor}88, ${flowHotColor}66)`,
                            boxShadow: `0 0 12px ${flowColor}`,
                        }}
                        data-testid="scada-pipe-flow"
                    />
                )}
                {isActive && (
                    <div className="absolute inset-y-[4px] left-7 right-7 overflow-hidden rounded-full">
                        <svg
                            viewBox="0 0 180 18"
                            preserveAspectRatio="none"
                            className="absolute inset-y-0 left-0 h-full w-[180px]"
                            style={{
                                animation: 'scada-pipe-flow-slide 1.2s linear infinite',
                                filter: `drop-shadow(0 0 5px ${activeColor})`,
                            }}
                        >
                            <path
                                d="M0 9 C8 1 16 1 24 9 S40 17 48 9 S64 1 72 9 S88 17 96 9 S112 1 120 9 S136 17 144 9 S160 1 168 9 S184 17 192 9"
                                fill="none"
                                stroke={flowColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                            <path
                                d="M0 9 C8 17 16 17 24 9 S40 1 48 9 S64 17 72 9 S88 1 96 9 S112 17 120 9 S136 1 144 9 S160 17 168 9 S184 1 192 9"
                                fill="none"
                                stroke={flowCoreColor}
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
}

const elementRenderers: Record<string, React.FC<ScadaRendererProps>> = {
    gauge: GaugeElement,
    display: DisplayElement,
    valve: ValveElement,
    pump: PumpElement,
    tank: TankElement,
    label: LabelElement,
    indicator: IndicatorElement,
    pipe: PipeElement,
};

export default function ScadaElement({ mapping, sensorData, controllerModel, className = '', selected, onSelect }: ScadaElementProps) {
    const Renderer = elementRenderers[mapping.element_type] || DisplayElement;

    return (
        <div
            className={`absolute isolate select-none overflow-hidden rounded ${selected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950' : ''} ${onSelect ? 'cursor-pointer hover:ring-1 hover:ring-cyan-300' : ''} ${className}`}
            style={{
                left: mapping.position_x,
                top: mapping.position_y,
                width: mapping.width,
                height: mapping.height,
                zIndex: mapping.z_index,
                transform: mapping.rotation ? `rotate(${mapping.rotation}deg)` : undefined,
            }}
            onClick={() => onSelect?.(mapping.id)}
            data-testid={`scada-element-${mapping.element_id}`}
        >
            <Renderer mapping={mapping} sensorData={sensorData} controllerModel={controllerModel} />
        </div>
    );
}
