import React, { useState, useEffect, useMemo } from 'react';
import { router, Link } from '@inertiajs/react';
import axios from 'axios';
import {
    ChevronLeft,
    ChevronDown,
    Download,
    FileText,
    FileSpreadsheet,
    Printer,
    Eye,
    Loader2,
    CheckCircle2,
    Clock,
    AlertCircle,
} from 'lucide-react';
import RetortThermalChart from '@/Components/Tn/RetortThermalChart';
import { calculateF0 } from '@/Pages/Tn/retortTelemetry';
import { compareF0 } from './historyHelpers';

export interface ProcessBatchItem {
    id: number;
    tn_controller_id?: number;
    start_time: string;
    end_time?: string | null;
    log_data?: any[];
    verification_status?: string;
    product?: string | null;
    batch_code?: string | null;
    scheduled_process?: string | null;
    min_f0_achieved?: number | null;
    target_f0?: number | null;
    process_deviation?: string | null;
    sterility_criterion?: string | null;
    thermal_record?: string | null;
    group_id?: number | null;
    verified_by?: string | null;
    verified_at?: string | null;
    controller?: {
        id?: number;
        model_type?: string;
        machine?: {
            machine_name?: string;
        };
    };
}

interface Props {
    batch: ProcessBatchItem;
    onBack: () => void;
    groups?: { id: number; name: string; color: string }[];
}

