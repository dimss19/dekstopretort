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
