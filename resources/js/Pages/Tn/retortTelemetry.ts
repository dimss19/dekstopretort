export type RetortPhase = 'Offline' | 'Alarm' | 'Waiting' | 'Heating' | 'Holding' | 'Cooling' | 'Running';

export interface RetortTelemetry {
    actualTemperature: number | null;
    targetTemperature: number | null;
    heatingPercent: number | null;
    coolingPercent: number | null;
    running: boolean;
    automatic: boolean;
    heatingActive: boolean;
    coolingActive: boolean;
    sensorFault: string | null;
    activeAlarms: string[];
    alarmActive: boolean;
    phase: RetortPhase;
    pattern: number | null;
    step: number | null;
    processTime: number | null;
    remainingTime: number | null;
    timestamp: string | null;
}

export interface RetortEvent {
    id: string;
    timestamp: string | null;
    label: string;
    tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

const SENSOR_FAULTS: Record<number, string> = {
    31000: 'Sensor open / terputus',
    30000: 'Suhu melewati batas atas',
    [-30000]: 'Suhu melewati batas bawah',
};

export function toEngineeringValue(value: unknown, decimalPoint: unknown = 0): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || SENSOR_FAULTS[value]) {
        return null;
    }

    const decimals = typeof decimalPoint === 'number' && Number.isFinite(decimalPoint)
        ? Math.max(0, Math.min(4, Math.trunc(decimalPoint)))
        : 0;

    return value / Math.pow(10, decimals);
}

export function toOutputPercent(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value / 10));
}

export function getAlarmIds(reading: any): string[] {
    if (!reading) return [];

    if (reading.alarms && typeof reading.alarms === 'object') {
        return Object.entries(reading.alarms)
            .filter(([, active]) => Boolean(active))
            .map(([key]) => key.toUpperCase());
    }

    const bits = Number(reading.alarm_bits ?? 0);
    if (!Number.isFinite(bits)) return [];

    return Array.from({ length: 7 }, (_, index) => index)
        .filter((index) => (bits & (1 << index)) !== 0)
        .map((index) => `AL${index + 1}`);
}

export function buildRetortTelemetry(reading: any, isOnline: boolean): RetortTelemetry {
    const decimalPoint = reading?.decimal_point ?? 0;
    const actualTemperature = toEngineeringValue(reading?.pv, decimalPoint);
    const targetTemperature = toEngineeringValue(reading?.sv, decimalPoint);
    const heatingPercent = toOutputPercent(reading?.heating_mv);
    const coolingPercent = toOutputPercent(reading?.cooling_mv);
    const isAutoActive = reading && (reading.auto_manual === false || reading.auto_manual === 0 || reading.auto_manual === '0' || reading.auto_manual === 'false');

    // In TN controller Modbus: Bit 8 of 301008 is STOP indicator (1: STOP, 0: RUN).
    // Bit 0 of 301008 is PROG indicator (1: Program RUN).
    const isExplicitStop = reading?.run_status === true || reading?.run_status === 1 || reading?.run_status === '1' || reading?.run_status === 'true';
    const isExplicitRun = reading?.run_status === false || reading?.run_status === 0 || reading?.run_status === '0' || reading?.run_status === 'false' || reading?.prog_status === true || reading?.prog_status === 1;

    // Check if MV is 100% or process is actively running (timer elapsed, heating output active)
    const isMv100 = heatingPercent !== null && heatingPercent >= 100;
    const isProcessActive = Boolean(
        isMv100 ||
        (typeof reading?.process_time === 'number' && reading.process_time > 0) ||
        reading?.out1_active ||
        reading?.out2_active ||
        (heatingPercent !== null && heatingPercent > 0) ||
        (coolingPercent !== null && coolingPercent > 0)
    );

    let isStopActive = false;
    if (isExplicitRun || isMv100) {
        isStopActive = false;
    } else if (isExplicitStop && !isMv100 && (!reading?.process_time || reading?.process_time === 0)) {
        isStopActive = true;
    } else if (isExplicitStop) {
        isStopActive = !isProcessActive;
    } else {
        // Fallback only if no explicit status bit received from controller
        isStopActive = Boolean(
            !reading ||
            ((heatingPercent === null || heatingPercent === 0) &&
             (coolingPercent === null || coolingPercent === 0) &&
             !reading?.out1_active &&
             !reading?.out2_active &&
             (!reading?.process_time || reading?.process_time === 0))
        );
    }

    const isRunActive = Boolean(reading && !isStopActive);
    const running = Boolean(isOnline && reading && (isRunActive || isMv100 || isProcessActive));
    const automatic = Boolean(reading && isAutoActive);
    const heatingActive = Boolean(running && (reading?.out1_active || (heatingPercent ?? 0) > 0));
    const coolingActive = Boolean(running && (reading?.out2_active || (coolingPercent ?? 0) > 0));
    const sensorFault = typeof reading?.pv === 'number' ? SENSOR_FAULTS[reading.pv] ?? null : null;
    const activeAlarms = getAlarmIds(reading);
    const alarmActive = Boolean(sensorFault || activeAlarms.length > 0);

    let phase: RetortPhase = 'Waiting';
    if (!isOnline) phase = 'Offline';
    else if (alarmActive) phase = 'Alarm';
    else if (!running) phase = 'Waiting';
    else if (coolingActive) phase = 'Cooling';
    else if (heatingActive) phase = 'Heating';
    else if (
        actualTemperature !== null
        && targetTemperature !== null
        && Math.abs(actualTemperature - targetTemperature) <= 1
    ) phase = 'Holding';
    else phase = 'Running';

    return {
        actualTemperature,
        targetTemperature,
        heatingPercent,
        coolingPercent,
        running,
        automatic,
        heatingActive,
        coolingActive,
        sensorFault,
        activeAlarms,
        alarmActive,
        phase,
        pattern: typeof reading?.pattern_current === 'number' ? reading.pattern_current : null,
        step: typeof reading?.step_current === 'number' ? reading.step_current : null,
        processTime: typeof reading?.process_time === 'number' ? reading.process_time : null,
        remainingTime: typeof reading?.rest_time === 'number' ? reading.rest_time : null,
        timestamp: reading?.created_at ?? reading?.timestamp ?? null,
    };
}

