import React, { useEffect, useRef, useState, useMemo } from 'react';
import { toEngineeringValue, segmentThermalSteps, calculateF0, calculateF0FromLogs, RetortStepSegment } from '@/Pages/Tn/retortTelemetry';

interface Props {
    data: any[];
    targetSv?: number;
    height?: number;
    isRunning?: boolean;
}

export default function RetortThermalChart({ data = [], targetSv = 121.0, height = 360, isRunning = false }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(800);

    // Compute step segments ONLY when process is running (START / RUN)
    const segments: RetortStepSegment[] = useMemo(() => {
        if (!isRunning || !data || data.length === 0) {
            return [];
        }

        // Only segment during active process run
        return segmentThermalSteps(data);
    }, [data, isRunning]);

    // Compute total accumulated F0 and overall stats
    const stats = useMemo(() => {
        const temps = data
            .map(d => toEngineeringValue(d.pv, d.decimal_point ?? 0))
            .filter((t): t is number => t !== null && t < 3000);

        const currentTemp = temps.length > 0 ? temps[temps.length - 1] : 0;
        const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;
        const totalMinutes = Math.max(1, Math.round((data.length / 60) * 10) / 10);
        const totalF0 = calculateF0FromLogs(data);

        return {
            currentTemp,
            maxTemp,
            totalMinutes,
            totalF0,
            pointCount: data.length,
        };
    }, [data]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Draw Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = containerWidth;
        const h = height;

        canvas.width = width * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, h);

        const padding = { top: 40, right: 30, bottom: 45, left: 55 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = h - padding.top - padding.bottom;

        // Scale bounds
        const minY = 0;
        const maxY = 140; // 0 to 140 °C matching reference image
        const totalPoints = Math.max(120, data.length); // minimum 2 minutes x-span
        const totalDurationMinutes = Math.max(10, Math.ceil(totalPoints / 60 / 10) * 10); // Round up to 10-min increments

        const getX = (index: number) => {
            return padding.left + (index / Math.max(1, totalPoints - 1)) * plotWidth;
        };

        const getY = (temp: number) => {
            const clamped = Math.max(minY, Math.min(maxY, temp));
            return padding.top + (1 - (clamped - minY) / (maxY - minY)) * plotHeight;
        };

        // 1. Draw Fine Industrial Grid Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Minor grid lines (every 5 °C)
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let t = minY; t <= maxY; t += 5) {
            const y = getY(t);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotWidth, y);
            ctx.stroke();
        }

        // Major grid lines & Y-Axis Labels (every 20 °C)
        for (let t = minY; t <= maxY; t += 20) {
            const y = getY(t);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotWidth, y);
            ctx.stroke();

            // Y Label
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${t}`, padding.left - 10, y);
        }

        // X-Axis Major Grid & Labels (minutes)
        const minuteStep = totalDurationMinutes <= 30 ? 5 : totalDurationMinutes <= 90 ? 10 : 20;
        for (let m = 0; m <= totalDurationMinutes; m += minuteStep) {
            const idx = (m * 60);
            const x = padding.left + (idx / totalPoints) * plotWidth;
            if (x <= padding.left + plotWidth + 2) {
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + plotHeight);
                ctx.stroke();

                // X Label
                ctx.fillStyle = '#475569';
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(`${m}`, x, padding.top + plotHeight + 8);
            }
        }

        // 2. Draw Target Line ONLY when process is running (START / RUN)
        if (isRunning && targetSv && targetSv > 0) {
            const targetY = getY(targetSv);
            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, targetY);
            ctx.lineTo(padding.left + plotWidth, targetY);
            ctx.stroke();
            ctx.restore();

            // Target Line Label Badge
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`Target: ${targetSv}°C`, padding.left + 8, targetY - 6);
        }

        // 3. Draw Step Segments & Vertical Dashed Separators
        segments.forEach((seg, idx) => {
            const startX = getX(seg.startIndex);
            const endX = getX(seg.endIndex);
            const segWidth = endX - startX;

            // Soft Phase Background Tint
            let tint = 'rgba(241, 245, 249, 0.3)';
            if (seg.category === 'HOLD') tint = 'rgba(254, 243, 199, 0.25)'; // Amber/Gold for Holding
            else if (seg.category === 'COOL') tint = 'rgba(224, 242, 254, 0.25)'; // Sky for Cooling
            else if (seg.category === 'CUT') tint = 'rgba(254, 226, 226, 0.2)'; // Rose for CUT

            // Draw In-Canvas Callout Box matching technical diagram
            if (segWidth > 30) {
                const centerX = startX + segWidth / 2;
                let boxY = padding.top + plotHeight * 0.65;
                let boxWidth = Math.min(130, Math.max(90, segWidth - 10));
                let boxHeight = 44;

                if (seg.category === 'HOLD') {
                    boxY = padding.top + plotHeight * 0.45;
                    boxHeight = 52;
                } else if (seg.category === 'COOL') {
                    boxY = padding.top + plotHeight * 0.65;
                    boxHeight = 52;
                } else if (seg.category === 'CUT') {
                    boxY = padding.top + plotHeight * 0.68;
                    boxHeight = 44;
                }

                const boxLeft = Math.max(padding.left + 5, Math.min(padding.left + plotWidth - boxWidth - 5, centerX - boxWidth / 2));

                // Box background with shadow
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1;
                
                // Rounded rect
                const r = 4;
                ctx.beginPath();
                ctx.moveTo(boxLeft + r, boxY);
                ctx.lineTo(boxLeft + boxWidth - r, boxY);
                ctx.quadraticCurveTo(boxLeft + boxWidth, boxY, boxLeft + boxWidth, boxY + r);
                ctx.lineTo(boxLeft + boxWidth, boxY + boxHeight - r);
                ctx.quadraticCurveTo(boxLeft + boxWidth, boxY + boxHeight, boxLeft + boxWidth - r, boxY + boxHeight);
                ctx.lineTo(boxLeft + r, boxY + boxHeight);
                ctx.quadraticCurveTo(boxLeft, boxY + boxHeight, boxLeft, boxY + boxHeight - r);
                ctx.lineTo(boxLeft, boxY + r);
                ctx.quadraticCurveTo(boxLeft, boxY, boxLeft + r, boxY);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Box text
                ctx.fillStyle = '#0f172a';
                ctx.textAlign = 'center';
                ctx.font = 'bold 10px Inter, sans-serif';

                if (seg.category === 'CUT') {
                    ctx.fillText('CUT', boxLeft + boxWidth / 2, boxY + 16);
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = '#475569';
                    ctx.fillText(`${seg.durationMinutes} minutes`, boxLeft + boxWidth / 2, boxY + 30);
                } else if (seg.category === 'HOLD') {
                    ctx.fillText('Holding Time', boxLeft + boxWidth / 2, boxY + 14);
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = '#475569';
                    ctx.fillText(`${seg.durationMinutes} minutes`, boxLeft + boxWidth / 2, boxY + 28);
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = '#b45309';
                    ctx.fillText(`Fo = ${seg.f0Value}`, boxLeft + boxWidth / 2, boxY + 42);
                } else if (seg.category === 'COOL') {
                    ctx.fillText('Cooling Time', boxLeft + boxWidth / 2, boxY + 14);
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = '#475569';
                    ctx.fillText('in retort', boxLeft + boxWidth / 2, boxY + 28);
                    ctx.fillText(`${seg.durationMinutes} minutes`, boxLeft + boxWidth / 2, boxY + 42);
                } else {
                    ctx.fillText(seg.stepName, boxLeft + boxWidth / 2, boxY + 16);
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = '#475569';
                    ctx.fillText(`${seg.durationMinutes} minutes`, boxLeft + boxWidth / 2, boxY + 30);
                }

                ctx.restore();
            }
        });

        // 4. Draw Single Main Temperature Curve (PV)
        if (data.length > 0) {
            // Draw Gradient Area Under Curve
            const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)'); // Blue
            gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

            ctx.beginPath();
            let firstPoint = true;
            for (let i = 0; i < data.length; i++) {
                const temp = toEngineeringValue(data[i].pv, data[i].decimal_point ?? 0);
                if (temp === null || temp >= 3000) continue;

                const x = getX(i);
                const y = getY(temp);

                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }

            if (!firstPoint) {
                const lastX = getX(data.length - 1);
                ctx.lineTo(lastX, padding.top + plotHeight);
                ctx.lineTo(getX(0), padding.top + plotHeight);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            // Draw Sharp Smooth PV Line
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#1e3a8a'; // Deep Navy Blue as in physical reference
            ctx.lineWidth = 2.8;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            firstPoint = true;
            for (let i = 0; i < data.length; i++) {
                const temp = toEngineeringValue(data[i].pv, data[i].decimal_point ?? 0);
                if (temp === null || temp >= 3000) continue;

                const x = getX(i);
                const y = getY(temp);

                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();

            // Draw current point glow dot
            const lastTemp = toEngineeringValue(data[data.length - 1].pv, data[data.length - 1].decimal_point ?? 0);
            if (lastTemp !== null && lastTemp < 3000) {
                const lastX = getX(data.length - 1);
                const lastY = getY(lastTemp);

                ctx.beginPath();
                ctx.arc(lastX, lastY, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#2563eb';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // 5. Draw Axis Titles
        // Y Axis Title
        ctx.save();
        ctx.translate(16, padding.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'black 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Temperature (°C)', 0, 0);
        ctx.restore();

        // X Axis Title
        ctx.fillStyle = '#0f172a';
        ctx.font = 'black 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Heating Time (minutes)', padding.left + plotWidth / 2, h - 16);

        // Border around chart area
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

        // 6. Draw Hover Crosshair
        if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length) {
            const hTemp = toEngineeringValue(data[hoverIndex].pv, data[hoverIndex].decimal_point ?? 0);
            if (hTemp !== null && hTemp < 3000) {
                const hX = getX(hoverIndex);
                const hY = getY(hTemp);

                ctx.save();
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);

                // Vertical crosshair
                ctx.beginPath();
                ctx.moveTo(hX, padding.top);
                ctx.lineTo(hX, padding.top + plotHeight);
                ctx.stroke();

                // Horizontal crosshair
                ctx.beginPath();
                ctx.moveTo(padding.left, hY);
                ctx.lineTo(padding.left + plotWidth, hY);
                ctx.stroke();

                // Dot
                ctx.beginPath();
                ctx.arc(hX, hY, 4, 0, 2 * Math.PI);
                ctx.fillStyle = '#ef4444';
                ctx.fill();
                ctx.restore();
            }
        }

    }, [containerWidth, data, height, hoverIndex, segments, targetSv]);

    // Handle mouse move for interactive tooltip
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || data.length === 0) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 55, right: 30 };
        const plotWidth = containerWidth - padding.left - padding.right;

        const totalPoints = Math.max(120, data.length);
        const relX = x - padding.left;

        if (relX >= 0 && relX <= plotWidth) {
            const idx = Math.round((relX / plotWidth) * (totalPoints - 1));
            if (idx >= 0 && idx < data.length) {
                setHoverIndex(idx);
            } else {
                setHoverIndex(null);
            }
        } else {
            setHoverIndex(null);
        }
    };

    const handleMouseLeave = () => {
        setHoverIndex(null);
    };

    const hoveredItem = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;
    const hoveredTemp = hoveredItem ? toEngineeringValue(hoveredItem.pv, hoveredItem.decimal_point ?? 0) : null;
    const hoveredMinute = hoverIndex !== null ? (Math.round((hoverIndex / 60) * 10) / 10) : 0;

    return (
        <div ref={containerRef} className="relative w-full rounded-2xl border border-slate-300 bg-white p-3 shadow-inner">
            {/* Hover Tooltip Overlay */}
            {hoverIndex !== null && hoveredTemp !== null && (
                <div className="absolute top-4 right-4 bg-slate-950/90 text-white p-3 rounded-xl shadow-xl backdrop-blur-md border border-slate-800 text-xs font-mono z-10 pointer-events-none animate-fadeIn">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Waktu: {hoveredMinute} menit ({hoverIndex}s)
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-cyan-300">
                            PV: {hoveredTemp}°C
                        </span>
                        <span className="text-xs font-bold text-yellow-400">
                            Step {hoveredItem?.step_current ?? 0}
                        </span>
                    </div>
                </div>
            )}

            <canvas
                id="retortThermalChartCanvas"
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ width: '100%', height: `${height}px`, display: 'block', cursor: 'crosshair' }}
            />
        </div>
    );
}
