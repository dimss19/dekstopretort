import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import TnFaceplateDisplay from '../Tn/TnFaceplateDisplay';
import { RetortTelemetry } from '@/Pages/Tn/retortTelemetry';

const baseTelemetry: RetortTelemetry = {
    actualTemperature: 24.5,
    targetTemperature: 25.0,
    heatingPercent: 0,
    coolingPercent: 0,
    running: false,
    automatic: true,
    heatingActive: false,
    coolingActive: false,
    sensorFault: null,
    activeAlarms: [],
    alarmActive: false,
    phase: 'Waiting',
    pattern: 1,
    step: 1,
    processTime: 0,
    remainingTime: 0,
    timestamp: '2026-08-29T09:00:00Z',
};

describe('TnFaceplateDisplay Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows STOP badge and blinks Stop / SV when controller is stopped', () => {
        const { unmount } = render(
            <TnFaceplateDisplay telemetry={baseTelemetry} isOnline={true} modelType="TNH-P" />
        );

        expect(screen.getByText('STOP')).toBeInTheDocument();
        expect(screen.getByText('25.0')).toBeInTheDocument();

        // Advance 500ms to test blink toggle to 'STOP'
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(screen.getAllByText('STOP').length).toBe(2);

        // Advance another 500ms back to '25.0'
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(screen.getByText('25.0')).toBeInTheDocument();
        expect(screen.getAllByText('STOP').length).toBe(1);

        unmount();
    });

    it('shows RUN badge and static SV when MV is 100%', () => {
        const mv100Telemetry: RetortTelemetry = {
            ...baseTelemetry,
            running: false, // Even if raw telemetry says not running
            heatingPercent: 100,
            targetTemperature: 121.0,
        };

        const { unmount } = render(
            <TnFaceplateDisplay telemetry={mv100Telemetry} isOnline={true} modelType="TNH-P" />
        );

        expect(screen.getByText('RUN')).toBeInTheDocument();
        expect(screen.queryByText('STOP')).not.toBeInTheDocument();
        expect(screen.getByText('121.0')).toBeInTheDocument();

        // Advance time - should NEVER blink to 'Stop'
        act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(screen.queryByText('Stop')).not.toBeInTheDocument();
        expect(screen.getByText('121.0')).toBeInTheDocument();

        unmount();
    });

    it('shows RUN badge and static SV when process is running', () => {
        const runningTelemetry: RetortTelemetry = {
            ...baseTelemetry,
            running: true,
            phase: 'Heating',
            processTime: 45,
            targetTemperature: 121.0,
        };

        const { unmount } = render(
            <TnFaceplateDisplay telemetry={runningTelemetry} isOnline={true} modelType="TNH-P" />
        );

        expect(screen.getByText('RUN')).toBeInTheDocument();
        expect(screen.queryByText('STOP')).not.toBeInTheDocument();
        expect(screen.getByText('121.0')).toBeInTheDocument();

        // Advance time - should NEVER blink to 'Stop'
        act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(screen.queryByText('Stop')).not.toBeInTheDocument();
        expect(screen.getByText('121.0')).toBeInTheDocument();

        unmount();
    });
});
