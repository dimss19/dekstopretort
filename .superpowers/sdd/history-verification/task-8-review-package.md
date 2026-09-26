62df3fc feat: export PDF/Excel/CSV ikut blok verifikasi
diff --git a/resources/js/Components/History/ProcessDetailView.tsx b/resources/js/Components/History/ProcessDetailView.tsx
index ca1f355..895396a 100644
--- a/resources/js/Components/History/ProcessDetailView.tsx
+++ b/resources/js/Components/History/ProcessDetailView.tsx
@@ -425,20 +425,27 @@ export default function ProcessDetailView({ batch, onBack, groups = [] }: Props)
     );
 
     useEffect(() => {
         if (!groupId && groups.length > 0) setGroupId(String(groups[0].id));
     }, [groups, groupId]);
 
     const liveResult = targetF0.trim() === '' ? null : compareF0(systemF0, Number(targetF0));
     const liveFail = isUnverified && liveResult === 'FAIL';
     const effectiveCriterion = liveFail ? 'FAIL' : criterion;
 
+    // ponytail: derived sekali untuk 3 export (PDF/Excel/CSV)
+    const groupName = groups.find((g) => g.id === batch.group_id)?.name ?? batch.group_id ?? '-';
+    const verifyStatusLabel = isVerified ? 'VERIFIED' : !batch.end_time ? 'Berjalan' : 'UNVERIFIED';
+    const exportF0Result = compareF0(systemF0, batch.target_f0 ?? (targetF0.trim() === '' ? null : Number(targetF0))) ?? '-';
+    const verifiedByTxt = batch.verified_by ?? 'Belum diverifikasi';
+    const verifiedAtTxt = batch.verified_at ? new Date(batch.verified_at).toLocaleString('id-ID') : 'Belum diverifikasi';
+
     const handleVerifySubmit = (e: React.FormEvent) => {
         e.preventDefault();
         router.post(route('tn.history.verify', batch.id), {
             product,
             batch_code: batchCode,
             scheduled_process: scheduledProcess,
             min_f0_achieved: minF0 === '' ? null : Number(minF0),
             target_f0: targetF0 === '' ? null : Number(targetF0),
             process_deviation: deviation,
             sterility_criterion: effectiveCriterion,
@@ -682,20 +689,48 @@ export default function ProcessDetailView({ batch, onBack, groups = [] }: Props)
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
+                    <tr>
+                        <td class="lbl">Status Verifikasi</td>
+                        <td class="val">
+                            <span class="badge ${isVerified ? 'badge-success' : 'badge-warning'}">
+                                ${verifyStatusLabel}
+                            </span>
+                        </td>
+                        <td class="lbl">Product</td>
+                        <td class="val">${batch.product ?? '-'}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Batch</td>
+                        <td class="val">${batch.batch_code ?? '-'}</td>
+                        <td class="lbl">Group</td>
+                        <td class="val">${groupName}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">F0 Sistem</td>
+                        <td class="num">${systemF0.toFixed(2)} min</td>
+                        <td class="lbl">Hasil F0</td>
+                        <td class="num">${exportF0Result}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Diverifikasi Oleh</td>
+                        <td class="val">${verifiedByTxt}</td>
+                        <td class="lbl">Diverifikasi Tanggal</td>
+                        <td class="val">${verifiedAtTxt}</td>
+                    </tr>
                 </table>
 
                 <!-- Embedded Chart Curve -->
                 <div class="chart-box">
                     <h3>Grafik Profil Termal Sterilisasi Retort (PV vs SV vs MV)</h3>
                     <img id="chartImg" src="${chartDataUrl}" alt="Grafik Profil Termal" />
                 </div>
 
                 <!-- Detailed Data Log Table -->
                 <h3 class="table-title">Rincian Riwayat Data Log Sterilisasi</h3>
@@ -805,20 +840,36 @@ export default function ProcessDetailView({ batch, onBack, groups = [] }: Props)
                         <td class="lbl">Suhu Maksimum (Max PV)</td><td class="num" style="font-weight: bold; color: #dc2626; mso-number-format:'0\\.0';">${statsData.maxPv.toFixed(1)} ┬░C</td>
                     </tr>
                     <tr>
                         <td class="lbl">Total Durasi</td><td>${durationMinutes !== null ? `${durationMinutes} Menit` : '--'}</td>
                         <td class="lbl">Suhu Rata-rata (PV)</td><td class="num" style="font-weight: bold; color: #1d4ed8; mso-number-format:'0\\.0';">${statsData.avgPv.toFixed(1)} ┬░C</td>
                     </tr>
                     <tr>
                         <td class="lbl">Status Batch</td><td>${batch.end_time ? 'SELESAI' : 'SEDANG BERJALAN'}</td>
                         <td class="lbl">Total Data Points</td><td class="num" style="mso-number-format:'0';">${logs.length} Titik</td>
                     </tr>
+                    <tr>
+                        <td class="lbl">Status Verifikasi</td><td>${verifyStatusLabel}</td>
+                        <td class="lbl">Product</td><td>${batch.product ?? '-'}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Batch</td><td>${batch.batch_code ?? '-'}</td>
+                        <td class="lbl">Group</td><td>${groupName}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">F0 Sistem</td><td class="num" style="mso-number-format:'0\\.00';">${systemF0.toFixed(2)} min</td>
+                        <td class="lbl">Hasil F0</td><td class="num">${exportF0Result}</td>
+                    </tr>
+                    <tr>
+                        <td class="lbl">Diverifikasi Oleh</td><td>${verifiedByTxt}</td>
+                        <td class="lbl">Diverifikasi Tanggal</td><td>${verifiedAtTxt}</td>
+                    </tr>
                 </table>
 
                 <!-- Embedded Thermal Chart Image in Excel -->
                 <br/>
                 <table border="1" style="width: 100%; border-collapse: collapse;">
                     <thead>
                         <tr class="h">
                             <th colspan="6" style="text-align: left; padding: 8px 12px; font-size: 13px;">
                                 Grafik Profil Termal Sterilisasi Retort (PV vs SV vs MV)
                             </th>
@@ -870,20 +921,28 @@ export default function ProcessDetailView({ batch, onBack, groups = [] }: Props)
 
         // Construct formatted CSV with Metadata, KPI summary, and Data rows
         const metaSection = [
             `LAPORAN PROSES STERILISASI RETORT`,
             `Nomor Batch,#${batch.id}`,
             `Mesin / Controller,"${machineTitle}"`,
             `Waktu Mulai,"${startTime.toLocaleString('id-ID')}"`,
             `Waktu Selesai,"${endTime ? endTime.toLocaleString('id-ID') : 'Sedang Berjalan'}"`,
             `Total Durasi,"${durationMinutes !== null ? `${durationMinutes} Menit` : '--'}"`,
             `Status,"${batch.end_time ? 'Selesai' : 'Sedang Berjalan'}"`,
+            `Status Verifikasi,"${verifyStatusLabel}"`,
+            `Product,"${batch.product ?? '-'}"`,
+            `Batch,"${batch.batch_code ?? '-'}"`,
+            `Group,"${groupName}"`,
+            `F0 Sistem,"${systemF0.toFixed(2)} min"`,
+            `Hasil F0,"${exportF0Result}"`,
+            `Diverifikasi Oleh,"${verifiedByTxt}"`,
+            `Diverifikasi Tanggal,"${verifiedAtTxt}"`,
             ``,
             `RINGKASAN PARAMETER STERILISASI`,
             `Target Suhu (SV),${targetSv.toFixed(1)} ┬░C`,
             `Suhu Maksimum (Max PV),${statsData.maxPv.toFixed(1)} ┬░C`,
             `Suhu Minimum (Min PV),${statsData.minPv.toFixed(1)} ┬░C`,
             `Suhu Rata-rata (PV),${statsData.avgPv.toFixed(1)} ┬░C`,
             `Total Titik Data Log,${logs.length} Points`,
             ``,
             `DATA LOG DETAIL`,
         ];
