# Task 8 Report: Export ikut verifikasi

- Status: DONE (semua Steps brief dikerjakan; test PHP gagal pre-existing, bukan regresi Task 8)
- Commit: 62df3fcea7f9c81c9c9508a29941147e2aeed8ca — "feat: export PDF/Excel/CSV ikut blok verifikasi"
- Files: hanya `resources/js/Components/History/ProcessDetailView.tsx` (+59 baris)

## Steps
- [x] Step 1 PDF: summary table +4 baris (Status Verifikasi + Product, Batch + Group, F0 Sistem + Hasil F0, Diverifikasi Oleh + Tanggal); badge VERIFIED/UNVERIFIED/Berjalan; unverified → "Belum diverifikasi".
- [x] Step 2 Excel: baris KPI yang sama di tabel ringkasan.
- [x] Step 3 CSV: meta blok +8 baris (Status Verifikasi, Product, Batch, Group, F0 Sistem, Hasil F0, Diverifikasi Oleh/Tanggal).
- [x] Step 4 Run test (VERBATIM di bawah).
- [x] Step 5 Commit baru pesan persis brief, hanya file brief (cek `git status` dulu; `.superpowers/` tidak di-stage).

## Test VERBATIM
Run: `php artisan test --filter=EspMonitorAndCsvTest`
Result:
`{"tool":"phpunit","result":"failed","tests":5,"passed":4,"assertions":20,"duration_ms":2523,"failed":1,"failures":[{"test":"Tests\\Feature\\EspMonitorAndCsvTest::test_esp_live_returns_cached_telemetry","message":"Expected response status code [200] but received 500. Undefined array key \"ts\" in app/Http/Controllers/EspMonitorController.php:173"}]}`

Tambahan:
- `npx tsc --noEmit`: bersih (no output, exit ok).
- Bukti pre-existing: stash file Task 8 → rerun `test_esp_live_returns_cached_telemetry` tetap FAIL error identik (`Undefined array key "ts"` EspMonitorController.php:173). Bukan regresi Task 8 (perubahan hanya TSX frontend).
- Manual checklist (tidak bisa browser di sesi ini, verifikasi statis): grep `verifyStatusLabel|Belum diverifikasi|exportF0Result|groupName` hadir di ketiga builder `handleDownloadPDF`, `handleDownloadExcel`, `handleDownloadCSV`. Manual browser (export 1 verified + 1 unverified) diserahkan ke verifikator.

## Concerns
- `EspMonitorAndCsvTest::test_esp_live_returns_cached_telemetry` FAIL pre-existing (`Undefined array key "ts"` di `EspMonitorController.php:173`); di luar scope file brief Task 8, tidak diperbaiki agar tidak melanggar batasan HANYA file brief.
