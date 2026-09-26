import { describe, expect, it } from 'vitest';
import {
    buildRetortEvents,
    buildRetortTelemetry,
    calculateF0,
    formatControllerTime,
    getAlarmIds,
    segmentThermalSteps,
    toEngineeringValue,
    toOutputPercent,
} from '../retortTelemetry';

describe('retort telemetry normalization', () => {
    it('converts raw TN values into engineering units', () => {
        expect(toEngineeringValue(1210, 1)).toBe(121);
        expect(toEngineeringValue(987, 2)).toBe(9.87);
        expect(toOutputPercent(725)).toBe(72.5);
        expect(toOutputPercent(1500)).toBe(100);
    });

    it('rejects TN sensor sentinel values', () => {
        expect(toEngineeringValue(31000, 0)).toBeNull();
        expect(toEngineeringValue(30000, 0)).toBeNull();
        expect(toEngineeringValue(-30000, 0)).toBeNull();
    });

    it('decodes alarms from either accessor data or raw bits', () => {
        expect(getAlarmIds({ alarms: { al1: true, al2: false, al3: true } })).toEqual(['AL1', 'AL3']);
        expect(getAlarmIds({ alarm_bits: 0b100010 })).toEqual(['AL2', 'AL6']);
    });

    it('keeps STOP semantics and prioritizes cooling phase', () => {
        const stopped = buildRetortTelemetry({ run_status: true, pv: 1000, sv: 1210, decimal_point: 1 }, true);
        expect(stopped.running).toBe(false);
        expect(stopped.phase).toBe('Waiting');

        const cooling = buildRetortTelemetry({
            run_status: false,
            pv: 900,
            sv: 1210,
            decimal_point: 1,
            cooling_mv: 450,
            out2_active: true,
        }, true);
        expect(cooling.running).toBe(true);
        expect(cooling.coolingPercent).toBe(45);
        expect(cooling.phase).toBe('Cooling');
    });

    it('treats MV 100 or active process time/step as running', () => {
        const mv100Telemetry = buildRetortTelemetry({
            run_status: true,
            heating_mv: 1000,
            pv: 500,
            sv: 1210,
            decimal_point: 1,
        }, true);
        expect(mv100Telemetry.running).toBe(true);
        expect(mv100Telemetry.heatingPercent).toBe(100);
        expect(mv100Telemetry.phase).toBe('Heating');

        const processActiveTelemetry = buildRetortTelemetry({
            run_status: true,
            process_time: 120,
            step_current: 1,
            pv: 600,
            sv: 1210,
            decimal_point: 1,
        }, true);
        expect(processActiveTelemetry.running).toBe(true);
    });

    it('reports sensor faults as alarms without inventing physical alarm names', () => {
        const telemetry = buildRetortTelemetry({ pv: 31000, sv: 1210, decimal_point: 1 }, true);
        expect(telemetry.actualTemperature).toBeNull();
        expect(telemetry.sensorFault).toContain('Sensor');
        expect(telemetry.alarmActive).toBe(true);
        expect(telemetry.phase).toBe('Alarm');
    });

    it('formats TN controller time and derives transition events', () => {
        expect(formatControllerTime(1234)).toBe('12:34');
        expect(formatControllerTime(null)).toBe('--:--');

        const events = buildRetortEvents([
            { created_at: '2026-07-19T01:00:00Z', run_status: true, heating_mv: 0, step_current: 1 },
            { created_at: '2026-07-19T01:00:01Z', run_status: false, heating_mv: 500, step_current: 2 },
        ]);

        expect(events.map((event) => event.label)).toEqual(expect.arrayContaining([
            'Controller RUN',
            'Heating output ON',
            'Step berubah ke 2',
        ]));
    });

    it('calculates F0 thermal lethality value accurately for sterilization temperatures', () => {
        // At exactly 121.11°C for 60 seconds (1 minute), F0 should be 1.0
        expect(calculateF0(Array(60).fill(121.11), 1)).toBe(1);
        // At 100°C for 10 minutes, F0 should be small (~0.08)
        expect(calculateF0(Array(600).fill(100), 1)).toBe(0.08);
        // Under 100°C contributes 0 to F0
        expect(calculateF0(Array(600).fill(90), 1)).toBe(0);
    });

    it('uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)', () => {
        expect(calculateF0(Array(600).fill(121.0), 1)).toBe(9.77);
    });

    it('segments multi-step retort process into named categories with duration', () => {
        const dummyReadings = [
            // Step 0: CUT (60 seconds -> 1 min)
            ...Array(60).fill(null).map((_, i) => ({ step_current: 0, pv: 250 + i * 15, decimal_point: 1 })),
            // Step 1: Holding (120 seconds -> 2 min)
            ...Array(120).fill(null).map(() => ({ step_current: 1, pv: 1210, decimal_point: 1 })),
            // Step 2: Cooling (60 seconds -> 1 min)
            ...Array(60).fill(null).map((_, i) => ({ step_current: 2, pv: 1210 - i * 10, decimal_point: 1 })),
        ];

        const segments = segmentThermalSteps(dummyReadings);
        expect(segments.length).toBe(3);
        expect(segments[0].category).toBe('CUT');
        expect(segments[0].stepName).toContain('CUT');
        expect(segments[1].category).toBe('HOLD');
        expect(segments[1].f0Value).toBeGreaterThan(0);
        expect(segments[2].category).toBe('COOL');
    });
});