export function formatControllerTime(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--:--';
    const num = Math.max(0, Math.trunc(value));
    const hi = Math.floor(num / 100);
    const lo = num % 100;
    if (lo >= 60) {
        // Fallback for raw seconds input (e.g. 75s -> 01:15)
        const totalSec = (hi * 60) + lo;
        const mm = Math.floor(totalSec / 60);
        const ss = totalSec % 60;
        return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    return `${String(hi).padStart(2, '0')}:${String(lo).padStart(2, '0')}`;
}

export function buildRetortEvents(readings: any[], limit = 12): RetortEvent[] {
    const events: RetortEvent[] = [];
    let previous: RetortTelemetry | null = null;

    readings.forEach((reading, index) => {
        const current = buildRetortTelemetry(reading, true);
        const timestamp = current.timestamp;
        const push = (label: string, tone: RetortEvent['tone']) => {
            events.push({
                id: `${timestamp ?? index}-${events.length}-${label}`,
                timestamp,
                label,
                tone,
            });
        };

        if (previous) {
            if (current.running !== previous.running) {
                push(current.running ? 'Controller RUN' : 'Controller STOP', current.running ? 'success' : 'neutral');
            }
            if (current.heatingActive !== previous.heatingActive) {
                push(`Heating output ${current.heatingActive ? 'ON' : 'OFF'}`, current.heatingActive ? 'warning' : 'neutral');
            }
            if (current.coolingActive !== previous.coolingActive) {
                push(`Cooling output ${current.coolingActive ? 'ON' : 'OFF'}`, current.coolingActive ? 'info' : 'neutral');
            }
            if (current.step !== previous.step && current.step !== null) {
                push(`Step berubah ke ${current.step}`, 'info');
            }

            const previousAlarms = new Set(previous.activeAlarms);
            current.activeAlarms
                .filter((alarm) => !previousAlarms.has(alarm))
                .forEach((alarm) => push(`${alarm} aktif`, 'danger'));

            if (current.sensorFault !== previous.sensorFault) {
                push(current.sensorFault ?? 'Sensor kembali normal', current.sensorFault ? 'danger' : 'success');
            }

            if (previous.alarmActive && !current.alarmActive) {
                push('Alarm kembali normal', 'success');
            }
        }

        previous = current;
    });

    return events.slice(-limit).reverse();
}

export interface RetortStepSegment {
    stepIndex: number;
    stepName: string;
    category: 'CUT' | 'HOLD' | 'COOL' | 'STEP';
    startIndex: number;
    endIndex: number;
    startMinute: number;
    endMinute: number;
    durationMinutes: number;
    avgTemperature: number;
    maxTemperature: number;
    f0Value: number;
    isHolding: boolean;
}

export interface F0CalculationOptions {
    tRef?: number;
    z?: number;
    threshold?: number;
    maxGapSeconds?: number;
}

/**
 * Normalizes temperature reading (handles 'pv' or 'actual', decimal point scaling, and overscale).
 */
export function normalizeReadingPv(r: any): number {
    const raw = Number(r?.pv ?? r?.actual ?? 0);
    const dp = Number(r?.decimal_point ?? 0);
    let pv = dp > 0 ? raw / Math.pow(10, dp) : raw;
    if (pv > 300) pv = pv / 10.0;
    return pv;
}

/**
 * Calculates F0 sterilization lethality value from logs using Trapezoidal integration
 * and actual timestamp differences (converted to minutes).
 */
export function calculateF0FromLogs(logs: any[], options: F0CalculationOptions = {}): number {
    const {
        tRef = 121.1,
        z = 10.0,
        threshold = 100.0,
        maxGapSeconds = 120,
    } = options;

    if (!logs || logs.length < 2) return 0;

    const hasTimestamps = logs.some((l) => Boolean(l?.created_at || l?.recorded_at));

    if (hasTimestamps) {
        // Sort chronologically ascending
        const sorted = [...logs].sort((a, b) => {
            const ta = new Date(a?.created_at || a?.recorded_at || 0).getTime();
            const tb = new Date(b?.created_at || b?.recorded_at || 0).getTime();
            return ta - tb;
        });

        let f0 = 0;
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];

            const tPrevMs = new Date(prev?.created_at || prev?.recorded_at || 0).getTime();
            const tCurrMs = new Date(curr?.created_at || curr?.recorded_at || 0).getTime();

            let dtSeconds = 1;
            if (!isNaN(tPrevMs) && !isNaN(tCurrMs) && tPrevMs > 0 && tCurrMs > 0) {
                dtSeconds = (tCurrMs - tPrevMs) / 1000;
            }

            // Skip duplicate (dt = 0) or backward timestamp
            if (dtSeconds <= 0) continue;

            // Suppress phantom lethality if gap is too large
            if (dtSeconds > maxGapSeconds) continue;

            const dtMinutes = dtSeconds / 60.0;
            const pvPrev = normalizeReadingPv(prev);
            const pvCurr = normalizeReadingPv(curr);

            const lPrev = pvPrev >= threshold ? Math.pow(10, (pvPrev - tRef) / z) : 0;
            const lCurr = pvCurr >= threshold ? Math.pow(10, (pvCurr - tRef) / z) : 0;

            f0 += ((lPrev + lCurr) / 2.0) * dtMinutes;
        }

        return Math.round(f0 * 100) / 100;
    }

    // Fallback for timestamp-less synthetic logs: assume 1-second trapezoidal interval
    let f0 = 0;
    const dtMinutes = 1.0 / 60.0;
    for (let i = 1; i < logs.length; i++) {
        const pvPrev = normalizeReadingPv(logs[i - 1]);
        const pvCurr = normalizeReadingPv(logs[i]);

        const lPrev = pvPrev >= threshold ? Math.pow(10, (pvPrev - tRef) / z) : 0;
        const lCurr = pvCurr >= threshold ? Math.pow(10, (pvCurr - tRef) / z) : 0;

        f0 += ((lPrev + lCurr) / 2.0) * dtMinutes;
    }

    return Math.round(f0 * 100) / 100;
}

