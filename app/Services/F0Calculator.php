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
