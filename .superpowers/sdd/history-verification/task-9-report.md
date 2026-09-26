# Task 9 Report: ESP reuse HistorianList + final gate

- Status: DONE (semua Steps brief dikerjakan; commit berisi HANYA 2 file brief)
- Commit: 1a74ab8 — "refactor: history ESP pakai HistorianList bersama"
- Files: `app/Http/Controllers/EspMonitorController.php` (+1 baris), `resources/js/Pages/Esp/Monitor.tsx` (705 → 413 baris, −292 duplikasi)

## Steps
- [x] Step 1 Backend groups: `'groups' => \App\Models\HistoryGroup::orderBy('id')->get(),` ditambah ke data Inertia `index()`.
- [x] Step 2 Ganti tab history: blok `selectedBatch ? <ProcessDetailView/> : (Historian lokal ~200 baris)` diganti `<HistorianList histories={histories} groups={groups} />`; state `period/customDate/selectedBatch/activeMenu`, `filteredHistories`, `handleDownload`, `handleDeleteHistory` dihapus; `groups` ditambah ke interface `Props`; import `router`/`ProcessDetailView`/ikon duplikat dibersihkan; aturan lock-detail-saat-running versi ESP ikut aturan bersama via HistorianList.
- [x] Step 3 Final gate (VERBATIM di bawah).
- [x] Step 4 Commit pesan persis brief, hanya 2 file brief (cek `git status` dulu; `.superpowers/` tidak di-stage; tanpa rebase/reset/amend).

## Test VERBATIM
Run: `npx tsc --noEmit`
Result: PASS (no output, exit 0)

Run: `php artisan test` (full suite)
Result: `{"tool":"phpunit","result":"failed","tests":64,"passed":43,"failed":14,"errors":7}` — 14 failed: DesktopLoginTest::test_guest_is_redirected_to_login, ConfigControllerTest (4: view_config 404, cannot_update, duplicate_pins, push_config), DeviceControllerTest (3: view_index, duplicate_machine_code, delete), EspMonitorAndCsvTest::test_esp_live_returns_cached_telemetry (500, Undefined array key "ts" EspMonitorController.php:174 — KNOWN-PRE-EXISTING), ExampleTest, OtaControllerTest (4); 7 errors: DeviceControllerTest::test_can_store_device, EspMonitorAndCsvTest csv/txt import (UNIQUE tn_controllers.slave_id), TnRecipeFeatureTest (4, UNIQUE tn_controllers.slave_id).

Run: `npm test` (full suite)
Result: `Test Files 10 failed | 23 passed (33); Tests 10 failed | 148 passed (158)` — gagal HANYA di file non-plan: ScadaElement.test.tsx (4 path duplikat: resources/js + nativephp/dist + vendor + installer-release) dan nativephp electron-plugin tests (api/mocking/notification, 6 file); tidak ada file plan (historyHelpers/HistorianList) yang gagal.
Run: `npx vitest run resources/js/Components/History/__tests__/historyHelpers.test.ts`
Result: `Test Files 1 passed (1); Tests 3 passed (3)` (file plan hijau)

Bukti bukan regresi Task 9: stash 2 file Task 9 → rerun `php artisan test` = set gagal IDENTIK (64 tests, 43 passed, 14 failed + 7 errors, daftar test sama). Zero failure baru.

Manual: DEFERRED-USER-UAT (tanpa browser di sesi ini).

## Concerns
- Full `php artisan test` tidak hijau di HEAD maupun dengan Task 9 (21 pre-existing fail/error di luar file plan: auth redirect, config/OTA 404, validasi device, UNIQUE slave_id sqlite); hanya known-pre-existing `test_esp_live_returns_cached_telemetry` yang menyentuh file plan (tidak diperbaiki sesuai instruksi). Tidak ada failure BARU dari Task 9.
- `npm test` menyapu duplikat test di direktori build/vendor (`nativephp/*/dist`, `vendor/`, `scada-retort-installer-release/`) — 10 gagal pre-existing di luar scope plan.
