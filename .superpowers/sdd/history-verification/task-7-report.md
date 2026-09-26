# Task 7 Report: Detail F0 + VALID/FAIL + form inline

- Step 1 (Stat F0 sistem): DONE — baris "F0 sistem (otomatis): X.XX min" di header card, dihitung dari `logs` via `calculateF0(temps, 1)` dengan mapping pv/dp identik `statsData` existing (+ filter pv > 0).
- Step 2 (Indikator VALID/FAIL live): DONE — bila `unverified`, badge hijau VALID / merah FAIL dari `compareF0(systemF0, target)` live saat Target F0 diketik, disembunyikan bila target kosong; bila `verified`, badge dari `sterility_criterion` + F0 tersimpan (`target_f0 ?? min_f0_achieved ?? systemF0`).
- Step 3 (Form inline): DONE — hanya bila `end_time` terisi + `unverified`; 9 field required (Product, Batch, Scheduled Process, Minimum F0 step 0.01, Target F0 step 0.01, Process deviation None/Minor/Major default None, Sterility criterion PASS/FAIL, Thermal record VERIFIED/REJECTED, Group dari `groups` default id pertama); bila live-compare FAIL, select criterion terkunci `FAIL` (disabled) + teks peringatan; submit `router.post(route('tn.history.verify', batch.id), payload)`; bila `verified`, blok read-only semua field + group + `verified_by/at`.
- Step 4 (Verifikasi): `npx tsc --noEmit` → PASS (nol error). Manual browser checklist TIDAK dieksekusi (lingkungan tanpa browser/dev-server); logika live-compare memakai `compareF0` yang sudah lolos unit test Task 5, payload memakai key yang sama dengan validasi backend `verifyHistory` (`product, batch_code, scheduled_process, min_f0_achieved, target_f0, process_deviation, sterility_criterion, thermal_record, group_id`).
- Step 5 (Commit): `b9f7030b1ca1ae94783d9f591e157f2f51923ce7` — "feat: F0 otomatis + VALID/FAIL + form verifikasi inline" (hanya `ProcessDetailView.tsx`; `HistorianList.tsx` tanpa perubahan karena teruskan `groups` sudah ada dari Task 6).

## Fix round 1/5
- Temuan: 3 select (deviation/criterion/thermal) tanpa atribut `required` vs brief 'Semua required' — ProcessDetailView.tsx:1119,1127,1134.
- Perbaikan: tambah `required` pada 3 select tersebut; tidak ada perubahan perilaku/logika lain.
- Verifikasi: `npx tsc --noEmit` → PASS (nol error).
- Commit fix: `1a8426e50ed444a9ee46177fb5c7c8af4e95f53b` — "fix: required pada semua field form verifikasi" (hanya `ProcessDetailView.tsx`).
