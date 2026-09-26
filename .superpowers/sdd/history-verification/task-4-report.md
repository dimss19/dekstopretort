# Task 4 Report: calculateF0 TS ke Tref 121.1

## Status
done — RED verified (fail 9.75 vs 9.77), GREEN verified (all pass), committed.

## Commit
0536221e4ee51327857b5e108a89d027ebfbff6f — `fix: calculateF0 Tref 121.1 metode 1-titik + test`

## Perubahan
- `resources/js/Pages/Tn/retortTelemetry.ts`: konstanta `121.11` -> `121.1` + komentar rumus; struktur loop 1-titik dipertahankan.
- `resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts`: tambah test diskriminator `uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)` -> `calculateF0(Array(600).fill(121.0), 1)` = `9.77`.

## Test (VERBATIM, `npm test -- retortTelemetry`, run pasca-commit)
```
> test
> vitest run retortTelemetry


 RUN  v4.1.10 D:/laragon/www/scadaretort


 Test Files  4 passed (4)
      Tests  37 passed (37)
   Start at  15:40:45
   Duration  4.30s (transform 507ms, setup 2.89s, import 485ms, tests 98ms, environment 11.09s)
```

## Test RED (VERBATIM, sebelum fix — bukti gagal dulu)
```
FAIL  resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts > retort telemetry normalization > uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)
AssertionError: expected 9.75 to be 9.77 // Object.is equality
```

## Concerns
none
