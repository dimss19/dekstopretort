<?php

namespace App\Services;

class F0Calculator
{
    public const TREF = 121.1;
    public const Z = 10.0;
    public const THRESHOLD = 100.0;
    public const MAX_GAP_SECONDS = 120;

    /**
     * Normalize PV value from log entry (handles 'pv' or 'actual', decimal point scaling, and raw scale).
     */
    public static function normalizePv(array $log): float
    {
        $raw = $log['pv'] ?? $log['actual'] ?? 0;
        $pv = (float) $raw;
        $dp = (int) ($log['decimal_point'] ?? 0);
        if ($dp > 0) {
            $pv /= (10 ** $dp);
        }
        if ($pv > 300) {
            $pv /= 10.0;
        }
        return $pv;
    }

    /**
     * Parse timestamp string to unix epoch seconds or return null if invalid.
     */
    public static function parseTimestamp(?string $ts): ?int
    {
        if (empty($ts)) {
            return null;
        }
        $time = strtotime($ts);
        return $time !== false ? $time : null;
    }

    /**
     * Calculate F0 using Trapezoidal integration based on actual timestamps.
     *
     * @param array $logs List of log entries, each containing pv/actual and created_at/recorded_at
     * @param float $tRef Reference temperature in C (default 121.1)
     * @param float $z z-value in C (default 10.0)
     * @param float $threshold Minimum temperature threshold in C (default 100.0)
     * @param int $maxGapSeconds Maximum allowed gap in seconds before suppressing phantom lethality (default 120)
     * @return float Accumulated F0 lethality rounded to 2 decimal places
     */
    public static function fromLogs(
        array $logs,
        float $tRef = self::TREF,
        float $z = self::Z,
        float $threshold = self::THRESHOLD,
        int $maxGapSeconds = self::MAX_GAP_SECONDS
    ): float {
        $count = count($logs);
        if ($count < 2) {
            return 0.0;
        }

        // Check if logs contain timestamp information
        $hasTimestamps = false;
        foreach ($logs as $l) {
            if (!empty($l['created_at']) || !empty($l['recorded_at'])) {
                $hasTimestamps = true;
                break;
            }
        }

        if ($hasTimestamps) {
            // Sort chronologically ascending by timestamp
            $sorted = $logs;
            usort($sorted, function ($a, $b) {
                $ta = self::parseTimestamp($a['created_at'] ?? $a['recorded_at'] ?? null) ?? 0;
                $tb = self::parseTimestamp($b['created_at'] ?? $b['recorded_at'] ?? null) ?? 0;
                return $ta <=> $tb;
            });

            $f0 = 0.0;
            for ($i = 1; $i < $count; $i++) {
                $prev = $sorted[$i - 1];
                $curr = $sorted[$i];

                $tPrev = self::parseTimestamp($prev['created_at'] ?? $prev['recorded_at'] ?? null);
                $tCurr = self::parseTimestamp($curr['created_at'] ?? $curr['recorded_at'] ?? null);

                // Handle missing / invalid timestamps: fallback to 1 second
                if ($tPrev === null || $tCurr === null) {
                    $dtSeconds = 1;
                } else {
                    $dtSeconds = $tCurr - $tPrev;
                }

                // If duplicate (dt = 0) or backward timestamp, skip
                if ($dtSeconds <= 0) {
                    continue;
                }

                // If gap exceeds maxGapSeconds (e.g. sensor disconnected / power cut), suppress phantom lethality
                if ($dtSeconds > $maxGapSeconds) {
                    continue;
                }

                $dtMinutes = $dtSeconds / 60.0;

                $pvPrev = self::normalizePv($prev);
                $pvCurr = self::normalizePv($curr);

                $lPrev = ($pvPrev >= $threshold) ? (10 ** (($pvPrev - $tRef) / $z)) : 0.0;
                $lCurr = ($pvCurr >= $threshold) ? (10 ** (($pvCurr - $tRef) / $z)) : 0.0;

                $f0 += (($lPrev + $lCurr) / 2.0) * $dtMinutes;
            }

            return round($f0, 2);
        }

        // Fallback for timestamp-less synthetic logs: assume 1 second interval between points
        $f0 = 0.0;
        $dtMinutes = 1.0 / 60.0;
        for ($i = 1; $i < $count; $i++) {
            $pvPrev = self::normalizePv($logs[$i - 1]);
            $pvCurr = self::normalizePv($logs[$i]);

            $lPrev = ($pvPrev >= $threshold) ? (10 ** (($pvPrev - $tRef) / $z)) : 0.0;
            $lCurr = ($pvCurr >= $threshold) ? (10 ** (($pvCurr - $tRef) / $z)) : 0.0;

            $f0 += (($lPrev + $lCurr) / 2.0) * $dtMinutes;
        }

        return round($f0, 2);
    }
}
