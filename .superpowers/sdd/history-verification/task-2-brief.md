### Task 2: F0Calculator PHP (TDD)

**Files:**
- Create: `app/Services/F0Calculator.php`
- Test: `tests/Unit/F0CalculatorTest.php`

**Interfaces:**
- Consumes: `log_data` array (tiap item: `pv`, `decimal_point`).
- Produces: `F0Calculator::fromLogs(array $logs): float` untuk Task 3 (backend verify).

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit;

use App\Services\F0Calculator;
use PHPUnit\Framework\TestCase;

class F0CalculatorTest extends TestCase
{
    private function logs(array $pvs, int $dp = 0): array
    {
        return array_map(fn ($pv) => ['pv' => $pv, 'decimal_point' => $dp], $pvs);
    }

    public function test_constant_121_1_for_60_seconds_is_1(): void
    {
        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 121.1))));
    }

    public function test_single_point_method_not_trapezoid(): void
    {
        $this->assertSame(0.05, F0Calculator::fromLogs($this->logs([120, 121, 122])));
    }

    public function test_below_100_contributes_zero(): void
    {
        $this->assertSame(0.0, F0Calculator::fromLogs($this->logs(array_fill(0, 600, 90))));
    }

    public function test_decimal_point_and_overscale_normalized(): void
    {
        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 1)));
        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 0)));
    }
}
```

Nilai ekspektasi: L(120)=0.77625, L(121)=0.97724, L(122)=1.23027; jumlah/60=0.04973 -> 0.05. Trapezoid memberi 0.03, jadi test ini mengunci metode 1-titik.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=F0CalculatorTest`
Expected: FAIL (class not found)

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Services;

class F0Calculator
{
    public const TREF = 121.1;
    public const Z = 10.0;
    public const DT_MINUTES = 1 / 60;

    public static function fromLogs(array $logs): float
    {
        $f0 = 0.0;
        foreach ($logs as $log) {
            $pv = (float) ($log['pv'] ?? 0);
            $dp = (int) ($log['decimal_point'] ?? 0);
            if ($dp > 0) {
                $pv /= 10 ** $dp;
            }
            if ($pv > 300) {
                $pv /= 10;
            }
            if ($pv < 100) {
                continue;
            }
            $f0 += (10 ** (($pv - self::TREF) / self::Z)) * self::DT_MINUTES;
        }

        return round($f0, 2);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=F0CalculatorTest`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/Services/F0Calculator.php tests/Unit/F0CalculatorTest.php
git commit -m "feat: F0Calculator 1-titik Tref 121.1 + unit test"
```

---


