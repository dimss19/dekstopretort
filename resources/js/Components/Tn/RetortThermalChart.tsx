import React, { useEffect, useRef, useState, useMemo } from 'react';
import { toEngineeringValue, segmentThermalSteps, calculateF0FromLogs, RetortStepSegment } from '@/Pages/Tn/retortTelemetry';

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
        return segmentThermalSteps(data);
    }, [data, isRunning]);

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
        // Canvas Dark Matte Background
        ctx.fillStyle = '#080c14';
        ctx.fillRect(0, 0, width, h);

        const padding = { top: 35, right: 30, bottom: 45, left: 55 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = h - padding.top - padding.bottom;

        // Scale bounds
        const minY = 0;
        const maxY = 140; // 0 to 140 °C
        const totalPoints = Math.max(120, data.length);
        const totalDurationMinutes = Math.max(10, Math.ceil(totalPoints / 60 / 10) * 10);

        const getX = (index: number) => {
            return padding.left + (index / Math.max(1, totalPoints - 1)) * plotWidth;
        };

        const getY = (temp: number) => {
            const clamped = Math.max(minY, Math.min(maxY, temp));
            return padding.top + (1 - (clamped - minY) / (maxY - minY)) * plotHeight;
        };

        // 1. Draw Plot Area Background
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

        // Minor grid lines (every 5 °C)
        ctx.strokeStyle = '#121824';
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
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotWidth, y);
            ctx.stroke();

            // Y Label
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${t}°C`, padding.left - 10, y);
        }

        // X-Axis Major Grid & Labels (minutes)
        const minuteStep = totalDurationMinutes <= 30 ? 5 : totalDurationMinutes <= 90 ? 10 : 20;
        for (let m = 0; m <= totalDurationMinutes; m += minuteStep) {
            const idx = (m * 60);
            const x = padding.left + (idx / totalPoints) * plotWidth;
            if (x <= padding.left + plotWidth + 2) {
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + plotHeight);
                ctx.stroke();

                // X Label
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(`${m}m`, x, padding.top + plotHeight + 8);
            }
        }

        // Outer Plot Border
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

        // 2. Draw Target Line (Safety Yellow) ONLY when targetSv is set
        if (targetSv && targetSv > 0) {
            const targetY = getY(targetSv);
            ctx.save();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, targetY);
            ctx.lineTo(padding.left + plotWidth, targetY);
            ctx.stroke();
            ctx.restore();

            // Target Line Label Badge (Safety Yellow)
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`TARGET SV: ${targetSv}°C`, padding.left + 8, targetY - 6);
        }

        // 3. Draw Step Segments
        segments.forEach((seg) => {
            const startX = getX(seg.startIndex);
            const endX = getX(seg.endIndex);
            const segWidth = endX - startX;

            // Draw vertical dashed separator line
            ctx.save();
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, padding.top);
            ctx.lineTo(startX, padding.top + plotHeight);
            ctx.stroke();
            ctx.restore();

            // Draw In-Canvas Callout Box matching industrial schematic
            if (segWidth > 35) {
                const centerX = startX + segWidth / 2;
                let boxY = padding.top + plotHeight * 0.65;
                let boxWidth = Math.min(130, Math.max(90, segWidth - 10));
                let boxHeight = 44;

                if (seg.category === 'HOLD') {
                    boxY = padding.top + plotHeight * 0.40;
                    boxHeight = 50;
                } else if (seg.category === 'COOL') {
                    boxY = padding.top + plotHeight * 0.62;
                    boxHeight = 48;
                } else if (seg.category === 'CUT') {
                    boxY = padding.top + plotHeight * 0.68;
                    boxHeight = 44;
                }

                const boxLeft = Math.max(padding.left + 5, Math.min(padding.left + plotWidth - boxWidth - 5, centerX - boxWidth / 2));

                // Box background
                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 1;

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
                ctx.fillStyle = '#facc15';
                ctx.textAlign = 'center';
                ctx.font = 'bold 10px monospace';

                if (seg.category === 'CUT') {
                    ctx.fillText('CUT PHASE', boxLeft + boxWidth / 2, boxY + 15);
                    ctx.font = 'bold 9px monospace';
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillText(`${seg.durationMinutes} min`, boxLeft + boxWidth / 2, boxY + 30);
                } else if (seg.category === 'HOLD') {
                    ctx.fillText('HOLDING TIME', boxLeft + boxWidth / 2, boxY + 14);
                    ctx.font = 'bold 9px monospace';
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillText(`${seg.durationMinutes} min`, boxLeft + boxWidth / 2, boxY + 28);
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillText(`F₀ = ${seg.f0Value}`, boxLeft + boxWidth / 2, boxY + 42);
                } else if (seg.category === 'COOL') {
                    ctx.fillText('COOLING TIME', boxLeft + boxWidth / 2, boxY + 14);
                    ctx.font = 'bold 9px monospace';
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillText('IN RETORT', boxLeft + boxWidth / 2, boxY + 28);
                    ctx.fillText(`${seg.durationMinutes} min`, boxLeft + boxWidth / 2, boxY + 42);
                } else {
                    ctx.fillText(seg.stepName, boxLeft + boxWidth / 2, boxY + 15);
                    ctx.font = 'bold 9px monospace';
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillText(`${seg.durationMinutes} min`, boxLeft + boxWidth / 2, boxY + 30);
                }

                ctx.restore();
            }
        });

        // 4. Draw Glowing Industrial Temperature Curve (PV)
        if (data.length > 0) {
            // Area Under Curve with Emerald Gradient
            const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
            gradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

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

            // Draw Crisp Emerald PV Line
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2.5;

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
        }

        // 5. Draw Interactive Hover Crosshair
        if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length) {
            const hTemp = toEngineeringValue(data[hoverIndex].pv, data[hoverIndex].decimal_point ?? 0);
            if (hTemp !== null) {
                const hX = getX(hoverIndex);
                const hY = getY(hTemp);

                ctx.save();
                ctx.strokeStyle = '#facc15';
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

                // Crosshair Target Dot
                ctx.beginPath();
                ctx.arc(hX, hY, 4.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#facc15';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }
        }

    }, [containerWidth, data, height, hoverIndex, segments, targetSv, isRunning]);

    // Handle mouse move
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
        <div ref={containerRef} className="relative w-full rounded-xl border border-slate-800 bg-[#080c14] p-3 shadow-inner">
            {/* Hover Tooltip Overlay */}
            {hoverIndex !== null && hoveredTemp !== null && (
                <div className="absolute top-4 right-4 bg-slate-900/95 text-white p-3 rounded-lg shadow-2xl backdrop-blur-md border border-yellow-400/80 text-xs font-mono z-10 pointer-events-none animate-in fade-in">
                    <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-1">
                        CURSOR: {hoveredMinute}m ({hoverIndex}s)
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-emerald-400">
                            PV: {hoveredTemp}°C
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                            STEP {hoveredItem?.step_current ?? 0}
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
