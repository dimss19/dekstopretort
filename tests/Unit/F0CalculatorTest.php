<?php

namespace Tests\Unit;

use App\Services\F0Calculator;
use PHPUnit\Framework\TestCase;
use Carbon\Carbon;

class F0CalculatorTest extends TestCase
{
    private function logs(array $pvs, int $dp = 0): array
    {
        return array_map(fn ($pv) => ['pv' => $pv, 'decimal_point' => $dp], $pvs);
    }

    public function test_constant_121_1_for_60_seconds_with_timestamps_is_1(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [];
        for ($i = 0; $i <= 60; $i++) {
            $logs[] = [
                'pv' => 121.1,
                'created_at' => $start->copy()->addSeconds($i)->toIso8601String(),
            ];
        }
        $this->assertSame(1.0, F0Calculator::fromLogs($logs));
    }

    public function test_constant_121_1_for_30_minutes_at_1s_interval_is_30(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [];
        for ($i = 0; $i <= 1800; $i++) {
            $logs[] = [
                'pv' => 121.1,
                'created_at' => $start->copy()->addSeconds($i)->toIso8601String(),
            ];
        }
        $this->assertSame(30.0, F0Calculator::fromLogs($logs));
    }

    public function test_1_minute_interval_log_calculates_correct_f0(): void
    {
        // 60 minutes holding at 121.1 C with 1 data point per minute (61 points)
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [];
        for ($m = 0; $m <= 60; $m++) {
            $logs[] = [
                'pv' => 121.1,
                'created_at' => $start->copy()->addMinutes($m)->toIso8601String(),
            ];
        }
        // With previous 1-point rectangle (hardcoded dt=1/60), this produced 1.0 min instead of 60 min.
        // With timestamp-based trapezoidal, this must be 60.0 min.
        $this->assertSame(60.0, F0Calculator::fromLogs($logs, 121.1, 10.0, 100.0, 300));
    }

    public function test_irregular_intervals_using_trapezoidal_integration(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [
            ['pv' => 120.0, 'created_at' => $start->copy()->toIso8601String()],                         // t = 0
            ['pv' => 121.0, 'created_at' => $start->copy()->addSeconds(10)->toIso8601String()],        // dt = 10s (0.1667 min)
            ['pv' => 122.0, 'created_at' => $start->copy()->addSeconds(30)->toIso8601String()],        // dt = 20s (0.3333 min)
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(60)->toIso8601String()],        // dt = 30s (0.5000 min)
        ];

        // L(120.0) = 10^(-0.11) = 0.776247
        // L(121.0) = 10^(-0.01) = 0.977237
        // L(122.0) = 10^(0.09)  = 1.230269
        // L(121.1) = 10^(0.00)  = 1.000000
        // Trap 1: (0.776247 + 0.977237) / 2 * (10 / 60) = 0.876742 * 0.166667 = 0.146124
        // Trap 2: (0.977237 + 1.230269) / 2 * (20 / 60) = 1.103753 * 0.333333 = 0.367918
        // Trap 3: (1.230269 + 1.000000) / 2 * (30 / 60) = 1.115134 * 0.500000 = 0.557567
        // Total = 0.146124 + 0.367918 + 0.557567 = 1.071609 ~ 1.07 min
        $this->assertSame(1.07, F0Calculator::fromLogs($logs));
    }

    public function test_duplicate_and_out_of_order_timestamps(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(20)->toIso8601String()],
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(0)->toIso8601String()],
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(20)->toIso8601String()], // duplicate timestamp
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(60)->toIso8601String()],
        ];

        // Total span: 0 to 60s @ 121.1 C = 1.00 min
        $this->assertSame(1.0, F0Calculator::fromLogs($logs));
    }

    public function test_large_gap_suppresses_phantom_lethality(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [
            ['pv' => 121.1, 'created_at' => $start->copy()->toIso8601String()],
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(30)->toIso8601String()], // +30s (0.50 min)
            // Sensor disconnect for 15 minutes (900 seconds > maxGap 120s)
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(930)->toIso8601String()], // gap suppressed
            ['pv' => 121.1, 'created_at' => $start->copy()->addSeconds(960)->toIso8601String()], // +30s (0.50 min)
        ];

        // Should only accumulate 30s + 30s = 60s (1.00 min), NOT 16 minutes!
        $this->assertSame(1.0, F0Calculator::fromLogs($logs, 121.1, 10.0, 100.0, 120));
    }

    public function test_below_100_contributes_zero(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [
            ['pv' => 90.0, 'created_at' => $start->copy()->toIso8601String()],
            ['pv' => 95.0, 'created_at' => $start->copy()->addSeconds(30)->toIso8601String()],
            ['pv' => 99.9, 'created_at' => $start->copy()->addSeconds(60)->toIso8601String()],
        ];
        $this->assertSame(0.0, F0Calculator::fromLogs($logs));
    }

    public function test_custom_tref_and_z_value_from_recipe(): void
    {
        // Pasteurization recipe: Tref = 90.0 C, z = 8.0 C, threshold = 70.0 C
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logs = [
            ['pv' => 90.0, 'created_at' => $start->copy()->toIso8601String()],
            ['pv' => 90.0, 'created_at' => $start->copy()->addSeconds(60)->toIso8601String()],
        ];
        // At 90.0 C for 60s with Tref = 90.0 C, lethality rate is 1.0, F should be 1.00
        $this->assertSame(1.0, F0Calculator::fromLogs($logs, 90.0, 8.0, 70.0));
    }

    public function test_single_point_returns_zero(): void
    {
        $logs = [['pv' => 121.1, 'created_at' => '2026-09-30 08:00:00']];
        $this->assertSame(0.0, F0Calculator::fromLogs($logs));
    }

    public function test_decimal_point_and_overscale_normalized(): void
    {
        $start = Carbon::parse('2026-09-30 08:00:00');
        $logsDp1 = [];
        $logsDp0 = [];
        for ($i = 0; $i <= 60; $i++) {
            $logsDp1[] = ['pv' => 1211, 'decimal_point' => 1, 'created_at' => $start->copy()->addSeconds($i)->toIso8601String()];
            $logsDp0[] = ['pv' => 1211, 'decimal_point' => 0, 'created_at' => $start->copy()->addSeconds($i)->toIso8601String()];
        }

        $this->assertSame(1.0, F0Calculator::fromLogs($logsDp1));
        $this->assertSame(1.0, F0Calculator::fromLogs($logsDp0));
    }
}
