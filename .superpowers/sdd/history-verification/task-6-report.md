# Task 6 Report — Badge + filter status + chip group + rename

Status: DONE

## Implementasi (persis brief, 3 files)
1. `HistorianList.tsx`: props tambah `groups?: HistorianListGroup[]`;
   state `statusFilter` / `groupFilter` / `query`; `filteredHistories` =
   filter periode existing + `filterHistories(...)` (Task 5).
2. Badge 3 state via `getHistoryStatus`: running → "Proses Berjalan"
   (amber pulse); unverified → "UNVERIFIED" (amber solid);
   verified → "VERIFIED" (emerald + `title="by {verified_by} · {verified_at}"`).
3. Chip group `[Semua | {name}...]` + dot `group.color`; ikon pensil buka
   editor inline (input nama maxLength 50 + `input type=color`) →
   `router.put(route('tn.history-groups.update', id), { name, color })`.
   `groups` diteruskan ke `<ProcessDetailView groups={groups}>` (Task 7).
4. Toolbar: tombol `Semua / Verified / Unverified / Berjalan` + search
   `placeholder="Cari product / batch..."`.
5. `routes/web.php` closure `/historian` tambah
   `'groups' => HistoryGroup::orderBy('id')->get()`; `Operations.tsx`
   terima `groups` dan teruskan ke `HistorianList`.
6. Test: tidak ada test baru — filter groupId + status + query sudah
   dicakup `historyHelpers.test.ts` Task 5; rename group dicakup
   `HistoryVerificationTest` Task 3 (4 tests PASS).

## Test (verbatim)
```
{"tool":"phpunit","result":"passed","tests":4,"passed":4,"assertions":11,"duration_ms":1645}

 RUN  v4.1.10 D:/laragon/www/scadaretort


 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  15:59:56
   Duration  3.65s (transform 79ms, setup 694ms, import 37ms, tests 14ms, environment 2.48s)
```
(php artisan test --filter=HistoryVerificationTest → 4 passed/11 assertions;
`npm test -- historyHelpers` → 3 passed.)

## Commit
9100cb1 — "feat: badge verifikasi + filter status + chip group rename"
(3 files; tanpa rebase/reset/amend; branch desktopapp.)

## Concerns
- `npx tsc --noEmit` baseline bersih, kini 1 error baru yang disengaja:
  `HistorianList.tsx(174,17)` — prop `groups` belum ada di
  `ProcessDetailView` Props; dideklarasikan + dipakai di Task 7 (dropdown
  group). Suite wajib brief (artisan + vitest) hijau.
- `git status --short` saat commit: hanya 3 file milik Task 6 (staged) +
  `?? .superpowers/` (untracked, direktori laporan instruksi — tidak di-stage
  sesuai perintah). Tidak ada file asing dari workstream paralel.

## Fix round 1/5 (review: tree-merah antar-task)
- Perintah: tambah `groups?` opsional di `ProcessDetailView.tsx`
  (diterima dan diabaikan dulu; Task 7 memakai penuh), tanpa ubah perilaku.
- Verifikasi penutup: `npx tsc --noEmit` → NOL error (output kosong,
  exit 0; sebelumnya 1 error TS2322 di `HistorianList.tsx(174,17)`).
- `git status --short` sebelum stage: hanya
  `M resources/js/Components/History/ProcessDetailView.tsx` +
  `?? .superpowers/` (laporan, tidak di-stage). Commit BARU tanpa
  rebase/amend.

## Commit fix
3c9bb1a — "fix: optional groups prop di ProcessDetailView agar tsc hijau"
(1 file, +1 baris interface + komentar ponytail.)
