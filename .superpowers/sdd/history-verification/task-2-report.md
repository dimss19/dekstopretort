# Task 2 Report: F0Calculator PHP (TDD)

## Status
DONE — commit `fb5e7ecbb4ebe5e548f2f06bebc95ae0711d6fac`
Message: `feat: F0Calculator 1-titik Tref 121.1 + unit test`
Files: `app/Services/F0Calculator.php` (baru), `tests/Unit/F0CalculatorTest.php` (baru)

## Keputusan (dari brief, nilai eksak)
- Metode 1-titik murni (bukan trapezoid), Tref 121.1, z 10, dt 1/60, skip T<100, round 2 desimal.
- Normalisasi: `decimal_point > 0` → `pv / 10^dp`; overscale `pv > 300` → `pv / 10`.

## Steps (berurutan, TDD)

### Step 1: Write the failing test — DONE
`tests/Unit/F0CalculatorTest.php` ditulis persis sesuai brief (4 test:
constant_121_1_for_60_seconds_is_1, single_point_method_not_trapezoid,
below_100_contributes_zero, decimal_point_and_overscale_normalized).

### Step 2: Run test to verify it fails — DONE (FAIL sesuai ekspektasi)
Command: `php artisan test --filter=F0CalculatorTest`
Hasil VERBATIM:
```
{"tool":"phpunit","result":"failed","tests":4,"passed":0,"assertions":0,"duration_ms":22,"errors":4,"error_details":[{"test":"Tests\\Unit\\F0CalculatorTest::test_constant_121_1_for_60_seconds_is_1","file":"D:\\laragon\\www\\scadaretort\\tests\\Unit\\F0CalculatorTest.php","line":15,"message":"Class \"App\\Services\\F0Calculator\" not found"},{"test":"Tests\\Unit\\F0CalculatorTest::test_single_point_method_not_trapezoid","file":"D:\\laragon\\www\\scadaretort\\tests\\Unit\\F0CalculatorTest.php","line":20,"message":"Class \"App\\Services\\F0Calculator\" not found"},{"test":"Tests\\Unit\\F0CalculatorTest::test_below_100_contributes_zero","file":"D:\\laragon\\www\\scadaretort\\tests\\Unit\\F0CalculatorTest.php","line":25,"message":"Class \"App\\Services\\F0Calculator\" not found"},{"test":"Tests\\Unit\\F0CalculatorTest::test_decimal_point_and_overscale_normalized","file":"D:\\laragon\\www\\scadaretort\\tests\\Unit\\F0CalculatorTest.php","line":30,"message":"Class \"App\\Services\\F0Calculator\" not found"}]}
```
Verifikasi RED: 4 errors, semua `Class "App\Services\F0Calculator" not found` — gagal karena class belum ada (bukan typo test).

### Step 3: Write minimal implementation — DONE
`app/Services/F0Calculator.php` ditulis persis sesuai brief
(`TREF=121.1`, `Z=10.0`, `DT_MINUTES=1/60`, `fromLogs(array $logs): float`).

### Step 4: Run test to verify it passes — DONE (PASS 4 tests)
Command: `php artisan test --filter=F0CalculatorTest`
Hasil VERBATIM:
```
{"tool":"phpunit","result":"passed","tests":4,"passed":4,"assertions":5,"duration_ms":13}
```
Verifikasi GREEN: 4 passed, 5 assertions. Re-run konfirmasi:
```
{"tool":"phpunit","result":"passed","tests":4,"passed":4,"assertions":5,"duration_ms":12}
```
Test kunci `single_point_method_not_trapezoid` (ekspektasi 0.05; trapezoid akan memberi 0.03) lolos → metode 1-titik terkunci.

### Step 5: Commit — DONE
```bash
git add app/Services/F0Calculator.php tests/Unit/F0CalculatorTest.php
git commit -m "feat: F0Calculator 1-titik Tref 121.1 + unit test"
```
Hash: `fb5e7ecbb4ebe5e548f2f06bebc95ae0711d6fac`

## Catatan
- Hanya 2 file di brief yang dibuat/diubah. Task lain tidak dieksekusi.
- `git status` pasca-commit bersih kecuali `?? .superpowers/` (untracked, di luar scope brief — tidak di-commit).