export default function ProcessDetailView({ batch, onBack, groups = [] }: Props) {
    const [tablePage, setTablePage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(50);
    const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);

    useEffect(() => {
        const closeMenu = () => setShowDownloadMenu(false);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const logs = useMemo(() => {
        return [...(batch.log_data || [])].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
    }, [batch.log_data]);

    const startTime = new Date(batch.start_time);
    const endTime = batch.end_time ? new Date(batch.end_time) : null;
    const durationMinutes = endTime
        ? Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
        : null;

    const timeRangeStr = `${startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${
        endTime ? endTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Sedang Berjalan'
    }`;

    const rawMachineTitle =
        batch.controller?.machine?.machine_name ||
        (batch.controller as any)?.name ||
        batch.controller?.model_type ||
        `Controller #${batch.tn_controller_id || batch.id}`;
    const machineTitle = rawMachineTitle.replace(/Retort TNS/gi, 'TN').replace(/TNS Controller/gi, 'TN').replace(/^TNS$/i, 'TN');

    // Target SV detection from logs
    const targetSv = useMemo(() => {
        if (!logs.length) return 121.0;
        const last = logs[logs.length - 1];
        const val = Number(last.sv ?? last.setting ?? 121.0);
        return val > 40 ? val : 121.0;
    }, [logs]);

    // Pagination for logs table
    const totalRows = logs.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const paginatedLogs = useMemo(() => {
        const start = (tablePage - 1) * pageSize;
        return logs.slice(start, start + pageSize);
    }, [logs, tablePage, pageSize]);

    // Helper to generate a high-resolution, crystal-clear thermal chart image for PDF export
    const generateThermalChartDataUrl = (): string => {
        // Check if on-screen canvas is available and ready
        const screenCanvas = document.getElementById('retortThermalChartCanvas') as HTMLCanvasElement | null;
        if (screenCanvas && screenCanvas.width > 0 && screenCanvas.height > 0) {
            try {
                return screenCanvas.toDataURL('image/png');
            } catch (e) {
                console.warn('Cannot export screen canvas, using generator', e);
            }
        }

        const canvas = document.createElement('canvas');
        const width = 1200;
        const height = 440;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Solid clean white background (prevents dark artifacts on PDF print)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const padding = { top: 45, right: 65, bottom: 55, left: 65 };
        const plotW = width - padding.left - padding.right;
        const plotH = height - padding.top - padding.bottom;

        // Y scale: 0 to 140 °C (industrial autoclave range)
        const minY = 0;
        const maxY = 140;

        const getY = (temp: number) => {
            const clamped = Math.max(minY, Math.min(maxY, temp));
            return padding.top + (1 - (clamped - minY) / (maxY - minY)) * plotH;
        };

        const count = Math.max(logs.length, 2);
        const getX = (idx: number) => {
            return padding.left + (idx / (count - 1)) * plotW;
        };

        // 1. Draw Grid Lines & Y-axis labels
        ctx.lineWidth = 1;
        for (let t = minY; t <= maxY; t += 20) {
            const y = getY(t);
            ctx.strokeStyle = t === 120 ? '#cbd5e1' : '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotW, y);
            ctx.stroke();

            // Left Y label (Temperature in °C)
            ctx.fillStyle = '#1e3a5f';
            ctx.font = 'bold 12px "Segoe UI", sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${t}°C`, padding.left - 10, y);

            // Right Y label (Heating Output in %)
            const mvVal = Math.round((t / maxY) * 100);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${mvVal}%`, padding.left + plotW + 10, y);
        }

        // Minor grid lines (every 10 °C)
        ctx.strokeStyle = '#f8fafc';
        for (let t = minY + 10; t < maxY; t += 20) {
            const y = getY(t);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotW, y);
            ctx.stroke();
        }

        // 2. Parse temperatures
        const pvPoints: number[] = [];
        const mvPoints: number[] = [];
        let maxPv = 0;
        let maxPvIdx = 0;

        logs.forEach((l, i) => {
            const rawPv = Number(l.pv ?? l.actual ?? 0);
            const dp = Number(l.decimal_point ?? 0);
            let pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;
            if (pv > 300) pv = pv / 10.0;
            pvPoints.push(pv);
            if (pv > maxPv) {
                maxPv = pv;
                maxPvIdx = i;
            }

            const mv = Number(l.heating_mv ?? l.mv ?? 0);
            mvPoints.push(Math.max(0, Math.min(100, mv)));
        });

        // 3. Draw Target SV Line (Dashed Amber)
        const svY = getY(targetSv);
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, svY);
        ctx.lineTo(padding.left + plotW, svY);
        ctx.stroke();
        ctx.restore();

        // SV Label Tag
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(padding.left + plotW - 95, svY - 12, 90, 22, 4);
        } else {
            ctx.rect(padding.left + plotW - 95, svY - 12, 90, 22);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`SV: ${targetSv.toFixed(1)}°C`, padding.left + plotW - 50, svY);

        // 4. Draw MV Area / Line
        if (mvPoints.some(v => v > 0)) {
            ctx.save();
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            mvPoints.forEach((mv, i) => {
                const x = getX(i);
                const y = padding.top + (1 - mv / 100) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        }

        // 5. Draw Actual PV Area & Line
        if (pvPoints.length > 0) {
            const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
            grad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
            grad.addColorStop(0.8, 'rgba(37, 99, 235, 0.04)');
            grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(getX(0), padding.top + plotH);
            pvPoints.forEach((pv, i) => {
                ctx.lineTo(getX(i), getY(pv));
            });
            ctx.lineTo(getX(pvPoints.length - 1), padding.top + plotH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            pvPoints.forEach((pv, i) => {
                const x = getX(i);
                const y = getY(pv);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();

            if (maxPv > 0) {
                const peakX = getX(maxPvIdx);
                const peakY = getY(maxPv);

                ctx.beginPath();
                ctx.arc(peakX, peakY, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#dc2626';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                if (typeof (ctx as any).roundRect === 'function') {
                    (ctx as any).roundRect(peakX - 45, peakY - 26, 90, 20, 4);
                } else {
                    ctx.rect(peakX - 45, peakY - 26, 90, 20);
                }
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`Peak: ${maxPv.toFixed(1)}°C`, peakX, peakY - 16);
            }
        }

        // 6. X-Axis Time Labels
        const stepInterval = Math.max(1, Math.floor(count / 6));
        ctx.fillStyle = '#64748b';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i < count; i += stepInterval) {
            const x = getX(i);
            const l = logs[i];
            const timeLabel = l?.created_at ? new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `+${i}s`;
            ctx.fillText(timeLabel, x, padding.top + plotH + 8);
        }
        if (count > 1) {
            const lastL = logs[count - 1];
            const lastTime = lastL?.created_at ? new Date(lastL.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `End`;
            ctx.fillText(lastTime, padding.left + plotW, padding.top + plotH + 8);
        }

        // 7. Outer Border
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(padding.left, padding.top, plotW, plotH);

        // 8. Legend Header
        ctx.fillStyle = '#1e3a5f';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('PROFIL TERMAL STERILISASI', padding.left, 22);

        let legendX = padding.left + 220;
        // PV Legend
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(legendX, 17, 14, 10);
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillText('Actual PV (°C)', legendX + 18, 22);

        // SV Legend
        legendX += 130;
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.setLineDash([5, 3]);
        ctx.moveTo(legendX, 22);
        ctx.lineTo(legendX + 16, 22);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#334155';
        ctx.fillText('Target SV (°C)', legendX + 22, 22);

        // MV Legend
        legendX += 130;
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, 22);
        ctx.lineTo(legendX + 16, 22);
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.fillText('Heating MV (%)', legendX + 22, 22);

        return canvas.toDataURL('image/png');
    };

    // Calculate statistical metrics
    const statsData = useMemo(() => {
        let maxPv = 0;
        let minPv = 9999;
        let sumPv = 0;
        let validPvCount = 0;

        logs.forEach((l) => {
            const rawPv = Number(l.pv ?? l.actual ?? 0);
            const dp = Number(l.decimal_point ?? 0);
            let pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;
            if (pv > 300) pv = pv / 10.0;
            if (pv > 0) {
                if (pv > maxPv) maxPv = pv;
                if (pv < minPv) minPv = pv;
                sumPv += pv;
                validPvCount++;
            }
        });

        if (minPv === 9999) minPv = 0;
        const avgPv = validPvCount > 0 ? sumPv / validPvCount : 0;
        return { maxPv, minPv, avgPv };
    }, [logs]);

    // F0 sistem otomatis dari logs (mapping pv/dp sama seperti statsData)
    const systemF0 = useMemo(() => {
        const temps = logs
            .map((l) => {
                const rawPv = Number(l.pv ?? l.actual ?? 0);
                const dp = Number(l.decimal_point ?? 0);
                let pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;
                if (pv > 300) pv = pv / 10.0;
                return pv;
            })
            .filter((pv) => pv > 0);
        return calculateF0(temps, 1);
    }, [logs]);

    const isVerified = batch.verification_status === 'verified';
    const isUnverified = Boolean(batch.end_time) && !isVerified;

    // Form verifikasi inline
    const [product, setProduct] = useState<string>(batch.product ?? '');
    const [batchCode, setBatchCode] = useState<string>(batch.batch_code ?? '');
    const [scheduledProcess, setScheduledProcess] = useState<string>(batch.scheduled_process ?? '');
    const [minF0, setMinF0] = useState<string>(
        batch.min_f0_achieved !== null && batch.min_f0_achieved !== undefined ? String(batch.min_f0_achieved) : ''
    );
    const [targetF0, setTargetF0] = useState<string>(
        batch.target_f0 !== null && batch.target_f0 !== undefined ? String(batch.target_f0) : ''
    );
    const [deviation, setDeviation] = useState<string>(batch.process_deviation ?? 'None');
    const [criterion, setCriterion] = useState<string>(batch.sterility_criterion ?? 'PASS');
    const [groupId, setGroupId] = useState<string>(
        batch.group_id !== null && batch.group_id !== undefined ? String(batch.group_id) : groups.length > 0 ? String(groups[0].id) : ''
    );
    const [errors, setErrors] = useState<{
        product?: string;
        batchCode?: string;
        scheduledProcess?: string;
        minF0?: string;
        targetF0?: string;
    }>({});

    const liveResult = targetF0.trim() === '' ? null : compareF0(systemF0, Number(targetF0));
    const liveFail = isUnverified && liveResult === 'FAIL';
    const effectiveCriterion = liveFail ? 'FAIL' : criterion;

    // ponytail: derived sekali untuk 2 export (PDF/Excel)
    const groupName = groups.find((g) => g.id === batch.group_id)?.name ?? (batch.group_id ? `#${batch.group_id}` : '-');
    const verifyStatusLabel = isVerified ? 'VERIFIED' : !batch.end_time ? 'Sedang Berjalan' : 'UNVERIFIED';
    const exportF0Result = compareF0(systemF0, batch.target_f0 ?? (targetF0.trim() === '' ? null : Number(targetF0))) ?? '-';
    const verifiedByTxt = batch.verified_by ?? 'Belum diverifikasi';
    const verifiedAtTxt = batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : 'Belum diverifikasi';

    const handleVerifySubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: {
            product?: string;
            batchCode?: string;
            scheduledProcess?: string;
            minF0?: string;
            targetF0?: string;
        } = {};

        if (!product.trim()) {
            newErrors.product = 'Product belum diisi';
        }
        if (!batchCode.trim()) {
            newErrors.batchCode = 'Batch belum diisi';
        }
        if (!scheduledProcess.trim()) {
            newErrors.scheduledProcess = 'Scheduled Process belum diisi';
        }
        if (minF0.trim() === '') {
            newErrors.minF0 = 'Minimum F0 belum diisi';
        }
        if (targetF0.trim() === '') {
            newErrors.targetF0 = 'Target F0 belum diisi';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            if (newErrors.product) {
                document.getElementById('verify-product-input')?.focus();
            } else if (newErrors.batchCode) {
                document.getElementById('verify-batch-input')?.focus();
            } else if (newErrors.scheduledProcess) {
                document.getElementById('verify-process-input')?.focus();
            } else if (newErrors.minF0) {
                document.getElementById('verify-minf0-input')?.focus();
            } else if (newErrors.targetF0) {
                document.getElementById('verify-targetf0-input')?.focus();
            }
            return;
        }

        setErrors({});

        router.post(route('tn.history.verify', batch.id), {
            product,
            batch_code: batchCode,
            scheduled_process: scheduledProcess,
            min_f0_achieved: minF0 === '' ? null : Number(minF0),
            target_f0: targetF0 === '' ? null : Number(targetF0),
            process_deviation: deviation,
            sterility_criterion: effectiveCriterion,
            thermal_record: 'VERIFIED',
            group_id: groupId ? Number(groupId) : null,
        }, {
            onError: (err) => {
                const mapped: Record<string, string> = {};
                if (err.product) mapped.product = err.product;
                if (err.batch_code) mapped.batchCode = err.batch_code;
                if (err.scheduled_process) mapped.scheduledProcess = err.scheduled_process;
                if (err.min_f0_achieved) mapped.minF0 = err.min_f0_achieved;
                if (err.target_f0) mapped.targetF0 = err.target_f0;
                setErrors(mapped);
            }
        });
    };

    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isPrintingNative, setIsPrintingNative] = useState(false);

    // Helper: generate full HTML string for report
    const generateReportHtml = (isForPreview: boolean = false) => {
        const chartDataUrl = generateThermalChartDataUrl();

        const rows = logs.map((l, idx) => {
            const rawPv = Number(l.pv ?? l.actual ?? 0);
            const dp = Number(l.decimal_point ?? 0);
            let pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;
            if (pv > 300) pv = pv / 10.0;

            const rawSv = Number(l.sv ?? l.setting ?? 121.0);
            let sv = dp > 0 ? rawSv / Math.pow(10, dp) : rawSv;
            if (sv > 300) sv = sv / 10.0;

            const mv = Number(l.heating_mv ?? l.mv ?? 0);
            const phase = l.phase_name || l.phase || (pv >= (sv - 2) ? 'Sterilisasi (Holding)' : (pv > 40 ? 'Heating (Pemanasan)' : 'Idle / Cooling'));
            const timeStr = l.created_at ? new Date(l.created_at).toLocaleTimeString('id-ID') : `--:${idx}`;

            return {
                no: idx + 1,
                time: timeStr,
                pv: pv.toFixed(1),
                sv: sv.toFixed(1),
                mv: `${mv.toFixed(0)}%`,
                phase,
            };
        });

        const previewBarHtml = isForPreview ? `
            <div class="no-print">
                <div>
                    <strong>Laporan Sterilisasi Batch #${batch.id}</strong> — Siap untuk dicetak atau disimpan sebagai PDF.
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="btnSavePdf" class="btn-print" style="background: #2563eb;">Simpan File PDF</button>
                    <button id="btnPrintNative" class="btn-print" style="background: #1e3a5f;">Cetak ke Printer</button>
                    <button onclick="window.close()" class="btn-close">Tutup</button>
                </div>
            </div>
        ` : '';

        const previewScriptHtml = isForPreview ? `
            <script>
                document.getElementById('btnSavePdf')?.addEventListener('click', function() {
                    if (window.opener && window.opener.saveReportPdf) {
                        window.opener.saveReportPdf();
                    } else {
                        fetch('/historian/${batch.id}/export-pdf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ html: document.documentElement.outerHTML })
                        })
                        .then(function(res) { return res.blob(); })
                        .then(function(blob) {
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = 'Laporan_Batch_${batch.id}.pdf';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        })
                        .catch(function(err) {
                            alert('Gagal mendownload PDF: ' + err.message);
                        });
                    }
                });

                document.getElementById('btnPrintNative')?.addEventListener('click', function() {
                    if (window.opener && window.opener.printReportNative) {
                        window.opener.printReportNative();
                    } else {
                        fetch('/historian/${batch.id}/print-native', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ html: document.documentElement.outerHTML })
                        })
                        .then(function(res) { return res.json(); })
                        .then(function(data) {
                            if (!data.success) {
                                window.print();
                            }
                        })
                        .catch(function() {
                            window.print();
                        });
                    }
                });
            </script>
        ` : '';

        return `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="utf-8">
                <title>Laporan Batch #${batch.id} - ${machineTitle}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #1e293b;
                        background: #ffffff;
                        margin: 0;
                        padding: 16px;
                        font-size: 11px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        background: #f8fafc;
                        border: 1px solid #cbd5e1;
                        padding: 12px 16px;
                        margin-bottom: 20px;
                        border-radius: 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .btn-print {
                        background: #1e3a5f;
                        color: #ffffff;
                        border: none;
                        padding: 8px 18px;
                        font-weight: bold;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        transition: opacity 0.2s;
                    }
                    .btn-print:hover { opacity: 0.9; }
                    .btn-close {
                        background: #ffffff;
                        color: #475569;
                        border: 1px solid #cbd5e1;
                        padding: 8px 14px;
                        font-weight: bold;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .header {
                        border-bottom: 2px solid #1e3a5f;
                        padding-bottom: 8px;
                        margin-bottom: 14px;
                    }
                    .header h1 {
                        margin: 0 0 4px 0;
                        color: #1e3a5f;
                        font-size: 20px;
                        font-weight: 800;
                    }
                    .meta-bar {
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        color: #475569;
                        font-weight: 600;
                    }
                    /* Summary KPI Table */
                    .summary-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 16px;
                        font-size: 11px;
                    }
                    .summary-table td {
                        border: 1px solid #cbd5e1;
                        padding: 6px 10px;
                    }
                    .summary-table .lbl {
                        background: #f1f5f9;
                        color: #1e3a5f;
                        font-weight: bold;
                        width: 22%;
                    }
                    .summary-table .val {
                        color: #0f172a;
                    }
                    .summary-table .num {
                        text-align: right;
                        font-family: monospace;
                        font-weight: bold;
                    }
                    .badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 10px;
                    }
                    .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
                    
                    /* Chart Section */
                    .chart-box {
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        padding: 10px;
                        margin-bottom: 18px;
                        background: #ffffff;
                        page-break-inside: avoid;
                    }
                    .chart-box h3 {
                        margin: 0 0 8px 0;
                        color: #1e3a5f;
                        font-size: 13px;
                        font-weight: bold;
                    }
                    .chart-box img {
                        width: 100%;
                        height: auto;
                        display: block;
                        border-radius: 4px;
                    }

                    /* Log Table */
                    .table-title {
                        color: #1e3a5f;
                        font-size: 13px;
                        font-weight: bold;
                        margin: 0 0 8px 0;
                    }
                    table.data-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                    }
                    table.data-table th, table.data-table td {
                        border: 1px solid #cbd5e1;
                        padding: 5px 8px;
                    }
                    table.data-table thead th {
                        background: #1e3a5f;
                        color: #ffffff;
                        font-weight: bold;
                        text-align: left;
                    }
                    table.data-table tr:nth-child(even) {
                        background: #f8fafc;
                    }
                    table.data-table .num {
                        text-align: right;
                        font-family: monospace;
                    }
                    .pv-cell { font-weight: bold; color: #1d4ed8; }
                    .sv-cell { font-weight: bold; color: #b45309; }
                    .mv-cell { font-weight: bold; color: #ea580c; }
                    
                    @media print {
                        .no-print { display: none !important; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${previewBarHtml}

                <div class="header">
                    <h1>Laporan Proses Sterilisasi Batch #${batch.id}</h1>
                    <div class="meta-bar">
                        <span><strong>Mesin / Controller:</strong> ${machineTitle}</span>
                        <span><strong>Waktu Cetak:</strong> ${new Date().toLocaleString('id-ID')}</span>
                    </div>
                </div>

                <!-- Summary KPI Table -->
                <table class="summary-table">
                    <tr>
                        <td class="lbl">Waktu Mulai</td>
                        <td class="val">${startTime.toLocaleString('id-ID')}</td>
                        <td class="lbl">Target Suhu (SV)</td>
                        <td class="num val-sv">${targetSv.toFixed(1)} °C</td>
                    </tr>
                    <tr>
                        <td class="lbl">Waktu Selesai</td>
                        <td class="val">${endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}</td>
                        <td class="lbl">Suhu Maksimum (Max PV)</td>
                        <td class="num">${statsData.maxPv.toFixed(1)} °C</td>
                    </tr>
                    <tr>
                        <td class="lbl">Total Durasi</td>
                        <td class="val"><b>${durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</b></td>
                        <td class="lbl">Suhu Rata-rata (PV)</td>
                        <td class="num">${statsData.avgPv.toFixed(1)} °C</td>
                    </tr>
                    <tr>
                        <td class="lbl">Status Batch</td>
                        <td class="val">
                            <span class="badge ${batch.end_time ? 'badge-success' : 'badge-warning'}">
                                ${batch.end_time ? 'SELESAI' : 'SEDANG BERJALAN'}
                            </span>
                        </td>
                        <td class="lbl">Total Data Points</td>
                        <td class="num">${logs.length.toLocaleString('id-ID')} Titik</td>
                    </tr>
                    <tr>
                        <td class="lbl">Status Verifikasi</td>
                        <td class="val">
                            <span class="badge ${isVerified ? 'badge-success' : 'badge-warning'}">
                                ${verifyStatusLabel}
                            </span>
                        </td>
                        <td class="lbl">Product</td>
                        <td class="val">${batch.product ?? '-'}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Batch</td>
                        <td class="val">${batch.batch_code ?? '-'}</td>
                        <td class="lbl">Group</td>
                        <td class="val">${groupName}</td>
                    </tr>
                    <tr>
                        <td class="lbl">F0 Sistem</td>
                        <td class="num">${systemF0.toFixed(2)} min</td>
                        <td class="lbl">Hasil F0</td>
                        <td class="num">${exportF0Result}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Diverifikasi Oleh</td>
                        <td class="val">${verifiedByTxt}</td>
                        <td class="lbl">Diverifikasi Tanggal</td>
                        <td class="val">${verifiedAtTxt}</td>
                    </tr>
                </table>

                <!-- Embedded Chart Curve -->
                <div class="chart-box">
                    <h3>Grafik Profil Termal Sterilisasi Retort (PV vs SV vs MV)</h3>
                    <img id="chartImg" src="${chartDataUrl}" alt="Grafik Profil Termal" />
                </div>

                <!-- Detailed Data Log Table -->
                <h3 class="table-title">Rincian Riwayat Data Log Sterilisasi</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">No</th>
                            <th>Waktu</th>
                            <th class="num">Actual PV (°C)</th>
                            <th class="num">Setting SV (°C)</th>
                            <th class="num">Heating MV (%)</th>
                            <th>Fase / Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                            .map(
                                (r) => `
                            <tr>
                                <td style="text-align: center; color: #64748b;">${r.no}</td>
                                <td>${r.time}</td>
                                <td class="num pv-cell">${r.pv}</td>
                                <td class="num sv-cell">${r.sv}</td>
                                <td class="num mv-cell">${r.mv}</td>
                                <td>${r.phase}</td>
                            </tr>
                        `
                            )
                            .join('')}
                    </tbody>
                </table>

                ${previewScriptHtml}
            </body>
            </html>
        `;
    };

    // Export Handlers
    const handleDownloadPDF = async () => {
        if (isExportingPdf) return;
        setIsExportingPdf(true);
        try {
            const reportHtml = generateReportHtml(false);
            const response = await axios.post(`/historian/${batch.id}/export-pdf`, {
                html: reportHtml,
            }, {
                responseType: 'blob',
                timeout: 60000,
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Laporan_Batch_${batch.id}_${machineTitle.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('Download PDF error:', err);
            alert('Gagal mendownload PDF secara otomatis: ' + (err.response?.data?.message || err.message || 'Layanan tidak merespons'));
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handlePrintReport = async () => {
        if (isPrintingNative) return;
        setIsPrintingNative(true);
        try {
            const reportHtml = generateReportHtml(false);
            const res = await axios.post(`/historian/${batch.id}/print-native`, {
                html: reportHtml,
            }, {
                timeout: 30000,
            });
            if (res.data?.success) {
                return;
            }
            handleOpenPreview();
        } catch (err) {
            console.warn('Native print error, falling back to preview window', err);
            handleOpenPreview();
        } finally {
            setIsPrintingNative(false);
        }
    };

    const handleOpenPreview = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const reportHtml = generateReportHtml(true);
        printWindow.document.write(reportHtml);
        printWindow.document.close();
    };

    useEffect(() => {
        (window as any).saveReportPdf = handleDownloadPDF;
        (window as any).printReportNative = handlePrintReport;
        return () => {
            delete (window as any).saveReportPdf;
            delete (window as any).printReportNative;
        };
    }, [batch.id, logs, machineTitle]);

    // Excel (.xls) Export matching surface-mine-production
    const handleDownloadExcel = () => {
        if (!logs.length) return;

        const chartDataUrl = generateThermalChartDataUrl();

        const rows = logs.map((l, idx) => {
            const rawPv = Number(l.pv ?? l.actual ?? 0);
            const dp = Number(l.decimal_point ?? 0);
            let pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;
            if (pv > 300) pv = pv / 10.0;

            const rawSv = Number(l.sv ?? l.setting ?? 121.0);
            let sv = dp > 0 ? rawSv / Math.pow(10, dp) : rawSv;
            if (sv > 300) sv = sv / 10.0;

            const mv = Number(l.heating_mv ?? l.mv ?? 0);
            const phase = l.phase_name || l.phase || (pv >= (sv - 2) ? 'Sterilisasi (Holding)' : (pv > 40 ? 'Heating' : 'Cooling'));
            const timeStr = l.created_at ? new Date(l.created_at).toLocaleTimeString('id-ID') : `--:${idx}`;

            return `<tr>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; mso-number-format:'0';">${idx + 1}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; mso-number-format:'\\@';">${timeStr}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; color: #1d4ed8; font-weight: bold; mso-number-format:'0\\.0';">${pv.toFixed(1)}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; color: #b45309; font-weight: bold; mso-number-format:'0\\.0';">${sv.toFixed(1)}</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right; color: #ea580c; mso-number-format:'0%';">${mv.toFixed(0)}%</td>
                <td style="padding: 5px; border: 1px solid #cbd5e1; mso-number-format:'\\@';">${phase}</td>
            </tr>`;
        }).join('');

        const excelTemplate = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
                    .h { background: #1e3a5f; color: #ffffff; font-weight: bold; }
                    .lbl { background: #f1f5f9; color: #1e3a5f; font-weight: bold; }
                    .num { text-align: right; }
                </style>
            </head>
            <body>
                <h2 style="color: #1e3a5f; margin-bottom: 4px;">Laporan Proses Sterilisasi Batch #${batch.id}</h2>
                <p style="color: #475569; margin-top: 0;">Mesin / Controller: ${machineTitle} | Waktu Ekspor: ${new Date().toLocaleString('id-ID')}</p>

                <!-- KPI Summary Table -->
                <table border="1">
                    <tr>
                        <td class="lbl">Waktu Mulai</td><td>${startTime.toLocaleString('id-ID')}</td>
                        <td class="lbl">Target Suhu (SV)</td><td class="num" style="font-weight: bold; color: #b45309; mso-number-format:'0\\.0';">${targetSv.toFixed(1)} °C</td>
                    </tr>
                    <tr>
                        <td class="lbl">Waktu Selesai</td><td>${endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}</td>
                        <td class="lbl">Suhu Maksimum (Max PV)</td><td class="num" style="font-weight: bold; color: #dc2626; mso-number-format:'0\\.0';">${statsData.maxPv.toFixed(1)} °C</td>
                    </tr>
                    <tr>
                        <td class="lbl">Total Durasi</td><td>${durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</td>
                        <td class="lbl">Suhu Rata-rata (PV)</td><td class="num" style="font-weight: bold; color: #1d4ed8; mso-number-format:'0\\.0';">${statsData.avgPv.toFixed(1)} °C</td>
                    </tr>
                    <tr>
                        <td class="lbl">Status Batch</td><td>${batch.end_time ? 'SELESAI' : 'SEDANG BERJALAN'}</td>
                        <td class="lbl">Total Data Points</td><td class="num" style="mso-number-format:'0';">${logs.length} Titik</td>
                    </tr>
                    <tr>
                        <td class="lbl">Status Verifikasi</td><td>${verifyStatusLabel}</td>
                        <td class="lbl">Product</td><td>${batch.product ?? '-'}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Batch</td><td>${batch.batch_code ?? '-'}</td>
                        <td class="lbl">Group</td><td>${groupName}</td>
                    </tr>
                    <tr>
                        <td class="lbl">F0 Sistem</td><td class="num" style="mso-number-format:'0\\.00';">${systemF0.toFixed(2)} min</td>
                        <td class="lbl">Hasil F0</td><td class="num">${exportF0Result}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Diverifikasi Oleh</td><td>${verifiedByTxt}</td>
                        <td class="lbl">Diverifikasi Tanggal</td><td>${verifiedAtTxt}</td>
                    </tr>
                </table>

                <!-- Embedded Thermal Chart Image in Excel -->
                <br/>
                <table border="1" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr class="h">
                            <th colspan="6" style="text-align: left; padding: 8px 12px; font-size: 13px;">
                                Grafik Profil Termal Sterilisasi Retort (PV vs SV vs MV)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 15px; background: #ffffff;">
                                <img src="${chartDataUrl}" width="850" height="310" alt="Grafik Profil Termal Sterilisasi Retort" />
                            </td>
                        </tr>
                    </tbody>
                </table>

                <br/>
                <h3 style="color: #1e3a5f; margin-bottom: 6px;">Tabel Riwayat Data Log Sterilisasi (Per Detik)</h3>
                <table border="1">
                    <thead>
                        <tr class="h">
                            <th style="width: 40px;">No</th>
                            <th>Waktu</th>
                            <th class="num">Actual PV (°C)</th>
                            <th class="num">Setting SV (°C)</th>
                            <th class="num">Heating MV (%)</th>
                            <th>Fase / Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Laporan_Batch_${batch.id}_${machineTitle.replace(/\s+/g, '_')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };


    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <Link
                    href={route('historian.index')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <ChevronLeft size={16} />
                    <span>Kembali ke History</span>
                </Link>

                {/* Download Dropdown */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDownloadMenu((prev) => !prev);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2.5 shadow-md transition-all"
                    >
                        <Download size={14} />
                        <span>Download Laporan</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showDownloadMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showDownloadMenu && (
                        <div
                            className="absolute right-0 mt-2 w-52 rounded-2xl bg-white p-1.5 shadow-2xl border border-slate-200 z-50 animate-in fade-in"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                disabled={isExportingPdf}
                                onClick={() => {
                                    handleDownloadPDF();
                                    setShowDownloadMenu(false);
                                }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left disabled:opacity-50"
                            >
                                {isExportingPdf ? (
                                    <Loader2 size={15} className="animate-spin text-blue-600" />
                                ) : (
                                    <FileText size={15} className="text-blue-600" />
                                )}
                                <div>
                                    <div className="font-extrabold text-slate-900">
                                        {isExportingPdf ? 'Membuat PDF...' : 'Download PDF (.pdf)'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium">Simpan dokumen langsung ke komputer</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                disabled={isPrintingNative}
                                onClick={() => {
                                    handlePrintReport();
                                    setShowDownloadMenu(false);
                                }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left disabled:opacity-50"
                            >
                                {isPrintingNative ? (
                                    <Loader2 size={15} className="animate-spin text-indigo-600" />
                                ) : (
                                    <Printer size={15} className="text-indigo-600" />
                                )}
                                <div>
                                    <div className="font-extrabold text-slate-900">Cetak ke Printer</div>
                                    <div className="text-[10px] text-slate-500 font-medium">Buka dialog printer Windows</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleDownloadExcel();
                                    setShowDownloadMenu(false);
                                }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left"
                            >
                                <FileSpreadsheet size={15} className="text-emerald-600" />
                                <div>
                                    <div className="font-extrabold text-slate-900">Download Excel (.xls)</div>
                                    <div className="text-[10px] text-slate-500 font-medium">Tabel Berformat & Ringkasan KPI</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleOpenPreview();
                                    setShowDownloadMenu(false);
                                }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-left border-t border-slate-100 mt-1 pt-2"
                            >
                                <Eye size={15} className="text-amber-600" />
                                <div>
                                    <div className="font-extrabold text-slate-900">Pratinjau Dokumen</div>
                                    <div className="text-[10px] text-slate-500 font-medium">Lihat tampilan laporan di jendela terpisah</div>
                                </div>
                            </button>

                        </div>
                    )}
                </div>
            </div>

            {/* Batch Info Header Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-lg backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">
                                Proses #{batch.id} ({machineTitle})
                            </h2>
                            {isUnverified ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-300 px-2.5 py-0.5 text-xs font-black text-rose-700 shadow-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                                        </span>
                                        UNVERIFIED (Belum Ditulis / Diverifikasi)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                                        <CheckCircle2 size={12} /> Selesai & VERIFIED
                                    </span>
                                )}
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mt-1">
                            {timeRangeStr} • {durationMinutes !== null ? `${durationMinutes} Menit` : '--'} • {logs.length} Data Points
                        </p>
                        <p className="text-xs font-bold text-slate-700 mt-1.5">
                            F0 sistem (otomatis): {systemF0.toFixed(2)} min
                            {isUnverified && liveResult && (
                                <span
                                    className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-black ${
                                        liveResult === 'VALID'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-rose-50 border-rose-200 text-rose-700'
                                    }`}
                                >
                                    {liveResult}
                                </span>
                            )}
                            {isVerified && (
                                <span
                                    className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-black ${
                                        batch.sterility_criterion === 'PASS'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-rose-50 border-rose-200 text-rose-700'
                                    }`}
                                >
                                    {batch.sterility_criterion} • F0 {Number(batch.target_f0 ?? batch.min_f0_achieved ?? systemF0).toFixed(2)} min
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Verifikasi Inline */}
            {isVerified ? (
                <section className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-6 sm:p-7 shadow-lg backdrop-blur-xl">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                        <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">Verifikasi Batch</h2>
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 size={12} /> VERIFIED
                        </span>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Product</dt><dd className="font-extrabold text-slate-900 text-right">{batch.product ?? '-'}</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Batch</dt><dd className="font-extrabold text-slate-900 text-right">{batch.batch_code ?? '-'}</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Scheduled Process</dt><dd className="font-extrabold text-slate-900 text-right">{batch.scheduled_process ?? '-'}</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Minimum F0</dt><dd className="font-extrabold text-slate-900 text-right">{batch.min_f0_achieved ?? '-'} min</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Target F0</dt><dd className="font-extrabold text-slate-900 text-right">{batch.target_f0 ?? '-'} min</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Process deviation</dt><dd className="font-extrabold text-slate-900 text-right">{batch.process_deviation ?? '-'}</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Sterility criterion</dt><dd className="font-extrabold text-slate-900 text-right">{batch.sterility_criterion ?? '-'}</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Group</dt><dd className="font-extrabold text-slate-900 text-right">{groups.find((g) => g.id === batch.group_id)?.name ?? (batch.group_id ? `#${batch.group_id}` : '-')}</dd></div>
                        <div className="flex justify-between gap-4 border-b border-emerald-100/70 pb-1.5"><dt className="font-bold text-slate-500">Verified by</dt><dd className="font-extrabold text-slate-900 text-right">{batch.verified_by ?? '-'}</dd></div>
                        <div className="flex justify-between gap-4 pb-1.5"><dt className="font-bold text-slate-500">Verified at</dt><dd className="font-extrabold text-slate-900 text-right">{batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : '-'}</dd></div>
                    </dl>
                </section>
            ) : isUnverified ? (
                <section className="relative rounded-3xl border-2 border-rose-300 bg-rose-50/20 p-6 sm:p-7 shadow-lg backdrop-blur-xl ring-1 ring-rose-200">
                    <div className="mb-4 border-b border-rose-200/80 pb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                                </span>
                                <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">Tulis & Verifikasi Batch (UNVERIFIED)</h2>
                            </div>
                            <p className="text-xs text-rose-700 mt-1 font-semibold">
                                ⚠️ Batch ini belum diverifikasi. F0 sistem: {systemF0.toFixed(2)} min — Lengkapi data di bawah ini lalu klik Simpan Verifikasi.
                            </p>
                        </div>
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wide">
                            Wajib Dilengkapi
                        </span>
                    </div>
                    <form onSubmit={handleVerifySubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.keys(errors).length > 0 && (
                            <div className="sm:col-span-2 rounded-2xl border border-rose-300 bg-rose-50/90 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 shadow-sm">
                                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-extrabold block">Data verifikasi belum lengkap:</span>
                                    <span className="font-medium text-rose-700">Mohon lengkapi {Object.values(errors).filter(Boolean).join(', ')}.</span>
                                </div>
                            </div>
                        )}
                        <label className="block text-xs font-bold text-slate-700">
                            Product
                            <input
                                id="verify-product-input"
                                type="text"
                                value={product}
                                placeholder="Masukkan nama produk..."
                                onChange={(e) => {
                                    setProduct(e.target.value);
                                    if (errors.product) setErrors(prev => ({ ...prev, product: undefined }));
                                }}
                                className={`mt-1 w-full rounded-xl text-xs font-bold text-slate-800 shadow-sm py-2 px-3 transition-all ${
                                    errors.product
                                        ? 'border-2 border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-500 ring-2 ring-rose-200'
                                        : 'border border-slate-300 bg-white focus:border-rose-500 focus:ring-rose-500'
                                }`}
                            />
                            {errors.product && (
                                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-extrabold text-rose-600">
                                    <AlertCircle size={12} className="shrink-0" />
                                    {errors.product}
                                </span>
                            )}
                        </label>
                        <label className="block text-xs font-bold text-slate-700">
                            Batch
                            <input
                                id="verify-batch-input"
                                type="text"
                                value={batchCode}
                                placeholder="Masukkan kode batch..."
                                onChange={(e) => {
                                    setBatchCode(e.target.value);
                                    if (errors.batchCode) setErrors(prev => ({ ...prev, batchCode: undefined }));
                                }}
                                className={`mt-1 w-full rounded-xl text-xs font-bold text-slate-800 shadow-sm py-2 px-3 transition-all ${
                                    errors.batchCode
                                        ? 'border-2 border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-500 ring-2 ring-rose-200'
                                        : 'border border-slate-300 bg-white focus:border-rose-500 focus:ring-rose-500'
                                }`}
                            />
                            {errors.batchCode && (
                                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-extrabold text-rose-600">
                                    <AlertCircle size={12} className="shrink-0" />
                                    {errors.batchCode}
                                </span>
                            )}
                        </label>
                        <label className="block text-xs font-bold text-slate-700">
                            Scheduled Process
                            <input
                                id="verify-process-input"
                                type="text"
                                value={scheduledProcess}
                                placeholder="Masukkan scheduled process..."
                                onChange={(e) => {
                                    setScheduledProcess(e.target.value);
                                    if (errors.scheduledProcess) setErrors(prev => ({ ...prev, scheduledProcess: undefined }));
                                }}
                                className={`mt-1 w-full rounded-xl text-xs font-bold text-slate-800 shadow-sm py-2 px-3 transition-all ${
                                    errors.scheduledProcess
                                        ? 'border-2 border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-500 ring-2 ring-rose-200'
                                        : 'border border-slate-300 bg-white focus:border-rose-500 focus:ring-rose-500'
                                }`}
                            />
                            {errors.scheduledProcess && (
                                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-extrabold text-rose-600">
                                    <AlertCircle size={12} className="shrink-0" />
                                    {errors.scheduledProcess}
                                </span>
                            )}
                        </label>
                        {groups.length > 0 && (
                        <label className="block text-xs font-bold text-slate-700">
                            Group
                            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-2 px-3">
                                <option value="">— Tanpa Group —</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </label>
                        )}
                        <label className="block text-xs font-bold text-slate-700">
                            Minimum F0
                            <input
                                id="verify-minf0-input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={minF0}
                                placeholder="0.00"
                                onChange={(e) => {
                                    setMinF0(e.target.value);
                                    if (errors.minF0) setErrors(prev => ({ ...prev, minF0: undefined }));
                                }}
                                className={`mt-1 w-full rounded-xl text-xs font-bold text-slate-800 shadow-sm py-2 px-3 transition-all ${
                                    errors.minF0
                                        ? 'border-2 border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-500 ring-2 ring-rose-200'
                                        : 'border border-slate-300 bg-white focus:border-rose-500 focus:ring-rose-500'
                                }`}
                            />
                            {errors.minF0 && (
                                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-extrabold text-rose-600">
                                    <AlertCircle size={12} className="shrink-0" />
                                    {errors.minF0}
                                </span>
                            )}
                        </label>
                        <label className="block text-xs font-bold text-slate-700">
                            Target F0
                            <input
                                id="verify-targetf0-input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={targetF0}
                                placeholder="0.00"
                                onChange={(e) => {
                                    setTargetF0(e.target.value);
                                    if (errors.targetF0) setErrors(prev => ({ ...prev, targetF0: undefined }));
                                }}
                                className={`mt-1 w-full rounded-xl text-xs font-bold text-slate-800 shadow-sm py-2 px-3 transition-all ${
                                    errors.targetF0
                                        ? 'border-2 border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-500 ring-2 ring-rose-200'
                                        : 'border border-slate-300 bg-white focus:border-rose-500 focus:ring-rose-500'
                                }`}
                            />
                            {errors.targetF0 && (
                                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-extrabold text-rose-600">
                                    <AlertCircle size={12} className="shrink-0" />
                                    {errors.targetF0}
                                </span>
                            )}
                        </label>
                        <label className="block text-xs font-bold text-slate-700">
                            Process deviation
                            <select value={deviation} onChange={(e) => setDeviation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-2 px-3">
                                <option value="None">None</option>
                                <option value="Minor">Minor</option>
                                <option value="Major">Major</option>
                            </select>
                        </label>
                        <label className="block text-xs font-bold text-slate-700">
                            Sterility criterion
                            <select value={effectiveCriterion} disabled={liveFail} onChange={(e) => setCriterion(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-2 px-3 disabled:opacity-60">
                                <option value="PASS">PASS</option>
                                <option value="FAIL">FAIL</option>
                            </select>
                        </label>
                        {liveFail && (
                            <p className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                F0 sistem di bawah Target F0 — Sterility criterion terkunci FAIL.
                            </p>
                        )}
                        <div className="sm:col-span-2 flex justify-end">
                            <button
                                type="submit"
                                className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black px-6 py-2.5 shadow-md shadow-rose-200 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <CheckCircle2 size={15} />
                                Tulis & Simpan Verifikasi Batch
                            </button>
                        </div>
                    </form>
                </section>
            ) : null}

            {/* Thermal Sterilization Profile Chart (Clean Retort Thermal Chart) */}
            <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-lg backdrop-blur-xl">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="font-extrabold text-slate-900 text-xl tracking-tight">
                                Profil Termal Sterilisasi Retort
                            </h2>
                            <span className="bg-blue-100 text-blue-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-200">
                                Thermal Profile
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                            Kurva pemanasan riil dengan pembagian zona langkah (CUT, Holding Time & F₀, Cooling Time) berbasis waktu proses.
                        </p>
                    </div>
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black border ${
                            batch.end_time
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                    >
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${
                                batch.end_time ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                            }`}
                        ></span>
                        {batch.end_time ? 'SELESAI' : 'LIVE MONITOR'}
                    </span>
                </div>

                <RetortThermalChart
                    data={logs}
                    targetSv={targetSv}
                    height={380}
                    isRunning={Boolean(batch.end_time === null)}
                />
            </section>

            {/* Process Logs (Active Heating) Table */}
            <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-lg backdrop-blur-xl">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="font-extrabold text-slate-900 text-xl">Process Logs (Active Heating)</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {totalRows > 0
                                ? `Menampilkan ${(tablePage - 1) * pageSize + 1}–${Math.min(
                                      tablePage * pageSize,
                                      totalRows
                                  )} dari ${totalRows} data points tersimpan.`
                                : 'Belum ada reading yang tersimpan.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label htmlFor="detail-per-page" className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                Per halaman
                            </label>
                            <select
                                id="detail-per-page"
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setTablePage(1);
                                }}
                                className="rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-1.5 px-5"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-extrabold text-blue-700">
                            {totalRows} records
                        </span>
                    </div>
                </div>

                <div className="max-h-[460px] overflow-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="sticky top-0 bg-[#0f172a] text-left text-xs font-black uppercase tracking-wider text-white">
                            <tr>
                                <th className="px-5 py-3.5">TIME</th>
                                <th className="px-5 py-3.5">PV (°C)</th>
                                <th className="px-5 py-3.5">SV (°C)</th>
                                <th className="px-5 py-3.5">HEAT MV</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-mono">
                            {paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-10 text-center font-sans font-bold text-slate-400">
                                        Belum ada reading dengan heating aktif pada batch ini.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log, index) => {
                                    const rawPv = Number(log.pv ?? log.actual ?? 0);
                                    const dp = Number(log.decimal_point ?? 0);
                                    const pv = dp > 0 ? rawPv / Math.pow(10, dp) : rawPv;

                                    const rawSv = Number(log.sv ?? log.setting ?? 121.0);
                                    const sv = dp > 0 ? rawSv / Math.pow(10, dp) : rawSv;

                                    const rawMv = Number(log.heating_mv ?? log.mv ?? 0);
                                    const mv = dp > 0 && rawMv > 100 ? rawMv / 10 : rawMv;

                                    return (
                                        <tr key={`${log.created_at ?? index}-${index}`} className="hover:bg-blue-50/70 transition-colors">
                                            <td className="whitespace-nowrap px-5 py-3 text-slate-600 font-bold">
                                                {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID') : '--'}
                                            </td>
                                            <td className="px-5 py-3 font-extrabold text-blue-700">
                                                {pv.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="px-5 py-3 font-extrabold text-amber-700">
                                                {sv.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="px-5 py-3 font-extrabold text-amber-600">
                                                {mv.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalRows > pageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4">
                        <button
                            type="button"
                            onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                            disabled={tablePage <= 1}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            Sebelumnya
                        </button>
                        <span className="text-xs font-bold text-slate-600">
                            Halaman {tablePage} dari {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                            disabled={tablePage >= totalPages}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            Berikutnya
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
