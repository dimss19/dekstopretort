# Task 3 Report — Endpoint verify + rename group (TDD)

- Status: DONE
- Commit: `93770ce35bd8d3b75ecea2a88087c37fafab60fa` — `feat: endpoint verify history + rename group + feature test`
- Files: `app/Http/Controllers/TnMonitorController.php`, `routes/web.php`, `tests/Feature/HistoryVerificationTest.php` (commit: 188 insertions, 0 deletions)
- Plan: `.superpowers/sdd/history-verification/task-3-brief.md` (Task 1 + Task 2 sudah commit sebelumnya)

## Step 1 — Failing test ditulis dulu (RED)

Test ditulis persis brief ke `tests/Feature/HistoryVerificationTest.php`, dijalankan sebelum kode produksi:

```
php artisan test --filter=HistoryVerificationTest
```

Hasil VERBATIM:

```json
{"tool":"phpunit","result":"failed","tests":4,"passed":0,"assertions":0,"duration_ms":4391,"errors":4,"error_details":[{"test":"Tests\\Feature\\HistoryVerificationTest::test_verify_finished_history","file":"D:\\laragon\\www\\scadaretort\\tests\\Feature\\HistoryVerificationTest.php","line":55,"message":"Route [tn.history.verify] not defined."},{"test":"Tests\\Feature\\HistoryVerificationTest::test_system_f0_below_target_forces_fail","file":"D:\\laragon\\www\\scadaretort\\tests\\Feature\\HistoryVerificationTest.php","line":70,"message":"Route [tn.history.verify] not defined."},{"test":"Tests\\Feature\\HistoryVerificationTest::test_verify_running_or_twice_returns_422","file":"D:\\laragon\\www\\scadaretort\\tests\\Feature\\HistoryVerificationTest.php","line":84,"message":"Route [tn.history.verify] not defined."},{"test":"Tests\\Feature\\HistoryVerificationTest::test_rename_group_and_reject_bad_color","file":"D:\\laragon\\www\\scadaretort\\tests\\Feature\\HistoryVerificationTest.php","line":98,"message":"Route [tn.history-groups.update] not defined."}]}
```

Sesuai ekspektasi brief: FAIL (route not defined).

## Step 2 — Implementasi (GREEN)

1. `TnMonitorController`: `verifyHistory()` + `updateHistoryGroup()` + helper `validatedOrJson422()` (detail deviasi di bawah).
2. `routes/web.php` dalam grup prefix `tn`, nama persis brief:
   - `POST /history/{history}/verify` → `tn.history.verify`
   - `PUT /history-groups/{group}` → `tn.history-groups.update`
3. `Request` sudah ter-import; model/Services/F0Calculator via FQCN; enum DB string + validasi `in:`; `verified_by = $request->user()->name`.

Hasil VERBATIM (perintah persis brief):

```
php artisan test --filter=HistoryVerificationTest
```

```json
{"tool":"phpunit","result":"passed","tests":4,"passed":4,"assertions":11,"duration_ms":1989}
```

Regresi terkait (Task 1 + Task 2) tetap hijau:

```json
{"tool":"phpunit","result":"passed","tests":6,"passed":6,"assertions":19,"duration_ms":2139}
```

(`--filter="HistoryVerificationSchemaTest|F0CalculatorTest"`)

## Deviasi dari brief (2, minimal, dalam file brief saja)

1. **Validasi manual via `Validator` + helper `validatedOrJson422()`** (bukan `$request->validate()`).
   Sebab: `bootstrap/app.php` memakai `shouldRenderJsonWhen(fn ($request) => $request->is('api/*'))`,
   yang di Laravel *menggantikan* (bukan menambah) cek `expectsJson()`. Akibatnya validasi gagal di
   route web selalu redirect 302 meski request JSON → `assertStatus(422)` untuk warna grup invalid gagal.
   Perilaku form web tetap sama (redirect back + errors); hanya request JSON yang kini dapat 422 JSON
   eksplisit. Aturan validasi identik dengan brief.
2. **`makeHistory()` memakai `machine_code`/`slave_id`/`name` unik per panggilan** (counter statis,
   offset `RT-9N` / `100+N`). Sebab: `machines.machine_code` dan `tn_controllers.slave_id` UNIQUE, dan
   `test_verify_running_or_twice_returns_422` memanggil `makeHistory()` 2x dalam satu test. Intent test
   tidak berubah.

## Insiden commit (diperbaiki, state akhir bersih)

- Working tree berisi WIP tak-tercommit milik workstream lain (termasuk penghapusan blok simulasi di
  `readings()`); commit pertama Task 3 (5cf5491) ikut menyapu penghapusan tersebut, lalu `git commit --amend`
  salah sasaran ke commit workstream lain (841de0a) yang masuk di antaranya.
- Perbaikan: `git reset --soft fb5e7ec` lalu commit ulang terpisah — 93770ce (Task 3, 3 file, murni addisi)
  + 34eb99b (workstream lain, 9 file, pesan asli, isi file identik dengan 841de0a). Tidak ada push/remote
  yang terpengaruh; working tree akhir bersih dan test hijau di state final.

## Concerns

- `bootstrap/app.php: shouldRenderJsonWhen(api/*)` menonaktifkan respons JSON otomatis untuk SEMUA
  exception di route web (bukan hanya validasi). Endpoint non-brief yang mengandalkan `$request->validate()`
  + klien JSON punya masalah 302-yang-sama. Di luar scope Task 3 (file non-brief), tapi Task 7 (form inline)
  perlu tahu: pemanggil JSON ke endpoint verify/group aman (422 eksplisit), pemanggil JSON ke endpoint
  validasi-lain di grup `tn` belum tentu.
- Test memakai file `database/database.sqlite` (bukan `:memory:`) karena env; `RefreshDatabase` tetap
  me-migrate fresh per test sehingga terisolasi. Bukan masalah, hanya catatan.
