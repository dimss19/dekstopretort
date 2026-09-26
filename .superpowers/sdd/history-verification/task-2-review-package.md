fb5e7ec feat: F0Calculator 1-titik Tref 121.1 + unit test
 app/Services/F0Calculator.php   | 31 +++++++++++++++++++++++++++++++
 tests/Unit/F0CalculatorTest.php | 35 +++++++++++++++++++++++++++++++++++
 2 files changed, 66 insertions(+)
diff --git a/app/Services/F0Calculator.php b/app/Services/F0Calculator.php
new file mode 100644
index 0000000..4358f42
--- /dev/null
+++ b/app/Services/F0Calculator.php
@@ -0,0 +1,31 @@
+<?php
+
+namespace App\Services;
+
+class F0Calculator
+{
+    public const TREF = 121.1;
+    public const Z = 10.0;
+    public const DT_MINUTES = 1 / 60;
+
+    public static function fromLogs(array $logs): float
+    {
+        $f0 = 0.0;
+        foreach ($logs as $log) {
+            $pv = (float) ($log['pv'] ?? 0);
+            $dp = (int) ($log['decimal_point'] ?? 0);
+            if ($dp > 0) {
+                $pv /= 10 ** $dp;
+            }
+            if ($pv > 300) {
+                $pv /= 10;
+            }
+            if ($pv < 100) {
+                continue;
+            }
+            $f0 += (10 ** (($pv - self::TREF) / self::Z)) * self::DT_MINUTES;
+        }
+
+        return round($f0, 2);
+    }
+}
diff --git a/tests/Unit/F0CalculatorTest.php b/tests/Unit/F0CalculatorTest.php
new file mode 100644
index 0000000..497edfe
--- /dev/null
+++ b/tests/Unit/F0CalculatorTest.php
@@ -0,0 +1,35 @@
+<?php
+
+namespace Tests\Unit;
+
+use App\Services\F0Calculator;
+use PHPUnit\Framework\TestCase;
+
+class F0CalculatorTest extends TestCase
+{
+    private function logs(array $pvs, int $dp = 0): array
+    {
+        return array_map(fn ($pv) => ['pv' => $pv, 'decimal_point' => $dp], $pvs);
+    }
+
+    public function test_constant_121_1_for_60_seconds_is_1(): void
+    {
+        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 121.1))));
+    }
+
+    public function test_single_point_method_not_trapezoid(): void
+    {
+        $this->assertSame(0.05, F0Calculator::fromLogs($this->logs([120, 121, 122])));
+    }
+
+    public function test_below_100_contributes_zero(): void
+    {
+        $this->assertSame(0.0, F0Calculator::fromLogs($this->logs(array_fill(0, 600, 90))));
+    }
+
+    public function test_decimal_point_and_overscale_normalized(): void
+    {
+        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 1)));
+        $this->assertSame(1.0, F0Calculator::fromLogs($this->logs(array_fill(0, 60, 1211), 0)));
+    }
+}
