0536221 fix: calculateF0 Tref 121.1 metode 1-titik + test
 resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts | 4 ++++
 resources/js/Pages/Tn/retortTelemetry.ts                | 4 ++--
 2 files changed, 6 insertions(+), 2 deletions(-)
diff --git a/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts b/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
index 07ade4d..d0e3909 100644
--- a/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
+++ b/resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
@@ -96,20 +96,24 @@ describe('retort telemetry normalization', () => {
 
     it('calculates F0 thermal lethality value accurately for sterilization temperatures', () => {
         // At exactly 121.11┬░C for 60 seconds (1 minute), F0 should be 1.0
         expect(calculateF0(Array(60).fill(121.11), 1)).toBe(1);
         // At 100┬░C for 10 minutes, F0 should be small (~0.08)
         expect(calculateF0(Array(600).fill(100), 1)).toBe(0.08);
         // Under 100┬░C contributes 0 to F0
         expect(calculateF0(Array(600).fill(90), 1)).toBe(0);
     });
 
+    it('uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)', () => {
+        expect(calculateF0(Array(600).fill(121.0), 1)).toBe(9.77);
+    });
+
     it('segments multi-step retort process into named categories with duration', () => {
         const dummyReadings = [
             // Step 0: CUT (60 seconds -> 1 min)
             ...Array(60).fill(null).map((_, i) => ({ step_current: 0, pv: 250 + i * 15, decimal_point: 1 })),
             // Step 1: Holding (120 seconds -> 2 min)
             ...Array(120).fill(null).map(() => ({ step_current: 1, pv: 1210, decimal_point: 1 })),
             // Step 2: Cooling (60 seconds -> 1 min)
             ...Array(60).fill(null).map((_, i) => ({ step_current: 2, pv: 1210 - i * 10, decimal_point: 1 })),
         ];
 
diff --git a/resources/js/Pages/Tn/retortTelemetry.ts b/resources/js/Pages/Tn/retortTelemetry.ts
index 15e4e97..7fe9e97 100644
--- a/resources/js/Pages/Tn/retortTelemetry.ts
+++ b/resources/js/Pages/Tn/retortTelemetry.ts
@@ -219,28 +219,28 @@ export interface RetortStepSegment {
     endMinute: number;
     durationMinutes: number;
     avgTemperature: number;
     maxTemperature: number;
     f0Value: number;
     isHolding: boolean;
 }
 
 /**
  * Calculates F0 sterilization lethality value given temperature history
- * F0 = sum(dt_minutes * 10^((T - 121.11) / 10)) for T >= 100┬░C
+ * F0 = sum(dt_minutes * 10^((T - 121.1) / 10)) for T >= 100┬░C
  */
 export function calculateF0(temperatures: number[], intervalSeconds: number = 1): number {
     let f0 = 0;
     const dtMinutes = intervalSeconds / 60;
     for (const temp of temperatures) {
         if (temp >= 100) {
-            f0 += dtMinutes * Math.pow(10, (temp - 121.11) / 10);
+            f0 += dtMinutes * Math.pow(10, (temp - 121.1) / 10);
         }
     }
     return Math.round(f0 * 100) / 100;
 }
 
 /**
  * Groups readings into thermal step segments based on step transitions and temperature behavior
  */
 export function segmentThermalSteps(readings: any[]): RetortStepSegment[] {
     if (!readings || readings.length === 0) return [];