/**
 * Calculates F0 sterilization lethality value given temperature array
 * Uses Trapezoidal integration across consecutive temperatures.
 */
export function calculateF0(
    temperatures: number[],
    intervalSeconds: number = 1,
    options: F0CalculationOptions = {}
): number {
    const { tRef = 121.1, z = 10.0, threshold = 100.0 } = options;
    if (!temperatures || temperatures.length === 0) return 0;
    if (temperatures.length === 1) {
        const temp = temperatures[0];
        if (temp < threshold) return 0;
        return Math.round(Math.pow(10, (temp - tRef) / z) * (intervalSeconds / 60) * 100) / 100;
    }

    let f0 = 0;
    const dtMinutes = intervalSeconds / 60;
    for (let i = 1; i < temperatures.length; i++) {
        const tPrev = temperatures[i - 1];
        const tCurr = temperatures[i];
        const lPrev = tPrev >= threshold ? Math.pow(10, (tPrev - tRef) / z) : 0;
        const lCurr = tCurr >= threshold ? Math.pow(10, (tCurr - tRef) / z) : 0;
        f0 += ((lPrev + lCurr) / 2.0) * dtMinutes;
    }
    return Math.round(f0 * 100) / 100;
}

/**
 * Groups readings into thermal step segments based on step transitions and temperature behavior
 */
