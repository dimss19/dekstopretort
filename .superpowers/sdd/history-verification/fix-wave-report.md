# Fix Wave Report — Temuan Final Review Verifikasi History

Commit: 017edf7 (`fix: temuan final review verifikasi history`)
Scope: hanya 5 file temuan, tanpa rebase/reset/amend. `.superpowers/` tidak di-stage.

## Temuan → Perbaikan
1. (Critical) `TnMonitorController.php:234` — `$verifiedBy = $request->user()->name ?? 'Operator';` + pakai `$verifiedBy`; tambah `test_verify_as_guest_defaults_verified_by_operator` (postJson tanpa actingAs → assertOk + `verified_by` Operator).
2. (Important) `TnMonitorController.php:209-210` — `min_f0_achieved`/`target_f0` → `required|numeric|min:0`. DB tetap nullable.
3. (Important) `HistorianList.tsx:169-177 vs :456-497` — hapus blok modal createPortal unreachable + hapus `import { createPortal }`.
4. (Important) `HistorianList.tsx:81-140` — `handleDownload` card-level prepend ringkasan verifikasi (Status via `getHistoryStatus`, Product, Batch, Group, F0 sistem via `calculateF0`, VALID/FAIL via `compareF0`, Diverifikasi oleh/tanggal; fallback `Belum diverifikasi`) ke CSV dan PDF.
5. (Minor) `historyHelpers.ts:9` — guard `Number.isNaN(targetF0)` + `Number.isNaN(systemF0)`; tambah 2 assert NaN di `historyHelpers.test.ts`.
6. (Minor) `HistorianList.tsx:331` — `maxPv` via `normalizePv` lokal (bagi 10^dp bila dp>0; bagi 10 bila >300), sama seperti F0Calculator/ProcessDetailView; dipakai juga untuk F0 card-level.

Yang diabaikan (sesuai instruksi): `$guarded`→`$fillable`, kosmetik Realtime/Live, test pre-existing di luar file plan.

## Gate — hasil VERBATIM
Gate 1 (`php artisan test --filter='HistoryVerificationSchemaTest|F0CalculatorTest|HistoryVerificationTest'`):
```
{"tool":"phpunit","result":"passed","tests":11,"passed":11,"assertions":33,"duration_ms":2003}
EXIT_CODE:0
```
Gate 2 (`npm test -- historyHelpers retortTelemetry`):
```
> test
> vitest run historyHelpers retortTelemetry


 RUN  v4.1.10 D:/laragon/www/scadaretort


 Test Files  5 passed (5)
      Tests  40 passed (40)
   Start at  16:37:01
   Duration  7.23s (transform 837ms, setup 4.63s, import 600ms, tests 91ms, environment 25.27s)

EXIT_CODE:0
```
Gate 3 (`npx tsc --noEmit`):
```
(empty output — nol error)
EXIT_CODE:0
```
