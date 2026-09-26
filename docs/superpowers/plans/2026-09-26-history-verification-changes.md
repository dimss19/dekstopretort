# Daftar Perubahan — Verifikasi History + Group + F0

> Ringkasan dari `2026-09-26-history-verification-design.md` (spec) dan
> `2026-09-26-history-verification.md` (implementation plan).
> Status: BELUM DIEKSEKUSI. Centang `[x]` per item saat implementasi berjalan.

## 1. Database (1 migration)

- [ ] `database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php` (baru)
  - Tabel baru `history_groups` + seed 2 baris: `Group 1` (#2563eb), `Group 2` (#059669)
  - Kolom baru `tn_process_histories`: `verification_status` (default `unverified`),
    `product`, `batch_code` (unique), `scheduled_process`, `min_f0_achieved`,
    `target_f0`, `process_deviation`, `sterility_criterion`, `thermal_record`,
    `verified_by`, `verified_at`, `group_id` (FK, null on delete)
  - Data lama: otomatis `unverified`, field lain NULL (tidak ada data diubah)

## 2. Backend Laravel

- [ ] `app/Models/HistoryGroup.php` (baru) — relasi `histories()`
- [ ] `app/Models/TnProcessHistory.php` (ubah) — casts baru + relasi `group()`
- [ ] `app/Services/F0Calculator.php` (baru) — `fromLogs()`: 1-titik, Tref 121.1, z 10, dt 1/60, T >= 100C, round 2
- [ ] `app/Http/Controllers/TnMonitorController.php` (ubah)
  - `verifyHistory()`: guard selesai+belum verified (422), validasi 8 field + group wajib,
    hitung ulang F0 dari `log_data`, override criterion FAIL bila F0 < Target (strict),
    isi `verified_by` (nama operator) + `verified_at`
  - `updateHistoryGroup()`: rename + warna (validasi hex `#rrggbb`)
- [ ] `routes/web.php` (ubah) — `POST /tn/history/{history}/verify`, `PUT /tn/history-groups/{group}`, kirim `groups` ke `/historian`
- [ ] `app/Http/Controllers/EspMonitorController.php` (ubah) — kirim `groups` ke view ESP

## 3. Frontend React

- [ ] `resources/js/Pages/Tn/retortTelemetry.ts` (ubah) — `calculateF0` Tref 121.11 -> 121.1
- [ ] `resources/js/Components/History/historyHelpers.ts` (baru) — `getHistoryStatus`, `compareF0` (strict), `filterHistories` (status + group + search product/batch)
- [ ] `resources/js/Components/History/HistorianList.tsx` (baru, pindahan) — grid card, badge 3 state (Berjalan/UNVERIFIED/VERIFIED), filter periode + status + search, chip group + rename, dipakai TN dan ESP
- [ ] `resources/js/Pages/Operations.tsx` (ubah) — pakai `HistorianList`, hapus duplikasi
- [ ] `resources/js/Components/History/ProcessDetailView.tsx` (ubah) — stat F0 otomatis, indikator VALID/FAIL live, form inline 8 field + group (terkunci FAIL bila F0 < Target), export PDF/Excel/CSV ikut blok verifikasi
- [ ] `resources/js/Pages/Esp/Monitor.tsx` (ubah) — tab history pakai `HistorianList`, hapus +-150 baris duplikasi

## 4. Test

- [ ] `tests/Feature/HistoryVerificationSchemaTest.php` — kolom + seed 2 group
- [ ] `tests/Unit/F0CalculatorTest.php` — 1.0 / 0.05 (1-titik, bukan trapezoid) / 0 / normalisasi dp
- [ ] `tests/Feature/HistoryVerificationTest.php` — verify sukses, override FAIL, 422 (running/double), rename + tolak warna salah
- [ ] `resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts` — tambah test 0.05
- [ ] `resources/js/Components/History/__tests__/historyHelpers.test.ts` — status, compare strict, filter

## 5. Verifikasi akhir

- [ ] `php artisan test` PASS
- [ ] `npm test` PASS
- [ ] `npx tsc --noEmit` PASS
- [ ] Manual: `/historian` + tab history ESP — badge, filter, search, group, form, export