export function segmentThermalSteps(readings: any[]): RetortStepSegment[] {
    if (!readings || readings.length === 0) return [];

    const segments: RetortStepSegment[] = [];
    let currentStep = readings[0].step_current ?? 0;
    let segStartIndex = 0;

    // Detect if readings have valid timestamp info
    const baseStartMs = new Date(readings[0]?.created_at || readings[0]?.recorded_at || 0).getTime();
    const hasTimestamps = !isNaN(baseStartMs) && baseStartMs > 0;

    for (let i = 0; i < readings.length; i++) {
        const itemStep = readings[i].step_current ?? 0;
        const isLast = i === readings.length - 1;

        if (itemStep !== currentStep || isLast) {
            const segEndIndex = isLast ? i : i - 1;
            const slice = readings.slice(segStartIndex, segEndIndex + 1);

            const temps = slice
                .map(r => toEngineeringValue(r.pv, r.decimal_point ?? 0))
                .filter((t): t is number => t !== null);

            const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;
            const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
            const f0Val = calculateF0FromLogs(slice);

            let category: 'CUT' | 'HOLD' | 'COOL' | 'STEP' = 'STEP';
            let stepName = `Step ${currentStep}`;

            const hasPriorHold = segments.some(s => s.category === 'HOLD');

            // Semantic category naming: Come-Up Time (CUT), Holding, or Cooling
            if (currentStep === 0) {
                category = 'CUT';
                stepName = 'CUT (Come-Up Time)';
            } else if (avgTemp >= 115 || currentStep === 1) {
                category = 'HOLD';
                stepName = 'Holding Time';
            } else if (currentStep === 2 || hasPriorHold) {
                category = 'COOL';
                stepName = 'Cooling Time in Retort';
            } else {
                category = 'STEP';
                stepName = `Step ${currentStep}`;
            }

            let startMin: number;
            let endMin: number;
            let durationMin: number;

            const segFirstMs = hasTimestamps ? new Date(slice[0]?.created_at || slice[0]?.recorded_at || 0).getTime() : NaN;
            const segLastMs = hasTimestamps ? new Date(slice[slice.length - 1]?.created_at || slice[slice.length - 1]?.recorded_at || 0).getTime() : NaN;

            if (hasTimestamps && !isNaN(segFirstMs) && !isNaN(segLastMs) && segLastMs >= segFirstMs) {
                startMin = Math.round(((segFirstMs - baseStartMs) / 60000) * 10) / 10;
                endMin = Math.round(((segLastMs - baseStartMs) / 60000) * 10) / 10;
                durationMin = Math.max(0.1, Math.round(((segLastMs - segFirstMs) / 60000) * 10) / 10);
            } else {
                startMin = Math.round((segStartIndex / 60) * 10) / 10;
                endMin = Math.round(((segEndIndex + 1) / 60) * 10) / 10;
                durationMin = Math.max(0.1, Math.round((endMin - startMin) * 10) / 10);
            }

            segments.push({
                stepIndex: currentStep,
                stepName,
                category,
                startIndex: segStartIndex,
                endIndex: segEndIndex,
                startMinute: startMin,
                endMinute: endMin,
                durationMinutes: durationMin,
                avgTemperature: Math.round(avgTemp * 10) / 10,
                maxTemperature: Math.round(maxTemp * 10) / 10,
                f0Value: f0Val,
                isHolding: category === 'HOLD',
            });

            currentStep = itemStep;
            segStartIndex = i;
        }
    }

    return segments;
}
