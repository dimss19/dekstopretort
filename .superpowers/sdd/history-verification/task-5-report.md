# Task 5 Report — Helper history + ekstrak HistorianList

Status: DONE

## TDD berurutan
1. Test ditulis dulu persis brief (`historyHelpers.test.ts`).
2. `npm test -- historyHelpers` → FAIL (module not found, 0 tests) — sesuai ekspektasi brief.
3. Implementasi minimal `historyHelpers.ts` persis brief.
4. `Historian` (Operations.tsx baris 102-452) dipindah verbatim ke `HistorianList.tsx`
   (export default, props `{ histories?: any[] }`, import `./ProcessDetailView`);
   body diverifikasi identik kecuali baris rename (diff 351 baris → hanya 1 baris beda).
   `Operations.tsx` tinggal render `<HistorianList histories={histories} />`;
   import yang hanya dipakai Historian (`router`, `createPortal`, hooks, 7 ikon,
   `ProcessDetailView`) dipindah/dihapus dari Operations.
5. Verifikasi: `tsc --noEmit` bersih; `npm test -- historyHelpers` PASS 3/3.

## Test (verbatim)
```
> test
> vitest run historyHelpers


 RUN  v4.1.10 D:/laragon/www/scadaretort


 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  15:49:50
   Duration  3.54s (transform 79ms, setup 629ms, import 49ms, tests 15ms, environment 2.46s)
```

## Full suite
`npm test`: 148 passed / 10 failed (33 files). 10 gagal pre-existing di luar scope
(electron-plugin tests + ScadaElement), terbukti gagal juga di tree bersih via
`git stash -u` (ScadaElement: 4 failed / 44 passed tanpa perubahan saya).

## Commit
4a74f1c — "refactor: ekstrak HistorianList + historyHelpers teruji"
(3 files created; Operations.tsx sudah termuat identik di HEAD a868f6c akibat
rebase `pull --rebase origin desktopapp` yang berjalan paralel selama sesi —
hash blob 5be1815 sama persis dengan hasil edit saya, tanpa perubahan perilaku.)

## Concerns
none
