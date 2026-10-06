import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { PageProps, ScadaCanvas as ScadaCanvasType, ScadaMapping } from '@/types';
import { TnController } from '@/types/tn';
import RetortMonitorShell from '@/Components/Tn/RetortMonitorShell';
import {
    buildRetortEvents,
    buildRetortTelemetry,
    formatControllerTime,
} from './retortTelemetry';

interface Props extends PageProps {
    controller: TnController & {
        communication?: string;
        polling_interval?: number;
        machine?: { machine_name: string };
        scada_canvas?: ScadaCanvasType | null;
        scada_mappings?: ScadaMapping[];
    };
    latestReading: any;
}

type MonitorTab = 'monitor' | 'scada';

export default function Monitor({ controller, latestReading: initialReading }: Props) {
    const pollIntervalMs = 1000; // Pembacaan Modbus per 1 detik
    const staleAfterMs = 8000;   // Toleransi 8 detik sebelum dianggap offline jika tidak ada respons
    const getReadingTimestamp = (value: any) => value?.created_at ?? value?.timestamp ?? null;
    const timestampToMs = (timestamp: any): number | false => {
        if (!timestamp) return false;
        const time = new Date(timestamp).getTime();
        return Number.isFinite(time) ? time : false;
    };
    const isFreshTimestamp = (timestamp: any) => {
        const time = timestampToMs(timestamp);
        return time !== false && Date.now() - time <= staleAfterMs;
    };

    const [reading, setReading] = useState(initialReading);
    const [history, setHistory] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<MonitorTab>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'scada') return 'scada';
        }
        return 'monitor';
    });

    const handleTabChange = (tab: MonitorTab) => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (tab === 'scada') {
                url.searchParams.set('tab', 'scada');
            } else {
                url.searchParams.delete('tab');
            }
            window.history.replaceState({}, '', url.toString());
        }
    };
    const [currentPort, setCurrentPort] = useState<string>(controller.serial_port || 'AUTO');
    const [isLiveOnline, setIsLiveOnline] = useState<boolean>(() => {
        return Boolean(
            controller.is_online && isFreshTimestamp(getReadingTimestamp(initialReading))
        );
    });
    const [commandPending, setCommandPending] = useState<'run' | 'stop' | 'reset' | null>(null);
    const lastReadingTimestampRef = useRef<any>(getReadingTimestamp(initialReading));
    const lastSeenAtRef = useRef<number | false>(timestampToMs(getReadingTimestamp(initialReading)));
    const lastReadingIdRef = useRef<number | null>(initialReading?.id ?? null);
    const serverOnlineRef = useRef<boolean>(Boolean(controller.is_online));

    useEffect(() => {
        let isMounted = true;
        let pollTimer: number | null = null;
        lastReadingTimestampRef.current = getReadingTimestamp(initialReading);
        lastSeenAtRef.current = timestampToMs(getReadingTimestamp(initialReading));
        lastReadingIdRef.current = initialReading?.id ?? null;
        serverOnlineRef.current = Boolean(controller.is_online);

        const applyReading = (newReading: any, appendHistory = true) => {
            if (!isMounted || !newReading) return;

            if (newReading.id) {
                lastReadingIdRef.current = newReading.id;
            }
            const timestamp = getReadingTimestamp(newReading);
            const timestampMs = timestampToMs(timestamp);
            lastSeenAtRef.current = timestampMs !== false ? timestampMs : Date.now();
            lastReadingTimestampRef.current = timestamp;
            setIsLiveOnline(true);
            setReading(newReading);

            if (appendHistory) {
                setHistory((previous) => {
                    const next = [...previous, newReading];
                    return next.length > 1800 ? next.slice(next.length - 1800) : next;
                });
            }
        };

        const loadReadings = async (replaceLatest = false) => {
            try {
                const sinceId = (!replaceLatest && lastReadingIdRef.current) ? lastReadingIdRef.current : null;
                const url = sinceId
                    ? `${route('tn.readings', controller.id)}?since_id=${sinceId}`
                    : `${route('tn.readings', controller.id)}?limit=600`;

                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                if (!isMounted) return;

                let incomingReadings: any[] = [];
                let onlineStatus: boolean | null = null;
                let activePort: string | null = null;

                if (Array.isArray(data)) {
                    incomingReadings = data;
                } else if (data && typeof data === 'object') {
                    incomingReadings = Array.isArray(data.readings) ? data.readings : [];
                    onlineStatus = typeof data.is_online === 'boolean' ? data.is_online : null;
                    if (data.serial_port) {
                        activePort = data.serial_port;
                    }
                    if (typeof data.unverified_count === 'number') {
                        window.dispatchEvent(new CustomEvent('unverified-count-update', { detail: data.unverified_count }));
                    }
                }

                if (onlineStatus !== null) {
                    serverOnlineRef.current = onlineStatus;
                }

                if (activePort && activePort !== currentPort) {
                    setCurrentPort(activePort);
                }

                if (sinceId) {
                    // Incremental update
                    if (incomingReadings.length > 0) {
                        const latest = incomingReadings[incomingReadings.length - 1];
                        if (latest?.id) {
                            lastReadingIdRef.current = latest.id;
                        }
                        const timestamp = getReadingTimestamp(latest);
                        const timestampMs = timestampToMs(timestamp);
                        lastReadingTimestampRef.current = timestamp;
                        lastSeenAtRef.current = timestampMs !== false ? timestampMs : Date.now();
                        setReading(latest);
                        setHistory((previous) => {
                            const next = [...previous, ...incomingReadings];
                            return next.length > 1800 ? next.slice(next.length - 1800) : next;
                        });
                        setIsLiveOnline(onlineStatus !== false);
                    } else {
                        // No new readings in this tick
                        if (onlineStatus === false) {
                            setIsLiveOnline(false);
                        } else if (onlineStatus === true) {
                            const lastSeen = lastSeenAtRef.current;
                            if (lastSeen !== false && Date.now() - lastSeen > staleAfterMs) {
                                setIsLiveOnline(false);
                            }
                        }
                    }
                } else {
                    // Full/Initial load
                    setHistory(incomingReadings);
                    const latest = incomingReadings[incomingReadings.length - 1];
                    if (latest) {
                        if (latest.id) {
                            lastReadingIdRef.current = latest.id;
                        }
                        const timestamp = getReadingTimestamp(latest);
                        const timestampMs = timestampToMs(timestamp);
                        lastReadingTimestampRef.current = timestamp;
                        lastSeenAtRef.current = timestampMs !== false ? timestampMs : Date.now();
                        setReading(latest);
                    }

                    if (onlineStatus !== null) {
                        if (!onlineStatus) {
                            setIsLiveOnline(false);
                        } else {
                            const isFresh = latest ? isFreshTimestamp(getReadingTimestamp(latest)) : false;
                            setIsLiveOnline(isFresh);
                        }
                    } else if (latest) {
                        const isFresh = isFreshTimestamp(getReadingTimestamp(latest));
                        setIsLiveOnline(isFresh);
                    } else {
                        setIsLiveOnline(false);
                    }
                }
            } catch {
                if (isMounted) setIsLiveOnline(false);
            }
        };

        const schedulePoll = () => {
            if (!isMounted) return;
            pollTimer = window.setTimeout(async () => {
                await loadReadings();
                schedulePoll();
            }, pollIntervalMs);
        };

        loadReadings(true).finally(() => {
            schedulePoll();
        });

        const echo = (window as any).Echo;
        const channel = echo?.channel(`tn.${controller.id}`);
        channel?.listen('.tn.data', (event: any) => {
            applyReading({
                id: event.id,
                pv: event.pv,
                sv: event.sv,
                heating_mv: event.heating_mv,
                cooling_mv: event.cooling_mv,
                run_status: event.run_status,
                auto_manual: event.auto_manual,
                at_running: event.at_running,
                out1_active: event.out1_active,
                out2_active: event.out2_active,
                alarms: event.alarms,
                alarm_bits: event.alarm_bits,
                pattern_current: event.pattern_current,
                step_current: event.step_current,
                process_time: event.process_time,
                rest_time: event.rest_time,
                created_at: event.timestamp,
                decimal_point: event.decimal_point,
            });
        });

        const staleIntervalId = window.setInterval(() => {
            if (!isMounted) return;
            // Only watchdog: if server is supposedly online, but no reading has arrived in > staleAfterMs, set offline
            if (serverOnlineRef.current && lastSeenAtRef.current !== false) {
                if (Date.now() - lastSeenAtRef.current > staleAfterMs) {
                    setIsLiveOnline(false);
                }
            }
        }, 1000);

        return () => {
            isMounted = false;
            if (pollTimer !== null) window.clearTimeout(pollTimer);
            window.clearInterval(staleIntervalId);
            channel?.stopListening('.tn.data');
        };
    }, [controller.id, controller.polling_interval, initialReading]);

    const isOnline = isLiveOnline;
    const telemetry = useMemo(() => buildRetortTelemetry(reading, isOnline), [isOnline, reading]);
    const recentEvents = useMemo(() => buildRetortEvents(history), [history]);
    const normalizedHistory = useMemo(() => history.map((item) => {
        const normalized = buildRetortTelemetry(item, true);
        return {
            ...item,
            pv: normalized.actualTemperature,
            sv: normalized.targetTemperature,
            decimal_point: 0,
        };
    }).filter((item) => item.pv !== null && item.sv !== null), [history]);

    const sensorData = isOnline && reading ? {
        pv: reading.pv,
        sv: reading.sv,
        heating_mv: reading.heating_mv,
        cooling_mv: reading.cooling_mv,
        run_status: reading.run_status,
        auto_manual: reading.auto_manual,
        at_running: reading.at_running,
        out1_active: reading.out1_active,
        out2_active: reading.out2_active,
        alarms: reading.alarms,
        pattern_current: reading.pattern_current,
        step_current: reading.step_current,
        process_time: reading.process_time,
        rest_time: reading.rest_time,
        decimal_point: reading.decimal_point,
        alarm_bits: reading.alarm_bits,
        controller_running: telemetry.running,
        alarm_active: telemetry.alarmActive,
        process_phase: telemetry.phase,
        actual_temperature: telemetry.actualTemperature,
        target_temperature: telemetry.targetTemperature,
    } : undefined;

    const sendCommand = (kind: 'run' | 'stop' | 'reset') => {
        if (commandPending || !isOnline) return;
        setCommandPending(kind);

        const routeName = kind === 'reset' ? 'tn.cmd.alarmreset' : 'tn.cmd.runstop';
        const payload = kind === 'reset' ? {} : { run: kind === 'run' };
        router.post(route(routeName, controller.id), payload, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setCommandPending(null),
        });
    };

    const lastUpdate = telemetry.timestamp
        ? new Date(telemetry.timestamp).toLocaleString('id-ID')
        : 'Belum ada data';

    return (
        <RetortMonitorShell
            controller={controller}
            telemetry={telemetry}
            events={recentEvents}
            history={normalizedHistory}
            mappings={controller.scada_mappings ?? []}
            canvas={controller.scada_canvas}
            sensorData={sensorData}
            isOnline={isOnline}
            serialPort={currentPort}
            commandPending={commandPending}
            lastUpdate={lastUpdate}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onRun={() => sendCommand('run')}
            onStop={() => sendCommand('stop')}
            onResetAlarm={() => sendCommand('reset')}
        />
    );
}
